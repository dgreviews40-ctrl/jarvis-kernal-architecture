/**
 * WebSocket Service for JARVIS Kernel v1.3
 * 
 * Implements real-time bidirectional communication for:
 * - Live metrics dashboard
 * - Real-time plugin updates
 * - Event broadcasting
 * - Client synchronization
 */

import { eventBus, EventChannels } from './eventBus';
import { logger } from './logger';
import { KernelEvent } from '../types';

interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscribedChannels: Set<string>;
  heartbeatInterval?: NodeJS.Timeout;
  lastHeartbeat: number;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private clients: Map<string, WebSocketClient> = new Map();
  private serverPort: number = 3001;
  private isConnected: boolean = false;
  private eventListenersAttached: boolean = false;

  private constructor() {
    // Initialize event listeners to broadcast events to WebSocket clients
    this.initializeEventListeners();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket client connection (for browser environment)
   */
  public async connectToServer(serverUrl: string = `ws://localhost:${this.serverPort}`): Promise<void> {
    if (typeof WebSocket === 'undefined') {
      logger.log('SYSTEM', 'WebSocket not supported in this environment', 'error');
      return;
    }

    try {
      const socket = new WebSocket(serverUrl);
      
      socket.onopen = () => {
        this.isConnected = true;
        logger.log('SYSTEM', `Connected to server: ${serverUrl}`, 'success');
        
        // Send initial registration
        this.sendToServer(socket, {
          type: 'client:register',
          data: { 
            clientId: this.generateClientId(),
            capabilities: ['events', 'metrics', 'plugins'],
            timestamp: Date.now()
          }
        });
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          this.handleServerMessage(socket, message);
        } catch (error) {
          logger.log('SYSTEM', `Invalid message from server: ${(error as Error).message}`, 'error');
        }
      };

      socket.onclose = () => {
        this.isConnected = false;
        logger.log('SYSTEM', 'Disconnected from server', 'warning');
      };

      socket.onerror = (error) => {
        logger.log('SYSTEM', `WebSocket error: ${String(error)}`, 'error');
      };

      logger.log('SYSTEM', `Connecting to WebSocket server: ${serverUrl}`, 'info');
    } catch (error) {
      logger.log('SYSTEM', `Failed to connect to WebSocket server: ${(error as Error).message}`, 'error');
    }
  }

  /**
   * Setup event listeners to broadcast events to WebSocket clients
   */
  private initializeEventListeners(): void {
    if (this.eventListenersAttached) return;
    
    // Listen to all events on the event bus and broadcast to interested clients
    eventBus.subscribe('*', (event) => {
      if (this.isConnected) {
        // In a real implementation, this would broadcast to all connected WebSocket clients
        // For now, we'll just log that an event would be broadcast
        logger.log('SYSTEM', `Event would be broadcast: ${(event as any).channel || 'unknown'}`, 'info');
      }
    });
    
    this.eventListenersAttached = true;
  }

  /**
   * Handle incoming messages from the server
   */
  private handleServerMessage(socket: WebSocket, message: any): void {
    switch (message.type) {
      case 'event':
        // Handle incoming events from server
        this.handleIncomingEvent(message);
        break;
      case 'subscription:confirmed':
        logger.log('SYSTEM', `Subscription confirmed: ${message.data.channel}`, 'success');
        break;
      case 'subscription:cancelled':
        logger.log('SYSTEM', `Subscription cancelled: ${message.data.channel}`, 'info');
        break;
      case 'response':
        // Handle response to a previous request
        this.handleResponse(message);
        break;
      case 'heartbeat':
        // Respond to heartbeat
        this.sendToServer(socket, { type: 'heartbeat:ack', data: { timestamp: Date.now() } });
        break;
      default:
        logger.log('SYSTEM', `Unknown message type: ${message.type}`, 'warning');
    }
  }

  /**
   * Handle incoming events from the server
   */
  private handleIncomingEvent(message: any): void {
    // In a real implementation, this would trigger local event handling
    // For now, just log the event
    logger.log('SYSTEM', `Received event: ${message.channel}`, 'info');
    
    // Optionally emit the event locally
    // eventBus.publish(message.channel, message.data);
  }

  /**
   * Handle response to a previous request
   */
  private handleResponse(message: any): void {
    if (message.success) {
      logger.log('SYSTEM', `Request ${message.requestId} succeeded`, 'success');
    } else {
      logger.log('SYSTEM', `Request ${message.requestId} failed: ${message.error}`, 'error');
    }
  }

  /**
   * Send a message to the server
   */
  private sendToServer(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      logger.log('SYSTEM', 'WebSocket not open, cannot send message', 'warning');
    }
  }

  /**
   * Subscribe to a channel
   */
  public subscribeToChannel(channel: string): void {
    // In a real implementation, this would send a subscription request to the server
    logger.log('SYSTEM', `Requesting subscription to: ${channel}`, 'info');
    
    // For demo purposes, we'll just log it
    // In real implementation: this.sendToServer(socket, { type: 'subscribe', channel });
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribeFromChannel(channel: string): void {
    // In a real implementation, this would send an unsubscription request to the server
    logger.log('SYSTEM', `Requesting unsubscription from: ${channel}`, 'info');
    
    // For demo purposes, we'll just log it
    // In real implementation: this.sendToServer(socket, { type: 'unsubscribe', channel });
  }

  /**
   * Send a request to the server
   */
  public sendRequest(action: string, params?: any): void {
    const requestId = this.generateRequestId();
    
    logger.log('SYSTEM', `Sending request: ${action}`, 'info');
    
    // In real implementation:
    // this.sendToServer(socket, { type: 'request', requestId, action, params });
  }

  /**
   * Get system metrics from the server
   */
  public getSystemMetrics(): void {
    this.sendRequest('get:metrics');
  }

  /**
   * Get plugin status from the server
   */
  public getPluginStatus(): void {
    this.sendRequest('get:plugins');
  }

  /**
   * Get system health from the server
   */
  public getSystemHealth(): void {
    this.sendRequest('get:health');
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if connected to WebSocket server
   */
  public isConnectedToServer(): boolean {
    return this.isConnected;
  }

  /**
   * Close all WebSocket connections
   */
  public close(): void {
    // In a real implementation, this would close all WebSocket connections
    logger.log('SYSTEM', 'Closing WebSocket connections', 'info');
    this.isConnected = false;
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();

// Initialize the service when module loads
// In a real implementation, you might want to connect to a server
// webSocketService.connectToServer().catch(err => {
//   logger.log('SYSTEM', `Failed to connect to WebSocket server: ${err.message}`, 'warning');
// });