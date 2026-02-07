/**
 * Vector DB Dashboard Component
 * 
 * Displays vector database statistics, backend status, and provides
 * management functions for the semantic memory system.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Database, Search, Trash2, Download, Upload, RefreshCw, Brain, Hash, Server, Layers } from 'lucide-react';
import { vectorDB, VectorDBStats } from '../services/vectorDB';
import { logger } from '../services/logger';

interface VectorDBDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VectorDBDashboard: React.FC<VectorDBDashboardProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; content: string; score: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const initializeDB = useCallback(async () => {
    // Check if already initialized by trying to get stats quickly
    try {
      const quickStats = await Promise.race([
        vectorDB.getStats(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
      ]);
      if (quickStats) {
        setIsInitialized(true);
        setStats(quickStats);
        return true;
      }
    } catch {
      // Not initialized yet, continue with initialization
    }

    try {
      setIsInitializing(true);
      setError(null);
      
      // Set a maximum initialization time of 10 seconds
      const initPromise = vectorDB.initialize();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          logger.log('VECTOR_DB', 'Dashboard: Initialization timeout reached', 'warning');
          resolve(false);
        }, 10000);
      });
      
      const initialized = await Promise.race([initPromise, timeoutPromise]);
      setIsInitialized(initialized);
      
      if (!initialized) {
        setError('Vector DB initialization timed out. Using fallback mode.');
      }
      return initialized;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Initialization failed: ${errMsg}`);
      setIsInitialized(false);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      logger.log('VECTOR_DB', 'Dashboard: Loading stats...', 'info');
      
      // Load stats with timeout - will fail if not initialized
      const statsPromise = vectorDB.getStats();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const newStats = await Promise.race([statsPromise, timeoutPromise]);
      logger.log('VECTOR_DB', `Dashboard: Stats loaded - ${newStats.totalVectors} vectors`, 'success');
      setStats(newStats);
      setIsInitialized(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.log('VECTOR_DB', `Dashboard: Failed to load stats: ${errMsg}`, 'warning');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Single initialization attempt when opened
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeDB();
    }
  }, [isOpen, initializeDB]);

  // Separate effect for refresh interval
  useEffect(() => {
    if (!isOpen) return;
    
    // Load stats immediately
    loadStats();
    
    // Set up refresh interval
    const interval = setInterval(() => {
      loadStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results = await vectorDB.search(searchQuery, { maxResults: 10 });
      setSearchResults(results.map(r => ({
        id: r.node.id,
        content: r.node.content.substring(0, 100) + (r.node.content.length > 100 ? '...' : ''),
        score: r.score,
      })));
    } catch (err) {
      setError('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      const data = await vectorDB.export();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jarvis-vector-db-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Database exported successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Export failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const text = await file.text();
      const result = await vectorDB.import(text);
      setSuccess(`Imported ${result.imported} vectors (${result.errors} errors)`);
      loadStats();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure? This will delete ALL vector memories!')) return;
    
    try {
      setIsLoading(true);
      await vectorDB.clear();
      setSuccess('Database cleared');
      loadStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Clear failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getBackendIcon = (backend: string) => {
    switch (backend) {
      case 'transformers': return <Brain className="w-4 h-4" />;
      case 'api': return <Server className="w-4 h-4" />;
      case 'hash': return <Hash className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getBackendLabel = (backend: string) => {
    switch (backend) {
      case 'transformers': return 'Transformers.js (Local AI)';
      case 'api': return 'API (OpenAI-compatible)';
      case 'hash': return 'Hash-based (Fallback)';
      default: return backend;
    }
  };

  const getBackendColor = (backend: string) => {
    switch (backend) {
      case 'transformers': return 'text-green-400 bg-green-400/10';
      case 'api': return 'text-blue-400 bg-blue-400/10';
      case 'hash': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-cyan-500/20 flex items-center justify-between bg-cyan-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Vector Database</h2>
              <p className="text-sm text-cyan-400/70">Semantic Memory Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Initialization Status - only show when no stats yet */}
          {!stats && (isInitializing || !isInitialized) && (
            <div className={`p-4 rounded-lg border ${isInitializing ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isInitializing ? (
                    <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
                  ) : (
                    <Database className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <div className={`font-medium ${isInitializing ? 'text-yellow-400' : 'text-red-400'}`}>
                      {isInitializing ? 'Initializing Vector Database...' : 'Vector DB Not Initialized'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {isInitializing 
                        ? 'Loading embedding model and building index...' 
                        : 'Click retry to initialize the vector database'}
                    </div>
                  </div>
                </div>
                {!isInitializing && (
                  <button
                    onClick={initializeDB}
                    className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded text-sm transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400">
              {success}
            </div>
          )}

          {/* Stats Grid -- show when we have stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gray-800/50 border border-cyan-500/20">
                <div className="text-2xl font-bold text-white">{stats.totalVectors.toLocaleString()}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Total Vectors</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-800/50 border border-cyan-500/20">
                <div className="text-2xl font-bold text-white">{(stats.averageVectorSize / 1024).toFixed(1)} KB</div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Avg Vector Size</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-800/50 border border-cyan-500/20">
                <div className="text-2xl font-bold text-white">{stats.cacheSize.toLocaleString()}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Cached Vectors</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-800/50 border border-cyan-500/20">
                <div className="text-2xl font-bold text-white">{stats.embeddingCacheSize.toLocaleString()}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">Embedding Cache</div>
              </div>
            </div>
          )}

          {/* Backend Status */}
          {stats && (
            <div className="p-4 rounded-lg bg-gray-800/30 border border-cyan-500/20">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Embedding Backend</span>
                <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getBackendColor(stats.backend)}`}>
                  {getBackendIcon(stats.backend)}
                  {getBackendLabel(stats.backend)}
                </span>
              </div>
            </div>
          )}

          {/* Search */}
          <div className={`space-y-4 ${!isInitialized ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              Semantic Search
              {!isInitialized && <span className="text-xs text-yellow-400 ml-2">(Initialize to use)</span>}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={isInitialized ? "Search memories..." : "Initialize first..."}
                disabled={!isInitialized}
                className="flex-1 px-4 py-2 bg-gray-800 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim() || !isInitialized}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <div key={result.id} className="p-3 rounded-lg bg-gray-800/50 border border-cyan-500/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-cyan-400/70 font-mono">{result.id}</span>
                      <span className="text-xs text-green-400">{(result.score * 100).toFixed(1)}% match</span>
                    </div>
                    <p className="text-sm text-gray-300">{result.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Database Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                disabled={isLoading || !isInitialized}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <label className={`px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${!isInitialized ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={!isInitialized}
                  className="hidden"
                />
              </label>
              <button
                onClick={loadStats}
                disabled={isLoading || isInitializing}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${(isLoading || isInitializing) ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleClear}
                disabled={isLoading || !isInitialized}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-500/20 bg-gray-900/50 text-center text-sm text-gray-500">
          {stats ? (
            <>Using HNSW indexing with {stats.indexSize.toLocaleString()} nodes • {getBackendLabel(stats.backend)}</>
          ) : isInitializing ? (
            <>Vector Database initializing...</>
          ) : (
            <>Vector Database not initialized</>
          )}
        </div>
      </div>
    </div>
  );
};

export default VectorDBDashboard;
