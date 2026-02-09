/**
 * Performance Dashboard
 * 
 * UI for viewing performance metrics and reports
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  HardDrive, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Download,
  Trash2,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { performanceMonitor, useRenderTime } from '../services/performanceMonitor';
import { logger } from '../services/logger';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  alert?: 'none' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend, alert }) => {
  const alertColors = {
    none: 'border-gray-700',
    warning: 'border-yellow-600',
    critical: 'border-red-600',
  };

  return (
    <div className={`bg-gray-900 border ${alertColors[alert || 'none']} rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="text-gray-500">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={14} className="text-red-400" />}
          {trend === 'down' && <TrendingDown size={14} className="text-green-400" />}
          {trend === 'neutral' && <Minus size={14} className="text-gray-400" />}
          <span className={`text-xs ${
            trend === 'up' ? 'text-red-400' : 
            trend === 'down' ? 'text-green-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? 'Increased' : trend === 'down' ? 'Improved' : 'Stable'}
          </span>
        </div>
      )}
    </div>
  );
};

export const PerformanceDashboard: React.FC = () => {
  useRenderTime('PerformanceDashboard');
  
  const [stats, setStats] = useState(performanceMonitor.getStats());
  const [comparison, setComparison] = useState(performanceMonitor.compareToBaseline());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Refresh stats
  const refreshStats = useCallback(() => {
    setStats(performanceMonitor.getStats());
    setComparison(performanceMonitor.compareToBaseline());
    setLastUpdate(Date.now());
  }, []);

  // Initialize
  useEffect(() => {
    performanceMonitor.init();
    setIsMonitoring(true);
    
    // Refresh every 5 seconds
    const interval = setInterval(refreshStats, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [refreshStats]);

  // Set baseline
  const handleSetBaseline = () => {
    performanceMonitor.setBaseline();
    refreshStats();
    logger.log('SYSTEM', 'Performance baseline set from dashboard', 'info');
  };

  // Export data
  const handleExport = () => {
    const data = performanceMonitor.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export report
  const handleExportReport = () => {
    const report = performanceMonitor.generateReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-performance-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear data
  const handleClear = () => {
    if (confirm('Clear all performance data?')) {
      performanceMonitor.clearData();
      refreshStats();
    }
  };

  // Get latest memory
  const latestMemory = stats.memorySnapshots[stats.memorySnapshots.length - 1];
  const memoryTrend = stats.memorySnapshots.length > 1
    ? stats.memorySnapshots[stats.memorySnapshots.length - 1].used > 
      stats.memorySnapshots[stats.memorySnapshots.length - 2].used ? 'up' : 'down'
    : 'neutral';

  // Get memory alert level
  const getMemoryAlert = () => {
    if (!latestMemory) return 'none';
    if (latestMemory.used > 200) return 'critical';
    if (latestMemory.used > 100) return 'warning';
    return 'none';
  };

  // Get total bundle size
  const totalBundleSize = stats.bundleSizes.reduce((sum, b) => sum + b.gzipSize, 0);

  return (
    <div className="h-full flex flex-col bg-black text-gray-300 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400" size={24} />
          <h2 className="text-xl font-bold text-white">Performance Monitor</h2>
          {isMonitoring && (
            <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStats}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleSetBaseline}
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Target size={16} />
            Set Baseline
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            onClick={handleExportReport}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
          >
            Export Report
          </button>
          <button
            onClick={handleClear}
            className="p-2 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
            title="Clear Data"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Memory Usage"
          value={latestMemory ? `${latestMemory.used} MB` : 'N/A'}
          subtitle={latestMemory ? `of ${latestMemory.limit} MB limit` : undefined}
          icon={<HardDrive size={20} />}
          trend={memoryTrend}
          alert={getMemoryAlert()}
        />
        <MetricCard
          title="Avg Memory"
          value={`${stats.averages.memory.toFixed(1)} MB`}
          subtitle={`${stats.memorySnapshots.length} samples`}
          icon={<Activity size={20} />}
        />
        <MetricCard
          title="Bundle Size"
          value={totalBundleSize > 0 ? `${(totalBundleSize / 1024).toFixed(1)} KB` : 'N/A'}
          subtitle={`${stats.bundleSizes.length} chunks`}
          icon={<HardDrive size={20} />}
          alert={totalBundleSize > 1024 * 1024 ? 'critical' : totalBundleSize > 500 * 1024 ? 'warning' : 'none'}
        />
        <MetricCard
          title="Page Load Time"
          value={stats.timings.find(t => t.operation === 'page_load')?.duration.toFixed(0) + 'ms' || 'N/A'}
          icon={<Clock size={20} />}
        />
      </div>

      {/* Baseline Comparison */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Target size={18} className="text-cyan-400" />
          Baseline Comparison
        </h3>
        
        {comparison.regressions.length === 0 && comparison.improvements.length === 0 && comparison.unchanged.length === 0 ? (
          <p className="text-gray-500 text-sm">No baseline set. Click "Set Baseline" to start tracking performance changes.</p>
        ) : (
          <div className="space-y-3">
            {comparison.regressions.length > 0 && (
              <div>
                <h4 className="text-red-400 text-sm font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  Regressions
                </h4>
                <ul className="space-y-1">
                  {comparison.regressions.map((r, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                      <TrendingUp size={12} className="text-red-400" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {comparison.improvements.length > 0 && (
              <div>
                <h4 className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                  <CheckCircle size={14} />
                  Improvements
                </h4>
                <ul className="space-y-1">
                  {comparison.improvements.map((imp, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                      <TrendingDown size={12} className="text-green-400" />
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {comparison.unchanged.length > 0 && (
              <div>
                <h4 className="text-gray-400 text-sm font-medium mb-2 flex items-center gap-1">
                  <Minus size={14} />
                  Unchanged
                </h4>
                <ul className="space-y-1">
                  {comparison.unchanged.map((u, i) => (
                    <li key={i} className="text-sm text-gray-500">{u}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operation Timings */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Clock size={18} className="text-cyan-400" />
          Operation Timings
        </h3>
        
        {Object.keys(stats.averages.timing).length === 0 ? (
          <p className="text-gray-500 text-sm">No timing data recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(stats.averages.timing).map(([op, avg]) => {
              const recent = stats.timings
                .filter(t => t.operation === op)
                .slice(-5);
              
              return (
                <div key={op} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300">{op}</span>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {recent.map((t, i) => (
                        <div
                          key={i}
                          className={`w-2 h-4 rounded-sm ${
                            t.duration > 500 ? 'bg-red-500' :
                            t.duration > 100 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          title={`${t.duration.toFixed(1)}ms`}
                        />
                      ))}
                    </div>
                    <span className={`text-sm font-mono ${
                      avg > 500 ? 'text-red-400' :
                      avg > 100 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {avg.toFixed(1)}ms
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bundle Sizes */}
      {stats.bundleSizes.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <HardDrive size={18} className="text-cyan-400" />
            Bundle Sizes
          </h3>
          
          <div className="space-y-2">
            {stats.bundleSizes.map((bundle, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-300 font-mono">{bundle.chunkName}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        bundle.gzipSize > 1024 * 1024 ? 'bg-red-500' :
                        bundle.gzipSize > 500 * 1024 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((bundle.gzipSize / (1024 * 1024)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-mono ${
                    bundle.gzipSize > 1024 * 1024 ? 'text-red-400' :
                    bundle.gzipSize > 500 * 1024 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {(bundle.gzipSize / 1024).toFixed(1)}KB
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-600 text-xs mt-auto">
        Last updated: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceDashboard;
