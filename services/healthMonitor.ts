/**
 * Health Monitor Service
 * 
 * Continuously monitors system health and detects issues before they become critical:
 * - Memory usage tracking
 * - Storage quota monitoring
 * - API health checks
 * - Service status monitoring
 * - Automatic degradation detection
 */

import { logger } from './logger';
import { eventBus } from './eventBus';
import { cortex } from './cortex';
import { HealthEventType, ImpactLevel } from '../types';
import { estimateLocalStorageUsage, isLocalStorageAvailable } from './safeUtils';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheckResult[];
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
  responseTime?: number;
}

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  memoryThresholdPercent: number;
  storageThresholdPercent: number;
  apiTimeoutMs: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkIntervalMs: 30000, // 30 seconds
  memoryThresholdPercent: 85,
  storageThresholdPercent: 90,
  apiTimeoutMs: 5000,
  enabled: true
};

class HealthMonitor {
  private config: HealthMonitorConfig = { ...DEFAULT_CONFIG };
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastStatus: HealthStatus | null = null;
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private degradedServices: Set<string> = new Set();

  constructor() {
    this.registerDefaultChecks();
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (!this.config.enabled || this.checkInterval) {
      return;
    }

    logger.info('PERFORMANCE', 'Starting health monitoring');
    
    // Run initial check
    this.runChecks();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runChecks();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('PERFORMANCE', 'Stopped health monitoring');
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<HealthMonitorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if interval changed
    if (this.checkInterval && config.checkIntervalMs) {
      this.stop();
      this.start();
    }
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Get the last health status
   */
  getLastStatus(): HealthStatus | null {
    return this.lastStatus;
  }

  /**
   * Check if a service is degraded
   */
  isDegraded(serviceName: string): boolean {
    return this.degradedServices.has(serviceName);
  }

  /**
   * Get list of degraded services
   */
  getDegradedServices(): string[] {
    return Array.from(this.degradedServices);
  }

  /**
   * Manually run all health checks
   */
  async runChecks(): Promise<HealthStatus> {
    const startTime = performance.now();
    const checkResults: HealthCheckResult[] = [];

    // Run all registered checks
    for (const [name, checkFn] of this.checks) {
      const checkStart = performance.now();
      try {
        const result = await Promise.race([
          checkFn(),
          this.createTimeout(name)
        ]);
        result.responseTime = Math.round(performance.now() - checkStart);
        checkResults.push(result);
      } catch (error) {
        checkResults.push({
          name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Check timed out or failed',
          responseTime: Math.round(performance.now() - checkStart)
        });
      }
    }

    // Determine overall status
    const failCount = checkResults.filter(r => r.status === 'fail').length;
    const warnCount = checkResults.filter(r => r.status === 'warn').length;
    
    let overall: HealthStatus['overall'] = 'healthy';
    if (failCount > 0) {
      overall = 'unhealthy';
    } else if (warnCount > 0) {
      overall = 'degraded';
    }

    const status: HealthStatus = {
      overall,
      timestamp: Date.now(),
      checks: checkResults
    };

    this.lastStatus = status;

    // Report to cortex if degraded or unhealthy
    if (overall !== 'healthy') {
      cortex.reportEvent({
        sourceId: 'PERFORMANCE',
        type: HealthEventType.ERROR,
        impact: overall === 'unhealthy' ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        latencyMs: Math.round(performance.now() - startTime),
        context: {
          status: overall,
          failedChecks: checkResults.filter(r => r.status === 'fail').map(r => r.name),
          warningChecks: checkResults.filter(r => r.status === 'warn').map(r => r.name)
        }
      });
    }

    // Emit event for subscribers
    eventBus.publish('health.status', status);

    // Log status change
    if (this.hasStatusChanged(status)) {
      logger.log('PERFORMANCE', `Health status changed to ${overall}`, overall === 'healthy' ? 'success' : overall === 'degraded' ? 'warning' : 'error', {
        checks: checkResults.length,
        failed: failCount,
        warnings: warnCount
      });
    }

    return status;
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Memory check
    this.registerCheck('memory', async () => {
      if (typeof performance === 'undefined' || !('memory' in performance)) {
        return {
          name: 'memory',
          status: 'pass',
          message: 'Memory API not available in this environment'
        };
      }

      const memory = (performance as any).memory;
      const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      
      if (usedPercent > this.config.memoryThresholdPercent) {
        return {
          name: 'memory',
          status: 'warn',
          message: `Memory usage high: ${usedPercent.toFixed(1)}%`,
          details: {
            usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
            percentUsed: usedPercent.toFixed(1)
          }
        };
      }

      return {
        name: 'memory',
        status: 'pass',
        message: `Memory usage normal: ${usedPercent.toFixed(1)}%`,
        details: {
          percentUsed: usedPercent.toFixed(1)
        }
      };
    });

    // Storage check
    this.registerCheck('storage', async () => {
      if (!isLocalStorageAvailable()) {
        return {
          name: 'storage',
          status: 'fail',
          message: 'localStorage not available'
        };
      }

      const usage = estimateLocalStorageUsage();
      
      if (usage.percentage > this.config.storageThresholdPercent) {
        return {
          name: 'storage',
          status: 'warn',
          message: `Storage usage high: ${usage.percentage.toFixed(1)}%`,
          details: usage
        };
      }

      return {
        name: 'storage',
        status: 'pass',
        message: `Storage usage normal: ${usage.percentage.toFixed(1)}%`,
        details: usage
      };
    });

    // Online status check
    this.registerCheck('connectivity', async () => {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      return {
        name: 'connectivity',
        status: isOnline ? 'pass' : 'warn',
        message: isOnline ? 'Online' : 'Offline mode'
      };
    });

    // Service Worker check (if applicable)
    this.registerCheck('service_worker', async () => {
      if (!('serviceWorker' in navigator)) {
        return {
          name: 'service_worker',
          status: 'pass',
          message: 'Service Worker not supported'
        };
      }

      const registration = await navigator.serviceWorker.ready;
      const isActive = registration.active?.state === 'activated';
      
      return {
        name: 'service_worker',
        status: isActive ? 'pass' : 'warn',
        message: isActive ? 'Service Worker active' : 'Service Worker not active'
      };
    });
  }

  /**
   * Create a timeout promise for health checks
   */
  private createTimeout(checkName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${checkName}' timed out after ${this.config.apiTimeoutMs}ms`));
      }, this.config.apiTimeoutMs);
    });
  }

  /**
   * Check if status has changed from last check
   */
  private hasStatusChanged(newStatus: HealthStatus): boolean {
    if (!this.lastStatus) return true;
    if (this.lastStatus.overall !== newStatus.overall) return true;
    
    const oldFails = this.lastStatus.checks.filter(c => c.status === 'fail').length;
    const newFails = newStatus.checks.filter(c => c.status === 'fail').length;
    
    return oldFails !== newFails;
  }
}

// Export singleton
export const healthMonitor = new HealthMonitor();

// React hook for health status
export function useHealthMonitor() {
  return {
    getStatus: () => healthMonitor.getLastStatus(),
    isDegraded: (service: string) => healthMonitor.isDegraded(service),
    getDegradedServices: () => healthMonitor.getDegradedServices(),
    runChecks: () => healthMonitor.runChecks()
  };
}
