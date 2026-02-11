/**
 * Safe Utility Functions
 * 
 * Provides safe versions of common operations with proper error handling:
 * - Safe JSON parse/stringify
 * - Safe localStorage operations
 * - Safe fetch with timeout and retry
 */

import { logger } from './logger';

export interface SafeParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SafeStorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  quotaExceeded?: boolean;
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue?: T): SafeParseResult<T> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
    logger.warning('SYSTEM', 'JSON parse failed', { error: errorMessage, preview: json.substring(0, 100) });
    return { 
      success: false, 
      error: errorMessage,
      data: defaultValue 
    };
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function safeJsonStringify(data: unknown, defaultValue = '{}'): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown stringify error';
    logger.warning('SYSTEM', 'JSON stringify failed', { error: errorMessage });
    return defaultValue;
  }
}

/**
 * Safely get item from localStorage with quota check
 */
export function safeLocalStorageGet<T>(key: string): SafeStorageResult<T> {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return { success: true, data: undefined as T };
    }
    return safeJsonParse<T>(item);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Safely set item to localStorage with quota handling
 */
export function safeLocalStorageSet(key: string, value: unknown): SafeStorageResult<void> {
  try {
    const serialized = safeJsonStringify(value);
    localStorage.setItem(key, serialized);
    return { success: true };
  } catch (error) {
    const isQuotaExceeded = error instanceof DOMException && 
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (isQuotaExceeded) {
      logger.warning('SYSTEM', `localStorage quota exceeded for key: ${key}`, {
        key,
        approximateSize: safeJsonStringify(value).length
      });
    } else {
      logger.warning('SYSTEM', `localStorage set failed for key: ${key}`, { error: errorMessage });
    }
    
    return { 
      success: false, 
      error: errorMessage,
      quotaExceeded: isQuotaExceeded 
    };
  }
}

/**
 * Safely remove item from localStorage
 */
export function safeLocalStorageRemove(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    logger.warning('SYSTEM', `localStorage remove failed for key: ${key}`, { error });
    return false;
  }
}

/**
 * Estimate localStorage usage
 */
export function estimateLocalStorageUsage(): { used: number; remaining: number; percentage: number } {
  try {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        used += key.length + value.length;
      }
    }
    
    // Estimate total available (typically 5-10MB, using 5MB as conservative)
    const estimatedTotal = 5 * 1024 * 1024;
    const remaining = Math.max(0, estimatedTotal - used);
    const percentage = (used / estimatedTotal) * 100;
    
    return { used, remaining, percentage };
  } catch (error) {
    logger.warning('SYSTEM', 'Failed to estimate localStorage usage', { error });
    return { used: 0, remaining: 0, percentage: 0 };
  }
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely access nested object properties
 */
export function safeGet<T>(obj: any, path: string, defaultValue?: T): T | undefined {
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result !== undefined ? result : defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Safely execute a function with error handling
 */
export function safeExecute<T>(fn: () => T, defaultValue?: T, context?: string): T | undefined {
  try {
    return fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warning('SYSTEM', `Safe execute failed${context ? ` (${context})` : ''}`, { error: errorMessage });
    return defaultValue;
  }
}

/**
 * Safely execute an async function with error handling
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>, 
  defaultValue?: T, 
  context?: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warning('SYSTEM', `Safe async execute failed${context ? ` (${context})` : ''}`, { error: errorMessage });
    return defaultValue;
  }
}

/**
 * Debounce function with cancellation
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): { call: T; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const call = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return { call, cancel };
}

/**
 * Throttle function with leading/trailing options
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): { call: T; cancel: () => void; flush: () => void } {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const { leading = true, trailing = true } = options;
  
  const call = ((...args: Parameters<T>) => {
    lastArgs = args;
    
    if (!inThrottle) {
      if (leading) {
        fn(...args);
      }
      inThrottle = true;
      
      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (trailing && lastArgs) {
          fn(...lastArgs);
        }
        lastArgs = null;
      }, limit);
    }
  }) as T;
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
    lastArgs = null;
  };
  
  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (trailing && lastArgs) {
      fn(...lastArgs);
    }
    inThrottle = false;
    lastArgs = null;
  };
  
  return { call, cancel, flush };
}

/**
 * Create an abortable timeout
 */
export function createAbortableTimeout(ms: number): { promise: Promise<void>; abort: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  let rejectFn: (reason?: any) => void;
  
  const promise = new Promise<void>((_, reject) => {
    rejectFn = reject;
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);
  });
  
  const abort = () => {
    clearTimeout(timeoutId);
    rejectFn?.(new Error('Timeout aborted'));
  };
  
  return { promise, abort };
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
    onRetry
  } = options;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      onRetry?.(error, attempt);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
