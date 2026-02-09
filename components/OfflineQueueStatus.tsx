/**
 * Offline Queue Status Component
 * 
 * Shows network status and pending queue operations.
 * Appears as a subtle indicator when offline or when items are queued.
 */

import React, { useState, useEffect } from 'react';
import { useOfflineQueue, useQueueNotifications, useNetworkStatus } from '../hooks/useOfflineQueue';
import { Wifi, WifiOff, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface OfflineQueueStatusProps {
  /** Position of the indicator */
  position?: 'top-right' | 'bottom-right' | 'bottom-left';
  /** Whether to show detailed queue panel on click */
  showDetails?: boolean;
}

export const OfflineQueueStatus: React.FC<OfflineQueueStatusProps> = ({
  position = 'bottom-right',
  showDetails = true
}) => {
  const { stats, pendingOperations, cancelOperation, retryOperation, clearCompleted } = useOfflineQueue(3000);
  const notification = useQueueNotifications();
  const isOnline = useNetworkStatus();
  const [showPanel, setShowPanel] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notification && !dismissedNotifications.has(notification.timestamp.toString())) {
      const timer = setTimeout(() => {
        setDismissedNotifications(prev => new Set(prev).add(notification.timestamp.toString()));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, dismissedNotifications]);

  // Don't show if online and no pending items
  if (isOnline && stats.pending === 0 && stats.processing === 0 && stats.failed === 0) {
    return null;
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const hasFailed = stats.failed > 0;
  const hasPending = stats.pending > 0 || stats.processing > 0;

  return (
    <>
      {/* Notification Toast */}
      {notification && !dismissedNotifications.has(notification.timestamp.toString()) && (
        <div className={`fixed ${positionClasses[position]} z-50 mb-16 animate-in slide-in-from-right`}>
          <div className={`rounded-lg shadow-lg p-3 flex items-center gap-2 min-w-[280px] ${
            notification.type === 'success' ? 'bg-green-900/90 border border-green-700' :
            notification.type === 'failed' ? 'bg-red-900/90 border border-red-700' :
            'bg-yellow-900/90 border border-yellow-700'
          }`}>
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {notification.type === 'failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
            {notification.type === 'queued' && <WifiOff className="w-4 h-4 text-yellow-400" />}
            <span className="text-sm text-gray-100 flex-1">{notification.message}</span>
            <button 
              onClick={() => setDismissedNotifications(prev => new Set(prev).add(notification.timestamp.toString()))}
              className="text-gray-400 hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Indicator */}
      <div className={`fixed ${positionClasses[position]} z-40`}>
        <button
          onClick={() => showDetails && setShowPanel(!showPanel)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all ${
            !isOnline 
              ? 'bg-yellow-900/90 border border-yellow-700 hover:bg-yellow-800/90' 
              : hasFailed
                ? 'bg-red-900/90 border border-red-700 hover:bg-red-800/90'
                : 'bg-slate-800/90 border border-slate-700 hover:bg-slate-700/90'
          }`}
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-100">Offline</span>
              {hasPending && (
                <span className="bg-yellow-700 text-yellow-100 text-xs px-1.5 py-0.5 rounded-full">
                  {stats.pending + stats.processing}
                </span>
              )}
            </>
          ) : hasFailed ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-100">{stats.failed} Failed</span>
            </>
          ) : hasPending ? (
            <>
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-sm text-blue-100">Processing...</span>
              <span className="bg-blue-700 text-blue-100 text-xs px-1.5 py-0.5 rounded-full">
                {stats.pending + stats.processing}
              </span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-100">Online</span>
            </>
          )}
        </button>

        {/* Details Panel */}
        {showPanel && showDetails && (
          <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-gray-100">Queue Status</h3>
              <p className="text-xs text-gray-400 mt-1">
                {isOnline 
                  ? 'Connected - processing queued items' 
                  : 'Offline - requests will be queued automatically'}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-700">
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400">{stats.pending}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-400">{stats.processing}</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-400">{stats.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>

            {/* Operations List */}
            <div className="max-h-48 overflow-y-auto">
              {pendingOperations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No pending operations
                </div>
              ) : (
                pendingOperations.map(op => (
                  <div 
                    key={op.id}
                    className="p-3 border-b border-slate-800 last:border-b-0 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-300 truncate">
                        {op.context?.userInput || op.type}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {op.status === 'PENDING' && `Retry in ${formatTime(op.nextRetryAt)}`}
                        {op.status === 'PROCESSING' && 'Processing...'}
                        {op.status === 'FAILED' && `Failed: ${op.error?.substring(0, 30)}...`}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {op.status === 'FAILED' && (
                        <button
                          onClick={() => retryOperation(op.id)}
                          className="p-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
                        >
                          Retry
                        </button>
                      )}
                      {op.status !== 'PROCESSING' && (
                        <button
                          onClick={() => cancelOperation(op.id)}
                          className="p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-gray-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            {stats.failed > 0 && (
              <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                <button
                  onClick={() => {
                    pendingOperations
                      .filter(op => op.status === 'FAILED')
                      .forEach(op => retryOperation(op.id));
                  }}
                  className="w-full py-2 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
                >
                  Retry All Failed
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// Helper function to format time until retry
function formatTime(timestamp?: number): string {
  if (!timestamp) return 'soon';
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'now';
  const seconds = Math.ceil(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}

export default OfflineQueueStatus;
