/**
 * Advanced Caching Service for JARVIS Kernel v1.3
 * 
 * Implements sophisticated caching strategies for:
 * - API responses
 * - Memory recall results
 * - Plugin execution results
 * - AI provider responses
 */

import { logger } from './logger';
import { KernelEvent } from '../types';

interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
  tags: string[];
}

export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private currentSize: number = 0;
  private evictionThreshold: number; // Percentage of maxSize to trigger eviction

  private constructor(maxSize: number = 1000, evictionThreshold: number = 0.8) {
    this.maxSize = maxSize;
    this.evictionThreshold = maxSize * evictionThreshold;
  }

  public static getInstance(maxSize?: number, evictionThreshold?: number): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(maxSize, evictionThreshold);
    }
    return CacheService.instance;
  }

  /**
   * Set a value in the cache
   */
  public set<T>(key: string, value: T, ttl: number = 300000, tags: string[] = []): boolean { // Default TTL: 5 minutes
    try {
      // Check if we need to evict items
      if (this.currentSize >= this.evictionThreshold) {
        this.performEviction();
      }

      // Create cache entry
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
        tags
      };

      // If key already exists, update size accounting
      if (this.cache.has(key)) {
        this.currentSize--; // Decrement for the old entry
      }

      // Add to cache
      this.cache.set(key, entry);
      this.currentSize++;

      logger.log('SYSTEM', `Cached key: ${key}, TTL: ${ttl}ms`, 'info');
      return true;
    } catch (error) {
      logger.log('SYSTEM', `Failed to cache key ${key}: ${(error as Error).message}`, 'error');
      return false;
    }
  }

  /**
   * Get a value from the cache
   */
  public get<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        logger.log('SYSTEM', `Cache miss for key: ${key}`, 'info');
        return null;
      }

      // Check if entry is expired
      // Zero TTL: expires on next access (Date.now() >= timestamp)
      // Positive TTL: expires if elapsed time >= TTL
      if ((entry.ttl === 0 && Date.now() >= entry.timestamp) || (entry.ttl > 0 && Date.now() - entry.timestamp >= entry.ttl)) {
        this.delete(key);
        logger.log('SYSTEM', `Cache entry expired for key: ${key}`, 'info');
        return null;
      }

      logger.log('SYSTEM', `Cache hit for key: ${key}`, 'info');
      return entry.value as T;
    } catch (error) {
      logger.log('SYSTEM', `Error retrieving key ${key}: ${(error as Error).message}`, 'error');
      return null;
    }
  }

  /**
   * Check if a key exists in the cache
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    // Zero TTL: expires on next access (Date.now() >= timestamp)
    // Positive TTL: expires if elapsed time >= TTL
    if ((entry.ttl === 0 && Date.now() >= entry.timestamp) || (entry.ttl > 0 && Date.now() - entry.timestamp >= entry.ttl)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  public delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.currentSize--;
      logger.log('SYSTEM', `Deleted key from cache: ${key}`, 'info');
    }
    return existed;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    logger.log('SYSTEM', 'Cache cleared', 'info');
  }

  /**
   * Get all keys with a specific tag
   */
  public getKeysByTag(tag: string): string[] {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => entry.tags.includes(tag))
      .map(([key, _]) => key);
  }

  /**
   * Delete all entries with a specific tag
   */
  public deleteByTag(tag: string): number {
    const keysToDelete = this.getKeysByTag(tag);
    let deletedCount = 0;

    for (const key of keysToDelete) {
      if (this.delete(key)) {
        deletedCount++;
      }
    }

    logger.log('SYSTEM', `Deleted ${deletedCount} entries with tag: ${tag}`, 'info');
    return deletedCount;
  }

  /**
   * Perform LRU eviction when cache reaches threshold
   */
  private performEviction(): void {
    // Simple LRU: remove oldest entries first
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp (oldest first)

    // Remove 20% of entries to free up space
    const entriesToRemove = Math.ceil(entries.length * 0.2);
    
    for (let i = 0; i < entriesToRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.currentSize--;
    }

    logger.log('SYSTEM', `Evicted ${entriesToRemove} entries due to size threshold`, 'info');
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; maxSize: number; utilization: number; entries: number } {
    // Clean up expired entries first
    this.cleanExpiredEntries();

    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      utilization: (this.currentSize / this.maxSize) * 100,
      entries: this.cache.size
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Zero TTL: expires if any time has passed (now > timestamp)
      // Positive TTL: expires if elapsed time >= TTL
      if ((entry.ttl === 0 && now > entry.timestamp) || (entry.ttl > 0 && now - entry.timestamp >= entry.ttl)) {
        this.cache.delete(key);
        this.currentSize--;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.log('SYSTEM', `Cleaned up ${cleanedCount} expired entries`, 'info');
    }
  }

  /**
   * Cache with conditional logic based on tags
   */
  public setConditional<T>(
    key: string, 
    valueFn: () => Promise<T>, 
    ttl: number = 300000, 
    tags: string[] = [],
    condition?: () => boolean
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Check condition if provided
        if (condition && !condition()) {
          // Skip caching, just return the value
          const value = await valueFn();
          resolve(value);
          return;
        }

        // Check if already cached
        const cachedValue = this.get<T>(key);
        if (cachedValue !== null) {
          resolve(cachedValue);
          return;
        }

        // Get fresh value
        const freshValue = await valueFn();

        // Cache the value
        this.set(key, freshValue, ttl, tags);

        resolve(freshValue);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get with automatic refresh if expired
   */
  public async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300000,
    tags: string[] = []
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = this.get<T>(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // If not in cache, fetch and cache
    try {
      const freshValue = await fetchFn();
      this.set(key, freshValue, ttl, tags);
      return freshValue;
    } catch (error) {
      logger.log('SYSTEM', `Failed to fetch and cache key ${key}: ${(error as Error).message}`, 'error');
      throw error;
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Predefined cache keys for common use cases
export const CACHE_KEYS = {
  MEMORY_RECALL: (query: string) => `memory:recall:${query}`,
  PLUGIN_EXECUTION: (pluginId: string, method: string) => `plugin:exec:${pluginId}:${method}`,
  AI_RESPONSE: (prompt: string, provider: string) => `ai:response:${provider}:${hashCode(prompt)}`,
  WEATHER_DATA: (location: string) => `weather:data:${location}`,
  HA_ENTITIES: 'ha:entities:all',
  HA_ENTITY_STATE: (entityId: string) => `ha:state:${entityId}`,
};

// Helper function to create hash codes for strings
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}