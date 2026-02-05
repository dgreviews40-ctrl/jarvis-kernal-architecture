import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { logger, LogFilter, LogLevel, LogSource, LoggerConfig } from '../services/logger';
import { useLogsStore } from '../stores';
import { 
  Terminal, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Settings, 
  XCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  FileText,
  Calendar,
  BarChart3,
  RotateCcw,
  Upload,
  CheckCircle2,
  XCircle as XCircleIcon
} from 'lucide-react';

const LOG_LEVELS: { value: LogLevel; label: string; color: string }[] = [
  { value: 'all', label: 'All Levels', color: 'text-gray-400' },
  { value: 'info', label: 'Info', color: 'text-blue-400' },
  { value: 'success', label: 'Success', color: 'text-green-400' },
  { value: 'warning', label: 'Warning', color: 'text-yellow-400' },
  { value: 'error', label: 'Error', color: 'text-red-400' }
];

const LOG_SOURCES: { value: LogSource; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'KERNEL', label: 'Kernel' },
  { value: 'GEMINI', label: 'Gemini' },
  { value: 'PLUGIN', label: 'Plugin' },
  { value: 'USER', label: 'User' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'CIRCUIT_BREAKER', label: 'Circuit Breaker' },
  { value: 'REGISTRY', label: 'Registry' },
  { value: 'MEMORY', label: 'Memory' },
  { value: 'OLLAMA', label: 'Ollama' },
  { value: 'VOICE', label: 'Voice' },
  { value: 'VISION', label: 'Vision' },
  { value: 'CORTEX', label: 'Cortex' },
  { value: 'HOME_ASSISTANT', label: 'Home Assistant' }
];

export const LogsDashboard: React.FC = () => {
  // Zustand store
  const {
    filteredLogs: logs,
    filter,
    stats,
    selectedLog,
    searchQuery,
    showSettings,
    importStatus,
    setFilter,
    setSelectedLog,
    setSearchQuery,
    setShowSettings,
    setImportStatus,
    updateFilter,
    clearFilter,
    refreshLogs,
    refreshStats,
    exportLogs,
    importLogs,
    clearLogs,
  } = useLogsStore();
  
  // Local state for config (not in store yet)
  const [config, setConfig] = useState<LoggerConfig>(logger.getConfig());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to log updates
  useEffect(() => {
    refreshLogs();
    refreshStats();
    const unsubscribe = logger.subscribeToFilter((filteredLogs) => {
      refreshLogs();
      refreshStats();
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && !selectedLog) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, selectedLog]);

  const handleFilterChange = (updates: Partial<LogFilter>) => {
    updateFilter(updates);
    logger.setFilter({ ...filter, ...updates });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ searchQuery: searchQuery || undefined });
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (format === 'csv') {
      logger.exportToCSV(filter);
    } else {
      logger.exportToFile(filter);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await importLogs(file);
    e.target.value = '';
    setTimeout(() => setImportStatus(null), 5000);
  };

  const handleClear = () => {
    if (confirm('Clear all logs? This cannot be undone.')) {
      clearLogs();
    }
  };

  const handleClearFiltered = () => {
    const count = logs.length;
    if (confirm(`Clear ${count} filtered logs? This cannot be undone.`)) {
      logger.clearByFilter(filter);
      refreshLogs();
      refreshStats();
    }
  };

  const handleUpdateConfig = (updates: Partial<LoggerConfig>) => {
    logger.setConfig(updates);
    setConfig(logger.getConfig());
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={14} className="text-green-400" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-400" />;
      case 'error': return <XCircle size={14} className="text-red-400" />;
      default: return <Info size={14} className="text-blue-400" />;
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400 border-green-900/30 bg-green-950/10';
      case 'warning': return 'text-yellow-400 border-yellow-900/30 bg-yellow-950/10';
      case 'error': return 'text-red-400 border-red-900/30 bg-red-950/10';
      default: return 'text-blue-400 border-blue-900/30 bg-blue-950/10';
    }
  };

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#333]">
        <div className="flex items-center gap-3">
          <Terminal className="text-cyan-500" size={20} />
          <h2 className="text-lg font-bold text-white">SYSTEM LOGS</h2>
          <span className="text-xs text-gray-500 font-mono">
            {stats.totalLogs} entries • {logger.getFilteredLogs(filter).length} shown
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export Buttons */}
          <button
            onClick={() => handleExport('json')}
            title="Export as JSON"
            className="px-3 py-1.5 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-2 text-xs"
          >
            <Download size={14} />
            JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            title="Export as CSV"
            className="px-3 py-1.5 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-2 text-xs"
          >
            <FileText size={14} />
            CSV
          </button>
          <button
            onClick={handleImportClick}
            title="Import logs"
            className="px-3 py-1.5 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-2 text-xs"
          >
            <Upload size={14} />
          </button>
          
          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1.5 border rounded transition-all flex items-center gap-2 text-xs ${
              showSettings 
                ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' 
                : 'bg-[#111] border-[#333] text-gray-400 hover:text-white'
            }`}
          >
            <Settings size={14} />
          </button>
          
          {/* Clear */}
          <button
            onClick={handleClear}
            title="Clear all logs"
            className="px-3 py-1.5 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all flex items-center gap-2 text-xs"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        className="hidden"
      />

      {/* Import Status */}
      {importStatus && (
        <div className={`px-4 py-2 border-b flex items-center gap-2 text-xs ${
          importStatus.type === 'success' ? 'bg-green-950/30 border-green-900/50 text-green-400' :
          importStatus.type === 'error' ? 'bg-red-950/30 border-red-900/50 text-red-400' :
          'bg-yellow-950/30 border-yellow-900/50 text-yellow-400'
        }`}>
          {importStatus.type === 'success' && <CheckCircle2 size={14} />}
          {importStatus.type === 'error' && <XCircleIcon size={14} />}
          {importStatus.type === null && <RotateCcw size={14} className="animate-spin" />}
          {importStatus.message}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-[#333] bg-[#0d0d0d]">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Max Logs</label>
              <input
                type="number"
                min="100"
                max="10000"
                value={config.maxLogs}
                onChange={(e) => handleUpdateConfig({ maxLogs: parseInt(e.target.value) || 1000 })}
                className="w-full bg-black border border-[#333] rounded px-2 py-1 text-sm text-gray-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Auto Cleanup</label>
              <button
                onClick={() => handleUpdateConfig({ autoCleanup: !config.autoCleanup })}
                className={`w-full py-1.5 rounded text-xs font-bold transition-colors ${
                  config.autoCleanup 
                    ? 'bg-green-900/30 text-green-400 border border-green-600' 
                    : 'bg-red-900/30 text-red-400 border border-red-600'
                }`}
              >
                {config.autoCleanup ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Keep Days</label>
              <input
                type="number"
                min="1"
                max="365"
                value={config.cleanupDays}
                onChange={(e) => handleUpdateConfig({ cleanupDays: parseInt(e.target.value) || 7 })}
                disabled={!config.autoCleanup}
                className="w-full bg-black border border-[#333] rounded px-2 py-1 text-sm text-gray-300 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Persistence</label>
              <button
                onClick={() => handleUpdateConfig({ persistLogs: !config.persistLogs })}
                className={`w-full py-1.5 rounded text-xs font-bold transition-colors ${
                  config.persistLogs 
                    ? 'bg-green-900/30 text-green-400 border border-green-600' 
                    : 'bg-red-900/30 text-red-400 border border-red-600'
                }`}
              >
                {config.persistLogs ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#0d0d0d] flex flex-wrap gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-black border border-[#333] rounded-lg py-2 pl-10 pr-4 text-sm text-gray-300 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </form>

        {/* Level Filter */}
        <select
          value={filter.level || 'all'}
          onChange={(e) => handleFilterChange({ level: e.target.value as LogLevel })}
          className="bg-black border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
        >
          {LOG_LEVELS.map(level => (
            <option key={level.value} value={level.value}>{level.label}</option>
          ))}
        </select>

        {/* Source Filter */}
        <select
          value={filter.source || 'all'}
          onChange={(e) => handleFilterChange({ source: e.target.value as LogSource })}
          className="bg-black border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500"
        >
          {LOG_SOURCES.map(source => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </select>

        {/* Clear Filter */}
        {(filter.level || filter.source || filter.searchQuery) && (
          <button
            onClick={() => {
              setFilter({});
              setSearchQuery('');
              logger.setFilter({});
            }}
            className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
          >
            <XCircle size={18} />
          </button>
        )}

        {/* Clear Filtered */}
        {logs.length > 0 && (filter.level || filter.source || filter.searchQuery) && (
          <button
            onClick={handleClearFiltered}
            className="px-3 py-2 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 hover:bg-red-900/40 transition-colors text-xs font-bold"
          >
            Clear {logs.length}
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 border-b border-[#333] bg-[#0a0a0a] flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-gray-500" />
          <span className="text-gray-400">Total: <span className="text-white font-mono">{stats.totalLogs}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-green-400">● {stats.byLevel.success}</span>
          <span className="text-blue-400">● {stats.byLevel.info}</span>
          <span className="text-yellow-400">● {stats.byLevel.warning}</span>
          <span className="text-red-400">● {stats.byLevel.error}</span>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto font-mono text-xs min-h-0" style={{ maxHeight: 'calc(100vh - 380px)' }}>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Terminal size={48} className="mb-4 opacity-20" />
            <p>No logs match the current filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {logs.map((log) => {
              // Handle case where source might be an object
              const sourceStr = typeof log.source === 'string' ? log.source : 
                               typeof log.source === 'object' && log.source !== null ? 
                               (log.source as any).source || 'UNKNOWN' : 'UNKNOWN';
              
              return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                className={`p-3 cursor-pointer transition-colors hover:bg-[#111] ${
                  selectedLog?.id === log.id ? 'bg-[#151515]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {getLogIcon(log.type)}
                  <span className="text-gray-600 w-16 shrink-0">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    sourceStr === 'ERROR' ? 'bg-red-900/30 text-red-400' :
                    sourceStr === 'SYSTEM' ? 'bg-blue-900/30 text-blue-400' :
                    sourceStr === 'KERNEL' ? 'bg-purple-900/30 text-purple-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {sourceStr}
                  </span>
                  <span className={`flex-1 ${
                    log.type === 'error' ? 'text-red-300' :
                    log.type === 'warning' ? 'text-yellow-300' :
                    log.type === 'success' ? 'text-green-300' :
                    'text-gray-300'
                  }`}>
                    {log.message}
                  </span>
                </div>

                {/* Expanded Details */}
                {selectedLog?.id === log.id && log.details && (
                  <div className="mt-3 ml-7 p-3 bg-black rounded border border-[#333]">
                    <pre className="text-gray-500 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );})}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsDashboard;
