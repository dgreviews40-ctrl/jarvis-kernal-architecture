/**
 * Connection Pool for API Requests
 * Manages persistent connections and request queuing
 * Reduces connection overhead for frequent API calls
 */

interface PooledConnection {
  id: string;
  headers: Record<string, string>;
  baseURL: string;
  lastUsed: number;
  requestCount: number;
  activeRequests: number;
}

interface QueuedRequest<T> {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
}

interface ConnectionPoolConfig {
  maxConcurrent: number;
  maxConnections: number;
  requestTimeout: number;
  keepAliveDuration: number;
  retryAttempts: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConcurrent: 6,        // Browser typical limit
  maxConnections: 10,
  requestTimeout: 30000,
  keepAliveDuration: 60000,
  retryAttempts: 3,
  retryDelay: 1000
};

class ConnectionPool {
  private connections = new Map<string, PooledConnection>();
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private config: ConnectionPoolConfig;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startMaintenanceInterval();
  }

  /**
   * Register a connection configuration
   */
  registerConnection(
    id: string,
    baseURL: string,
    headers: Record<string, string> = {}
  ): void {
    this.connections.set(id, {
      id,
      baseURL,
      headers,
      lastUsed: Date.now(),
      requestCount: 0,
      activeRequests: 0
    });
  }

  /**
   * Make a request through the pool
   */
  async request<T>(
    connectionId: string,
    endpoint: string,
    options: RequestInit = {},
    priority: number = 5
  ): Promise<T> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not registered`);
    }

    const url = `${connection.baseURL}${endpoint}`;
    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...connection.headers,
        ...(options.headers || {})
      }
    };

    return this.enqueueRequest<T>(url, mergedOptions, priority);
  }

  /**
   * Make a generic fetch request with pooling
   */
  async fetch<T>(
    url: string,
    options: RequestInit = {},
    priority: number = 5
  ): Promise<T> {
    return this.enqueueRequest<T>(url, options, priority);
  }

  private enqueueRequest<T>(
    url: string,
    options: RequestInit,
    priority: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        timestamp: Date.now()
      };

      // Add to queue and sort by priority
      this.queue.push(request);
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      const result = await this.executeWithRetry(request);
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeRequests--;
      // Process next request
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private async executeWithRetry<T>(request: QueuedRequest<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.requestTimeout
        );

        const response = await fetch(request.url, {
          ...request.options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse based on content type
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json() as T;
        }
        return await response.text() as unknown as T;

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes('HTTP 4')) {
          throw lastError;
        }

        if (attempt < this.config.retryAttempts - 1) {
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    registeredConnections: number;
    averageWaitTime: number;
  } {
    const now = Date.now();
    const waitTimes = this.queue.map(r => now - r.timestamp);
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      registeredConnections: this.connections.size,
      averageWaitTime
    };
  }

  /**
   * Clear all connections and pending requests
   */
  clear(): void {
    // Reject all queued requests
    this.queue.forEach(req => {
      req.reject(new Error('Connection pool cleared'));
    });
    this.queue = [];
    this.connections.clear();
    this.activeRequests = 0;
  }

  private startMaintenanceInterval(): void {
    // Clean up old connections every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.keepAliveDuration;

      for (const [id, conn] of this.connections.entries()) {
        if (conn.lastUsed < cutoff && conn.activeRequests === 0) {
          this.connections.delete(id);
        }
      }
    }, 300000);
  }
}

// Export singleton
export const connectionPool = new ConnectionPool();

// Export class for custom instances
export { ConnectionPool };

/**
 * Batch request utility - groups multiple requests
 */
export class BatchedRequests<T, R> {
  private batch: { item: T; resolve: (result: R) => void; reject: (error: Error) => void }[] = [];
  private timeout: number | null = null;
  private processor: (items: T[]) => Promise<R[]>;
  private batchSize: number;
  private batchDelay: number;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    options: { batchSize?: number; batchDelay?: number } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize ?? 10;
    this.batchDelay = options.batchDelay ?? 50;
  }

  async request(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push({ item, resolve, reject });

      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timeout) {
        this.timeout = window.setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.batch.length === 0) return;

    const currentBatch = this.batch.splice(0, this.batchSize);
    const items = currentBatch.map(b => b.item);

    try {
      const results = await this.processor(items);
      
      currentBatch.forEach((req, index) => {
        if (index < results.length) {
          req.resolve(results[index]);
        } else {
          req.reject(new Error('Batch result mismatch'));
        }
      });
    } catch (error) {
      currentBatch.forEach(req => {
        req.reject(error as Error);
      });
    }
  }

  /**
   * Force flush any pending requests
   */
  async flushPending(): Promise<void> {
    await this.flush();
  }
}
