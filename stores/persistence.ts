/**
 * Store Persistence Configuration
 * 
 * Centralized configuration for Zustand persistence:
 * - Storage versioning for migrations
 * - Storage adapters
 * - Hydration helpers
 */

import { StateStorage, PersistOptions } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

// Current storage version - increment when making breaking changes
export const STORAGE_VERSION = 1;

// Storage version key
const VERSION_KEY = 'jarvis-store-version';

/**
 * Check and handle storage version migration
 * Called on app startup to clear outdated storage
 */
export function checkStorageVersion(): void {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const currentVersion = String(STORAGE_VERSION);
    
    if (storedVersion !== currentVersion) {
      // Clear all JARVIS store data on version mismatch
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('jarvis-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Set new version
      localStorage.setItem(VERSION_KEY, currentVersion);
      console.log(`[PERSISTENCE] Storage migrated from v${storedVersion || '0'} to v${currentVersion}`);
    }
  } catch (e) {
    console.warn('[PERSISTENCE] Failed to check storage version:', e);
  }
}

/**
 * Create a namespaced storage adapter
 * Adds prefix to all storage keys
 */
export function createNamespacedStorage(prefix: string): StateStorage {
  return {
    getItem: (name: string): string | null => {
      try {
        return localStorage.getItem(`${prefix}${name}`);
      } catch (e) {
        console.warn(`[PERSISTENCE] Failed to get ${name}:`, e);
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        localStorage.setItem(`${prefix}${name}`, value);
      } catch (e) {
        console.warn(`[PERSISTENCE] Failed to set ${name}:`, e);
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(`${prefix}${name}`);
      } catch (e) {
        console.warn(`[PERSISTENCE] Failed to remove ${name}:`, e);
      }
    },
  };
}

/**
 * Default storage using localStorage
 */
export const defaultStorage = createJSONStorage(() => localStorage);

/**
 * Session storage adapter (for temporary state)
 */
export const sessionStorageAdapter = createJSONStorage(() => sessionStorage);

/**
 * Type for partialized persist state
 */
export type PersistPartial<T, K extends keyof T> = Pick<T, K>;

/**
 * Helper to create persist options with common settings
 */
export function createPersistOptions<T extends object, K extends keyof T>(
  name: string,
  keys: K[]
): PersistOptions<T, PersistPartial<T, K>> {
  return {
    name,
    storage: defaultStorage as import('zustand/middleware').PersistStorage<PersistPartial<T, K>>,
    partialize: (state) => {
      const partial = {} as PersistPartial<T, K>;
      keys.forEach((key) => {
        partial[key] = state[key];
      });
      return partial;
    },
  };
}

/**
 * Rehydrate all stores from storage
 * Call this after app initialization
 */
export async function rehydrateStores(): Promise<void> {
  // Zustand persist middleware handles rehydration automatically
  // This function is a placeholder for any custom rehydration logic
  console.log('[PERSISTENCE] Stores rehydrated');
}

/**
 * Clear all persisted store data
 * Useful for logout/reset functionality
 */
export function clearAllStores(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('jarvis-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[PERSISTENCE] All stores cleared');
  } catch (e) {
    console.warn('[PERSISTENCE] Failed to clear stores:', e);
  }
}

/**
 * Get storage statistics for debugging
 */
export function getStorageStats(): { store: string; size: string; keys: number }[] {
  const stats: { store: string; size: string; keys: number }[] = [];
  
  try {
    const stores = ['jarvis-ui-store', 'jarvis-kernel-store', 'jarvis-logs-store', 'jarvis-plugin-store'];
    
    stores.forEach(store => {
      const data = localStorage.getItem(store);
      if (data) {
        const size = new Blob([data]).size;
        const keys = Object.keys(JSON.parse(data)?.state || {}).length;
        stats.push({
          store,
          size: `${(size / 1024).toFixed(2)} KB`,
          keys,
        });
      }
    });
  } catch (e) {
    console.warn('[PERSISTENCE] Failed to get storage stats:', e);
  }
  
  return stats;
}
