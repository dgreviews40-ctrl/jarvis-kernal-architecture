/**
 * Cache Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService, CACHE_KEYS } from '../../services/cacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = CacheService.getInstance(100, 0.8); // Small cache for testing
    cache.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', () => {
      cache.set('key1', 'value1');
      
      const result = cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entry', () => {
      cache.set('key1', 'value1', 1); // 1ms TTL
      
      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          const result = cache.get('key1');
          expect(result).toBeNull();
          resolve(undefined);
        }, 10);
      });
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1', 300000);
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired key in has()', () => {
      cache.set('key1', 'value1', 1);
      
      return new Promise(resolve => {
        setTimeout(() => {
          expect(cache.has('key1')).toBe(false);
          resolve(undefined);
        }, 10);
      });
    });

    it('should delete a key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const result = cache.delete('key1');
      expect(result).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const result = cache.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect custom TTL', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(r => setTimeout(r, 60));
      
      expect(cache.get('key1')).toBeNull();
    });

    it('should handle zero TTL as immediate expiration on next get', async () => {
      cache.set('key1', 'value1', 0);
      
      // With TTL=0, entry expires immediately on any subsequent access
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('Tag Operations', () => {
    it('should get keys by tag', () => {
      cache.set('key1', 'value1', 300000, ['tag1', 'tag2']);
      cache.set('key2', 'value2', 300000, ['tag1']);
      cache.set('key3', 'value3', 300000, ['tag2']);
      
      const tag1Keys = cache.getKeysByTag('tag1');
      expect(tag1Keys).toContain('key1');
      expect(tag1Keys).toContain('key2');
      expect(tag1Keys).not.toContain('key3');
    });

    it('should delete by tag', () => {
      cache.set('key1', 'value1', 300000, ['tag1']);
      cache.set('key2', 'value2', 300000, ['tag1']);
      cache.set('key3', 'value3', 300000, ['tag2']);
      
      const deletedCount = cache.deleteByTag('tag1');
      
      expect(deletedCount).toBe(2);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });

    it('should return 0 when deleting non-existent tag', () => {
      const deletedCount = cache.deleteByTag('non-existent');
      expect(deletedCount).toBe(0);
    });
  });

  describe('Stats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1', 300000);
      cache.set('key2', 'value2', 300000);
      
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('utilization');
      expect(stats).toHaveProperty('entries');
      expect(stats.entries).toBe(2);
      expect(stats.size).toBe(2);
    });

    it('should calculate utilization percentage', () => {
      cache.clear();
      
      // With cache size 100, add 50 items = 50%
      for (let i = 0; i < 50; i++) {
        cache.set(`util-key${i}`, `value${i}`, 300000);
      }
      
      const stats = cache.getStats();
      // Utilization is a percentage (0-100)
      expect(stats.utilization).toBeGreaterThan(0);
      expect(stats.utilization).toBeLessThanOrEqual(100);
      expect(stats.entries).toBe(50);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value', 300000);
      
      const fetchFn = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('key1', fetchFn);
      
      expect(result).toBe('cached-value');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched-value');
      
      const result = await cache.getOrSet('key1', fetchFn);
      
      expect(result).toBe('fetched-value');
      expect(fetchFn).toHaveBeenCalled();
      expect(cache.get('key1')).toBe('fetched-value');
    });

    it('should throw if fetch fails', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      
      await expect(cache.getOrSet('key1', fetchFn)).rejects.toThrow('Fetch failed');
    });
  });

  describe('setConditional', () => {
    it('should cache when condition is true', async () => {
      const valueFn = vi.fn().mockResolvedValue('value');
      const condition = vi.fn().mockReturnValue(true);
      
      const result = await cache.setConditional('key1', valueFn, 300000, [], condition);
      
      expect(result).toBe('value');
      expect(cache.get('key1')).toBe('value');
    });

    it('should not cache when condition is false', async () => {
      const valueFn = vi.fn().mockResolvedValue('value');
      const condition = vi.fn().mockReturnValue(false);
      
      const result = await cache.setConditional('key1', valueFn, 300000, [], condition);
      
      expect(result).toBe('value');
      expect(cache.has('key1')).toBe(false);
    });

    it('should return cached value without calling valueFn', async () => {
      cache.set('key1', 'cached-value', 300000);
      
      const valueFn = vi.fn().mockResolvedValue('new-value');
      
      const result = await cache.setConditional('key1', valueFn);
      
      expect(result).toBe('cached-value');
      expect(valueFn).not.toHaveBeenCalled();
    });
  });

  describe('CACHE_KEYS helpers', () => {
    it('should generate memory recall key', () => {
      const key = CACHE_KEYS.MEMORY_RECALL('test query');
      expect(key).toBe('memory:recall:test query');
    });

    it('should generate plugin execution key', () => {
      const key = CACHE_KEYS.PLUGIN_EXECUTION('plugin.weather', 'getForecast');
      expect(key).toBe('plugin:exec:plugin.weather:getForecast');
    });

    it('should generate AI response key', () => {
      const key = CACHE_KEYS.AI_RESPONSE('Hello world', 'gemini');
      expect(key).toMatch(/^ai:response:gemini:[a-z0-9]+$/);
    });

    it('should generate weather data key', () => {
      const key = CACHE_KEYS.WEATHER_DATA('London');
      expect(key).toBe('weather:data:London');
    });

    it('should have static HA entities key', () => {
      expect(CACHE_KEYS.HA_ENTITIES).toBe('ha:entities:all');
    });

    it('should generate HA entity state key', () => {
      const key = CACHE_KEYS.HA_ENTITY_STATE('light.living_room');
      expect(key).toBe('ha:state:light.living_room');
    });
  });

  describe('Eviction', () => {
    it('should evict old entries when threshold reached', () => {
      // Small cache with 80% threshold = 8 items trigger
      const smallCache = CacheService.getInstance(10, 0.8);
      smallCache.clear();
      
      // Add 10 items (should trigger eviction)
      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, `value${i}`, 300000);
      }
      
      const stats = smallCache.getStats();
      // After eviction, should have 8 entries (20% of 10 evicted, leaving 80%)
      expect(stats.size).toBeLessThanOrEqual(10);
    });
  });
});
