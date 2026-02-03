/**
 * Query Optimization Engine
 * Optimizes and caches query results
 * Supports incremental updates and materialized views
 */

export interface Query<TInput, TOutput> {
  id: string;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
  dependencies?: string[];
  cacheKey?: (input: TInput) => string;
  ttl?: number;
}

export interface QueryCacheEntry<TOutput> {
  result: TOutput;
  timestamp: number;
  dependencies: Set<string>;
  subscribers: Set<string>;
}

export interface MaterializedView<T> {
  id: string;
  query: Query<unknown, T>;
  data: T;
  lastUpdated: number;
  autoRefresh: boolean;
  refreshInterval?: number;
}

class QueryEngine {
  private queries = new Map<string, Query<unknown, unknown>>();
  private cache = new Map<string, QueryCacheEntry<unknown>>();
  private views = new Map<string, MaterializedView<unknown>>();
  private dependencyGraph = new Map<string, Set<string>>();
  private pendingInvalidations = new Set<string>();
  private invalidationTimeout: number | null = null;

  /**
   * Register a query
   */
  register<TInput, TOutput>(query: Query<TInput, TOutput>): void {
    this.queries.set(query.id, query as Query<unknown, unknown>);
    
    // Build dependency graph
    if (query.dependencies) {
      for (const dep of query.dependencies) {
        if (!this.dependencyGraph.has(dep)) {
          this.dependencyGraph.set(dep, new Set());
        }
        this.dependencyGraph.get(dep)!.add(query.id);
      }
    }
  }

  /**
   * Execute a query with caching
   */
  async execute<TInput, TOutput>(
    queryId: string,
    input: TInput,
    options: { forceFresh?: boolean; subscriberId?: string } = {}
  ): Promise<TOutput> {
    const query = this.queries.get(queryId) as Query<TInput, TOutput> | undefined;
    if (!query) {
      throw new Error(`Query ${queryId} not found`);
    }

    // Generate cache key
    const cacheKey = query.cacheKey 
      ? `${queryId}_${query.cacheKey(input)}`
      : `${queryId}_${JSON.stringify(input)}`;

    // Check cache
    if (!options.forceFresh) {
      const cached = this.cache.get(cacheKey) as QueryCacheEntry<TOutput> | undefined;
      if (cached) {
        const isValid = query.ttl ? Date.now() - cached.timestamp < query.ttl : true;
        
        if (isValid) {
          // Track subscriber
          if (options.subscriberId) {
            cached.subscribers.add(options.subscriberId);
          }
          return cached.result;
        }
      }
    }

    // Execute query
    const result = await query.execute(input);

    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      dependencies: new Set(query.dependencies || []),
      subscribers: options.subscriberId ? new Set([options.subscriberId]) : new Set()
    });

    return result;
  }

  /**
   * Create a materialized view
   */
  createView<T>(
    id: string,
    query: Query<unknown, T>,
    options: { autoRefresh?: boolean; refreshInterval?: number } = {}
  ): MaterializedView<T> {
    const view: MaterializedView<T> = {
      id,
      query: query as Query<unknown, unknown>,
      data: null as unknown as T,
      lastUpdated: 0,
      autoRefresh: options.autoRefresh ?? false,
      refreshInterval: options.refreshInterval
    };

    this.views.set(id, view as MaterializedView<unknown>);
    
    // Initial refresh
    this.refreshView(id);

    // Setup auto-refresh
    if (view.autoRefresh && view.refreshInterval) {
      setInterval(() => this.refreshView(id), view.refreshInterval);
    }

    return view;
  }

  /**
   * Refresh a materialized view
   */
  async refreshView(viewId: string): Promise<void> {
    const view = this.views.get(viewId);
    if (!view) return;

    const result = await view.query.execute({});
    view.data = result;
    view.lastUpdated = Date.now();
  }

  /**
   * Invalidate cache entries by dependency
   */
  invalidate(dependency: string): void {
    this.pendingInvalidations.add(dependency);
    
    if (this.invalidationTimeout) {
      clearTimeout(this.invalidationTimeout);
    }

    this.invalidationTimeout = window.setTimeout(() => {
      this.processInvalidations();
    }, 50);
  }

  /**
   * Subscribe to query results
   */
  subscribe<T>(
    queryId: string,
    input: unknown,
    callback: (result: T) => void,
    subscriberId: string
  ): () => void {
    // Execute and subscribe
    this.execute(queryId, input, { subscriberId }).then(callback);

    return () => {
      // Unsubscribe
      for (const entry of this.cache.values()) {
        entry.subscribers.delete(subscriberId);
      }
    };
  }

  /**
   * Get view data
   */
  getView<T>(viewId: string): T | undefined {
    return this.views.get(viewId)?.data as T | undefined;
  }

  /**
   * Get query statistics
   */
  getStats(): {
    registeredQueries: number;
    cachedResults: number;
    materializedViews: number;
    cacheHitRate: number;
  } {
    return {
      registeredQueries: this.queries.size,
      cachedResults: this.cache.size,
      materializedViews: this.views.size,
      cacheHitRate: this.calculateHitRate()
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingInvalidations.clear();
  }

  private processInvalidations(): void {
    const toInvalidate = new Set<string>();

    // Find all affected queries
    for (const dependency of this.pendingInvalidations) {
      const affected = this.dependencyGraph.get(dependency);
      if (affected) {
        for (const queryId of affected) {
          toInvalidate.add(queryId);
        }
      }
    }

    // Invalidate cache entries
    for (const [key, entry] of this.cache.entries()) {
      for (const dep of this.pendingInvalidations) {
        if (entry.dependencies.has(dep)) {
          this.cache.delete(key);
          
          // Notify subscribers
          for (const subscriberId of entry.subscribers) {
            console.log(`[QUERY ENGINE] Notifying subscriber ${subscriberId} of invalidation`);
          }
          break;
        }
      }
    }

    // Refresh affected views
    for (const viewId of toInvalidate) {
      this.refreshView(viewId);
    }

    this.pendingInvalidations.clear();
  }

  private calculateHitRate(): number {
    // Simplified - in real implementation, track hits/misses
    return 0;
  }
}

// Export singleton
export const queryEngine = new QueryEngine();

// Export class
export { QueryEngine };

/**
 * Decorator for caching method results
 */
export function cachedQuery<TInput, TOutput>(
  options: {
    key?: string;
    ttl?: number;
    dependencies?: string[];
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const queryId = options.key || `${target.constructor.name}_${propertyKey}`;

    // Register query
    queryEngine.register({
      id: queryId,
      execute: (input: TInput) => originalMethod.apply(target, [input]),
      dependencies: options.dependencies,
      ttl: options.ttl
    });

    // Replace method with cached version
    descriptor.value = async function (input: TInput): Promise<TOutput> {
      return queryEngine.execute(queryId, input);
    };

    return descriptor;
  };
}

/**
 * React hook for query
 */
export function useQuery<TInput, TOutput>(
  queryId: string,
  input: TInput,
  options: { enabled?: boolean; refetchInterval?: number } = {}
) {
  const [data, setData] = React.useState<TOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (options.enabled === false) return;

    let isMounted = true;
    const subscriberId = `react_${Date.now()}`;

    queryEngine.execute<TInput, TOutput>(queryId, input, { subscriberId })
      .then(result => {
        if (isMounted) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    // Refetch interval
    let interval: number | null = null;
    if (options.refetchInterval) {
      interval = window.setInterval(() => {
        queryEngine.execute<TInput, TOutput>(queryId, input, { 
          forceFresh: true,
          subscriberId 
        }).then(setData);
      }, options.refetchInterval);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [queryId, JSON.stringify(input), options.enabled, options.refetchInterval]);

  const refetch = React.useCallback(() => {
    setIsLoading(true);
    queryEngine.execute<TInput, TOutput>(queryId, input, { forceFresh: true })
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [queryId, input]);

  return { data, isLoading, error, refetch };
}

import React from 'react';
