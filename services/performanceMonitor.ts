/**
 * Performance Monitor Service
 * 
 * Tracks performance metrics:
 * - Bundle size monitoring
 * - Memory usage tracking
 * - Response time measurements
 * - Performance regression detection
 */

import { logger } from './logger';

// Metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BundleSizeMetric {
  chunkName: string;
  size: number; // bytes
  gzipSize: number; // bytes
  timestamp: number;
}

export interface MemoryMetric {
  used: number; // MB
  total: number; // MB
  limit: number; // MB
  timestamp: number;
}

export interface TimingMetric {
  operation: string;
  duration: number; // ms
  timestamp: number;
}

// Alert thresholds
const THRESHOLDS = {
  bundleSize: {
    warning: 500 * 1024, // 500KB
    critical: 1024 * 1024, // 1MB
  },
  memory: {
    warning: 100, // 100MB
    critical: 200, // 200MB
  },
  timing: {
    warning: 100, // 100ms
    critical: 500, // 500ms
  },
};

// Storage keys
const STORAGE_KEY = 'jarvis-performance-metrics';
const BASELINE_KEY = 'jarvis-performance-baseline';

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private bundleSizes: BundleSizeMetric[] = [];
  private memorySnapshots: MemoryMetric[] = [];
  private timings: TimingMetric[] = [];
  private isMonitoring = false;
  private memoryInterval: number | null = null;

  // Initialize monitoring
  init(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.loadHistoricalData();
    this.startMemoryMonitoring();
    this.measureInitialMetrics();
    
    logger.log('SYSTEM', 'Monitor initialized');
  }

  // Stop monitoring
  destroy(): void {
    this.isMonitoring = false;
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    this.saveHistoricalData();
  }

  // Measure bundle sizes from build stats
  recordBundleSize(chunkName: string, size: number, gzipSize: number): void {
    const metric: BundleSizeMetric = {
      chunkName,
      size,
      gzipSize,
      timestamp: Date.now(),
    };
    
    this.bundleSizes.push(metric);
    this.pruneOldData(this.bundleSizes, 100);
    
    // Check thresholds
    if (gzipSize > THRESHOLDS.bundleSize.critical) {
      logger.log('SYSTEM', `Bundle ${chunkName} exceeds critical size: ${(gzipSize / 1024).toFixed(2)}KB`, 'error', { chunkName, size, gzipSize });
    } else if (gzipSize > THRESHOLDS.bundleSize.warning) {
      logger.log('SYSTEM', `Bundle ${chunkName} exceeds warning size: ${(gzipSize / 1024).toFixed(2)}KB`, 'warning', { chunkName, size, gzipSize });
    }
    
    this.saveHistoricalData();
  }

  // Measure operation timing
  measureTiming<T>(operation: string, fn: () => T): T;
  measureTiming<T>(operation: string, fn: () => Promise<T>): Promise<T>;
  measureTiming<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    
    const recordTiming = (duration: number) => {
      const metric: TimingMetric = {
        operation,
        duration,
        timestamp: Date.now(),
      };
      
      this.timings.push(metric);
      this.pruneOldData(this.timings, 1000);
      
      // Check thresholds
      if (duration > THRESHOLDS.timing.critical) {
        logger.log('SYSTEM', `Operation "${operation}" exceeded critical time: ${duration.toFixed(2)}ms`, 'error', { operation, duration });
      } else if (duration > THRESHOLDS.timing.warning) {
        logger.log('SYSTEM', `Operation "${operation}" exceeded warning time: ${duration.toFixed(2)}ms`, 'warning', { operation, duration });
      }
      
      this.saveHistoricalData();
    };
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        recordTiming(performance.now() - start);
      });
    } else {
      recordTiming(performance.now() - start);
      return result;
    }
  }

  // Start timing (returns end function)
  startTiming(operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      const metric: TimingMetric = {
        operation,
        duration,
        timestamp: Date.now(),
      };
      this.timings.push(metric);
      this.pruneOldData(this.timings, 1000);
      this.saveHistoricalData();
      return duration;
    };
  }

  // Get memory usage
  getMemoryUsage(): MemoryMetric | null {
    const memory = (performance as any).memory;
    if (!memory) return null;
    
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      timestamp: Date.now(),
    };
  }

  // Record memory snapshot
  recordMemorySnapshot(): MemoryMetric | null {
    const snapshot = this.getMemoryUsage();
    if (!snapshot) return null;
    
    this.memorySnapshots.push(snapshot);
    this.pruneOldData(this.memorySnapshots, 100);
    
    // Check thresholds
    if (snapshot.used > THRESHOLDS.memory.critical) {
      logger.log('SYSTEM', `Memory usage critical: ${snapshot.used}MB`, 'error', snapshot);
    } else if (snapshot.used > THRESHOLDS.memory.warning) {
      logger.log('SYSTEM', `Memory usage high: ${snapshot.used}MB`, 'warning', snapshot);
    }
    
    this.saveHistoricalData();
    return snapshot;
  }

  // Get statistics
  getStats(): {
    bundleSizes: BundleSizeMetric[];
    memorySnapshots: MemoryMetric[];
    timings: TimingMetric[];
    averages: {
      memory: number;
      timing: Record<string, number>;
    };
  } {
    // Calculate timing averages by operation
    const timingByOperation: Record<string, number[]> = {};
    this.timings.forEach(t => {
      if (!timingByOperation[t.operation]) {
        timingByOperation[t.operation] = [];
      }
      timingByOperation[t.operation].push(t.duration);
    });
    
    const timingAverages: Record<string, number> = {};
    Object.entries(timingByOperation).forEach(([op, times]) => {
      timingAverages[op] = times.reduce((a, b) => a + b, 0) / times.length;
    });
    
    return {
      bundleSizes: [...this.bundleSizes],
      memorySnapshots: [...this.memorySnapshots],
      timings: [...this.timings],
      averages: {
        memory: this.memorySnapshots.length > 0
          ? this.memorySnapshots.reduce((a, b) => a + b.used, 0) / this.memorySnapshots.length
          : 0,
        timing: timingAverages,
      },
    };
  }

  // Set baseline for regression detection
  setBaseline(): void {
    const baseline = this.getStats();
    localStorage.setItem(BASELINE_KEY, JSON.stringify({
      ...baseline,
      timestamp: Date.now(),
    }));
    logger.log('SYSTEM', 'Baseline set');
  }

  // Compare current stats against baseline
  compareToBaseline(): {
    regressions: string[];
    improvements: string[];
    unchanged: string[];
  } {
    const baselineStr = localStorage.getItem(BASELINE_KEY);
    if (!baselineStr) {
      return { regressions: [], improvements: [], unchanged: [] };
    }
    
    const baseline = JSON.parse(baselineStr);
    const current = this.getStats();
    
    const regressions: string[] = [];
    const improvements: string[] = [];
    const unchanged: string[] = [];
    
    // Compare memory
    if (baseline.averages.memory && current.averages.memory) {
      const diff = current.averages.memory - baseline.averages.memory;
      const percentChange = (diff / baseline.averages.memory) * 100;
      
      if (percentChange > 10) {
        regressions.push(`Memory usage increased by ${percentChange.toFixed(1)}% (${diff.toFixed(1)}MB)`);
      } else if (percentChange < -10) {
        improvements.push(`Memory usage decreased by ${Math.abs(percentChange).toFixed(1)}% (${Math.abs(diff).toFixed(1)}MB)`);
      } else {
        unchanged.push(`Memory usage stable (${current.averages.memory.toFixed(1)}MB)`);
      }
    }
    
    // Compare timings
    Object.entries(current.averages.timing).forEach(([op, avg]) => {
      const baselineAvg = baseline.averages.timing[op];
      if (baselineAvg) {
        const diff = avg - baselineAvg;
        const percentChange = (diff / baselineAvg) * 100;
        
        if (percentChange > 20) {
          regressions.push(`"${op}" slowed by ${percentChange.toFixed(1)}% (${diff.toFixed(1)}ms)`);
        } else if (percentChange < -20) {
          improvements.push(`"${op}" improved by ${Math.abs(percentChange).toFixed(1)}% (${Math.abs(diff).toFixed(1)}ms)`);
        } else {
          unchanged.push(`"${op}" timing stable (${avg.toFixed(1)}ms)`);
        }
      }
    });
    
    return { regressions, improvements, unchanged };
  }

  // Generate report
  generateReport(): string {
    const stats = this.getStats();
    const baseline = this.compareToBaseline();
    
    let report = '# JARVIS Performance Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Bundle sizes
    report += '## Bundle Sizes\n';
    if (stats.bundleSizes.length > 0) {
      stats.bundleSizes.forEach(b => {
        report += `- ${b.chunkName}: ${(b.gzipSize / 1024).toFixed(2)}KB (gzipped)\n`;
      });
    } else {
      report += '- No bundle size data recorded\n';
    }
    report += '\n';
    
    // Memory
    report += '## Memory Usage\n';
    if (stats.memorySnapshots.length > 0) {
      const latest = stats.memorySnapshots[stats.memorySnapshots.length - 1];
      report += `- Current: ${latest.used}MB / ${latest.total}MB\n`;
      report += `- Average: ${stats.averages.memory.toFixed(2)}MB\n`;
      report += `- Limit: ${latest.limit}MB\n`;
    } else {
      report += '- No memory data recorded\n';
    }
    report += '\n';
    
    // Timings
    report += '## Operation Timings\n';
    if (Object.keys(stats.averages.timing).length > 0) {
      Object.entries(stats.averages.timing).forEach(([op, avg]) => {
        report += `- ${op}: ${avg.toFixed(2)}ms (avg)\n`;
      });
    } else {
      report += '- No timing data recorded\n';
    }
    report += '\n';
    
    // Baseline comparison
    report += '## Baseline Comparison\n';
    if (baseline.regressions.length > 0) {
      report += '### Regressions ⚠️\n';
      baseline.regressions.forEach(r => report += `- ${r}\n`);
      report += '\n';
    }
    if (baseline.improvements.length > 0) {
      report += '### Improvements ✅\n';
      baseline.improvements.forEach(i => report += `- ${i}\n`);
      report += '\n';
    }
    if (baseline.unchanged.length > 0) {
      report += '### Unchanged\n';
      baseline.unchanged.forEach(u => report += `- ${u}\n`);
    }
    
    return report;
  }

  // Export data
  exportData(): string {
    return JSON.stringify({
      bundleSizes: this.bundleSizes,
      memorySnapshots: this.memorySnapshots,
      timings: this.timings,
      exportedAt: Date.now(),
    }, null, 2);
  }

  // Clear all data
  clearData(): void {
    this.bundleSizes = [];
    this.memorySnapshots = [];
    this.timings = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BASELINE_KEY);
    logger.log('SYSTEM', 'All data cleared');
  }

  // Private methods
  private startMemoryMonitoring(): void {
    // Record memory every 30 seconds
    this.memoryInterval = window.setInterval(() => {
      this.recordMemorySnapshot();
    }, 30000);
  }

  private measureInitialMetrics(): void {
    // Measure initial page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.timings.push({
            operation: 'page_load',
            duration: navigation.loadEventEnd - navigation.startTime,
            timestamp: Date.now(),
          });
          this.saveHistoricalData();
        }
      }, 0);
    });
  }

  private loadHistoricalData(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.bundleSizes = parsed.bundleSizes || [];
        this.memorySnapshots = parsed.memorySnapshots || [];
        this.timings = parsed.timings || [];
      }
    } catch (e) {
      logger.log('SYSTEM', 'Failed to load historical data');
    }
  }

  private saveHistoricalData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bundleSizes: this.bundleSizes,
        memorySnapshots: this.memorySnapshots,
        timings: this.timings,
      }));
    } catch (e) {
      // Storage might be full, clear old data
      this.pruneOldData(this.timings, 100);
      this.pruneOldData(this.memorySnapshots, 50);
    }
  }

  private pruneOldData<T>(array: T[], maxSize: number): void {
    if (array.length > maxSize) {
      array.splice(0, array.length - maxSize);
    }
  }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component render time
export function useRenderTime(componentName: string): void {
  const start = performance.now();
  
  // Use requestAnimationFrame to measure after render
  requestAnimationFrame(() => {
    const duration = performance.now() - start;
    if (duration > 16) { // Log if slower than 60fps
      logger.log('SYSTEM', `${componentName} render took ${duration.toFixed(2)}ms`, 'warning', { component: componentName, duration });
    }
  });
}

// Decorator for measuring function execution time
export function measure(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    return performanceMonitor.measureTiming(propertyKey, () => originalMethod.apply(this, args));
  };
}
