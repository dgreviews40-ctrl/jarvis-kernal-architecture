/**
 * Plugin Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registry } from '../../services/registry';
import { PluginManifest, RuntimePlugin } from '../../types';

describe('PluginRegistry', () => {
  beforeEach(() => {
    // Clear any custom plugins added during tests
    const allPlugins = registry.getAll();
    for (const plugin of allPlugins) {
      if (!plugin.manifest.id.startsWith('core.') && 
          !plugin.manifest.id.startsWith('plugin.') &&
          !plugin.manifest.id.startsWith('integration.') &&
          !plugin.manifest.id.startsWith('display.')) {
        registry.unregister(plugin.manifest.id);
      }
    }
  });

  describe('getAll', () => {
    it('should return all core plugins', () => {
      const plugins = registry.getAll();
      
      expect(plugins.length).toBeGreaterThanOrEqual(9); // At least 9 core plugins
      
      // Check for essential core plugins
      const ids = plugins.map(p => p.manifest.id);
      expect(ids).toContain('core.os');
      expect(ids).toContain('core.ai');
      expect(ids).toContain('core.memory');
      expect(ids).toContain('core.network');
    });

    it('should return RuntimePlugin objects', () => {
      const plugins = registry.getAll();
      const plugin = plugins[0];
      
      expect(plugin).toHaveProperty('manifest');
      expect(plugin).toHaveProperty('status');
      expect(plugin).toHaveProperty('loadedAt');
    });
  });

  describe('get', () => {
    it('should return specific plugin by id', () => {
      const plugin = registry.get('core.os');
      
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.id).toBe('core.os');
      expect(plugin?.manifest.name).toBe('System Core');
    });

    it('should return undefined for non-existent plugin', () => {
      const plugin = registry.get('non-existent.plugin');
      
      expect(plugin).toBeUndefined();
    });
  });

  describe('install', () => {
    const testManifest: PluginManifest = {
      id: 'test.custom.plugin',
      name: 'Test Custom Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test',
      permissions: ['READ_MEMORY'],
      provides: ['test_capability'],
      requires: [],
      priority: 50,
      capabilities: ['test']
    };

    it('should install a new plugin', () => {
      registry.install(testManifest);
      
      const plugin = registry.get('test.custom.plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.name).toBe('Test Custom Plugin');
      expect(plugin?.status).toBe('ACTIVE');
    });

    it('should not install duplicate plugin', () => {
      registry.install(testManifest);
      const firstPlugin = registry.get('test.custom.plugin');
      
      registry.install(testManifest);
      const secondPlugin = registry.get('test.custom.plugin');
      
      expect(firstPlugin?.loadedAt).toBe(secondPlugin?.loadedAt);
    });
  });

  describe('register / unregister', () => {
    const testPlugin: RuntimePlugin = {
      manifest: {
        id: 'test.runtime.plugin',
        name: 'Test Runtime Plugin',
        version: '1.0.0',
        description: 'A test runtime plugin',
        author: 'Test',
        permissions: [],
        provides: [],
        requires: [],
        priority: 10,
        capabilities: []
      },
      status: 'DISABLED',
      loadedAt: Date.now(),
      exports: {}
    };

    it('should register a runtime plugin', () => {
      registry.register(testPlugin);
      
      const plugin = registry.get('test.runtime.plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.status).toBe('DISABLED');
    });

    it('should unregister a plugin', () => {
      registry.register(testPlugin);
      expect(registry.get('test.runtime.plugin')).toBeDefined();
      
      registry.unregister('test.runtime.plugin');
      expect(registry.get('test.runtime.plugin')).toBeUndefined();
    });

    it('should handle unregistering non-existent plugin gracefully', () => {
      expect(() => {
        registry.unregister('non-existent.plugin');
      }).not.toThrow();
    });
  });

  describe('setPluginStatus / updateStatus', () => {
    it('should update plugin status', () => {
      const plugin = registry.get('core.os');
      expect(plugin?.status).toBe('ACTIVE');
      
      registry.setPluginStatus('core.os', 'DISABLED');
      
      const updated = registry.get('core.os');
      expect(updated?.status).toBe('DISABLED');
      
      // Reset to ACTIVE
      registry.setPluginStatus('core.os', 'ACTIVE');
    });

    it('should not fail for non-existent plugin', () => {
      expect(() => {
        registry.setPluginStatus('non-existent', 'DISABLED');
      }).not.toThrow();
    });
  });

  describe('togglePlugin', () => {
    it('should toggle plugin status', () => {
      // Ensure starting state is ACTIVE
      registry.setPluginStatus('core.network', 'ACTIVE');
      
      registry.togglePlugin('core.network');
      let plugin = registry.get('core.network');
      expect(plugin?.status).toBe('DISABLED');
      
      registry.togglePlugin('core.network');
      plugin = registry.get('core.network');
      expect(plugin?.status).toBe('ACTIVE');
    });

    it('should not fail for non-existent plugin', () => {
      expect(() => {
        registry.togglePlugin('non-existent');
      }).not.toThrow();
    });
  });

  describe('findProviderForCapability', () => {
    it('should find plugin providing capability', () => {
      const provider = registry.findProviderForCapability('os_level_control');
      expect(provider).toBe('core.os');
    });

    it('should find plugin by capability', () => {
      const provider = registry.findProviderForCapability('natural_language');
      expect(provider).toBe('core.ai');
    });

    it('should return null for unprovided capability', () => {
      const provider = registry.findProviderForCapability('non_existent_capability');
      expect(provider).toBeNull();
    });

    it('should not return disabled plugins', () => {
      // Disable a plugin and verify it's not returned
      registry.setPluginStatus('core.ai', 'DISABLED');
      
      const provider = registry.findProviderForCapability('natural_language');
      expect(provider).toBeNull();
      
      // Re-enable
      registry.setPluginStatus('core.ai', 'ACTIVE');
    });
  });

  describe('start / stop', () => {
    it('should start a plugin', async () => {
      registry.setPluginStatus('plugin.weather', 'DISABLED');
      
      const result = await registry.start('plugin.weather');
      expect(result).toBe(true);
      
      const plugin = registry.get('plugin.weather');
      expect(plugin?.status).toBe('ACTIVE');
    });

    it('should stop a plugin', async () => {
      const result = await registry.stop('plugin.weather');
      expect(result).toBe(true);
      
      const plugin = registry.get('plugin.weather');
      expect(plugin?.status).toBe('DISABLED');
      
      // Re-enable
      await registry.start('plugin.weather');
    });

    it('should return false for non-existent plugin', async () => {
      const startResult = await registry.start('non-existent');
      const stopResult = await registry.stop('non-existent');
      
      expect(startResult).toBe(false);
      expect(stopResult).toBe(false);
    });
  });

  describe('updateManifest', () => {
    it('should update plugin manifest', async () => {
      const original = registry.get('core.network');
      const originalVersion = original?.manifest.version;
      
      const newManifest: PluginManifest = {
        ...original!.manifest,
        version: '2.0.0',
        description: 'Updated description'
      };
      
      const result = await registry.updateManifest('core.network', newManifest);
      expect(result).toBe(true);
      
      const updated = registry.get('core.network');
      expect(updated?.manifest.version).toBe('2.0.0');
      expect(updated?.manifest.description).toBe('Updated description');
      
      // Restore original
      await registry.updateManifest('core.network', original!.manifest);
    });

    it('should return false for non-existent plugin', async () => {
      const result = await registry.updateManifest('non-existent', {} as PluginManifest);
      expect(result).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers of changes', () => {
      const callback = vi.fn();
      const unsubscribe = registry.subscribe(callback);
      
      // Trigger a change
      registry.setPluginStatus('core.os', 'DISABLED');
      
      expect(callback).toHaveBeenCalled();
      
      // Cleanup
      unsubscribe();
      registry.setPluginStatus('core.os', 'ACTIVE');
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = registry.subscribe(callback);
      
      unsubscribe();
      
      // Trigger a change after unsubscribe
      const callCount = callback.mock.calls.length;
      registry.setPluginStatus('core.os', 'DISABLED');
      
      expect(callback.mock.calls.length).toBe(callCount);
      
      // Cleanup
      registry.setPluginStatus('core.os', 'ACTIVE');
    });
  });

  describe('restore', () => {
    it('should restore plugin states', () => {
      const states = {
        'core.os': 'ACTIVE' as const,
        'core.ai': 'DISABLED' as const,
        'core.network': 'PAUSED' as const
      };
      
      registry.restore(states);
      
      expect(registry.get('core.os')?.status).toBe('ACTIVE');
      expect(registry.get('core.ai')?.status).toBe('DISABLED');
      expect(registry.get('core.network')?.status).toBe('PAUSED');
      
      // Restore to normal
      registry.setPluginStatus('core.ai', 'ACTIVE');
      registry.setPluginStatus('core.network', 'ACTIVE');
    });
  });
});
