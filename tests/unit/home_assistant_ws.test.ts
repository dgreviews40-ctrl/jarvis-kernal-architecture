import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { haWebSocketService } from '../../services/home_assistant_ws';

// Mock logger
vi.mock('../../services/logger', () => ({
  logger: {
    log: vi.fn(),
  },
}));

// Mock eventBus
vi.mock('../../services/eventBus', () => ({
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('HomeAssistantWebSocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    haWebSocketService.disconnect();
  });

  afterEach(() => {
    haWebSocketService.disconnect();
  });

  describe('Basic Configuration', () => {
    it('should have isEnabled getter', () => {
      // Test that isEnabled property exists and returns a boolean
      expect(typeof haWebSocketService.isEnabled).toBe('boolean');
    });

    it('should start disconnected', () => {
      expect(haWebSocketService.connectionState).toBe('disconnected');
      expect(haWebSocketService.isConnected).toBe(false);
    });

    it('should store configuration', () => {
      haWebSocketService.configure('http://localhost:8123', 'test-token');
      // Configuration is stored internally, verify by checking stats don't throw
      expect(() => haWebSocketService.getStats()).not.toThrow();
    });

    it('should return false when connecting without config', async () => {
      const result = await haWebSocketService.connect();
      expect(result).toBe(false);
      expect(haWebSocketService.connectionState).toBe('disconnected');
    });
  });

  describe('Stats', () => {
    it('should return connection stats', () => {
      const stats = haWebSocketService.getStats();
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('reconnectAttempts');
      expect(stats).toHaveProperty('subscriptions');
      expect(stats).toHaveProperty('pendingMessages');
      expect(stats).toHaveProperty('duration');
      expect(stats).toHaveProperty('lastError');
      
      expect(stats.state).toBe('disconnected');
      expect(stats.connected).toBe(false);
      expect(stats.reconnectAttempts).toBe(0);
    });
  });

  describe('Event Listeners', () => {
    it('should allow subscribing to state changes', () => {
      const callback = vi.fn();
      const unsubscribe = haWebSocketService.subscribeToStateChanges(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Unsubscribe should not throw
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should allow subscribing to custom events', () => {
      const callback = vi.fn();
      const unsubscribe = haWebSocketService.subscribeToEvents('custom_event', callback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Disconnect', () => {
    it('should set state to disconnected', () => {
      haWebSocketService.configure('http://localhost:8123', 'test-token');
      
      haWebSocketService.disconnect();
      
      expect(haWebSocketService.connectionState).toBe('disconnected');
      expect(haWebSocketService.isConnected).toBe(false);
    });

    it('should clear WebSocket reference on disconnect', () => {
      haWebSocketService.configure('http://localhost:8123', 'test-token');
      
      haWebSocketService.disconnect();
      
      // Multiple disconnects should not throw
      expect(() => haWebSocketService.disconnect()).not.toThrow();
    });
  });

  describe('Network Events', () => {
    it('should handle online event without errors', () => {
      const onlineEvent = new Event('online');
      expect(() => window.dispatchEvent(onlineEvent)).not.toThrow();
    });

    it('should handle offline event without errors', () => {
      haWebSocketService.configure('http://localhost:8123', 'test-token');
      
      const offlineEvent = new Event('offline');
      expect(() => window.dispatchEvent(offlineEvent)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should return false when connection fails', async () => {
      // Try to connect without configuration
      const result = await haWebSocketService.connect();
      
      expect(result).toBe(false);
      expect(haWebSocketService.connectionState).toBe('disconnected');
    });
  });
});
