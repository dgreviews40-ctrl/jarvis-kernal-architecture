/**
 * Batched Home Assistant Service
 * Optimizes HA API calls by batching and deduplicating requests
 * Reduces network overhead and improves responsiveness
 */

import { HAEntity, HAServiceCall } from './home_assistant';

interface BatchedRequest {
  entityIds: string[];
  service: string;
  serviceData?: Record<string, unknown>;
  resolve: (results: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

interface StateUpdate {
  entityId: string;
  state: string;
  attributes: Record<string, unknown>;
  timestamp: number;
}

interface HABatchConfig {
  batchWindowMs: number;
  maxBatchSize: number;
  stateCacheMs: number;
  maxConcurrentUpdates: number;
}

const DEFAULT_CONFIG: HABatchConfig = {
  batchWindowMs: 50,        // 50ms window to batch requests
  maxBatchSize: 10,         // Max 10 requests per batch
  stateCacheMs: 1000,       // Cache states for 1 second
  maxConcurrentUpdates: 3   // Max 3 concurrent update batches
};

class BatchedHomeAssistantService {
  private config: HABatchConfig;
  private pendingRequests: BatchedRequest[] = [];
  private batchTimeout: number | null = null;
  private stateCache = new Map<string, StateUpdate>();
  private inFlightUpdates = 0;
  private proxyUrl: string = "http://localhost:3101";
  private token: string | null = null;

  constructor(config: Partial<HABatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  configure(token: string, proxyUrl?: string): void {
    this.token = token;
    if (proxyUrl) {
      this.proxyUrl = proxyUrl;
    }
  }

  /**
   * Execute a service call with batching
   */
  async callService(
    entityId: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: BatchedRequest = {
        entityIds: [entityId],
        service,
        serviceData,
        resolve: (results) => resolve(results[entityId]),
        reject
      };

      this.queueRequest(request);
    });
  }

  /**
   * Execute multiple service calls in a single batch
   */
  async callServiceMany(
    calls: Array<{ entityId: string; service: string; serviceData?: Record<string, unknown> }>
  ): Promise<Record<string, unknown>> {
    if (calls.length === 0) return {};

    return new Promise((resolve, reject) => {
      const request: BatchedRequest = {
        entityIds: calls.map(c => c.entityId),
        service: calls[0].service, // Group by service type
        serviceData: {},
        resolve,
        reject
      };

      this.queueRequest(request);
    });
  }

  /**
   * Get entity state with caching
   */
  async getEntityState(entityId: string, fresh = false): Promise<HAEntity | null> {
    // Check cache first
    if (!fresh) {
      const cached = this.stateCache.get(entityId);
      if (cached && Date.now() - cached.timestamp < this.config.stateCacheMs) {
        return {
          entity_id: entityId,
          state: cached.state,
          attributes: cached.attributes,
          last_changed: new Date(cached.timestamp).toISOString()
        };
      }
    }

    // Fetch fresh state
    try {
      const response = await fetch(`${this.proxyUrl}/ha-api/states/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return null;

      const entity: HAEntity = await response.json();
      
      // Update cache
      this.stateCache.set(entityId, {
        entityId,
        state: entity.state,
        attributes: entity.attributes,
        timestamp: Date.now()
      });

      return entity;
    } catch (error) {
      console.error('[HA BATCHED] Failed to get entity state:', error);
      return null;
    }
  }

  /**
   * Get multiple entity states efficiently
   */
  async getEntityStates(entityIds: string[]): Promise<Map<string, HAEntity>> {
    const results = new Map<string, HAEntity>();
    const toFetch: string[] = [];

    // Check cache for each entity
    for (const id of entityIds) {
      const cached = this.stateCache.get(id);
      if (cached && Date.now() - cached.timestamp < this.config.stateCacheMs) {
        results.set(id, {
          entity_id: id,
          state: cached.state,
          attributes: cached.attributes,
          last_changed: new Date(cached.timestamp).toISOString()
        });
      } else {
        toFetch.push(id);
      }
    }

    // Fetch missing entities in batch
    if (toFetch.length > 0) {
      try {
        const response = await fetch(`${this.proxyUrl}/ha-api/states`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const allEntities: HAEntity[] = await response.json();
          
          for (const entity of allEntities) {
            if (toFetch.includes(entity.entity_id)) {
              results.set(entity.entity_id, entity);
              
              // Update cache
              this.stateCache.set(entity.entity_id, {
                entityId: entity.entity_id,
                state: entity.state,
                attributes: entity.attributes,
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        console.error('[HA BATCHED] Failed to fetch entities:', error);
      }
    }

    return results;
  }

  /**
   * Toggle multiple entities efficiently
   */
  async toggleEntities(entityIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Get current states
    const states = await this.getEntityStates(entityIds);
    
    // Group by domain and desired action
    const turnOn: string[] = [];
    const turnOff: string[] = [];

    for (const [id, entity] of states) {
      if (entity.state === 'on') {
        turnOff.push(id);
      } else {
        turnOn.push(id);
      }
    }

    // Execute batched calls
    const promises: Promise<void>[] = [];

    if (turnOn.length > 0) {
      promises.push(
        this.callServiceMany(
          turnOn.map(id => ({ entityId: id, service: 'turn_on' }))
        ).then(() => {
          turnOn.forEach(id => results[id] = true);
        })
      );
    }

    if (turnOff.length > 0) {
      promises.push(
        this.callServiceMany(
          turnOff.map(id => ({ entityId: id, service: 'turn_off' }))
        ).then(() => {
          turnOff.forEach(id => results[id] = false);
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear state cache
   */
  clearCache(): void {
    this.stateCache.clear();
  }

  /**
   * Get batch statistics
   */
  getStats(): {
    pendingRequests: number;
    cachedStates: number;
    inFlightUpdates: number;
  } {
    return {
      pendingRequests: this.pendingRequests.length,
      cachedStates: this.stateCache.size,
      inFlightUpdates: this.inFlightUpdates
    };
  }

  private queueRequest(request: BatchedRequest): void {
    this.pendingRequests.push(request);

    // Flush immediately if batch is full
    if (this.pendingRequests.length >= this.config.maxBatchSize) {
      this.flushBatch();
      return;
    }

    // Schedule batch flush
    if (!this.batchTimeout) {
      this.batchTimeout = window.setTimeout(() => {
        this.flushBatch();
      }, this.config.batchWindowMs);
    }
  }

  private async flushBatch(): Promise<void> {
    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Wait if too many concurrent updates
    while (this.inFlightUpdates >= this.config.maxConcurrentUpdates) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (this.pendingRequests.length === 0) return;

    // Take batch
    const batch = this.pendingRequests.splice(0, this.config.maxBatchSize);
    this.inFlightUpdates++;

    try {
      await this.executeBatch(batch);
    } finally {
      this.inFlightUpdates--;
    }
  }

  private async executeBatch(batch: BatchedRequest[]): Promise<void> {
    // Group requests by service
    const grouped = new Map<string, BatchedRequest[]>();
    
    for (const req of batch) {
      const key = req.service;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(req);
    }

    // Execute each group
    for (const [service, requests] of grouped) {
      const allEntityIds = requests.flatMap(r => r.entityIds);
      
      try {
        // Extract domain from first entity
        const domain = allEntityIds[0]?.split('.')[0];
        if (!domain) continue;

        const response = await fetch(`${this.proxyUrl}/ha-api/services/${domain}/${service}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entity_id: allEntityIds
          })
        });

        if (!response.ok) {
          throw new Error(`Service call failed: ${response.status}`);
        }

        // Resolve all requests in this group
        const result = await response.json();
        requests.forEach(req => req.resolve({ [req.entityIds[0]]: result }));

        // Invalidate cache for affected entities
        for (const id of allEntityIds) {
          this.stateCache.delete(id);
        }

      } catch (error) {
        requests.forEach(req => req.reject(error as Error));
      }
    }
  }
}

// Export singleton
export const batchedHA = new BatchedHomeAssistantService();

// Export class for custom instances
export { BatchedHomeAssistantService };
