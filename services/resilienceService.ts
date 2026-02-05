/**
 * Enhanced Error Handling & Resilience Service for JARVIS Kernel v1.3
 * 
 * Implements advanced error handling features:
 * - Circuit breakers for external API calls
 * - Retry mechanisms with exponential backoff
 * - Better fallback strategies
 */

import { logger } from './logger';
import { eventBus } from './eventBus';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time in ms before attempting reset
  timeout: number; // Operation timeout in ms
  fallback?: (...args: any[]) => any; // Fallback function
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  nextAttempt: number | null;
}

export class ResilienceService {
  private static instance: ResilienceService;
  private circuitBreakers: Map<string, CircuitBreakerStatus> = new Map();
  private breakerConfigs: Map<string, CircuitBreakerConfig> = new Map();

  private constructor() {}

  public static getInstance(): ResilienceService {
    if (!ResilienceService.instance) {
      ResilienceService.instance = new ResilienceService();
    }
    return ResilienceService.instance;
  }

  /**
   * Wrap a function with circuit breaker protection
   */
  public async withCircuitBreaker<T>(
    operationId: string,
    operation: (...args: any[]) => Promise<T>,
    config: CircuitBreakerConfig,
    ...args: any[]
  ): Promise<T> {
    // Store config if not already present
    if (!this.breakerConfigs.has(operationId)) {
      this.breakerConfigs.set(operationId, config);
    }

    const status = this.getCircuitStatus(operationId);
    
    // Check if circuit is open
    if (status.state === CircuitState.OPEN) {
      if (Date.now() >= (status.nextAttempt || 0)) {
        // Attempt reset - move to half-open state
        this.setCircuitState(operationId, CircuitState.HALF_OPEN);
        logger.log('SYSTEM', `Circuit breaker ${operationId} moved to HALF_OPEN`, 'info');
      } else {
        // Still in open state, return fallback or throw
        if (config.fallback) {
          logger.log('SYSTEM', `Circuit breaker ${operationId} OPEN, using fallback`, 'warning');
          return config.fallback(...args);
        } else {
          throw new Error(`Circuit breaker ${operationId} is OPEN`);
        }
      }
    }

    try {
      // Execute operation
      const result = await operation(...args);
      
      // On success, update circuit state
      if (status.state === CircuitState.HALF_OPEN) {
        // Success in half-open state means circuit is healthy again
        this.resetCircuit(operationId);
        logger.log('SYSTEM', `Circuit breaker ${operationId} reset after success`, 'info');
      } else {
        // Increment success counter
        this.incrementSuccess(operationId);
      }
      
      return result;
    } catch (error) {
      // On failure, update circuit state
      this.incrementFailure(operationId);
      
      // Check if we should open the circuit
      const currentStatus = this.getCircuitStatus(operationId);
      const config = this.breakerConfigs.get(operationId)!;
      
      if (currentStatus.failures >= config.failureThreshold) {
        this.openCircuit(operationId);
        logger.log('SYSTEM', `Circuit breaker ${operationId} OPENED after ${currentStatus.failures} failures`, 'error');
      }
      
      // Use fallback if available
      if (config.fallback) {
        logger.log('SYSTEM', `Using fallback for ${operationId} after error: ${error.message}`, 'warning');
        return config.fallback(...args);
      }
      
      throw error;
    }
  }

  /**
   * Execute an operation with retry and exponential backoff
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000, // Base delay in ms
    maxDelay: number = 30000, // Max delay in ms
    shouldRetry?: (error: any) => boolean // Custom retry condition
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === maxRetries) {
          break; // Last attempt, don't retry
        }
        
        if (shouldRetry && !shouldRetry(error)) {
          break; // Custom condition says don't retry
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);
        
        logger.log('SYSTEM', `Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms delay`, 'info');
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Execute an operation with timeout
   */
  public async withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Execute an operation with circuit breaker, retry, and timeout
   */
  public async withResilience<T>(
    operationId: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig,
    retryOptions?: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      shouldRetry?: (error: any) => boolean;
    }
  ): Promise<T> {
    // Wrap operation with timeout
    const timeoutWrapped = () => this.withTimeout(
      operation, 
      config.timeout || 10000
    );
    
    // Wrap with retry if options provided
    const retryWrapped = retryOptions ? 
      () => this.withRetry(
        timeoutWrapped,
        retryOptions.maxRetries,
        retryOptions.baseDelay,
        retryOptions.maxDelay,
        retryOptions.shouldRetry
      ) :
      timeoutWrapped;
    
    // Wrap with circuit breaker
    return this.withCircuitBreaker(
      operationId,
      retryWrapped,
      config
    );
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitStatus(operationId: string): CircuitBreakerStatus {
    if (!this.circuitBreakers.has(operationId)) {
      this.circuitBreakers.set(operationId, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailure: null,
        nextAttempt: null
      });
    }
    
    return this.circuitBreakers.get(operationId)!;
  }

  /**
   * Force open a circuit breaker
   */
  public openCircuit(operationId: string): void {
    const config = this.breakerConfigs.get(operationId);
    if (!config) {
      throw new Error(`No config found for circuit breaker: ${operationId}`);
    }
    
    this.circuitBreakers.set(operationId, {
      state: CircuitState.OPEN,
      failures: this.circuitBreakers.get(operationId)?.failures || 0,
      successes: 0,
      lastFailure: Date.now(),
      nextAttempt: Date.now() + config.resetTimeout
    });
  }

  /**
   * Reset a circuit breaker to closed state
   */
  public resetCircuit(operationId: string): void {
    this.circuitBreakers.set(operationId, {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailure: null,
      nextAttempt: null
    });
  }

  /**
   * Force close a circuit breaker
   */
  public closeCircuit(operationId: string): void {
    this.circuitBreakers.set(operationId, {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailure: null,
      nextAttempt: null
    });
  }

  /**
   * Set circuit breaker state
   */
  private setCircuitState(operationId: string, state: CircuitState): void {
    const current = this.getCircuitStatus(operationId);
    this.circuitBreakers.set(operationId, {
      ...current,
      state
    });
  }

  /**
   * Increment failure counter
   */
  private incrementFailure(operationId: string): void {
    const current = this.getCircuitStatus(operationId);
    this.circuitBreakers.set(operationId, {
      ...current,
      failures: current.failures + 1,
      lastFailure: Date.now()
    });
  }

  /**
   * Increment success counter
   */
  private incrementSuccess(operationId: string): void {
    const current = this.getCircuitStatus(operationId);
    this.circuitBreakers.set(operationId, {
      ...current,
      successes: current.successes + 1,
      failures: 0 // Reset failures on success
    });
  }

  /**
   * Get all circuit breaker statuses
   */
  public getAllCircuitStatuses(): Map<string, CircuitBreakerStatus> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Bulk reset circuits that are ready
   */
  public resetReadyCircuits(): void {
    for (const [id, status] of this.circuitBreakers.entries()) {
      if (status.state === CircuitState.OPEN && status.nextAttempt && Date.now() >= status.nextAttempt) {
        this.resetCircuit(id);
        logger.log('SYSTEM', `Automatically reset circuit: ${id}`, 'info');
      }
    }
  }

  /**
   * Get resilience statistics
   */
  public getStats(): { 
    totalCircuits: number; 
    openCircuits: number; 
    halfOpenCircuits: number; 
    closedCircuits: number 
  } {
    const statuses = Array.from(this.circuitBreakers.values());
    
    return {
      totalCircuits: statuses.length,
      openCircuits: statuses.filter(s => s.state === CircuitState.OPEN).length,
      halfOpenCircuits: statuses.filter(s => s.state === CircuitState.HALF_OPEN).length,
      closedCircuits: statuses.filter(s => s.state === CircuitState.CLOSED).length
    };
  }
}

// Export singleton instance
export const resilienceService = ResilienceService.getInstance();

// Initialize resilience service when module loads
logger.log('SYSTEM', 'Resilience service initialized', 'info');

// Periodically reset ready circuits
setInterval(() => {
  resilienceService.resetReadyCircuits();
}, 10000); // Check every 10 seconds