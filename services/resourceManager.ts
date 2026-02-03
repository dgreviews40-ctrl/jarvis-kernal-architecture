/**
 * Resource Manager - Kernel v1.2
 * CPU, memory, and resource quota management
 * 
 * Features:
 * - Resource monitoring
 * - Quota enforcement per plugin/service
 * - Throttling and backpressure
 * - Resource warnings and alerts
 */

import { eventBus, EventChannels } from './eventBus';

export interface ResourceQuota {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConcurrentTasks: number;
  maxRequestsPerMinute: number;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  activeTasks: number;
  requestsLastMinute: number;
}

export interface ResourceSnapshot {
  timestamp: number;
  totalMemoryMB: number;
  usedMemoryMB: number;
  cpuPercent: number;
  pluginUsages: Map<string, ResourceUsage>;
}

export interface ResourcePolicy {
  throttleThreshold: number; // Percentage at which to start throttling
  killThreshold: number;     // Percentage at which to kill tasks
  warningIntervalMs: number; // Minimum time between warnings
}

const DEFAULT_QUOTA: ResourceQuota = {
  maxMemoryMB: 100,
  maxCpuPercent: 10,
  maxConcurrentTasks: 5,
  maxRequestsPerMinute: 100
};

const DEFAULT_POLICY: ResourcePolicy = {
  throttleThreshold: 80,
  killThreshold: 95,
  warningIntervalMs: 30000
};

class ResourceManager {
  private quotas: Map<string, ResourceQuota> = new Map();
  private usages: Map<string, ResourceUsage> = new Map();
  private requestTimestamps: Map<string, number[]> = new Map();
  private snapshots: ResourceSnapshot[] = [];
  private maxSnapshots = 100;
  private policy: ResourcePolicy = DEFAULT_POLICY;
  private lastWarningTime = 0;
  private monitoringInterval: number | null = null;
  private isMonitoring = false;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Set resource quota for a plugin or service
   */
  setQuota(sourceId: string, quota: Partial<ResourceQuota>): void {
    const existing = this.quotas.get(sourceId);
    this.quotas.set(sourceId, { ...DEFAULT_QUOTA, ...existing, ...quota });
  }

  /**
   * Get resource quota for a source
   */
  getQuota(sourceId: string): ResourceQuota {
    return this.quotas.get(sourceId) || DEFAULT_QUOTA;
  }

  /**
   * Remove quota for a source
   */
  removeQuota(sourceId: string): void {
    this.quotas.delete(sourceId);
    this.usages.delete(sourceId);
    this.requestTimestamps.delete(sourceId);
  }

  /**
   * Check if a task can be started
   */
  canStartTask(sourceId: string): { allowed: boolean; reason?: string } {
    const quota = this.getQuota(sourceId);
    const usage = this.getUsage(sourceId);

    if (usage.activeTasks >= quota.maxConcurrentTasks) {
      return { allowed: false, reason: `Concurrent task limit reached (${quota.maxConcurrentTasks})` };
    }

    if (usage.memoryMB >= quota.maxMemoryMB) {
      return { allowed: false, reason: `Memory quota exceeded (${quota.maxMemoryMB}MB)` };
    }

    const rateLimit = this.checkRateLimit(sourceId);
    if (!rateLimit.allowed) {
      return { allowed: false, reason: `Rate limit exceeded (${quota.maxRequestsPerMinute}/min)` };
    }

    return { allowed: true };
  }

  /**
   * Start tracking a task
   */
  startTask(sourceId: string, estimatedMemoryMB = 10): void {
    const usage = this.getUsage(sourceId);
    usage.activeTasks++;
    usage.memoryMB += estimatedMemoryMB;
    this.recordRequest(sourceId);
    this.usages.set(sourceId, usage);
  }

  /**
   * End tracking a task
   */
  endTask(sourceId: string, estimatedMemoryMB = 10): void {
    const usage = this.getUsage(sourceId);
    usage.activeTasks = Math.max(0, usage.activeTasks - 1);
    usage.memoryMB = Math.max(0, usage.memoryMB - estimatedMemoryMB);
    this.usages.set(sourceId, usage);
  }

  /**
   * Update memory usage for a source
   */
  updateMemory(sourceId: string, memoryMB: number): void {
    const usage = this.getUsage(sourceId);
    usage.memoryMB = memoryMB;
    this.usages.set(sourceId, usage);
    this.checkThresholds(sourceId);
  }

  /**
   * Get current usage for a source
   */
  getUsage(sourceId: string): ResourceUsage {
    return this.usages.get(sourceId) || {
      memoryMB: 0,
      cpuPercent: 0,
      activeTasks: 0,
      requestsLastMinute: 0
    };
  }

  /**
   * Get all resource usage
   */
  getAllUsage(): Map<string, ResourceUsage> {
    return new Map(this.usages);
  }

  /**
   * Get resource history
   */
  getHistory(durationMs = 60000): ResourceSnapshot[] {
    const cutoff = Date.now() - durationMs;
    return this.snapshots.filter(s => s.timestamp >= cutoff);
  }

  /**
   * Set resource policy
   */
  setPolicy(policy: Partial<ResourcePolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Get total system resources
   */
  getSystemResources(): { memoryMB: number; cpuPercent: number } {
    const totalUsage = Array.from(this.usages.values()).reduce(
      (sum, u) => ({
        memoryMB: sum.memoryMB + u.memoryMB,
        cpuPercent: sum.cpuPercent + u.cpuPercent
      }),
      { memoryMB: 0, cpuPercent: 0 }
    );
    return totalUsage;
  }

  /**
   * Force garbage collection suggestion
   */
  suggestGC(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as unknown as { gc: () => void }).gc();
    }
    
    eventBus.publish(EventChannels.SYSTEM.RESOURCE_WARNING, {
      type: 'gc_suggested',
      message: 'Garbage collection suggested due to high memory usage',
      timestamp: Date.now()
    }, { priority: 'high' });
  }

  /**
   * Start resource monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Update snapshots every 5 seconds
    this.monitoringInterval = window.setInterval(() => {
      this.takeSnapshot();
      this.cleanupOldData();
    }, 5000);
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Get resource stats summary
   */
  getStats(): {
    monitoredSources: number;
    totalActiveTasks: number;
    totalMemoryMB: number;
    averageCpuPercent: number;
    throttledSources: string[];
  } {
    const sources = Array.from(this.usages.entries());
    const totalActiveTasks = sources.reduce((sum, [, u]) => sum + u.activeTasks, 0);
    const totalMemoryMB = sources.reduce((sum, [, u]) => sum + u.memoryMB, 0);
    const averageCpuPercent = sources.length > 0
      ? sources.reduce((sum, [, u]) => sum + u.cpuPercent, 0) / sources.length
      : 0;

    const throttledSources = sources
      .filter(([id, usage]) => this.isThrottled(id, usage))
      .map(([id]) => id);

    return {
      monitoredSources: sources.length,
      totalActiveTasks,
      totalMemoryMB,
      averageCpuPercent,
      throttledSources
    };
  }

  private checkRateLimit(sourceId: string): { allowed: boolean; retryAfter?: number } {
    const quota = this.getQuota(sourceId);
    const timestamps = this.requestTimestamps.get(sourceId) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter to last minute
    const recentRequests = timestamps.filter(t => t > oneMinuteAgo);
    this.requestTimestamps.set(sourceId, recentRequests);

    if (recentRequests.length >= quota.maxRequestsPerMinute) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  private recordRequest(sourceId: string): void {
    const timestamps = this.requestTimestamps.get(sourceId) || [];
    timestamps.push(Date.now());
    this.requestTimestamps.set(sourceId, timestamps);
  }

  private checkThresholds(sourceId: string): void {
    const quota = this.getQuota(sourceId);
    const usage = this.getUsage(sourceId);

    const memoryPercent = (usage.memoryMB / quota.maxMemoryMB) * 100;
    const cpuPercent = (usage.cpuPercent / quota.maxCpuPercent) * 100;
    const maxPercent = Math.max(memoryPercent, cpuPercent);

    if (maxPercent >= this.policy.killThreshold) {
      this.killTasks(sourceId);
    } else if (maxPercent >= this.policy.throttleThreshold) {
      this.throttle(sourceId);
    }
  }

  private isThrottled(sourceId: string, usage: ResourceUsage): boolean {
    const quota = this.getQuota(sourceId);
    const memoryPercent = (usage.memoryMB / quota.maxMemoryMB) * 100;
    const cpuPercent = (usage.cpuPercent / quota.maxCpuPercent) * 100;
    return Math.max(memoryPercent, cpuPercent) >= this.policy.throttleThreshold;
  }

  private throttle(sourceId: string): void {
    const now = Date.now();
    if (now - this.lastWarningTime < this.policy.warningIntervalMs) return;
    
    this.lastWarningTime = now;
    
    eventBus.publish(EventChannels.SYSTEM.RESOURCE_WARNING, {
      type: 'throttle',
      sourceId,
      message: `Resource usage high for ${sourceId}. Throttling applied.`,
      usage: this.getUsage(sourceId),
      quota: this.getQuota(sourceId),
      timestamp: now
    }, { priority: 'high' });
  }

  private killTasks(sourceId: string): void {
    const usage = this.getUsage(sourceId);
    usage.activeTasks = 0;
    this.usages.set(sourceId, usage);

    eventBus.publish(EventChannels.SYSTEM.RESOURCE_WARNING, {
      type: 'kill',
      sourceId,
      message: `Critical resource usage for ${sourceId}. Tasks terminated.`,
      usage: this.getUsage(sourceId),
      quota: this.getQuota(sourceId),
      timestamp: Date.now()
    }, { priority: 'critical' });
  }

  private takeSnapshot(): void {
    const systemResources = this.getSystemResources();
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      totalMemoryMB: systemResources.memoryMB,
      usedMemoryMB: systemResources.memoryMB, // Same for now
      cpuPercent: systemResources.cpuPercent,
      pluginUsages: new Map(this.usages)
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Publish performance event
    eventBus.publish(EventChannels.SYSTEM.PERFORMANCE, {
      memoryMB: systemResources.memoryMB,
      cpuPercent: systemResources.cpuPercent,
      timestamp: snapshot.timestamp
    }, { priority: 'normal' });
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean up old request timestamps
    for (const [sourceId, timestamps] of this.requestTimestamps) {
      const recent = timestamps.filter(t => t > oneMinuteAgo);
      if (recent.length === 0) {
        this.requestTimestamps.delete(sourceId);
      } else {
        this.requestTimestamps.set(sourceId, recent);
      }
    }

    // Update requests per minute counts
    for (const [sourceId, usage] of this.usages) {
      const timestamps = this.requestTimestamps.get(sourceId) || [];
      usage.requestsLastMinute = timestamps.length;
    }
  }
}

// Singleton instance
export const resourceManager = new ResourceManager();

// Predefined quotas for common plugins
export const DEFAULT_QUOTAS: Record<string, ResourceQuota> = {
  'plugin.media.spotify': {
    maxMemoryMB: 50,
    maxCpuPercent: 5,
    maxConcurrentTasks: 3,
    maxRequestsPerMinute: 60
  },
  'plugin.system.home_assistant': {
    maxMemoryMB: 100,
    maxCpuPercent: 10,
    maxConcurrentTasks: 10,
    maxRequestsPerMinute: 300
  },
  'provider.gemini': {
    maxMemoryMB: 200,
    maxCpuPercent: 20,
    maxConcurrentTasks: 5,
    maxRequestsPerMinute: 120
  },
  'provider.ollama': {
    maxMemoryMB: 500,
    maxCpuPercent: 30,
    maxConcurrentTasks: 2,
    maxRequestsPerMinute: 30
  }
};
