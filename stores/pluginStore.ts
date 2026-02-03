/**
 * Plugin Store
 * 
 * Zustand store for plugin UI state and management.
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import {
  RuntimePluginV2,
  PluginManifestV2,
  PluginListing
} from '../plugins/types';
import * as pluginRegistry from '../plugins/registry';

interface PluginStore {
  // State
  plugins: RuntimePluginV2[];
  isLoading: boolean;
  error: string | null;
  selectedPluginId: string | null;
  marketplacePlugins: PluginListing[];
  
  // Actions
  loadPlugins: () => Promise<void>;
  installPlugin: (manifest: PluginManifestV2) => Promise<boolean>;
  uninstallPlugin: (pluginId: string) => Promise<boolean>;
  startPlugin: (pluginId: string) => Promise<boolean>;
  stopPlugin: (pluginId: string) => Promise<boolean>;
  updateConfig: (pluginId: string, config: Record<string, unknown>) => void;
  selectPlugin: (pluginId: string | null) => void;
  refreshMarketplace: () => Promise<void>;
}

export const usePluginStore = create<PluginStore>()(
  persist(
    subscribeWithSelector(
      (set, get) => ({
      plugins: [],
      isLoading: false,
      error: null,
      selectedPluginId: null,
      marketplacePlugins: [],
      
      loadPlugins: async () => {
        set({ isLoading: true, error: null });
        try {
          const plugins = pluginRegistry.getAllPlugins();
          set({ plugins, isLoading: false });
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to load plugins',
            isLoading: false 
          });
        }
      },
      
      installPlugin: async (manifest) => {
        set({ isLoading: true, error: null });
        try {
          const success = await pluginRegistry.registerPlugin(manifest);
          if (success) {
            await pluginRegistry.loadPlugin(manifest.id);
            await pluginRegistry.startPlugin(manifest.id);
            set({ 
              plugins: pluginRegistry.getAllPlugins(),
              isLoading: false 
            });
          } else {
            set({ isLoading: false });
          }
          return success;
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to install plugin',
            isLoading: false 
          });
          return false;
        }
      },
      
      uninstallPlugin: async (pluginId) => {
        set({ isLoading: true, error: null });
        try {
          const success = await pluginRegistry.uninstallPlugin(pluginId);
          if (success) {
            set({ 
              plugins: pluginRegistry.getAllPlugins(),
              selectedPluginId: get().selectedPluginId === pluginId ? null : get().selectedPluginId,
              isLoading: false 
            });
          } else {
            set({ isLoading: false });
          }
          return success;
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to uninstall plugin',
            isLoading: false 
          });
          return false;
        }
      },
      
      startPlugin: async (pluginId) => {
        const success = await pluginRegistry.startPlugin(pluginId);
        if (success) {
          set({ plugins: pluginRegistry.getAllPlugins() });
        }
        return success;
      },
      
      stopPlugin: async (pluginId) => {
        const success = await pluginRegistry.stopPlugin(pluginId);
        if (success) {
          set({ plugins: pluginRegistry.getAllPlugins() });
        }
        return success;
      },
      
      updateConfig: (pluginId, config) => {
        pluginRegistry.updatePluginConfig(pluginId, config);
        set({ plugins: pluginRegistry.getAllPlugins() });
      },
      
      selectPlugin: (pluginId) => {
        set({ selectedPluginId: pluginId });
      },
      
      refreshMarketplace: async () => {
        set({ isLoading: true });
        // TODO: Fetch from actual marketplace API
        // For now, return empty
        set({ marketplacePlugins: [], isLoading: false });
      }
    })
    ),
    {
      name: 'jarvis-plugin-store',
      partialize: (state) => ({
        // Only persist UI state, not plugin data
        selectedPluginId: state.selectedPluginId,
      }),
    }
  )
);

// Selector hooks
export const usePlugins = () => usePluginStore((state) => state.plugins);
export const useSelectedPlugin = () => usePluginStore((state) => 
  state.plugins.find(p => p.manifest.id === state.selectedPluginId)
);
