import React, { useState, useRef, useEffect } from 'react';
import { MemoryNode, MemorySearchResult } from '../types';
import { Database, Search, Clock, Tag, Trash2, Download, Upload, Save, Settings, AlertTriangle, CheckCircle, XCircle, BarChart3, Archive, RotateCcw } from 'lucide-react';
import { memory, MemoryExportData, MemoryBackupConfig } from '../services/memory';
import { useMemoryStore } from '../stores';

interface MemoryBankProps {
  nodes: MemoryNode[];
  onForget: (id: string) => void;
  onManualSearch: (query: string) => Promise<MemorySearchResult[]>;
  onMemoryUpdate?: () => void;
}

type ViewMode = 'memories' | 'backups' | 'stats';

interface MemoryStats {
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
  indexSize: 0
};

export const MemoryBank: React.FC<MemoryBankProps> = ({ nodes, onForget, onManualSearch, onMemoryUpdate }) => {
  // Zustand store
  const { stats, refreshStats, backups, refreshBackups } = useMemoryStore();
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('memories');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string } | null>(null);
  const [backupConfig, setBackupConfig] = useState<MemoryBackupConfig>(memory.getBackupConfig());
  const [showBackupSettings, setShowBackupSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stats asynchronously
  useEffect(() => {
    refreshStats();
  }, []);

  // Refresh stats when nodes change
  useEffect(() => {
    refreshStats();
    refreshBackups();
  }, [nodes.length]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await onManualSearch(searchQuery);
    setSearchResults(results);
  };

  const displayNodes = searchResults ? searchResults.map(r => r.node) : (Array.isArray(nodes) ? nodes : []);

  const getTypeColor = (type: MemoryNode['type']) => {
    switch (type) {
      case 'FACT': return 'text-blue-400 border-blue-900/50 bg-blue-950/20';
      case 'PREFERENCE': return 'text-purple-400 border-purple-900/50 bg-purple-950/20';
      case 'EPISODE': return 'text-green-400 border-green-900/50 bg-green-950/20';
      default: return 'text-gray-400 border-gray-800 bg-gray-900/20';
    }
  };

  // ==================== EXPORT/IMPORT ====================

  const handleExport = () => {
    memory.exportToFile();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: null, message: 'Importing...' });
    
    const result = await memory.importFromFile(file);
    
    if (result.success) {
      setImportStatus({ 
        type: 'success', 
        message: `Imported ${result.imported} memories successfully!` 
      });
      onMemoryUpdate?.();
    } else {
      setImportStatus({ 
        type: 'error', 
        message: `Import failed. ${result.errors[0] || 'Unknown error'}` 
      });
    }

    // Clear file input
    e.target.value = '';
    
    // Clear status after 5 seconds
    setTimeout(() => setImportStatus(null), 5000);
  };

  // ==================== BACKUP ====================

  const handleCreateBackup = async () => {
    memory.createBackup();
    refreshBackups();
    await refreshStats();
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (confirm('Restore this backup? Current memories will be replaced.')) {
      const success = memory.restoreBackup(backupId);
      if (success) {
        onMemoryUpdate?.();
        await refreshStats();
      }
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (confirm('Delete this backup?')) {
      memory.deleteBackup(backupId);
      refreshBackups();
      await refreshStats();
    }
  };

  const handleUpdateBackupConfig = (updates: Partial<MemoryBackupConfig>) => {
    memory.setBackupConfig(updates);
    setBackupConfig(memory.getBackupConfig());
  };

  // ==================== RENDER ====================

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="text-purple-500" />
          LONG-TERM MEMORY CORE
        </h2>
        <div className="flex items-center gap-2">
          {/* View Mode Tabs */}
          <div className="flex bg-[#111] rounded-lg p-1">
            <button
              onClick={() => setViewMode('memories')}
              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
                viewMode === 'memories' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              MEMORIES
            </button>
            <button
              onClick={() => setViewMode('backups')}
              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 ${
                viewMode === 'backups' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              BACKUPS
              {stats.totalBackups > 0 && (
                <span className="bg-purple-900/50 text-purple-400 px-1 rounded text-[9px]">{stats.totalBackups}</span>
              )}
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
                viewMode === 'stats' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              STATS
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-500 font-mono">
        <span>{nodes.length} RECORDS • {stats.totalBackups} BACKUPS</span>
        {importStatus && (
          <span className={`flex items-center gap-1 ${
            importStatus.type === 'success' ? 'text-green-400' : 
            importStatus.type === 'error' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {importStatus.type === 'success' && <CheckCircle size={12} />}
            {importStatus.type === 'error' && <XCircle size={12} />}
            {importStatus.type === null && <RotateCcw size={12} className="animate-spin" />}
            {importStatus.message}
          </span>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        className="hidden"
      />

      {/* MEMORIES VIEW */}
      {viewMode === 'memories' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search & Actions Bar */}
          <div className="flex gap-2 mb-4">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search semantic memory..."
                className="w-full bg-[#111] border border-[#333] rounded-lg py-2 pl-10 pr-4 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </form>
            <button
              onClick={handleExport}
              title="Export to JSON"
              className="px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-all flex items-center gap-2"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleImportClick}
              title="Import from JSON"
              className="px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-all flex items-center gap-2"
            >
              <Upload size={16} />
            </button>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-0">
            {displayNodes.length === 0 && (
              <div className="text-center text-gray-600 italic py-8">
                {searchQuery ? 'No memories found matching query.' : 'No memories stored yet.'}
              </div>
            )}

            {displayNodes.map(node => (
              <div
                key={node.id}
                className={`border rounded-lg p-3 transition-all hover:bg-[#151515] group relative ${getTypeColor(node.type).split(' ').slice(1).join(' ')}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTypeColor(node.type)}`}>
                    {node.type}
                  </span>
                  <span className="text-[10px] text-gray-600 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(node.created).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-gray-300 mb-2 leading-relaxed">
                  {node.content}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {node.tags.map(tag => (
                    <div key={tag} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Tag size={8} />
                      {tag}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onForget(node.id)}
                  className="absolute top-3 right-3 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BACKUPS VIEW */}
      {viewMode === 'backups' && (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Backup Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateBackup}
              className="flex-1 px-4 py-2 bg-purple-900/30 border border-purple-500/50 rounded-lg text-purple-400 hover:bg-purple-900/50 transition-all flex items-center justify-center gap-2 text-sm font-bold"
            >
              <Save size={16} />
              CREATE BACKUP
            </button>
            <button
              onClick={() => setShowBackupSettings(!showBackupSettings)}
              className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 text-sm ${
                showBackupSettings
                  ? 'bg-gray-800 border-gray-600 text-white'
                  : 'bg-[#111] border-[#333] text-gray-400 hover:text-white'
              }`}
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Backup Settings */}
          {showBackupSettings && (
            <div className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Auto-Backup Settings</h3>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Enable Auto-Backup</span>
                <button
                  onClick={() => handleUpdateBackupConfig({ autoBackup: !backupConfig.autoBackup })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    backupConfig.autoBackup ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    backupConfig.autoBackup ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Backup Interval (minutes)</span>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={backupConfig.backupInterval}
                  onChange={(e) => handleUpdateBackupConfig({ backupInterval: parseInt(e.target.value) || 60 })}
                  className="w-20 bg-black border border-[#333] rounded px-2 py-1 text-sm text-gray-300 text-right"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Max Backups</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={backupConfig.maxBackups}
                  onChange={(e) => handleUpdateBackupConfig({ maxBackups: parseInt(e.target.value) || 10 })}
                  className="w-20 bg-black border border-[#333] rounded px-2 py-1 text-sm text-gray-300 text-right"
                />
              </div>
            </div>
          )}

          {/* Backups List */}
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            {backups.length === 0 ? (
              <div className="text-center text-gray-600 italic py-8">
                No backups yet. Click "Create Backup" to make one.
              </div>
            ) : (
              backups.slice().reverse().map((backup, index) => (
                <div
                  key={backup.id}
                  className="bg-[#111] border border-[#333] rounded-lg p-3 flex items-center justify-between group hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Archive size={16} className="text-purple-500" />
                    <div>
                      <div className="text-sm text-gray-300 font-mono">
                        Backup #{backups.length - index}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(backup.timestamp).toLocaleString()} • {backup.data.nodeCount} nodes
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestoreBackup(backup.id)}
                      title="Restore"
                      className="p-1.5 text-gray-400 hover:text-green-400 transition-colors"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* STATS VIEW */}
      {viewMode === 'stats' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 overflow-hidden">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#111] border border-[#333] rounded-lg p-4">
              <div className="text-[10px] text-gray-500 uppercase mb-1">Total Memories</div>
              <div className="text-2xl font-bold text-white">{stats.totalNodes}</div>
            </div>
            <div className="bg-[#111] border border-[#333] rounded-lg p-4">
              <div className="text-[10px] text-gray-500 uppercase mb-1">Total Backups</div>
              <div className="text-2xl font-bold text-white">{stats.totalBackups}</div>
            </div>
          </div>

          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">By Type</h3>
          <div className="space-y-2 mb-6">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between bg-[#111] border border-[#333] rounded-lg p-3">
                <span className={`text-sm font-bold ${
                  type === 'FACT' ? 'text-blue-400' :
                  type === 'PREFERENCE' ? 'text-purple-400' :
                  type === 'EPISODE' ? 'text-green-400' : 'text-gray-400'
                }`}>{type}</span>
                <span className="text-sm text-gray-300">{count}</span>
              </div>
            ))}
          </div>

          {stats.oldestMemory > 0 && (
            <>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Timeline</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#111] border border-[#333] rounded-lg p-3">
                  <span className="text-sm text-gray-400">First Memory</span>
                  <span className="text-sm text-gray-300">{new Date(stats.oldestMemory).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between bg-[#111] border border-[#333] rounded-lg p-3">
                  <span className="text-sm text-gray-400">Latest Memory</span>
                  <span className="text-sm text-gray-300">{new Date(stats.newestMemory).toLocaleDateString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
