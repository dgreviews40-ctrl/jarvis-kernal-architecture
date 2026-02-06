/**
 * Adaptive Rate Limiter
 * Dynamically adjusts rate limits based on system load and API behavior
 * Provides graceful degradation under pressure
 */

interface RateLimitConfig {
  baseRequestsPerSecond: number;
  baseRequestsPerMinute: number;
  baseRequestsPerDay: number;
  burstSize: number;
}

interface AdaptiveLimits {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  currentBurst: number;
}

interface RequestMetrics {
  timestamp: number;
  latency: number;
  success: boolean;
  errorType?: string;
}

interface SystemLoad {
  cpuUsage: number;
  memoryUsage: number;
  activeRequests: number;
  queueDepth: number;
}

class AdaptiveRateLimiter {
  private config: RateLimitConfig;
  private adaptiveLimits: AdaptiveLimits;
  private requestHistory: RequestMetrics[] = [];
  private currentSecond: number = 0;
  private currentMinute: number = 0;
  private currentDay: number = 0;
  private lastSecondReset = Date.now();
  private lastMinuteReset = Date.now();
  private lastDayReset = Date.now();
  private queue: Array<() => void> = [];
  private systemLoad: SystemLoad = {
    cpuUsage: 0,
    memoryUsage: 0,
    activeRequests: 0,
    queueDepth: 0
  };

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      baseRequestsPerSecond: 10,
      baseRequestsPerMinute: 100,
      baseRequestsPerDay: 10000,
      burstSize: 5,
      ...config
    };

    this.adaptiveLimits = {
      requestsPerSecond: this.config.baseRequestsPerSecond,
      requestsPerMinute: this.config.baseRequestsPerMinute,
      requestsPerDay: this.config.baseRequestsPerDay,
      currentBurst: this.config.burstSize
    };

    this.startAdaptiveLoop();
  }

  /**
   * Check if request is allowed
   */
  canMakeRequest(): { allowed: boolean; retryAfter?: number; reason?: string } {
    this.resetCountersIfNeeded();

    // Check hard limits
    if (this.currentDay >= this.adaptiveLimits.requestsPerDay) {
      return {
        allowed: false,
        reason: 'Daily limit exceeded',
        retryAfter: this.getSecondsUntilTomorrow()
      };
    }

    if (this.currentMinute >= this.adaptiveLimits.requestsPerMinute) {
      return {
        allowed: false,
        reason: 'Per-minute limit exceeded',
        retryAfter: this.getSecondsUntilNextMinute()
      };
    }

    // Check with burst allowance
    if (this.currentSecond >= this.adaptiveLimits.requestsPerSecond) {
      if (this.adaptiveLimits.currentBurst > 0) {
        this.adaptiveLimits.currentBurst--;
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Per-second limit exceeded',
        retryAfter: 1
      };
    }

    return { allowed: true };
  }

  /**
   * Acquire permission to make request (blocks if needed)
   */
  async acquire(): Promise<void> {
    const check = this.canMakeRequest();

    if (check.allowed) {
      this.recordRequestStart();
      return;
    }

    // Queue the request
    return new Promise((resolve) => {
      const queuedRequest = () => {
        this.recordRequestStart();
        resolve();
      };

      this.queue.push(queuedRequest);
      this.systemLoad.queueDepth = this.queue.length;

      // Process queue after retryAfter
      if (check.retryAfter) {
        setTimeout(() => this.processQueue(), check.retryAfter * 1000);
      }
    });
  }

  /**
   * Record successful request
   */
  recordSuccess(latencyMs: number): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      latency: latencyMs,
      success: true
    });

    this.trimHistory();
    this.systemLoad.activeRequests--;
  }

  /**
   * Record failed request
   */
  recordFailure(errorType: string, latencyMs: number): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      latency: latencyMs,
      success: false,
      errorType
    });

    this.trimHistory();
    this.systemLoad.activeRequests--;

    // Adjust limits based on error
    this.handleError(errorType);
  }

  /**
   * Update system load metrics
   */
  updateSystemLoad(load: Partial<SystemLoad>): void {
    this.systemLoad = { ...this.systemLoad, ...load };
  }

  /**
   * Get current limits and stats
   */
  getStats(): {
    limits: AdaptiveLimits;
    usage: {
      currentSecond: number;
      currentMinute: number;
      currentDay: number;
    };
    systemLoad: SystemLoad;
    averageLatency: number;
    errorRate: number;
  } {
    const recentRequests = this.requestHistory.filter(
      r => Date.now() - r.timestamp < 60000
    );

    const avgLatency = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.latency, 0) / recentRequests.length
      : 0;

    const errors = recentRequests.filter(r => !r.success).length;
    const errorRate = recentRequests.length > 0
      ? (errors / recentRequests.length) * 100
      : 0;

    return {
      limits: this.adaptiveLimits,
      usage: {
        currentSecond: this.currentSecond,
        currentMinute: this.currentMinute,
        currentDay: this.currentDay
      },
      systemLoad: this.systemLoad,
      averageLatency: Math.round(avgLatency),
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    
    const start = Date.now();
    try {
      const result = await fn();
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error: any) {
      this.recordFailure(error.message || 'Unknown', Date.now() - start);
      throw error;
    }
  }

  private recordRequestStart(): void {
    this.currentSecond++;
    this.currentMinute++;
    this.currentDay++;
    this.systemLoad.activeRequests++;
  }

  private resetCountersIfNeeded(): void {
    const now = Date.now();

    // Reset second counter
    if (now - this.lastSecondReset >= 1000) {
      this.currentSecond = 0;
      this.adaptiveLimits.currentBurst = this.config.burstSize;
      this.lastSecondReset = now;
    }

    // Reset minute counter
    if (now - this.lastMinuteReset >= 60000) {
      this.currentMinute = 0;
      this.lastMinuteReset = now;
    }

    // Reset day counter
    if (now - this.lastDayReset >= 86400000) {
      this.currentDay = 0;
      this.lastDayReset = now;
    }
  }

  private trimHistory(): void {
    // Keep only last 10 minutes of history
    const cutoff = Date.now() - 600000;
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
  }

  private handleError(errorType: string): void {
    // Reduce limits on errors
    if (errorType.includes('rate limit') || errorType.includes('429')) {
      // Aggressive backoff for rate limit errors
      this.adaptiveLimits.requestsPerSecond = Math.max(
        1,
        Math.floor(this.adaptiveLimits.requestsPerSecond * 0.5)
      );
      this.adaptiveLimits.requestsPerMinute = Math.max(
        10,
        Math.floor(this.adaptiveLimits.requestsPerMinute * 0.7)
      );
    } else if (errorType.includes('timeout')) {
      // Moderate backoff for timeouts
      this.adaptiveLimits.requestsPerSecond = Math.max(
        2,
        this.adaptiveLimits.requestsPerSecond - 1
      );
    }
  }

  private startAdaptiveLoop(): void {
    // Adjust limits every 30 seconds based on performance
    setInterval(() => {
      this.adjustLimits();
    }, 30000);
  }

  private adjustLimits(): void {
    const recentRequests = this.requestHistory.filter(
      r => Date.now() - r.timestamp < 60000
    );

    if (recentRequests.length < 10) return;

    const successRate = recentRequests.filter(r => r.success).length / recentRequests.length;
    const avgLatency = recentRequests.reduce((sum, r) => sum + r.latency, 0) / recentRequests.length;

    // Increase limits if performing well
    if (successRate > 0.99 && avgLatency < 500) {
      this.adaptiveLimits.requestsPerSecond = Math.min(
        this.config.baseRequestsPerSecond * 1.5,
        this.adaptiveLimits.requestsPerSecond + 1
      );
      this.adaptiveLimits.requestsPerMinute = Math.min(
        this.config.baseRequestsPerMinute * 1.2,
        this.adaptiveLimits.requestsPerMinute + 10
      );
    }

    // Decrease limits if system is under load
    if (this.systemLoad.cpuUsage > 80 || this.systemLoad.memoryUsage > 90) {
      this.adaptiveLimits.requestsPerSecond = Math.max(
        1,
        Math.floor(this.adaptiveLimits.requestsPerSecond * 0.8)
      );
    }

    // Decrease limits if queue is backing up
    if (this.systemLoad.queueDepth > 10) {
      this.adaptiveLimits.requestsPerSecond = Math.max(
        1,
        this.adaptiveLimits.requestsPerSecond - 2
      );
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const check = this.canMakeRequest();
      if (!check.allowed) break;

      const request = this.queue.shift();
      if (request) {
        this.systemLoad.queueDepth--;
        request();
      }
    }
  }

  private getSecondsUntilTomorrow(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
  }

  private getSecondsUntilNextMinute(): number {
    return 60 - new Date().getSeconds();
  }
}

// Export singleton
export const adaptiveRateLimiter = new AdaptiveRateLimiter();

// Export class
export { AdaptiveRateLimiter };

/**
 * Decorator for rate-limited methods
 */
export function rateLimited(
  options: Partial<RateLimitConfig> = {}
) {
  const limiter = new AdaptiveRateLimiter(options);

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return limiter.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
