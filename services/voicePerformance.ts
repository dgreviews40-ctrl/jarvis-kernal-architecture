/**
 * Voice Performance Monitor
 * Tracks latency metrics for voice pipeline optimization
 */

interface TimingMark {
  name: string;
  timestamp: number;
  data?: any;
}

interface VoiceMetrics {
  sttLatency: number;      // Speech-to-text latency
  ttsLatency: number;      // Text-to-speech latency  
  totalLatency: number;    // End-to-end latency
  networkTime: number;     // Network round-trip time
  processingTime: number;  // Server processing time
}

class VoicePerformanceMonitor {
  private marks: Map<string, TimingMark[]> = new Map();
  private enabled = true;

  /**
   * Start timing a measurement
   */
  public start(name: string): void {
    if (!this.enabled) return;
    
    const mark: TimingMark = {
      name,
      timestamp: performance.now()
    };
    
    if (!this.marks.has(name)) {
      this.marks.set(name, []);
    }
    this.marks.get(name)!.push(mark);
  }

  /**
   * End timing and return duration
   */
  public end(name: string, data?: any): number | null {
    if (!this.enabled) return null;
    
    const marks = this.marks.get(name);
    if (!marks || marks.length === 0) {
      console.warn(`[PERF] No start mark found for: ${name}`);
      return null;
    }
    
    const startMark = marks[marks.length - 1];
    const duration = performance.now() - startMark.timestamp;
    
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`, data || '');
    
    return duration;
  }

  /**
   * Measure a function's execution time
   */
  public async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (e) {
      this.end(name, { error: true });
      throw e;
    }
  }

  /**
   * Record voice pipeline metrics
   */
  public recordMetrics(metrics: Partial<VoiceMetrics>): void {
    console.log('[PERF] Voice Pipeline Metrics:', {
      stt: metrics.sttLatency ? `${metrics.sttLatency.toFixed(2)}ms` : 'N/A',
      tts: metrics.ttsLatency ? `${metrics.ttsLatency.toFixed(2)}ms` : 'N/A',
      total: metrics.totalLatency ? `${metrics.totalLatency.toFixed(2)}ms` : 'N/A',
      network: metrics.networkTime ? `${metrics.networkTime.toFixed(2)}ms` : 'N/A',
      processing: metrics.processingTime ? `${metrics.processingTime.toFixed(2)}ms` : 'N/A',
    });
  }

  /**
   * Get average timing for a mark name
   */
  public getAverage(name: string): number | null {
    const marks = this.marks.get(name);
    if (!marks || marks.length < 2) return null;
    
    // This would need paired start/end marks
    // Simplified for now
    return null;
  }

  /**
   * Clear all marks
   */
  public clear(): void {
    this.marks.clear();
  }

  /**
   * Enable/disable monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Log optimization suggestions based on metrics
   */
  public analyzeAndSuggest(metrics: VoiceMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.sttLatency > 2000) {
      suggestions.push('STT latency is high (>2s). Consider using a smaller Whisper model (tiny/base) or enabling GPU.');
    }

    if (metrics.ttsLatency > 1500) {
      suggestions.push('TTS latency is high (>1.5s). Consider enabling streaming mode or using a faster voice model.');
    }

    if (metrics.networkTime > 500) {
      suggestions.push('Network latency is high (>500ms). Ensure servers are running locally and check network conditions.');
    }

    if (metrics.totalLatency > 5000) {
      suggestions.push('Total latency is very high (>5s). Consider all optimizations: smaller models, streaming, GPU acceleration.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Voice pipeline performance looks good! Latency is within acceptable ranges.');
    }

    return suggestions;
  }
}

export const voicePerf = new VoicePerformanceMonitor();

/**
 * Decorator for measuring method execution time
 */
export function measurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const markName = `${target.constructor.name}.${propertyKey}`;
    voicePerf.start(markName);
    
    try {
      const result = await originalMethod.apply(this, args);
      voicePerf.end(markName);
      return result;
    } catch (e) {
      voicePerf.end(markName, { error: true });
      throw e;
    }
  };
  
  return descriptor;
}
