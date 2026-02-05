/**
 * Event Bus - Kernel v1.3
 * Centralized pub/sub system for inter-service communication
 * 
 * Features:
 * - Type-safe event channels
 * - Wildcard subscriptions (e.g., "plugin.*")
 * - Event persistence for replay
 * - Priority levels
 * - Async event handling
 */

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface KernelEvent<T = unknown> {
  id: string;
  channel: string;
  payload: T;
  timestamp: number;
  priority: EventPriority;
  source: string;
  correlationId?: string;
}

export interface EventSubscription {
  id: string;
  channel: string;
  handler: (event: KernelEvent) => void | Promise<void>;
  priority: EventPriority;
  once?: boolean;
}

export interface EventBusStats {
  totalEvents: number;
  eventsPerSecond: number;
  activeSubscriptions: number;
  channelCounts: Record<string, number>;
}

class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private history: KernelEvent[] = [];
  private maxHistorySize = 1000;
  private eventCount = 0;
  private lastResetTime = Date.now();
  private stats: EventBusStats = {
    totalEvents: 0,
    eventsPerSecond: 0,
    activeSubscriptions: 0,
    channelCounts: {}
  };

  /**
   * Subscribe to events on a channel
   * Supports wildcards: "plugin.*" matches "plugin.load", "plugin.unload", etc.
   */
  subscribe(
    channel: string,
    handler: (event: KernelEvent) => void | Promise<void>,
    options: { priority?: EventPriority; once?: boolean } = {}
  ): () => void {
    const subscription: EventSubscription = {
      id: Math.random().toString(36).substring(2, 11),
      channel,
      handler,
      priority: options.priority || 'normal',
      once: options.once || false
    };

    const existing = this.subscriptions.get(channel) || [];
    existing.push(subscription);
    // Sort by priority
    existing.sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority));
    this.subscriptions.set(channel, existing);
    this.updateStats();

    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe once to an event
   */
  once(
    channel: string,
    handler: (event: KernelEvent) => void | Promise<void>,
    options: { priority?: EventPriority } = {}
  ): () => void {
    return this.subscribe(channel, handler, { ...options, once: true });
  }

  /**
   * Publish an event to a channel
   */
  async publish<T>(
    channel: string,
    payload: T,
    options: {
      priority?: EventPriority;
      source?: string;
      correlationId?: string;
    } = {}
  ): Promise<void> {
    const event: KernelEvent<T> = {
      id: Math.random().toString(36).substring(2, 11),
      channel,
      payload,
      timestamp: Date.now(),
      priority: options.priority || 'normal',
      source: options.source || 'kernel',
      correlationId: options.correlationId
    };

    // Store in history
    this.history.unshift(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }

    // Update stats
    this.eventCount++;
    this.stats.totalEvents++;
    this.stats.channelCounts[channel] = (this.stats.channelCounts[channel] || 0) + 1;

    // Find and notify subscribers
    const handlers: EventSubscription[] = [];

    // Exact match
    const exact = this.subscriptions.get(channel) || [];
    handlers.push(...exact);

    // Wildcard matches
    for (const [pattern, subs] of this.subscriptions) {
      if (this.matchesWildcard(channel, pattern)) {
        handlers.push(...subs);
      }
    }

    // Execute handlers by priority
    const priorityOrder: EventPriority[] = ['critical', 'high', 'normal', 'low'];
    for (const priority of priorityOrder) {
      const priorityHandlers = handlers.filter(h => h.priority === priority);
      
      // Execute in parallel for same priority
      await Promise.all(
        priorityHandlers.map(async (sub) => {
          try {
            await sub.handler(event);
            if (sub.once) {
              this.unsubscribe(sub.id);
            }
          } catch (error) {
            console.error(`[EventBus] Handler error on ${channel}:`, error);
          }
        })
      );
    }
  }

  /**
   * Request/Response pattern helper
   */
  async request<TRequest, TResponse>(
    channel: string,
    payload: TRequest,
    timeoutMs = 5000
  ): Promise<TResponse> {
    const correlationId = Math.random().toString(36).substring(2, 11);
    const responseChannel = `${channel}:response:${correlationId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.unsubscribe(subscriptionId);
        reject(new Error(`Request timeout on ${channel}`));
      }, timeoutMs);

      const subscriptionId = this.subscribe(
        responseChannel,
        (event) => {
          clearTimeout(timeout);
          this.unsubscribe(subscriptionId);
          resolve(event.payload as TResponse);
        },
        { priority: 'critical' }
      );

      this.publish(channel, payload, { correlationId, priority: 'high' });
    });
  }

  /**
   * Reply to a request
   */
  reply<T>(requestEvent: KernelEvent, payload: T): void {
    if (requestEvent.correlationId) {
      const responseChannel = `${requestEvent.channel}:response:${requestEvent.correlationId}`;
      this.publish(responseChannel, payload, { 
        correlationId: requestEvent.correlationId,
        priority: 'high'
      });
    }
  }

  /**
   * Get event history for a channel
   */
  getHistory(channel?: string, limit = 100): KernelEvent[] {
    let events = this.history;
    if (channel) {
      events = events.filter(e => e.channel === channel || this.matchesWildcard(e.channel, channel));
    }
    return events.slice(0, limit);
  }

  /**
   * Replay events from history
   */
  async replay(channel: string, count = 10): Promise<void> {
    const events = this.getHistory(channel, count).reverse();
    for (const event of events) {
      await this.publish(event.channel, event.payload, {
        priority: event.priority,
        source: `${event.source}:replay`
      });
    }
  }

  /**
   * Get current stats
   */
  getStats(): EventBusStats {
    const now = Date.now();
    const elapsed = (now - this.lastResetTime) / 1000;
    this.stats.eventsPerSecond = elapsed > 0 ? this.eventCount / elapsed : 0;
    return { ...this.stats };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.eventCount = 0;
    this.lastResetTime = Date.now();
    this.stats.eventsPerSecond = 0;
    this.stats.channelCounts = {};
  }

  /**
   * Clear all subscriptions and history
   */
  clear(): void {
    this.subscriptions.clear();
    this.history = [];
    this.updateStats();
  }

  private unsubscribe(subscriptionId: string): void {
    for (const [channel, subs] of this.subscriptions) {
      const filtered = subs.filter(s => s.id !== subscriptionId);
      if (filtered.length === 0) {
        this.subscriptions.delete(channel);
      } else {
        this.subscriptions.set(channel, filtered);
      }
    }
    this.updateStats();
  }

  private matchesWildcard(channel: string, pattern: string): boolean {
    if (!pattern.includes('*')) return false;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(channel);
  }

  private priorityWeight(priority: EventPriority): number {
    const weights: Record<EventPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };
    return weights[priority];
  }

  private updateStats(): void {
    this.stats.activeSubscriptions = Array.from(this.subscriptions.values())
      .reduce((sum, subs) => sum + subs.length, 0);
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Predefined channels for type safety
export const EventChannels = {
  // Plugin events
  PLUGIN: {
    LOAD: 'plugin.load',
    UNLOAD: 'plugin.unload',
    ENABLE: 'plugin.enable',
    DISABLE: 'plugin.disable',
    ERROR: 'plugin.error',
    ALL: 'plugin.*'
  },
  // Kernel events
  KERNEL: {
    BOOT: 'kernel.boot',
    SHUTDOWN: 'kernel.shutdown',
    ERROR: 'kernel.error',
    STATE_CHANGE: 'kernel.state.change'
  },
  // Voice events
  VOICE: {
    START: 'voice.start',
    STOP: 'voice.stop',
    COMMAND: 'voice.command',
    ERROR: 'voice.error'
  },
  // Memory events
  MEMORY: {
    STORE: 'memory.store',
    RETRIEVE: 'memory.retrieve',
    DELETE: 'memory.delete',
    CLEAR: 'memory.clear'
  },
  // System events
  SYSTEM: {
    RESOURCE_WARNING: 'system.resource.warning',
    PERFORMANCE: 'system.performance',
    HEALTH_CHECK: 'system.health'
  }
} as const;
