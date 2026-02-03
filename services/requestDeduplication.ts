/**
 * Request Deduplication Service
 * Prevents duplicate in-flight requests by caching promises
 * Dramatically reduces API calls for identical concurrent requests
 */

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
}

interface DeduplicationConfig {
  ttl: number;        // How long to keep completed requests in cache (ms)
  maxSize: number;    // Maximum number of cached requests
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  ttl: 5000,      // 5 seconds default
  maxSize: 100
};

class RequestDeduplicationService {
  private inFlight = new Map<string, InFlightRequest<unknown>>();
  private completed = new Map<string, { result: unknown; timestamp: number }>();
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Execute a function with deduplication
   * If the same key is already in-flight, returns the existing promise
   * If completed recently (within TTL), returns cached result
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number; skipCache?: boolean } = {}
  ): Promise<T> {
    const ttl = options.ttl ?? this.config.ttl;

    // Check completed cache first (unless skipCache)
    if (!options.skipCache) {
      const cached = this.completed.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.result as T;
      }
    }

    // Check if already in-flight
    const existing = this.inFlight.get(key);
    if (existing) {
      existing.subscribers++;
      return existing.promise as Promise<T>;
    }

    // Create new request
    const promise = fn()
      .then(result => {
        // Move to completed cache
        this.completed.set(key, { result, timestamp: Date.now() });
        this.inFlight.delete(key);
        this.enforceMaxSize();
        return result;
      })
      .catch(error => {
        this.inFlight.delete(key);
        throw error;
      });

    this.inFlight.set(key, {
      promise,
      timestamp: Date.now(),
      subscribers: 1
    });

    return promise;
  }

  /**
   * Check if a request is currently in-flight
   */
  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  /**
   * Get the number of subscribers waiting for a request
   */
  getSubscriberCount(key: string): number {
    return this.inFlight.get(key)?.subscribers ?? 0;
  }

  /**
   * Cancel an in-flight request (removes from tracking)
   * Note: Actual cancellation depends on the underlying request supporting it
   */
  cancel(key: string): boolean {
    return this.inFlight.delete(key);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.inFlight.clear();
    this.completed.clear();
  }

  /**
   * Get stats about current deduplication
   */
  getStats(): {
    inFlightCount: number;
    completedCount: number;
    totalSubscribers: number;
  } {
    let totalSubscribers = 0;
    this.inFlight.forEach(req => {
      totalSubscribers += req.subscribers;
    });

    return {
      inFlightCount: this.inFlight.size,
      completedCount: this.completed.size,
      totalSubscribers
    };
  }

  private enforceMaxSize(): void {
    if (this.completed.size > this.config.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.completed.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.config.maxSize);
      toRemove.forEach(([key]) => this.completed.delete(key));
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 30 seconds
    setInterval(() => {
      const now = Date.now();
      
      // Clean up expired completed requests
      for (const [key, entry] of this.completed.entries()) {
        if (now - entry.timestamp > this.config.ttl) {
          this.completed.delete(key);
        }
      }

      // Clean up stale in-flight requests (older than 2 minutes)
      for (const [key, entry] of this.inFlight.entries()) {
        if (now - entry.timestamp > 120000) {
          this.inFlight.delete(key);
        }
      }
    }, 30000);
  }
}

// Export singleton instance
export const requestDeduplication = new RequestDeduplicationService();

// Also export class for custom instances
export { RequestDeduplicationService };

/**
 * Decorator for deduplicating async methods
 * Usage: @deduplicate({ ttl: 10000 })
 */
export function deduplicate(config?: Partial<DeduplicationConfig>) {
  const service = new RequestDeduplicationService(config);
  
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Create key from method name and arguments
      const key = `${propertyKey}:${JSON.stringify(args)}`;
      return service.execute(key, () => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}

/**
 * React hook for deduplicated requests
 */
export function useDeduplicatedRequest<T>(
  key: string,
  fn: () => Promise<T>,
  deps: React.DependencyList = []
): {
  execute: () => Promise<T>;
  isInFlight: boolean;
  subscriberCount: number;
} {
  const [isInFlight, setIsInFlight] = React.useState(false);
  const [subscriberCount, setSubscriberCount] = React.useState(0);

  const execute = React.useCallback(async () => {
    setIsInFlight(true);
    setSubscriberCount(requestDeduplication.getSubscriberCount(key) + 1);
    
    try {
      const result = await requestDeduplication.execute(key, fn);
      return result;
    } finally {
      setIsInFlight(false);
      setSubscriberCount(0);
    }
  }, [key, fn, ...deps]);

  return { execute, isInFlight, subscriberCount };
}

// React import for the hook
import React from 'react';
