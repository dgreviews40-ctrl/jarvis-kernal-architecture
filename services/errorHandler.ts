/**
 * Global Error Handler Service
 * 
 * Centralized error handling with:
 * - Retry mechanisms with exponential backoff
 * - Error classification and prioritization
 * - Graceful degradation
 * - User notifications
 */

import { logger } from './logger';
import { cortex } from './cortex';
import { HealthEventType, ImpactLevel } from '../types';

// Error classification
export type ErrorCategory = 
  | 'network'           // Network/connection errors
  | 'timeout'           // Timeout errors
  | 'auth'              // Authentication errors
  | 'permission'        // Permission denied
  | 'validation'        // Input validation
  | 'runtime'           // Runtime JavaScript errors
  | 'resource'          // Resource not found
  | 'unknown';          // Unknown errors

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['network', 'timeout', 'resource']
};

// Error state tracking
const errorCounts = new Map<string, number>();
const errorTimestamps = new Map<string, number[]>();
const degradedFeatures = new Set<string>();

/**
 * Classify an error into a category
 */
export function classifyError(error: Error): ErrorCategory {
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
  if (message.includes('reference') || message.includes('undefined') || message.includes('null')) {
    return 'runtime';
  }
  
  return 'unknown';
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: Error, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  const category = classifyError(error);
  return config.retryableErrors.includes(category);
}

/**
 * Calculate delay for retry attempt
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const operationKey = `${context.component}:${context.operation}`;
  
  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Clear error count on success
      if (attempt > 1) {
        errorCounts.delete(operationKey);
        logger.info('ERROR_HANDLER', `${operationKey} succeeded after ${attempt} attempts`);
      }
      
      return result;
    } catch (error) {
      const err = error as Error;
      const category = classifyError(err);
      
      // Log the error
      logger.warning('ERROR_HANDLER', `${operationKey} failed (attempt ${attempt}/${fullConfig.maxAttempts})`, {
        error: err.message,
        category,
        attempt
      });
      
      // Track error
      trackError(operationKey, err);
      
      // Check if we should retry
      if (attempt < fullConfig.maxAttempts && isRetryable(err, fullConfig)) {
        const delay = calculateRetryDelay(attempt, fullConfig);
        logger.info('ERROR_HANDLER', `Retrying ${operationKey} in ${delay}ms`);
        await sleep(delay);
      } else {
        // Final attempt failed
        handleFinalError(err, context);
        throw error;
      }
    }
  }
  
  throw new Error(`${operationKey} failed after ${fullConfig.maxAttempts} attempts`);
}

/**
 * Execute a function with graceful degradation
 */
export async function withDegradation<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: ErrorContext,
  featureName: string
): Promise<T> {
  // Check if feature is already degraded
  if (degradedFeatures.has(featureName)) {
    logger.info('ERROR_HANDLER', `Using degraded mode for ${featureName}`);
    return fallback;
  }
  
  try {
    return await operation();
  } catch (error) {
    const err = error as Error;
    
    logger.error('ERROR_HANDLER', `${featureName} failed, degrading to fallback`, {
      error: err.message,
      context
    });
    
    // Mark feature as degraded
    degradedFeatures.add(featureName);
    
    // Report to cortex
    cortex.reportEvent({
      sourceId: context.component || 'unknown',
      type: HealthEventType.ERROR,
      impact: ImpactLevel.MEDIUM,
      latencyMs: 0,
      context: {
        operation: context.operation,
        error: err.message,
        degradedFeature: featureName
      }
    });
    
    // Notify user
    notifyUser('warning', `${featureName} is running in limited mode. Some features may be unavailable.`);
    
    return fallback;
  }
}

/**
 * Track error for rate limiting and circuit breaking
 */
function trackError(key: string, error: Error): void {
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
      timeWindow: '5 minutes'
    });
  }
}

/**
 * Handle final error after all retries exhausted
 */
function handleFinalError(error: Error, context: ErrorContext): void {
  const category = classifyError(error);
  
  logger.error('ERROR_HANDLER', `Final error in ${context.operation}`, {
    error: error.message,
    category,
    context
  });
  
  // Report to cortex
  cortex.reportEvent({
    sourceId: context.component || 'unknown',
    type: HealthEventType.ERROR,
    impact: category === 'runtime' ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
    latencyMs: 0,
    context: {
      operation: context.operation,
      error: error.message,
      category,
      userId: context.userId
    }
  });
  
  // Show user notification for certain errors
  if (category === 'auth') {
    notifyUser('error', 'Authentication failed. Please check your credentials.');
  } else if (category === 'network') {
    notifyUser('error', 'Network connection failed. Please check your internet connection.');
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
  // Dispatch custom event for UI to handle
  window.dispatchEvent(new CustomEvent('jarvis-notification', {
    detail: { type, message, timestamp: Date.now() }
  }));
  
  // Also log
  logger.log('NOTIFICATION', message, type);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Global error event listener
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('GLOBAL', 'Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('GLOBAL', 'Unhandled promise rejection', {
      reason: event.reason?.message || event.reason
    });
  });
}
