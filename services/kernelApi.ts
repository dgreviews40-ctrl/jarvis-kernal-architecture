/**
 * Kernel API - Kernel v1.2
 * Public API surface for external integrations and plugins
 * 
 * Features:
 * - Versioned API
 * - Authentication/authorization
 * - Rate limiting
 * - Request/response patterns
 */

import { eventBus, EventChannels } from './eventBus';
import { resourceManager } from './resourceManager';
import { workerPool } from './workerService';
import { pluginLoader } from './pluginLoader';
import { cortex } from './cortex';
import { registry } from './registry';
import { engine } from './execution';
import type { PluginManifest } from '../types';

export const KERNEL_VERSION = '1.5.0';

export interface APIRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
  auth?: APICredentials;
  timestamp: number;
}

export interface APIResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: APIError;
  timestamp: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

export interface APICredentials {
  token: string;
  permissions: string[];
}

export interface APIEndpoint {
  method: string;
  handler: (params: Record<string, unknown>, auth?: APICredentials) => Promise<unknown>;
  requiredPermissions: string[];
  rateLimit: number; // requests per minute
}

class KernelAPI {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private requestCounts: Map<string, number[]> = new Map(); // token -> timestamps

  constructor() {
    this.registerDefaultEndpoints();
  }

  /**
   * Register a new API endpoint
   */
  register(endpoint: APIEndpoint): void {
    this.endpoints.set(endpoint.method, endpoint);
  }

  /**
   * Unregister an endpoint
   */
  unregister(method: string): void {
    this.endpoints.delete(method);
  }

  /**
   * Execute an API request
   */
  async execute(request: APIRequest): Promise<APIResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const endpoint = this.endpoints.get(request.method);
      if (!endpoint) {
        return this.createErrorResponse(request.id, 'METHOD_NOT_FOUND', `Method ${request.method} not found`);
      }

      // Check authentication
      if (endpoint.requiredPermissions.length > 0) {
        const authResult = this.validateAuth(request.auth, endpoint.requiredPermissions);
        if (!authResult.valid) {
          return this.createErrorResponse(request.id, 'UNAUTHORIZED', authResult.error || 'Unauthorized');
        }
      }

      // Check rate limit
      const rateLimitResult = this.checkRateLimit(request.auth?.token || 'anonymous', endpoint);
      if (!rateLimitResult.allowed) {
        return this.createErrorResponse(
          request.id, 
          'RATE_LIMITED', 
          `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}s`
        );
      }

      // Execute in worker for isolation
      const result = await endpoint.handler(request.params, request.auth);

      // Log performance
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.warn(`[KernelAPI] Slow request: ${request.method} took ${duration}ms`);
      }

      return {
        id: request.id,
        success: true,
        data: result,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(request.id, 'EXECUTION_ERROR', errorMessage);
    }
  }

  /**
   * Create a request builder for fluent API calls
   */
  request(method: string): APIRequestBuilder {
    return new APIRequestBuilder(this, method);
  }

  /**
   * Get API documentation
   */
  getDocumentation(): Array<{ method: string; description: string; permissions: string[] }> {
    return Array.from(this.endpoints.values()).map(endpoint => ({
      method: endpoint.method,
      description: this.getEndpointDescription(endpoint.method),
      permissions: endpoint.requiredPermissions
    }));
  }

  /**
   * Get API version
   */
  getVersion(): string {
    return KERNEL_VERSION;
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{
    version: string;
    uptime: number;
    status: 'healthy' | 'degraded' | 'critical';
    components: Record<string, { status: string; health: number }>;
  }> {
    const resourceStats = resourceManager.getStats();
    const workerStats = workerPool.getStats();
    const cortexHealth = cortex.getAllReliability();

    const componentHealth: Record<string, { status: string; health: number }> = {};
    
    for (const score of cortexHealth) {
      componentHealth[score.sourceId] = {
        status: score.trend,
        health: score.currentHealth
      };
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const criticalComponents = Object.values(componentHealth).filter(c => c.health < 40);
    const degradedComponents = Object.values(componentHealth).filter(c => c.health < 70);
    
    if (criticalComponents.length > 0) status = 'critical';
    else if (degradedComponents.length > 0) status = 'degraded';

    return {
      version: KERNEL_VERSION,
      uptime: Date.now() - this.getBootTime(),
      status,
      components: componentHealth
    };
  }

  private registerDefaultEndpoints(): void {
    // System endpoints
    this.register({
      method: 'system.status',
      handler: async () => this.getStatus(),
      requiredPermissions: [],
      rateLimit: 60
    });

    this.register({
      method: 'system.version',
      handler: async () => ({ version: KERNEL_VERSION }),
      requiredPermissions: [],
      rateLimit: 60
    });

    // Plugin endpoints
    this.register({
      method: 'plugin.list',
      handler: async () => {
        const plugins = registry.getAll();
        return plugins.map(p => ({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          status: p.status
        }));
      },
      requiredPermissions: ['plugin:read'],
      rateLimit: 60
    });

    this.register({
      method: 'plugin.load',
      handler: async (params) => {
        const { manifest, code } = params as { manifest: PluginManifest; code: string };
        const result = await pluginLoader.load(manifest, code);
        return { success: result.success, error: result.error };
      },
      requiredPermissions: ['plugin:write'],
      rateLimit: 10
    });

    this.register({
      method: 'plugin.unload',
      handler: async (params) => {
        const { pluginId } = params;
        const success = await pluginLoader.unload(pluginId as string);
        return { success };
      },
      requiredPermissions: ['plugin:write'],
      rateLimit: 10
    });

    this.register({
      method: 'plugin.start',
      handler: async (params) => {
        const { pluginId } = params;
        const success = await pluginLoader.start(pluginId as string);
        return { success };
      },
      requiredPermissions: ['plugin:write'],
      rateLimit: 20
    });

    this.register({
      method: 'plugin.stop',
      handler: async (params) => {
        const { pluginId } = params;
        const success = await pluginLoader.stop(pluginId as string);
        return { success };
      },
      requiredPermissions: ['plugin:write'],
      rateLimit: 20
    });

    // Execution endpoints
    this.register({
      method: 'execute.action',
      handler: async (params) => {
        const { pluginId, method, params: actionParams } = params;
        const result = await engine.executeAction({
          pluginId: pluginId as string,
          method: method as string,
          params: actionParams as { entities: string[] }
        });
        return { result };
      },
      requiredPermissions: ['execution:run'],
      rateLimit: 120
    });

    // AI endpoints
    this.register({
      method: 'ai.generate',
      handler: async (params) => {
        const { prompt, options } = params;
        const { generateResponse } = await import('./gemini');
        const result = await generateResponse(prompt as string, options as { conversationId?: string });
        return { result };
      },
      requiredPermissions: ['ai:generate'],
      rateLimit: 60
    });

    // Event endpoints
    this.register({
      method: 'event.publish',
      handler: async (params) => {
        const { channel, data, priority } = params;
        await eventBus.publish(channel as string, data, { priority: priority as any });
        return { published: true };
      },
      requiredPermissions: ['event:publish'],
      rateLimit: 300
    });

    this.register({
      method: 'event.subscribe',
      handler: async (params) => {
        const { channel } = params;
        // Returns subscription info - actual subscription handled via WebSocket
        return { 
          channel,
          subscriptionId: Math.random().toString(36).substring(2, 11)
        };
      },
      requiredPermissions: ['event:subscribe'],
      rateLimit: 60
    });

    // Resource endpoints
    this.register({
      method: 'resource.stats',
      handler: async () => {
        return {
          resources: resourceManager.getStats(),
          workers: workerPool.getStats()
        };
      },
      requiredPermissions: ['system:read'],
      rateLimit: 30
    });

    // Memory endpoints
    this.register({
      method: 'memory.get',
      handler: async (params) => {
        const { key } = params;
        const data = localStorage.getItem(`api:memory:${key}`);
        return { value: data ? JSON.parse(data) : null };
      },
      requiredPermissions: ['memory:read'],
      rateLimit: 120
    });

    this.register({
      method: 'memory.set',
      handler: async (params) => {
        const { key, value } = params;
        localStorage.setItem(`api:memory:${key}`, JSON.stringify(value));
        return { success: true };
      },
      requiredPermissions: ['memory:write'],
      rateLimit: 120
    });

    this.register({
      method: 'memory.delete',
      handler: async (params) => {
        const { key } = params;
        localStorage.removeItem(`api:memory:${key}`);
        return { success: true };
      },
      requiredPermissions: ['memory:write'],
      rateLimit: 120
    });
  }

  private validateAuth(
    auth: APICredentials | undefined, 
    requiredPermissions: string[]
  ): { valid: boolean; error?: string } {
    if (!auth) {
      return { valid: false, error: 'Authentication required' };
    }

    // Simple token validation (in production, use proper JWT validation)
    if (!auth.token || auth.token.length < 10) {
      return { valid: false, error: 'Invalid token' };
    }

    // Check permissions
    const hasPermissions = requiredPermissions.every(perm => 
      auth.permissions.includes(perm) || auth.permissions.includes('admin')
    );

    if (!hasPermissions) {
      return { valid: false, error: `Missing permissions: ${requiredPermissions.join(', ')}` };
    }

    return { valid: true };
  }

  private checkRateLimit(
    token: string, 
    endpoint: APIEndpoint
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const timestamps = this.requestCounts.get(token) || [];
    const recentRequests = timestamps.filter(t => t > oneMinuteAgo);

    if (recentRequests.length >= endpoint.rateLimit) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
      return { allowed: false, retryAfter };
    }

    recentRequests.push(now);
    this.requestCounts.set(token, recentRequests);
    return { allowed: true };
  }

  private createErrorResponse(id: string, code: string, message: string): APIResponse {
    return {
      id,
      success: false,
      error: { code, message },
      timestamp: Date.now()
    };
  }

  private getEndpointDescription(method: string): string {
    const descriptions: Record<string, string> = {
      'system.status': 'Get system health status',
      'system.version': 'Get kernel version',
      'plugin.list': 'List all installed plugins',
      'plugin.load': 'Load a new plugin',
      'plugin.unload': 'Unload a plugin',
      'plugin.start': 'Start a plugin',
      'plugin.stop': 'Stop a plugin',
      'execute.action': 'Execute a plugin action',
      'ai.generate': 'Generate AI response',
      'event.publish': 'Publish an event',
      'event.subscribe': 'Subscribe to events',
      'resource.stats': 'Get resource statistics',
      'memory.get': 'Get a memory value',
      'memory.set': 'Set a memory value',
      'memory.delete': 'Delete a memory value'
    };
    return descriptions[method] || 'No description available';
  }

  private getBootTime(): number {
    // In a real implementation, this would be set at boot
    return Date.now() - 3600000; // Mock: booted 1 hour ago
  }
}

// Fluent request builder
class APIRequestBuilder {
  private params: Record<string, unknown> = {};
  private auth?: APICredentials;

  constructor(
    private api: KernelAPI,
    private method: string
  ) {}

  withParam(key: string, value: unknown): this {
    this.params[key] = value;
    return this;
  }

  withParams(params: Record<string, unknown>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  withAuth(token: string, permissions: string[]): this {
    this.auth = { token, permissions };
    return this;
  }

  async execute<T>(): Promise<T> {
    const request: APIRequest = {
      id: Math.random().toString(36).substring(2, 11),
      method: this.method,
      params: this.params,
      auth: this.auth,
      timestamp: Date.now()
    };

    const response = await this.api.execute(request);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'API request failed');
    }

    return response.data as T;
  }
}

// Singleton instance
export const kernelApi = new KernelAPI();

// Convenience exports
export const api = {
  system: {
    status: () => kernelApi.request('system.status').execute(),
    version: () => kernelApi.request('system.version').execute()
  },
  plugin: {
    list: () => kernelApi.request('plugin.list').execute(),
    load: (manifest: unknown, code: string) => 
      kernelApi.request('plugin.load').withParams({ manifest, code }).execute(),
    unload: (pluginId: string) => 
      kernelApi.request('plugin.unload').withParam('pluginId', pluginId).execute(),
    start: (pluginId: string) => 
      kernelApi.request('plugin.start').withParam('pluginId', pluginId).execute(),
    stop: (pluginId: string) => 
      kernelApi.request('plugin.stop').withParam('pluginId', pluginId).execute()
  },
  ai: {
    generate: (prompt: string, options?: unknown) => 
      kernelApi.request('ai.generate').withParams({ prompt, options }).execute()
  },
  memory: {
    get: (key: string) => kernelApi.request('memory.get').withParam('key', key).execute(),
    set: (key: string, value: unknown) => 
      kernelApi.request('memory.set').withParams({ key, value }).execute(),
    delete: (key: string) => kernelApi.request('memory.delete').withParam('key', key).execute()
  }
};
