/**
 * Plugin System v2 - Type Definitions
 * 
 * Enhanced plugin architecture with:
 * - Sandboxed execution
 * - Version compatibility checking
 * - Hot reload support
 * - Plugin-to-plugin communication
 */

// Plugin manifest v2 with enhanced metadata
export interface PluginManifestV2 {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Version compatibility
  engineVersion: string; // Minimum JARVIS engine version required
  
  // Dependencies with version constraints
  dependencies: PluginDependency[];
  
  // Permissions (more granular than v1)
  permissions: PluginPermission[];
  
  // Capabilities this plugin provides
  provides: Capability[];
  
  // Plugin entry points
  entry: {
    background?: string; // Background/worker script
    ui?: string;         // UI component (if any)
    settings?: string;   // Settings panel component
  };
  
  // Plugin configuration schema
  configSchema?: ConfigSchema;
  
  // Metadata
  icon?: string;
  tags: string[];
  homepage?: string;
  repository?: string;
  license: string;
}

export interface PluginDependency {
  pluginId: string;
  versionRange: string; // semver range, e.g., "^1.0.0"
  optional?: boolean;
}

export type PluginPermission =
  | 'memory:read'
  | 'memory:write'
  | 'memory:delete'
  | 'network:fetch'
  | 'network:websocket'
  | 'hardware:cpu'
  | 'hardware:gpu'
  | 'hardware:storage'
  | 'audio:input'
  | 'audio:output'
  | 'vision:camera'
  | 'vision:analyze'
  | 'system:notification'
  | 'system:clipboard'
  | 'system:file:read'
  | 'system:file:write'
  | 'ui:overlay'
  | 'ui:panel'
  | 'ui:statusbar';

export interface Capability {
  name: string;
  version: string;
  description?: string;
}

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'array';
    label: string;
    description?: string;
    default?: unknown;
    options?: string[]; // For select type
    required?: boolean;
    secret?: boolean; // For API keys, passwords
  };
}

// Plugin instance state
export type PluginState = 
  | 'installed'      // Downloaded but not loaded
  | 'loading'        // Currently loading
  | 'loaded'         // Loaded but not started
  | 'starting'       // Starting up
  | 'active'         // Running normally
  | 'pausing'        // Pausing
  | 'paused'         // Temporarily paused
  | 'stopping'       // Stopping
  | 'error'          // Error state
  | 'uninstalling';  // Being removed

export interface RuntimePluginV2 {
  manifest: PluginManifestV2;
  state: PluginState;
  config: Record<string, unknown>;
  
  // Lifecycle timestamps
  installedAt: number;
  loadedAt?: number;
  startedAt?: number;
  lastError?: {
    message: string;
    timestamp: number;
    stack?: string;
  };
  
  // Runtime info
  memoryUsage?: number;
  apiCalls: number;
}

// Plugin API exposed to plugins
export interface PluginAPI {
  // Identity
  readonly pluginId: string;
  readonly version: string;
  
  // Logging
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
  
  // Memory access (if permitted)
  memory: {
    recall: (query: string, limit?: number) => Promise<MemoryResult[]>;
    store: (content: string, tags: string[]) => Promise<void>;
  };
  
  // Network (if permitted)
  network: {
    fetch: (url: string, options?: RequestInit) => Promise<Response>;
    createWebSocket: (url: string) => WebSocket;
  };
  
  // System (if permitted)
  system: {
    notify: (title: string, message: string) => void;
    clipboard: {
      read: () => Promise<string>;
      write: (text: string) => Promise<void>;
    };
  };
  
  // Events
  on: (event: string, handler: (data: unknown) => void) => () => void;
  emit: (event: string, data: unknown) => void;
  
  // Plugin communication
  callCapability: (pluginId: string, capability: string, params: unknown) => Promise<unknown>;
}

export interface MemoryResult {
  id: string;
  content: string;
  tags: string[];
  score: number;
}

// Plugin lifecycle hooks
export interface PluginLifecycle {
  onLoad?: () => Promise<void> | void;
  onStart?: () => Promise<void> | void;
  onPause?: () => Promise<void> | void;
  onResume?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
  onConfigChange?: (config: Record<string, unknown>) => Promise<void> | void;
}

// Plugin constructor
export type PluginConstructor = (api: PluginAPI) => PluginLifecycle;

// Marketplace types
export interface PluginListing {
  manifest: PluginManifestV2;
  downloadUrl: string;
  iconUrl?: string;
  screenshots?: string[];
  rating: number;
  downloadCount: number;
  verified: boolean;
  updatedAt: string;
}

// Plugin event types
export interface PluginEventMap {
  'plugin:installed': { pluginId: string };
  'plugin:loaded': { pluginId: string };
  'plugin:started': { pluginId: string };
  'plugin:stopped': { pluginId: string };
  'plugin:error': { pluginId: string; error: Error };
  'plugin:uninstalled': { pluginId: string };
  'capability:registered': { pluginId: string; capability: string };
  'capability:unregistered': { pluginId: string; capability: string };
}
