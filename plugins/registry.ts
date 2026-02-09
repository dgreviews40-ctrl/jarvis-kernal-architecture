/**
 * Plugin Registry v2
 * 
 * Manages plugin lifecycle, dependencies, and capability registry.
 * INTEGRATES with Plugin Loader for secure sandboxed execution.
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
import * as pluginLoader from './loader';
import { createSecurePluginAPI } from '../services/securePluginApi';
import { notificationService } from '../services/notificationService';

// Plugin Network Rate Limiter - Token bucket per plugin
// Prevents abuse and protects external APIs from excessive calls
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  requestsThisMinute: number;
  minuteStart: number;
}

const PLUGIN_RATE_LIMIT = {
  // Per-plugin burst limit (requests per second)
  burstLimit: 10,
  // Sustained rate (requests per minute)
  sustainedLimit: 60,
  // Token refill rate (tokens per second)
  refillRate: 2,
  // Cooldown after hitting limit (ms)
  cooldownMs: 5000,
};

const pluginRateLimits = new Map<string, RateLimitBucket>();

function getRateLimitBucket(pluginId: string): RateLimitBucket {
  if (!pluginRateLimits.has(pluginId)) {
    const now = Date.now();
    pluginRateLimits.set(pluginId, {
      tokens: PLUGIN_RATE_LIMIT.burstLimit,
      lastRefill: now,
      requestsThisMinute: 0,
      minuteStart: now,
    });
  }
  return pluginRateLimits.get(pluginId)!;
}

function refillTokens(bucket: RateLimitBucket): void {
  const now = Date.now();
  const secondsPassed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    PLUGIN_RATE_LIMIT.burstLimit,
    bucket.tokens + secondsPassed * PLUGIN_RATE_LIMIT.refillRate
  );
  bucket.lastRefill = now;
  
  // Reset minute counter if needed
  if (now - bucket.minuteStart > 60000) {
    bucket.requestsThisMinute = 0;
    bucket.minuteStart = now;
  }
}

function checkPluginRateLimit(pluginId: string): { allowed: boolean; retryAfterMs?: number } {
  const bucket = getRateLimitBucket(pluginId);
  refillTokens(bucket);
  
  // Check sustained limit (per minute)
  if (bucket.requestsThisMinute >= PLUGIN_RATE_LIMIT.sustainedLimit) {
    const retryAfter = PLUGIN_RATE_LIMIT.cooldownMs + Math.random() * 1000; // Add jitter
    logger.warning('PLUGIN', `Plugin ${pluginId} hit sustained rate limit (${PLUGIN_RATE_LIMIT.sustainedLimit}/min)`);
    return { allowed: false, retryAfterMs: retryAfter };
  }
  
  // Check burst limit
  if (bucket.tokens < 1) {
    const retryAfter = (1 - bucket.tokens) / PLUGIN_RATE_LIMIT.refillRate * 1000;
    logger.warning('PLUGIN', `Plugin ${pluginId} hit burst rate limit`);
    return { allowed: false, retryAfterMs: retryAfter };
  }
  
  // Consume token and track
  bucket.tokens--;
  bucket.requestsThisMinute++;
  return { allowed: true };
}

function cleanupPluginRateLimit(pluginId: string): void {
  pluginRateLimits.delete(pluginId);
}

// Initialize plugin loader with API creator (breaks circular dependency)
pluginLoader.setPluginAPICreator(createPluginAPI);

// In-memory storage for plugins
const plugins = new Map<string, RuntimePluginV2>();
const capabilities = new Map<string, Map<string, Capability>>(); // capability -> pluginId -> Capability
const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

// Loaded plugin instances with their sandboxes and lifecycle hooks
interface LoadedPluginInstance {
  plugin: RuntimePluginV2;
  sandbox?: pluginLoader.PluginSandbox;
  lifecycle?: PluginLifecycle;
  lifecycleHooks: string[];
  api: PluginAPI;
  cleanup?: () => void;
}
const loadedPlugins = new Map<string, LoadedPluginInstance>();

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

// Load a plugin - INTEGRATED with Plugin Loader for secure sandboxed execution
export async function loadPlugin(pluginId: string, baseUrl?: string): Promise<boolean> {
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
    // Use plugin loader to fetch and sandbox the plugin code
    const pluginBaseUrl = baseUrl || `/plugins/${pluginId}`;
    const { success, error, sandbox } = await pluginLoader.loadPlugin(
      pluginId,
      plugin.manifest,
      pluginBaseUrl
    );
    
    if (!success || !sandbox) {
      throw new Error(error || 'Failed to load plugin code');
    }
    
    // Create secure API for the plugin
    const api = createPluginAPI(pluginId);
    
    // Wait for initialization and get lifecycle hooks
    const lifecycleHooks = await new Promise<string[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Plugin initialization timeout'));
      }, 10000);
      
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'INIT_SUCCESS' && e.data.pluginId === pluginId) {
          clearTimeout(timeout);
          sandbox.messagePort.removeEventListener('message', handler);
          resolve(e.data.lifecycleHooks || []);
        } else if (e.data.type === 'INIT_ERROR' && e.data.pluginId === pluginId) {
          clearTimeout(timeout);
          sandbox.messagePort.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };
      
      sandbox.messagePort.addEventListener('message', handler);
      sandbox.messagePort.start();
    });
    
    // Build lifecycle object from hooks - FIXED: Actually wait for hook completion
    const lifecycle: PluginLifecycle = {};
    for (const hook of lifecycleHooks) {
      lifecycle[hook as keyof PluginLifecycle] = async () => {
        return new Promise<void>((resolve, reject) => {
          const callId = Math.random().toString(36).slice(2);
          const timeout = setTimeout(() => {
            reject(new Error(`Lifecycle hook ${hook} timed out`));
          }, 10000);
          
          const handler = (e: MessageEvent) => {
            if (e.data.type === 'CALL_RESULT' && e.data.callId === callId) {
              clearTimeout(timeout);
              sandbox.messagePort.removeEventListener('message', handler);
              resolve();
            } else if (e.data.type === 'CALL_ERROR' && e.data.callId === callId) {
              clearTimeout(timeout);
              sandbox.messagePort.removeEventListener('message', handler);
              reject(new Error(e.data.error));
            }
          };
          
          sandbox.messagePort.addEventListener('message', handler);
          sandbox.worker?.postMessage({
            type: 'CALL_LIFECYCLE',
            callId,
            data: { hook, pluginId }
          });
        });
      };
    }
    
    // FIXED: Set up ongoing message handler for API calls from Worker
    // Store event handlers so we can clean them up on unload
    const pluginEventHandlers = new Map<string, (data: unknown) => void>();
    
    const messageHandler = async (e: MessageEvent) => {
      const { type, callId, call } = e.data;
      
      if (type === 'API_CALL' && call) {
        try {
          let result: unknown;
          
          // Route API call to the appropriate method
          switch (call.method) {
            case 'log':
              api.log(call.args[0], call.args[1], call.args[2]);
              result = undefined;
              break;
            case 'memory.recall':
              result = await api.memory.recall(call.args[0], call.args[1]);
              break;
            case 'memory.store':
              result = await api.memory.store(call.args[0], call.args[1]);
              break;
            case 'network.fetch':
              result = await api.network.fetch(call.args[0], call.args[1]);
              break;
            case 'events.on':
              // Register event handler from plugin
              const eventName = call.args[0];
              const handler = (data: unknown) => {
                sandbox.worker?.postMessage({
                  type: 'EVENT_EMIT',
                  event: eventName,
                  data
                });
              };
              pluginEventHandlers.set(eventName, handler);
              api.on(eventName, handler);
              result = undefined;
              break;
            case 'events.off':
              // Unregister event handler
              const offEventName = call.args[0];
              const offHandler = pluginEventHandlers.get(offEventName);
              if (offHandler) {
                // Note: We can't easily unsubscribe due to handler wrapping
                // This is a limitation - handlers persist until unload
                pluginEventHandlers.delete(offEventName);
              }
              result = undefined;
              break;
            case 'events.emit':
              api.emit(call.args[0], call.args[1]);
              result = undefined;
              break;
            case 'callCapability':
              result = await api.callCapability(call.args[0], call.args[1], call.args[2]);
              break;
            default:
              throw new Error(`Unknown API method: ${call.method}`);
          }
          
          // Send result back to worker
          sandbox.worker?.postMessage({ type: 'API_RESULT', callId, result });
        } catch (err) {
          sandbox.worker?.postMessage({ 
            type: 'API_RESULT', 
            callId, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }
    };
    
    sandbox.messagePort.addEventListener('message', messageHandler);
    
    // Store cleanup function for unload
    loadedPlugins.set(pluginId, {
      plugin,
      sandbox,
      lifecycle,
      lifecycleHooks,
      api,
      cleanup: () => {
        sandbox.messagePort.removeEventListener('message', messageHandler);
        pluginEventHandlers.clear();
      }
    });
    
    plugin.state = 'loaded';
    plugin.loadedAt = Date.now();
    
    logger.success('PLUGIN', `Loaded ${pluginId} with hooks: [${lifecycleHooks.join(', ')}]`);
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

// Start a plugin - calls onStart lifecycle hook
export async function startPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  if (plugin.state !== 'loaded' && plugin.state !== 'paused') {
    logger.warning('PLUGIN', `Plugin ${pluginId} cannot be started from state ${plugin.state}`);
    return false;
  }

  plugin.state = 'starting';
  
  try {
    // Call onStart lifecycle hook if available
    const loaded = loadedPlugins.get(pluginId);
    if (loaded?.lifecycle?.onStart) {
      await loaded.lifecycle.onStart();
      logger.info('PLUGIN', `onStart hook executed for ${pluginId}`);
    }
    
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

// Stop a plugin - calls onStop lifecycle hook
export async function stopPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  if (plugin.state !== 'active') {
    return false;
  }

  plugin.state = 'stopping';
  
  try {
    // Call onStop lifecycle hook if available
    const loaded = loadedPlugins.get(pluginId);
    if (loaded?.lifecycle?.onStop) {
      await loaded.lifecycle.onStop();
      logger.info('PLUGIN', `onStop hook executed for ${pluginId}`);
    }
    
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

// Unload a plugin - calls onUnload and cleans up sandbox
export async function unloadPlugin(pluginId: string): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  // Stop first if active
  if (plugin.state === 'active') {
    await stopPlugin(pluginId);
  }

  try {
    // Call onUnload lifecycle hook if available
    const loaded = loadedPlugins.get(pluginId);
    if (loaded?.lifecycle?.onUnload) {
      await loaded.lifecycle.onUnload();
      logger.info('PLUGIN', `onUnload hook executed for ${pluginId}`);
    }
    
    // Clean up message handlers
    if (loaded?.cleanup) {
      loaded.cleanup();
      logger.info('PLUGIN', `Message handlers cleaned up for ${pluginId}`);
    }
    
    // Clean up rate limiter
    cleanupPluginRateLimit(pluginId);
    
    // Destroy sandbox and clean up resources
    if (loaded?.sandbox) {
      loaded.sandbox.destroy();
      logger.info('PLUGIN', `Sandbox destroyed for ${pluginId}`);
    }
    
    // Unregister capabilities
    plugin.manifest.provides.forEach(cap => {
      unregisterCapability(pluginId, cap.name);
    });
    
    // Remove from loaded plugins
    loadedPlugins.delete(pluginId);
    
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

// Update plugin config - notifies plugin of changes
export async function updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<boolean> {
  const plugin = plugins.get(pluginId);
  if (!plugin) return false;

  plugin.config = { ...plugin.config, ...config };
  
  // Persist config
  localStorage.setItem(`plugin_config_${pluginId}`, JSON.stringify(plugin.config));
  
  // Notify plugin of config change via lifecycle hook
  const loaded = loadedPlugins.get(pluginId);
  if (loaded?.lifecycle?.onConfigChange) {
    try {
      await loaded.lifecycle.onConfigChange(plugin.config);
      logger.info('PLUGIN', `onConfigChange hook executed for ${pluginId}`);
    } catch (err) {
      logger.error('PLUGIN', `onConfigChange failed for ${pluginId}`, { error: err });
    }
  }
  
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

// Call a capability on a target plugin
export async function callCapability(
  callerPluginId: string,
  targetPluginId: string,
  capabilityName: string,
  params: unknown
): Promise<unknown> {
  // Verify target plugin exists and is active
  const target = plugins.get(targetPluginId);
  if (!target) {
    throw new Error(`Plugin ${targetPluginId} not found`);
  }
  if (target.state !== 'active') {
    throw new Error(`Plugin ${targetPluginId} is not active (state: ${target.state})`);
  }
  
  // Verify target provides the capability
  const capMap = capabilities.get(capabilityName);
  if (!capMap || !capMap.has(targetPluginId)) {
    throw new Error(`Plugin ${targetPluginId} does not provide capability ${capabilityName}`);
  }
  
  // Get the loaded plugin instance
  const loaded = loadedPlugins.get(targetPluginId);
  const sandbox = loaded?.sandbox;
  if (!sandbox) {
    throw new Error(`Plugin ${targetPluginId} is not properly loaded`);
  }
  
  logger.info('PLUGIN', `Calling capability ${capabilityName} on ${targetPluginId} from ${callerPluginId}`);
  
  // Send capability call to the plugin's sandbox
  return new Promise((resolve, reject) => {
    const callId = Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      reject(new Error(`Capability call ${capabilityName} timed out`));
    }, 30000);
    
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'CALL_RESULT' && e.data.callId === callId) {
        clearTimeout(timeout);
        sandbox.messagePort.removeEventListener('message', handler);
        resolve(e.data.result);
      } else if (e.data.type === 'CALL_ERROR' && e.data.callId === callId) {
        clearTimeout(timeout);
        sandbox.messagePort.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    
    sandbox.messagePort.addEventListener('message', handler);
    sandbox.worker?.postMessage({
      type: 'CALL_CAPABILITY',
      callId,
      data: { method: capabilityName, params, caller: callerPluginId }
    });
  });
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
        // INTEGRATED with memory service
        try {
          const { memory } = await import('../services/memory');
          const results = await memory.recallSemantic(query, limit);
          return results.map(r => ({
            id: r.node.id,
            content: r.node.content,
            tags: r.node.tags,
            score: r.score
          }));
        } catch (err) {
          logger.error('PLUGIN', `Memory recall failed for ${pluginId}`, { error: err });
          return [];
        }
      },
      store: async (content, tags) => {
        if (!hasPermission('memory:write')) {
          throw new Error('Permission denied: memory:write');
        }
        plugin.apiCalls++;
        // INTEGRATED with memory service
        try {
          const { memory } = await import('../services/memory');
          await memory.store(content, 'FACT', [...tags, `plugin:${pluginId}`]);
        } catch (err) {
          logger.error('PLUGIN', `Memory store failed for ${pluginId}`, { error: err });
          throw err;
        }
      }
    },
    
    network: {
      fetch: async (url, options) => {
        if (!hasPermission('network:fetch')) {
          throw new Error('Permission denied: network:fetch');
        }
        
        // Check rate limits before making request
        const rateCheck = checkPluginRateLimit(pluginId);
        if (!rateCheck.allowed) {
          const retrySec = Math.ceil((rateCheck.retryAfterMs || 1000) / 1000);
          throw new Error(`Rate limit exceeded. Retry after ${retrySec}s`);
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
        // INTEGRATED with notification service
        notificationService.info(`${title}: ${message}`);
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
      
      // Check if caller has permission to call capabilities
      if (!hasPermission('plugin:capability')) {
        throw new Error('Permission denied: plugin:capability');
      }
      
      // Route the capability call
      return callCapability(pluginId, targetPluginId, capability, params);
    }
  };
}
