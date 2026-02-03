/**
 * Predictive Prefetching Service
 * Intelligently preloads resources based on user behavior patterns
 * Reduces perceived latency by loading before user requests
 */

interface PrefetchStrategy {
  name: string;
  predict: () => string[];
  confidence: number;
}

interface PrefetchConfig {
  maxConcurrent: number;
  maxCacheSize: number;
  minConfidence: number;
  cooldownPeriod: number;
}

interface PrefetchedResource {
  url: string;
  data: unknown;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

interface UserPattern {
  sequence: string[];
  frequency: number;
  lastOccurred: number;
}

const DEFAULT_CONFIG: PrefetchConfig = {
  maxConcurrent: 3,
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  minConfidence: 0.6,
  cooldownPeriod: 5000
};

class PredictivePrefetchService {
  private cache = new Map<string, PrefetchedResource>();
  private patterns: UserPattern[] = [];
  private recentActions: string[] = [];
  private inFlight = new Set<string>();
  private config: PrefetchConfig;
  private strategies: PrefetchStrategy[] = [];
  private lastPrefetch = 0;
  private currentCacheSize = 0;

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPatterns();
  }

  /**
   * Register a prefetch strategy
   */
  registerStrategy(strategy: PrefetchStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Record a user action for pattern learning
   */
  recordAction(action: string, context?: Record<string, unknown>): void {
    this.recentActions.push(action);
    
    // Keep only last 20 actions
    if (this.recentActions.length > 20) {
      this.recentActions.shift();
    }

    // Learn patterns
    this.learnPatterns();

    // Trigger prefetch based on new action
    this.triggerPrefetch(action, context);
  }

  /**
   * Get cached resource if available
   */
  get<T>(url: string): T | null {
    const resource = this.cache.get(url);
    if (!resource) return null;

    // Update access stats
    resource.accessCount++;
    resource.lastAccessed = Date.now();

    return resource.data as T;
  }

  /**
   * Check if resource is cached or being fetched
   */
  has(url: string): boolean {
    return this.cache.has(url) || this.inFlight.has(url);
  }

  /**
   * Prefetch a specific URL
   */
  async prefetch(url: string, fetcher?: () => Promise<unknown>): Promise<boolean> {
    if (this.has(url) || this.inFlight.has(url)) {
      return true;
    }

    if (this.inFlight.size >= this.config.maxConcurrent) {
      return false;
    }

    this.inFlight.add(url);

    try {
      const data = fetcher 
        ? await fetcher()
        : await fetch(url).then(r => r.json());

      const size = this.estimateSize(data);
      
      // Only cache if we have space
      if (this.currentCacheSize + size > this.config.maxCacheSize) {
        this.evictLRU(size);
      }

      this.cache.set(url, {
        url,
        data,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        size
      });

      this.currentCacheSize += size;
      return true;
    } catch (error) {
      console.warn(`[PREFETCH] Failed to prefetch ${url}:`, error);
      return false;
    } finally {
      this.inFlight.delete(url);
    }
  }

  /**
   * Prefetch multiple URLs
   */
  async prefetchMany(urls: string[], fetcher?: (url: string) => Promise<unknown>): Promise<void> {
    const promises = urls
      .filter(url => !this.has(url))
      .slice(0, this.config.maxConcurrent)
      .map(url => this.prefetch(url, fetcher ? () => fetcher(url) : undefined));

    await Promise.all(promises);
  }

  /**
   * Get prefetch statistics
   */
  getStats(): {
    cachedItems: number;
    cacheSizeMB: number;
    inFlightRequests: number;
    patternsLearned: number;
    hitRate: number;
  } {
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, r) => sum + r.accessCount, 0);
    const hits = Array.from(this.cache.values())
      .filter(r => r.accessCount > 0)
      .reduce((sum, r) => sum + r.accessCount, 0);

    return {
      cachedItems: this.cache.size,
      cacheSizeMB: Math.round(this.currentCacheSize / 1024 / 1024 * 100) / 100,
      inFlightRequests: this.inFlight.size,
      patternsLearned: this.patterns.length,
      hitRate: totalAccesses > 0 ? Math.round(hits / totalAccesses * 100) : 0
    };
  }

  /**
   * Clear all cached resources
   */
  clear(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.inFlight.clear();
  }

  private learnPatterns(): void {
    // Simple pattern learning: look for common sequences
    if (this.recentActions.length < 3) return;

    // Check last 3 actions
    const sequence = this.recentActions.slice(-3);
    const sequenceKey = sequence.join('->');

    const existing = this.patterns.find(p => 
      p.sequence.join('->') === sequenceKey
    );

    if (existing) {
      existing.frequency++;
      existing.lastOccurred = Date.now();
    } else {
      this.patterns.push({
        sequence: [...sequence],
        frequency: 1,
        lastOccurred: Date.now()
      });
    }

    // Keep only top patterns by frequency
    this.patterns.sort((a, b) => b.frequency - a.frequency);
    this.patterns = this.patterns.slice(0, 50);
  }

  private triggerPrefetch(action: string, context?: Record<string, unknown>): void {
    const now = Date.now();
    if (now - this.lastPrefetch < this.config.cooldownPeriod) {
      return;
    }

    // Find matching patterns
    const predictions = new Set<string>();

    for (const pattern of this.patterns) {
      if (pattern.sequence[0] === action) {
        // High confidence if this pattern has occurred frequently
        const confidence = Math.min(pattern.frequency / 5, 1);
        
        if (confidence >= this.config.minConfidence) {
          // Predict next actions in sequence
          pattern.sequence.slice(1).forEach(a => predictions.add(a));
        }
      }
    }

    // Run registered strategies
    for (const strategy of this.strategies) {
      if (strategy.confidence >= this.config.minConfidence) {
        strategy.predict().forEach(url => predictions.add(url));
      }
    }

    // Prefetch predicted resources
    if (predictions.size > 0) {
      this.lastPrefetch = now;
      this.prefetchMany(Array.from(predictions));
    }
  }

  private estimateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    } catch {
      return 1024; // Default 1KB
    }
  }

  private evictLRU(neededSpace: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let freed = 0;
    for (const [key, resource] of entries) {
      if (freed >= neededSpace) break;
      
      this.cache.delete(key);
      this.currentCacheSize -= resource.size;
      freed += resource.size;
    }
  }

  private loadPatterns(): void {
    try {
      const saved = localStorage.getItem('jarvis_prefetch_patterns');
      if (saved) {
        this.patterns = JSON.parse(saved);
      }
    } catch {
      this.patterns = [];
    }
  }

  private savePatterns(): void {
    try {
      localStorage.setItem('jarvis_prefetch_patterns', JSON.stringify(this.patterns));
    } catch {
      // Ignore storage errors
    }
  }
}

// Export singleton
export const prefetchService = new PredictivePrefetchService();

// Export class for custom instances
export { PredictivePrefetchService };

/**
 * React hook for prefetching
 */
export function usePrefetch() {
  const prefetch = React.useCallback((url: string) => {
    return prefetchService.prefetch(url);
  }, []);

  const recordAction = React.useCallback((action: string, context?: Record<string, unknown>) => {
    prefetchService.recordAction(action, context);
  }, []);

  return { prefetch, recordAction };
}

// React import for the hook
import React from 'react';
