/**
 * Home Assistant WebSocket Service
 * 
 * Provides real-time updates from Home Assistant via WebSocket API.
 * Replaces polling-based entity updates with push-based state changes.
 */

import { FEATURES, TIMING } from '../constants/config';
import { logger } from './logger';
import { eventBus } from './eventBus';
// HAEntity type is defined here to avoid circular dependency
interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
}

// WebSocket message types from Home Assistant
interface HAMessage {
  id?: number;
  type: string;
  [key: string]: any;
}

interface HAAuthMessage extends HAMessage {
  type: 'auth' | 'auth_required' | 'auth_ok' | 'auth_invalid';
  access_token?: string;
  message?: string;
}

interface HAEventMessage extends HAMessage {
  type: 'event';
  event: {
    event_type: string;
    data: {
      entity_id?: string;
      new_state?: HAEntity;
      old_state?: HAEntity;
    };
  };
}

interface HASubscribeMessage extends HAMessage {
  id: number;
  type: 'subscribe_events' | 'unsubscribe_events';
  event_type?: string;
}

interface HAResultMessage extends HAMessage {
  id: number;
  type: 'result';
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting';

// WebSocket configuration
const WS_CONFIG = {
  RECONNECT_DELAY_MS: 2000,
  MAX_RECONNECT_DELAY_MS: 30000,
  RECONNECT_BACKOFF_MULTIPLIER: 1.5,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL_MS: 30000,
  PONG_TIMEOUT_MS: 10000,
  CONNECTION_TIMEOUT_MS: 10000,
} as const;

/**
 * Home Assistant WebSocket Service
 * Manages real-time connection to Home Assistant for live entity updates
 */
class HomeAssistantWebSocketService {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private baseUrl: string = '';
  private token: string = '';
  private messageId: number = 1;
  private subscriptions: Map<number, string> = new Map(); // id -> event_type
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: HAMessage[] = [];
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private _lastError: string | null = null;
  private _connectionStartTime: number = 0;

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  // ============ Public API ============

  /**
   * Check if WebSocket is enabled in features
   */
  public get isEnabled(): boolean {
    return FEATURES.ENABLE_HA_WEBSOCKET;
  }

  /**
   * Current connection state
   */
  public get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected and authenticated
   */
  public get isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get last error message
   */
  public get lastError(): string | null {
    return this._lastError;
  }

  /**
   * Get connection duration in ms
   */
  public get connectionDuration(): number {
    if (this._connectionStartTime === 0) return 0;
    return Date.now() - this._connectionStartTime;
  }

  /**
   * Configure the WebSocket service
   */
  public configure(baseUrl: string, token: string): void {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    logger.log('HOME_ASSISTANT', 'Configuration updated', 'info');
  }

  /**
   * Connect to Home Assistant WebSocket
   */
  public async connect(): Promise<boolean> {
    if (!this.isEnabled) {
      logger.log('HOME_ASSISTANT', 'WebSocket disabled by feature flag', 'info');
      return false;
    }

    if (this.isConnected) {
      logger.log('HOME_ASSISTANT', 'Already connected', 'info');
      return true;
    }

    if (this.state === 'connecting' || this.state === 'authenticating') {
      logger.log('HOME_ASSISTANT', 'Connection already in progress', 'info');
      return false;
    }

    if (!this.baseUrl || !this.token) {
      this._lastError = 'Not configured: URL and token required';
      logger.log('HOME_ASSISTANT', this._lastError, 'error');
      return false;
    }

    this.setState('connecting');
    this._connectionStartTime = Date.now();

    try {
      // Convert HTTP URL to WebSocket URL
      const wsUrl = this.baseUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://') + '/api/websocket';

      logger.log('HOME_ASSISTANT', `Connecting to ${wsUrl}`, 'info');

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.state === 'connecting') {
          this._lastError = 'Connection timeout';
          logger.log('HOME_ASSISTANT', this._lastError, 'error');
          this.ws?.close();
          this.scheduleReconnect();
        }
      }, WS_CONFIG.CONNECTION_TIMEOUT_MS);

      // Setup event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

      return true;
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : 'Connection failed';
      logger.log('HOME_ASSISTANT', `Connection error: ${this._lastError}`, 'error');
      this.setState('disconnected');
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = 0;
    
    if (this.ws) {
      // Don't reconnect on intentional disconnect
      this.ws.onclose = null;
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
    logger.log('HOME_ASSISTANT', 'Disconnected', 'info');
  }

  /**
   * Subscribe to entity state changes
   */
  public subscribeToStateChanges(callback: (entity: HAEntity) => void): () => void {
    return this.addEventListener('state_changed', callback);
  }

  /**
   * Subscribe to all Home Assistant events
   */
  public subscribeToEvents(eventType: string, callback: (data: any) => void): () => void {
    // Send subscription message if connected
    if (this.isConnected) {
      this.sendSubscribe(eventType);
    } else {
      // Queue for when connected
      this.pendingMessages.push({
        type: 'subscribe_events',
        event_type: eventType,
      });
    }

    return this.addEventListener(eventType, callback);
  }

  /**
   * Get current connection stats
   */
  public getStats(): {
    state: ConnectionState;
    connected: boolean;
    reconnectAttempts: number;
    subscriptions: number;
    pendingMessages: number;
    duration: number;
    lastError: string | null;
  } {
    return {
      state: this.state,
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      pendingMessages: this.pendingMessages.length,
      duration: this.connectionDuration,
      lastError: this._lastError,
    };
  }

  // ============ Private Methods ============

  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (oldState !== newState) {
      logger.log('HOME_ASSISTANT', `State: ${oldState} -> ${newState}`, 'info');
      eventBus.publish('ha:ws:state_change', { oldState, newState });
    }
  }

  private handleOpen(): void {
    logger.log('HOME_ASSISTANT', 'WebSocket opened, waiting for auth', 'info');
    this.setState('authenticating');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as HAMessage;
      this.processMessage(message);
    } catch (error) {
      logger.log('HOME_ASSISTANT', `Failed to parse message: ${error}`, 'error');
    }
  }

  private processMessage(message: HAMessage): void {
    switch (message.type) {
      case 'auth_required':
        this.sendAuth();
        break;

      case 'auth_ok':
        this.handleAuthSuccess();
        break;

      case 'auth_invalid':
        this.handleAuthFailure((message as HAAuthMessage).message || 'Authentication failed');
        break;

      case 'event':
        this.handleEvent(message as HAEventMessage);
        break;

      case 'result':
        this.handleResult(message as HAResultMessage);
        break;

      case 'pong':
        this.handlePong();
        break;

      default:
        logger.log('HOME_ASSISTANT', `Unknown message type: ${message.type}`, 'info');
    }
  }

  private sendAuth(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const authMessage: HAAuthMessage = {
      type: 'auth',
      access_token: this.token,
    };

    this.ws.send(JSON.stringify(authMessage));
    logger.log('HOME_ASSISTANT', 'Sent authentication', 'info');
  }

  private handleAuthSuccess(): void {
    this.clearConnectionTimeout();
    this.setState('connected');
    this.reconnectAttempts = 0;
    this._lastError = null;

    logger.log('HOME_ASSISTANT', 'Authenticated successfully', 'info');

    // Start ping interval
    this.startPingInterval();

    // Subscribe to state changes
    this.sendSubscribe('state_changed');

    // Process pending subscriptions
    this.processPendingMessages();

    // Publish connection event
    eventBus.publish('ha:ws:connected', { timestamp: Date.now() });
  }

  private handleAuthFailure(message: string): void {
    this._lastError = `Authentication failed: ${message}`;
    logger.log('HOME_ASSISTANT', this._lastError, 'error');
    this.setState('disconnected');
    this.ws?.close();
    
    // Don't retry on auth failure - it won't succeed
    eventBus.publish('ha:ws:error', { error: this._lastError, fatal: true });
  }

  private handleEvent(message: HAEventMessage): void {
    const { event } = message;
    
    if (event.event_type === 'state_changed' && event.data.new_state) {
      const entity = event.data.new_state;
      
      // Publish to event bus
      eventBus.publish('ha:entity_updated', entity);
      
      // Notify listeners
      this.notifyListeners('state_changed', entity);
    }

    // Notify general event listeners
    this.notifyListeners(event.event_type, event.data);
  }

  private handleResult(message: HAResultMessage): void {
    if (!message.success && message.error) {
      logger.log('HOME_ASSISTANT', `Command failed: ${message.error.message}`, 'error');
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearConnectionTimeout();
    this.clearPingInterval();

    const wasConnected = this.state === 'connected';
    this.setState('disconnected');

    if (event.wasClean) {
      logger.log('HOME_ASSISTANT', `Connection closed cleanly: ${event.code} ${event.reason}`, 'info');
    } else {
      logger.log('HOME_ASSISTANT', `Connection lost: ${event.code}`, 'warning');
      
      // Schedule reconnect if it wasn't intentional
      if (wasConnected || this.reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      }
    }

    eventBus.publish('ha:ws:disconnected', { 
      code: event.code, 
      reason: event.reason,
      wasClean: event.wasClean 
    });
  }

  private handleError(error: Event): void {
    this._lastError = 'WebSocket error occurred';
    logger.log('HOME_ASSISTANT', 'WebSocket error', 'error');
    eventBus.publish('ha:ws:error', { error: this._lastError });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return; // Already scheduled

    this.setState('reconnecting');
    this.reconnectAttempts++;

    if (this.reconnectAttempts > WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      this._lastError = `Max reconnection attempts (${WS_CONFIG.MAX_RECONNECT_ATTEMPTS}) reached`;
      logger.log('HOME_ASSISTANT', this._lastError, 'error');
      eventBus.publish('ha:ws:error', { error: this._lastError, fatal: true });
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      WS_CONFIG.RECONNECT_DELAY_MS * Math.pow(WS_CONFIG.RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempts - 1),
      WS_CONFIG.MAX_RECONNECT_DELAY_MS
    );

    logger.log('HOME_ASSISTANT', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`, 'info');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        
        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          logger.log('HOME_ASSISTANT', 'Pong timeout, reconnecting', 'warning');
          this.ws?.close();
          this.scheduleReconnect();
        }, WS_CONFIG.PONG_TIMEOUT_MS);
      }
    }, WS_CONFIG.PING_INTERVAL_MS);
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearConnectionTimeout();
    this.clearPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private clearPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private sendSubscribe(eventType: string): number {
    if (!this.isConnected) {
      logger.log('HOME_ASSISTANT', 'Cannot subscribe: not connected', 'warning');
      return -1;
    }

    const id = this.messageId++;
    const message: HASubscribeMessage = {
      id,
      type: 'subscribe_events',
      event_type: eventType,
    };

    this.subscriptions.set(id, eventType);
    this.ws!.send(JSON.stringify(message));
    logger.log('HOME_ASSISTANT', `Subscribed to ${eventType} (id: ${id})`, 'info');

    return id;
  }

  private processPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.isConnected) {
      const message = this.pendingMessages.shift();
      if (message) {
        if (message.type === 'subscribe_events' && message.event_type) {
          this.sendSubscribe(message.event_type);
        }
      }
    }
  }

  private addEventListener(eventType: string, callback: (data: any) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  private notifyListeners(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.log('HOME_ASSISTANT', `Listener error: ${error}`, 'error');
        }
      });
    }
  }

  private handleOnline(): void {
    logger.log('HOME_ASSISTANT', 'Network online, attempting reconnect', 'info');
    if (!this.isConnected && this.state !== 'connecting') {
      this.reconnectAttempts = 0;
      this.connect();
    }
  }

  private handleOffline(): void {
    logger.log('HOME_ASSISTANT', 'Network offline', 'warning');
    this.disconnect();
  }
}

// Export singleton instance
export const haWebSocketService = new HomeAssistantWebSocketService();
export default haWebSocketService;
