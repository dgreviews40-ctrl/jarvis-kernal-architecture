/**
 * KV-Cache Monitor Component
 * 
 * Displays real-time statistics for Ollama KV-Cache, including:
 * - Cache hit/miss rates
 * - Active conversation contexts
 * - Estimated latency improvements
 * - Token usage
 */

import React from 'react';
import { useKVCache } from '../hooks/useKVCache';
import { 
  Cpu, 
  Zap, 
  Trash2, 
  Activity, 
  Database,
  Clock,
  ToggleLeft,
  ToggleRight,
  RefreshCw
} from 'lucide-react';

export const KVCacheMonitor: React.FC = () => {
  const { 
    stats, 
    activeContexts, 
    isEnabled, 
    isLoading, 
    refresh, 
    clearContext, 
    clearAll,
    setEnabled 
  } = useKVCache(3000); // Update every 3 seconds

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading KV-Cache stats...
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">KV-Cache Monitor</h3>
              <p className="text-sm text-slate-400">
                Ollama conversation context caching
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => setEnabled(!isEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {isEnabled ? (
                <><ToggleRight className="w-4 h-4" /> Enabled</>
              ) : (
                <><ToggleLeft className="w-4 h-4" /> Disabled</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-700">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Hit Rate
            </div>
            <div className="text-2xl font-bold text-white">
              {stats.hitRate.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(stats.hitCount)} hits / {formatNumber(stats.missCount)} misses
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Database className="w-4 h-4" />
              Active Contexts
            </div>
            <div className="text-2xl font-bold text-white">
              {stats.contextCount}
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(stats.totalTokens)} tokens cached
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Zap className="w-4 h-4" />
              Avg Improvement
            </div>
            <div className="text-2xl font-bold text-green-400">
              ~{stats.avgLatencyImprovement.toFixed(0)}ms
            </div>
            <div className="text-xs text-slate-500">
              Estimated per cached request
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Cpu className="w-4 h-4" />
              Evictions
            </div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(stats.evictionCount)}
            </div>
            <div className="text-xs text-slate-500">
              LRU cleanup count
            </div>
          </div>
        </div>
      )}

      {/* Active Contexts */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-slate-300">
            Active Conversation Contexts
          </h4>
          {activeContexts.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>

        {activeContexts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No active conversation contexts</p>
            <p className="text-xs mt-1">
              Contexts are created automatically when using Ollama with conversation IDs
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeContexts.map((ctx) => (
              <div 
                key={ctx.id}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {ctx.id}
                    </span>
                    <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                      {ctx.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {ctx.useCount} uses
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {ctx.messageCount} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(ctx.ageMs)}
                    </span>
                    <span className="text-slate-500">
                      ~{formatNumber(ctx.estimatedTokens)} tokens
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => clearContext(ctx.id)}
                  className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  title="Clear context"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-700 text-xs text-slate-500">
        <p>
          KV-Cache reduces LLM inference time by caching system prompts and conversation 
          context. Expected improvement: ~20% faster responses for repeated contexts.
        </p>
      </div>
    </div>
  );
};

export default KVCacheMonitor;
