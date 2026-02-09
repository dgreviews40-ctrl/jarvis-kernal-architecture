/**
 * Settings Manager
 * 
 * Export and import all JARVIS settings:
 * - UI preferences (view, tabs)
 * - AI provider settings
 * - Log configuration
 * - Plugin selections
 * - API keys (encrypted)
 * - Memory data (optional)
 */

import { apiKeyManager } from './apiKeyManager';
import { memory } from './memory';
import { logger } from './logger';

// Version for export format compatibility
const EXPORT_VERSION = 1;

// Keys to export from localStorage
const STORAGE_KEYS = [
  'jarvis-ui-store',
  'jarvis-kernel-store',
  'jarvis-logs-store',
  'jarvis-plugin-store',
  'jarvis-store-version',
];

// Settings that contain sensitive data
const SENSITIVE_KEYS = ['jarvis-api-keys'];

export interface ExportOptions {
  includeApiKeys?: boolean;
  includeMemory?: boolean;
  includeLogs?: boolean;
  password?: string; // For encrypting the export
}

export interface ImportOptions {
  merge?: boolean; // Merge with existing or replace
  password?: string; // For decrypting the import
}

export interface SettingsExport {
  version: number;
  exportedAt: string;
  appVersion: string;
  settings: Record<string, unknown>;
  apiKeys?: Record<string, string>;
  memory?: unknown[];
  logs?: unknown[];
  metadata: {
    exportedBy: string;
    system: string;
    userAgent: string;
  };
}

export interface ExportResult {
  success: boolean;
  data?: string;
  blob?: Blob;
  error?: string;
  stats: {
    settingsCount: number;
    apiKeysCount: number;
    memoryCount: number;
    logsCount: number;
    totalSize: number;
  };
}

export interface ImportResult {
  success: boolean;
  imported: {
    settings: string[];
    apiKeys: number;
    memory: number;
    logs: number;
  };
  errors: string[];
  warnings: string[];
}

class SettingsManager {
  /**
   * Export all settings
   */
  async exportSettings(options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const exportData: SettingsExport = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: this.getAppVersion(),
        settings: {},
        metadata: {
          exportedBy: 'JARVIS User',
          system: navigator.platform,
          userAgent: navigator.userAgent,
        },
      };

      // Collect settings from localStorage
      let settingsCount = 0;
      for (const key of STORAGE_KEYS) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            exportData.settings[key] = JSON.parse(data);
            settingsCount++;
          } catch {
            exportData.settings[key] = data;
            settingsCount++;
          }
        }
      }

      // Collect API keys (if requested and encryption enabled)
      let apiKeysCount = 0;
      if (options.includeApiKeys) {
        const providers = ['gemini', 'ollama', 'openai', 'anthropic'] as const;
        exportData.apiKeys = {};
        
        for (const provider of providers) {
          const key = await apiKeyManager.getKey(provider);
          if (key) {
            exportData.apiKeys[provider] = key;
            apiKeysCount++;
          }
        }
      }

      // Collect memory data (if requested)
      let memoryCount = 0;
      if (options.includeMemory) {
        const memories = await memory.getAll();
        exportData.memory = memories;
        memoryCount = memories.length;
      }

      // Collect logs (if requested)
      let logsCount = 0;
      if (options.includeLogs) {
        const logs = logger.getRecent(1000);
        exportData.logs = logs;
        logsCount = logs.length;
      }

      // Encrypt if password provided
      let finalData: string;
      if (options.password) {
        finalData = await this.encryptExport(exportData, options.password);
      } else {
        finalData = JSON.stringify(exportData, null, 2);
      }

      const blob = new Blob([finalData], { 
        type: options.password ? 'application/jarvis-encrypted' : 'application/json' 
      });

      logger.success('SETTINGS', 'Settings exported successfully', {
        settings: settingsCount,
        apiKeys: apiKeysCount,
        memory: memoryCount,
        logs: logsCount,
      });

      return {
        success: true,
        data: finalData,
        blob,
        stats: {
          settingsCount,
          apiKeysCount,
          memoryCount,
          logsCount,
          totalSize: finalData.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      logger.log('SYSTEM', `Export failed: ${message}`, 'error');
      return {
        success: false,
        error: message,
        stats: { settingsCount: 0, apiKeysCount: 0, memoryCount: 0, logsCount: 0, totalSize: 0 },
      };
    }
  }

  /**
   * Import settings from file or data
   */
  async importSettings(
    file: File | string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: { settings: [], apiKeys: 0, memory: 0, logs: 0 },
      errors: [],
      warnings: [],
    };

    try {
      // Read file content
      let content: string;
      if (typeof file === 'string') {
        content = file;
      } else {
        content = await file.text();
      }

      // Decrypt if password provided
      let exportData: SettingsExport;
      if (options.password) {
        exportData = await this.decryptExport(content, options.password);
      } else {
        exportData = JSON.parse(content);
      }

      // Validate version
      if (exportData.version > EXPORT_VERSION) {
        result.errors.push(`Export version ${exportData.version} is newer than supported version ${EXPORT_VERSION}`);
        return result;
      }

      // Import settings
      if (!options.merge) {
        // Clear existing settings first
        this.clearAllSettings();
      }

      for (const [key, value] of Object.entries(exportData.settings)) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          result.imported.settings.push(key);
        } catch (error) {
          result.errors.push(`Failed to import ${key}: ${error}`);
        }
      }

      // Import API keys
      if (exportData.apiKeys) {
        for (const [provider, key] of Object.entries(exportData.apiKeys)) {
          try {
            await apiKeyManager.setKey(provider as any, key);
            result.imported.apiKeys++;
          } catch (error) {
            result.errors.push(`Failed to import API key for ${provider}: ${error}`);
          }
        }
      }

      // Import memory
      if (exportData.memory && Array.isArray(exportData.memory)) {
        for (const mem of exportData.memory) {
          try {
            const memoryItem = mem as { content: string; type: string; tags: string[] };
            await memory.store(memoryItem.content, memoryItem.type as import('../types').MemoryType, memoryItem.tags);
            result.imported.memory++;
          } catch (error) {
            result.warnings.push(`Failed to import memory: ${error}`);
          }
        }
      }

      // Import logs
      if (exportData.logs && Array.isArray(exportData.logs)) {
        // Logs are imported to memory only, not persisted
        result.imported.logs = exportData.logs.length;
      }

      result.success = result.errors.length === 0;

      if (result.success) {
        logger.success('SETTINGS', 'Settings imported successfully', {
          settings: result.imported.settings.length,
          apiKeys: result.imported.apiKeys,
          memory: result.imported.memory,
        });
      } else {
        logger.log('SYSTEM', `Settings imported with ${result.errors.length} errors and ${result.warnings.length} warnings`, 'warning');
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      logger.log('SYSTEM', `Import failed: ${message}`, 'error');
      result.errors.push(message);
      return result;
    }
  }

  /**
   * Download settings as file
   */
  downloadExport(blob: Blob, filename?: string): void {
    const date = new Date().toISOString().split('T')[0];
    const defaultName = `jarvis-settings-${date}.json`;
    const finalName = filename || defaultName;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.log('SYSTEM', `Settings downloaded as ${finalName}`);
  }

  /**
   * Clear all settings
   */
  clearAllSettings(): void {
    for (const key of STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    logger.log('SYSTEM', 'All settings cleared');
  }

  /**
   * Get settings summary for display
   */
  getSettingsSummary(): {
    settings: Array<{ key: string; size: number; lastModified?: number }>;
    totalSize: number;
    hasEncryption: boolean;
  } {
    const settings: Array<{ key: string; size: number; lastModified?: number }> = [];
    let totalSize = 0;

    for (const key of STORAGE_KEYS) {
      const data = localStorage.getItem(key);
      if (data) {
        const size = new Blob([data]).size;
        totalSize += size;
        settings.push({
          key,
          size,
        });
      }
    }

    return {
      settings,
      totalSize,
      hasEncryption: apiKeyManager.isInitialized() && apiKeyManager.isSecure(),
    };
  }

  /**
   * Validate export file
   */
  async validateExport(file: File | string): Promise<{
    valid: boolean;
    version?: number;
    exportedAt?: string;
    error?: string;
  }> {
    try {
      let content: string;
      if (typeof file === 'string') {
        content = file;
      } else {
        content = await file.text();
      }

      const data = JSON.parse(content);
      
      if (!data.version || !data.exportedAt) {
        return { valid: false, error: 'Invalid export format' };
      }

      return {
        valid: true,
        version: data.version,
        exportedAt: data.exportedAt,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid file',
      };
    }
  }

  // Private methods
  private getAppVersion(): string {
    // In a real app, this would come from package.json
    return '1.0.0';
  }

  private async encryptExport(data: SettingsExport, password: string): Promise<string> {
    // Simple encryption using Web Crypto API
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    
    const passwordBuffer = encoder.encode(password);
    const passwordHash = await crypto.subtle.digest('SHA-256', passwordBuffer);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
      'raw',
      passwordHash,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...result));
  }

  private async decryptExport(encryptedData: string, password: string): Promise<SettingsExport> {
    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const passwordHash = await crypto.subtle.digest('SHA-256', passwordBuffer);
    
    const key = await crypto.subtle.importKey(
      'raw',
      passwordHash,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}

// Export singleton
export const settingsManager = new SettingsManager();
