import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { settingsManager, ExportOptions, ImportOptions } from '../../services/settingsManager';

// Mock dependencies
vi.mock('../../services/apiKeyManager', () => ({
  apiKeyManager: {
    getKey: vi.fn(),
    setKey: vi.fn(),
    isInitialized: vi.fn(() => false),
    isSecure: vi.fn(() => false),
  }
}));

vi.mock('../../services/memory', () => ({
  memory: {
    getAll: vi.fn(() => Promise.resolve([])),
    store: vi.fn(() => Promise.resolve()),
  }
}));

vi.mock('../../services/logger', () => ({
  logger: {
    success: vi.fn(),
    log: vi.fn(),
  }
}));

import { apiKeyManager } from '../../services/apiKeyManager';
import { memory } from '../../services/memory';

describe('SettingsManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('exportSettings', () => {
    it('should export basic settings', async () => {
      // Set up some localStorage data
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ theme: 'dark' }));
      localStorage.setItem('jarvis-kernel-store', JSON.stringify({ version: '1.0' }));

      const result = await settingsManager.exportSettings();

      expect(result.success).toBe(true);
      expect(result.stats.settingsCount).toBe(2);
      expect(result.data).toBeDefined();
      expect(result.blob).toBeDefined();
    });

    it('should include API keys when requested', async () => {
      const mockGetKey = apiKeyManager.getKey as ReturnType<typeof vi.fn>;
      mockGetKey.mockImplementation((provider: string) => {
        if (provider === 'gemini') return Promise.resolve('gemini-key-123');
        if (provider === 'openai') return Promise.resolve('openai-key-456');
        return Promise.resolve(null);
      });

      const result = await settingsManager.exportSettings({ includeApiKeys: true });

      expect(result.success).toBe(true);
      expect(result.stats.apiKeysCount).toBe(2);
    });

    it('should include memory when requested', async () => {
      const mockGetAll = memory.getAll as ReturnType<typeof vi.fn>;
      mockGetAll.mockResolvedValue([
        { content: 'Memory 1', type: 'user', tags: ['tag1'] },
        { content: 'Memory 2', type: 'ai', tags: ['tag2'] }
      ]);

      const result = await settingsManager.exportSettings({ includeMemory: true });

      expect(result.success).toBe(true);
      expect(result.stats.memoryCount).toBe(2);
    });

    it('should encrypt export when password provided', async () => {
      const result = await settingsManager.exportSettings({ password: 'secret123' });

      expect(result.success).toBe(true);
      expect(result.blob?.type).toBe('application/jarvis-encrypted');
    });

    it('should export as JSON when no password', async () => {
      const result = await settingsManager.exportSettings();

      expect(result.success).toBe(true);
      expect(result.blob?.type).toBe('application/json');
      
      // Verify it's valid JSON
      const data = JSON.parse(result.data!);
      expect(data.version).toBeDefined();
      expect(data.exportedAt).toBeDefined();
      expect(data.settings).toBeDefined();
    });

    it('should include metadata in export', async () => {
      const result = await settingsManager.exportSettings();
      const data = JSON.parse(result.data!);

      expect(data.metadata).toBeDefined();
      expect(data.metadata.exportedBy).toBe('JARVIS User');
      expect(data.metadata.system).toBeDefined();
      expect(data.metadata.userAgent).toBeDefined();
    });

    it('should calculate total size correctly', async () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ data: 'test' }));

      const result = await settingsManager.exportSettings();

      expect(result.stats.totalSize).toBeGreaterThan(0);
      expect(result.stats.totalSize).toBe(result.data!.length);
    });

    it('should handle export errors gracefully', async () => {
      // Mock JSON.stringify to throw
      vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('Stringify error');
      });

      const result = await settingsManager.exportSettings();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.stats.settingsCount).toBe(0);
    });
  });

  describe('importSettings', () => {
    it('should import settings from string', async () => {
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {
          'jarvis-ui-store': { theme: 'light' },
          'jarvis-kernel-store': { version: '2.0' }
        },
        metadata: {
          exportedBy: 'Test',
          system: 'test',
          userAgent: 'test'
        }
      };

      const result = await settingsManager.importSettings(JSON.stringify(exportData));

      expect(result.success).toBe(true);
      expect(result.imported.settings).toContain('jarvis-ui-store');
      expect(result.imported.settings).toContain('jarvis-kernel-store');
      expect(localStorage.getItem('jarvis-ui-store')).toBe(JSON.stringify({ theme: 'light' }));
    });

    it('should import settings from File', async () => {
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {
          'jarvis-ui-store': { theme: 'dark' }
        },
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const file = new File([JSON.stringify(exportData)], 'settings.json', { type: 'application/json' });
      const result = await settingsManager.importSettings(file);

      expect(result.success).toBe(true);
      expect(result.imported.settings).toContain('jarvis-ui-store');
    });

    it('should import API keys', async () => {
      const mockSetKey = apiKeyManager.setKey as ReturnType<typeof vi.fn>;
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {},
        apiKeys: {
          gemini: 'gemini-key',
          openai: 'openai-key'
        },
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const result = await settingsManager.importSettings(JSON.stringify(exportData));

      expect(result.imported.apiKeys).toBe(2);
      expect(mockSetKey).toHaveBeenCalledWith('gemini', 'gemini-key');
      expect(mockSetKey).toHaveBeenCalledWith('openai', 'openai-key');
    });

    it('should import memories', async () => {
      const mockStore = memory.store as ReturnType<typeof vi.fn>;
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {},
        memory: [
          { content: 'Test memory', type: 'user', tags: ['test'] }
        ],
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const result = await settingsManager.importSettings(JSON.stringify(exportData));

      expect(result.imported.memory).toBe(1);
      expect(mockStore).toHaveBeenCalledWith('Test memory', 'user', ['test']);
    });

    it('should clear existing settings when merge is false', async () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ old: 'data' }));
      localStorage.setItem('existing-key', 'should-be-removed');

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {
          'jarvis-ui-store': { new: 'data' }
        },
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      await settingsManager.importSettings(JSON.stringify(exportData), { merge: false });

      expect(localStorage.getItem('jarvis-ui-store')).toBe(JSON.stringify({ new: 'data' }));
    });

    it('should merge with existing settings when merge is true', async () => {
      localStorage.setItem('existing-key', 'existing-value');

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {
          'new-key': 'new-value'
        },
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      await settingsManager.importSettings(JSON.stringify(exportData), { merge: true });

      expect(localStorage.getItem('existing-key')).toBe('existing-value');
      expect(localStorage.getItem('new-key')).toBe('"new-value"');
    });

    it('should reject newer export versions', async () => {
      const exportData = {
        version: 999,
        exportedAt: new Date().toISOString(),
        appVersion: '99.0.0',
        settings: {},
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const result = await settingsManager.importSettings(JSON.stringify(exportData));

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('version 999');
    });

    it('should handle decryption with password', async () => {
      // First create an encrypted export
      const password = 'testpass123';
      const exportResult = await settingsManager.exportSettings({ password });
      
      // Clear localStorage
      localStorage.clear();
      
      // Import with password
      const result = await settingsManager.importSettings(exportResult.data!, { password });

      expect(result.success).toBe(true);
    });

    it('should handle import errors gracefully', async () => {
      const result = await settingsManager.importSettings('invalid json');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report warnings for failed memory imports', async () => {
      const mockStore = memory.store as ReturnType<typeof vi.fn>;
      mockStore.mockRejectedValue(new Error('Storage error'));
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {},
        memory: [
          { content: 'Bad memory', type: 'user', tags: [] }
        ],
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const result = await settingsManager.importSettings(JSON.stringify(exportData));

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('downloadExport', () => {
    it('should create download link', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      // Mock click
      const mockAnchor = document.createElement('a');
      mockAnchor.click = vi.fn();
      createElementSpy.mockReturnValue(mockAnchor);

      const blob = new Blob(['test data'], { type: 'application/json' });
      
      settingsManager.downloadExport(blob, 'custom-name.json');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('custom-name.json');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('should use default filename with date', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const mockAnchor = document.createElement('a');
      mockAnchor.click = vi.fn();
      createElementSpy.mockReturnValue(mockAnchor);

      const blob = new Blob(['test'], { type: 'application/json' });
      settingsManager.downloadExport(blob);

      expect(mockAnchor.download).toMatch(/^jarvis-settings-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('clearAllSettings', () => {
    it('should clear all known settings keys', () => {
      localStorage.setItem('jarvis-ui-store', 'data1');
      localStorage.setItem('jarvis-kernel-store', 'data2');
      localStorage.setItem('jarvis-logs-store', 'data3');
      localStorage.setItem('other-key', 'should-remain');

      settingsManager.clearAllSettings();

      expect(localStorage.getItem('jarvis-ui-store')).toBeNull();
      expect(localStorage.getItem('jarvis-kernel-store')).toBeNull();
      expect(localStorage.getItem('jarvis-logs-store')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('should-remain');
    });
  });

  describe('getSettingsSummary', () => {
    it('should return settings summary', () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ theme: 'dark' }));
      localStorage.setItem('jarvis-kernel-store', JSON.stringify({ version: '1.0' }));

      const summary = settingsManager.getSettingsSummary();

      expect(summary.settings).toHaveLength(2);
      expect(summary.totalSize).toBeGreaterThan(0);
      expect(summary.hasEncryption).toBe(false);
    });

    it('should calculate sizes correctly', () => {
      const data = { key: 'value' };
      localStorage.setItem('jarvis-ui-store', JSON.stringify(data));

      const summary = settingsManager.getSettingsSummary();
      const blob = new Blob([JSON.stringify(data)]);

      expect(summary.settings[0].size).toBe(blob.size);
    });
  });

  describe('validateExport', () => {
    it('should validate correct export', async () => {
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {},
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const result = await settingsManager.validateExport(JSON.stringify(exportData));

      expect(result.valid).toBe(true);
      expect(result.version).toBe(1);
      expect(result.exportedAt).toBeDefined();
    });

    it('should reject invalid export format', async () => {
      const result = await settingsManager.validateExport(JSON.stringify({ foo: 'bar' }));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid export format');
    });

    it('should reject invalid JSON', async () => {
      const result = await settingsManager.validateExport('not valid json');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate File', async () => {
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        settings: {},
        metadata: { exportedBy: 'Test', system: 'test', userAgent: 'test' }
      };

      const file = new File([JSON.stringify(exportData)], 'settings.json');
      const result = await settingsManager.validateExport(file);

      expect(result.valid).toBe(true);
    });
  });

  describe('settingsManager singleton', () => {
    it('should exist', () => {
      expect(settingsManager).toBeDefined();
    });

    it('should be singleton', () => {
      const another = settingsManager;
      expect(settingsManager).toBe(another);
    });
  });
});
