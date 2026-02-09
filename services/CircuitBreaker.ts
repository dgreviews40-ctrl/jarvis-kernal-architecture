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
  /** Enable jitter to prevent thundering herd (default: true) */
  enableJitter?: boolean;
  /** Maximum jitter in ms (default: 5000) */
  maxJitterMs?: number;
}

export class EnhancedCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCountInHalfOpen = 0;
  private nextAttemptTime: number | null = null; // Tracks when circuit can transition from OPEN
  
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly timeout: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly enableJitter: boolean;
  private readonly maxJitterMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000; // 1 minute
    this.timeout = options.timeout ?? 10000; // 10 seconds
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 1;
    this.enableJitter = options.enableJitter ?? true;
    this.maxJitterMs = options.maxJitterMs ?? 5000;
  }

  async call<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (this.state === 'OPEN') {
      const now = Date.now();
      // Use nextAttemptTime for deterministic state transition (avoids Date.now() drift issues)
      const canAttempt = this.nextAttemptTime && now >= this.nextAttemptTime;
      
      if (canAttempt) {
        console.log('Circuit breaker transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
        this.successCountInHalfOpen = 0;
      } else {
        const retryAfter = this.nextAttemptTime ? Math.ceil((this.nextAttemptTime - now) / 1000) : 'unknown';
        throw new Error(`Circuit breaker is OPEN - service temporarily unavailable. Retry after: ${retryAfter}s`);
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
    let timeoutId: NodeJS.Timeout | undefined;

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
      // Failure in HALF_OPEN state sends us back to OPEN with jitter
      console.log('Circuit breaker failure in HALF_OPEN state, returning to OPEN');
      this.transitionToOpen();
    } else if (this.failureCount >= this.failureThreshold) {
      console.log('Circuit breaker threshold exceeded, transitioning to OPEN');
      this.transitionToOpen();
    }
  }

  /**
   * Transition to OPEN state with jitter to prevent thundering herd
   */
  private transitionToOpen(): void {
    this.state = 'OPEN';
    
    // Calculate next attempt time with optional jitter
    // Jitter prevents multiple clients from retrying simultaneously
    const jitter = this.enableJitter ? Math.random() * this.maxJitterMs : 0;
    this.nextAttemptTime = Date.now() + this.resetTimeout + jitter;
    
    if (this.enableJitter && jitter > 0) {
      console.log(`Circuit breaker OPEN - will retry at ${new Date(this.nextAttemptTime).toLocaleTimeString()} (+${Math.round(jitter)}ms jitter)`);
    }
  }

  public getState() {
    const now = Date.now();
    const canAttemptFromOpen = this.state === 'OPEN' && this.nextAttemptTime && now >= this.nextAttemptTime;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      canAttemptCall: this.state !== 'OPEN' || canAttemptFromOpen,
      retryAfterMs: this.state === 'OPEN' && this.nextAttemptTime ? Math.max(0, this.nextAttemptTime - now) : 0
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCountInHalfOpen = 0;
  }

  public forceOpen(): void {
    this.transitionToOpen();
  }
}