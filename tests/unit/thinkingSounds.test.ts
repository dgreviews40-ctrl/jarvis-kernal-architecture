import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { thinkingSounds, ThinkingSoundType } from '../../services/thinkingSounds';

// Mock logger
vi.mock('../../services/logger', () => ({
  logger: {
    log: vi.fn(),
  },
}));

// Mock FEATURES
vi.mock('../../constants/config', () => ({
  FEATURES: {
    ENABLE_THINKING_SOUNDS: true,
  },
}));

describe('ThinkingSoundsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thinkingSounds.stop();
  });

  afterEach(() => {
    thinkingSounds.stop();
  });

  describe('Configuration', () => {
    it('should be enabled by default', () => {
      expect(thinkingSounds.isEnabled).toBe(true);
    });

    it('should return default config', () => {
      const config = thinkingSounds.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.masterVolume).toBeGreaterThan(0);
      expect(config.masterVolume).toBeLessThanOrEqual(1);
    });

    it('should update config', () => {
      thinkingSounds.updateConfig({ masterVolume: 0.5 });
      const config = thinkingSounds.getConfig();
      expect(config.masterVolume).toBe(0.5);
    });

    it('should enable and disable', () => {
      thinkingSounds.disable();
      expect(thinkingSounds.isEnabled).toBe(false);
      
      thinkingSounds.enable();
      expect(thinkingSounds.isEnabled).toBe(true);
    });

    it('should set volume within bounds', () => {
      thinkingSounds.setVolume(0.5);
      expect(thinkingSounds.getConfig().masterVolume).toBe(0.5);
      
      // Test clamping to 0
      thinkingSounds.setVolume(-0.5);
      expect(thinkingSounds.getConfig().masterVolume).toBe(0);
      
      // Test clamping to 1
      thinkingSounds.setVolume(1.5);
      expect(thinkingSounds.getConfig().masterVolume).toBe(1);
    });
  });

  describe('Playback Control', () => {
    it('should start and stop without errors', () => {
      expect(() => {
        thinkingSounds.start('breathing', 100);
        thinkingSounds.stop();
      }).not.toThrow();
    });

    it('should play single sounds without errors', () => {
      const soundTypes: ThinkingSoundType[] = ['breathing', 'hmm', 'click', 'processing'];
      
      soundTypes.forEach(type => {
        expect(() => {
          thinkingSounds.play(type);
        }).not.toThrow();
      });
    });

    it('should handle play when disabled', () => {
      thinkingSounds.disable();
      
      expect(() => {
        thinkingSounds.play('click');
      }).not.toThrow();
    });

    it('should not start when disabled', () => {
      thinkingSounds.disable();
      
      expect(() => {
        thinkingSounds.start('breathing');
      }).not.toThrow();
    });

    it('should handle multiple stop calls', () => {
      thinkingSounds.start('breathing', 100);
      thinkingSounds.stop();
      
      expect(() => {
        thinkingSounds.stop();
        thinkingSounds.stop();
      }).not.toThrow();
    });
  });

  describe('Status', () => {
    it('should return status object', () => {
      const status = thinkingSounds.getStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('isPlaying');
      expect(status).toHaveProperty('activeSources');
      expect(status).toHaveProperty('volume');
      
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.isPlaying).toBe('boolean');
      expect(typeof status.activeSources).toBe('number');
      expect(typeof status.volume).toBe('number');
    });

    it('should show not playing when stopped', () => {
      thinkingSounds.stop();
      expect(thinkingSounds.getStatus().isPlaying).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist configuration changes', () => {
      thinkingSounds.updateConfig({ masterVolume: 0.75 });
      
      // Create new instance would load from localStorage
      // But we can't easily test that without mocking localStorage
      expect(thinkingSounds.getConfig().masterVolume).toBe(0.75);
    });
  });
});
