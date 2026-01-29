import { CircuitState, CircuitConfig, BreakerStatus, KernelAction, HealthEventType, ImpactLevel } from "../types";
import { registry } from "./registry";
import { haService } from "./home_assistant";
import { cortex } from "./cortex";

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
      // Race between action and timeout
      const result = await Promise.race([
        action(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error("Execution Timed Out")), this.config.executionTimeoutMs)
        )
      ]);
      const latency = Date.now() - start;

      this.onSuccess(latency);
      return result;
    } catch (error: any) {
      this.onFailure(error.message);
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

    // 3. Circuit Breaker Execution
    const breaker = this.getOrInitBreaker(action.pluginId);

    return breaker.execute(async () => {
      // --- HARDWARE ROUTING LOGIC ---
      if (action.pluginId === 'system.home_assistant') {
        const entities = action.params.entities || [];
        return await haService.executeSmartCommand(entities);
      }
      
      // Fallback / Mock implementations for other plugins
      if (action.pluginId === 'media.spotify') {
         await new Promise(r => setTimeout(r, 600));
         if (Math.random() > 0.8) throw new Error("Spotify Connection Timeout"); // Random chaos
         const cmd = action.params.entities.join(' ');
         return `Spotify Control: Executed command '${cmd}' via Web API.`;
      }

      if (action.pluginId === 'core.os') {
         const entities = action.params.entities.map((e: string) => e.toLowerCase());
         if (entities.includes('diagnostic') || entities.includes('scan')) return "DIAGNOSTIC COMPLETE: All subsystems nominal. Efficiency at 98%.";
         if (entities.includes('network') || entities.includes('probe')) return "NETWORK PROBE: Latency 12ms. Packet loss 0%. Encrypted Uplink Active.";
         if (entities.includes('circuit') || entities.includes('reset')) return "SYSTEM RESET: Circuit breakers cycled. Fault flags cleared.";
         if (entities.includes('memory') || entities.includes('optimize')) return "MEMORY CORE: Vector index compressed. Cache flushed.";
         
         // Fallback
         return "SYSTEM COMMAND EXECUTED.";
      }

      // Generic Default
      await new Promise(r => setTimeout(r, Math.random() * 800 + 200));
      return `Executed [${action.method}] on [${plugin.manifest.name}] successfully.`;
    });
  }

  public simulateFailure(pluginId: string) {
    const breaker = this.getOrInitBreaker(pluginId);
    breaker.trip();
  }
}

export const engine = new ExecutionEngine();