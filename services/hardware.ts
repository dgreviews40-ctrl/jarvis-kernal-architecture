import { SystemMetrics, ProcessorState } from "../types";

const HARDWARE_API_URL = 'http://localhost:3100/stats';

interface BackendStats {
  cpuLoad: number;
  memoryUsage: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  gpuLoad: number;
  gpuMemoryUsage: number;
  gpuName: string;
  temperature: number;
  uptime: number;
  cpuName: string;
  lastUpdate: number;
}

class HardwareMonitor {
  private metrics: SystemMetrics = {
    cpuLoad: 0,
    memoryUsage: 0,
    gpuLoad: 0,
    temperature: 0,
    uptime: 0
  };
  
  private extendedMetrics: BackendStats | null = null;
  private observers: ((metrics: SystemMetrics) => void)[] = [];
  private intervalId: number | null = null;
  private backendAvailable: boolean = false;
  private isPageVisible: boolean = true;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.setupVisibilityHandler();
    this.checkBackendAndStart();
  }

  private setupVisibilityHandler() {
    // Pause polling when tab is hidden to save resources
    this.visibilityHandler = () => {
      this.isPageVisible = !document.hidden;
      if (this.isPageVisible) {
        // Tab became visible - fetch immediately and resume polling
        this.fetchStats();
        this.startMonitoring();
      } else {
        // Tab hidden - stop polling
        this.stopMonitoring();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private async checkBackendAndStart() {
    // Check if backend is available
    try {
      const response = await fetch(HARDWARE_API_URL);
      if (response.ok) {
        this.backendAvailable = true;
        console.log('[HARDWARE] Backend monitor connected');
      }
    } catch (e) {
      this.backendAvailable = false;
      console.warn('[HARDWARE] Backend not available - run: node server/hardware-monitor.js');
    }
    
    this.startMonitoring();
  }

  public setProcessorState(state: ProcessorState) {
    // Not needed when using real stats, but kept for interface compatibility
  }

  public subscribe(callback: (metrics: SystemMetrics) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  public getExtendedMetrics(): BackendStats | null {
    return this.extendedMetrics;
  }

  public isBackendConnected(): boolean {
    return this.backendAvailable;
  }

  private startMonitoring() {
    // Don't start if already running or page is hidden
    if (this.intervalId || !this.isPageVisible) return;
    
    // Initial fetch
    this.fetchStats();
    
    // Poll every second (only when visible)
    this.intervalId = window.setInterval(() => {
      if (this.isPageVisible) {
        this.fetchStats();
      }
    }, 1000);
  }

  private stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async fetchStats() {
    if (this.backendAvailable) {
      try {
        const response = await fetch(HARDWARE_API_URL);
        if (response.ok) {
          const data: BackendStats = await response.json();
          this.extendedMetrics = data;
          
          this.metrics = {
            cpuLoad: data.cpuLoad,
            memoryUsage: data.memoryUsage,
            gpuLoad: data.gpuLoad,
            temperature: data.temperature,
            uptime: data.uptime
          };
          
          this.notify();
          return;
        }
      } catch (e) {
        // Backend went offline, try to reconnect
        this.backendAvailable = false;
        console.warn('[HARDWARE] Backend disconnected, attempting reconnect...');
      }
    } else {
      // Try to reconnect to backend
      try {
        const response = await fetch(HARDWARE_API_URL);
        if (response.ok) {
          this.backendAvailable = true;
          console.log('[HARDWARE] Backend reconnected');
          return;
        }
      } catch (e) {
        // Still offline
      }
    }
    
    // Fallback: use basic browser APIs if backend unavailable
    this.useFallbackStats();
  }

  private useFallbackStats() {
    // Basic memory from Performance API (Chrome only)
    let memoryUsage = 0;
    if ((performance as any).memory) {
      const mem = (performance as any).memory;
      memoryUsage = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
    }
    
    this.metrics = {
      cpuLoad: 0, // Can't get without backend
      memoryUsage: memoryUsage,
      gpuLoad: 0, // Can't get without backend
      temperature: 0, // Can't get without backend
      uptime: Math.floor(performance.now() / 1000)
    };
    
    this.extendedMetrics = null;
    this.notify();
  }

  private notify() {
    this.observers.forEach(cb => cb(this.metrics));
  }

  public destroy() {
    this.stopMonitoring();
    
    // Remove visibility listener
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

export const hardware = new HardwareMonitor();
