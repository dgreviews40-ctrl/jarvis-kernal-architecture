/**
 * Plugin Registry v2
 * 
 * Manages plugin lifecycle, dependencies, and capability registry.
 */

import {
  PluginManifestV2,
  RuntimePluginV2,
  PluginState,
  Capability,
  PluginAPI,
  PluginLifecycle,
  PluginEventMap
} from './types';
import { logger } from '../services/logger';

// In-memory storage for plugins
const plugins = new Map<string, RuntimePluginV2>();
const capabilities = new Map<string, Map<string, Capability>>(); // capability -> pluginId -> Capability
const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

// Event emitter
function emit<K extends keyof PluginEventMap>(event: K, data: PluginEventMap[K]): void {
  const handlers = eventHandlers.get(event);
  if (handlers) {
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        logger.error('PLUGIN', `Event handler error for ${event}`, { error: err });
      }
    });
  }
}

// Subscribe to events
export function onEvent<K extends keyof PluginEventMap>(
  event: K,
  handler: (data: PluginEventMap[K]) => void
): () => void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  const handlers = eventHandlers.get(event)!;
  const wrappedHandler = handler as (data: unknown) => void;
  handlers.add(wrappedHandler);
  
  return () => {
    handlers.delete(wrappedHandler);
  };
}

// Get all plugins
export function getAllPlugins(): RuntimePluginV2[] {
  return Array.from(plugins.values());
}

// Get plugin by ID
export function getPlugin(pluginId: string): RuntimePluginV2 | undefined {
  return plugins.get(pluginId);
}

// Check if plugin exists
export function hasPlugin(pluginId: string): boolean {
  return plugins.has(pluginId);
}

// Initialize built-in plugins from the legacy registry
// This ensures marketplace shows installed state for built-in plugins
export function initializeBuiltInPlugins(builtInManifests: PluginManifestV2[]): void {
  for (const manifest of builtInManifests) {
    if (plugins.has(manifest.id)) {
      continue; // Already registered
    }

    // Create runtime plugin in active state (since they're built-in)
    const plugin: RuntimePluginV2 = {
      manifest,
      state: 'active',
      config: {},
      installedAt: Date.now(),
      loadedAt: Date.now(),
      startedAt: Date.now(),
      apiCalls: 0
    };

    plugins.set(manifest.id, plugin);

    // Register capabilities
    manifest.provides.forEach(cap => {
      if (!capabilities.has(cap.name)) {
        capabilities.set(cap.name, new Map());
      }
      capabilities.get(cap.name)!.set(manifest.id, cap);
    });

    logger.success('PLUGIN', `Initialized built-in plugin: ${manifest.id} v${manifest.version}`);
  }
}

// Register a plugin manifest
export async function registerPlugin(manifest: PluginManifestV2): Promise<boolean> {
  if (plugins.has(manifest.id)) {
    logger.warning('PLUGIN', `Plugin ${manifest.id} already registered`);
    return false;
  }

  // Validate manifest
  if (!validateManifest(manifest)) {
    return false;
  }

  // Check dependencies
  const depsValid = await checkDependencies(manifest);
  if (!depsValid) {
    logger.error('PLUGIN', `Dependencies not satisfied for ${manifest.id}`);
    return false;
  }

  // Create runtime plugin
  const plugin: RuntimePluginV2 = {
    manifest,
    state: 'installed',
    config: loadConfig(manifest.id, manifest.configSchema),
    installedAt: Date.now(),
    apiCalls: 0
  };

  plugins.set(manifest.id, plugin);
  
  // Register capabilities
  manifest.provides.forEach(cap => {
    registerCapability(manifest.id, cap);
  });

  logger.success('PLUGIN', `Registered ${manifest.id} v${manifest.version}`);
  emit('plugin:installed', { pluginId: manifest.id });
  
  return true;
}

// Load a plugin
export async function loadPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) {
    logger.error('PLUGIN', `Plugin ${pluginId} not found`);
    return false;
  }

  if (plugin.state !== 'installed') {
    logger.warning('PLUGIN', `Plugin ${pluginId} is not in installed state`);
    return false;
  }

  plugin.state = 'loading';
  
  try {
    // TODO: Load plugin code from entry point
    // For now, just mark as loaded
    plugin.state = 'loaded';
    plugin.loadedAt = Date.now();
    
    logger.success('PLUGIN', `Loaded ${pluginId}`);
    emit('plugin:loaded', { pluginId });
    return true;
  } catch (err) {
    plugin.state = 'error';
    plugin.lastError = {
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: Date.now()
    };
    logger.error('PLUGIN', `Failed to load ${pluginId}`, { error: err });
    return false;
  }
}

// Start a plugin
export async function startPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  if (plugin.state !== 'loaded' && plugin.state !== 'paused') {
    logger.warning('PLUGIN', `Plugin ${pluginId} cannot be started from state ${plugin.state}`);
    return false;
  }

  plugin.state = 'starting';
  
  try {
    // TODO: Call plugin's onStart lifecycle hook
    plugin.state = 'active';
    plugin.startedAt = Date.now();
    
    logger.success('PLUGIN', `Started ${pluginId}`);
    emit('plugin:started', { pluginId });
    return true;
  } catch (err) {
    plugin.state = 'error';
    plugin.lastError = {
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: Date.now()
    };
    logger.error('PLUGIN', `Failed to start ${pluginId}`, { error: err });
    return false;
  }
}

// Stop a plugin
export async function stopPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  if (plugin.state !== 'active') {
    return false;
  }

  plugin.state = 'stopping';
  
  try {
    // TODO: Call plugin's onStop lifecycle hook
    plugin.state = 'loaded';
    
    logger.info('PLUGIN', `Stopped ${pluginId}`);
    emit('plugin:stopped', { pluginId });
    return true;
  } catch (err) {
    plugin.state = 'error';
    plugin.lastError = {
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: Date.now()
    };
    return false;
  }
}

// Unload a plugin
export async function unloadPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  // Stop first if active
  if (plugin.state === 'active') {
    await stopPlugin(pluginId);
  }

  try {
    // TODO: Call plugin's onUnload lifecycle hook
    
    // Unregister capabilities
    plugin.manifest.provides.forEach(cap => {
      unregisterCapability(pluginId, cap.name);
    });
    
    plugin.state = 'installed';
    delete plugin.loadedAt;
    delete plugin.startedAt;
    
    logger.info('PLUGIN', `Unloaded ${pluginId}`);
    return true;
  } catch (err) {
    plugin.state = 'error';
    plugin.lastError = {
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: Date.now()
    };
    return false;
  }
}

// Uninstall a plugin
export async function uninstallPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  plugin.state = 'uninstalling';
  
  // Unload first
  await unloadPlugin(pluginId);
  
  // Remove from registry
  plugins.delete(pluginId);
  
  // Clear config
  localStorage.removeItem(`plugin_config_${pluginId}`);
  
  logger.success('PLUGIN', `Uninstalled ${pluginId}`);
  emit('plugin:uninstalled', { pluginId });
  return true;
}

// Update plugin config
export function updatePluginConfig(pluginId: string, config: Record<string, unknown>): boolean {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  plugin.config = { ...plugin.config, ...config };
  
  // Persist config
  localStorage.setItem(`plugin_config_${pluginId}`, JSON.stringify(plugin.config));
  
  // TODO: Notify plugin of config change
  logger.info('PLUGIN', `Updated config for ${pluginId}`);
  return true;
}

// Register a capability
function registerCapability(pluginId: string, capability: Capability): void {
  if (!capabilities.has(capability.name)) {
    capabilities.set(capability.name, new Map());
  }
  capabilities.get(capability.name)!.set(pluginId, capability);
  emit('capability:registered', { pluginId, capability: capability.name });
}

// Unregister a capability
function unregisterCapability(pluginId: string, capabilityName: string): void {
  const capMap = capabilities.get(capabilityName);
  if (capMap) {
    capMap.delete(pluginId);
    if (capMap.size === 0) {
      capabilities.delete(capabilityName);
    }
    emit('capability:unregistered', { pluginId, capability: capabilityName });
  }
}

// Find plugins providing a capability
export function findCapabilityProviders(capabilityName: string): Array<{ pluginId: string; capability: Capability }> {
  const capMap = capabilities.get(capabilityName);
  if (!capMap) return [];
  
  return Array.from(capMap.entries()).map(([pluginId, capability]) => ({
    pluginId,
    capability
  }));
}

// Validate manifest
function validateManifest(manifest: PluginManifestV2): boolean {
  if (!manifest.id || !manifest.name || !manifest.version) {
    logger.error('PLUGIN', 'Invalid manifest: missing required fields');
    return false;
  }
  
  // Validate ID format (alphanumeric, dots, hyphens)
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(manifest.id)) {
    logger.error('PLUGIN', `Invalid plugin ID: ${manifest.id}`);
    return false;
  }
  
  return true;
}

// Check dependencies
async function checkDependencies(manifest: PluginManifestV2): Promise<boolean> {
  for (const dep of manifest.dependencies) {
    const plugin = plugins.get(dep.pluginId);
    if (!plugin) {
      if (!dep.optional) {
        logger.error('PLUGIN', `Required dependency ${dep.pluginId} not found for ${manifest.id}`);
        return false;
      }
      continue;
    }
    
    // TODO: Check version range compatibility
    const installedVersion = plugin.manifest.version;
    if (!satisfiesVersion(installedVersion, dep.versionRange)) {
      logger.error('PLUGIN', `Dependency ${dep.pluginId} version ${installedVersion} does not satisfy ${dep.versionRange}`);
      return false;
    }
  }
  
  return true;
}

// Simple version check (TODO: implement proper semver)
function satisfiesVersion(version: string, range: string): boolean {
  // For now, just check exact match or wildcard
  if (range === '*') return true;
  return version === range;
}

// Load config from localStorage
function loadConfig(pluginId: string, schema?: Record<string, { default?: unknown }>): Record<string, unknown> {
  const saved = localStorage.getItem(`plugin_config_${pluginId}`);
  const config: Record<string, unknown> = {};
  
  // Apply defaults from schema
  if (schema) {
    Object.entries(schema).forEach(([key, field]) => {
      if (field.default !== undefined) {
        config[key] = field.default;
      }
    });
  }
  
  // Override with saved config
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(config, parsed);
    } catch {
      logger.warning('PLUGIN', `Failed to parse config for ${pluginId}`);
    }
  }
  
  return config;
}

// Create API for a plugin
export function createPluginAPI(pluginId: string): PluginAPI {
  const plugin = plugins.get(pluginId);
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  const hasPermission = (perm: string): boolean => {
    return plugin.manifest.permissions.includes(perm as any);
  };

  return {
    pluginId,
    version: plugin.manifest.version,
    
    log: (level, message, meta) => {
      plugin.apiCalls++;
      // Map plugin log levels to system log levels
      const levelMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
        'info': 'info',
        'success': 'success',
        'warn': 'warning',
        'warning': 'warning',
        'error': 'error',
        'debug': 'info'
      };
      logger.log('PLUGIN', `[${pluginId}] ${message}`, levelMap[level] || 'info', meta);
    },
    
    memory: {
      recall: async (query, limit = 5) => {
        if (!hasPermission('memory:read')) {
          throw new Error('Permission denied: memory:read');
        }
        plugin.apiCalls++;
        // TODO: Implement via memory service
        return [];
      },
      store: async (content, tags) => {
        if (!hasPermission('memory:write')) {
          throw new Error('Permission denied: memory:write');
        }
        plugin.apiCalls++;
        // TODO: Implement via memory service
      }
    },
    
    network: {
      fetch: async (url, options) => {
        if (!hasPermission('network:fetch')) {
          throw new Error('Permission denied: network:fetch');
        }
        plugin.apiCalls++;
        return fetch(url, options);
      },
      createWebSocket: (url) => {
        if (!hasPermission('network:websocket')) {
          throw new Error('Permission denied: network:websocket');
        }
        plugin.apiCalls++;
        return new WebSocket(url);
      }
    },
    
    system: {
      notify: (title, message) => {
        if (!hasPermission('system:notification')) {
          throw new Error('Permission denied: system:notification');
        }
        plugin.apiCalls++;
        // TODO: Implement notification service
      },
      clipboard: {
        read: async () => {
          if (!hasPermission('system:clipboard')) {
            throw new Error('Permission denied: system:clipboard');
          }
          plugin.apiCalls++;
          return navigator.clipboard.readText();
        },
        write: async (text) => {
          if (!hasPermission('system:clipboard')) {
            throw new Error('Permission denied: system:clipboard');
          }
          plugin.apiCalls++;
          await navigator.clipboard.writeText(text);
        }
      }
    },
    
    on: (event, handler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
      
      return () => {
        eventHandlers.get(event)?.delete(handler);
      };
    },
    
    emit: (event, data) => {
      plugin.apiCalls++;
      emit(event as keyof PluginEventMap, data as any);
    },
    
    callCapability: async (targetPluginId, capability, params) => {
      plugin.apiCalls++;
      const target = plugins.get(targetPluginId);
      if (!target) {
        throw new Error(`Plugin ${targetPluginId} not found`);
      }
      if (target.state !== 'active') {
        throw new Error(`Plugin ${targetPluginId} is not active`);
      }
      
      // Check if target provides the capability
      const providesCapability = target.manifest.provides.some(c => c.name === capability);
      if (!providesCapability) {
        throw new Error(`Plugin ${targetPluginId} does not provide capability ${capability}`);
      }
      
      // TODO: Implement capability call
      return null;
    }
  };
}
