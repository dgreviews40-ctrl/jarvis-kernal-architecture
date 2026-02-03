/**
 * Performance Monitor Component
 * Displays real-time performance metrics and optimization status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Zap, Database, Cpu, Clock, TrendingUp } from 'lucide-react';
import { optimizer } from '../services/performance';

interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    nodes: number;
    indexSize: number;
  };
  cache: {
    entries: number;
    hitRate: number;
  };
  timing: Record<string, { avg: number; min: number; max: number; count: number }>;
}

export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memory: { used: 0, total: 0, nodes: 0, indexSize: 0 },
    cache: { entries: 0, hitRate: 0 },
    timing: {}
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const updateMetrics = useCallback(() => {
    const stats = optimizer.getStats();
    
    // Get memory info if available
    const memoryInfo = (performance as any).memory;
    
    setMetrics({
      memory: {
        used: memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 0,
        total: memoryInfo ? Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) : 0,
        nodes: 0, // Would need to get from memory service
        indexSize: 0
      },
      cache: {
        entries: 0, // Would need to track cache hits
        hitRate: 0
      },
      timing: stats
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [updateMetrics]);

  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Mini view */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-black/80 border border-cyan-900/50 rounded-lg hover:bg-cyan-950/30 transition-colors"
      >
        <Activity size={16} className="text-green-500" />
        <span className="text-xs text-cyan-400 font-mono">
          {metrics.memory.used}MB
        </span>
        <span className="text-[10px] text-cyan-700">
          {isExpanded ? '▼' : '▲'}
        </span>
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-black/95 border border-cyan-900/50 rounded-lg p-4 shadow-2xl">
          <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
            <Zap size={14} />
            Performance Metrics
          </h3>

          {/* Memory Usage */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={12} className="text-cyan-600" />
              <span className="text-xs text-cyan-700 uppercase">Memory</span>
            </div>
            <div className="bg-cyan-950/30 rounded p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-cyan-600">Heap Used</span>
                <span className="text-cyan-400">{metrics.memory.used} MB</span>
              </div>
              <div className="w-full bg-cyan-900/30 rounded-full h-1.5">
                <div 
                  className="bg-cyan-500 h-1.5 rounded-full transition-all"
                  style={{ 
                    width: `${metrics.memory.total > 0 ? (metrics.memory.used / metrics.memory.total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cache Stats */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={12} className="text-cyan-600" />
              <span className="text-xs text-cyan-700 uppercase">Cache</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-cyan-950/30 rounded p-2 text-center">
                <div className="text-lg font-bold text-cyan-400">{metrics.cache.entries}</div>
                <div className="text-[10px] text-cyan-600">Entries</div>
              </div>
              <div className="bg-cyan-950/30 rounded p-2 text-center">
                <div className="text-lg font-bold text-green-400">
                  {metrics.cache.hitRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-cyan-600">Hit Rate</div>
              </div>
            </div>
          </div>

          {/* Timing Stats */}
          {Object.keys(metrics.timing).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={12} className="text-cyan-600" />
                <span className="text-xs text-cyan-700 uppercase">Timing</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(metrics.timing).map(([name, stats]) => (
                  <div key={name} className="bg-cyan-950/30 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-cyan-600 uppercase">{name}</span>
                      <span className="text-[10px] text-cyan-500">{stats.count} calls</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-cyan-400">{formatDuration(stats.avg)}</span>
                      <span className="text-cyan-700">
                        min: {formatDuration(stats.min)} / max: {formatDuration(stats.max)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 pt-3 border-t border-cyan-900/30 flex gap-2">
            <button
              onClick={() => optimizer.clear()}
              className="flex-1 px-2 py-1 text-[10px] bg-cyan-950/50 text-cyan-400 rounded hover:bg-cyan-900/50 transition-colors"
            >
              Clear Caches
            </button>
            <button
              onClick={() => optimizer.clearMetrics()}
              className="flex-1 px-2 py-1 text-[10px] bg-cyan-950/50 text-cyan-400 rounded hover:bg-cyan-900/50 transition-colors"
            >
              Reset Metrics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
