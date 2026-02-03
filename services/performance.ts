/**
 * Performance Optimization Service
 * Manages caching, debouncing, and batching for efficient operation
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
}

class PerformanceOptimizer {
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private pendingBatch: Map<string, any[]> = new Map();
  private batchTimers: Map<string, number> = new Map();

  // ==================== SMART CACHE ====================

  /**
   * Get or create a named cache
   */
  private getCache(name: string): Map<string, CacheEntry<any>> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
    }
    return this.caches.get(name)!;
  }

  /**
   * Get cached value with automatic expiration
   */
  get<T>(cacheName: string, key: string, maxAgeMs: number = 60000): T | null {
    const cache = this.getCache(cacheName);
    const entry = cache.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() - entry.timestamp > maxAgeMs) {
      cache.delete(key);
      return null;
    }
    
    // Track hit for LRU
    entry.hits++;
    return entry.value;
  }

  /**
   * Set cached value with LRU eviction
   */
  set<T>(cacheName: string, key: string, value: T, maxSize: number = 100): void {
    const cache = this.getCache(cacheName);
    
    // Evict oldest if at capacity
    if (cache.size >= maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      cache.forEach((entry, k) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      });
      
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    
    cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Clear specific cache or all caches
   */
  clear(cacheName?: string): void {
    if (cacheName) {
      this.caches.delete(cacheName);
    } else {
      this.caches.clear();
    }
  }

  // ==================== DEBOUNCING ====================

  /**
   * Create a debounced function
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    waitMs: number,
    immediate: boolean = false
  ): DebouncedFunction<T> {
    let timeoutId: number | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastResult: ReturnType<T> | undefined;

    const debounced = (...args: Parameters<T>) => {
      lastArgs = args;
      
      const callNow = immediate && !timeoutId;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        if (!immediate && lastArgs) {
          lastResult = fn(...lastArgs);
        }
      }, waitMs);
      
      if (callNow) {
        lastResult = fn(...args);
      }
      
      return lastResult;
    };

    debounced.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastArgs = null;
    };

    debounced.flush = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (lastArgs) {
        lastResult = fn(...lastArgs);
        lastArgs = null;
      }
      return lastResult;
    };

    return debounced as DebouncedFunction<T>;
  }

  // ==================== THROTTLING ====================

  /**
   * Create a throttled function
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T,
    limitMs: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let pendingArgs: Parameters<T> | null = null;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
          if (pendingArgs) {
            fn(...pendingArgs);
            pendingArgs = null;
          }
        }, limitMs);
      } else {
        pendingArgs = args;
      }
    };
  }

  // ==================== BATCHING ====================

  /**
   * Batch multiple calls into a single execution
   */
  batch<T>(
    key: string,
    item: T,
    processor: (items: T[]) => void,
    delayMs: number = 50
  ): void {
    // Add to pending batch
    if (!this.pendingBatch.has(key)) {
      this.pendingBatch.set(key, []);
    }
    this.pendingBatch.get(key)!.push(item);

    // Clear existing timer
    if (this.batchTimers.has(key)) {
      clearTimeout(this.batchTimers.get(key)!);
    }

    // Set new timer
    const timerId = window.setTimeout(() => {
      const items = this.pendingBatch.get(key);
      if (items && items.length > 0) {
        this.pendingBatch.delete(key);
        processor(items);
      }
      this.batchTimers.delete(key);
    }, delayMs);

    this.batchTimers.set(key, timerId);
  }

  // ==================== MEMOIZATION ====================

  /**
   * Memoize a function with cache size limit
   */
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    maxSize: number = 100
  ): T {
    const cache = new Map<string, CacheEntry<ReturnType<T>>>();
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      const cached = cache.get(key);
      if (cached) {
        cached.hits++;
        cached.timestamp = Date.now();
        return cached.value;
      }
      
      // Evict oldest if needed
      if (cache.size >= maxSize) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        
        cache.forEach((entry, k) => {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = k;
          }
        });
        
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }
      
      const result = fn(...args);
      cache.set(key, {
        value: result,
        timestamp: Date.now(),
        hits: 0
      });
      
      return result;
    }) as T;
  }

  // ==================== PERFORMANCE MONITORING ====================

  private metrics: Map<string, number[]> = new Map();

  /**
   * Measure execution time of a function
   */
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.get(name)!.length > 100) {
      this.metrics.get(name)!.shift();
    }
    
    return result;
  }

  /**
   * Get performance stats
   */
  getStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    this.metrics.forEach((times, name) => {
      if (times.length > 0) {
        stats[name] = {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    });
    
    return stats;
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}

export const optimizer = new PerformanceOptimizer();
