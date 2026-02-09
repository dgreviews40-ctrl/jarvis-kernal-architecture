/**
 * Event Sourcing Service for Memory Mutations
 * 
 * Provides:
 * - Append-only event log for all memory mutations
 * - Event types: MemoryCreated, MemoryUpdated, MemoryDeleted, MemoryRestored
 * - Replay capability to rebuild memory state
 * - Event pruning for old data
 * - Correlation tracking for debugging
 */

import { MemoryNode, MemoryType } from "../types";
import { logger } from "./logger";

// ==================== EVENT TYPES ====================

export type MemoryEventType = 
  | 'MEMORY_CREATED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_RESTORED'
  | 'MEMORY_BATCH_IMPORTED'
  | 'MEMORY_COMPACTED';

export interface BaseMemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: number;
  correlationId: string;  // Links related events (e.g., batch operations)
  source: 'USER' | 'SYSTEM' | 'MIGRATION' | 'PLUGIN' | 'COMPACTION';
}

export interface MemoryCreatedEvent extends BaseMemoryEvent {
  type: 'MEMORY_CREATED';
  nodeId: string;
  content: string;
  memoryType: MemoryType;
  tags: string[];
}

export interface MemoryUpdatedEvent extends BaseMemoryEvent {
  type: 'MEMORY_UPDATED';
  nodeId: string;
  changes: Partial<Pick<MemoryNode, 'content' | 'tags' | 'lastAccessed'>>;
  previousValues: Partial<Pick<MemoryNode, 'content' | 'tags' | 'lastAccessed'>>;
}

export interface MemoryDeletedEvent extends BaseMemoryEvent {
  type: 'MEMORY_DELETED';
  nodeId: string;
  nodeSnapshot?: MemoryNode;  // Full snapshot for potential undo (optional if snapshots disabled)
}

export interface MemoryRestoredEvent extends BaseMemoryEvent {
  type: 'MEMORY_RESTORED';
  nodeId: string;
  fromBackup: boolean;
  restoredFromSnapshot?: MemoryNode;
}

export interface MemoryBatchImportedEvent extends BaseMemoryEvent {
  type: 'MEMORY_BATCH_IMPORTED';
  count: number;
  nodeIds: string[];
  importSource: string;
}

export interface MemoryCompactedEvent extends BaseMemoryEvent {
  type: 'MEMORY_COMPACTED';
  eventsBeforeCount: number;
  eventsAfterCount: number;
  compactedAt: number;
}

export type MemoryEvent = 
  | MemoryCreatedEvent
  | MemoryUpdatedEvent
  | MemoryDeletedEvent
  | MemoryRestoredEvent
  | MemoryBatchImportedEvent
  | MemoryCompactedEvent;

// ==================== REPLAY RESULT ====================

export interface ReplayResult {
  success: boolean;
  nodes: Map<string, MemoryNode>;
  eventCount: number;
  errors: Array<{ eventId: string; error: string }>;
  appliedEvents: MemoryEvent[];
}

// ==================== EVENT STATS ====================

export interface EventSourcingStats {
  totalEvents: number;
  eventsByType: Record<MemoryEventType, number>;
  eventsBySource: Record<string, number>;
  oldestEvent: number | null;
  newestEvent: number | null;
  averageEventsPerDay: number;
  storageSizeBytes: number;
}

// ==================== EVENT STORE CONFIG ====================

export interface EventStoreConfig {
  maxEvents: number;           // Maximum events before forcing compaction
  maxAgeDays: number;          // Maximum age of events before pruning
  compactThreshold: number;    // Trigger compaction at this count
  enableSnapshots: boolean;    // Store full node snapshots on delete
}

const DEFAULT_CONFIG: EventStoreConfig = {
  maxEvents: 10000,
  maxAgeDays: 90,
  compactThreshold: 8000,
  enableSnapshots: true
};

// ==================== EVENT SOURCING SERVICE ====================

class EventSourcingService {
  private events: MemoryEvent[] = [];
  private storageKey = 'jarvis_memory_events_v1';
  private config: EventStoreConfig;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  // Undo/redo stacks
  private undoStack: string[] = [];  // Event IDs that can be undone
  private redoStack: string[] = [];  // Event IDs that can be redone

  private compactionIntervalId: number | null = null;

  constructor(config: Partial<EventStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scheduleCompaction();
  }

  /**
   * Cleanup resources. Call when service is no longer needed.
   */
  public destroy(): void {
    if (this.compactionIntervalId) {
      clearInterval(this.compactionIntervalId);
      this.compactionIntervalId = null;
    }
  }

  // ==================== INITIALIZATION ====================

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadFromStorage();
    return this.loadPromise;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.events = parsed;
          logger.log('MEMORY', `Loaded ${this.events.length} memory events`, 'info');
        }
      }
      this.isLoaded = true;
    } catch (e) {
      logger.log('MEMORY', `Failed to load events: ${e instanceof Error ? e.message : String(e)}`, 'error');
      this.events = [];
      this.isLoaded = true;
    } finally {
      this.loadPromise = null;
    }
  }

  // ==================== EVENT RECORDING ====================

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async appendEvent(event: MemoryEvent): Promise<void> {
    await this.ensureLoaded();
    this.events.push(event);
    this.persist();

    // Check if compaction is needed
    if (this.events.length >= this.config.compactThreshold) {
      this.compactEvents();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (e) {
      // If quota exceeded, try compaction
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        logger.log('MEMORY', 'Storage quota exceeded, triggering compaction', 'warning');
        this.compactEvents();
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.events));
        } catch (e2) {
          logger.log('MEMORY', `Failed to persist events after compaction: ${e2 instanceof Error ? e2.message : String(e2)}`, 'error');
        }
      }
    }
  }

  // ==================== PUBLIC EVENT METHODS ====================

  public async recordCreated(
    node: MemoryNode,
    source: BaseMemoryEvent['source'] = 'USER'
  ): Promise<MemoryCreatedEvent> {
    const event: MemoryCreatedEvent = {
      id: this.generateId(),
      type: 'MEMORY_CREATED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source,
      nodeId: node.id,
      content: node.content,
      memoryType: node.type,
      tags: [...node.tags]
    };

    await this.appendEvent(event);
    this.undoStack.push(event.id);
    this.redoStack = [];  // Clear redo on new action

    logger.log('MEMORY', `Recorded MEMORY_CREATED for ${node.id}`, 'info', { correlationId: event.correlationId });
    return event;
  }

  public async recordUpdated(
    node: MemoryNode,
    changes: MemoryUpdatedEvent['changes'],
    previousValues: MemoryUpdatedEvent['previousValues'],
    source: BaseMemoryEvent['source'] = 'USER'
  ): Promise<MemoryUpdatedEvent> {
    const event: MemoryUpdatedEvent = {
      id: this.generateId(),
      type: 'MEMORY_UPDATED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source,
      nodeId: node.id,
      changes,
      previousValues
    };

    await this.appendEvent(event);
    this.undoStack.push(event.id);
    this.redoStack = [];

    logger.log('MEMORY', `Recorded MEMORY_UPDATED for ${node.id}`, 'info', { correlationId: event.correlationId });
    return event;
  }

  public async recordDeleted(
    node: MemoryNode,
    source: BaseMemoryEvent['source'] = 'USER'
  ): Promise<MemoryDeletedEvent> {
    const event: MemoryDeletedEvent = {
      id: this.generateId(),
      type: 'MEMORY_DELETED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source,
      nodeId: node.id,
      nodeSnapshot: this.config.enableSnapshots ? { ...node } : undefined
    };

    await this.appendEvent(event);
    this.undoStack.push(event.id);
    this.redoStack = [];

    logger.log('MEMORY', `Recorded MEMORY_DELETED for ${node.id}`, 'info', { correlationId: event.correlationId });
    return event;
  }

  public async recordRestored(
    node: MemoryNode,
    fromBackup: boolean,
    source: BaseMemoryEvent['source'] = 'USER'
  ): Promise<MemoryRestoredEvent> {
    const event: MemoryRestoredEvent = {
      id: this.generateId(),
      type: 'MEMORY_RESTORED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source,
      nodeId: node.id,
      fromBackup,
      restoredFromSnapshot: { ...node }
    };

    await this.appendEvent(event);
    this.undoStack.push(event.id);
    this.redoStack = [];

    logger.log('MEMORY', `Recorded MEMORY_RESTORED for ${node.id}`, 'info', { correlationId: event.correlationId });
    return event;
  }

  public async recordBatchImported(
    nodes: MemoryNode[],
    importSource: string,
    source: BaseMemoryEvent['source'] = 'SYSTEM'
  ): Promise<MemoryBatchImportedEvent> {
    const event: MemoryBatchImportedEvent = {
      id: this.generateId(),
      type: 'MEMORY_BATCH_IMPORTED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source,
      count: nodes.length,
      nodeIds: nodes.map(n => n.id),
      importSource
    };

    await this.appendEvent(event);
    logger.log('MEMORY', `Recorded MEMORY_BATCH_IMPORTED: ${nodes.length} nodes from ${importSource}`, 'info');
    return event;
  }

  // ==================== REPLAY CAPABILITY ====================

  public async replay(
    options: {
      fromTimestamp?: number;
      toTimestamp?: number;
      nodeIds?: string[];
      eventTypes?: MemoryEventType[];
    } = {}
  ): Promise<ReplayResult> {
    await this.ensureLoaded();

    const nodes = new Map<string, MemoryNode>();
    const errors: Array<{ eventId: string; error: string }> = [];
    const appliedEvents: MemoryEvent[] = [];

    // Filter events based on options
    let eventsToReplay = this.events.filter(e => {
      if (options.fromTimestamp && e.timestamp < options.fromTimestamp) return false;
      if (options.toTimestamp && e.timestamp > options.toTimestamp) return false;
      if (options.eventTypes && !options.eventTypes.includes(e.type)) return false;
      if (options.nodeIds) {
        // For batch events, check if any nodeId matches
        if (e.type === 'MEMORY_BATCH_IMPORTED') {
          return (e as MemoryBatchImportedEvent).nodeIds.some(id => options.nodeIds!.includes(id));
        }
        return options.nodeIds.includes((e as MemoryCreatedEvent).nodeId);
      }
      return true;
    });

    // Apply events in order
    for (const event of eventsToReplay) {
      try {
        this.applyEvent(event, nodes);
        appliedEvents.push(event);
      } catch (error) {
        errors.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.log('MEMORY', `Replayed ${appliedEvents.length} events, ${errors.length} errors`, 'info');

    return {
      success: errors.length === 0,
      nodes,
      eventCount: appliedEvents.length,
      errors,
      appliedEvents
    };
  }

  private applyEvent(event: MemoryEvent, nodes: Map<string, MemoryNode>): void {
    switch (event.type) {
      case 'MEMORY_CREATED': {
        const created = event as MemoryCreatedEvent;
        const node: MemoryNode = {
          id: created.nodeId,
          content: created.content,
          type: created.memoryType,
          tags: created.tags,
          created: created.timestamp,
          lastAccessed: created.timestamp
        };
        nodes.set(created.nodeId, node);
        break;
      }

      case 'MEMORY_UPDATED': {
        const updated = event as MemoryUpdatedEvent;
        const existing = nodes.get(updated.nodeId);
        if (!existing) {
          throw new Error(`Cannot update non-existent node: ${updated.nodeId}`);
        }
        if (updated.changes.content !== undefined) {
          existing.content = updated.changes.content;
        }
        if (updated.changes.tags !== undefined) {
          existing.tags = updated.changes.tags;
        }
        if (updated.changes.lastAccessed !== undefined) {
          existing.lastAccessed = updated.changes.lastAccessed;
        }
        break;
      }

      case 'MEMORY_DELETED': {
        const deleted = event as MemoryDeletedEvent;
        nodes.delete(deleted.nodeId);
        break;
      }

      case 'MEMORY_RESTORED': {
        const restored = event as MemoryRestoredEvent;
        if (restored.restoredFromSnapshot) {
          nodes.set(restored.nodeId, { ...restored.restoredFromSnapshot });
        }
        break;
      }

      case 'MEMORY_BATCH_IMPORTED': {
        const batch = event as MemoryBatchImportedEvent;
        // Batch import events don't contain full node data
        // They are informational - actual nodes come from individual CREATED events
        break;
      }

      case 'MEMORY_COMPACTED':
        // Compaction events are informational only
        break;
    }
  }

  // ==================== UNDO/REDO ====================

  public async undo(): Promise<MemoryEvent | null> {
    await this.ensureLoaded();
    
    if (this.undoStack.length === 0) return null;

    const eventId = this.undoStack.pop()!;
    const event = this.events.find(e => e.id === eventId);
    
    if (!event) return null;

    // Create inverse event
    const inverseEvent = this.createInverseEvent(event);
    if (inverseEvent) {
      await this.appendEvent(inverseEvent);
      this.redoStack.push(inverseEvent.id);
    }

    logger.log('MEMORY', `Undone event ${eventId}`, 'info');
    return event;
  }

  public async redo(): Promise<MemoryEvent | null> {
    await this.ensureLoaded();
    
    if (this.redoStack.length === 0) return null;

    const eventId = this.redoStack.pop()!;
    const event = this.events.find(e => e.id === eventId);
    
    if (!event) return null;

    // Create inverse of the inverse (back to original state)
    const inverseEvent = this.createInverseEvent(event);
    if (inverseEvent) {
      await this.appendEvent(inverseEvent);
      this.undoStack.push(inverseEvent.id);
    }

    logger.log('MEMORY', `Redone event ${eventId}`, 'info');
    return event;
  }

  private createInverseEvent(event: MemoryEvent): MemoryEvent | null {
    switch (event.type) {
      case 'MEMORY_CREATED': {
        const created = event as MemoryCreatedEvent;
        // Inverse of CREATE is DELETE
        return {
          id: this.generateId(),
          type: 'MEMORY_DELETED',
          timestamp: Date.now(),
          correlationId: event.correlationId,
          source: 'SYSTEM',
          nodeId: created.nodeId,
          nodeSnapshot: {
            id: created.nodeId,
            content: created.content,
            type: created.memoryType,
            tags: created.tags,
            created: created.timestamp
          }
        } as MemoryDeletedEvent;
      }

      case 'MEMORY_DELETED': {
        const deleted = event as MemoryDeletedEvent;
        if (!deleted.nodeSnapshot) return null;
        // Inverse of DELETE is CREATE
        return {
          id: this.generateId(),
          type: 'MEMORY_CREATED',
          timestamp: Date.now(),
          correlationId: event.correlationId,
          source: 'SYSTEM',
          nodeId: deleted.nodeId,
          content: deleted.nodeSnapshot.content,
          memoryType: deleted.nodeSnapshot.type,
          tags: deleted.nodeSnapshot.tags
        } as MemoryCreatedEvent;
      }

      case 'MEMORY_UPDATED': {
        const updated = event as MemoryUpdatedEvent;
        // Inverse is UPDATE with reversed changes
        return {
          id: this.generateId(),
          type: 'MEMORY_UPDATED',
          timestamp: Date.now(),
          correlationId: event.correlationId,
          source: 'SYSTEM',
          nodeId: updated.nodeId,
          changes: updated.previousValues,
          previousValues: updated.changes
        } as MemoryUpdatedEvent;
      }

      default:
        return null;
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ==================== COMPACTION & PRUNING ====================

  private compactEvents(): void {
    const beforeCount = this.events.length;
    const cutoffTime = Date.now() - (this.config.maxAgeDays * 24 * 60 * 60 * 1000);

    // Keep only the most recent events per node, and all events after cutoff
    const nodeLastState = new Map<string, MemoryEvent[]>();
    const recentEvents: MemoryEvent[] = [];

    for (const event of this.events) {
      // Always keep recent events
      if (event.timestamp > cutoffTime) {
        recentEvents.push(event);
        continue;
      }

      // For old events, track last state per node
      if (event.type === 'MEMORY_BATCH_IMPORTED' || event.type === 'MEMORY_COMPACTED') {
        recentEvents.push(event);
        continue;
      }

      const nodeId = (event as MemoryCreatedEvent).nodeId;
      if (!nodeLastState.has(nodeId)) {
        nodeLastState.set(nodeId, []);
      }
      nodeLastState.get(nodeId)!.push(event);
    }

    // For old nodes, keep only the final state (last event)
    const finalStateEvents: MemoryEvent[] = [];
    nodeLastState.forEach((events, nodeId) => {
      // Sort by timestamp and keep only the last one
      events.sort((a, b) => a.timestamp - b.timestamp);
      const lastEvent = events[events.length - 1];
      
      // If last event is DELETE, don't include it (node is gone)
      if (lastEvent.type !== 'MEMORY_DELETED') {
        finalStateEvents.push(lastEvent);
      }
    });

    // Combine: recent events + final state snapshots
    this.events = [...recentEvents, ...finalStateEvents];

    // Sort by timestamp
    this.events.sort((a, b) => a.timestamp - b.timestamp);

    const afterCount = this.events.length;

    // Record compaction event
    const compactionEvent: MemoryCompactedEvent = {
      id: this.generateId(),
      type: 'MEMORY_COMPACTED',
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      source: 'SYSTEM',
      eventsBeforeCount: beforeCount,
      eventsAfterCount: afterCount,
      compactedAt: Date.now()
    };
    this.events.push(compactionEvent);

    this.persist();

    logger.log('MEMORY', `Compacted events: ${beforeCount} → ${afterCount}`, 'info', {
      removed: beforeCount - afterCount,
      cutoffDays: this.config.maxAgeDays
    });
  }

  private scheduleCompaction(): void {
    // Run compaction check daily
    this.compactionIntervalId = window.setInterval(() => {
      if (this.events.length >= this.config.compactThreshold) {
        this.compactEvents();
      }
    }, 24 * 60 * 60 * 1000);
  }

  public async pruneOldEvents(maxAgeDays?: number): Promise<number> {
    await this.ensureLoaded();
    
    const cutoff = Date.now() - ((maxAgeDays || this.config.maxAgeDays) * 24 * 60 * 60 * 1000);
    const beforeCount = this.events.length;
    
    this.events = this.events.filter(e => e.timestamp > cutoff || e.type === 'MEMORY_COMPACTED');
    
    const removed = beforeCount - this.events.length;
    this.persist();

    logger.log('MEMORY', `Pruned ${removed} old events`, 'info');
    return removed;
  }

  // ==================== QUERY METHODS ====================

  public async getEvents(
    options: {
      nodeId?: string;
      types?: MemoryEventType[];
      from?: number;
      to?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MemoryEvent[]> {
    await this.ensureLoaded();

    let result = this.events.filter(e => {
      if (options.nodeId) {
        if (e.type === 'MEMORY_BATCH_IMPORTED') {
          return (e as MemoryBatchImportedEvent).nodeIds.includes(options.nodeId);
        }
        return (e as MemoryCreatedEvent).nodeId === options.nodeId;
      }
      if (options.types && !options.types.includes(e.type)) return false;
      if (options.from && e.timestamp < options.from) return false;
      if (options.to && e.timestamp > options.to) return false;
      return true;
    });

    if (options.offset) {
      result = result.slice(options.offset);
    }
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  public async getStats(): Promise<EventSourcingStats> {
    await this.ensureLoaded();

    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};
    
    let oldestEvent: number | null = null;
    let newestEvent: number | null = null;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;
      
      if (!oldestEvent || event.timestamp < oldestEvent) oldestEvent = event.timestamp;
      if (!newestEvent || event.timestamp > newestEvent) newestEvent = event.timestamp;
    }

    const daysSpan = oldestEvent && newestEvent 
      ? Math.max(1, (newestEvent - oldestEvent) / (24 * 60 * 60 * 1000))
      : 1;

    const storageSize = new TextEncoder().encode(JSON.stringify(this.events)).length;

    return {
      totalEvents: this.events.length,
      eventsByType: eventsByType as Record<MemoryEventType, number>,
      eventsBySource,
      oldestEvent,
      newestEvent,
      averageEventsPerDay: Math.round(this.events.length / daysSpan),
      storageSizeBytes: storageSize
    };
  }

  public async getNodeHistory(nodeId: string): Promise<MemoryEvent[]> {
    return this.getEvents({ nodeId });
  }

  public async getRecentEvents(limit: number = 50): Promise<MemoryEvent[]> {
    await this.ensureLoaded();
    return this.events.slice(-limit).reverse();
  }

  // ==================== DEBUGGING ====================

  public async exportEvents(): Promise<string> {
    await this.ensureLoaded();
    return JSON.stringify(this.events, null, 2);
  }

  private isValidEvent(event: unknown): event is MemoryEvent {
    if (!event || typeof event !== 'object') return false;
    const e = event as Record<string, unknown>;
    
    // Check required base fields
    if (typeof e.id !== 'string') return false;
    if (typeof e.timestamp !== 'number') return false;
    if (typeof e.correlationId !== 'string') return false;
    if (typeof e.source !== 'string') return false;
    if (!['USER', 'SYSTEM', 'MIGRATION', 'PLUGIN', 'COMPACTION'].includes(e.source as string)) return false;
    
    // Check event type
    const validTypes = ['MEMORY_CREATED', 'MEMORY_UPDATED', 'MEMORY_DELETED', 
                       'MEMORY_RESTORED', 'MEMORY_BATCH_IMPORTED', 'MEMORY_COMPACTED'];
    if (!validTypes.includes(e.type as string)) return false;
    
    return true;
  }

  public async importEvents(json: string, merge: boolean = true): Promise<number> {
    await this.ensureLoaded();
    
    let imported: unknown[];
    try {
      imported = JSON.parse(json);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    if (!Array.isArray(imported)) {
      throw new Error('Invalid events format: expected array');
    }

    // Validate and filter events
    const validEvents: MemoryEvent[] = [];
    
    for (const item of imported) {
      if (this.isValidEvent(item)) {
        validEvents.push(item);
      }
    }

    if (validEvents.length === 0) {
      throw new Error('No valid events found in import data');
    }

    if (validEvents.length < imported.length) {
      logger.log('MEMORY', `Filtered out ${imported.length - validEvents.length} invalid events during import`, 'warning');
    }

    if (merge) {
      // Merge and deduplicate by event ID
      const existingIds = new Set(this.events.map(e => e.id));
      const newEvents = validEvents.filter(e => !existingIds.has(e.id));
      this.events.push(...newEvents);
      this.events.sort((a, b) => a.timestamp - b.timestamp);
      this.persist();
      return newEvents.length;
    } else {
      // Replace all events
      this.events = validEvents;
      this.persist();
      return validEvents.length;
    }
  }

  public async clear(): Promise<void> {
    this.events = [];
    this.undoStack = [];
    this.redoStack = [];
    localStorage.removeItem(this.storageKey);
    logger.log('MEMORY', 'Cleared all events', 'warning');
  }
}

// Singleton instance
export const eventSourcing = new EventSourcingService();
