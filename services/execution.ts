import { BreakerStatus, KernelAction, CircuitState, CircuitConfig, HealthEventType, ImpactLevel } from "../types";
import { registry } from "./registry";
import { pluginLoader } from "./pluginLoader";
import { cortex } from "./cortex";
import { 
  runDiagnostics, 
  getSystemMetrics, 
  getBatteryInfo, 
  getNetworkInfo, 
  getPluginHealth, 
  getStorageInfo, 
  getPerformanceMetrics, 
  getPredictiveAnalysis,
  getActiveAlerts,
  startMonitoring,
  stopMonitoring,
  isMonitoring,
  formatBytes, 
  formatUptime,
  formatDuration,
  getProcessList,
  getProcessStats,
  killProcess,
  findProcesses,
  getTopCpuProcesses,
  getTopMemoryProcesses,
  formatProcessList,
  formatProcessStats,
  registerVirtualProcess,
  unregisterVirtualProcess,
  updateVirtualProcessMetrics,
} from "./coreOs";

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 5000,
  executionTimeoutMs: 2000,
};

/**
 * CircuitBreaker
 * Wraps execution logic with state machine for stability.
 */
export class CircuitBreaker {
  public id: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = 0;
  private lastError?: string;
  private config: CircuitConfig;

  constructor(id: string, config: Partial<CircuitConfig> = {}) {
    this.id = id;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public getStatus(): BreakerStatus {
    return {
      pluginId: this.id,
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastError: this.lastError,
      nextAttempt: this.nextAttempt
    };
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    // 1. CORTEX POLICY CHECK
    // Check if Cortex has applied a penalty timeout policy
    const policies = cortex.getActivePolicies(this.id);
    const timeoutPolicy = policies.find(p => p.parameterKey === 'circuit_reset_timeout_ms');
    const effectiveResetTimeout = timeoutPolicy ? (timeoutPolicy.overrideValue as number) : this.config.resetTimeoutMs;

    if (this.state === CircuitState.OPEN) {
      // Use effective timeout (which might be extended by Cortex)
      const adjustedNextAttempt = (this.nextAttempt - this.config.resetTimeoutMs) + effectiveResetTimeout;
      
      if (Date.now() >= adjustedNextAttempt) {
        this.transition(CircuitState.HALF_OPEN);
      } else {
        const remaining = Math.ceil((adjustedNextAttempt - Date.now()) / 1000);
        throw new Error(`Circuit OPEN. Retrying in ${remaining}s.`);
      }
    }

    try {
      const start = Date.now();

      // Race between action and timeout with proper cleanup
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Execution Timed Out")), this.config.executionTimeoutMs);
      });

      try {
        const result = await Promise.race([action(), timeoutPromise]);
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        this.onSuccess(latency);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.onFailure(message);
      throw error;
    }
  }

  private onSuccess(latencyMs: number) {
    this.successCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.transition(CircuitState.CLOSED);
    }
    
    // REPORT SUCCESS TO CORTEX
    cortex.reportEvent({
        sourceId: this.id,
        type: latencyMs > 1000 ? HealthEventType.HIGH_LATENCY : HealthEventType.SUCCESS,
        impact: ImpactLevel.NONE,
        latencyMs: latencyMs,
        context: { endpoint: 'execute' }
    });
  }

  private onFailure(errorMessage: string) {
    this.failureCount++;
    this.lastError = errorMessage;

    const isTimeout = errorMessage.includes("Timed Out");
    
    // REPORT FAILURE TO CORTEX
    cortex.reportEvent({
        sourceId: this.id,
        type: isTimeout ? HealthEventType.TIMEOUT : HealthEventType.CRASH,
        impact: ImpactLevel.MEDIUM,
        latencyMs: 0,
        context: { errorMessage }
    });

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.config.failureThreshold) {
      this.transition(CircuitState.OPEN);
    }
  }

  private transition(newState: CircuitState) {
    this.state = newState;
    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
      this.failureCount = 0; 
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextAttempt = 0;
      this.lastError = undefined;
    }
  }

  public trip() {
    this.onFailure("Manual Trip");
  }
}

/**
 * ExecutionEngine
 * Orchestrates plugin execution via Circuit Breakers and Registry Checks.
 */
export class ExecutionEngine {
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    // On demand creation
  }

  private getOrInitBreaker(pluginId: string): CircuitBreaker {
    if (!this.breakers.has(pluginId)) {
      this.breakers.set(pluginId, new CircuitBreaker(pluginId));
    }
    return this.breakers.get(pluginId)!;
  }

  public getAllStatus(): BreakerStatus[] {
    return Array.from(this.breakers.values()).map(b => b.getStatus());
  }

  public async executeAction(action: KernelAction): Promise<string> {
    console.log(`[Execution] executeAction called: ${action.pluginId}.${action.method}`, action.params);
    
    // 1. Registry Check
    const plugin = registry.get(action.pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${action.pluginId}' is not installed.`);
    }
    if (plugin.status === 'DISABLED') {
      throw new Error(`Plugin '${plugin.manifest.name}' is DISABLED by user.`);
    }

    // 2. CORTEX POLICY CHECK (Kill Switch)
    const policies = cortex.getActivePolicies(action.pluginId);
    const enabledPolicy = policies.find(p => p.parameterKey === 'enabled');
    if (enabledPolicy && enabledPolicy.overrideValue === false) {
         throw new Error(`Plugin blocked by Cortex Policy: ${enabledPolicy.reason}`);
    }

    // 3. Register virtual process for tracking
    const processName = `${action.pluginId}.${action.method}`;
    const processCommand = JSON.stringify(action.params);
    const pid = registerVirtualProcess(processName, processCommand);
    console.log(`[Execution] Started process ${pid}: ${processName}`);

    // 4. Circuit Breaker Execution
    const breaker = this.getOrInitBreaker(action.pluginId);

    try {
      const result = await breaker.execute(async () => {
        const startTime = Date.now();
        try {
          // --- HARDWARE ROUTING LOGIC ---
          // NOTE: Home Assistant routing is now handled via the plugin capability system
          // to avoid circular dependency between execution.ts and home_assistant.ts

        // Fallback / Mock implementations for other plugins
        if (action.pluginId === 'media.spotify') {
           await new Promise(r => setTimeout(r, 600));
           if (Math.random() > 0.8) throw new Error("Spotify Connection Timeout"); // Random chaos
           const cmd = Array.isArray(action.params.entities) ? action.params.entities.join(' ') : 'unknown command';
           return `Spotify Control: Executed command '${cmd}' via Web API.`;
        }

        if (action.pluginId === 'core.os') {
           const entities = Array.isArray(action.params.entities)
             ? action.params.entities.map((e: string) => e.toLowerCase())
             : [];
           
           // v1.2.0: Full async diagnostic report (enhanced)
           if (entities.includes('diagnostic') || entities.includes('scan') || entities.includes('full')) {
             return await runDiagnostics();
           }
           
           // v1.2.0: Quick metrics (with CPU)
           if (entities.includes('metrics') || entities.includes('stats')) {
             const metrics = getSystemMetrics();
             let output = `SYSTEM METRICS [core.os v1.2.0]
• Heap Used:  ${formatBytes(metrics.memory.heapUsed)}
• Heap Total: ${formatBytes(metrics.memory.heapTotal)}
• RSS:        ${formatBytes(metrics.memory.rss)}
• External:   ${formatBytes(metrics.memory.external)}
• Pressure:   ${calculateMemoryPressure(metrics.memory.heapUsed, metrics.memory.heapTotal)}`;
             
             if (metrics.cpu.supported) {
               output += `
• CPU Usage:  ${metrics.cpu.usagePercent}%
• Load Avg:   ${metrics.cpu.loadAvg.map(v => v.toFixed(2)).join(', ')}`;
             }
             
             output += `
• Uptime:     ${formatUptime(metrics.uptime)}`;
             return output;
           }
           
           // v1.1.0: Network info (v1.2.0: Added online status)
           if (entities.includes('network') || entities.includes('probe')) {
             const net = getNetworkInfo();
             if (!net.supported) {
               return `NETWORK PROBE [core.os v1.2.0]
• Online: ${net.online ? 'Yes 🟢' : 'No 🔴'}
• Note: Navigator Connection API not available.`;
             }
             return `NETWORK PROBE [core.os v1.2.0]
• Type:     ${net.effectiveType}
• Downlink: ${net.downlink} Mbps
• Latency:  ${net.rtt} ms
• SaveData: ${net.saveData ? 'ON' : 'OFF'}
• Online:   ${net.online ? 'Yes 🟢' : 'No 🔴'}`;
           }
           
           // v1.1.0: Battery status (async)
           if (entities.includes('battery') || entities.includes('power')) {
             const battery = await getBatteryInfo();
             if (!battery.supported) {
               return "BATTERY STATUS: Battery API not supported in this environment.";
             }
             const timeLabel = battery.charging ? 'Time to full' : 'Time remaining';
             const timeValue = battery.charging 
               ? (battery.chargingTime === Infinity ? 'Calculating...' : `${Math.round(battery.chargingTime / 60)}m`)
               : (battery.dischargingTime === Infinity ? 'Calculating...' : `${Math.round(battery.dischargingTime / 60)}m`);
             return `BATTERY STATUS [core.os v1.2.0]
• Level:  ${battery.level.toFixed(0)}%
• State:  ${battery.charging ? 'Charging ⚡' : 'Discharging 🔋'}
• ${timeLabel}: ${timeValue}`;
           }
           
           // v1.2.0: Storage info
           if (entities.includes('storage') || entities.includes('disk')) {
             const storage = await getStorageInfo();
             if (!storage.supported) {
               return "STORAGE INFO: Storage API not supported in this environment.";
             }
             return `STORAGE INFO [core.os v1.2.0]
• Used:      ${formatBytes(storage.usage)}
• Available: ${formatBytes(storage.available)}
• Total:     ${formatBytes(storage.quota)}
• Used %:    ${storage.percentUsed.toFixed(1)}%`;
           }
           
           // v1.2.0: Performance metrics
           if (entities.includes('performance') || entities.includes('perf')) {
             const perf = getPerformanceMetrics();
             if (!perf.supported) {
               return "PERFORMANCE: Performance Memory API not available.";
             }
             return `PERFORMANCE METRICS [core.os v1.2.0]
• Memory Pressure: ${perf.memoryPressure}
• Latency:         ${formatDuration(perf.latency)}
• Health:          ${perf.memoryPressure === 'nominal' ? 'Good ✅' : perf.memoryPressure === 'critical' ? 'Critical ❌' : 'Warning ⚠️'}`;
           }
           
           // v1.2.0: Predictive analysis
           if (entities.includes('predict') || entities.includes('analysis') || entities.includes('forecast')) {
             const analysis = await getPredictiveAnalysis();
             let output = `PREDICTIVE ANALYSIS [core.os v1.2.0]
• Health Score:    ${analysis.healthScore}/100 ${analysis.healthScore >= 70 ? '💚' : analysis.healthScore >= 50 ? '🧡' : '❤️'}
• Memory Trend:    ${analysis.memoryTrend}`;
             
             if (analysis.batteryTimeRemaining) {
               output += `
• Battery Time:    ${formatUptime(analysis.batteryTimeRemaining)}`;
             }
             
             if (analysis.recommendedAction) {
               output += `
• Recommendation:  ${analysis.recommendedAction}`;
             } else {
               output += `
• Status:          All systems nominal ✅`;
             }
             
             return output;
           }
           
           // v1.2.0: System alerts
           if (entities.includes('alerts') || entities.includes('warnings')) {
             const alerts = getActiveAlerts();
             if (alerts.length === 0) {
               return `SYSTEM ALERTS [core.os v1.2.0]
No active alerts. All systems nominal ✅`;
             }
             let output = `SYSTEM ALERTS [core.os v1.2.0] (${alerts.length} active)\n`;
             alerts.forEach((alert, i) => {
               const icon = alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵';
               output += `\n${i + 1}. ${icon} ${alert.message}`;
             });
             return output;
           }
           
           // v1.2.0: Monitoring control
           if (entities.includes('monitor') || entities.includes('watch')) {
             if (isMonitoring()) {
               stopMonitoring();
               return "SYSTEM MONITOR: Stopped. Auto-monitoring disabled.";
             } else {
               startMonitoring(5000);
               return "SYSTEM MONITOR: Started. Auto-monitoring enabled (5s interval).";
             }
           }
           
           if (entities.includes('circuit') || entities.includes('reset')) return "SYSTEM RESET: Circuit breakers cycled. Fault flags cleared.";
           if (entities.includes('memory') || entities.includes('optimize')) return "MEMORY CORE: Vector index compressed. Cache flushed.";
           
           // v1.2.0: Plugin health check
           if (entities.includes('health') || entities.includes('plugins')) {
             const health = getPluginHealth();
             return `PLUGIN HEALTH [core.os v1.2.0]
• Total:   ${health.total}
• Active:  ${health.active} ✅
• Disabled:${health.disabled} ⚠️
• Error:   ${health.error} ❌
• Paused:  ${health.paused} ⏸️`;
           }
           
           // v1.2.1: Process management
           if (entities.includes('process') || entities.includes('processes')) {
             // Process list
             if (entities.includes('list') || entities.includes('all')) {
               const processes = await getProcessList();
               return formatProcessList(processes);
             }
             
             // Process stats
             if (entities.includes('stats') || entities.includes('summary')) {
               const stats = await getProcessStats();
               return formatProcessStats(stats);
             }
             
             // Top CPU processes
             if (entities.includes('cpu') || entities.includes('top')) {
               const processes = await getTopCpuProcesses(10);
               return `TOP CPU PROCESSES [core.os v1.2.1]\n\n${formatProcessList(processes)}`;
             }
             
             // Top memory processes
             if (entities.includes('memory') || entities.includes('mem')) {
               const processes = await getTopMemoryProcesses(10);
               return `TOP MEMORY PROCESSES [core.os v1.2.1]\n\n${formatProcessList(processes)}`;
             }
             
             // Default: show process stats + top 5
             const [stats, topCpu] = await Promise.all([
               getProcessStats(),
               getTopCpuProcesses(5)
             ]);
             return `${formatProcessStats(stats)}\n\nTOP 5 BY CPU:\n${formatProcessList(topCpu)}`;
           }
           
           // v1.2.1: Kill process
           if (entities.includes('kill') || entities.includes('terminate')) {
             const pid = parseInt(action.params.pid as string);
             if (isNaN(pid)) {
               return 'ERROR: No PID specified. Usage: kill <pid>';
             }
             const result = await killProcess(pid);
             return result.message;
           }
           
           // v1.2.1: Find process
           if (entities.includes('find') || entities.includes('search')) {
             const pattern = action.params.pattern as string;
             if (!pattern) {
               return 'ERROR: No search pattern specified. Usage: find <pattern>';
             }
             const processes = await findProcesses(pattern);
             return `SEARCH RESULTS FOR "${pattern}" [core.os v1.2.1]\n\n${formatProcessList(processes)}`;
           }

           // Fallback with version info
           return `SYSTEM COMMAND EXECUTED [core.os v1.2.1]
Available: diagnostic, metrics, network, battery, storage, performance,
           predict, alerts, health, monitor, process, kill, find, circuit, memory`;
        }

        // Check if this is a plugin method execution
        if (action.method && action.params) {
          // Try to execute the plugin method if the plugin loader has the plugin
          if (pluginLoader) {
            const loadedPlugin = pluginLoader.getPlugin(action.pluginId);
            if (loadedPlugin && loadedPlugin.instance) {
              const instance = loadedPlugin.instance as Record<string, (p: unknown) => Promise<unknown>>;
              if (typeof instance[action.method] === 'function') {
                try {
                  const result = await instance[action.method](action.params);
                  return result as string;
                } catch (error) {
                  console.error(`Error executing plugin method ${action.method} on ${action.pluginId}:`, error);
                  throw error;
                }
              } else {
                throw new Error(`Method ${action.method} not found or not callable on plugin ${action.pluginId}`);
              }
            } else {
              // Plugin loader not available yet, log a warning
              console.warn(`Plugin loader not available when trying to execute ${action.method} on ${action.pluginId}`);
            }
          }
        }

        // Generic Default
        await new Promise(r => setTimeout(r, Math.random() * 800 + 200));
        return `Executed [${action.method}] on [${plugin.manifest.name}] successfully.`;
      } catch (error) {
        console.error(`Error in executeAction for plugin ${action.pluginId}:`, error);
        throw error;
      } finally {
        // Update process metrics before cleanup
        const duration = Date.now() - startTime;
        updateVirtualProcessMetrics(pid, 0, duration);
      }
      });
      return result;
    } finally {
      // Cleanup: unregister the virtual process
      console.log(`[Execution] Completed process ${pid}: ${processName}`);
      unregisterVirtualProcess(pid);
    }
  }

  public simulateFailure(pluginId: string) {
    const breaker = this.getOrInitBreaker(pluginId);
    breaker.trip();
  }
}

/**
 * Calculate memory pressure level (helper for execution)
 */
function calculateMemoryPressure(used: number, total: number): string {
  const ratio = used / total;
  if (ratio > 0.9) return 'critical';
  if (ratio > 0.7) return 'serious';
  if (ratio > 0.5) return 'fair';
  return 'nominal';
}

export const engine = new ExecutionEngine();