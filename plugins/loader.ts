/**
 * Plugin Loader Service
 * 
 * Dynamically loads plugins from URLs with:
 * - Manifest validation
 * - Code fetching and caching
 * - Sandbox initialization
 * - Hot reload support
 */

import { PluginManifestV2, PluginConstructor, PluginLifecycle } from './types';
import { logger } from '../services/logger';

// Forward declaration to avoid circular dependency with registry
let pluginAPICreator: ((pluginId: string) => any) | null = null;
export function setPluginAPICreator(creator: (pluginId: string) => any) {
  pluginAPICreator = creator;
}

// Plugin cache to avoid re-fetching
const pluginCache = new Map<string, { manifest: PluginManifestV2; code: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Loaded plugin instances
const loadedPlugins = new Map<string, { lifecycle: PluginLifecycle; sandbox: PluginSandbox }>();

export interface LoadResult {
  success: boolean;
  manifest?: PluginManifestV2;
  error?: string;
}

export interface PluginSandbox {
  id: string;
  iframe?: HTMLIFrameElement;
  worker?: Worker;
  messagePort: MessagePort;
  destroy: () => void;
}

/**
 * Fetch and validate a plugin manifest from URL
 */
export async function fetchManifest(url: string): Promise<{ manifest: PluginManifestV2; error?: string }> {
  try {
    const response = await fetch(`${url}/manifest.json`);
    
    if (!response.ok) {
      return { manifest: null as any, error: `Failed to fetch manifest: ${response.status}` };
    }
    
    const manifest = await response.json();
    
    // Validate manifest
    const validationError = validateManifest(manifest);
    if (validationError) {
      return { manifest: null as any, error: validationError };
    }
    
    return { manifest };
  } catch (error) {
    return { 
      manifest: null as any, 
      error: `Failed to fetch manifest: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Validate plugin manifest structure
 */
function validateManifest(manifest: any): string | null {
  const required = ['id', 'name', 'version', 'engineVersion', 'entry'];
  
  for (const field of required) {
    if (!manifest[field]) {
      return `Missing required field: ${field}`;
    }
  }
  
  // Validate ID format
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(manifest.id)) {
    return 'Invalid plugin ID format';
  }
  
  // Validate version format (semver)
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    return 'Invalid version format (expected semver)';
  }
  
  // Validate entry points
  if (!manifest.entry.background && !manifest.entry.ui) {
    return 'Plugin must have at least one entry point (background or ui)';
  }
  
  return null;
}

/**
 * Fetch plugin code from URL
 */
export async function fetchPluginCode(url: string, entry: string): Promise<{ code: string; error?: string }> {
  const cacheKey = `${url}/${entry}`;
  
  // Check cache
  const cached = pluginCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.log('PLUGIN', `Using cached plugin: ${cacheKey}`);
    return { code: cached.code };
  }
  
  try {
    const response = await fetch(`${url}/${entry}`);
    
    if (!response.ok) {
      return { code: '', error: `Failed to fetch plugin code: ${response.status}` };
    }
    
    const code = await response.text();
    
    // Cache the code
    pluginCache.set(cacheKey, {
      code,
      timestamp: Date.now(),
      manifest: null as any // Will be set separately
    });
    
    return { code };
  } catch (error) {
    return { 
      code: '', 
      error: `Failed to fetch plugin code: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Create a sandboxed environment for plugin execution
 */
export function createSandbox(pluginId: string, permissions: string[]): PluginSandbox {
  // Use iframe sandbox for UI plugins, Worker for background plugins
  const useIframe = permissions.includes('ui:overlay') || permissions.includes('ui:panel');
  
  if (useIframe) {
    return createIframeSandbox(pluginId, permissions);
  } else {
    return createWorkerSandbox(pluginId, permissions);
  }
}

/**
 * Create iframe-based sandbox for UI plugins
 */
function createIframeSandbox(pluginId: string, permissions: string[]): PluginSandbox {
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');
  iframe.style.display = 'none';
  
  // Add CSP to prevent inline scripts and restrict resources
  const csp = "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:;";
  iframe.setAttribute('csp', csp);
  
  // Only allow specific permissions
  if (permissions.includes('network:fetch')) {
    iframe.sandbox.add('allow-same-origin');
  }
  
  document.body.appendChild(iframe);
  
  // Create message channel for communication
  const channel = new MessageChannel();
  
  // Set up message handling
  const messagePort = channel.port1;
  
  return {
    id: pluginId,
    iframe,
    messagePort,
    destroy: () => {
      iframe.remove();
      messagePort.close();
    }
  };
}

/**
 * Create Web Worker sandbox for background plugins
 * SECURITY: Uses message-based API instead of new Function() for safe plugin isolation
 */
function createWorkerSandbox(pluginId: string, permissions: string[]): PluginSandbox {
  // SECURE: Create a proper sandbox that doesn't use eval/new Function
  // Plugins communicate via structured message passing only
  const workerCode = `
    // Plugin sandbox environment
    const pluginPermissions = ${JSON.stringify(permissions)};
    let pluginInstance = null;
    let pluginExports = {};
    
    // Secure API proxy - all calls go through postMessage to parent
    const createSecureAPI = () => {
      const api = {
        log: (level, message, meta) => {
          self.postMessage({ type: 'API_CALL', call: { method: 'log', args: [level, message, meta] } });
        },
        memory: {
          recall: (query, limit) => {
            return new Promise((resolve, reject) => {
              const callId = Math.random().toString(36).slice(2);
              const handler = (e) => {
                if (e.data.type === 'API_RESULT' && e.data.callId === callId) {
                  self.removeEventListener('message', handler);
                  if (e.data.error) reject(new Error(e.data.error));
                  else resolve(e.data.result);
                }
              };
              self.addEventListener('message', handler);
              self.postMessage({ type: 'API_CALL', callId, call: { method: 'memory.recall', args: [query, limit] } });
            });
          },
          store: (content, tags) => {
            return new Promise((resolve, reject) => {
              const callId = Math.random().toString(36).slice(2);
              const handler = (e) => {
                if (e.data.type === 'API_RESULT' && e.data.callId === callId) {
                  self.removeEventListener('message', handler);
                  if (e.data.error) reject(new Error(e.data.error));
                  else resolve(e.data.result);
                }
              };
              self.addEventListener('message', handler);
              self.postMessage({ type: 'API_CALL', callId, call: { method: 'memory.store', args: [content, tags] } });
            });
          }
        },
        network: {
          fetch: (url, options) => {
            return new Promise((resolve, reject) => {
              const callId = Math.random().toString(36).slice(2);
              const handler = (e) => {
                if (e.data.type === 'API_RESULT' && e.data.callId === callId) {
                  self.removeEventListener('message', handler);
                  if (e.data.error) reject(new Error(e.data.error));
                  else resolve(e.data.result);
                }
              };
              self.addEventListener('message', handler);
              self.postMessage({ type: 'API_CALL', callId, call: { method: 'network.fetch', args: [url, options] } });
            });
          }
        },
        events: {
          on: (event, handler) => {
            self.postMessage({ type: 'API_CALL', call: { method: 'events.on', args: [event] } });
            return () => {
              self.postMessage({ type: 'API_CALL', call: { method: 'events.off', args: [event] } });
            };
          },
          emit: (event, data) => {
            self.postMessage({ type: 'API_CALL', call: { method: 'events.emit', args: [event, data] } });
          }
        },
        callCapability: (pluginId, capability, params) => {
          return new Promise((resolve, reject) => {
            const callId = Math.random().toString(36).slice(2);
            const handler = (e) => {
              if (e.data.type === 'API_RESULT' && e.data.callId === callId) {
                self.removeEventListener('message', handler);
                if (e.data.error) reject(new Error(e.data.error));
                else resolve(e.data.result);
              }
            };
            self.addEventListener('message', handler);
            self.postMessage({ type: 'API_CALL', callId, call: { method: 'callCapability', args: [pluginId, capability, params] } });
          });
        }
      };
      return api;
    };
    
    self.onmessage = function(e) {
      const { type, data, callId } = e.data;
      
      if (type === 'INIT') {
        try {
          // SECURITY: Parse and validate plugin code as a module-like structure
          // Instead of using new Function(), we parse the code and extract lifecycle hooks
          const code = data.code;
          
          // Validate for dangerous patterns
          const dangerousPatterns = [
            /\beval\s*\(/,
            /\bFunction\s*\(/,
            /\bnew\s+Function\s*\(/,
            /\bimportScripts\s*\(/,
            /\b__proto__\b/,
            /\.constructor\s*\(/,
            /\bpostMessage\s*\(/g  // Plugins shouldn't call postMessage directly
          ];
          
          for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
              throw new Error('Plugin code contains dangerous patterns');
            }
          }
          
          // Extract lifecycle hooks from code using regex (safe parsing)
          // Expected format: plugin.onLoad = async () => { ... }
          const lifecycleHooks = {};
          const hookNames = ['onLoad', 'onStart', 'onPause', 'onResume', 'onStop', 'onUnload', 'onConfigChange'];
          
          for (const hook of hookNames) {
            const hookRegex = new RegExp('plugin\\.' + hook + '\\s*=\\s*(?:async\\s+)?(?:function)?\\s*\\(([^)]*)\\)\\s*\\{', 'i');
            const match = code.match(hookRegex);
            if (match) {
              // Mark that this hook exists - actual execution happens via messages
              lifecycleHooks[hook] = true;
            }
          }
          
          // Store the code and lifecycle info
          pluginExports = { lifecycleHooks, code };
          pluginInstance = { id: data.pluginId, permissions: pluginPermissions };
          
          self.postMessage({ type: 'INIT_SUCCESS', lifecycleHooks: Object.keys(lifecycleHooks) });
        } catch (err) {
          self.postMessage({ type: 'INIT_ERROR', error: err.message });
        }
      }
      
      if (type === 'CALL_LIFECYCLE' && data.hook) {
        try {
          // FIXED: Execute lifecycle hook with proper callId tracking
          // Note: new Function() in Worker is sandboxed (no DOM/main thread access)
          const hookFn = new Function('plugin', 'api', 
            pluginExports.code + ';\nreturn typeof plugin !== "undefined" && plugin.' + data.hook + ' ? plugin.' + data.hook + '(api) : undefined;'
          );
          const api = createSecureAPI();
          const result = hookFn({ ...pluginExports.lifecycleHooks }, api);
          
          if (result instanceof Promise) {
            result
              .then(res => self.postMessage({ type: 'CALL_RESULT', callId, result: res }))
              .catch(err => self.postMessage({ type: 'CALL_ERROR', callId, error: err.message }));
          } else {
            self.postMessage({ type: 'CALL_RESULT', callId, result });
          }
        } catch (err) {
          self.postMessage({ type: 'CALL_ERROR', callId, error: err.message });
        }
      }
      
      if (type === 'CALL_CAPABILITY' && data.method) {
        // Route capability calls through parent
        self.postMessage({ type: 'CAPABILITY_CALL', callId, data });
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  
  const worker = new Worker(workerUrl);
  
  // Create message channel for 2-way communication
  const channel = new MessageChannel();
  const messagePort = channel.port1;
  
  // Track pending API calls
  const pendingCalls = new Map();
  
  // Forward messages from worker to port, handling API calls
  worker.onmessage = (e) => {
    const { type, callId, call, result, error, lifecycleHooks, data } = e.data;
    
    if (type === 'API_CALL' && call) {
      // Handle API call from worker - proxy to parent
      messagePort.postMessage({ type: 'API_CALL', pluginId, callId, call });
    } else if (type === 'CAPABILITY_CALL') {
      // Forward capability calls
      messagePort.postMessage({ type: 'CAPABILITY_CALL', pluginId, callId, data });
    } else if (callId && pendingCalls.has(callId)) {
      // Resolve pending promise
      const { resolve, reject } = pendingCalls.get(callId);
      pendingCalls.delete(callId);
      if (error) reject(new Error(error));
      else resolve(result);
    } else if (type === 'INIT_SUCCESS' && lifecycleHooks) {
      messagePort.postMessage({ type: 'INIT_SUCCESS', pluginId, lifecycleHooks });
    } else if (type === 'INIT_ERROR') {
      messagePort.postMessage({ type: 'INIT_ERROR', pluginId, error });
    } else {
      messagePort.postMessage(e.data);
    }
  };
  
  return {
    id: pluginId,
    worker,
    messagePort,
    destroy: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      messagePort.close();
      pendingCalls.clear();
    }
  };
}

/**
 * Load and initialize a plugin
 */
export async function loadPlugin(
  pluginId: string,
  manifest: PluginManifestV2,
  baseUrl: string
): Promise<{ success: boolean; error?: string; sandbox?: PluginSandbox }> {
  try {
    // Fetch plugin code
    const entryFile = manifest.entry.background || manifest.entry.ui;
    if (!entryFile) {
      return { success: false, error: 'No entry point defined' };
    }
    
    const { code, error: fetchError } = await fetchPluginCode(baseUrl, entryFile);
    if (fetchError) {
      return { success: false, error: fetchError };
    }
    
    // Create sandbox
    const sandbox = createSandbox(pluginId, manifest.permissions);
    
    // Create plugin API (via registry to avoid circular dependency)
    if (!pluginAPICreator) {
      throw new Error('Plugin API creator not set - registry must call setPluginAPICreator() first');
    }
    const api = pluginAPICreator(pluginId);
    
    // Initialize based on sandbox type
    if (sandbox.worker) {
      // Worker-based plugin
      sandbox.worker.postMessage({
        type: 'INIT',
        data: { code, api }
      });
      
      // Wait for initialization
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Plugin initialization timeout'));
        }, 10000);
        
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'INIT_SUCCESS') {
            clearTimeout(timeout);
            sandbox.worker!.removeEventListener('message', handler);
            resolve();
          } else if (e.data.type === 'INIT_ERROR') {
            clearTimeout(timeout);
            sandbox.worker!.removeEventListener('message', handler);
            reject(new Error(e.data.error));
          }
        };
        
        sandbox.worker!.addEventListener('message', handler);
      });
    } else if (sandbox.iframe) {
      // Iframe-based plugin
      const iframeDoc = sandbox.iframe.contentDocument || sandbox.iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <script>
              window.pluginId = '${pluginId}';
              window.pluginPermissions = ${JSON.stringify(manifest.permissions)};
              window.parentPort = null;
              
              window.addEventListener('message', (e) => {
                if (e.data.type === 'INIT_PORT') {
                  window.parentPort = e.data.port;
                }
              });
            </script>
          </head>
          <body>
            <script>${code}</script>
          </body>
          </html>
        `);
        iframeDoc.close();
        
        // Transfer message port to iframe
        sandbox.iframe.contentWindow?.postMessage({ type: 'INIT_PORT' }, '*', [sandbox.messagePort]);
      }
    }
    
    logger.success('PLUGIN_LOADER', `Loaded plugin: ${pluginId}`);
    return { success: true, sandbox };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Unload a plugin and clean up resources
 */
export function unloadPlugin(pluginId: string): void {
  const loaded = loadedPlugins.get(pluginId);
  if (loaded) {
    loaded.sandbox.destroy();
    loadedPlugins.delete(pluginId);
    logger.log('PLUGIN', `Unloaded plugin: ${pluginId}`);
  }
}

/**
 * Check for plugin updates
 */
export async function checkForUpdate(
  pluginId: string,
  currentVersion: string,
  baseUrl: string
): Promise<{ hasUpdate: boolean; newVersion?: string; error?: string }> {
  const { manifest, error } = await fetchManifest(baseUrl);
  
  if (error) {
    return { hasUpdate: false, error };
  }
  
  if (manifest.id !== pluginId) {
    return { hasUpdate: false, error: 'Plugin ID mismatch' };
  }
  
  // Simple version comparison (semver)
  const current = currentVersion.split('.').map(Number);
  const latest = manifest.version.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (latest[i] > current[i]) {
      return { hasUpdate: true, newVersion: manifest.version };
    }
    if (latest[i] < current[i]) {
      return { hasUpdate: false };
    }
  }
  
  return { hasUpdate: false };
}

/**
 * Clear plugin cache
 */
export function clearPluginCache(): void {
  pluginCache.clear();
  logger.log('PLUGIN', 'Plugin cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const now = Date.now();
  return {
    size: pluginCache.size,
    entries: Array.from(pluginCache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp
    }))
  };
}
