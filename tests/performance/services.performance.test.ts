/**
 * Performance & Stress Tests for JARVIS Kernel Services
 * 
 * Tests memory usage, load handling, and scalability limits
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '../../services/eventBus';
import { cacheService } from '../../services/cacheService';
import { notificationService } from '../../services/notificationService';
import { logger } from '../../services/logger';
import { secureStorage } from '../../services/secureStorage';
import { searchService } from '../../services/search';

describe('Performance & Stress Tests', () => {
  // Helper to measure memory (Node.js only)
  const getMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, external: 0 };
  };

  beforeEach(() => {
    // Reset all services
    eventBus.clear();
    eventBus.resetStats();
    cacheService.clear();
    notificationService.dismissAll();
    logger.clear();
    
    // Reset secure storage - clear memory and reset state
    secureStorage.lock();
    (secureStorage as any).memoryStore.clear();
    (secureStorage as any).isInitialized = false;
    (secureStorage as any).encryptionKey = null;
    
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('EventBus Performance', () => {
    it('should handle 1000+ subscribers efficiently', async () => {
      const handler = vi.fn();
      const channels = Array.from({ length: 1000 }, (_, i) => `channel-${i}`);
      
      const startTime = performance.now();
      
      // Subscribe to 1000 different channels
      const unsubscribers = channels.map(channel => 
        eventBus.subscribe(channel, handler)
      );
      
      const subscribeTime = performance.now() - startTime;
      expect(subscribeTime).toBeLessThan(500);
      
      // Publish one event to each channel
      const publishStart = performance.now();
      await Promise.all(channels.map(channel => 
        eventBus.publish(channel, { data: 'test' })
      ));
      const publishTime = performance.now() - publishStart;
      
      expect(publishTime).toBeLessThan(1000);
      expect(handler).toHaveBeenCalledTimes(1000);
      
      // Cleanup
      unsubscribers.forEach(unsub => unsub());
    });

    it('should handle high-frequency event publication', async () => {
      const handler = vi.fn();
      eventBus.subscribe('high-frequency', handler);
      
      const iterations = 1000;
      const startTime = performance.now();
      
      await Promise.all(Array.from({ length: iterations }, (_, i) =>
        eventBus.publish('high-frequency', { index: i })
      ));
      
      const publishTime = performance.now() - startTime;
      const eventsPerMs = iterations / publishTime;
      
      expect(handler).toHaveBeenCalledTimes(iterations);
      expect(eventsPerMs).toBeGreaterThan(1);
      
      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBe(iterations);
    });

    it('should maintain performance with many once handlers', async () => {
      const handlers = Array.from({ length: 100 }, () => vi.fn());
      
      const startTime = performance.now();
      
      handlers.forEach((handler, i) => {
        eventBus.once(`unique-channel-${i}`, handler);
      });
      
      const subscribeTime = performance.now() - startTime;
      expect(subscribeTime).toBeLessThan(100);
      
      const publishStart = performance.now();
      await Promise.all(handlers.map((handler, i) =>
        eventBus.publish(`unique-channel-${i}`, { data: i })
      ));
      const publishTime = performance.now() - publishStart;
      
      expect(publishTime).toBeLessThan(500);
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('CacheService Performance', () => {
    it('should handle cache pressure with many entries', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 200; i++) {
        cacheService.set(`key-${i}`, { data: `value-${i}`, index: i });
      }
      
      const fillTime = performance.now() - startTime;
      expect(fillTime).toBeLessThan(200);
      
      const accessStart = performance.now();
      for (let i = 0; i < 200; i++) {
        const value = cacheService.get(`key-${i}`);
        expect(value).toBeDefined();
        expect(value?.index).toBe(i);
      }
      const accessTime = performance.now() - accessStart;
      expect(accessTime).toBeLessThan(100);
      
      const stats = cacheService.getStats();
      expect(stats.entries).toBe(200);
    });

    it('should handle rapid set/get cycles efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        cacheService.set(`rapid-${i % 100}`, { counter: i });
        cacheService.get(`rapid-${i % 100}`);
      }
      
      const totalTime = performance.now() - startTime;
      const opsPerMs = (iterations * 2) / totalTime;
      
      // Adjust threshold for jsdom environment (slower than Node)
      const isJsdom = typeof window !== 'undefined' && 
                      window.navigator.userAgent.includes('jsdom');
      expect(opsPerMs).toBeGreaterThan(isJsdom ? 10 : 100);
      
      const stats = cacheService.getStats();
      expect(stats.entries).toBeLessThanOrEqual(100);
    });

    it('should handle bulk deletion efficiently', () => {
      for (let i = 0; i < 500; i++) {
        cacheService.set(`bulk-${i}`, { index: i });
      }
      
      const deleteStart = performance.now();
      for (let i = 0; i < 250; i++) {
        cacheService.delete(`bulk-${i}`);
      }
      const deleteTime = performance.now() - deleteStart;
      
      expect(deleteTime).toBeLessThan(100);
      
      const stats = cacheService.getStats();
      expect(stats.entries).toBe(250);
    });
  });

  describe('NotificationService Performance', () => {
    it('should handle high-volume notification bursts', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        notificationService.show({
          type: 'info',
          message: `Notification ${i}`
        });
      }
      
      const createTime = performance.now() - startTime;
      expect(createTime).toBeLessThan(200);
      
      const notifications = notificationService.getNotifications();
      
      expect(notifications.length).toBeLessThanOrEqual(100);
    });

    it('should efficiently dismiss notifications', () => {
      // Create notifications
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) {
        const id = notificationService.show({
          type: 'info',
          message: `Notification ${i}`
        });
        ids.push(id);
      }
      
      const startTime = performance.now();
      ids.forEach(id => notificationService.dismiss(id));
      const dismissTime = performance.now() - startTime;
      
      expect(dismissTime).toBeLessThan(50);
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should maintain history performance with large datasets', () => {
      // Create and dismiss notifications to fill history
      for (let i = 0; i < 100; i++) {
        const id = notificationService.show({
          type: ['info', 'success', 'warning', 'error'][i % 4] as any,
          message: `Message ${i}`
        });
        notificationService.dismiss(id);
      }
      
      const startTime = performance.now();
      
      const history = notificationService.getHistory();
      
      const accessTime = performance.now() - startTime;
      
      expect(accessTime).toBeLessThan(50);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Logger Performance', () => {
    it('should handle high-volume logging without blocking', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        logger.info('TEST', `Log entry ${i}`, { iteration: i });
      }
      
      const logTime = performance.now() - startTime;
      const logsPerMs = iterations / logTime;
      
      expect(logsPerMs).toBeGreaterThan(10);
      
      const stats = logger.getStats();
      expect(stats.totalLogs).toBeGreaterThanOrEqual(iterations);
    });

    it('should efficiently retrieve logs', () => {
      // Generate diverse logs
      const sources = ['auth', 'api', 'ui', 'db', 'cache'];
      
      for (let i = 0; i < 500; i++) {
        const source = sources[i % 5];
        logger.info(source, `Log ${i}`, { iteration: i });
      }
      
      const filterStart = performance.now();
      
      const allLogs = logger.getFilteredLogs({});
      const apiLogs = logger.getFilteredLogs({ source: 'api' });
      
      const filterTime = performance.now() - filterStart;
      
      expect(filterTime).toBeLessThan(100);
      expect(allLogs.length).toBeGreaterThanOrEqual(500);
      expect(apiLogs.length).toBeGreaterThanOrEqual(100);
    });

    it('should handle rapid clear and re-log cycles', () => {
      const cycles = 50;
      const logsPerCycle = 20;
      
      const startTime = performance.now();
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        for (let i = 0; i < logsPerCycle; i++) {
          logger.info('TEST', `Cycle ${cycle}, Log ${i}`);
        }
        logger.clear();
      }
      
      const totalTime = performance.now() - startTime;
      
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with repeated EventBus subscribe/unsubscribe', () => {
      const initialMemory = getMemoryUsage().heapUsed;
      
      for (let cycle = 0; cycle < 500; cycle++) {
        const handler = () => ({ cycle });
        const unsub = eventBus.subscribe('memory-test', handler);
        eventBus.publish('memory-test', { cycle });
        unsub();
      }
      
      if (typeof global.gc === 'function') {
        global.gc();
      }
      
      const finalMemory = getMemoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Allow some growth but ensure it's bounded (< 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      
      const stats = eventBus.getStats();
      expect(stats.activeSubscriptions).toBe(0);
    });

    it('should not leak memory with notification creation/dismissal', () => {
      const iterations = 200;
      
      for (let i = 0; i < iterations; i++) {
        const id = notificationService.show({
          type: 'info',
          message: 'Testing'
        });
        notificationService.dismiss(id);
      }
      
      notificationService.dismissAll();
      
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should not leak memory with cache operations', () => {
      const iterations = 500;
      
      for (let i = 0; i < iterations; i++) {
        cacheService.set(`mem-${i}`, { data: new Array(50).fill(i) });
        if (i > 50) {
          cacheService.delete(`mem-${i - 50}`);
        }
      }
      
      cacheService.clear();
      
      const stats = cacheService.getStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('Concurrent Operation Stress Tests', () => {
    it('should handle concurrent EventBus publications', async () => {
      const handler = vi.fn();
      const promises: Promise<void>[] = [];
      
      eventBus.subscribe('concurrent', handler);
      
      for (let publisher = 0; publisher < 10; publisher++) {
        promises.push(
          new Promise<void>(async resolve => {
            for (let i = 0; i < 50; i++) {
              await eventBus.publish('concurrent', { publisher, index: i });
            }
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      
      expect(handler).toHaveBeenCalledTimes(500);
      
      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBe(500);
    });

    it('should handle mixed service workload efficiently', async () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 50; i++) {
        cacheService.set(`workload-${i}`, { data: i });
        logger.info('TEST', `Item ${i}`, { index: i });
        await eventBus.publish('process', { item: i });
        
        if (i % 10 === 0) {
          notificationService.show({
            type: 'info',
            message: `Processed ${i}`
          });
        }
      }
      
      const totalTime = performance.now() - startTime;
      
      expect(totalTime).toBeLessThan(1000);
      
      expect(cacheService.getStats().entries).toBe(50);
    });
  });

  describe('Long-running Session Simulation', () => {
    it('should maintain performance over simulated session', async () => {
      const hours = 5;
      const eventsPerHour = 50;
      
      const measurements: number[] = [];
      
      for (let hour = 0; hour < hours; hour++) {
        const hourStart = performance.now();
        
        for (let i = 0; i < eventsPerHour; i++) {
          cacheService.set(`session-${hour}-${i}`, { hour, index: i });
          logger.info('TEST', `Hour ${hour}, Event ${i}`);
          await eventBus.publish('session:tick', { hour, index: i });
        }
        
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
        
        const hourTime = performance.now() - hourStart;
        measurements.push(hourTime);
      }
      
      // Calculate performance degradation
      const firstHalf = measurements.slice(0, Math.floor(hours/2)).reduce((a, b) => a + b, 0) / Math.floor(hours/2);
      const secondHalf = measurements.slice(Math.floor(hours/2)).reduce((a, b) => a + b, 0) / Math.ceil(hours/2);
      const degradation = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
      
      // Performance should not degrade by more than 100%
      expect(degradation).toBeLessThan(100);
      
      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBe(hours * eventsPerHour);
    });
  });

  describe('Edge Cases & Limits', () => {
    it('should handle empty operations gracefully', async () => {
      await eventBus.publish('empty-test', undefined);
      cacheService.get('non-existent');
      cacheService.delete('non-existent');
      notificationService.dismiss('non-existent');
      
      const emptyLogs = logger.getFilteredLogs({ source: 'non-existent' });
      expect(emptyLogs).toEqual([]);
    });

    it('should handle very large payloads efficiently', () => {
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          content: 'x'.repeat(100),
          nested: { value: i }
        }))
      };
      
      const startTime = performance.now();
      
      cacheService.set('large-payload', largeObject);
      const retrieved = cacheService.get('large-payload');
      
      const operationTime = performance.now() - startTime;
      
      expect(operationTime).toBeLessThan(200);
      expect(retrieved?.data).toHaveLength(1000);
    });

    it('should handle special characters in keys and data', () => {
      const specialKeys = [
        'key:with:colons',
        'key.with.dots',
        'key/with/slashes',
        'key\\with\\backslashes',
        'key with spaces',
        'key\nwith\nnewlines',
        'key\twith\ttabs',
        '🔥emoji🔥key🔥',
        '中文键名',
      ];
      
      specialKeys.forEach((key, i) => {
        cacheService.set(key, { value: key, index: i });
      });
      
      specialKeys.forEach((key, i) => {
        const value = cacheService.get(key);
        expect(value?.index).toBe(i);
      });
    });
  });
});
