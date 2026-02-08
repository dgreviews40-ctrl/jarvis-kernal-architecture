/**
 * Settings Manager Tests
 * 
 * Tests for settings export/import functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { settingsManager, ExportOptions, ImportOptions } from '../../services/settingsManager';

describe('SettingsManager', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('exportSettings', () => {
    it('should export basic settings', async () => {
      // Set up some test data
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ mainView: 'DASHBOARD' }));
      
      const result = await settingsManager.exportSettings();
      
      expect(result.success).toBe(true);
      expect(result.stats.settingsCount).toBeGreaterThan(0);
      expect(result.data).toBeDefined();
      expect(result.blob).toBeDefined();
    });

    it('should include API keys when requested', async () => {
      const result = await settingsManager.exportSettings({ includeApiKeys: true });
      
      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should encrypt export when password provided', async () => {
      const result = await settingsManager.exportSettings({ 
        password: 'testpassword123' 
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Encrypted data should not be valid JSON
      expect(() => JSON.parse(result.data!)).toThrow();
    });

    it('should include memory when requested', async () => {
      const result = await settingsManager.exportSettings({ includeMemory: true });
      
      expect(result.success).toBe(true);
      // Memory count may be 0 if no memories exist
      expect(typeof result.stats.memoryCount).toBe('number');
    });

    it('should include logs when requested', async () => {
      const result = await settingsManager.exportSettings({ includeLogs: true });
      
      expect(result.success).toBe(true);
      expect(typeof result.stats.logsCount).toBe('number');
    });

    it('should calculate total size', async () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ test: 'data' }));
      
      const result = await settingsManager.exportSettings();
      
      expect(result.success).toBe(true);
      expect(result.stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('importSettings', () => {
    it('should import settings from JSON string', async () => {
      // Create an export first
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ mainView: 'SETTINGS' }));
      const exportResult = await settingsManager.exportSettings();
      
      // Clear localStorage
      localStorage.clear();
      
      // Import
      const importResult = await settingsManager.importSettings(exportResult.data!);
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported.settings.length).toBeGreaterThan(0);
    });

    it('should import settings from File object (if File.text is supported)', async () => {
      // Check if File.text() is available (jsdom doesn't support it natively)
      const testFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
      const hasFileText = typeof testFile.text === 'function';
      
      if (!hasFileText) {
        // Skip this test in environments without File.text() support
        console.log('Skipping File import test - File.text() not available');
        return;
      }
      
      const exportResult = await settingsManager.exportSettings();
      const blob = exportResult.blob!;
      const file = new File([blob], 'test-backup.json', { type: 'application/json' });
      
      localStorage.clear();
      
      const importResult = await settingsManager.importSettings(file);
      
      expect(importResult.success).toBe(true);
    });

    it('should merge settings when merge option is true', async () => {
      // Set existing settings
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ existing: 'data' }));
      
      // Create export with different data
      localStorage.setItem('jarvis-kernel-store', JSON.stringify({ kernel: 'data' }));
      const exportResult = await settingsManager.exportSettings();
      
      // Import with merge
      const importResult = await settingsManager.importSettings(exportResult.data!, { merge: true });
      
      expect(importResult.success).toBe(true);
    });

    it('should handle encrypted imports', async () => {
      const password = 'testpassword123';
      const exportResult = await settingsManager.exportSettings({ password });
      
      localStorage.clear();
      
      const importResult = await settingsManager.importSettings(exportResult.data!, { password });
      
      expect(importResult.success).toBe(true);
    });

    it('should fail with wrong password', async () => {
      const exportResult = await settingsManager.exportSettings({ password: 'correctpassword' });
      
      const importResult = await settingsManager.importSettings(exportResult.data!, { 
        password: 'wrongpassword' 
      });
      
      expect(importResult.success).toBe(false);
      expect(importResult.errors.length).toBeGreaterThan(0);
    });

    it('should report errors for invalid data', async () => {
      const importResult = await settingsManager.importSettings('invalid json');
      
      expect(importResult.success).toBe(false);
      expect(importResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateExport', () => {
    it('should validate correct export file', async () => {
      const exportResult = await settingsManager.exportSettings();
      
      const validation = await settingsManager.validateExport(exportResult.data!);
      
      expect(validation.valid).toBe(true);
      expect(validation.version).toBeDefined();
      expect(validation.exportedAt).toBeDefined();
    });

    it('should reject invalid file', async () => {
      const validation = await settingsManager.validateExport('invalid data');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should validate File object (if File.text is supported)', async () => {
      // Check if File.text() is available
      const testFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
      const hasFileText = typeof testFile.text === 'function';
      
      if (!hasFileText) {
        // Skip this test in environments without File.text() support
        console.log('Skipping File validation test - File.text() not available');
        return;
      }
      
      const exportResult = await settingsManager.exportSettings();
      const file = new File([exportResult.blob!], 'test.json', { type: 'application/json' });
      
      const validation = await settingsManager.validateExport(file);
      
      expect(validation.valid).toBe(true);
    });
  });

  describe('getSettingsSummary', () => {
    it('should return summary of settings', () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ test: 'data' }));
      
      const summary = settingsManager.getSettingsSummary();
      
      expect(summary.settings.length).toBeGreaterThan(0);
      expect(summary.totalSize).toBeGreaterThan(0);
      expect(typeof summary.hasEncryption).toBe('boolean');
    });

    it('should calculate sizes correctly', () => {
      const testData = { key: 'value' };
      localStorage.setItem('jarvis-ui-store', JSON.stringify(testData));
      
      const summary = settingsManager.getSettingsSummary();
      const uiSetting = summary.settings.find(s => s.key === 'jarvis-ui-store');
      
      expect(uiSetting).toBeDefined();
      expect(uiSetting!.size).toBeGreaterThan(0);
    });
  });

  describe('clearAllSettings', () => {
    it('should clear all JARVIS settings', () => {
      localStorage.setItem('jarvis-ui-store', 'data');
      localStorage.setItem('jarvis-kernel-store', 'data');
      localStorage.setItem('other-key', 'should remain');
      
      settingsManager.clearAllSettings();
      
      expect(localStorage.getItem('jarvis-ui-store')).toBeNull();
      expect(localStorage.getItem('jarvis-kernel-store')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('should remain');
    });
  });

  describe('Export format', () => {
    it('should include required metadata', async () => {
      const result = await settingsManager.exportSettings();
      const data = JSON.parse(result.data!);
      
      expect(data.version).toBeDefined();
      expect(data.exportedAt).toBeDefined();
      expect(data.appVersion).toBeDefined();
      expect(data.metadata).toBeDefined();
      expect(data.metadata.exportedBy).toBeDefined();
      expect(data.metadata.system).toBeDefined();
    });

    it('should include settings object', async () => {
      localStorage.setItem('jarvis-ui-store', JSON.stringify({ test: true }));
      
      const result = await settingsManager.exportSettings();
      const data = JSON.parse(result.data!);
      
      expect(data.settings).toBeDefined();
      expect(data.settings['jarvis-ui-store']).toBeDefined();
    });
  });
});
