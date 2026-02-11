/**
 * JARVIS Plugin SDK
 * 
 * Official SDK for building JARVIS plugins with:
 * - Type-safe plugin definitions
 * - Helper hooks for common operations
 * - Simplified API abstractions
 */

// Core types
export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  permissions?: Permission[];
  capabilities?: CapabilityDefinition[];
  config?: ConfigSchema;
  tags?: string[];
  homepage?: string;
  repository?: string;
}

export interface CapabilityDefinition {
  name: string;
  version: string;
  description?: string;
}

export type Permission =
  | 'memory:read' | 'memory:write' | 'memory:delete'
  | 'network:fetch' | 'network:websocket'
  | 'hardware:cpu' | 'hardware:gpu' | 'hardware:storage'
  | 'audio:input' | 'audio:output'
  | 'vision:camera' | 'vision:analyze'
  | 'system:notification' | 'system:clipboard'
  | 'system:file:read' | 'system:file:write'
  | 'ui:overlay' | 'ui:panel' | 'ui:statusbar'
  | 'display:render' | 'model:selection'
  | 'plugin:capability';

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'array';
    label: string;
    description?: string;
    default?: unknown;
    options?: string[];
    required?: boolean;
    secret?: boolean;
  };
}

export interface Config {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set<T = unknown>(key: string, value: T): void;
  getAll(): Record<string, unknown>;
}

export interface MemoryAPI {
  store(content: string, tags?: string[]): Promise<void>;
  recall(query: string, limit?: number): Promise<MemoryResult[]>;
  search(tags: string[]): Promise<MemoryResult[]>;
}

export interface MemoryResult {
  id: string;
  content: string;
  tags: string[];
  score: number;
}

export interface NetworkAPI {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  createWebSocket(url: string): WebSocket;
}

export interface SystemAPI {
  notify(title: string, message: string): void;
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
}

export interface VoiceAPI {
  speak(text: string, options?: { voice?: string; rate?: number; pitch?: number }): Promise<void>;
  onWakeWord(word: string, handler: () => void): () => void;
  onCommand(pattern: string, handler: (params: string[]) => void): () => void;
}

export interface EventsAPI {
  on(event: string, handler: (data: unknown) => void): () => void;
  emit(event: string, data: unknown): void;
  once(event: string, handler: (data: unknown) => void): () => void;
}

export interface PluginContext {
  id: string;
  version: string;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
  config: Config;
  memory: MemoryAPI;
  network: NetworkAPI;
  system: SystemAPI;
  voice: VoiceAPI;
  events: EventsAPI;
  callCapability(pluginId: string, capability: string, params: unknown): Promise<unknown>;
}

export interface PluginLifecycle {
  onLoad?: () => Promise<void> | void;
  onStart?: () => Promise<void> | void;
  onPause?: () => Promise<void> | void;
  onResume?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
  onConfigChange?: (config: Record<string, unknown>) => Promise<void> | void;
}

export type PluginFactory = (context: PluginContext) => PluginLifecycle | Promise<PluginLifecycle>;

// Internal plugin instance (passed to registry)
export interface InternalPluginInstance {
  manifest: PluginDefinition;
  lifecycle: PluginLifecycle;
}

// The main definePlugin function
export function definePlugin(
  definition: PluginDefinition,
  factory: PluginFactory
): InternalPluginInstance {
  return {
    manifest: definition,
    // Lifecycle is created when plugin is activated
    lifecycle: {} as PluginLifecycle,
    // Store factory for later activation
    _factory: factory,
  } as InternalPluginInstance & { _factory: PluginFactory };
}

// Hook for accessing memory
export function useMemory(context: PluginContext): MemoryAPI {
  return context.memory;
}

// Hook for network operations
export function useNetwork(context: PluginContext): NetworkAPI {
  return context.network;
}

// Hook for system features
export function useSystem(context: PluginContext): SystemAPI {
  return context.system;
}

// Hook for voice features
export function useVoice(context: PluginContext): VoiceAPI {
  return context.voice;
}

// Hook for events
export function useEvents(context: PluginContext): EventsAPI {
  return context.events;
}

// Hook for config
export function useConfig(context: PluginContext): Config {
  return context.config;
}

// Hook for logging
export function useLogger(context: PluginContext) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => 
      context.log('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => 
      context.log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => 
      context.log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => 
      context.log('error', message, meta),
  };
}

// Hook for creating command handlers
export function useCommands(context: PluginContext) {
  const handlers = new Map<string, (params: string[]) => void>();
  
  return {
    register: (command: string, handler: (params: string[]) => void) => {
      handlers.set(command.toLowerCase(), handler);
      
      // Auto-register with voice system if available
      const unsubscribe = context.voice.onCommand(command, handler);
      
      return () => {
        handlers.delete(command.toLowerCase());
        unsubscribe();
      };
    },
    
    // Execute a command programmatically
    execute: (command: string, params: string[] = []) => {
      const handler = handlers.get(command.toLowerCase());
      if (handler) {
        handler(params);
        return true;
      }
      return false;
    }
  };
}

// Hook for scheduled tasks
export function useScheduler(context: PluginContext) {
  const intervals: NodeJS.Timeout[] = [];
  const timeouts: NodeJS.Timeout[] = [];
  
  return {
    every: (ms: number, callback: () => void) => {
      const interval = setInterval(callback, ms);
      intervals.push(interval);
      return () => {
        clearInterval(interval);
        const idx = intervals.indexOf(interval);
        if (idx > -1) intervals.splice(idx, 1);
      };
    },
    
    after: (ms: number, callback: () => void) => {
      const timeout = setTimeout(callback, ms);
      timeouts.push(timeout);
      return () => {
        clearTimeout(timeout);
        const idx = timeouts.indexOf(timeout);
        if (idx > -1) timeouts.splice(idx, 1);
      };
    },
    
    // Cleanup all scheduled tasks
    clearAll: () => {
      intervals.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
      intervals.length = 0;
      timeouts.length = 0;
    }
  };
}

// Re-export types for convenience
export type { PluginFactory as default };
