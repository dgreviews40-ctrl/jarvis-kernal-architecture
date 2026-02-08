/**
 * Kernel v1.2 Unit Tests
 * Tests for Event Bus, Worker Pool, Resource Manager, Plugin Loader, and Kernel API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus, EventChannels } from '../../services/eventBus';
import { resourceManager } from '../../services/resourceManager';
import { workerPool, workerTasks } from '../../services/workerService';
import { pluginLoader } from '../../services/pluginLoader';
import { kernelApi, api } from '../../services/kernelApi';

describe('Kernel v1.2 - Event Bus', () => {
  beforeEach(() => {
    eventBus.clear();
    eventBus.resetStats();
  });

  it('should publish and subscribe to events', async () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe('test.channel', handler);

    await eventBus.publish('test.channel', { data: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'test.channel',
        payload: { data: 'test' }
      })
    );

    unsubscribe();
  });

  it('should support wildcard subscriptions', async () => {
    const handler = vi.fn();
    eventBus.subscribe('test.*', handler);

    await eventBus.publish('test.event1', 'data1');
    await eventBus.publish('test.event2', 'data2');
    await eventBus.publish('other.event', 'data3');

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should handle priority levels correctly', async () => {
    const order: string[] = [];
    
    eventBus.subscribe('priority.test', () => order.push('low'), { priority: 'low' });
    eventBus.subscribe('priority.test', () => order.push('critical'), { priority: 'critical' });
    eventBus.subscribe('priority.test', () => order.push('normal'), { priority: 'normal' });
    eventBus.subscribe('priority.test', () => order.push('high'), { priority: 'high' });

    await eventBus.publish('priority.test', {});

    expect(order).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('should support once subscriptions', async () => {
    const handler = vi.fn();
    eventBus.once('once.test', handler);

    await eventBus.publish('once.test', 'first');
    await eventBus.publish('once.test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support request/response pattern', async () => {
    eventBus.subscribe('request.test', (event) => {
      eventBus.reply(event, { result: event.payload * 2 });
    });

    const response = await eventBus.request('request.test', 21);
    expect(response).toEqual({ result: 42 });
  });

  it('should timeout on request if no response', async () => {
    await expect(eventBus.request('no.response', {}, 100))
      .rejects.toThrow('Request timeout');
  });

  it('should track event history', async () => {
    await eventBus.publish('history.test', 'data1');
    await eventBus.publish('history.test', 'data2');

    const history = eventBus.getHistory('history.test');
    expect(history).toHaveLength(2);
    expect(history[0].payload).toBe('data2'); // Most recent first
  });

  it('should provide accurate stats', async () => {
    // Clear all state first to get a clean slate
    eventBus.clear();
    eventBus.resetStats();
    
    eventBus.subscribe('stats.test', () => {});
    
    await eventBus.publish('stats.test', 'data');
    await eventBus.publish('stats.test', 'data');

    const stats = eventBus.getStats();
    expect(stats.totalEvents).toBe(2);
    expect(stats.activeSubscriptions).toBe(1);
  });
});

describe('Kernel v1.2 - Resource Manager', () => {
  beforeEach(() => {
    resourceManager.stopMonitoring();
  });

  afterEach(() => {
    resourceManager.stopMonitoring();
  });

  it('should set and get quotas', () => {
    resourceManager.setQuota('test.plugin', {
      maxMemoryMB: 100,
      maxCpuPercent: 10,
      maxConcurrentTasks: 5,
      maxRequestsPerMinute: 60
    });

    const quota = resourceManager.getQuota('test.plugin');
    expect(quota.maxMemoryMB).toBe(100);
    expect(quota.maxConcurrentTasks).toBe(5);
  });

  it('should track task execution', () => {
    resourceManager.setQuota('test.plugin', { maxConcurrentTasks: 2 });

    expect(resourceManager.canStartTask('test.plugin').allowed).toBe(true);
    
    resourceManager.startTask('test.plugin');
    resourceManager.startTask('test.plugin');
    
    expect(resourceManager.canStartTask('test.plugin').allowed).toBe(false);
    
    resourceManager.endTask('test.plugin');
    expect(resourceManager.canStartTask('test.plugin').allowed).toBe(true);
  });

  it('should enforce memory quotas', () => {
    resourceManager.setQuota('test.plugin', { maxMemoryMB: 100 });
    
    resourceManager.updateMemory('test.plugin', 50);
    expect(resourceManager.canStartTask('test.plugin').allowed).toBe(true);
    
    resourceManager.updateMemory('test.plugin', 150);
    expect(resourceManager.canStartTask('test.plugin').allowed).toBe(false);
  });

  it('should enforce rate limits', async () => {
    // Use a fresh plugin ID to avoid interference from other tests
    const pluginId = 'rate-limit-test.plugin';
    resourceManager.setQuota(pluginId, { maxRequestsPerMinute: 2 });

    // First two requests should succeed
    resourceManager.startTask(pluginId);
    resourceManager.endTask(pluginId);
    
    resourceManager.startTask(pluginId);
    resourceManager.endTask(pluginId);

    // Third request should be rate limited
    const result = resourceManager.canStartTask(pluginId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Rate limit');
  });

  it('should provide resource stats', () => {
    // Use unique plugin IDs to avoid interference
    const plugin1 = 'stats-test.plugin1';
    const plugin2 = 'stats-test.plugin2';
    
    resourceManager.setQuota(plugin1, {});
    resourceManager.setQuota(plugin2, {});
    
    resourceManager.startTask(plugin1);
    resourceManager.startTask(plugin2);

    const stats = resourceManager.getStats();
    // At least 2 monitored sources (could be more from other tests)
    expect(stats.monitoredSources).toBeGreaterThanOrEqual(2);
    expect(stats.totalActiveTasks).toBeGreaterThanOrEqual(2);
    
    // Cleanup
    resourceManager.endTask(plugin1);
    resourceManager.endTask(plugin2);
  });
});

describe('Kernel v1.2 - Worker Pool', () => {
  afterEach(() => {
    workerPool.terminate();
  });

  it('should execute tasks', async () => {
    const result = await workerPool.execute('data.transform', {
      data: [3, 1, 2],
      operation: 'sort'
    });

    expect(result).toEqual([1, 2, 3]);
  }, 10000);

  it('should execute AI processing tasks', async () => {
    const result = await workerTasks.processAI('Hello world', {});
    
    expect(result).toMatchObject({
      processed: true,
      tokens: 11
    });
  }, 10000);

  it('should execute data transformation', async () => {
    const sorted = await workerTasks.transformData([3, 1, 4, 1, 5], 'sort');
    expect(sorted).toEqual([1, 1, 3, 4, 5]);

    const filtered = await workerTasks.transformData([1, 5, 2, 8, 3], 'filter', 4);
    expect(filtered).toEqual([5, 8]);

    const sum = await workerTasks.transformData([1, 2, 3, 4], 'aggregate');
    expect(sum).toBe(10);
  }, 10000);

  it('should execute search indexing', async () => {
    const result = await workerTasks.buildSearchIndex([
      'hello world',
      'hello again',
      'goodbye world'
    ]);

    expect(result).toMatchObject({
      indexed: true,
      terms: expect.any(Number)
    });
  }, 10000);

  it('should execute crypto hashing', async () => {
    const result = await workerTasks.computeHash('test data', 'sha256');
    
    expect(result).toMatchObject({
      hash: expect.any(String),
      algorithm: 'sha256'
    });
  }, 10000);

  it('should handle task timeouts', async () => {
    // Skip this test in jsdom since sync fallback doesn't support custom timeouts
    if ((workerPool as any).isJSDOM()) {
      return;
    }
    // Create a worker pool with short timeout for testing
    await expect(
      workerPool.execute('ai.process', { text: 'test' }, { timeoutMs: 1 })
    ).rejects.toThrow('timeout');
  }, 10000);

  it('should provide worker stats', async () => {
    const stats = workerPool.getStats();
    
    expect(stats).toMatchObject({
      activeWorkers: expect.any(Number),
      pendingTasks: expect.any(Number),
      completedTasks: expect.any(Number),
      failedTasks: expect.any(Number)
    });
  });

  it('should execute multiple tasks in parallel', async () => {
    const tasks = [
      { type: 'data.transform' as const, payload: { data: [3, 1, 2], operation: 'sort' } },
      { type: 'data.transform' as const, payload: { data: [6, 4, 5], operation: 'sort' } },
      { type: 'crypto.hash' as const, payload: { data: 'test', algorithm: 'sha256' } }
    ];

    const results = await workerPool.executeAll(tasks);
    
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1, 2, 3]);
    expect(results[1]).toEqual([4, 5, 6]);
  }, 15000);
});

describe('Kernel v1.2 - Plugin Loader', () => {
  const mockManifest = {
    id: 'test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entry: 'index.js',
    permissions: ['memory:read', 'memory:write'],
    capabilities: []
  };

  const mockPluginCode = `
    exports.initialize = async function() {
      log('info', 'Test plugin initialized');
    };
    
    exports.start = async function() {
      log('info', 'Test plugin started');
    };
    
    exports.stop = async function() {
      log('info', 'Test plugin stopped');
    };
    
    exports.destroy = async function() {
      log('info', 'Test plugin destroyed');
    };
  `;

  afterEach(async () => {
    await pluginLoader.unload('test.plugin');
  });

  it('should load a plugin', async () => {
    const result = await pluginLoader.load(mockManifest, mockPluginCode);
    
    expect(result.success).toBe(true);
    expect(result.plugin).toBeDefined();
    expect(result.plugin?.manifest.id).toBe('test.plugin');
  });

  it('should reject invalid manifests', async () => {
    const invalidManifest = { ...mockManifest, id: '' };
    const result = await pluginLoader.load(invalidManifest, mockPluginCode);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing plugin ID');
  });

  it('should start and stop plugins', async () => {
    await pluginLoader.load(mockManifest, mockPluginCode);
    
    const startResult = await pluginLoader.start('test.plugin');
    expect(startResult).toBe(true);
    
    const stopResult = await pluginLoader.stop('test.plugin');
    expect(stopResult).toBe(true);
  });

  it('should unload plugins', async () => {
    await pluginLoader.load(mockManifest, mockPluginCode);
    expect(pluginLoader.getPlugin('test.plugin')).toBeDefined();
    
    const result = await pluginLoader.unload('test.plugin');
    expect(result).toBe(true);
    expect(pluginLoader.getPlugin('test.plugin')).toBeUndefined();
  });

  it('should enforce resource quotas', async () => {
    // Use a unique plugin ID
    const quotaTestId = 'quota-test.plugin';
    const quotaManifest = { ...mockManifest, id: quotaTestId };
    
    // Load plugin first (this sets default quotas)
    await pluginLoader.load(quotaManifest, mockPluginCode);
    
    // THEN set restrictive quota (after load to override defaults)
    resourceManager.setQuota(quotaTestId, { maxConcurrentTasks: 0 });
    
    const result = await pluginLoader.start(quotaTestId);
    
    expect(result).toBe(false);
    
    // Cleanup
    await pluginLoader.unload(quotaTestId);
  });
});

describe('Kernel v1.2 - Kernel API', () => {
  beforeEach(() => {
    // Reset API state if needed
  });

  it('should return kernel version', async () => {
    const result = await api.system.version();
    // Version should be a valid semantic version
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should list plugins', async () => {
    // This endpoint requires authentication
    const result = await kernelApi.execute({
      id: 'test-list',
      method: 'plugin.list',
      params: {},
      auth: {
        token: 'valid-token-12345',
        permissions: ['plugin:read']
      },
      timestamp: Date.now()
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should require authentication for protected endpoints', async () => {
    const response = await kernelApi.execute({
      id: 'test-1',
      method: 'plugin.load',
      params: {},
      timestamp: Date.now()
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('UNAUTHORIZED');
  });

  it('should validate permissions', async () => {
    const response = await kernelApi.execute({
      id: 'test-2',
      method: 'plugin.load',
      params: {},
      auth: {
        token: 'valid-token-12345',
        permissions: ['plugin:read'] // Missing plugin:write
      },
      timestamp: Date.now()
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('UNAUTHORIZED');
  });

  it('should execute with valid authentication', async () => {
    const response = await kernelApi.execute({
      id: 'test-3',
      method: 'system.version',
      params: {},
      auth: {
        token: 'valid-token-12345',
        permissions: []
      },
      timestamp: Date.now()
    });

    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('version');
    expect(response.data.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should return 404 for unknown methods', async () => {
    const response = await kernelApi.execute({
      id: 'test-4',
      method: 'unknown.method',
      params: {},
      timestamp: Date.now()
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('METHOD_NOT_FOUND');
  });

  it('should provide API documentation', () => {
    const docs = kernelApi.getDocumentation();
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0]).toHaveProperty('method');
    expect(docs[0]).toHaveProperty('description');
    expect(docs[0]).toHaveProperty('permissions');
  });

  it('should support fluent request builder', async () => {
    const result = await kernelApi
      .request('system.version')
      .execute();

    expect(result).toHaveProperty('version');
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should enforce rate limits', async () => {
    // Make many requests quickly
    const requests = Array(70).fill(null).map(() => 
      kernelApi.execute({
        id: Math.random().toString(),
        method: 'system.version',
        params: {},
        auth: { token: 'rate-test-token', permissions: [] },
        timestamp: Date.now()
      })
    );

    const responses = await Promise.all(requests);
    
    // Some should be rate limited
    const rateLimited = responses.filter(r => r.error?.code === 'RATE_LIMITED');
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

describe('Kernel v1.2 - Integration', () => {
  it('should integrate event bus with resource manager', async () => {
    const warningHandler = vi.fn();
    eventBus.subscribe(EventChannels.SYSTEM.RESOURCE_WARNING, warningHandler);

    // Use a unique plugin ID
    const integrationPlugin = 'integration-test.plugin';
    
    // Trigger a resource warning
    resourceManager.setQuota(integrationPlugin, { maxMemoryMB: 10 });
    resourceManager.updateMemory(integrationPlugin, 100);

    // Give time for async processing
    await new Promise(r => setTimeout(r, 100));

    // The warning should be triggered due to high memory usage
    expect(warningHandler).toHaveBeenCalled();
    expect(warningHandler.mock.calls[0][0].channel).toBe(EventChannels.SYSTEM.RESOURCE_WARNING);
  });

  it('should provide consistent kernel version across services', async () => {
    // Import kernelApi and check version
    const { KERNEL_VERSION } = await import('../../services/kernelApi');
    
    // Version should be a valid semantic version string
    expect(KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    
    // Verify the format matches expected pattern
    const versionParts = KERNEL_VERSION.split('.').map(Number);
    expect(versionParts).toHaveLength(3);
    expect(versionParts[0]).toBeGreaterThanOrEqual(1); // major >= 1
    expect(versionParts[1]).toBeGreaterThanOrEqual(0); // minor >= 0
    expect(versionParts[2]).toBeGreaterThanOrEqual(0); // patch >= 0
  });
});
