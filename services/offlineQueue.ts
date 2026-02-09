/**
 * Offline Queue Service - JARVIS Kernel v1.5
 * 
 * Prevents data loss during network issues by queueing operations
 * and auto-retrying when connection is restored.
 * 
 * Features:
 * - IndexedDB storage for persistence across sessions
 * - Network state detection with online/offline events
 * - Exponential backoff retry with jitter
 * - Priority queue (HIGH for user-facing, NORMAL for background)
 * - Max retry limit with user notification
 * - Queue status monitoring and UI integration
 */

import { eventBus } from './eventBus';
import { logger } from './logger';

import type { 
  QueuedOperationType, 
  OperationPriority, 
  OperationStatus,
  QueuedOperation, 
  QueueStats, 
  QueueOptions,
  AIRequest,
  AIProvider 
} from '../types';

export type { QueuedOperation, QueueStats, QueueOptions };

const DEFAULT_OPTIONS: Required<QueueOptions> = {
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 300000, // 5 minutes
  retryJitter: true,
  processIntervalMs: 5000,
  maxConcurrent: 2
};

const DB_NAME = 'jarvis_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

class OfflineQueueService {
  private db: IDBDatabase | null = null;
  private options: Required<QueueOptions>;
  private isOnline: boolean = navigator.onLine;
  private isProcessing: boolean = false;
  private processIntervalId: number | null = null;
  private inFlightOperations: Set<string> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(options: QueueOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupNetworkListeners();
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.initialized = true;
      this.startProcessing();
      
      logger.log('QUEUE', 'Offline queue initialized', 'success');
      
      // Process any existing queued operations
      if (this.isOnline) {
        this.triggerProcessing();
      }
    } catch (error) {
      logger.log('QUEUE', `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
        }
      };
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.log('QUEUE', 'Network online - resuming queue processing', 'info');
      this.emitStatusChange();
      this.triggerProcessing();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.log('QUEUE', 'Network offline - queueing operations', 'warning');
      this.emitStatusChange();
    });
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(
    type: QueuedOperationType,
    payload: unknown,
    options: {
      priority?: OperationPriority;
      maxRetries?: number;
      context?: QueuedOperation['context'];
    } = {}
  ): Promise<string> {
    await this.initialize();

    const operation: QueuedOperation = {
      id: this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.options.maxRetries,
      priority: options.priority ?? 'NORMAL',
      status: 'PENDING',
      context: options.context
    };

    await this.saveOperation(operation);
    
    logger.log('QUEUE', `Enqueued ${type} operation (${operation.id})`, 'info');
    
    this.emitStatusChange();
    
    // Try to process immediately if online
    if (this.isOnline && !this.isProcessing) {
      this.triggerProcessing();
    }

    return operation.id;
  }

  /**
   * Cancel a queued operation
   */
  async cancel(operationId: string): Promise<boolean> {
    await this.initialize();

    const operation = await this.getOperation(operationId);
    if (!operation || operation.status === 'PROCESSING') {
      return false;
    }

    operation.status = 'CANCELLED';
    await this.saveOperation(operation);
    
    logger.log('QUEUE', `Cancelled operation ${operationId}`, 'info');
    this.emitStatusChange();
    
    return true;
  }

  /**
   * Get an operation by ID
   */
  async getOperation(id: string): Promise<QueuedOperation | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('PENDING');

      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        // Sort by priority and timestamp
        operations.sort((a, b) => {
          const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return a.timestamp - b.timestamp;
        });
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    if (!this.db) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        failed: 0,
        completed: 0,
        isOnline: this.isOnline,
        isProcessing: this.isProcessing
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        const stats: QueueStats = {
          total: operations.length,
          pending: operations.filter(o => o.status === 'PENDING').length,
          processing: operations.filter(o => o.status === 'PROCESSING').length,
          failed: operations.filter(o => o.status === 'FAILED').length,
          completed: operations.filter(o => o.status === 'COMPLETED').length,
          isOnline: this.isOnline,
          isProcessing: this.isProcessing
        };

        // Estimate completion time based on retry delays
        const pendingOps = operations.filter(o => o.status === 'PENDING' && o.nextRetryAt);
        if (pendingOps.length > 0) {
          const maxRetryTime = Math.max(...pendingOps.map(o => o.nextRetryAt!));
          stats.estimatedCompletionTime = maxRetryTime;
        }

        resolve(stats);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear completed and cancelled operations
   */
  async clearCompleted(): Promise<number> {
    if (!this.db) return 0;

    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        const toDelete = operations.filter(o => 
          o.status === 'COMPLETED' || o.status === 'CANCELLED'
        );
        
        let deleted = 0;
        for (const op of toDelete) {
          store.delete(op.id);
          deleted++;
        }
        
        logger.log('QUEUE', `Cleared ${deleted} completed operations`, 'info');
        resolve(deleted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all operations (use with caution)
   */
  async clearAll(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        logger.log('QUEUE', 'Cleared all operations', 'warning');
        this.emitStatusChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retry a failed operation immediately
   */
  async retryNow(operationId: string): Promise<boolean> {
    const operation = await this.getOperation(operationId);
    if (!operation || operation.status !== 'FAILED') {
      return false;
    }

    operation.status = 'PENDING';
    operation.retryCount = 0;
    operation.error = undefined;
    operation.nextRetryAt = undefined;
    
    await this.saveOperation(operation);
    this.triggerProcessing();
    
    return true;
  }

  private async saveOperation(operation: QueuedOperation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteOperation(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private startProcessing(): void {
    if (this.processIntervalId) return;
    
    this.processIntervalId = window.setInterval(() => {
      if (this.isOnline && !this.isProcessing) {
        this.processQueue();
      }
    }, this.options.processIntervalMs);
  }

  private stopProcessing(): void {
    if (this.processIntervalId) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = null;
    }
  }

  private triggerProcessing(): void {
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.isProcessing) return;
    
    this.isProcessing = true;
    this.emitStatusChange();

    try {
      const pending = await this.getPendingOperations();
      const now = Date.now();
      
      // Filter operations that are ready to retry
      const readyToProcess = pending.filter(op => 
        !op.nextRetryAt || op.nextRetryAt <= now
      );

      // Limit concurrent operations
      const availableSlots = this.options.maxConcurrent - this.inFlightOperations.size;
      const toProcess = readyToProcess.slice(0, availableSlots);

      if (toProcess.length > 0) {
        logger.log('QUEUE', `Processing ${toProcess.length} operations`, 'info');
      }

      await Promise.all(toProcess.map(op => this.processOperation(op)));
    } catch (error) {
      logger.log('QUEUE', `Queue processing error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      this.isProcessing = false;
      this.emitStatusChange();
    }
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    this.inFlightOperations.add(operation.id);
    operation.status = 'PROCESSING';
    operation.lastAttempt = Date.now();
    await this.saveOperation(operation);

    try {
      await this.executeOperation(operation);
      
      // Success - mark as completed
      operation.status = 'COMPLETED';
      await this.saveOperation(operation);
      
      logger.log('QUEUE', `Operation ${operation.id} completed successfully`, 'success');
      
      // Notify success
      eventBus.publish('system.health', {
        type: 'QUEUE_SUCCESS',
        operationId: operation.id,
        operationType: operation.type
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      operation.retryCount++;
      operation.error = errorMessage;
      
      logger.log('QUEUE', `Operation ${operation.id} failed (attempt ${operation.retryCount}): ${errorMessage}`, 'warning');
      
      if (operation.retryCount >= operation.maxRetries) {
        // Max retries reached - mark as failed
        operation.status = 'FAILED';
        await this.saveOperation(operation);
        
        logger.log('QUEUE', `Operation ${operation.id} permanently failed after ${operation.maxRetries} retries`, 'error');
        
        // Notify failure
        eventBus.publish('system.health', {
          type: 'QUEUE_FAILED',
          operationId: operation.id,
          operationType: operation.type,
          error: errorMessage,
          userInput: operation.context?.userInput
        });
      } else {
        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(operation.retryCount);
        operation.nextRetryAt = Date.now() + delay;
        operation.status = 'PENDING';
        await this.saveOperation(operation);
        
        logger.log('QUEUE', `Operation ${operation.id} scheduled for retry in ${delay}ms`, 'info');
      }
    } finally {
      this.inFlightOperations.delete(operation.id);
      this.emitStatusChange();
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    // Check network before executing
    if (!this.isOnline) {
      throw new Error('Network offline');
    }

    switch (operation.type) {
      case 'AI_REQUEST':
        await this.executeAIRequest(operation.payload as AIRequestPayload);
        break;
      
      case 'INTENT_CLASSIFICATION':
        await this.executeIntentClassification(operation.payload as IntentPayload);
        break;
      
      case 'STREAMING_REQUEST':
        await this.executeStreamingRequest(operation.payload as StreamingPayload);
        break;
      
      case 'MEMORY_SYNC':
        await this.executeMemorySync(operation.payload as MemorySyncPayload);
        break;
      
      case 'PLUGIN_NETWORK_CALL':
        await this.executePluginNetworkCall(operation.payload as PluginNetworkPayload);
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async executeAIRequest(payload: AIRequestPayload): Promise<void> {
    const { generateResponse } = await import('./gemini');
    await generateResponse(payload.prompt, payload.options);
  }

  private async executeIntentClassification(payload: IntentPayload): Promise<void> {
    const { analyzeIntent } = await import('./gemini');
    await analyzeIntent(payload.input);
  }

  private async executeStreamingRequest(payload: StreamingPayload): Promise<void> {
    const { streamingHandler } = await import('./streaming');
    await streamingHandler.stream(
      payload.request,
      payload.provider,
      payload.options
    );
  }

  private async executeMemorySync(payload: MemorySyncPayload): Promise<void> {
    // Memory sync is local, should always succeed
    // This is mainly for syncing with remote memory services
    if (payload.remoteUrl) {
      const response = await fetch(payload.remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data)
      });
      
      if (!response.ok) {
        throw new Error(`Memory sync failed: ${response.status}`);
      }
    }
  }

  private async executePluginNetworkCall(payload: PluginNetworkPayload): Promise<void> {
    const response = await fetch(payload.url, {
      method: payload.method || 'GET',
      headers: payload.headers || {},
      body: payload.body ? JSON.stringify(payload.body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`Plugin network call failed: ${response.status}`);
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const baseDelay = this.options.baseRetryDelayMs * Math.pow(2, retryCount - 1);
    const delay = Math.min(baseDelay, this.options.maxRetryDelayMs);
    
    // Add jitter to prevent thundering herd
    if (this.options.retryJitter) {
      const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
      return Math.floor(delay + jitter);
    }
    
    return delay;
  }

  private emitStatusChange(): void {
    this.getStats().then(stats => {
      eventBus.publish('system.health', {
        type: 'QUEUE_STATUS_CHANGED',
        stats
      });
    });
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Destroy the service and cleanup
   */
  destroy(): void {
    this.stopProcessing();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.initialized = false;
    this.initPromise = null;
  }
}

// Payload type definitions
interface AIRequestPayload {
  prompt: string;
  options?: {
    conversationId?: string;
    [key: string]: unknown;
  };
}

interface IntentPayload {
  input: string;
}

interface StreamingPayload {
  request: AIRequest;
  provider: AIProvider;
  options?: {
    enableTTS?: boolean;
    ttsDelayMs?: number;
  };
}

interface MemorySyncPayload {
  data: unknown;
  remoteUrl?: string;
}

interface PluginNetworkPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Export singleton
export const offlineQueue = new OfflineQueueService();

// Convenience exports
export const queueOperation = (
  type: QueuedOperationType,
  payload: unknown,
  options?: Parameters<OfflineQueueService['enqueue']>[2]
) => offlineQueue.enqueue(type, payload, options);

export const getQueueStats = () => offlineQueue.getStats();
export const cancelQueuedOperation = (id: string) => offlineQueue.cancel(id);
export const retryFailedOperation = (id: string) => offlineQueue.retryNow(id);
export const clearQueue = () => offlineQueue.clearAll();
export const isOnline = () => offlineQueue.isNetworkOnline();
