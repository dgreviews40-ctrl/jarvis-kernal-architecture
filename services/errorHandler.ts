/**
 * Global Error Handler Service v2
 * 
 * Centralized error handling with:
 * - Structured error types (JARVISError hierarchy)
 * - Smart retry mechanisms with error-specific strategies
 * - Graceful degradation
 * - User notifications
 * - Error tracking and reporting
 */

import { logger } from './logger';
import { cortex } from './cortex';
import { HealthEventType, ImpactLevel } from '../types';
import {
  JARVISError,
  ErrorCode,
  ErrorSeverity,
  RetryStrategy,
  classifyError,
  calculateRetryDelay,
  isRetryableError,
  getRetryStrategy,
  logError,
  NetworkError,
  TimeoutError,
  AuthError,
  QuotaError,
  ValidationError
} from './errorTypes';

// Re-export error types for convenience
export {
  JARVISError,
  ErrorCode,
  ErrorSeverity,
  NetworkError,
  TimeoutError,
  AuthError,
  QuotaError,
  ValidationError,
  PluginError,
  SecurityError,
  classifyError,
  calculateRetryDelay,
  isRetryableError,
  getRetryStrategy,
  logError
} from './errorTypes';

/** Legacy error category - maintained for backward compatibility */
export type ErrorCategory =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'runtime'
  | 'resource'
  | 'quota'
  | 'unknown';

/** Operation context for error handling */
export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/** Enhanced retry configuration */
export interface RetryConfig extends RetryStrategy {
  /** Custom error classifier */
  errorClassifier?: (error: unknown) => JARVISError;
  /** Called before each retry attempt */
  onRetry?: (error: JARVISError, attempt: number, nextDelay: number) => void;
  /** Called when all retries exhausted */
  onFailed?: (error: JARVISError, attempts: number) => void;
}

/** Default retry configuration (uses error-specific strategy) */
export const DEFAULT_RETRY_CONFIG: Partial<RetryConfig> = {
  useJitter: true
};

/** Error state tracking */
const errorCounts = new Map<string, number>();
const errorTimestamps = new Map<string, number[]>();
const degradedFeatures = new Set<string>();

/**
 * Legacy error classifier - maps to ErrorCategory
 * @deprecated Use classifyError() from errorTypes.ts instead
 */
export function classifyErrorLegacy(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
    return 'auth';
  }
  if (message.includes('permission') || message.includes('access denied')) {
    return 'permission';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'resource';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('rate limit') || message.includes('quota')) {
    return 'quota';
  }
  if (message.includes('reference') || message.includes('undefined') || message.includes('null')) {
    return 'runtime';
  }
  
  return 'unknown';
}

/**
 * Legacy retry check - maintained for backward compatibility
 * @deprecated Use isRetryableError() from errorTypes.ts instead
 */
export function isRetryable(error: Error, config?: { retryableErrors?: ErrorCategory[] }): boolean {
  const category = classifyErrorLegacy(error);
  const retryableCategories = config?.retryableErrors || ['network', 'timeout', 'resource'];
  return retryableCategories.includes(category);
}

/**
 * Legacy delay calculation - maintained for backward compatibility
 * @deprecated Use calculateRetryDelay() from errorTypes.ts instead
 */
export function calculateRetryDelayLegacy(
  attempt: number,
  config: { baseDelay?: number; maxDelay?: number; backoffMultiplier?: number } = {}
): number {
  const baseDelay = config.baseDelay ?? 1000;
  const maxDelay = config.maxDelay ?? 10000;
  const backoffMultiplier = config.backoffMultiplier ?? 2;
  
  const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Execute a function with intelligent retry logic based on error type
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const operationKey = `${context.component}:${context.operation}`;
  let lastError: JARVISError | undefined;
  let attempt = 0;

  try {
    return await operation();
  } catch (error) {
    // Classify the error
    lastError = config.errorClassifier 
      ? config.errorClassifier(error)
      : classifyError(error, { operation: operationKey, ...context.metadata });

    // Get retry strategy from error type, merged with config
    const strategy: RetryStrategy = {
      ...lastError.retryStrategy,
      ...config
    };

    // If not retryable, fail fast
    if (!strategy.retryable) {
      logError(lastError, operationKey);
      handleFinalError(lastError, context);
      throw lastError;
    }

    // Attempt retries
    for (attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      const delay = calculateRetryDelay(lastError, attempt);
      
      if (delay < 0) {
        break; // No more retries
      }

      logger.warning('ERROR_HANDLER', `${operationKey} failed (attempt ${attempt}/${strategy.maxAttempts}), retrying in ${delay}ms`, {
        error: lastError.message,
        code: lastError.code,
        isRetryable: true
      });

      // Callback before retry
      config.onRetry?.(lastError, attempt, delay);

      // Wait before retry
      await sleep(delay);

      try {
        const result = await operation();
        
        // Success after retry
        logger.info('ERROR_HANDLER', `${operationKey} succeeded after ${attempt} retry attempts`, {
          code: lastError.code,
          attempts: attempt
        });
        
        // Clear error tracking
        errorCounts.delete(operationKey);
        
        return result;
      } catch (retryError) {
        lastError = config.errorClassifier
          ? config.errorClassifier(retryError)
          : classifyError(retryError, { operation: operationKey, ...context.metadata });

        // Track the error
        trackError(operationKey, lastError);
      }
    }

    // All retries exhausted
    logError(lastError, operationKey);
    config.onFailed?.(lastError, attempt);
    handleFinalError(lastError, context);
    throw lastError;
  }
}

/**
 * Execute a function with fallback on failure
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T | Promise<T>),
  context: ErrorContext,
  options?: {
    featureName?: string;
    logFailure?: boolean;
  }
): Promise<T> {
  const featureName = options?.featureName || context.operation;

  // Check if feature is already degraded
  if (degradedFeatures.has(featureName)) {
    logger.info('ERROR_HANDLER', `Using degraded mode for ${featureName}`);
    return typeof fallback === 'function' ? await (fallback as () => Promise<T>)() : fallback;
  }

  try {
    return await operation();
  } catch (error) {
    const jarvisError = classifyError(error, { 
      operation: context.operation,
      component: context.component 
    });

    if (options?.logFailure !== false) {
      logger.warning('ERROR_HANDLER', `${featureName} failed, using fallback`, {
        error: jarvisError.message,
        code: jarvisError.code,
        severity: jarvisError.severity
      });
    }

    // Mark feature as degraded if it's a persistent error
    if (jarvisError.severity === ErrorSeverity.ERROR || jarvisError.severity === ErrorSeverity.FATAL) {
      degradedFeatures.add(featureName);
      
      // Report to cortex
      cortex.reportEvent({
        sourceId: context.component || 'unknown',
        type: HealthEventType.ERROR,
        impact: jarvisError.severity === ErrorSeverity.FATAL ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        latencyMs: 0,
        context: {
          operation: context.operation,
          error: jarvisError.message,
          code: jarvisError.code,
          degradedFeature: featureName
        }
      });

      // Notify user for certain errors
      if (jarvisError instanceof AuthError) {
        notifyUser('error', 'Authentication failed. Please check your credentials.');
      } else if (jarvisError instanceof NetworkError) {
        notifyUser('warning', 'Network connection issue. Running in limited mode.');
      } else if (jarvisError instanceof QuotaError) {
        notifyUser('warning', 'API quota exceeded. Some features may be limited.');
      }
    }

    return typeof fallback === 'function' ? await (fallback as () => Promise<T>)() : fallback;
  }
}

/**
 * Execute with both retry and fallback
 */
export async function withResilience<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T | Promise<T>),
  context: ErrorContext,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  try {
    return await withRetry(operation, context, retryConfig);
  } catch (error) {
    return withFallback(
      () => Promise.reject(error), // Already failed, this won't be called
      fallback,
      context
    );
  }
}

/**
 * Track error for rate limiting and circuit breaking
 */
function trackError(key: string, error: JARVISError): void {
  const now = Date.now();
  
  // Update error count
  const currentCount = errorCounts.get(key) || 0;
  errorCounts.set(key, currentCount + 1);
  
  // Update timestamps
  const timestamps = errorTimestamps.get(key) || [];
  timestamps.push(now);
  
  // Keep only last 5 minutes
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const recentTimestamps = timestamps.filter(t => t > fiveMinutesAgo);
  errorTimestamps.set(key, recentTimestamps);
  
  // Check for error threshold
  if (recentTimestamps.length >= 10) {
    logger.error('ERROR_HANDLER', `Error threshold exceeded for ${key}`, {
      errorCount: recentTimestamps.length,
      timeWindow: '5 minutes',
      lastError: error.code
    });
  }
}

/**
 * Handle final error after all retries exhausted
 */
function handleFinalError(error: JARVISError, context: ErrorContext): void {
  // Report to cortex
  cortex.reportEvent({
    sourceId: context.component || 'unknown',
    type: HealthEventType.ERROR,
    impact: error.severity === ErrorSeverity.FATAL ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
    latencyMs: 0,
    context: {
      operation: context.operation,
      error: error.message,
      code: error.code,
      severity: error.severity,
      userId: context.userId,
      ...error.context
    }
  });

  // Show user notification for certain errors
  if (error instanceof AuthError) {
    notifyUser('error', 'Authentication failed. Please check your API credentials in settings.');
  } else if (error instanceof NetworkError && error.code === ErrorCode.SSL_CERTIFICATE_ERROR) {
    notifyUser('error', 'SSL certificate error. Please check your system clock and network security.');
  }
}

/**
 * Check if a feature should be degraded based on error rate
 */
export function shouldDegrade(featureName: string): boolean {
  return degradedFeatures.has(featureName);
}

/**
 * Reset degraded state for a feature
 */
export function resetDegradation(featureName: string): void {
  degradedFeatures.delete(featureName);
  logger.info('ERROR_HANDLER', `Reset degradation for ${featureName}`);
}

/**
 * Get error statistics
 */
export function getErrorStats(): {
  totalErrors: number;
  errorsByOperation: Record<string, number>;
  degradedFeatures: string[];
} {
  const errorsByOperation: Record<string, number> = {};
  errorCounts.forEach((count, key) => {
    errorsByOperation[key] = count;
  });
  
  return {
    totalErrors: Array.from(errorCounts.values()).reduce((a, b) => a + b, 0),
    errorsByOperation,
    degradedFeatures: Array.from(degradedFeatures)
  };
}

/**
 * Clear all error tracking
 */
export function clearErrorTracking(): void {
  errorCounts.clear();
  errorTimestamps.clear();
  degradedFeatures.clear();
}

/**
 * User notification helper
 */
function notifyUser(type: 'error' | 'warning' | 'info', message: string): void {
  window.dispatchEvent(new CustomEvent('jarvis-notification', {
    detail: { type, message, timestamp: Date.now() }
  }));
  
  logger.log('NOTIFICATION', message, type);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified duration
 */
export function createTimeoutPromise<T>(
  ms: number,
  context?: string
): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(
        `Operation timed out after ${ms}ms`,
        ms,
        ErrorCode.CONNECTION_TIMEOUT,
        context ? { context } : undefined
      ));
    }, ms);
  });
}

/**
 * Race between an operation and a timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context?: ErrorContext
): Promise<T> {
  return Promise.race([
    operation(),
    createTimeoutPromise<T>(timeoutMs, context?.operation)
  ]);
}

// Global error event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const error = classifyError(
      event.error || new Error(event.message),
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );
    
    logger.error('GLOBAL', 'Uncaught error', error.toJSON());
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    const error = classifyError(
      event.reason,
      { type: 'unhandledrejection' }
    );
    
    logger.error('GLOBAL', 'Unhandled promise rejection', error.toJSON());
  });
}
