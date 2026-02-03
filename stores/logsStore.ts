/**
 * Logs State Store
 * 
 * Manages log-related state:
 * - Log entries
 * - Filters (level, source, search, time range)
 * - Logger configuration
 * - Statistics
 * - Selected log for detail view
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { LogEntry } from '../types';
import { logger, LogFilter, LoggerConfig, LogStats } from '../services/logger';

const DEFAULT_FILTER: LogFilter = {};

const DEFAULT_STATS: LogStats = {
  totalLogs: 0,
  byLevel: { info: 0, success: 0, warning: 0, error: 0 },
  bySource: {},
  oldestLog: 0,
  newestLog: 0,
};

interface LogsState {
  // Data
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  filter: LogFilter;
  config: LoggerConfig;
  stats: LogStats;
  selectedLog: LogEntry | null;
  searchQuery: string;
  
  // UI state
  showSettings: boolean;
  importStatus: { type: 'success' | 'error'; message: string } | null;
  
  // Actions
  setLogs: (logs: LogEntry[]) => void;
  setFilter: (filter: LogFilter) => void;
  setConfig: (config: LoggerConfig) => void;
  setStats: (stats: LogStats) => void;
  setSelectedLog: (log: LogEntry | null) => void;
  setSearchQuery: (query: string) => void;
  setShowSettings: (show: boolean) => void;
  setImportStatus: (status: { type: 'success' | 'error'; message: string } | null) => void;
  
  // Filter actions
  updateFilter: (updates: Partial<LogFilter>) => void;
  clearFilter: () => void;
  setLevelFilter: (level: LogFilter['level']) => void;
  setSourceFilter: (source: LogFilter['source']) => void;
  
  // Async actions
  refreshLogs: () => void;
  refreshStats: () => void;
  applyFilter: () => void;
  exportLogs: () => void;
  importLogs: (file: File) => Promise<void>;
  clearLogs: () => void;
}

export const useLogsStore = create<LogsState>()(
  persist(
    subscribeWithSelector(
      (set, get) => ({
      // Initial state
      logs: [],
      filteredLogs: [],
      filter: DEFAULT_FILTER,
      config: logger.getConfig(),
      stats: DEFAULT_STATS,
      selectedLog: null,
      searchQuery: '',
      showSettings: false,
      importStatus: null,
      
      // Actions
      setLogs: (logs) => {
        set({ logs });
        get().applyFilter();
      },
      
      setFilter: (filter) => {
        set({ filter });
        get().applyFilter();
      },
      
      setConfig: (config) => set({ config }),
      
      setStats: (stats) => set({ stats }),
      
      setSelectedLog: (selectedLog) => set({ selectedLog }),
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      
      setShowSettings: (showSettings) => set({ showSettings }),
      
      setImportStatus: (importStatus) => set({ importStatus }),
      
      // Filter actions
      updateFilter: (updates) => {
        const newFilter = { ...get().filter, ...updates };
        set({ filter: newFilter });
        get().applyFilter();
      },
      
      clearFilter: () => {
        set({ filter: DEFAULT_FILTER, searchQuery: '' });
        get().applyFilter();
      },
      
      setLevelFilter: (level) => {
        get().updateFilter({ level });
      },
      
      setSourceFilter: (source) => {
        get().updateFilter({ source });
      },
      
      // Async actions
      refreshLogs: () => {
        const logs = logger.getRecent(100);
        set({ logs });
        get().applyFilter();
      },
      
      refreshStats: () => {
        const stats = logger.getStats();
        set({ stats });
      },
      
      applyFilter: () => {
        const { logs, filter, searchQuery } = get();
        let filtered = [...logs];
        
        // Apply level filter
        if (filter.level && filter.level !== 'all') {
          filtered = filtered.filter(log => log.type === filter.level);
        }
        
        // Apply source filter
        if (filter.source && filter.source !== 'all') {
          filtered = filtered.filter(log => log.source === filter.source);
        }
        
        // Apply search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(log => 
            log.message.toLowerCase().includes(query) ||
            log.source.toLowerCase().includes(query) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(query))
          );
        }
        
        // Apply time range
        if (filter.startTime) {
          filtered = filtered.filter(log => log.timestamp.getTime() >= filter.startTime!);
        }
        if (filter.endTime) {
          filtered = filtered.filter(log => log.timestamp.getTime() <= filter.endTime!);
        }
        
        set({ filteredLogs: filtered });
      },
      
      exportLogs: () => {
        logger.exportToFile(get().filter);
      },
      
      importLogs: async (file) => {
        const result = await logger.importFromFile(file);
        if (result.success) {
          set({ 
            importStatus: { 
              type: 'success', 
              message: `Imported ${result.imported} logs` 
            } 
          });
          get().refreshLogs();
          get().refreshStats();
        } else {
          set({ 
            importStatus: { 
              type: 'error', 
              message: result.errors.join(', ') 
            } 
          });
        }
      },
      
      clearLogs: () => {
        logger.clear();
        set({ logs: [], filteredLogs: [], selectedLog: null });
        get().refreshStats();
      },
    })
    ),
    {
      name: 'jarvis-logs-store',
      partialize: (state) => ({
        // Only persist user preferences, not log data
        config: state.config,
        filter: state.filter,
      }),
    }
  )
);

// Selector hooks
export const useLogs = () => useLogsStore((state) => state.logs);
export const useFilteredLogs = () => useLogsStore((state) => state.filteredLogs);
export const useLogFilter = () => useLogsStore((state) => state.filter);
export const useLogStats = () => useLogsStore((state) => state.stats);
export const useSelectedLog = () => useLogsStore((state) => state.selectedLog);
export const useLogSearchQuery = () => useLogsStore((state) => state.searchQuery);
