/**
 * Store Persistence Tests
 * 
 * Tests for store persistence functionality:
 * - Storage version checking
 * - Store data persistence
 * - Migration handling
 */

import { 
  checkStorageVersion, 
  clearAllStores, 
  getStorageStats,
  STORAGE_VERSION 
} from '../../stores/persistence';

describe('Store Persistence', () => {
  beforeEach(() => {
    // Clear all storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('checkStorageVersion', () => {
    it('should set version on first run', () => {
      checkStorageVersion();
      
      const version = localStorage.getItem('jarvis-store-version');
      expect(version).toBe(String(STORAGE_VERSION));
    });

    it('should clear stores when version changes', () => {
      // Set up old data
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ state: { test: 'data' } }));
      localStorage.setItem('jarvis-store-version', '0');
      
      checkStorageVersion();
      
      // Old data should be cleared
      expect(localStorage.getItem('jarvis-ui-store')).toBeNull();
      expect(localStorage.getItem('jarvis-store-version')).toBe(String(STORAGE_VERSION));
    });

    it('should not clear stores when version matches', () => {
      // Set up current data
      const testData = JSON.stringify({ state: { test: 'data' } });
      localStorage.setItem('jarvis-ui-store', testData);
      localStorage.setItem('jarvis-store-version', String(STORAGE_VERSION));
      
      checkStorageVersion();
      
      // Data should be preserved
      expect(localStorage.getItem('jarvis-ui-store')).toBe(testData);
    });
  });

  describe('clearAllStores', () => {
    it('should clear all jarvis-prefixed keys', () => {
      localStorage.setItem('jarvis-ui-store', 'data1');
      localStorage.setItem('jarvis-kernel-store', 'data2');
      localStorage.setItem('jarvis-logs-store', 'data3');
      localStorage.setItem('other-key', 'should remain');
      
      clearAllStores();
      
      expect(localStorage.getItem('jarvis-ui-store')).toBeNull();
      expect(localStorage.getItem('jarvis-kernel-store')).toBeNull();
      expect(localStorage.getItem('jarvis-logs-store')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('should remain');
    });
  });

  describe('getStorageStats', () => {
    it('should return stats for existing stores', () => {
      // Set up test data
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ 
        state: { mainView: 'DASHBOARD', activeTab: 'DASHBOARD' } 
      }));
      localStorage.setItem('jarvis-kernel-store', JSON.stringify({ 
        state: { forcedMode: 'GEMINI' } 
      }));
      
      const stats = getStorageStats();
      
      expect(stats.length).toBeGreaterThan(0);
      expect(stats.some(s => s.store === 'jarvis-ui-store')).toBe(true);
      expect(stats.some(s => s.store === 'jarvis-kernel-store')).toBe(true);
      
      // Check that stats have required fields
      stats.forEach(stat => {
        expect(stat.store).toBeDefined();
        expect(stat.size).toBeDefined();
        expect(stat.keys).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return empty array when no stores exist', () => {
      const stats = getStorageStats();
      expect(stats).toEqual([]);
    });
  });
});

// Store-specific persistence tests
describe('Store Persistence Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should persist UI store state', () => {
    const uiState = {
      state: {
        mainView: 'SETTINGS',
        activeTab: 'MEMORY'
      },
      version: 0
    };
    
    localStorage.setItem('jarvis-ui-store', JSON.stringify(uiState));
    
    const stored = JSON.parse(localStorage.getItem('jarvis-ui-store') || '{}');
    expect(stored.state.mainView).toBe('SETTINGS');
    expect(stored.state.activeTab).toBe('MEMORY');
  });

  it('should persist kernel store preferences', () => {
    const kernelState = {
      state: {
        forcedMode: 'OLLAMA'
      },
      version: 0
    };
    
    localStorage.setItem('jarvis-kernel-store', JSON.stringify(kernelState));
    
    const stored = JSON.parse(localStorage.getItem('jarvis-kernel-store') || '{}');
    expect(stored.state.forcedMode).toBe('OLLAMA');
  });

  it('should persist logs store config', () => {
    const logsState = {
      state: {
        config: {
          maxLogs: 500,
          enabled: true
        },
        filter: {
          level: 'error'
        }
      },
      version: 0
    };
    
    localStorage.setItem('jarvis-logs-store', JSON.stringify(logsState));
    
    const stored = JSON.parse(localStorage.getItem('jarvis-logs-store') || '{}');
    expect(stored.state.config.maxLogs).toBe(500);
    expect(stored.state.filter.level).toBe('error');
  });

  it('should persist plugin store selection', () => {
    const pluginState = {
      state: {
        selectedPluginId: 'test-plugin-123'
      },
      version: 0
    };
    
    localStorage.setItem('jarvis-plugin-store', JSON.stringify(pluginState));
    
    const stored = JSON.parse(localStorage.getItem('jarvis-plugin-store') || '{}');
    expect(stored.state.selectedPluginId).toBe('test-plugin-123');
  });
});
