#!/usr/bin/env python3
"""
JARVIS GPU Monitor Server
Real-time GPU monitoring for GTX 1080 Ti

Provides:
- VRAM usage tracking
- GPU temperature monitoring
- Utilization metrics
- Power draw statistics
- Loaded model detection
- Recommendations based on usage

Port: 5003 (distinct from other services)
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List
import websockets
import threading
from collections import deque

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import nvidia-ml-py (pynvml)
try:
    import pynvml
    NVML_AVAILABLE = True
except ImportError:
    NVML_AVAILABLE = False
    logger.warning("pynvml not installed. GPU monitoring will be limited.")
    logger.warning("Install with: pip install nvidia-ml-py")


@dataclass
class GpuStats:
    """GPU statistics snapshot"""
    timestamp: float
    
    # GPU Info
    name: str
    gpu_id: int
    
    # VRAM (in MB)
    vram_total: int
    vram_used: int
    vram_free: int
    vram_percent: float
    
    # Utilization (0-100%)
    gpu_utilization: int
    memory_utilization: int
    
    # Temperature
    temperature: int
    
    # Power (in W)
    power_draw: float
    power_limit: float
    
    # Clocks (in MHz)
    graphics_clock: int
    memory_clock: int
    sm_clock: int
    
    # Processes
    processes: List[Dict]
    
    def to_dict(self) -> dict:
        return asdict(self)


class GpuMonitor:
    """GPU monitoring service"""
    
    def __init__(self):
        self.handle = None
        self.device_count = 0
        self.history: deque = deque(maxlen=300)  # 5 minutes at 1 sample/sec
        self.running = False
        self.clients: set = set()
        self.lock = threading.Lock()
        
        # Model detection patterns
        self.model_patterns = {
            'ollama': ['ollama', 'llama', 'mistral', 'codellama'],
            'whisper': ['whisper', 'stt'],
            'embedding': ['embedding', 'sentence'],
            'python': ['python.exe', 'python3']
        }
        
        self.init_nvml()
    
    def init_nvml(self) -> bool:
        """Initialize NVML"""
        if not NVML_AVAILABLE:
            return False
        
        try:
            pynvml.nvmlInit()
            self.device_count = pynvml.nvmlDeviceGetCount()
            
            if self.device_count > 0:
                self.handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                name = pynvml.nvmlDeviceGetName(self.handle)
                logger.info(f"GPU Monitor initialized: {name}")
                return True
            else:
                logger.warning("No NVIDIA GPUs found")
                return False
                
        except Exception as e:
            logger.error(f"Failed to initialize NVML: {e}")
            return False
    
    def get_gpu_stats(self) -> Optional[GpuStats]:
        """Get current GPU statistics"""
        if not NVML_AVAILABLE or self.handle is None:
            return self._get_mock_stats()
        
        try:
            # VRAM info
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(self.handle)
            vram_total = mem_info.total // (1024 * 1024)  # Convert to MB
            vram_used = mem_info.used // (1024 * 1024)
            vram_free = mem_info.free // (1024 * 1024)
            vram_percent = (vram_used / vram_total) * 100 if vram_total > 0 else 0
            
            # Utilization
            util = pynvml.nvmlDeviceGetUtilizationRates(self.handle)
            gpu_util = util.gpu
            mem_util = util.memory
            
            # Temperature
            temp = pynvml.nvmlDeviceGetTemperature(self.handle, pynvml.NVML_TEMPERATURE_GPU)
            
            # Power
            power_draw = pynvml.nvmlDeviceGetPowerUsage(self.handle) / 1000.0  # Convert mW to W
            try:
                power_limit = pynvml.nvmlDeviceGetEnforcedPowerLimit(self.handle) / 1000.0
            except:
                power_limit = 250.0  # Default for 1080 Ti
            
            # Clocks
            graphics_clock = pynvml.nvmlDeviceGetClockInfo(self.handle, pynvml.NVML_CLOCK_GRAPHICS)
            memory_clock = pynvml.nvmlDeviceGetClockInfo(self.handle, pynvml.NVML_CLOCK_MEM)
            sm_clock = pynvml.nvmlDeviceGetClockInfo(self.handle, pynvml.NVML_CLOCK_SM)
            
            # GPU name
            name = pynvml.nvmlDeviceGetName(self.handle)
            
            # Running processes
            processes = self._get_gpu_processes()
            
            return GpuStats(
                timestamp=time.time(),
                name=name,
                gpu_id=0,
                vram_total=vram_total,
                vram_used=vram_used,
                vram_free=vram_free,
                vram_percent=round(vram_percent, 1),
                gpu_utilization=gpu_util,
                memory_utilization=mem_util,
                temperature=temp,
                power_draw=round(power_draw, 1),
                power_limit=round(power_limit, 1),
                graphics_clock=graphics_clock,
                memory_clock=memory_clock,
                sm_clock=sm_clock,
                processes=processes
            )
            
        except Exception as e:
            logger.error(f"Error getting GPU stats: {e}")
            return None
    
    def _get_gpu_processes(self) -> List[Dict]:
        """Get list of processes using GPU"""
        processes = []
        
        try:
            # Try to get compute processes
            try:
                compute_procs = pynvml.nvmlDeviceGetComputeRunningProcesses(self.handle)
                for proc in compute_procs:
                    processes.append({
                        'pid': proc.pid,
                        'name': self._get_process_name(proc.pid),
                        'vram_mb': proc.usedGpuMemory // (1024 * 1024) if hasattr(proc, 'usedGpuMemory') else 0,
                        'type': 'compute'
                    })
            except pynvml.NVMLError_NotSupported:
                pass
            
            # Try to get graphics processes
            try:
                graphics_procs = pynvml.nvmlDeviceGetGraphicsRunningProcesses(self.handle)
                for proc in graphics_procs:
                    # Skip if already in compute list
                    if not any(p['pid'] == proc.pid for p in processes):
                        processes.append({
                            'pid': proc.pid,
                            'name': self._get_process_name(proc.pid),
                            'vram_mb': proc.usedGpuMemory // (1024 * 1024) if hasattr(proc, 'usedGpuMemory') else 0,
                            'type': 'graphics'
                        })
            except pynvml.NVMLError_NotSupported:
                pass
                
        except Exception as e:
            logger.debug(f"Could not get process list: {e}")
        
        return processes
    
    def _get_process_name(self, pid: int) -> str:
        """Get process name from PID"""
        try:
            import psutil
            proc = psutil.Process(pid)
            return proc.name()
        except:
            return f"pid_{pid}"
    
    def _get_mock_stats(self) -> GpuStats:
        """Generate mock stats for testing without GPU"""
        return GpuStats(
            timestamp=time.time(),
            name="NVIDIA GeForce GTX 1080 Ti (MOCK)",
            gpu_id=0,
            vram_total=11264,
            vram_used=6144,
            vram_free=5120,
            vram_percent=54.5,
            gpu_utilization=75,
            memory_utilization=60,
            temperature=72,
            power_draw=185.5,
            power_limit=250.0,
            graphics_clock=1607,
            memory_clock=5005,
            sm_clock=1607,
            processes=[
                {'pid': 1234, 'name': 'ollama.exe', 'vram_mb': 5120, 'type': 'compute'},
                {'pid': 5678, 'name': 'python.exe', 'vram_mb': 512, 'type': 'compute'}
            ]
        )
    
    def detect_models(self, processes: List[Dict]) -> Dict[str, List[Dict]]:
        """Detect which AI models are running"""
        detected = {
            'llm': [],
            'whisper': [],
            'embedding': [],
            'other': []
        }
        
        for proc in processes:
            name_lower = proc['name'].lower()
            assigned = False
            
            for model_type, patterns in self.model_patterns.items():
                if any(pattern in name_lower for pattern in patterns):
                    if model_type == 'ollama':
                        detected['llm'].append(proc)
                    elif model_type == 'whisper':
                        detected['whisper'].append(proc)
                    elif model_type == 'embedding':
                        detected['embedding'].append(proc)
                    else:
                        detected['other'].append(proc)
                    assigned = True
                    break
            
            if not assigned:
                detected['other'].append(proc)
        
        return detected
    
    def get_recommendations(self, stats: GpuStats) -> List[str]:
        """Generate recommendations based on GPU state"""
        recommendations = []
        
        # VRAM recommendations
        if stats.vram_percent > 90:
            recommendations.append("⚠️ VRAM critically high! Consider unloading unused models.")
        elif stats.vram_percent > 75:
            recommendations.append("💡 VRAM usage is high. Unload unused models to free space.")
        
        # Temperature recommendations
        if stats.temperature > 85:
            recommendations.append("🌡️ GPU temperature is very high! Check cooling.")
        elif stats.temperature > 80:
            recommendations.append("🌡️ GPU temperature is elevated. Ensure good airflow.")
        
        # Power recommendations
        if stats.power_draw > stats.power_limit * 0.9:
            recommendations.append("⚡ Power draw near limit. Performance may be throttled.")
        
        # Utilization recommendations
        if stats.gpu_utilization < 10 and stats.vram_used > 4000:
            recommendations.append("📊 GPU idle but VRAM in use. Consider unloading unused models.")
        
        return recommendations if recommendations else ["✅ GPU operating normally"]
    
    async def monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                stats = self.get_gpu_stats()
                if stats:
                    with self.lock:
                        self.history.append(stats)
                    
                    # Detect models
                    models = self.detect_models(stats.processes)
                    
                    # Get recommendations
                    recommendations = self.get_recommendations(stats)
                    
                    # Build message
                    message = {
                        'type': 'gpu_stats',
                        'data': {
                            'current': stats.to_dict(),
                            'models': models,
                            'recommendations': recommendations,
                            'history': [h.to_dict() for h in list(self.history)[-60:]]  # Last 60 seconds
                        }
                    }
                    
                    # Broadcast to all clients
                    if self.clients:
                        disconnected = set()
                        for client in self.clients:
                            try:
                                await client.send(json.dumps(message))
                            except:
                                disconnected.add(client)
                        
                        # Remove disconnected clients
                        self.clients -= disconnected
                
                await asyncio.sleep(1)  # 1 second update interval
                
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                await asyncio.sleep(5)
    
    async def handle_client(self, websocket, path):
        """Handle WebSocket client connection"""
        logger.info(f"Client connected: {websocket.remote_address}")
        self.clients.add(websocket)
        
        try:
            # Send immediate update
            stats = self.get_gpu_stats()
            if stats:
                message = {
                    'type': 'gpu_stats',
                    'data': {
                        'current': stats.to_dict(),
                        'models': self.detect_models(stats.processes),
                        'recommendations': self.get_recommendations(stats),
                        'history': [h.to_dict() for h in list(self.history)[-60:]]
                    }
                }
                await websocket.send(json.dumps(message))
            
            # Keep connection alive
            while True:
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=30)
                    data = json.loads(msg)
                    
                    # Handle commands
                    if data.get('command') == 'get_history':
                        response = {
                            'type': 'history',
                            'data': [h.to_dict() for h in self.history]
                        }
                        await websocket.send(json.dumps(response))
                        
                except asyncio.TimeoutError:
                    # Send ping to keep alive
                    await websocket.send(json.dumps({'type': 'ping'}))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {websocket.remote_address}")
        finally:
            self.clients.discard(websocket)
    
    def start(self):
        """Start the GPU monitor"""
        self.running = True
        
        # Start WebSocket server
        logger.info("Starting GPU Monitor WebSocket server on ws://localhost:5003")
        
        async def main():
            # Start monitoring loop
            monitor_task = asyncio.create_task(self.monitor_loop())
            
            # Start WebSocket server
            start_server = websockets.serve(
                self.handle_client,
                'localhost',
                5003,
                ping_interval=20,
                ping_timeout=10
            )
            
            await start_server
            await asyncio.Future()  # Run forever
        
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            logger.info("Shutting down...")
    
    def stop(self):
        """Stop the GPU monitor"""
        self.running = False
        if NVML_AVAILABLE:
            try:
                pynvml.nvmlShutdown()
            except:
                pass


def print_banner():
    """Print startup banner"""
    banner = r"""
    +============================================================+
    |               JARVIS GPU Monitor Server                    |
    |                                                            |
    |   Hardware: NVIDIA GPU monitoring via NVML                 |
    |   WebSocket: ws://localhost:5003                           |
    |                                                            |
    |   Features:                                                |
    |     * Real-time VRAM tracking                              |
    |     * GPU temperature monitoring                           |
    |     * Power draw statistics                                |
    |     * Model detection                                      |
    |     * Smart recommendations                                |
    |                                                            |
    +============================================================+
    """
    print(banner)


if __name__ == '__main__':
    print_banner()
    
    monitor = GpuMonitor()
    
    if not NVML_AVAILABLE:
        print("\n⚠️  WARNING: Running in MOCK mode (no actual GPU access)")
        print("   Install pynvml for real GPU monitoring:")
        print("   pip install nvidia-ml-py psutil\n")
    
    try:
        monitor.start()
    except KeyboardInterrupt:
        logger.info("Shutting down GPU Monitor...")
        monitor.stop()
