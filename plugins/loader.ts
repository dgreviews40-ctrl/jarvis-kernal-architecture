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
import { createPluginAPI } from './registry';
import { logger } from '../services/logger';

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
    logger.info('PLUGIN_LOADER', `Using cached plugin: ${cacheKey}`);
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
 */
function createWorkerSandbox(pluginId: string, permissions: string[]): PluginSandbox {
  // Create a blob URL for the worker
  const workerCode = `
    self.pluginPermissions = ${JSON.stringify(permissions)};
    
    self.onmessage = function(e) {
      const { type, data } = e.data;
      
      if (type === 'INIT') {
        // Initialize plugin
        try {
          const initFunction = new Function(data.code + '; return initialize;');
          const initialize = initFunction();
          self.pluginInstance = initialize(self.api);
          self.postMessage({ type: 'INIT_SUCCESS' });
        } catch (err) {
          self.postMessage({ type: 'INIT_ERROR', error: err.message });
        }
      }
      
      if (type === 'CALL' && self.pluginInstance) {
        const { method, args } = data;
        if (self.pluginInstance[method]) {
          try {
            const result = self.pluginInstance[method](...args);
            self.postMessage({ type: 'CALL_RESULT', result });
          } catch (err) {
            self.postMessage({ type: 'CALL_ERROR', error: err.message });
          }
        }
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  
  const worker = new Worker(workerUrl);
  
  // Create message channel
  const channel = new MessageChannel();
  const messagePort = channel.port1;
  
  // Forward messages from worker to port
  worker.onmessage = (e) => {
    messagePort.postMessage(e.data);
  };
  
  return {
    id: pluginId,
    worker,
    messagePort,
    destroy: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      messagePort.close();
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
    
    // Create plugin API
    const api = createPluginAPI(pluginId);
    
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
    logger.info('PLUGIN_LOADER', `Unloaded plugin: ${pluginId}`);
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
  logger.info('PLUGIN_LOADER', 'Plugin cache cleared');
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
