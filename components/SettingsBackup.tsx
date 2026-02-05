/**
 * Settings Backup & Restore UI
 * 
 * Export and import JARVIS settings
 */

import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Lock,
  Unlock,
  FileJson,
  Database,
  Key,
  History,
  CheckCircle,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  X
} from 'lucide-react';
import { settingsManager, ExportOptions, ImportOptions } from '../services/settingsManager';
import { logger } from '../services/logger';

interface SettingsBackupProps {
  onClose?: () => void;
}

export const SettingsBackup: React.FC<SettingsBackupProps> = ({ onClose }) => {
  // Export state
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [encryptExport, setEncryptExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStats, setExportStats] = useState<{
    settingsCount: number;
    apiKeysCount: number;
    memoryCount: number;
    logsCount: number;
    totalSize: number;
  } | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [mergeSettings, setMergeSettings] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: { settings: string[]; apiKeys: number; memory: number; logs: number };
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Settings summary
  const [showSummary, setShowSummary] = useState(false);
  const summary = settingsManager.getSettingsSummary();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle export
  const handleExport = async () => {
    if (encryptExport && exportPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (encryptExport && exportPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setIsExporting(true);
    try {
      const options: ExportOptions = {
        includeApiKeys,
        includeMemory,
        includeLogs,
        password: encryptExport ? exportPassword : undefined,
      };

      const result = await settingsManager.exportSettings(options);
      
      if (result.success && result.blob) {
        const extension = encryptExport ? 'jarvis' : 'json';
        const date = new Date().toISOString().split('T')[0];
        settingsManager.downloadExport(result.blob, `jarvis-backup-${date}.${extension}`);
        setExportStats(result.stats);
        logger.success('SETTINGS', 'Settings exported successfully');
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    
    try {
      const options: ImportOptions = {
        merge: mergeSettings,
        password: importPassword || undefined,
      };

      const result = await settingsManager.importSettings(importFile, options);
      setImportResult(result);
      
      if (result.success) {
        logger.success('SETTINGS', 'Settings imported successfully');
      } else {
        logger.log('SYSTEM', 'Settings imported with errors');
      }
    } catch (error) {
      alert(`Import failed: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Save className="text-cyan-400" size={24} />
          <h2 className="text-xl font-bold text-white">Backup & Restore Settings</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Settings Summary */}
      <div className="mb-6">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="flex items-center justify-between w-full p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database size={18} className="text-gray-400" />
            <span className="text-gray-300">Current Settings</span>
            <span className="text-sm text-gray-500">
              ({summary.settings.length} items, {formatBytes(summary.totalSize)})
            </span>
          </div>
          {showSummary ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        {showSummary && (
          <div className="mt-2 p-3 bg-gray-800/50 rounded-lg space-y-2">
            {summary.settings.map(({ key, size }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 font-mono">{key}</span>
                <span className="text-gray-500">{formatBytes(size)}</span>
              </div>
            ))}
            {summary.hasEncryption && (
              <div className="flex items-center gap-2 text-sm text-green-400 mt-2 pt-2 border-t border-gray-700">
                <Lock size={14} />
                API key encryption enabled
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Download size={20} className="text-green-400" />
          Export Settings
        </h3>

        <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg">
          {/* Export Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeApiKeys}
                onChange={(e) => setIncludeApiKeys(e.target.checked)}
                className="rounded border-gray-600"
              />
              <Key size={16} className="text-yellow-400" />
              <span className="text-gray-300">Include API keys</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMemory}
                onChange={(e) => setIncludeMemory(e.target.checked)}
                className="rounded border-gray-600"
              />
              <Database size={16} className="text-purple-400" />
              <span className="text-gray-300">Include memory data</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLogs}
                onChange={(e) => setIncludeLogs(e.target.checked)}
                className="rounded border-gray-600"
              />
              <History size={16} className="text-blue-400" />
              <span className="text-gray-300">Include recent logs</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={encryptExport}
                onChange={(e) => setEncryptExport(e.target.checked)}
                className="rounded border-gray-600"
              />
              <Lock size={16} className="text-red-400" />
              <span className="text-gray-300">Encrypt with password</span>
            </label>
          </div>

          {/* Password Fields */}
          {encryptExport && (
            <div className="space-y-3 pt-3 border-t border-gray-700">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting || (encryptExport && (!exportPassword || exportPassword !== confirmPassword))}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-black font-medium rounded-lg transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={18} />
                Export Settings
              </>
            )}
          </button>

          {/* Export Stats */}
          {exportStats && (
            <div className="p-3 bg-green-900/20 border border-green-900/50 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle size={16} />
                <span className="font-medium">Export successful!</span>
              </div>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Settings: {exportStats.settingsCount}</p>
                {exportStats.apiKeysCount > 0 && <p>API keys: {exportStats.apiKeysCount}</p>}
                {exportStats.memoryCount > 0 && <p>Memory items: {exportStats.memoryCount}</p>}
                {exportStats.logsCount > 0 && <p>Log entries: {exportStats.logsCount}</p>}
                <p>Total size: {formatBytes(exportStats.totalSize)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-cyan-400" />
          Import Settings
        </h3>

        <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg">
          {/* File Upload */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Backup File</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.jarvis"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <FileJson size={18} />
                Choose File
              </button>
              {importFile && (
                <span className="text-sm text-gray-400">
                  {importFile.name} ({formatBytes(importFile.size)})
                </span>
              )}
            </div>
          </div>

          {/* Import Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mergeSettings}
                onChange={(e) => setMergeSettings(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-gray-300">Merge with existing settings (don't overwrite)</span>
            </label>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              <div className="flex items-center gap-2">
                <Unlock size={14} />
                Password (if encrypted)
              </div>
            </label>
            <input
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder="Enter password if file is encrypted"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={isImporting || !importFile}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-black font-medium rounded-lg transition-colors"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Import Settings
              </>
            )}
          </button>

          {/* Import Result */}
          {importResult && (
            <div className={`p-3 rounded-lg ${importResult.success ? 'bg-green-900/20 border border-green-900/50' : 'bg-yellow-900/20 border border-yellow-900/50'}`}>
              <div className={`flex items-center gap-2 mb-2 ${importResult.success ? 'text-green-400' : 'text-yellow-400'}`}>
                {importResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span className="font-medium">
                  {importResult.success ? 'Import successful!' : 'Import completed with issues'}
                </span>
              </div>
              
              <div className="text-sm text-gray-400 space-y-1">
                <p>Settings imported: {importResult.imported.settings.length}</p>
                {importResult.imported.apiKeys > 0 && <p>API keys: {importResult.imported.apiKeys}</p>}
                {importResult.imported.memory > 0 && <p>Memory items: {importResult.imported.memory}</p>}
                {importResult.imported.logs > 0 && <p>Log entries: {importResult.imported.logs}</p>}
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-900/30">
                  <p className="text-red-400 text-sm font-medium mb-1">Errors:</p>
                  <ul className="text-sm text-red-400/80 space-y-1">
                    {importResult.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.warnings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-900/30">
                  <p className="text-yellow-400 text-sm font-medium mb-1">Warnings:</p>
                  <ul className="text-sm text-yellow-400/80 space-y-1">
                    {importResult.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clear Settings */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <Trash2 size={20} />
          Danger Zone
        </h3>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to clear all settings? This cannot be undone.')) {
              settingsManager.clearAllSettings();
              alert('All settings cleared. Please refresh the page.');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg transition-colors"
        >
          <Trash2 size={18} />
          Clear All Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsBackup;
