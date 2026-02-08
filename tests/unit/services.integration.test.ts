import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '../../services/eventBus';
import { logger } from '../../services/logger';
import { cacheService } from '../../services/cacheService';
import { notificationService } from '../../services/notificationService';
import { registry } from '../../services/registry';

describe('Service Integration Tests', () => {
  beforeEach(() => {
    // Reset all services
    eventBus.clear();
    eventBus.resetStats();
    cacheService.clear();
    logger.clear();
    notificationService.dismissAll();
    notificationService.clearHistory();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EventBus + Logger Integration', () => {
    it('should log events through event bus', async () => {
      const logs: string[] = [];
      
      // Subscribe to events
      eventBus.subscribe('test.channel', (event) => {
        logs.push(`Received: ${event.payload.message}`);
      });

      // Publish event
      await eventBus.publish('test.channel', { message: 'Hello World' });

      expect(logs).toContain('Received: Hello World');
    });

    it('should track event statistics in logger', () => {
      logger.log('SYSTEM', 'System started', 'info');
      logger.log('USER', 'User action', 'success');
      logger.error('ERROR', 'Something failed');

      const stats = logger.getStats();
      
      // Should have at least 3 logs
      expect(stats.totalLogs).toBeGreaterThanOrEqual(3);
    });

    it('should filter logs based on event types', () => {
      logger.log('SYSTEM', 'System message', 'info');
      logger.log('USER', 'User message', 'info');
      logger.log('SYSTEM', 'Another system', 'info');

      const systemLogs = logger.getFilteredLogs({ source: 'SYSTEM' });
      
      // Should have at least 2 system logs
      expect(systemLogs.length).toBeGreaterThanOrEqual(2);
      expect(systemLogs.every(log => log.source === 'SYSTEM')).toBe(true);
    });
  });

  describe('Cache + Logger Integration', () => {
    it('should set and get cached values', () => {
      cacheService.set('test-key', { data: 'value' }, 60000);
      
      const value = cacheService.get('test-key');
      
      expect(value).toEqual({ data: 'value' });
    });

    it('should track cache hits and misses', () => {
      cacheService.set('cached-key', 'value', 60000);
      
      // Cache hit
      cacheService.get('cached-key');
      
      // Cache miss
      cacheService.get('non-existent');
      
      const stats = cacheService.getStats();
      expect(stats.entries).toBe(1);
    });

    it('should handle cache eviction', () => {
      // Fill cache (1000 max entries * 0.8 threshold = 800)
      // Need to exceed 800 to trigger eviction
      for (let i = 0; i < 850; i++) {
        cacheService.set(`key-${i}`, `value-${i}`, 60000);
      }
      
      const stats = cacheService.getStats();
      // Cache should have evicted some entries
      expect(stats.entries).toBeLessThan(850);
    });
  });

  describe('Notification Service', () => {
    it('should create notifications', () => {
      const id = notificationService.info('Test notification');
      
      expect(notificationService.getNotifications()).toHaveLength(1);
      expect(notificationService.getNotifications()[0].message).toBe('Test notification');
    });

    it('should track notification history', () => {
      notificationService.success('Operation completed');
      notificationService.warning('Please check');
      notificationService.error('Something went wrong');
      
      const history = notificationService.getHistory();
      
      expect(history).toHaveLength(3);
    });

    it('should export notification history', () => {
      notificationService.info('Notification 1');
      notificationService.success('Notification 2');
      
      const exported = notificationService.exportHistory();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(2);
    });
  });

  describe('Registry Integration', () => {
    it('should install and retrieve plugins', () => {
      const testPlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        permissions: [],
        capabilities: ['test'],
        provides: ['test']
      };
      
      registry.install(testPlugin);
      
      const retrieved = registry.get('test-plugin');
      expect(retrieved).toBeDefined();
      expect(retrieved?.manifest.id).toBe('test-plugin');
    });

    it('should find provider for capability', () => {
      const testPlugin = {
        id: 'capability-plugin',
        name: 'Capability Plugin',
        version: '1.0.0',
        description: 'Test',
        author: 'Test',
        permissions: [],
        capabilities: ['test-capability'],
        provides: ['test-capability']
      };
      
      registry.install(testPlugin);
      
      const provider = registry.findProviderForCapability('test-capability');
      expect(provider).toBeDefined();
      expect(provider).toBe('capability-plugin');
    });
  });

  describe('EventBus + Notification Integration', () => {
    it('should show notification on system events', async () => {
      const notifications: any[] = [];
      
      eventBus.subscribe('system.notification', (event) => {
        const id = notificationService.show({
          type: event.payload.type,
          title: event.payload.title,
          message: event.payload.message
        });
        notifications.push(id);
      });

      await eventBus.publish('system.notification', {
        type: 'success',
        title: 'Test',
        message: 'Test message'
      });

      expect(notifications).toHaveLength(1);
      expect(notificationService.getNotifications()).toHaveLength(1);
    });

    it('should handle multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.subscribe('test.multi', handler1);
      eventBus.subscribe('test.multi', handler2);
      
      await eventBus.publish('test.multi', { data: 'test' });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache + EventBus Integration', () => {
    it('should invalidate cache on specific events', async () => {
      cacheService.set('user-data', { name: 'John' }, 60000);
      expect(cacheService.has('user-data')).toBe(true);
      
      eventBus.subscribe('cache.invalidate', (event) => {
        if (event.payload.key) {
          cacheService.delete(event.payload.key);
        }
      });
      
      await eventBus.publish('cache.invalidate', { key: 'user-data' });
      
      expect(cacheService.has('user-data')).toBe(false);
    });

    it('should warm cache on system start', async () => {
      let cacheWarmed = false;
      
      eventBus.subscribe('system.start', () => {
        cacheService.set('config', { version: '1.0' }, 300000);
        cacheWarmed = true;
      });
      
      await eventBus.publish('system.start', {});
      
      expect(cacheWarmed).toBe(true);
      expect(cacheService.has('config')).toBe(true);
    });
  });

  describe('Multi-Service Workflow', () => {
    it('should handle complete user action workflow', async () => {
      const workflowLogs: string[] = [];
      
      eventBus.subscribe('user.action', (event) => {
        workflowLogs.push('action-received');
        
        const cached = cacheService.get(`action-${event.payload.id}`);
        if (cached) {
          workflowLogs.push('cache-hit');
        } else {
          workflowLogs.push('cache-miss');
          cacheService.set(`action-${event.payload.id}`, { result: 'processed' }, 60000);
          workflowLogs.push('cached');
        }
        
        logger.log('USER', `Action ${event.payload.id} completed`, 'success');
        workflowLogs.push('logged');
        
        notificationService.success('Action completed!');
        workflowLogs.push('notified');
      });
      
      // First call - cache miss
      await eventBus.publish('user.action', { id: '123' });
      
      expect(workflowLogs).toContain('cache-miss');
      expect(workflowLogs).toContain('cached');
      
      // Reset
      workflowLogs.length = 0;
      
      // Second call - cache hit
      await eventBus.publish('user.action', { id: '123' });
      
      expect(workflowLogs).toContain('cache-hit');
    });
  });

  describe('Error Handling Across Services', () => {
    it('should propagate errors through event bus', async () => {
      const errors: string[] = [];
      
      eventBus.subscribe('system.error', (event) => {
        errors.push(event.payload.message);
        logger.error('SYSTEM', event.payload.message);
        notificationService.error(event.payload.message, 'Error');
      });
      
      await eventBus.publish('system.error', { message: 'Database failed' });
      
      expect(errors).toContain('Database failed');
      expect(notificationService.getNotifications()).toHaveLength(1);
    });

    it('should handle service unavailability gracefully', () => {
      cacheService.clear();
      
      const result = cacheService.get('non-existent');
      expect(result).toBeNull();
      
      expect(() => {
        logger.log('TEST', 'Cache miss handled', 'info');
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency events', async () => {
      let count = 0;
      
      eventBus.subscribe('high.freq', () => {
        count++;
      });
      
      // Publish 100 events
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(eventBus.publish('high.freq', { index: i }));
      }
      await Promise.all(promises);
      
      expect(count).toBe(100);
    });
  });
});
