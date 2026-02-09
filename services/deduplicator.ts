/**
 * Request Deduplicator
 * 
 * Prevents duplicate in-flight requests by sharing promises.
 * Useful when multiple components trigger the same API call simultaneously.
 * 
 * Example:
 *   const dedup = new RequestDeduplicator<string>();
 *   
 *   // Both calls share the same promise
 *   const result1 = dedup.dedup('key', () => fetchData());
 *   const result2 = dedup.dedup('key', () => fetchData()); // Returns same promise
 */

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export interface DeduplicatorOptions {
  /** Maximum time to keep a request in-flight (ms). Default: 30000 */
  maxInFlightAgeMs?: number;
  /** Enable debug logging. Default: false */
  debug?: boolean;
}

export class RequestDeduplicator<T> {
  private inFlight = new Map<string, InFlightRequest<T>>();
  private readonly maxInFlightAgeMs: number;
  private readonly debug: boolean;

  constructor(options: DeduplicatorOptions = {}) {
    this.maxInFlightAgeMs = options.maxInFlightAgeMs ?? 30000;
    this.debug = options.debug ?? false;
  }

  /**
   * Execute a function with deduplication.
   * If a request with the same key is already in-flight, returns its promise.
   * Otherwise, executes fn and stores the promise.
   */
  async dedup(key: string, fn: () => Promise<T>): Promise<T> {
    this.cleanupStale();

    const existing = this.inFlight.get(key);
    if (existing) {
      this.log('DEDUP', `Reusing in-flight request for key: ${key}`);
      return existing.promise;
    }

    this.log('DEDUP', `Starting new request for key: ${key}`);

    // Create the promise immediately to store it
    const promise = this.executeAndCleanup(key, fn);
    
    // Store with timeout safety net
    const timeoutId = setTimeout(() => {
      this.log('WARN', `Request timed out for key: ${key}, cleaning up`);
      this.inFlight.delete(key);
    }, this.maxInFlightAgeMs);

    this.inFlight.set(key, { promise, timestamp: Date.now(), timeoutId });

    return promise;
  }

  /**
   * Check if a request is currently in-flight
   */
  isInFlight(key: string): boolean {
    this.cleanupStale();
    return this.inFlight.has(key);
  }

  /**
   * Get number of in-flight requests
   */
  getInFlightCount(): number {
    this.cleanupStale();
    return this.inFlight.size;
  }

  /**
   * Clear all in-flight requests (useful for testing)
   */
  clear(): void {
    for (const [, request] of this.inFlight) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
    }
    this.inFlight.clear();
  }

  private async executeAndCleanup(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.log('DEDUP', `Request completed for key: ${key}`);
      return result;
    } catch (error) {
      this.log('DEDUP', `Request failed for key: ${key}`, error);
      throw error;
    } finally {
      // Clean up after completion
      const request = this.inFlight.get(key);
      if (request?.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      this.inFlight.delete(key);
    }
  }

  private cleanupStale(): void {
    const now = Date.now();
    for (const [key, request] of this.inFlight) {
      if (now - request.timestamp > this.maxInFlightAgeMs) {
        this.log('CLEANUP', `Removing stale request for key: ${key}`);
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }
        this.inFlight.delete(key);
      }
    }
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[DEDUP:${level}]`, message, ...args);
    }
  }
}

/**
 * Simple hash function for creating dedup keys from objects
 */
export function createDedupKey(parts: (string | number | boolean | undefined)[]): string {
  return parts.map(p => String(p ?? 'null')).join('|');
}
