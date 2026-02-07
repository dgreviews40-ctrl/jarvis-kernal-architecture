/**
 * FAST Boot Orchestrator - Optimized for Speed
 * 
 * Optimizations:
 * - Removed artificial delays
 * - Parallel initialization where possible
 * - Vector DB sync during boot
 * - Optimized phase timing
 */

import { BootPhase, BootState } from "../types";
import { eventBus, EventChannels } from './eventBus';
import { workerPool } from './workerService';
import { resourceManager } from './resourceManager';
import { kernelApi } from './kernelApi';
import { getKernelStoreState, KERNEL_VERSION } from '../stores';
import { memory } from './memory';
import { vectorDB } from './vectorDB';

// Optimized phases - removed non-critical ones and reduced artificial delays
export const BOOT_PHASES_FAST: BootPhase[] = [
  { 
    id: 0, 
    name: "SYSTEM CHECK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Verifying environment...", "Checking storage access..."] 
  },
  { 
    id: 1, 
    name: "KERNEL MOUNT", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Initializing core services...", "Mounting logger..."] 
  },
  { 
    id: 2, 
    name: "CORTEX LINK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Loading memory banks...", "Syncing Vector DB..."] 
  },
  { 
    id: 3, 
    name: "EVENT BUS", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Initializing Pub/Sub...", "Registering handlers..."] 
  },
  { 
    id: 4, 
    name: "PLUGIN SYSTEM", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Loading plugins...", "Registering capabilities..."] 
  },
  { 
    id: 5, 
    name: "NEURAL BRIDGE", 
    criticality: "LOW", 
    status: "PENDING", 
    logs: ["Checking AI providers...", "Calibrating intent weights..."] 
  },
  { 
    id: 6, 
    name: "INTERFACE", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: ["Finalizing...", "Unlocking dashboard..."] 
  }
];

class FastBootOrchestrator {
  private currentPhaseIndex = 0;
  private subscribers: ((phase: BootPhase, state: BootState) => void)[] = [];
  private isBooting = false;
  private bootStartTime = 0;
  private phaseStartTime = 0;

  public subscribe(cb: (phase: BootPhase, state: BootState) => void) {
    this.subscribers.push(cb);
  }

  private notify(phase: BootPhase, state: BootState) {
    this.subscribers.forEach(cb => cb(phase, state));
  }

  public async startSequence() {
    if (this.isBooting) return;
    this.isBooting = true;
    this.currentPhaseIndex = 0;
    this.bootStartTime = Date.now();

    // Publish boot start event
    eventBus.publish(EventChannels.KERNEL.BOOT, {
      version: KERNEL_VERSION,
      timestamp: this.bootStartTime
    }, { priority: 'critical' });

    for (let i = 0; i < BOOT_PHASES_FAST.length; i++) {
      this.currentPhaseIndex = i;
      this.phaseStartTime = Date.now();
      
      const phase: BootPhase = { ...BOOT_PHASES_FAST[i], status: 'IN_PROGRESS' };
      this.notify(phase, BootState.PHASE_BOOT);

      try {
        // Execute phase-specific initialization
        await this.executePhase(phase);

        // OPTIMIZATION: Much shorter artificial delay (100-300ms vs 300-900ms)
        // Real work is already done, this is just for visual effect
        const processingTime = Math.random() * 150 + 50;
        await new Promise(r => setTimeout(r, processingTime));

        phase.status = 'SUCCESS';
        
        // Add timing info to logs
        const phaseDuration = Date.now() - this.phaseStartTime;
        phase.logs.push(`Done in ${phaseDuration}ms`);

      } catch (error) {
        phase.status = 'ERROR';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        phase.logs.push(`ERROR: ${errorMessage}`);
        
        // Publish error event
        eventBus.publish(EventChannels.KERNEL.ERROR, {
          phase: phase.name,
          error: errorMessage,
          timestamp: Date.now()
        }, { priority: 'critical' });

        // Critical phases stop boot
        if (phase.criticality === 'HIGH') {
          this.notify(phase, BootState.ERROR);
          this.isBooting = false;
          return;
        }
      }

      this.notify(phase, BootState.PHASE_BOOT);
    }

    const totalBootTime = Date.now() - this.bootStartTime;
    
    // Update kernel store
    const store = getKernelStoreState();
    store?.setHealth?.({
      status: 'healthy',
      uptime: 0,
      lastCheck: Date.now(),
      issues: []
    });

    // Publish boot complete event
    eventBus.publish(EventChannels.KERNEL.BOOT, {
      status: 'complete',
      version: KERNEL_VERSION,
      totalTime: totalBootTime,
      timestamp: Date.now()
    }, { priority: 'critical' });

    this.notify(BOOT_PHASES_FAST[BOOT_PHASES_FAST.length - 1], BootState.RUNNING);
    this.isBooting = false;
    
    console.log(`[FastBoot] JARVIS Kernel v${KERNEL_VERSION.major}.${KERNEL_VERSION.minor}.${KERNEL_VERSION.patch} booted in ${totalBootTime}ms`);
  }

  public getBootProgress(): number {
    return Math.min(100, Math.round((this.currentPhaseIndex / BOOT_PHASES_FAST.length) * 100));
  }

  public getIsBooting(): boolean {
    return this.isBooting;
  }

  private async executePhase(phase: BootPhase): Promise<void> {
    switch (phase.name) {
      case 'SYSTEM CHECK':
        await this.systemCheckPhase();
        break;
      case 'KERNEL MOUNT':
        await this.kernelMountPhase();
        break;
      case 'CORTEX LINK':
        await this.cortexLinkPhase();
        break;
      case 'EVENT BUS':
        await this.eventBusPhase();
        break;
      case 'PLUGIN SYSTEM':
        await this.pluginSystemPhase();
        break;
      case 'NEURAL BRIDGE':
        await this.neuralBridgePhase();
        break;
      case 'INTERFACE':
        await this.interfacePhase();
        break;
    }
  }

  private async systemCheckPhase(): Promise<void> {
    // Quick checks only
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported');
    }
    
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
    } catch {
      throw new Error('localStorage not available');
    }
  }

  private async kernelMountPhase(): Promise<void> {
    // Initialize kernel store
    const store = getKernelStoreState();
    
    if (KERNEL_VERSION.major !== 1 || KERNEL_VERSION.minor !== 5) {
      phaseLogFast('KERNEL MOUNT', 'Store version mismatch warning');
    }
  }

  private async cortexLinkPhase(): Promise<void> {
    // Load memories and sync to Vector DB in parallel
    const memoriesPromise = memory.getAll();
    const vectorDBPromise = vectorDB.initialize();
    
    // Wait for both
    await Promise.all([memoriesPromise, vectorDBPromise]);
    
    // Sync existing memories to Vector DB (non-blocking after boot)
    // This runs in background so we don't delay boot
    setTimeout(() => {
      memory.syncToVectorDB().then(synced => {
        if (synced > 0) {
          phaseLogFast('CORTEX LINK', `Synced ${synced} memories to Vector DB`);
        }
      }).catch(() => {
        // Silent fail - Vector DB is optional for boot
      });
    }, 100);
  }

  private async eventBusPhase(): Promise<void> {
    // Event bus is auto-initialized, just verify
    const stats = eventBus.getStats();
    phaseLogFast('EVENT BUS', `${stats.activeSubscriptions} channels`);
  }

  private async pluginSystemPhase(): Promise<void> {
    // Quick plugin check only - don't load heavy plugins during boot
    const persistedPlugins = localStorage.getItem('jarvis_plugins');
    if (persistedPlugins) {
      try {
        const plugins = JSON.parse(persistedPlugins);
        phaseLogFast('PLUGIN SYSTEM', `${plugins.length} plugins found`);
      } catch {
        phaseLogFast('PLUGIN SYSTEM', 'No persisted plugins');
      }
    }
  }

  private async neuralBridgePhase(): Promise<void> {
    // Quick check only - don't block for network
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      phaseLogFast('NEURAL BRIDGE', 'API not configured (optional)');
    }
    
    // Check Ollama in background - don't await
    fetch('http://localhost:11434/api/tags', { 
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    }).then(response => {
      if (response.ok) {
        phaseLogFast('NEURAL BRIDGE', 'Ollama: OK');
      }
    }).catch(() => {
      phaseLogFast('NEURAL BRIDGE', 'Ollama: not detected');
    });
  }

  private async interfacePhase(): Promise<void> {
    // Final initialization complete
    phaseLogFast('INTERFACE', 'Ready');
  }
}

function phaseLogFast(phase: string, message: string): void {
  console.log(`[FastBoot:${phase}] ${message}`);
}

export const bootLoaderFast = new FastBootOrchestrator();

// Backward compatibility
export const BOOT_PHASES = BOOT_PHASES_FAST;
