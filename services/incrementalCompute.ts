/**
 * Incremental Computation Engine
 * Only recomputes what has changed
 * Dramatically improves performance for derived data
 */

type Computation<TInput, TOutput> = (input: TInput) => TOutput;
type EqualityCheck<T> = (a: T, b: T) => boolean;

interface ComputedValue<T> {
  value: T;
  version: number;
  lastAccessed: number;
  dependencies: Set<string>;
}

interface ComputationNode<TInput, TOutput> {
  id: string;
  compute: Computation<TInput, TOutput>;
  lastInput?: TInput;
  lastOutput?: TOutput;
  version: number;
  equalityCheck: EqualityCheck<TInput>;
  subscribers: Set<string>;
}

class IncrementalComputeEngine {
  private computations = new Map<string, ComputationNode<unknown, unknown>>();
  private cache = new Map<string, ComputedValue<unknown>>();
  private dependencyGraph = new Map<string, Set<string>>();
  private version = 0;

  /**
   * Register a computation
   */
  register<TInput, TOutput>(
    id: string,
    compute: Computation<TInput, TOutput>,
    options: {
      equalityCheck?: EqualityCheck<TInput>;
      dependencies?: string[];
    } = {}
  ): void {
    this.computations.set(id, {
      id,
      compute: compute as Computation<unknown, unknown>,
      version: 0,
      equalityCheck: options.equalityCheck || this.defaultEqualityCheck,
      subscribers: new Set()
    });

    // Build dependency graph
    if (options.dependencies) {
      for (const dep of options.dependencies) {
        if (!this.dependencyGraph.has(dep)) {
          this.dependencyGraph.set(dep, new Set());
        }
        this.dependencyGraph.get(dep)!.add(id);
      }
    }
  }

  /**
   * Compute or retrieve cached value
   */
  compute<TInput, TOutput>(id: string, input: TInput): TOutput {
    const node = this.computations.get(id) as ComputationNode<TInput, TOutput> | undefined;
    if (!node) {
      throw new Error(`Computation ${id} not found`);
    }

    // Check if we can reuse cached result
    if (node.lastInput !== undefined && 
        node.lastOutput !== undefined &&
        node.equalityCheck(node.lastInput, input)) {
      return node.lastOutput;
    }

    // Recompute
    const result = node.compute(input);
    
    node.lastInput = input;
    node.lastOutput = result;
    node.version = ++this.version;

    // Cache the result
    this.cache.set(id, {
      value: result,
      version: node.version,
      lastAccessed: Date.now(),
      dependencies: new Set()
    });

    return result;
  }

  /**
   * Subscribe to computation updates
   */
  subscribe(id: string, subscriberId: string): () => void {
    const node = this.computations.get(id);
    if (node) {
      node.subscribers.add(subscriberId);
    }

    return () => {
      node?.subscribers.delete(subscriberId);
    };
  }

  /**
   * Invalidate a computation and its dependents
   */
  invalidate(id: string): void {
    const node = this.computations.get(id);
    if (node) {
      node.lastInput = undefined;
      node.lastOutput = undefined;
      node.version = ++this.version;
    }

    this.cache.delete(id);

    // Invalidate dependents
    const dependents = this.dependencyGraph.get(id);
    if (dependents) {
      for (const dependent of dependents) {
        this.invalidate(dependent);
      }
    }

    // Notify subscribers
    if (node) {
      for (const subscriberId of node.subscribers) {
        console.log(`[INCREMENTAL] Notifying ${subscriberId} of invalidation`);
      }
    }
  }

  /**
   * Create a memoized computation
   */
  memoize<TInput extends unknown[], TOutput>(
    fn: (...args: TInput) => TOutput,
    options: {
      key?: string;
      maxSize?: number;
    } = {}
  ): (...args: TInput) => TOutput {
    const cache = new Map<string, { result: TOutput; args: TInput }>();
    const key = options.key || fn.name || 'anonymous';
    const maxSize = options.maxSize || 100;

    return (...args: TInput): TOutput => {
      const cacheKey = JSON.stringify(args);
      const cached = cache.get(cacheKey);

      if (cached && this.arrayEquals(cached.args, args)) {
        return cached.result;
      }

      const result = fn(...args);

      // Limit cache size
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(cacheKey, { result, args });
      return result;
    };
  }

  /**
   * Create a derived computation that depends on others
   */
  derive<TOutput>(
    id: string,
    dependencies: string[],
    compute: (values: unknown[]) => TOutput
  ): TOutput {
    // Get current values of dependencies
    const depValues = dependencies.map(depId => {
      const cached = this.cache.get(depId);
      return cached?.value;
    });

    // Check if we have a cached result
    const cached = this.cache.get(id) as ComputedValue<TOutput> | undefined;
    
    if (cached) {
      // Check if any dependency has changed
      const depVersions = dependencies.map(depId => 
        this.computations.get(depId)?.version || 0
      );
      
      const cachedVersions = Array.from(cached.dependencies);
      
      if (this.arrayEquals(depVersions, cachedVersions)) {
        cached.lastAccessed = Date.now();
        return cached.value;
      }
    }

    // Recompute
    const result = compute(depValues);
    
    this.cache.set(id, {
      value: result,
      version: ++this.version,
      lastAccessed: Date.now(),
      dependencies: new Set(dependencies.map(depId => 
        this.computations.get(depId)?.version.toString() || '0'
      ))
    });

    return result;
  }

  /**
   * Get computation statistics
   */
  getStats(): {
    registeredComputations: number;
    cachedValues: number;
    totalVersions: number;
  } {
    return {
      registeredComputations: this.computations.size,
      cachedValues: this.cache.size,
      totalVersions: this.version
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    for (const node of this.computations.values()) {
      node.lastInput = undefined;
      node.lastOutput = undefined;
    }
    this.cache.clear();
  }

  private defaultEqualityCheck<T>(a: T, b: T): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private arrayEquals<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }
}

// Export singleton
export const incrementalCompute = new IncrementalComputeEngine();

// Export class
export { IncrementalComputeEngine };

/**
 * React hook for incremental computation
 */
export function useIncremental<TInput, TOutput>(
  id: string,
  input: TInput,
  compute: (input: TInput) => TOutput,
  deps: React.DependencyList = []
): TOutput {
  const [output, setOutput] = React.useState<TOutput>(() => compute(input));

  React.useEffect(() => {
    incrementalCompute.register(id, compute);
    const result = incrementalCompute.compute(id, input);
    setOutput(result);
  }, [id, ...deps]);

  return output;
}

/**
 * Decorator for memoized methods
 */
export function incremental<TInput, TOutput>(
  options: {
    key?: string;
    equalityCheck?: EqualityCheck<TInput>;
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const id = options.key || `${target.constructor.name}_${propertyKey}`;

    incrementalCompute.register(id, originalMethod, {
      equalityCheck: options.equalityCheck
    });

    descriptor.value = function (input: TInput): TOutput {
      return incrementalCompute.compute(id, input);
    };

    return descriptor;
  };
}

import React from 'react';
