/**
 * Enhanced Circuit Breaker Implementation for JARVIS
 * Provides resilience for external service calls
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  timeout?: number;
  halfOpenSuccessThreshold?: number;
}

export class EnhancedCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCountInHalfOpen = 0;
  
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly timeout: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000; // 1 minute
    this.timeout = options.timeout ?? 10000; // 10 seconds
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 1;
  }

  async call<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
        console.log('Circuit breaker transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
        this.successCountInHalfOpen = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      // Use provided timeout if given, otherwise use circuit breaker default
      const effectiveTimeout = timeoutMs ?? this.timeout;
      const result = await this.withTimeout(fn(), effectiveTimeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCountInHalfOpen++;
      if (this.successCountInHalfOpen >= this.halfOpenSuccessThreshold) {
        console.log('Circuit breaker transitioning to CLOSED after successful calls');
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCountInHalfOpen = 0;
      }
    } else {
      // In CLOSED state, just reset failure count
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      // Failure in HALF_OPEN state sends us back to OPEN
      console.log('Circuit breaker failure in HALF_OPEN state, returning to OPEN');
      this.state = 'OPEN';
    } else if (this.failureCount >= this.failureThreshold) {
      console.log('Circuit breaker threshold exceeded, transitioning to OPEN');
      this.state = 'OPEN';
    }
  }

  public getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      canAttemptCall: this.state !== 'OPEN' || (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout)
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCountInHalfOpen = 0;
  }

  public forceOpen(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }
}