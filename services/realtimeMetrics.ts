/**
 * Real-Time Metrics Service
 * 
 * Provides live system metrics broadcasting using EventBus
 * Enables real-time dashboard updates without WebSocket server dependency
 */

import { eventBus } from './eventBus';
import { logger } from './logger';
import { 
  getSystemMetrics, 
  getProcessList, 
  getProcessStats, 
  getActiveAlerts,
  acknowledgeAlert,
  ProcessInfo,
  ProcessStats,
  SystemMetrics,
  SystemAlert
} from './coreOs';

// Real-time metrics update interval
const DEFAULT_UPDATE_INTERVAL = 2000; // 2 seconds

// Metrics history for charts
const MAX_HISTORY_POINTS = 60; // 2 minutes of data at 2s intervals

interface MetricsDataPoint {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  cpuUsage: number;
  rss: number;
}

interface RealtimeMetricsState {
  isRunning: boolean;
  intervalId: number | null;
  lastUpdate: number;
  metrics: SystemMetrics | null;
  processes: ProcessInfo[];
  processStats: ProcessStats | null;
  alerts: SystemAlert[];
  metricsHistory: MetricsDataPoint[];
}

class RealtimeMetricsService {
  private static instance: RealtimeMetricsService;
  private state: RealtimeMetricsState = {
    isRunning: false,
    intervalId: null,
    lastUpdate: 0,
    metrics: null,
    processes: [],
    processStats: null,
    alerts: [],
    metricsHistory: [],
  };

  private constructor() {}

  public static getInstance(): RealtimeMetricsService {
    if (!RealtimeMetricsService.instance) {
      RealtimeMetricsService.instance = new RealtimeMetricsService();
    }
    return RealtimeMetricsService.instance;
  }

  /**
   * Start real-time metrics broadcasting
   */
  public start(updateInterval: number = DEFAULT_UPDATE_INTERVAL): void {
    if (this.state.isRunning) {
      logger.info('SYSTEM', 'Realtime metrics service already running');
      return;
    }

    this.state.isRunning = true;
    logger.info('SYSTEM', `Starting realtime metrics service (${updateInterval}ms interval)`);

    // Initial update
    this.updateMetrics();

    // Set up interval
    this.state.intervalId = window.setInterval(() => {
      this.updateMetrics();
    }, updateInterval);

    // Broadcast start event
    eventBus.publish('system.performance', {
      type: 'metrics:started',
      timestamp: Date.now(),
      interval: updateInterval,
    });
  }

  /**
   * Stop real-time metrics broadcasting
   */
  public stop(): void {
    if (!this.state.isRunning) return;

    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }

    this.state.isRunning = false;
    logger.info('SYSTEM', 'Realtime metrics service stopped');

    eventBus.publish('system.performance', {
      type: 'metrics:stopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Check if service is running
   */
  public isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Get current state
   */
  public getState(): RealtimeMetricsState {
    return { ...this.state };
  }

  /**
   * Get metrics history for charts
   */
  public getMetricsHistory(): MetricsDataPoint[] {
    return [...this.state.metricsHistory];
  }

  /**
   * Acknowledge an alert
   */
  public async ackAlert(alertId: string): Promise<void> {
    acknowledgeAlert(alertId);
    await this.updateMetrics(); // Refresh after acknowledging
  }

  /**
   * Kill a process
   */
  public async killProcess(pid: number, force: boolean = false): Promise<boolean> {
    try {
      const { killProcess } = await import('./coreOs');
      const result = await killProcess(pid, force);
      
      if (result.success) {
        logger.log('SYSTEM', `Killed process ${pid}`, 'info');
        await this.updateMetrics(); // Refresh after killing
      } else {
        logger.log('SYSTEM', `Failed to kill process ${pid}: ${result.message}`, 'error');
      }
      
      return result.success;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.log('SYSTEM', `Error killing process ${pid}: ${msg}`, 'error');
      return false;
    }
  }

  /**
   * Update metrics and broadcast to subscribers
   */
  private async updateMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Fetch all metrics in parallel
      const [metrics, processes, processStats, alerts] = await Promise.all([
        getSystemMetrics(),
        getProcessList(),
        getProcessStats(),
        getActiveAlerts(),
      ]);

      // Update history
      const dataPoint: MetricsDataPoint = {
        timestamp,
        heapUsed: metrics.memory.heapUsed,
        heapTotal: metrics.memory.heapTotal,
        cpuUsage: metrics.cpu.usagePercent,
        rss: metrics.memory.rss,
      };

      this.state.metricsHistory.push(dataPoint);
      if (this.state.metricsHistory.length > MAX_HISTORY_POINTS) {
        this.state.metricsHistory.shift();
      }

      // Update state
      this.state.metrics = metrics;
      this.state.processes = processes;
      this.state.processStats = processStats;
      this.state.alerts = alerts;
      this.state.lastUpdate = timestamp;

      // Broadcast update
      eventBus.publish('system.performance', {
        type: 'metrics:update',
        timestamp,
        metrics,
        processes,
        processStats,
        alerts,
        history: this.state.metricsHistory,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.log('SYSTEM', `Failed to update metrics: ${msg}`, 'error');
    }
  }

  /**
   * Subscribe to real-time metrics updates
   */
  public subscribe(callback: (data: any) => void): () => void {
    return eventBus.subscribe('system.performance', callback);
  }
}

export const realtimeMetrics = RealtimeMetricsService.getInstance();
export type { MetricsDataPoint, RealtimeMetricsState };
