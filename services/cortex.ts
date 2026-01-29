import { 
  OperationalEvent, 
  ReliabilityScore, 
  AdaptivePolicy, 
  HealthEventType, 
  ImpactLevel,
  AIProvider 
} from "../types";

// Simulating SQLite Tables
class CortexCore {
  private eventLog: OperationalEvent[] = [];
  private reliabilityMap: Map<string, ReliabilityScore> = new Map();
  private policyMap: Map<string, AdaptivePolicy[]> = new Map();
  private observers: (() => void)[] = [];

  constructor() {
    this.initDefaults();
  }

  private initDefaults() {
    // Initialize standard subsystems
    ['provider.gemini', 'plugin.media.spotify', 'plugin.system.home_assistant', 'core.memory'].forEach(id => {
      this.reliabilityMap.set(id, {
        sourceId: id,
        currentHealth: 100,
        totalFailures: 0,
        lastFailureAt: null,
        trend: 'STABLE'
      });
    });
  }

  // --- PUBLIC API ---

  public reportEvent(event: Omit<OperationalEvent, 'id' | 'timestamp'>) {
    const fullEvent: OperationalEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now()
    };
    
    // 1. Store Log
    this.eventLog.unshift(fullEvent);
    if (this.eventLog.length > 500) this.eventLog.pop(); // Keep log size manageable

    // 2. Update Reliability Score (Regenerative Logic)
    this.updateReliability(fullEvent);

    // 3. Trigger Heuristic Engine (Learning)
    this.runHeuristics(fullEvent.sourceId);

    this.notify();
  }

  public getReliability(sourceId: string): ReliabilityScore | undefined {
    return this.reliabilityMap.get(sourceId);
  }

  public getAllReliability(): ReliabilityScore[] {
    return Array.from(this.reliabilityMap.values());
  }

  public getActivePolicies(sourceId: string): AdaptivePolicy[] {
    const policies = this.policyMap.get(sourceId) || [];
    // Filter expired
    const active = policies.filter(p => p.expiresAt === null || p.expiresAt > Date.now());
    
    // Clean up expired in storage
    if (active.length !== policies.length) {
      this.policyMap.set(sourceId, active);
    }
    
    return active;
  }

  public getAllPolicies(): AdaptivePolicy[] {
     const all: AdaptivePolicy[] = [];
     this.policyMap.forEach(policies => all.push(...policies));
     return all;
  }

  public subscribe(cb: () => void) {
    this.observers.push(cb);
    return () => {
      this.observers = this.observers.filter(o => o !== cb);
    };
  }

  // --- INTERNAL LOGIC ---

  private updateReliability(event: OperationalEvent) {
    let score = this.reliabilityMap.get(event.sourceId);
    if (!score) {
      score = {
        sourceId: event.sourceId,
        currentHealth: 100,
        totalFailures: 0,
        lastFailureAt: null,
        trend: 'STABLE'
      };
    }

    // Delta Logic
    let delta = 0;
    switch (event.type) {
      case HealthEventType.SUCCESS:
        delta = 1; // Slow healing
        break;
      case HealthEventType.HIGH_LATENCY:
        delta = -5;
        break;
      case HealthEventType.TIMEOUT:
        delta = -15;
        break;
      case HealthEventType.API_ERROR:
        delta = -10;
        break;
      case HealthEventType.CRASH:
        delta = -30;
        break;
      case HealthEventType.RESOURCE_SPIKE:
        delta = -5;
        break;
    }

    // Apply Impact Multiplier
    if (event.impact > ImpactLevel.LOW) {
      delta *= (1 + (event.impact * 0.1));
    }

    // Update Stats
    score.currentHealth = Math.min(100, Math.max(0, score.currentHealth + delta));
    if (delta < 0) {
      score.totalFailures++;
      score.lastFailureAt = event.timestamp;
    }

    // Determine Trend
    if (score.currentHealth > 90) score.trend = 'STABLE';
    else if (score.currentHealth < 40) score.trend = 'CRITICAL';
    else if (delta < 0) score.trend = 'DEGRADING';
    else score.trend = 'RECOVERING';

    this.reliabilityMap.set(event.sourceId, score);
  }

  private runHeuristics(sourceId: string) {
    const score = this.reliabilityMap.get(sourceId);
    if (!score) return;

    const existingPolicies = this.policyMap.get(sourceId) || [];

    // RULE A: The "Penalty Box" (Circuit Breaker Extension)
    // If health is critically low, force a longer timeout on circuits
    if (score.currentHealth < 40 && score.trend === 'CRITICAL') {
       this.upsertPolicy(sourceId, {
         policyId: `pol_timeout_${sourceId}`,
         targetSourceId: sourceId,
         parameterKey: 'circuit_reset_timeout_ms',
         overrideValue: 30000, // 30s penalty
         reason: 'System health critical. Increasing cooldown.',
         createdAt: Date.now(),
         expiresAt: Date.now() + (1000 * 60 * 5) // 5 mins
       });
    }

    // RULE B: The "Dumb Fallback" (Model Switching)
    // If Gemini is failing, switch preference to Ollama
    if (sourceId === 'provider.gemini' && score.currentHealth < 50) {
       this.upsertPolicy('global.router', {
          policyId: `pol_fallback_ollama`,
          targetSourceId: 'global.router',
          parameterKey: 'preferred_provider',
          overrideValue: AIProvider.OLLAMA,
          reason: 'Cloud provider unstable. Switched to local fallback.',
          createdAt: Date.now(),
          expiresAt: Date.now() + (1000 * 60 * 10) // 10 mins
       });
    }

    // RULE C: The "Self-Healing" (Remove policies if healthy)
    if (score.currentHealth > 90) {
        // Clear punitive policies for the source
        const cleared = existingPolicies.filter(p => !p.reason.includes('critical'));
        if (cleared.length !== existingPolicies.length) {
            this.policyMap.set(sourceId, cleared);
        }

        // Check Global Policies healing
        if (sourceId === 'provider.gemini') {
             const globalPolicies = this.policyMap.get('global.router') || [];
             const cleanedGlobal = globalPolicies.filter(p => p.parameterKey !== 'preferred_provider');
             if (cleanedGlobal.length !== globalPolicies.length) {
                 this.policyMap.set('global.router', cleanedGlobal);
             }
        }
    }
  }

  private upsertPolicy(sourceId: string, policy: AdaptivePolicy) {
    const current = this.policyMap.get(sourceId) || [];
    // Remove existing with same ID
    const others = current.filter(p => p.policyId !== policy.policyId);
    this.policyMap.set(sourceId, [...others, policy]);
  }

  private notify() {
    this.observers.forEach(cb => cb());
  }

  // --- DEBUG HELPERS ---
  public getLogs(): OperationalEvent[] {
      return this.eventLog;
  }
}

export const cortex = new CortexCore();