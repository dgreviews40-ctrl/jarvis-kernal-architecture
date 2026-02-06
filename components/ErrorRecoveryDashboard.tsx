/**
 * Error Recovery Dashboard
 * 
 * Displays system health, error statistics, and recovery options.
 * Allows administrators to monitor and manage system errors.
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, CheckCircle, RefreshCw, 
  Trash2, Download, Shield, Zap, Clock
} from 'lucide-react';
import { getErrorStats, clearErrorTracking, resetDegradation } from '../services/errorHandler';
import { logger } from '../services/logger';
import { notifications } from './NotificationSystem';

interface ErrorStats {
  totalErrors: number;
  errorsByOperation: Record<string, number>;
  degradedFeatures: string[];
}

export const ErrorRecoveryDashboard: React.FC = () => {
  const [stats, setStats] = useState<ErrorStats>({
    totalErrors: 0,
    errorsByOperation: {},
    degradedFeatures: []
  });
  const [logs, setLogs] = useState<Array<{
    timestamp: Date;
    source: string;
    message: string;
    type: string;
  }>>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const refreshData = () => {
    setStats(getErrorStats());
    
    // Get recent error logs
    const recentLogs = logger.getRecent(50).filter(log => {
      const sourceStr = typeof log.source === 'string' ? log.source : 
                       typeof log.source === 'object' && log.source !== null ? 
                       (log.source as any).source || 'UNKNOWN' : 'UNKNOWN';
      return log.type === 'error' || 
      sourceStr.includes('ERROR') ||
      log.message.toLowerCase().includes('error');
    });
    setLogs(recentLogs);
  };
  
  const handleClearErrors = () => {
    if (confirm('Clear all error tracking data?')) {
      clearErrorTracking();
      refreshData();
      notifications.success('Errors Cleared', 'Error tracking data has been reset');
    }
  };
  
  const handleResetDegradation = (feature: string) => {
    resetDegradation(feature);
    refreshData();
    notifications.success('Feature Restored', `${feature} has been restored to normal operation`);
  };
  
  const handleExportDiagnostics = () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      errorStats: stats,
      recentLogs: logs.slice(0, 20),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    notifications.success('Exported', 'Diagnostics file downloaded');
  };
  
  const handleTestError = () => {
    notifications.error('Test Error', 'This is a test error notification', {
      actions: [
        {
          label: 'Retry',
          onClick: () => notifications.success('Success', 'Retry succeeded!'),
          variant: 'primary'
        },
        {
          label: 'Dismiss',
          onClick: () => {}
        }
      ]
    });
  };
  
  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#333]">
        <div className="flex items-center gap-3">
          <Shield className="text-cyan-500" size={20} />
          <h2 className="text-lg font-bold text-white">ERROR RECOVERY</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsRefreshing(true); refreshData(); setTimeout(() => setIsRefreshing(false), 500); }}
            className={`p-2 text-gray-400 hover:text-cyan-400 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleExportDiagnostics}
            className="px-3 py-1.5 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-cyan-400 text-xs flex items-center gap-2"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-xs text-gray-500 uppercase">Total Errors</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalErrors}</div>
          </div>
          
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-500 uppercase">Error Sources</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {Object.keys(stats.errorsByOperation).length}
            </div>
          </div>
          
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-cyan-400" />
              <span className="text-xs text-gray-500 uppercase">Degraded</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {stats.degradedFeatures.length}
            </div>
          </div>
        </div>
        
        {/* Degraded Features */}
        {stats.degradedFeatures.length > 0 && (
          <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-4">
            <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Degraded Features
            </h3>
            <div className="space-y-2">
              {stats.degradedFeatures.map(feature => (
                <div key={feature} className="flex items-center justify-between bg-black/30 rounded p-2">
                  <span className="text-sm text-gray-300">{feature}</span>
                  <button
                    onClick={() => handleResetDegradation(feature)}
                    className="px-2 py-1 text-xs bg-yellow-600/30 text-yellow-400 rounded hover:bg-yellow-600/50"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Error by Operation */}
        {Object.keys(stats.errorsByOperation).length > 0 && (
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-3">Errors by Source</h3>
            <div className="space-y-2">
              {Object.entries(stats.errorsByOperation)
                .sort((a, b) => b[1] - a[1])
                .map(([operation, count]) => (
                  <div key={operation} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-mono">{operation}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#222] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${Math.min(100, (count / stats.totalErrors) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {/* Recent Error Logs */}
        <div className="bg-[#111] border border-[#333] rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">Recent Errors</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No recent errors</p>
            ) : (
              logs.map((log, idx) => {
                  const sourceStr = typeof log.source === 'string' ? log.source : 
                                   typeof log.source === 'object' && log.source !== null ? 
                                   (log.source as any).source || 'UNKNOWN' : 'UNKNOWN';
                  return (
                <div key={idx} className="text-xs font-mono p-2 bg-black/30 rounded">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock size={10} />
                    {log.timestamp.toLocaleTimeString()}
                    <span className="text-red-400">[{sourceStr}]</span>
                  </div>
                  <div className="text-gray-300 mt-1">{log.message}</div>
                </div>
              );})
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClearErrors}
            className="flex-1 px-4 py-2 bg-red-900/30 border border-red-500/50 rounded text-red-400 hover:bg-red-900/50 text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={14} />
            Clear Error Data
          </button>
          <button
            onClick={handleTestError}
            className="flex-1 px-4 py-2 bg-[#111] border border-[#333] rounded text-gray-400 hover:text-cyan-400 text-sm"
          >
            Test Notification
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorRecoveryDashboard;
