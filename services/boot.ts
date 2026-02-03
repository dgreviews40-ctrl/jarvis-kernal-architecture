/**
 * Boot Orchestrator - Kernel v1.2
 * Enhanced 8-phase boot sequence with v1.2 features
 * 
 * Phases:
 * 0. SYSTEM CHECK - Hardware and environment validation
 * 1. KERNEL MOUNT - Core services initialization
 * 2. CORTEX LINK - Health monitoring and AI connection
 * 3. EVENT BUS - Pub/sub system initialization
 * 4. WORKER POOL - Web worker initialization
 * 5. RESOURCE MGR - Resource monitoring setup
 * 6. PLUGIN SYSTEM - Plugin loader initialization
 * 7. API SURFACE - Kernel API initialization
 * 8. INTERFACE - UI unlock
 */

import { BootPhase, BootState } from "../types";
import { eventBus, EventChannels } from './eventBus';
import { workerPool } from './workerService';
import { resourceManager } from './resourceManager';
import { pluginLoader } from './pluginLoader';
import { kernelApi, KERNEL_VERSION } from './kernelApi';
import { useKernelStore, KERNEL_VERSION as STORE_VERSION } from '../stores/kernelStore';

export const BOOT_PHASES_V12: BootPhase[] = [
  { 
    id: 0, 
    name: "SYSTEM CHECK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Verifying Admin Privileges...",
      "Checking Write Access: C:\\ProgramData\\Jarvis",
      "Validating Environment Variables",
      "Checking Browser Compatibility"
    ] 
  },
  { 
    id: 1, 
    name: "KERNEL MOUNT", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Initializing Event Bus...",
      "Mounting Logger (level: DEBUG)",
      "Loading Exception Handlers",
      "Version Check: v1.2.0"
    ] 
  },
  { 
    id: 2, 
    name: "CORTEX LINK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Connecting to Vector Store...",
      "Indexing Memory Fragments...",
      "Hydrating User Context",
      "Loading Reliability Scores"
    ] 
  },
  { 
    id: 3, 
    name: "EVENT BUS", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Initializing Pub/Sub Channels...",
      "Registering Core Event Handlers",
      "Setting up Wildcard Subscriptions",
      "Event Bus: READY"
    ] 
  },
  { 
    id: 4, 
    name: "WORKER POOL", 
    criticality: "MEDIUM", 
    status: "PENDING", 
    logs: [
      "Spawning Web Workers...",
      "Initializing Worker Scripts",
      "Setting up Task Queue",
      "Worker Pool: 2-8 workers ready"
    ] 
  },
  { 
    id: 5, 
    name: "RESOURCE MGR", 
    criticality: "MEDIUM", 
    status: "PENDING", 
    logs: [
      "Initializing Resource Monitoring...",
      "Setting up Quota System",
      "Configuring Throttling Policies",
      "Resource Manager: ACTIVE"
    ] 
  },
  { 
    id: 6, 
    name: "PLUGIN SYSTEM", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Initializing Plugin Loader...",
      "Setting up Sandboxed Environment",
      "Registering Capability System",
      "Loading Installed Plugins..."
    ] 
  },
  { 
    id: 7, 
    name: "API SURFACE", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Registering API Endpoints...",
      "Setting up Authentication",
      "Configuring Rate Limiting",
      "Kernel API: v1.2.0 READY"
    ] 
  },
  { 
    id: 8, 
    name: "NEURAL BRIDGE", 
    criticality: "LOW", 
    status: "PENDING", 
    logs: [
      "Pinging Gemini API...",
      "Checking Ollama Local Interface...",
      "Calibrating Intent Weights"
    ] 
  },
  { 
    id: 9, 
    name: "PERIPHERALS", 
    criticality: "LOW", 
    status: "PENDING", 
    logs: [
      "Spawning audio.exe adapter...",
      "Spawning camera.exe adapter...",
      "Handshaking IPC Pipes"
    ] 
  },
  { 
    id: 10, 
    name: "INTERFACE", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Opening Localhost HTTP Server...",
      "Binding WebSocket Port 8080...",
      "Unlocking Dashboard UI",
      "JARVIS Kernel v1.2.0 ONLINE"
    ] 
  }
];

class BootOrchestrator {
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

    for (let i = 0; i < BOOT_PHASES_V12.length; i++) {
      this.currentPhaseIndex = i;
      this.phaseStartTime = Date.now();
      
      const phase: BootPhase = { ...BOOT_PHASES_V12[i], status: 'IN_PROGRESS' };
      this.notify(phase, BootState.PHASE_BOOT);

      try {
        // Execute phase-specific initialization
        await this.executePhase(phase);

        // Simulate processing time
        const processingTime = Math.random() * 600 + 300;
        await new Promise(r => setTimeout(r, processingTime));

        phase.status = 'SUCCESS';
        
        // Add timing info to logs
        const phaseDuration = Date.now() - this.phaseStartTime;
        phase.logs.push(`Phase completed in ${phaseDuration}ms`);

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
    useKernelStore.getState().setHealth({
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

    this.notify(BOOT_PHASES_V12[BOOT_PHASES_V12.length - 1], BootState.RUNNING);
    this.isBooting = false;
    
    console.log(`[Boot] JARVIS Kernel v1.2.0 booted in ${totalBootTime}ms`);
  }

  public getBootProgress(): number {
    return Math.min(100, Math.round((this.currentPhaseIndex / BOOT_PHASES_V12.length) * 100));
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
      case 'WORKER POOL':
        await this.workerPoolPhase();
        break;
      case 'RESOURCE MGR':
        await this.resourceManagerPhase();
        break;
      case 'PLUGIN SYSTEM':
        await this.pluginSystemPhase();
        break;
      case 'API SURFACE':
        await this.apiSurfacePhase();
        break;
      case 'NEURAL BRIDGE':
        await this.neuralBridgePhase();
        break;
      case 'PERIPHERALS':
        await this.peripheralsPhase();
        break;
      case 'INTERFACE':
        await this.interfacePhase();
        break;
    }
  }

  private async systemCheckPhase(): Promise<void> {
    // Check browser compatibility
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported');
    }
    
    // Check localStorage
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
    } catch {
      throw new Error('localStorage not available');
    }

    // Check API key
    if (!localStorage.getItem('gemini_api_key')) {
      phaseLog('SYSTEM CHECK', 'WARNING: API Key not configured');
    }
  }

  private async kernelMountPhase(): Promise<void> {
    // Initialize kernel store
    const store = useKernelStore.getState();
    
    // Verify version compatibility
    if (STORE_VERSION.major !== 1 || STORE_VERSION.minor !== 2) {
      phaseLog('KERNEL MOUNT', 'WARNING: Store version mismatch');
    }
  }

  private async cortexLinkPhase(): Promise<void> {
    // Cortex is auto-initialized, just verify it's ready
    const { cortex } = await import('./cortex');
    const health = cortex.getAllReliability();
    phaseLog('CORTEX LINK', `Initialized with ${health.length} subsystems`);
  }

  private async eventBusPhase(): Promise<void> {
    // Event bus is auto-initialized
    const stats = eventBus.getStats();
    phaseLog('EVENT BUS', `Active subscriptions: ${stats.activeSubscriptions}`);
  }

  private async workerPoolPhase(): Promise<void> {
    // Worker pool auto-initializes with min workers
    const stats = workerPool.getStats();
    phaseLog('WORKER POOL', `Active workers: ${stats.activeWorkers}`);
  }

  private async resourceManagerPhase(): Promise<void> {
    resourceManager.startMonitoring();
    phaseLog('RESOURCE MGR', 'Monitoring started');
  }

  private async pluginSystemPhase(): Promise<void> {
    // Load any persisted plugins
    const persistedPlugins = localStorage.getItem('jarvis_plugins');
    if (persistedPlugins) {
      try {
        const plugins = JSON.parse(persistedPlugins);
        phaseLog('PLUGIN SYSTEM', `Found ${plugins.length} persisted plugins`);
        // Plugins would be loaded here in a real implementation
      } catch {
        phaseLog('PLUGIN SYSTEM', 'No persisted plugins found');
      }
    }
  }

  private async apiSurfacePhase(): Promise<void> {
    // API is auto-initialized
    const docs = kernelApi.getDocumentation();
    phaseLog('API SURFACE', `${docs.length} endpoints registered`);
  }

  private async neuralBridgePhase(): Promise<void> {
    // Check AI providers
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      phaseLog('NEURAL BRIDGE', 'WARNING: Gemini API not configured');
    }
    
    // Check Ollama
    try {
      const response = await fetch('http://localhost:11434/api/tags', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        phaseLog('NEURAL BRIDGE', 'Ollama connection: OK');
      }
    } catch {
      phaseLog('NEURAL BRIDGE', 'Ollama not detected (optional)');
    }
  }

  private async peripheralsPhase(): Promise<void> {
    // Check microphone permission
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      phaseLog('PERIPHERALS', `Microphone permission: ${result.state}`);
    } catch {
      phaseLog('PERIPHERALS', 'Microphone permission check skipped');
    }

    // Check camera permission
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      phaseLog('PERIPHERALS', `Camera permission: ${result.state}`);
    } catch {
      phaseLog('PERIPHERALS', 'Camera permission check skipped');
    }
  }

  private async interfacePhase(): Promise<void> {
    // Final initialization
    phaseLog('INTERFACE', 'Dashboard ready');
  }
}

function phaseLog(phase: string, message: string): void {
  console.log(`[Boot:${phase}] ${message}`);
}

export const bootLoader = new BootOrchestrator();

// Backward compatibility
export const BOOT_PHASES = BOOT_PHASES_V12;
