/**
 * Logger Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, LogLevel, LogSource } from '../../services/logger';
import { LogEntry } from '../../types';

describe('LoggerService', () => {
  beforeEach(() => {
    logger.clear();
    logger.setConfig({
      maxLogs: 1000,
      autoCleanup: false,
      persistLogs: false,
      enableConsole: false,
      enableCortex: false
    });
  });

  describe('Basic Logging', () => {
    it('should log a message', () => {
      const entry = logger.log('SYSTEM', 'Test message', 'info');
      
      expect(entry).toBeDefined();
      expect(entry.message).toBe('Test message');
      expect(entry.source).toBe('SYSTEM');
      expect(entry.type).toBe('info');
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should log with default type info', () => {
      const entry = logger.log('SYSTEM', 'Test message');
      expect(entry.type).toBe('info');
    });

    it('should log with details', () => {
      const details = { key: 'value', number: 42 };
      const entry = logger.log('SYSTEM', 'Test message', 'info', details);
      
      expect(entry.details).toEqual(details);
    });

    it('should support convenience methods', () => {
      const infoEntry = logger.info('SYSTEM', 'Info message');
      expect(infoEntry.type).toBe('info');
      
      const successEntry = logger.success('SYSTEM', 'Success message');
      expect(successEntry.type).toBe('success');
      
      const warningEntry = logger.warning('SYSTEM', 'Warning message');
      expect(warningEntry.type).toBe('warning');
      
      const errorEntry = logger.error('SYSTEM', 'Error message');
      expect(errorEntry.type).toBe('error');
    });
  });

  describe('getAll / getRecent', () => {
    it('should return all logs', () => {
      logger.log('SYSTEM', 'Message 1');
      logger.log('SYSTEM', 'Message 2');
      logger.log('SYSTEM', 'Message 3');
      
      const logs = logger.getAll();
      expect(logs.length).toBe(3);
    });

    it('should return recent logs', () => {
      logger.log('SYSTEM', 'Message 1');
      logger.log('SYSTEM', 'Message 2');
      logger.log('SYSTEM', 'Message 3');
      
      const logs = logger.getRecent(2);
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[1].message).toBe('Message 3');
    });

    it('should return empty array when no logs', () => {
      const logs = logger.getAll();
      expect(logs).toEqual([]);
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      logger.log('SYSTEM', 'System message', 'info');
      logger.log('PLUGIN', 'Plugin message', 'success');
      logger.log('SYSTEM', 'System warning', 'warning');
      logger.log('AI', 'AI error', 'error');
    });

    it('should filter by level', () => {
      const logs = logger.getFilteredLogs({ level: 'error' });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('AI error');
    });

    it('should filter by source', () => {
      const logs = logger.getFilteredLogs({ source: 'SYSTEM' });
      expect(logs.length).toBe(2);
      expect(logs.every(l => l.source === 'SYSTEM')).toBe(true);
    });

    it('should filter by search query', () => {
      const logs = logger.getFilteredLogs({ searchQuery: 'warning' });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('System warning');
    });

    it('should filter by multiple criteria', () => {
      const logs = logger.getFilteredLogs({ 
        source: 'SYSTEM',
        level: 'info'
      });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('System message');
    });

    it('should search in details', () => {
      logger.log('SYSTEM', 'Message with details', 'info', { errorCode: 'ERR_001' });
      
      const logs = logger.getFilteredLogs({ searchQuery: 'ERR_001' });
      expect(logs.length).toBe(1);
    });

    it('should return all logs when filter is empty', () => {
      const logs = logger.getFilteredLogs({});
      expect(logs.length).toBe(4);
    });
  });

  describe('Time-based Filtering', () => {
    it('should filter by start time', async () => {
      logger.log('SYSTEM', 'Message 1');
      await new Promise(r => setTimeout(r, 10));
      const middle = Date.now();
      await new Promise(r => setTimeout(r, 10));
      logger.log('SYSTEM', 'Message 2');
      
      const logs = logger.getFilteredLogs({ startTime: middle });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[logs.length - 1].message).toBe('Message 2');
    });

    it('should filter by end time', async () => {
      logger.log('SYSTEM', 'Message 1');
      await new Promise(r => setTimeout(r, 10));
      const middle = Date.now();
      await new Promise(r => setTimeout(r, 10));
      logger.log('SYSTEM', 'Message 2');
      
      const logs = logger.getFilteredLogs({ endTime: middle });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].message).toBe('Message 1');
    });
  });

  describe('Search', () => {
    it('should search logs', () => {
      logger.log('SYSTEM', 'First message');
      logger.log('PLUGIN', 'Second message');
      logger.log('SYSTEM', 'Third msg');
      
      const results = logger.search('message');
      expect(results.length).toBe(2);
    });
  });

  describe('Stats', () => {
    it('should return log statistics', () => {
      logger.log('SYSTEM', 'Info 1', 'info');
      logger.log('SYSTEM', 'Info 2', 'info');
      logger.log('PLUGIN', 'Success', 'success');
      logger.log('AI', 'Warning', 'warning');
      logger.log('AI', 'Error', 'error');
      
      const stats = logger.getStats();
      
      expect(stats.totalLogs).toBe(5);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.success).toBe(1);
      expect(stats.byLevel.warning).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.bySource.SYSTEM).toBe(2);
      expect(stats.bySource.PLUGIN).toBe(1);
      expect(stats.bySource.AI).toBe(2);
    });

    it('should return zero stats for empty logs', () => {
      const stats = logger.getStats();
      
      expect(stats.totalLogs).toBe(0);
      expect(stats.oldestLog).toBe(0);
      expect(stats.newestLog).toBe(0);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all logs', () => {
      logger.log('SYSTEM', 'Message 1');
      logger.log('SYSTEM', 'Message 2');
      
      logger.clear();
      
      expect(logger.getAll().length).toBe(0);
    });

    it('should clear by filter', () => {
      logger.log('SYSTEM', 'Message 1', 'info');
      logger.log('SYSTEM', 'Message 2', 'error');
      logger.log('PLUGIN', 'Message 3', 'info');
      
      const removed = logger.clearByFilter({ level: 'error' });
      
      expect(removed).toBe(1);
      expect(logger.getAll().length).toBe(2);
    });

    it('should delete specific log', () => {
      const entry = logger.log('SYSTEM', 'Message');
      
      const deleted = logger.deleteLog(entry.id);
      
      expect(deleted).toBe(true);
      expect(logger.getAll().length).toBe(0);
    });

    it('should return false when deleting non-existent log', () => {
      const deleted = logger.deleteLog('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = logger.getConfig();
      
      expect(config).toHaveProperty('maxLogs');
      expect(config).toHaveProperty('autoCleanup');
      expect(config).toHaveProperty('persistLogs');
    });

    it('should update config', () => {
      logger.setConfig({ maxLogs: 500 });
      
      const config = logger.getConfig();
      expect(config.maxLogs).toBe(500);
    });

    it('should trim logs when maxLogs is reduced', () => {
      // Add 10 logs
      for (let i = 0; i < 10; i++) {
        logger.log('SYSTEM', `Message ${i}`);
      }
      
      logger.setConfig({ maxLogs: 5 });
      
      expect(logger.getAll().length).toBeLessThanOrEqual(5);
    });
  });

  describe('Subscribe', () => {
    it('should notify subscribers of changes', () => {
      const callback = vi.fn();
      const unsubscribe = logger.subscribe(callback);
      
      logger.log('SYSTEM', 'Test');
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = logger.subscribe(callback);
      
      unsubscribe();
      
      const callCount = callback.mock.calls.length;
      logger.log('SYSTEM', 'Test');
      
      expect(callback.mock.calls.length).toBe(callCount);
    });

    it('should call subscriber immediately with current logs', () => {
      logger.log('SYSTEM', 'Existing');
      
      const callback = vi.fn();
      logger.subscribe(callback);
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Filter Observers', () => {
    it('should notify filter observers', () => {
      const callback = vi.fn();
      const unsubscribe = logger.subscribeToFilter(callback);
      
      logger.setFilter({ level: 'info' });
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
    });
  });

  describe('Debug method', () => {
    it('should not store debug messages', () => {
      logger.debug('SYSTEM', 'Debug message');
      
      const logs = logger.getAll();
      const debugLogs = logs.filter(l => l.message === 'Debug message');
      expect(debugLogs.length).toBe(0);
    });
  });
});
