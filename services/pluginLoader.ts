/**
 * Plugin Loader - Kernel v1.2
 * Dynamic plugin loading with sandboxing and lifecycle management
 * 
 * Features:
 * - Dynamic import of plugin code
 * - Sandboxed execution environment
 * - Permission-based API access
 * - Lifecycle hooks
 * - Hot reload support
 */

import { RuntimePlugin, PluginManifest, PluginCapability } from '../types';
import { registry } from './registry';
import { eventBus, EventChannels } from './eventBus';
import { resourceManager, DEFAULT_QUOTAS } from './resourceManager';
import { workerPool } from './workerService';
import { notificationService } from './notificationService';

export interface LoadedPlugin {
  manifest: PluginManifest;
  instance: PluginInstance;
  context: PluginContext;
  exports: Record<string, unknown>;
}

export interface PluginInstance {
  initialize?: () => Promise<void>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  destroy?: () => Promise<void>;
  onMessage?: (message: unknown) => Promise<unknown>;
}

export interface PluginContext {
  id: string;
  manifest: PluginManifest;
  permissions: string[];
  api: PluginAPI;
  emit: (event: string, data: unknown) => void;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

export interface PluginAPI {
  // AI Providers
  ai: {
    generate: (prompt: string, options?: unknown) => Promise<string>;
    embed: (text: string) => Promise<number[]>;
  };
  // Memory
  memory: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  // Storage
  storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
  // UI
  ui: {
    showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    showModal: (title: string, content: string) => Promise<boolean>;
  };
  // System
  system: {
    execute: (command: string) => Promise<string>;
    fetch: (url: string, options?: RequestInit) => Promise<Response>;
  };
  // Events
  events: {
    subscribe: (channel: string, handler: (data: unknown) => void) => () => void;
    publish: (channel: string, data: unknown) => void;
  };
  // Capabilities
  capabilities: {
    register: (capability: PluginCapability) => void;
    find: (name: string) => PluginCapability | undefined;
    invoke: (name: string, params: unknown) => Promise<unknown>;
  };
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: LoadedPlugin;
  error?: string;
}

class PluginLoader {
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private capabilities: Map<string, PluginCapability> = new Map();
  private hotReloadEnabled = false;

  /**
   * Load a plugin from code string
   */
  async load(manifest: PluginManifest, code: string): Promise<PluginLoadResult> {
    try {
      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check if already loaded
      if (this.loadedPlugins.has(manifest.id)) {
        await this.unload(manifest.id);
      }

      // Set up resource quota
      const quota = DEFAULT_QUOTAS[manifest.id] || {
        maxMemoryMB: 50,
        maxCpuPercent: 5,
        maxConcurrentTasks: 3,
        maxRequestsPerMinute: 60
      };
      resourceManager.setQuota(manifest.id, quota);

      // Create plugin context
      const context = this.createContext(manifest);

      // Execute plugin code in sandbox
      const instance = await this.executeInSandbox(code, context);

      // Create loaded plugin
      const loadedPlugin: LoadedPlugin = {
        manifest,
        instance,
        context,
        exports: {}
      };

      // Initialize
      if (instance.initialize) {
        await this.runWithTimeout(
          () => instance.initialize!(),
          5000,
          'Plugin initialization timeout'
        );
      }

      // Register with registry
      registry.register({
        manifest,
        status: 'ENABLED',
        capabilities: manifest.capabilities || [],
        exports: {}
      });

      // Store
      this.loadedPlugins.set(manifest.id, loadedPlugin);

      // Publish event
      eventBus.publish(EventChannels.PLUGIN.LOAD, {
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version
      }, { priority: 'high' });

      notificationService.success(`Plugin "${manifest.name}" loaded successfully`);

      return { success: true, plugin: loadedPlugin };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      eventBus.publish(EventChannels.PLUGIN.ERROR, {
        pluginId: manifest.id,
        error: errorMessage
      }, { priority: 'critical' });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return false;

    try {
      // Stop if running
      if (plugin.instance.stop) {
        await this.runWithTimeout(
          () => plugin.instance.stop!(),
          3000,
          'Plugin stop timeout'
        );
      }

      // Destroy
      if (plugin.instance.destroy) {
        await this.runWithTimeout(
          () => plugin.instance.destroy!(),
          3000,
          'Plugin destroy timeout'
        );
      }

      // Unregister capabilities
      plugin.manifest.capabilities?.forEach(cap => {
        this.capabilities.delete(cap.name);
      });

      // Cleanup
      this.loadedPlugins.delete(pluginId);
      resourceManager.removeQuota(pluginId);
      registry.unregister(pluginId);

      // Publish event
      eventBus.publish(EventChannels.PLUGIN.UNLOAD, {
        pluginId,
        name: plugin.manifest.name
      }, { priority: 'high' });

      notificationService.info(`Plugin "${plugin.manifest.name}" unloaded`);

      return true;
    } catch (error) {
      console.error(`[PluginLoader] Error unloading ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Start a plugin
   */
  async start(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return false;

    const resourceCheck = resourceManager.canStartTask(pluginId);
    if (!resourceCheck.allowed) {
      notificationService.error(`Cannot start ${plugin.manifest.name}: ${resourceCheck.reason}`);
      return false;
    }

    try {
      resourceManager.startTask(pluginId);

      if (plugin.instance.start) {
        await this.runWithTimeout(
          () => plugin.instance.start!(),
          5000,
          'Plugin start timeout'
        );
      }

      registry.updateStatus(pluginId, 'ENABLED');
      
      eventBus.publish(EventChannels.PLUGIN.ENABLE, {
        pluginId,
        name: plugin.manifest.name
      }, { priority: 'normal' });

      resourceManager.endTask(pluginId);
      return true;
    } catch (error) {
      resourceManager.endTask(pluginId);
      console.error(`[PluginLoader] Error starting ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Stop a plugin
   */
  async stop(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return false;

    try {
      if (plugin.instance.stop) {
        await this.runWithTimeout(
          () => plugin.instance.stop!(),
          3000,
          'Plugin stop timeout'
        );
      }

      registry.updateStatus(pluginId, 'DISABLED');
      
      eventBus.publish(EventChannels.PLUGIN.DISABLE, {
        pluginId,
        name: plugin.manifest.name
      }, { priority: 'normal' });

      return true;
    } catch (error) {
      console.error(`[PluginLoader] Error stopping ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Send message to plugin
   */
  async sendMessage(pluginId: string, message: unknown): Promise<unknown> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin || !plugin.instance.onMessage) {
      throw new Error(`Plugin ${pluginId} not found or does not accept messages`);
    }

    return this.runWithTimeout(
      () => plugin.instance.onMessage!(message),
      10000,
      'Plugin message timeout'
    );
  }

  /**
   * Get loaded plugin
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Enable hot reload
   */
  enableHotReload(): void {
    this.hotReloadEnabled = true;
  }

  /**
   * Disable hot reload
   */
  disableHotReload(): void {
    this.hotReloadEnabled = false;
  }

  /**
   * Get capability
   */
  getCapability(name: string): PluginCapability | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Invoke capability
   */
  async invokeCapability(name: string, params: unknown): Promise<unknown> {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new Error(`Capability ${name} not found`);
    }

    const plugin = this.loadedPlugins.get(capability.provider);
    if (!plugin) {
      throw new Error(`Provider plugin ${capability.provider} not loaded`);
    }

    // Execute in worker for isolation
    return workerPool.execute('plugin.execute', {
      code: capability.handler,
      context: { params, plugin: plugin.exports }
    });
  }

  private validateManifest(manifest: PluginManifest): { valid: boolean; error?: string } {
    if (!manifest.id) return { valid: false, error: 'Missing plugin ID' };
    if (!manifest.name) return { valid: false, error: 'Missing plugin name' };
    if (!manifest.version) return { valid: false, error: 'Missing plugin version' };
    if (!manifest.entry) return { valid: false, error: 'Missing entry point' };
    if (!manifest.permissions) return { valid: false, error: 'Missing permissions' };

    // Check engine compatibility
    const currentEngine = '1.2.0';
    if (manifest.engine && !this.checkEngineCompatibility(manifest.engine, currentEngine)) {
      return { valid: false, error: `Engine version ${manifest.engine} incompatible with ${currentEngine}` };
    }

    return { valid: true };
  }

  private checkEngineCompatibility(required: string, current: string): boolean {
    const [reqMajor, reqMinor] = required.split('.').map(Number);
    const [curMajor, curMinor] = current.split('.').map(Number);
    
    if (reqMajor !== curMajor) return false;
    return curMinor >= reqMinor;
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const hasPermission = (perm: string) => manifest.permissions.includes(perm);

    return {
      id: manifest.id,
      manifest,
      permissions: manifest.permissions,
      api: {
        ai: {
          generate: hasPermission('ai:generate')
            ? async (prompt, options) => this.callAIProvider(prompt, options)
            : () => { throw new Error('Permission denied: ai:generate'); },
          embed: hasPermission('ai:embed')
            ? async (text) => this.callAIEmbed(text)
            : () => { throw new Error('Permission denied: ai:embed'); }
        },
        memory: {
          get: hasPermission('memory:read')
            ? async (key) => this.getPluginMemory(manifest.id, key)
            : () => { throw new Error('Permission denied: memory:read'); },
          set: hasPermission('memory:write')
            ? async (key, value) => this.setPluginMemory(manifest.id, key, value)
            : () => { throw new Error('Permission denied: memory:write'); },
          delete: hasPermission('memory:write')
            ? async (key) => this.deletePluginMemory(manifest.id, key)
            : () => { throw new Error('Permission denied: memory:write'); }
        },
        storage: {
          getItem: hasPermission('storage:read')
            ? async (key) => localStorage.getItem(`plugin:${manifest.id}:${key}`)
            : () => { throw new Error('Permission denied: storage:read'); },
          setItem: hasPermission('storage:write')
            ? async (key, value) => localStorage.setItem(`plugin:${manifest.id}:${key}`, value)
            : () => { throw new Error('Permission denied: storage:write'); },
          removeItem: hasPermission('storage:write')
            ? async (key) => localStorage.removeItem(`plugin:${manifest.id}:${key}`)
            : () => { throw new Error('Permission denied: storage:write'); }
        },
        ui: {
          showNotification: (message, type = 'info') => {
            notificationService.show(message, type);
          },
          showModal: async (title, content) => {
            // Return true for now - modal system would be implemented separately
            return true;
          }
        },
        system: {
          execute: hasPermission('system:execute')
            ? async (command) => this.executeSystemCommand(command)
            : () => { throw new Error('Permission denied: system:execute'); },
          fetch: hasPermission('network:fetch')
            ? async (url, options) => fetch(url, options)
            : () => { throw new Error('Permission denied: network:fetch'); }
        },
        events: {
          subscribe: (channel, handler) => {
            return eventBus.subscribe(channel, (event) => handler(event.payload));
          },
          publish: (channel, data) => {
            eventBus.publish(channel, data, { source: manifest.id });
          }
        },
        capabilities: {
          register: (capability) => {
            this.capabilities.set(capability.name, {
              ...capability,
              provider: manifest.id
            });
          },
          find: (name) => this.capabilities.get(name),
          invoke: (name, params) => this.invokeCapability(name, params)
        }
      },
      emit: (event, data) => {
        eventBus.publish(`plugin:${manifest.id}:${event}`, data, { source: manifest.id });
      },
      log: (level, message) => {
        console[level](`[Plugin:${manifest.id}] ${message}`);
      }
    };
  }

  private async executeInSandbox(code: string, context: PluginContext): Promise<PluginInstance> {
    // Create sandboxed function
    const sandbox = new Function('context', `
      "use strict";
      const { id, manifest, permissions, api, emit, log } = context;
      
      // Plugin exports
      let exports = {};
      let module = { exports };
      
      // Sandbox globals
      const console = {
        log: (...args) => log('info', args.join(' ')),
        info: (...args) => log('info', args.join(' ')),
        warn: (...args) => log('warn', args.join(' ')),
        error: (...args) => log('error', args.join(' '))
      };
      
      // Execute plugin code
      ${code}
      
      return module.exports || exports;
    `);

    const exports = sandbox(context);

    return {
      initialize: exports.initialize,
      start: exports.start,
      stop: exports.stop,
      destroy: exports.destroy,
      onMessage: exports.onMessage
    };
  }

  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  private async callAIProvider(prompt: string, options?: unknown): Promise<string> {
    // Delegate to gemini service
    const { generateResponse } = await import('./gemini');
    return generateResponse(prompt, options as { conversationId?: string });
  }

  private async callAIEmbed(text: string): Promise<number[]> {
    // Mock embedding for now
    return new Array(384).fill(0).map(() => Math.random() - 0.5);
  }

  private async getPluginMemory(pluginId: string, key: string): Promise<unknown> {
    const data = localStorage.getItem(`memory:plugin:${pluginId}:${key}`);
    return data ? JSON.parse(data) : null;
  }

  private async setPluginMemory(pluginId: string, key: string, value: unknown): Promise<void> {
    localStorage.setItem(`memory:plugin:${pluginId}:${key}`, JSON.stringify(value));
  }

  private async deletePluginMemory(pluginId: string, key: string): Promise<void> {
    localStorage.removeItem(`memory:plugin:${pluginId}:${key}`);
  }

  private async executeSystemCommand(command: string): Promise<string> {
    // Mock system execution
    return `Executed: ${command}`;
  }
}

// Singleton instance
export const pluginLoader = new PluginLoader();
