/**
 * Plugin Hot-Reloader for JARVIS Kernel v1.3
 * 
 * Implements dynamic plugin loading and reloading without restarting the kernel:
 * - File watching for plugin changes
 * - Safe plugin update mechanism
 * - Version rollback capabilities
 */

import { PluginManifest, RuntimePlugin } from '../types';
import { registry } from './registry';
import { logger } from './logger';
import { eventBus } from './eventBus';

export class PluginHotReloader {
  private static instance: PluginHotReloader;
  private watchedPlugins: Map<string, { 
    manifest: PluginManifest; 
    watcher: any; 
    lastModified: number 
  }> = new Map();
  private pluginVersions: Map<string, PluginManifest[]> = new Map(); // For rollback capability

  private constructor() {}

  public static getInstance(): PluginHotReloader {
    if (!PluginHotReloader.instance) {
      PluginHotReloader.instance = new PluginHotReloader();
    }
    return PluginHotReloader.instance;
  }

  /**
   * Watch a plugin for changes and enable hot-reloading
   */
  public async watchPlugin(pluginId: string): Promise<void> {
    try {
      const plugin = registry.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found in registry`);
      }

      // Store current version for potential rollback
      this.storePluginVersion(plugin.manifest);

      // In a real implementation, we would set up a file watcher
      // For now, we'll simulate the functionality
      
      // Simulate watching the plugin
      const watcher = this.setupWatcher(plugin);
      
      this.watchedPlugins.set(pluginId, {
        manifest: plugin.manifest,
        watcher,
        lastModified: Date.now()
      });

      logger.log('PLUGIN', `Started watching plugin: ${pluginId}`, 'success');
    } catch (error) {
      logger.log('PLUGIN', `Failed to watch plugin ${pluginId}: ${error.message}`, 'error');
    }
  }

  /**
   * Stop watching a plugin
   */
  public async unwatchPlugin(pluginId: string): Promise<void> {
    const watchedPlugin = this.watchedPlugins.get(pluginId);
    if (!watchedPlugin) {
      logger.log('PLUGIN', `Plugin ${pluginId} is not being watched`, 'warning');
      return;
    }

    // In a real implementation, we would stop the file watcher
    // For now, we'll just remove from our map
    if (watchedPlugin.watcher) {
      this.clearWatcher(watchedPlugin.watcher);
    }

    this.watchedPlugins.delete(pluginId);
    logger.log('PLUGIN', `Stopped watching plugin: ${pluginId}`, 'info');
  }

  /**
   * Reload a plugin if changes are detected
   */
  public async reloadPlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = registry.get(pluginId);
      if (!plugin) {
        logger.log('PLUGIN', `Cannot reload plugin ${pluginId}: not found in registry`, 'error');
        return false;
      }

      // Check if plugin is currently active
      if (plugin.status !== 'ACTIVE') {
        logger.log('PLUGIN', `Cannot reload inactive plugin: ${pluginId}`, 'warning');
        return false;
      }

      // Store current version before update for rollback capability
      this.storePluginVersion(plugin.manifest);

      // Stop the current plugin
      await registry.stop(pluginId);
      logger.log('PLUGIN', `Stopped plugin: ${pluginId}`, 'info');

      // In a real implementation, we would reload the plugin code
      // For now, we'll just reload the manifest and restart
      const updatedManifest = { ...plugin.manifest, lastUpdated: Date.now() };
      
      // Update the registry with the new manifest
      await registry.updateManifest(pluginId, updatedManifest);
      
      // Restart the plugin
      await registry.start(pluginId);
      
      // Update our watch record
      const watchedPlugin = this.watchedPlugins.get(pluginId);
      if (watchedPlugin) {
        watchedPlugin.manifest = updatedManifest;
        watchedPlugin.lastModified = Date.now();
      }

      logger.log('PLUGIN', `Successfully reloaded plugin: ${pluginId}`, 'success');
      
      // Emit event for UI updates
      eventBus.publish('plugin:reloaded', { 
        pluginId, 
        timestamp: Date.now() 
      });

      return true;
    } catch (error) {
      logger.log('PLUGIN', `Failed to reload plugin ${pluginId}: ${error.message}`, 'error');
      
      // Try to rollback to previous version
      const rolledBack = await this.rollbackPlugin(pluginId);
      if (rolledBack) {
        logger.log('PLUGIN', `Rolled back plugin ${pluginId} to previous version`, 'warning');
      }
      
      return false;
    }
  }

  /**
   * Rollback a plugin to its previous version
   */
  public async rollbackPlugin(pluginId: string): Promise<boolean> {
    try {
      const versions = this.pluginVersions.get(pluginId);
      if (!versions || versions.length < 2) {
        logger.log('PLUGIN', `No previous version available for plugin: ${pluginId}`, 'warning');
        return false;
      }

      // Get the previous version (second to last in the array)
      const previousVersion = versions[versions.length - 2];
      
      // Stop the current plugin
      await registry.stop(pluginId);
      
      // Revert to previous manifest
      await registry.updateManifest(pluginId, previousVersion);
      
      // Restart the plugin
      await registry.start(pluginId);
      
      // Update our watch record
      const watchedPlugin = this.watchedPlugins.get(pluginId);
      if (watchedPlugin) {
        watchedPlugin.manifest = previousVersion;
        watchedPlugin.lastModified = Date.now();
      }

      logger.log('PLUGIN', `Successfully rolled back plugin: ${pluginId}`, 'success');
      
      // Emit event for UI updates
      eventBus.publish('plugin:rollback', { 
        pluginId, 
        timestamp: Date.now() 
      });

      return true;
    } catch (error) {
      logger.log('PLUGIN', `Failed to rollback plugin ${pluginId}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Check for plugin changes and reload if necessary
   */
  public async checkForChanges(): Promise<void> {
    for (const [pluginId, watchedPlugin] of this.watchedPlugins.entries()) {
      try {
        // In a real implementation, we would check file modification times
        // For simulation, we'll just check if there are any changes registered
        
        // Simulate checking for changes
        const hasChanged = await this.simulateCheckForChanges(pluginId, watchedPlugin);
        
        if (hasChanged) {
          logger.log('PLUGIN', `Changes detected for plugin: ${pluginId}`, 'info');
          await this.reloadPlugin(pluginId);
        }
      } catch (error) {
        logger.log('PLUGIN', `Error checking changes for plugin ${pluginId}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Store a version of the plugin manifest for rollback capability
   */
  private storePluginVersion(manifest: PluginManifest): void {
    const pluginId = manifest.id;
    let versions = this.pluginVersions.get(pluginId) || [];
    
    // Keep only the last 5 versions to prevent memory issues
    if (versions.length >= 5) {
      versions = versions.slice(-4); // Keep last 4, we'll add the new one
    }
    
    versions.push(manifest);
    this.pluginVersions.set(pluginId, versions);
  }

  /**
   * Setup a watcher for a plugin (simulated)
   */
  private setupWatcher(plugin: RuntimePlugin): any {
    // In a real implementation, this would set up a file watcher
    // For simulation, we'll return a simple identifier
    
    // Simulate periodic checks for changes
    const intervalId = setInterval(async () => {
      await this.checkForChanges();
    }, 5000); // Check every 5 seconds
    
    return intervalId;
  }

  /**
   * Clear a watcher
   */
  private clearWatcher(watcher: any): void {
    // In a real implementation, this would clear the file watcher
    // For simulation, we'll clear the interval
    if (watcher) {
      clearInterval(watcher);
    }
  }

  /**
   * Simulate checking for changes in a plugin
   */
  private async simulateCheckForChanges(pluginId: string, watchedPlugin: any): Promise<boolean> {
    // In a real implementation, this would compare file modification times
    // For simulation, we'll return false to prevent constant reloading
    return false;
  }

  /**
   * Get information about watched plugins
   */
  public getWatchedPlugins(): Array<{ id: string; lastModified: number; status: string }> {
    return Array.from(this.watchedPlugins.entries()).map(([id, plugin]) => ({
      id,
      lastModified: plugin.lastModified,
      status: 'watched'
    }));
  }

  /**
   * Get available rollback versions for a plugin
   */
  public getRollbackVersions(pluginId: string): PluginManifest[] {
    return this.pluginVersions.get(pluginId) || [];
  }

  /**
   * Start watching all active plugins
   */
  public async watchAllActivePlugins(): Promise<void> {
    const allPlugins = registry.getAll();
    const activePlugins = allPlugins.filter(p => p.status === 'ACTIVE');
    
    for (const plugin of activePlugins) {
      await this.watchPlugin(plugin.manifest.id);
    }
    
    logger.log('PLUGIN', `Started watching ${activePlugins.length} active plugins`, 'success');
  }

  /**
   * Stop watching all plugins
   */
  public async unwatchAllPlugins(): Promise<void> {
    for (const pluginId of this.watchedPlugins.keys()) {
      await this.unwatchPlugin(pluginId);
    }
    
    logger.log('PLUGIN', 'Stopped watching all plugins', 'info');
  }
}

// Export singleton instance
export const pluginHotReloader = PluginHotReloader.getInstance();

// Initialize the hot reloader when module loads
// In a real implementation, you might want to start watching certain plugins automatically
// pluginHotReloader.watchAllActivePlugins().catch(err => {
//   logger.log('PLUGIN', `Failed to start watching plugins: ${err.message}`, 'warning');
// });