# JARVIS Critical Fixes - Implementation Guide

This document provides specific code fixes for the critical issues identified in the analysis.

---

## Fix 1: Duplicate Import in kernelProcessor.ts

**File:** `services/kernelProcessor.ts`

**Problem:** Line 38 and 66 both import `memoryConsolidationService`.

**Fix:** Remove the duplicate on line 66.

```typescript
// Remove this line (around line 66):
import { memoryConsolidationService } from './memoryConsolidationService';
```

---

## Fix 2: Add localStorage Quota Error Handling

**File:** `services/memory.ts`

**Current Code (lines 242-249):**
```typescript
private persist(): void {
  try {
    const nodesArray = Array.from(this.nodes.values());
    localStorage.setItem(this.storageKey, JSON.stringify(nodesArray));
  } catch (e) {
    console.error('[MEMORY] Failed to persist:', e);
  }
}
```

**Fixed Code:**
```typescript
private persist(): void {
  try {
    const nodesArray = Array.from(this.nodes.values());
    const data = JSON.stringify(nodesArray);
    
    // Check approximate size (2 bytes per char for UTF-16)
    const sizeMB = (data.length * 2) / (1024 * 1024);
    if (sizeMB > 4) {  // Warn at 4MB (leaving headroom for 5-10MB limit)
      logger.log('MEMORY', `Memory data is large (${sizeMB.toFixed(2)}MB), consider cleanup`, 'warning');
    }
    
    localStorage.setItem(this.storageKey, data);
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      logger.log('MEMORY', 'Storage quota exceeded. Removing oldest memories...', 'error');
      this.handleStorageQuotaExceeded();
    } else {
      console.error('[MEMORY] Failed to persist:', e);
      logger.log('MEMORY', `Persist failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  }
}

private handleStorageQuotaExceeded(): void {
  // Remove 20% of oldest memories
  const nodesToRemove = Math.floor(this.nodes.size * 0.2);
  const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.created - b.created);
  
  for (let i = 0; i < nodesToRemove && i < sortedNodes.length; i++) {
    const node = sortedNodes[i];
    this.nodes.delete(node.id);
    this.removeFromIndex(node.id);
  }
  
  logger.log('MEMORY', `Removed ${nodesToRemove} oldest memories to free space`, 'warning');
  
  // Try to persist again
  try {
    const nodesArray = Array.from(this.nodes.values());
    localStorage.setItem(this.storageKey, JSON.stringify(nodesArray));
    logger.log('MEMORY', 'Successfully persisted after cleanup', 'success');
  } catch (e) {
    logger.log('MEMORY', 'Still cannot persist after cleanup. Data will be lost on refresh.', 'error');
  }
}
```

---

## Fix 3: Rate Limiter Persistence

**File:** `services/rateLimiter.ts`

**Add to the RateLimiter class:**

```typescript
private readonly STORAGE_KEY = 'jarvis_rate_limit_state';

constructor() {
  // Load persisted state
  this.loadState();
  
  // Save state periodically and on page unload
  setInterval(() => this.saveState(), 60000); // Every minute
  window.addEventListener('beforeunload', () => this.saveState());
}

private loadState(): void {
  try {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      const now = Date.now();
      
      // Only restore if saved within last 24 hours
      if (state.savedAt && (now - state.savedAt) < 24 * 60 * 60 * 1000) {
        this.dailyCount = state.dailyCount || 0;
        this.perMinuteCount = state.perMinuteCount || 0;
        this.lastResetTime = state.lastResetTime || now;
        
        logger.log('RATE_LIMITER', 'Restored rate limit state from storage', 'info');
      }
    }
  } catch (e) {
    logger.log('RATE_LIMITER', 'Failed to load rate limit state', 'warning');
  }
}

private saveState(): void {
  try {
    const state = {
      dailyCount: this.dailyCount,
      perMinuteCount: this.perMinuteCount,
      lastResetTime: this.lastResetTime,
      savedAt: Date.now()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Silently fail - rate limiting will still work, just reset on refresh
  }
}
```

---

## Fix 4: AudioContext Cleanup in Voice Service

**File:** `services/voice.ts`

**Add emergency cleanup method:**

```typescript
/**
 * Emergency cleanup for audio resources - call when errors occur
 */
private emergencyAudioCleanup(): void {
  console.log('[VOICE] Emergency audio cleanup');
  
  // Stop and release all audio contexts
  this.audioContextPool.forEach(ctx => {
    try {
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  
  this.audioContextPool = [];
  this.activeAudioContexts.clear();
  this.contextIdleTimers.forEach(timer => clearTimeout(timer));
  this.contextIdleTimers.clear();
  
  // Recreate minimum pool
  this.initAudioContextPool();
}

// Call in error handler:
private handleError(event: SpeechRecognitionErrorEvent): void {
  console.error('[VOICE] Recognition error:', event.error);
  this.errorCount++;
  
  // Emergency cleanup on critical errors
  if (event.error === 'audio-capture' || event.error === 'network') {
    this.emergencyAudioCleanup();
  }
  
  // ... rest of error handling
}
```

---

## Fix 5: Add Error Boundary to Lazy Components

**File:** `components/ErrorBoundary.tsx` (enhance existing)

**Ensure ErrorBoundary catches more error types:**

```typescript
// Add to ErrorBoundary class
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  // Log to error reporting service
  logger.log('ERROR_BOUNDARY', `Caught error: ${error.message}`, 'error', {
    stack: error.stack,
    componentStack: errorInfo.componentStack
  });
  
  // Try to recover if possible
  if (this.state.error?.message?.includes('ChunkLoadError')) {
    // Code splitting failed - reload the chunk
    window.location.reload();
  }
}
```

---

## Fix 6: Extract Magic Numbers

**File:** `constants/config.ts`

**Add new TIMING constants:**

```typescript
export const TIMING = {
  // ... existing constants
  
  /** Wake word grace period after detection */
  WAKE_WORD_GRACE_PERIOD_MS: 10000,
  
  /** Window for duplicate command detection */
  DUPLICATE_COMMAND_WINDOW_MS: 5000,
  
  /** Camera initialization delay */
  CAMERA_INIT_DELAY_MS: 300,
  
  /** Capture state reset delay */
  CAPTURE_RESET_DELAY_MS: 300,
  
  /** Voice command hash cleanup interval */
  VOICE_HASH_CLEANUP_INTERVAL_MS: 60000,
} as const;
```

**Then update voice.ts:**
```typescript
// Replace magic numbers with constants
private readonly WAKE_WORD_GRACE_PERIOD = TIMING.WAKE_WORD_GRACE_PERIOD_MS;
private readonly DUPLICATE_COMMAND_WINDOW = TIMING.DUPLICATE_COMMAND_WINDOW_MS;
```

---

## Fix 7: EventBus Memory Leak Prevention

**File:** `services/eventBus.ts`

**Add automatic cleanup:**

```typescript
class EventBus {
  // Add new property
  private readonly MAX_SUBSCRIPTION_AGE_MS = 30 * 60 * 1000; // 30 minutes
  private subscriptionTimestamps = new Map<string, number>();

  subscribe(
    channel: string,
    handler: (event: KernelEvent) => void | Promise<void>,
    options: { priority?: EventPriority; once?: boolean; maxAge?: number } = {}
  ): () => void {
    // ... existing code ...
    
    // Track subscription time
    this.subscriptionTimestamps.set(subscription.id, Date.now());
    
    // Schedule automatic cleanup for old subscriptions
    if (!options.once) {
      setTimeout(() => {
        this.cleanupOldSubscription(subscription.id);
      }, options.maxAge || this.MAX_SUBSCRIPTION_AGE_MS);
    }
    
    return () => {
      this.unsubscribe(subscription.id);
      this.subscriptionTimestamps.delete(subscription.id);
    };
  }
  
  private cleanupOldSubscription(id: string): void {
    const timestamp = this.subscriptionTimestamps.get(id);
    if (timestamp) {
      const age = Date.now() - timestamp;
      if (age > this.MAX_SUBSCRIPTION_AGE_MS) {
        console.warn(`[EventBus] Auto-removing old subscription ${id}`);
        this.unsubscribe(id);
        this.subscriptionTimestamps.delete(id);
      }
    }
  }
  
  // Add method to force cleanup
  cleanup(): void {
    const now = Date.now();
    const idsToRemove: string[] = [];
    
    this.subscriptionTimestamps.forEach((timestamp, id) => {
      if (now - timestamp > this.MAX_SUBSCRIPTION_AGE_MS) {
        idsToRemove.push(id);
      }
    });
    
    idsToRemove.forEach(id => {
      this.unsubscribe(id);
      this.subscriptionTimestamps.delete(id);
    });
    
    if (idsToRemove.length > 0) {
      console.log(`[EventBus] Cleaned up ${idsToRemove.length} old subscriptions`);
    }
  }
}
```

---

## Fix 8: Python Server Health Monitoring

**Create new file:** `python_server_manager.py`

```python
#!/usr/bin/env python3
"""
JARVIS Python Server Manager
Monitors and manages all Python backend services
"""

import subprocess
import time
import json
import requests
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from threading import Thread, Lock
import signal
import sys

@dataclass
class ServerConfig:
    name: str
    script: str
    port: int
    health_endpoint: str = '/health'
    auto_restart: bool = True
    max_restarts: int = 3

@dataclass
class ServerStatus:
    name: str
    running: bool
    pid: Optional[int]
    last_check: datetime
    restarts: int
    errors: List[str]
    avg_response_time_ms: float = 0.0

class PythonServerManager:
    def __init__(self):
        self.servers: Dict[str, ServerConfig] = {}
        self.processes: Dict[str, subprocess.Popen] = {}
        self.statuses: Dict[str, ServerStatus] = {}
        self.lock = Lock()
        self.monitor_thread: Optional[Thread] = None
        self.running = False
        
        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def register_server(self, config: ServerConfig):
        """Register a server to be managed"""
        self.servers[config.name] = config
        self.statuses[config.name] = ServerStatus(
            name=config.name,
            running=False,
            pid=None,
            last_check=datetime.now(),
            restarts=0,
            errors=[]
        )
    
    def start_all(self):
        """Start all registered servers"""
        for name in self.servers:
            self.start_server(name)
        
        # Start monitoring
        self.running = True
        self.monitor_thread = Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
    
    def start_server(self, name: str) -> bool:
        """Start a specific server"""
        config = self.servers.get(name)
        if not config:
            return False
        
        try:
            process = subprocess.Popen(
                [sys.executable, config.script],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            with self.lock:
                self.processes[name] = process
                self.statuses[name].running = True
                self.statuses[name].pid = process.pid
            
            print(f"[ServerManager] Started {name} on port {config.port} (PID: {process.pid})")
            return True
            
        except Exception as e:
            with self.lock:
                self.statuses[name].errors.append(str(e))
            return False
    
    def stop_server(self, name: str) -> bool:
        """Stop a specific server"""
        process = self.processes.get(name)
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            with self.lock:
                self.statuses[name].running = False
                self.statuses[name].pid = None
            
            return True
        return False
    
    def check_health(self, name: str) -> bool:
        """Check if a server is healthy"""
        config = self.servers.get(name)
        if not config:
            return False
        
        try:
            start = time.time()
            response = requests.get(
                f'http://localhost:{config.port}{config.health_endpoint}',
                timeout=5
            )
            elapsed = (time.time() - start) * 1000
            
            with self.lock:
                self.statuses[name].avg_response_time_ms = elapsed
                self.statuses[name].last_check = datetime.now()
            
            return response.status_code == 200
            
        except Exception as e:
            with self.lock:
                self.statuses[name].errors.append(str(e))
            return False
    
    def _monitor_loop(self):
        """Background monitoring thread"""
        while self.running:
            for name, config in self.servers.items():
                if not self.check_health(name):
                    status = self.statuses[name]
                    
                    if config.auto_restart and status.restarts < config.max_restarts:
                        print(f"[ServerManager] {name} unhealthy, restarting...")
                        self.stop_server(name)
                        time.sleep(1)
                        if self.start_server(name):
                            with self.lock:
                                self.statuses[name].restarts += 1
                    else:
                        with self.lock:
                            self.statuses[name].running = False
            
            time.sleep(10)  # Check every 10 seconds
    
    def get_status(self) -> Dict:
        """Get status of all servers"""
        with self.lock:
            return {name: asdict(status) for name, status in self.statuses.items()}
    
    def shutdown(self):
        """Gracefully shutdown all servers"""
        print("[ServerManager] Shutting down all servers...")
        self.running = False
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        
        for name in list(self.processes.keys()):
            self.stop_server(name)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\n[ServerManager] Received signal {signum}")
        self.shutdown()
        sys.exit(0)

# Usage example
if __name__ == '__main__':
    manager = PythonServerManager()
    
    # Register all Python servers
    manager.register_server(ServerConfig(
        name='whisper',
        script='whisper_server.py',
        port=5001
    ))
    
    manager.register_server(ServerConfig(
        name='vision',
        script='vision_server.py',
        port=5004
    ))
    
    manager.register_server(ServerConfig(
        name='lora',
        script='lora_server.py',
        port=5005
    ))
    
    manager.register_server(ServerConfig(
        name='embedding',
        script='embedding_server.py',
        port=5006
    ))
    
    # Start all
    manager.start_all()
    
    # Keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        manager.shutdown()
```

---

## Implementation Priority

1. **Week 1:** Fixes 1, 2, 3 (Critical bugs)
2. **Week 2:** Fixes 4, 5, 6 (Memory and stability)
3. **Week 3:** Fix 7 (EventBus cleanup)
4. **Week 4:** Fix 8 (Python server manager)

---

**End of Implementation Guide**
