/**
 * Enhanced Performance Monitoring Service for JARVIS Kernel v1.3
 * 
 * Implements advanced performance monitoring features:
 * - Detailed metrics collection
 * - Distributed tracing
 * - Performance benchmarks with alerts
 */

import { logger } from './logger';
import { eventBus } from './eventBus';

interface PerformanceMetric {
  id: string;
  timestamp: number;
  value: number;
  unit: string;
  tags: Record<string, string>;
}

interface TraceSpan {
  id: string;
  parentId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; message: string; fields?: Record<string, any> }>;
}

interface PerformanceAlert {
  id: string;
  metric: string;
  condition: string; // e.g., '>', '<', '='
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
}

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private metrics: PerformanceMetric[] = [];
  private traceSpans: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private alerts: PerformanceAlert[] = [];
  private readonly MAX_METRICS = 10000; // Maximum number of metrics to keep
  private readonly ALERT_EVALUATION_INTERVAL = 30000; // 30 seconds
  private readonly METRIC_RETENTION_HOURS = 24; // Hours to retain metrics

  private constructor() {
    // Start alert evaluation loop
    setInterval(() => {
      this.evaluateAlerts();
    }, this.ALERT_EVALUATION_INTERVAL);
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * Record a performance metric
   */
  public recordMetric(id: string, value: number, unit: string, tags: Record<string, string> = {}): void {
    const metric: PerformanceMetric = {
      id,
      timestamp: Date.now(),
      value,
      unit,
      tags
    };

    this.metrics.push(metric);

    // Trim old metrics
    this.trimOldMetrics();

    logger.log('SYSTEM', `Recorded metric: ${id} = ${value} ${unit}`, 'info');
  }

  /**
   * Start a trace span
   */
  public startTrace(operation: string, parentId?: string, tags: Record<string, string> = {}): string {
    const spanId = this.generateSpanId();
    const span: TraceSpan = {
      id: spanId,
      parentId,
      operation,
      startTime: Date.now(),
      tags,
      logs: []
    };

    this.traceSpans.set(spanId, span);
    this.activeSpans.set(spanId, span);

    logger.log('SYSTEM', `Started trace span: ${spanId} for operation: ${operation}`, 'info');

    return spanId;
  }

  /**
   * End a trace span
   */
  public endTrace(spanId: string, tags: Record<string, string> = {}): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.log('SYSTEM', `Attempted to end non-existent span: ${spanId}`, 'warning');
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    // Add any additional tags
    Object.assign(span.tags, tags);

    // Remove from active spans
    this.activeSpans.delete(spanId);

    logger.log('SYSTEM', `Ended trace span: ${spanId}, duration: ${span.duration}ms`, 'info');
  }

  /**
   * Add a log to a trace span
   */
  public logToTrace(spanId: string, message: string, fields?: Record<string, any>): void {
    const span = this.traceSpans.get(spanId);
    if (!span) {
      logger.log('SYSTEM', `Attempted to log to non-existent span: ${spanId}`, 'warning');
      return;
    }

    span.logs.push({
      timestamp: Date.now(),
      message,
      fields
    });
  }

  /**
   * Create a performance alert
   */
  public createAlert(id: string, metric: string, condition: string, threshold: number): void {
    // Check if alert already exists
    const existingAlert = this.alerts.find(alert => alert.id === id);
    if (existingAlert) {
      logger.log('SYSTEM', `Alert ${id} already exists`, 'warning');
      return;
    }

    const alert: PerformanceAlert = {
      id,
      metric,
      condition,
      threshold,
      currentValue: 0,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);

    logger.log('SYSTEM', `Created performance alert: ${id} for metric ${metric}`, 'info');
  }

  /**
   * Remove a performance alert
   */
  public removeAlert(id: string): boolean {
    const initialLength = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.id !== id);
    const removed = initialLength !== this.alerts.length;

    if (removed) {
      logger.log('SYSTEM', `Removed performance alert: ${id}`, 'info');
    }

    return removed;
  }

  /**
   * Evaluate all active alerts
   */
  private evaluateAlerts(): void {
    for (const alert of this.alerts) {
      if (alert.resolved) continue;

      // Get recent values for the metric
      const recentMetrics = this.getRecentMetrics(alert.metric, 1); // Get last value
      if (recentMetrics.length === 0) continue;

      const latestValue = recentMetrics[0].value;
      alert.currentValue = latestValue;

      // Check if condition is met
      let triggered = false;
      switch (alert.condition) {
        case '>':
          triggered = latestValue > alert.threshold;
          break;
        case '<':
          triggered = latestValue < alert.threshold;
          break;
        case '>=':
          triggered = latestValue >= alert.threshold;
          break;
        case '<=':
          triggered = latestValue <= alert.threshold;
          break;
        case '=':
          triggered = latestValue === alert.threshold;
          break;
        case '!=':
          triggered = latestValue !== alert.threshold;
          break;
        default:
          logger.log('SYSTEM', `Unknown condition: ${alert.condition}`, 'error');
          continue;
      }

      if (triggered) {
        logger.log('SYSTEM', `ALERT TRIGGERED: ${alert.id} - ${alert.metric} ${alert.condition} ${alert.threshold} (current: ${latestValue})`, 'error');
        
        // Emit event for UI notifications
        eventBus.publish('performance:alert', {
          alertId: alert.id,
          metric: alert.metric,
          condition: alert.condition,
          threshold: alert.threshold,
          currentValue: latestValue,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Get recent metrics for a specific ID
   */
  public getRecentMetrics(id: string, limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(metric => metric.id === id)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get metrics aggregated by time window
   */
  public getAggregatedMetrics(id: string, windowMs: number, aggregation: 'avg' | 'sum' | 'min' | 'max' = 'avg'): PerformanceMetric | null {
    const cutoffTime = Date.now() - windowMs;
    const relevantMetrics = this.metrics.filter(
      metric => metric.id === id && metric.timestamp >= cutoffTime
    );

    if (relevantMetrics.length === 0) {
      return null;
    }

    let aggregatedValue: number;
    const sample = relevantMetrics[0]; // Use first as template for other properties

    switch (aggregation) {
      case 'avg':
        aggregatedValue = relevantMetrics.reduce((sum, metric) => sum + metric.value, 0) / relevantMetrics.length;
        break;
      case 'sum':
        aggregatedValue = relevantMetrics.reduce((sum, metric) => sum + metric.value, 0);
        break;
      case 'min':
        aggregatedValue = Math.min(...relevantMetrics.map(m => m.value));
        break;
      case 'max':
        aggregatedValue = Math.max(...relevantMetrics.map(m => m.value));
        break;
      default:
        aggregatedValue = relevantMetrics[0].value;
    }

    return {
      id: `${id}_${aggregation}_${windowMs}ms`,
      timestamp: Date.now(),
      value: aggregatedValue,
      unit: sample.unit,
      tags: sample.tags
    };
  }

  /**
   * Get trace spans for an operation
   */
  public getTraceSpans(operation: string): TraceSpan[] {
    return Array.from(this.traceSpans.values())
      .filter(span => span.operation === operation)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get trace span by ID
   */
  public getTraceSpanById(spanId: string): TraceSpan | undefined {
    return this.traceSpans.get(spanId);
  }

  /**
   * Get active trace spans
   */
  public getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get performance alerts
   */
  public getAlerts(activeOnly: boolean = true): PerformanceAlert[] {
    if (activeOnly) {
      return this.alerts.filter(alert => !alert.resolved);
    }
    return [...this.alerts];
  }

  /**
   * Resolve a performance alert
   */
  public resolveAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.resolved = true;
      logger.log('SYSTEM', `Resolved performance alert: ${id}`, 'info');
      return true;
    }
    return false;
  }

  /**
   * Generate a unique span ID
   */
  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trim old metrics to prevent memory bloat
   */
  private trimOldMetrics(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      // Keep the most recent metrics
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Remove metrics older than retention period
    const retentionCutoff = Date.now() - (this.METRIC_RETENTION_HOURS * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(metric => metric.timestamp >= retentionCutoff);
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalMetrics: number;
    activeSpans: number;
    totalSpans: number;
    activeAlerts: number;
    totalAlerts: number;
    retentionHours: number;
  } {
    return {
      totalMetrics: this.metrics.length,
      activeSpans: this.activeSpans.size,
      totalSpans: this.traceSpans.size,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      totalAlerts: this.alerts.length,
      retentionHours: this.METRIC_RETENTION_HOURS
    };
  }

  /**
   * Clear all performance data
   */
  public clearAllData(): void {
    this.metrics = [];
    this.traceSpans.clear();
    this.activeSpans.clear();
    this.alerts = [];

    logger.log('SYSTEM', 'Cleared all performance monitoring data', 'info');
  }

  /**
   * Measure execution time of a function
   */
  public async measureExecution<T>(
    operation: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const spanId = this.startTrace(operation, undefined, tags);
    
    try {
      const result = await fn();
      
      // Record execution time as a metric
      const span = this.traceSpans.get(spanId);
      if (span && span.duration) {
        this.recordMetric(
          `${operation}_execution_time`,
          span.duration,
          'milliseconds',
          { ...tags, operation }
        );
      }
      
      return result;
    } catch (error) {
      // Log error to trace
      this.logToTrace(spanId, `Error during execution: ${(error as Error).message}`, { error: (error as Error).stack });
      throw error;
    } finally {
      this.endTrace(spanId);
    }
  }
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();

// Initialize performance monitoring service when module loads
logger.log('SYSTEM', 'Performance monitoring service initialized', 'info');