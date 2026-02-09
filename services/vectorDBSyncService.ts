/**
 * Vector DB Sync Service - Batched Synchronization
 * 
 * Solves the N+1 sync problem by:
 * - Queuing memory operations instead of immediate sync
 * - Debounced batch processing (default: 2s)
 * - Dirty-flag tracking for incremental updates
 * - Priority queue for urgent operations (identity, etc.)
 * - Background sync with error retry
 */

import { MemoryNode } from '../types';
import { vectorDB } from './vectorDB';
import { logger } from './logger';
import { classifyError } from './errorTypes';

interface SyncJob {
  node: MemoryNode;
  operation: 'store' | 'delete';
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  retryCount: number;
}

interface SyncStats {
  pendingCount: number;
  lastSyncTime: number;
  totalSynced: number;
  totalFailed: number;
  isSyncing: boolean;
  averageBatchSize: number;
}

interface SyncConfig {
  debounceMs: number;
  maxBatchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
  enableBackgroundSync: boolean;
}

const DEFAULT_CONFIG: SyncConfig = {
  debounceMs: 2000,        // 2 second debounce for batching
  maxBatchSize: 50,        // Process max 50 at a time
  retryAttempts: 3,        // Retry failed operations 3 times
  retryDelayMs: 5000,      // 5 second delay between retries
  enableBackgroundSync: true,
};

class VectorDBSyncService {
  private static instance: VectorDBSyncService;
  
  // Job queue
  private queue: Map<string, SyncJob> = new Map();
  private dirtyNodes: Set<string> = new Set();
  private config: SyncConfig = DEFAULT_CONFIG;
  
  // Sync state
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private lastSyncTime = 0;
  private stats = {
    totalSynced: 0,
    totalFailed: 0,
    batchSizes: [] as number[],
  };
  
  // Error tracking for circuit breaker pattern
  private consecutiveErrors = 0;
  private lastErrorTime = 0;
  private circuitOpen = false;
  private readonly CIRCUIT_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_MS = 60000; // 1 minute

  private constructor() {}

  public static getInstance(): VectorDBSyncService {
    if (!VectorDBSyncService.instance) {
      VectorDBSyncService.instance = new VectorDBSyncService();
    }
    return VectorDBSyncService.instance;
  }

  /**
   * Configure sync behavior
   */
  public configure(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log('VECTOR_DB', `Config updated: ${JSON.stringify(this.config)}`, 'info');
  }

  /**
   * Queue a node for storage (debounced)
   */
  public queueStore(node: MemoryNode, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const existing = this.queue.get(node.id);
    
    this.queue.set(node.id, {
      node,
      operation: 'store',
      priority,
      timestamp: Date.now(),
      retryCount: existing ? existing.retryCount : 0,
    });
    
    this.dirtyNodes.add(node.id);
    this.scheduleSync();
  }

  /**
   * Queue multiple nodes for storage
   */
  public queueBatchStore(nodes: MemoryNode[], priority: 'high' | 'normal' | 'low' = 'normal'): void {
    for (const node of nodes) {
      this.queueStore(node, priority);
    }
  }

  /**
   * Queue a node for deletion
   */
  public queueDelete(nodeId: string): void {
    // If node is pending store, just remove it from queue
    if (this.queue.has(nodeId)) {
      const job = this.queue.get(nodeId)!;
      if (job.operation === 'store') {
        this.queue.delete(nodeId);
        this.dirtyNodes.delete(nodeId);
        return;
      }
    }
    
    this.queue.set(nodeId, {
      node: { id: nodeId } as MemoryNode,
      operation: 'delete',
      priority: 'normal',
      timestamp: Date.now(),
      retryCount: 0,
    });
    
    this.scheduleSync();
  }

  /**
   * Force immediate sync (for urgent operations)
   */
  public async syncNow(): Promise<{ success: number; failed: number }> {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    return this.processQueue();
  }

  /**
   * Check if a node has pending changes
   */
  public isDirty(nodeId: string): boolean {
    return this.dirtyNodes.has(nodeId);
  }

  /**
   * Get pending node count
   */
  public getPendingCount(): number {
    return this.queue.size;
  }

  /**
   * Get sync statistics
   */
  public getStats(): SyncStats {
    const avgBatchSize = this.stats.batchSizes.length > 0
      ? Math.round(this.stats.batchSizes.reduce((a, b) => a + b, 0) / this.stats.batchSizes.length)
      : 0;
    
    return {
      pendingCount: this.queue.size,
      lastSyncTime: this.lastSyncTime,
      totalSynced: this.stats.totalSynced,
      totalFailed: this.stats.totalFailed,
      isSyncing: this.isProcessing,
      averageBatchSize: avgBatchSize,
    };
  }

  /**
   * Clear all pending jobs
   */
  public clearQueue(): void {
    this.queue.clear();
    this.dirtyNodes.clear();
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    logger.log('VECTOR_DB', 'Queue cleared', 'info');
  }

  /**
   * Pause/resume sync
   */
  private paused = false;
  
  public pause(): void {
    this.paused = true;
    logger.log('VECTOR_DB', 'Sync paused', 'info');
  }
  
  public resume(): void {
    this.paused = false;
    this.scheduleSync();
    logger.log('VECTOR_DB', 'Sync resumed', 'info');
  }

  // ==================== PRIVATE METHODS ====================

  private scheduleSync(): void {
    if (this.paused || this.isProcessing) return;
    if (this.syncTimeout) return; // Already scheduled
    
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      this.processQueue();
    }, this.config.debounceMs);
  }

  private async processQueue(): Promise<{ success: number; failed: number }> {
    if (this.isProcessing || this.queue.size === 0) {
      return { success: 0, failed: 0 };
    }

    // Check circuit breaker
    if (this.circuitOpen) {
      if (Date.now() - this.lastErrorTime > this.CIRCUIT_RESET_MS) {
        this.circuitOpen = false;
        this.consecutiveErrors = 0;
        logger.log('VECTOR_DB', 'Circuit breaker reset', 'info');
      } else {
        logger.log('VECTOR_DB', 'Circuit breaker open, skipping sync', 'warning');
        return { success: 0, failed: 0 };
      }
    }

    this.isProcessing = true;
    
    // Extract batch from queue
    const jobs = Array.from(this.queue.values())
      .sort((a, b) => {
        // Priority order: high > normal > low
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, this.config.maxBatchSize);

    // Remove from queue
    for (const job of jobs) {
      this.queue.delete(job.node.id);
    }

    logger.log('VECTOR_DB', `Processing batch of ${jobs.length} jobs`, 'info');

    let success = 0;
    let failed = 0;

    try {
      // Ensure Vector DB is initialized
      if (!vectorDB.initialized) {
        await vectorDB.initialize();
      }

      // Separate stores and deletes
      const storeJobs = jobs.filter(j => j.operation === 'store');
      const deleteJobs = jobs.filter(j => j.operation === 'delete');

      // Batch store using vectorDB's storeBatch
      if (storeJobs.length > 0) {
        const nodes = storeJobs.map(j => j.node);
        const result = await vectorDB.storeBatch(nodes);
        success += result.success;
        failed += result.failed;
        
        // Retry failed stores individually
        if (result.failed > 0) {
          await this.retryFailedStores(storeJobs);
        }
      }

      // Process deletes
      for (const job of deleteJobs) {
        try {
          await vectorDB.delete(job.node.id);
          success++;
        } catch (error) {
          failed++;
          this.handleError(job, error);
        }
      }

      // Clear dirty flags for successful operations
      for (const job of jobs) {
        this.dirtyNodes.delete(job.node.id);
      }

      // Update stats
      this.stats.totalSynced += success;
      this.stats.totalFailed += failed;
      this.stats.batchSizes.push(jobs.length);
      if (this.stats.batchSizes.length > 100) {
        this.stats.batchSizes.shift();
      }

      // Reset error counter on success
      if (failed === 0) {
        this.consecutiveErrors = 0;
      }

      this.lastSyncTime = Date.now();
      
      logger.log('VECTOR_DB', `Batch complete: ${success} success, ${failed} failed`, 
        failed > 0 ? 'warning' : 'success');

    } catch (error) {
      // Put jobs back in queue for retry
      for (const job of jobs) {
        if (job.retryCount < this.config.retryAttempts) {
          job.retryCount++;
          this.queue.set(job.node.id, job);
        } else {
          this.stats.totalFailed++;
          this.dirtyNodes.delete(job.node.id);
        }
      }
      
      this.handleCircuitBreaker(error);
      logger.log('VECTOR_DB', `Batch failed: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
    } finally {
      this.isProcessing = false;
      
      // Schedule next sync if more jobs pending
      if (this.queue.size > 0 && !this.paused) {
        this.scheduleSync();
      }
    }

    return { success, failed };
  }

  private async retryFailedStores(failedJobs: SyncJob[]): Promise<void> {
    for (const job of failedJobs) {
      try {
        await vectorDB.store(job.node);
        // Success - clear dirty flag
        this.dirtyNodes.delete(job.node.id);
        this.stats.totalSynced++;
      } catch (error) {
        if (job.retryCount < this.config.retryAttempts) {
          job.retryCount++;
          this.queue.set(job.node.id, job);
        } else {
          this.stats.totalFailed++;
          this.dirtyNodes.delete(job.node.id);
          logger.log('VECTOR_DB', `Failed to store ${job.node.id} after retries`, 'error');
        }
      }
    }
  }

  private handleError(job: SyncJob, error: unknown): void {
    const typedError = error instanceof Error ? error : new Error(String(error));
    const jarvisError = classifyError(typedError, { operation: 'vector_sync' });
    
    // Don't retry auth/validation errors
    if (!jarvisError.isRetryable) {
      this.dirtyNodes.delete(job.node.id);
      return;
    }
    
    // Re-queue for retry if under limit
    if (job.retryCount < this.config.retryAttempts) {
      job.retryCount++;
      this.queue.set(job.node.id, job);
    }
  }

  private handleCircuitBreaker(error: unknown): void {
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    
    if (this.consecutiveErrors >= this.CIRCUIT_THRESHOLD) {
      this.circuitOpen = true;
      logger.log('VECTOR_DB', `Circuit breaker opened after ${this.consecutiveErrors} errors`, 'error');
    }
  }
}

// Export singleton
export const vectorDBSync = VectorDBSyncService.getInstance();

// Re-export types
export type { SyncStats, SyncConfig };
