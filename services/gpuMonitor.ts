/**
 * GPU Monitor Service for JARVIS
 * 
 * Connects to Python GPU Monitor via WebSocket
 * Provides real-time GPU statistics for GTX 1080 Ti
 * 
 * Features:
 * - Real-time VRAM tracking
 * - GPU temperature monitoring
 * - Power draw statistics
 * - Loaded model detection
 * - Smart recommendations
 */

import { logger } from './logger';

export interface GpuProcess {
  pid: number;
  name: string;
  vram_mb: number;
  type: 'compute' | 'graphics';
}

export interface GpuStats {
  timestamp: number;
  name: string;
  gpu_id: number;
  vram_total: number;
  vram_used: number;
  vram_free: number;
  vram_percent: number;
  gpu_utilization: number;
  memory_utilization: number;
  temperature: number;
  power_draw: number;
  power_limit: number;
  graphics_clock: number;
  memory_clock: number;
  sm_clock: number;
  processes: GpuProcess[];
}

export interface DetectedModels {
  llm: GpuProcess[];
  whisper: GpuProcess[];
  embedding: GpuProcess[];
  other: GpuProcess[];
}

export interface GpuMonitorData {
  current: GpuStats;
  models: DetectedModels;
  recommendations: string[];
  history: GpuStats[];
}

interface GpuMonitorMessage {
  type: 'gpu_stats' | 'history' | 'ping';
  data?: GpuMonitorData | GpuStats[];
}

class GpuMonitorService {
  private ws: WebSocket | null = null;
  private url = 'ws://localhost:5003';
  private reconnectInterval = 5000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnected = false;
  private isConnecting = false;
  
  // Current state
  private currentStats: GpuStats | null = null;
  private detectedModels: DetectedModels = { llm: [], whisper: [], embedding: [], other: [] };
  private recommendations: string[] = [];
  private history: GpuStats[] = [];
  
  // Callbacks
  private onStatsCallbacks: ((data: GpuMonitorData) => void)[] = [];
  private onConnectCallbacks: (() => void)[] = [];
  private onDisconnectCallbacks: (() => void)[] = [];
  private onErrorCallbacks: ((error: Error) => void)[] = [];

  constructor() {}

  /**
   * Start the GPU monitor connection
   */
  public async start(): Promise<boolean> {
    if (this.isConnected || this.isConnecting) {
      return this.isConnected;
    }

    this.isConnecting = true;
    logger.log('GPU_MONITOR', 'Connecting to GPU Monitor...', 'info');

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        logger.log('GPU_MONITOR', 'Connected to GPU Monitor', 'success');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.onConnectCallbacks.forEach(cb => cb());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: GpuMonitorMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          logger.log('GPU_MONITOR', 'Failed to parse message', 'error');
        }
      };

      this.ws.onclose = () => {
        logger.log('GPU_MONITOR', 'Disconnected from GPU Monitor', 'warning');
        this.isConnected = false;
        this.isConnecting = false;
        this.onDisconnectCallbacks.forEach(cb => cb());
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        logger.log('GPU_MONITOR', 'WebSocket error', 'error');
        this.onErrorCallbacks.forEach(cb => cb(new Error('WebSocket error')));
      };

      return true;
    } catch (error) {
      logger.log('GPU_MONITOR', 'Failed to connect', 'error');
      this.isConnecting = false;
      this.attemptReconnect();
      return false;
    }
  }

  /**
   * Stop the GPU monitor connection
   */
  public stop(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    logger.log('GPU_MONITOR', 'Stopped', 'info');
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.log('GPU_MONITOR', 'Max reconnection attempts reached', 'warning');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 30000);
    
    logger.log('GPU_MONITOR', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`, 'info');
    
    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: GpuMonitorMessage): void {
    switch (message.type) {
      case 'gpu_stats':
        if (message.data && 'current' in message.data) {
          const data = message.data as GpuMonitorData;
          this.currentStats = data.current;
          this.detectedModels = data.models;
          this.recommendations = data.recommendations;
          this.history = data.history;
          
          // Notify all subscribers
          this.onStatsCallbacks.forEach(cb => cb(data));
        }
        break;
        
      case 'history':
        if (Array.isArray(message.data)) {
          this.history = message.data as GpuStats[];
        }
        break;
        
      case 'ping':
        // Keep-alive, no action needed
        break;
    }
  }

  /**
   * Request full history from server
   */
  public requestHistory(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ command: 'get_history' }));
    }
  }

  // ==================== Getters ====================

  /**
   * Get current GPU statistics
   */
  public getCurrentStats(): GpuStats | null {
    return this.currentStats;
  }

  /**
   * Get detected AI models
   */
  public getDetectedModels(): DetectedModels {
    return this.detectedModels;
  }

  /**
   * Get recommendations
   */
  public getRecommendations(): string[] {
    return this.recommendations;
  }

  /**
   * Get history (last 5 minutes)
   */
  public getHistory(): GpuStats[] {
    return this.history;
  }

  /**
   * Check if connected to GPU monitor
   */
  public isActive(): boolean {
    return this.isConnected;
  }

  // ==================== Event Subscriptions ====================

  /**
   * Subscribe to stats updates
   */
  public onStats(callback: (data: GpuMonitorData) => void): () => void {
    this.onStatsCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.onStatsCallbacks.indexOf(callback);
      if (index > -1) {
        this.onStatsCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to connection events
   */
  public onConnect(callback: () => void): () => void {
    this.onConnectCallbacks.push(callback);
    return () => {
      const index = this.onConnectCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to disconnection events
   */
  public onDisconnect(callback: () => void): () => void {
    this.onDisconnectCallbacks.push(callback);
    return () => {
      const index = this.onDisconnectCallbacks.indexOf(callback);
      if (index > -1) {
        this.onDisconnectCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to error events
   */
  public onError(callback: (error: Error) => void): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      const index = this.onErrorCallbacks.indexOf(callback);
      if (index > -1) {
        this.onErrorCallbacks.splice(index, 1);
      }
    };
  }

  // ==================== Utility Methods ====================

  /**
   * Get VRAM usage as formatted string
   */
  public getVramString(): string {
    if (!this.currentStats) return 'Unknown';
    const { vram_used, vram_total, vram_percent } = this.currentStats;
    return `${vram_used} / ${vram_total} MB (${vram_percent}%)`;
  }

  /**
   * Get temperature with color indicator
   */
  public getTemperatureStatus(): { temp: number; status: 'normal' | 'warm' | 'hot' | 'critical' } {
    if (!this.currentStats) return { temp: 0, status: 'normal' };
    
    const temp = this.currentStats.temperature;
    
    if (temp >= 85) return { temp, status: 'critical' };
    if (temp >= 80) return { temp, status: 'hot' };
    if (temp >= 75) return { temp, status: 'warm' };
    return { temp, status: 'normal' };
  }

  /**
   * Check if VRAM is available for a new model
   */
  public canLoadModel(modelSizeMB: number): boolean {
    if (!this.currentStats) return false;
    
    // Leave 1GB headroom
    const availableMB = this.currentStats.vram_free - 1024;
    return availableMB >= modelSizeMB;
  }

  /**
   * Estimate available VRAM for models
   */
  public getAvailableVramForModels(): number {
    if (!this.currentStats) return 0;
    return Math.max(0, this.currentStats.vram_free - 1024); // 1GB headroom
  }

  /**
   * Get total VRAM used by detected models
   */
  public getModelVramUsage(): number {
    let total = 0;
    
    Object.values(this.detectedModels).forEach((processes: GpuProcess[]) => {
      processes.forEach((proc: GpuProcess) => {
        total += proc.vram_mb;
      });
    });
    
    return total;
  }

  // ==================== EventEmitter-compatible Methods ====================

  /**
   * Subscribe to an event (EventEmitter-compatible)
   */
  public on(event: 'stats' | 'connect' | 'disconnect' | 'error', callback: (...args: any[]) => void): void {
    switch (event) {
      case 'stats':
        this.onStatsCallbacks.push(callback as (data: GpuMonitorData) => void);
        break;
      case 'connect':
        this.onConnectCallbacks.push(callback as () => void);
        break;
      case 'disconnect':
        this.onDisconnectCallbacks.push(callback as () => void);
        break;
      case 'error':
        this.onErrorCallbacks.push(callback as (error: Error) => void);
        break;
    }
  }

  /**
   * Unsubscribe from an event (EventEmitter-compatible)
   */
  public off(event: 'stats' | 'connect' | 'disconnect' | 'error', callback: (...args: any[]) => void): void {
    let callbacks: any[];
    switch (event) {
      case 'stats':
        callbacks = this.onStatsCallbacks;
        break;
      case 'connect':
        callbacks = this.onConnectCallbacks;
        break;
      case 'disconnect':
        callbacks = this.onDisconnectCallbacks;
        break;
      case 'error':
        callbacks = this.onErrorCallbacks;
        break;
      default:
        return;
    }
    
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

// Export singleton instance
export const gpuMonitor = new GpuMonitorService();

// Also export class for testing
export { GpuMonitorService };
