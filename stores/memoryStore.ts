/**
 * Memory State Store
 * 
 * Manages memory-related state:
 * - Memory nodes
 * - Memory statistics
 * - Backup information
 * - Search results
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { MemoryNode, MemorySearchResult } from '../types';
import { memory } from '../services/memory';

// MemoryBackup type for compatibility
export interface MemoryBackup {
  id: string;
  timestamp: number;
  data: {
    nodeCount: number;
    nodes: any[];
  };
}

export interface MemoryStats {
  totalNodes: number;
  byType: Record<string, number>;
  oldestMemory: number;
  newestMemory: number;
  totalBackups: number;
  indexSize: number;
}

const DEFAULT_STATS: MemoryStats = {
  totalNodes: 0,
  byType: { FACT: 0, PREFERENCE: 0, EPISODE: 0, SUMMARY: 0 },
  oldestMemory: 0,
  newestMemory: 0,
  totalBackups: 0,
  indexSize: 0,
};

interface MemoryState {
  // Data
  nodes: MemoryNode[];
  stats: MemoryStats;
  backups: MemoryBackup[];
  searchResults: MemorySearchResult[] | null;
  searchQuery: string;
  isLoading: boolean;
  
  // Actions
  setNodes: (nodes: MemoryNode[]) => void;
  setStats: (stats: MemoryStats) => void;
  setBackups: (backups: MemoryBackup[]) => void;
  setSearchResults: (results: MemorySearchResult[] | null) => void;
  setSearchQuery: (query: string) => void;
  
  // Async actions
  refreshStats: () => Promise<void>;
  refreshNodes: () => Promise<void>;
  refreshBackups: () => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  subscribeWithSelector(
    (set, get) => ({
      // Initial state
      nodes: [],
      stats: DEFAULT_STATS,
      backups: [],
      searchResults: null,
      searchQuery: '',
      isLoading: false,
      
      // Actions
      setNodes: (nodes) => set({ nodes }),
      
      setStats: (stats) => set({ stats }),
      
      setBackups: (backups) => set({ backups }),
      
      setSearchResults: (searchResults) => set({ searchResults }),
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      
      // Async actions
      refreshStats: async () => {
        const stats = await memory.getStats();
        // memory.ts returns: totalNodes, byType, oldestMemory, newestMemory, totalBackups, indexSize
        set({
          stats: {
            totalNodes: stats.totalNodes ?? 0,
            byType: stats.byType ?? DEFAULT_STATS.byType,
            oldestMemory: stats.oldestMemory ?? 0,
            newestMemory: stats.newestMemory ?? Date.now(),
            totalBackups: stats.totalBackups ?? 0,
            indexSize: stats.indexSize ?? 0,
          }
        });
      },
      
      refreshNodes: async () => {
        set({ isLoading: true });
        const nodes = await memory.getAll();
        set({ nodes, isLoading: false });
      },
      
      refreshBackups: () => {
        // memory.ts supports backups
        const backups = memory.getBackups();
        set({ backups });
      },
      
      search: async (query) => {
        if (!query.trim()) {
          get().clearSearch();
          return;
        }
        set({ isLoading: true, searchQuery: query });
        const results = await memory.recall(query);
        set({ searchResults: results, isLoading: false });
      },
      
      clearSearch: () => {
        set({ 
          searchResults: null, 
          searchQuery: '',
        });
      },
    })
  )
);

// Selector hooks
export const useMemoryNodes = () => useMemoryStore((state) => state.nodes);
export const useMemoryStats = () => useMemoryStore((state) => state.stats);
export const useMemoryBackups = () => useMemoryStore((state) => state.backups);
export const useMemorySearchResults = () => useMemoryStore((state) => state.searchResults);
export const useMemorySearchQuery = () => useMemoryStore((state) => state.searchQuery);
export const useMemoryLoading = () => useMemoryStore((state) => state.isLoading);
