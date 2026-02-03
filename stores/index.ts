/**
 * Zustand Store Exports
 * 
 * Centralized state management for JARVIS.
 * All stores are designed to work alongside existing services
 * for gradual migration without breaking changes.
 */

export { useUIStore } from './uiStore';
export { useKernelStore } from './kernelStore';
export { useMemoryStore } from './memoryStore';
export { useLogsStore } from './logsStore';
export { usePluginStore, usePlugins, useSelectedPlugin } from './pluginStore';

// Persistence utilities
export {
  checkStorageVersion,
  rehydrateStores,
  clearAllStores,
  getStorageStats,
  createNamespacedStorage,
  createPersistOptions,
  defaultStorage,
  sessionStorageAdapter,
  STORAGE_VERSION,
} from './persistence';

// Plugin system exports
export { 
  fetchManifest, 
  fetchPluginCode, 
  loadPlugin, 
  unloadPlugin,
  checkForUpdate,
  clearPluginCache,
  getCacheStats
} from '../plugins/loader';

export {
  searchPlugins,
  getFeaturedPlugins,
  getCategories,
  installFromMarketplace,
  checkAllUpdates,
  getMarketplaceStats
} from '../plugins/marketplace';

export {
  registerPlugin,
  loadPlugin as registerLoadPlugin,
  startPlugin,
  stopPlugin,
  uninstallPlugin,
  getAllPlugins,
  getPlugin,
  onEvent,
  createPluginAPI
} from '../plugins/registry';
