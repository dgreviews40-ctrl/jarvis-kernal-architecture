/**
 * Event Sourcing System
 * Stores state changes as events for better performance and debugging
 * Enables time-travel debugging and state reconstruction
 */

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  version: number;
  timestamp: number;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface AggregateState {
  version: number;
  snapshotVersion: number;
}

interface EventHandler<TState, TEvent extends DomainEvent> {
  (state: TState, event: TEvent): TState;
}

interface Snapshot<TState> {
  state: TState;
  version: number;
  timestamp: number;
}

interface EventStoreConfig {
  snapshotFrequency: number;  // Create snapshot every N events
  maxEventsInMemory: number;  // Keep only last N events in memory
  persistent: boolean;
}

const DEFAULT_CONFIG: EventStoreConfig = {
  snapshotFrequency: 100,
  maxEventsInMemory: 500,
  persistent: true
};

class EventStore {
  private events: DomainEvent[] = [];
  private snapshots = new Map<string, Snapshot<unknown>>();
  private handlers = new Map<string, EventHandler<unknown, DomainEvent>>();
  private config: EventStoreConfig;
  private observers: ((event: DomainEvent) => void)[] = [];

  constructor(config: Partial<EventStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an event handler
   */
  registerHandler<TState, TEvent extends DomainEvent>(
    eventType: string,
    handler: EventHandler<TState, TEvent>
  ): void {
    this.handlers.set(eventType, handler as EventHandler<unknown, DomainEvent>);
  }

  /**
   * Append an event to the store
   */
  append<TEvent extends DomainEvent>(event: Omit<TEvent, 'id' | 'timestamp' | 'version'>): TEvent {
    const fullEvent: DomainEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
      version: this.getNextVersion(event.aggregateId)
    };

    this.events.push(fullEvent);
    
    // Trim in-memory events
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events = this.events.slice(-this.config.maxEventsInMemory);
    }

    // Notify observers
    this.notifyObservers(fullEvent);

    // Persist if needed
    if (this.config.persistent) {
      this.persistEvent(fullEvent);
    }

    return fullEvent as TEvent;
  }

  /**
   * Get events for an aggregate
   */
  getEvents(aggregateId: string, fromVersion = 0): DomainEvent[] {
    return this.events.filter(
      e => e.aggregateId === aggregateId && e.version > fromVersion
    );
  }

  /**
   * Get all events
   */
  getAllEvents(): DomainEvent[] {
    return [...this.events];
  }

  /**
   * Reconstruct state from events
   */
  reconstruct<TState extends AggregateState>(
    aggregateId: string,
    initialState: TState
  ): TState {
    // Try to load from snapshot first
    const snapshot = this.snapshots.get(aggregateId) as Snapshot<TState> | undefined;
    let state = snapshot?.state ?? initialState;
    let fromVersion = snapshot?.version ?? 0;

    // Apply events since snapshot
    const events = this.getEvents(aggregateId, fromVersion);
    
    for (const event of events) {
      const handler = this.handlers.get(event.type);
      if (handler) {
        state = handler(state, event) as TState;
      }
    }

    // Create snapshot if needed
    if (events.length >= this.config.snapshotFrequency) {
      this.createSnapshot(aggregateId, state);
    }

    return state;
  }

  /**
   * Create a snapshot
   */
  createSnapshot<TState>(aggregateId: string, state: TState): void {
    const aggregate = state as unknown as AggregateState;
    this.snapshots.set(aggregateId, {
      state,
      version: aggregate.version,
      timestamp: Date.now()
    });
  }

  /**
   * Subscribe to events
   */
  subscribe(callback: (event: DomainEvent) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  /**
   * Replay events (for debugging)
   */
  replay<TState extends AggregateState>(
    aggregateId: string,
    initialState: TState,
    targetVersion?: number
  ): TState[] {
    const states: TState[] = [initialState];
    const events = this.getEvents(aggregateId);
    let currentState = initialState;

    for (const event of events) {
      if (targetVersion && event.version > targetVersion) break;
      
      const handler = this.handlers.get(event.type);
      if (handler) {
        currentState = handler(currentState, event) as TState;
        states.push({ ...currentState });
      }
    }

    return states;
  }

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    snapshots: number;
    aggregates: number;
  } {
    const eventsByType: Record<string, number> = {};
    const aggregates = new Set<string>();

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      aggregates.add(event.aggregateId);
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      snapshots: this.snapshots.size,
      aggregates: aggregates.size
    };
  }

  /**
   * Export all events
   */
  export(): { events: DomainEvent[]; snapshots: Record<string, Snapshot<unknown>> } {
    const snapshots: Record<string, Snapshot<unknown>> = {};
    for (const [key, value] of this.snapshots.entries()) {
      snapshots[key] = value;
    }
    return { events: this.events, snapshots };
  }

  /**
   * Import events
   */
  import(data: { events: DomainEvent[]; snapshots: Record<string, Snapshot<unknown>> }): void {
    this.events = data.events || [];
    this.snapshots = new Map(Object.entries(data.snapshots || {}));
  }

  private getNextVersion(aggregateId: string): number {
    const events = this.getEvents(aggregateId);
    if (events.length === 0) return 1;
    return Math.max(...events.map(e => e.version)) + 1;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyObservers(event: DomainEvent): void {
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (error) {
        console.error('[EVENT STORE] Observer failed:', error);
      }
    }
  }

  private persistEvent(event: DomainEvent): void {
    // Could be enhanced to use IndexedDB for larger storage
    try {
      const key = `jarvis_events_${event.aggregateId}`;
      const existing = localStorage.getItem(key);
      const events = existing ? JSON.parse(existing) : [];
      events.push(event);
      
      // Keep only last 100 events per aggregate
      if (events.length > 100) {
        events.shift();
      }
      
      localStorage.setItem(key, JSON.stringify(events));
    } catch (e) {
      console.warn('[EVENT STORE] Failed to persist event:', e);
    }
  }
}

// Export singleton
export const eventStore = new EventStore();

// Export class
export { EventStore };

/**
 * Create an event-sourced aggregate
 */
export function createAggregate<TState extends AggregateState, TEvent extends DomainEvent>(
  aggregateId: string,
  initialState: TState,
  eventStore: EventStore
) {
  let state = eventStore.reconstruct(aggregateId, initialState);

  return {
    getState: () => state,
    
    apply: (event: Omit<TEvent, 'id' | 'timestamp' | 'version' | 'aggregateId'>) => {
      const fullEvent = eventStore.append({
        ...event,
        aggregateId
      } as Omit<TEvent, 'id' | 'timestamp' | 'version'>);

      // Update local state
      const handler = eventStore['handlers'].get(fullEvent.type);
      if (handler) {
        state = handler(state, fullEvent) as TState;
      }

      return fullEvent;
    },

    replay: (targetVersion?: number) => {
      const states = eventStore.replay(aggregateId, initialState, targetVersion);
      state = states[states.length - 1];
      return states;
    }
  };
}

// Example usage for conversation aggregate
export interface ConversationState extends AggregateState {
  turns: Array<{ speaker: 'USER' | 'JARVIS'; text: string; timestamp: number }>;
  context: string;
}

export interface ConversationEvent extends DomainEvent {
  aggregateId: 'conversation';
  type: 'TURN_ADDED' | 'CONTEXT_UPDATED' | 'CLEARED';
  payload: unknown;
}

// Register handlers
eventStore.registerHandler<ConversationState, ConversationEvent>(
  'TURN_ADDED',
  (state, event) => ({
    ...state,
    version: state.version + 1,
    turns: [...state.turns, event.payload as ConversationState['turns'][0]]
  })
);

eventStore.registerHandler<ConversationState, ConversationEvent>(
  'CLEARED',
  (state) => ({
    ...state,
    version: state.version + 1,
    turns: [],
    context: ''
  })
);
