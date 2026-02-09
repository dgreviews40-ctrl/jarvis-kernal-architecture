/**
 * Offline Queue React Hook
 * 
 * Provides easy access to queue status and operations in React components.
 * Use this to show connection status, pending operations, and retry controls.
 * 
 * @example
 * ```tsx
 * function QueueStatus() {
 *   const { isOnline, stats, pendingOperations } = useOfflineQueue();
 *   
 *   if (!isOnline) {
 *     return <Badge color="warning">Offline - {stats.pending} queued</Badge>;
 *   }
 *   
 *   return null;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue } from '../services/offlineQueue';
import type { QueuedOperation, QueueStats } from '../types';
import { eventBus } from '../services/eventBus';

export interface UseOfflineQueueReturn {
  /** Whether the network is currently online */
  isOnline: boolean;
  /** Current queue statistics */
  stats: QueueStats;
  /** List of pending operations */
  pendingOperations: QueuedOperation[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Cancel a queued operation */
  cancelOperation: (operationId: string) => Promise<boolean>;
  /** Retry a failed operation immediately */
  retryOperation: (operationId: string) => Promise<boolean>;
  /** Clear all completed/cancelled operations */
  clearCompleted: () => Promise<number>;
  /** Refresh the queue data */
  refresh: () => Promise<void>;
  /** Estimated time until all operations complete */
  estimatedCompletionTime?: Date;
}

export function useOfflineQueue(pollIntervalMs = 5000): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    completed: 0,
    isOnline: navigator.onLine,
    isProcessing: false
  });
  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollTimeoutRef = useRef<number | null>(null);

  // Initialize and load data
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      await offlineQueue.initialize();
      
      const [newStats, operations] = await Promise.all([
        offlineQueue.getStats(),
        offlineQueue.getPendingOperations()
      ]);
      
      setStats(newStats);
      setPendingOperations(operations);
      setIsOnline(newStats.isOnline);
    } catch (error) {
      console.error('[useOfflineQueue] Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel an operation
  const cancelOperation = useCallback(async (operationId: string): Promise<boolean> => {
    const result = await offlineQueue.cancel(operationId);
    if (result) {
      await refresh();
    }
    return result;
  }, [refresh]);

  // Retry a failed operation
  const retryOperation = useCallback(async (operationId: string): Promise<boolean> => {
    const result = await offlineQueue.retryNow(operationId);
    if (result) {
      await refresh();
    }
    return result;
  }, [refresh]);

  // Clear completed operations
  const clearCompleted = useCallback(async (): Promise<number> => {
    const count = await offlineQueue.clearCompleted();
    await refresh();
    return count;
  }, [refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for queue status changes
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('system.health', (event) => {
      const payload = event.payload as { type?: string; stats?: QueueStats } | undefined;
      if (payload?.type === 'QUEUE_STATUS_CHANGED') {
        if (payload.stats) {
          setStats(payload.stats);
          setIsOnline(payload.stats.isOnline);
        }
        // Refresh pending operations list
        offlineQueue.getPendingOperations().then(setPendingOperations);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Poll for updates
  useEffect(() => {
    if (pollIntervalMs <= 0) return;

    const poll = () => {
      refresh();
      pollTimeoutRef.current = window.setTimeout(poll, pollIntervalMs);
    };

    pollTimeoutRef.current = window.setTimeout(poll, pollIntervalMs);

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [pollIntervalMs, refresh]);

  // Calculate estimated completion time
  const estimatedCompletionTime = stats.estimatedCompletionTime 
    ? new Date(stats.estimatedCompletionTime)
    : undefined;

  return {
    isOnline,
    stats,
    pendingOperations,
    isLoading,
    cancelOperation,
    retryOperation,
    clearCompleted,
    refresh,
    estimatedCompletionTime
  };
}

/**
 * Hook to track a specific queued operation
 */
export function useQueuedOperation(operationId: string | null) {
  const [operation, setOperation] = useState<QueuedOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!operationId) {
      setOperation(null);
      return;
    }

    setIsLoading(true);
    try {
      const op = await offlineQueue.getOperation(operationId);
      setOperation(op);
    } catch (error) {
      console.error('[useQueuedOperation] Failed to fetch:', error);
    } finally {
      setIsLoading(false);
    }
  }, [operationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for status changes
  useEffect(() => {
    if (!operationId) return;

    const unsubscribe = eventBus.subscribe('system.health', (event) => {
      const payload = event.payload as { type?: string } | undefined;
      if (payload?.type === 'QUEUE_STATUS_CHANGED') {
        refresh();
      }
    });

    return () => unsubscribe();
  }, [operationId, refresh]);

  return {
    operation,
    isLoading,
    refresh,
    isPending: operation?.status === 'PENDING',
    isProcessing: operation?.status === 'PROCESSING',
    isFailed: operation?.status === 'FAILED',
    isCompleted: operation?.status === 'COMPLETED'
  };
}

/**
 * Hook to listen for completed queued operations
 */
export function useQueueNotifications() {
  const [lastNotification, setLastNotification] = useState<{
    type: 'success' | 'failed' | 'queued';
    operationId: string;
    message: string;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('system.health', (event) => {
      const payload = event.payload as { 
        type?: string;
        operationId?: string; 
        message?: string;
        error?: string;
        userInput?: string;
      } | undefined;
      if (!payload) return;
      
      const timestamp = Date.now();
      
      switch (payload.type) {
        case 'QUEUE_QUEUED':
          setLastNotification({
            type: 'queued',
            operationId: payload.operationId || 'unknown',
            message: payload.message || 'Request queued',
            timestamp
          });
          break;
          
        case 'QUEUE_SUCCESS':
          setLastNotification({
            type: 'success',
            operationId: payload.operationId || 'unknown',
            message: payload.userInput 
              ? `Completed: "${payload.userInput.substring(0, 50)}${payload.userInput.length > 50 ? '...' : ''}"`
              : 'Queued request completed successfully',
            timestamp
          });
          break;
          
        case 'QUEUE_FAILED':
          setLastNotification({
            type: 'failed',
            operationId: payload.operationId || 'unknown',
            message: payload.error || 'Request failed after multiple retries',
            timestamp
          });
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  return lastNotification;
}

/**
 * Hook for network status only (lighter weight)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
