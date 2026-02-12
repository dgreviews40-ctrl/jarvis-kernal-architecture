/**
 * Thinking Sounds Service
 * 
 * Provides subtle audio cues during AI processing to avoid awkward silence.
 * Uses Web Audio API to synthesize sounds (no external assets needed).
 * 
 * Features:
 * - Soft breathing sounds during normal processing
 * - "Hmm" sounds when analyzing complex queries
 * - Subtle click/acknowledgment sounds for quick responses
 * - Configurable volume and enabled/disabled states
 */

import { FEATURES } from '../constants/config';
import { logger } from './logger';

// Sound types available
export type ThinkingSoundType = 'breathing' | 'hmm' | 'click' | 'processing';

// Configuration
interface ThinkingSoundsConfig {
  enabled: boolean;
  masterVolume: number; // 0.0 - 1.0
  breathingVolume: number;
  hmmVolume: number;
  clickVolume: number;
  processingVolume: number;
  breathingIntervalMs: number; // How often to play breathing during long operations
  maxDurationMs: number; // Maximum time to play sounds
}

const DEFAULT_CONFIG: ThinkingSoundsConfig = {
  enabled: true,
  masterVolume: 0.15, // Quiet by default (15%)
  breathingVolume: 0.8,
  hmmVolume: 1.0,
  clickVolume: 0.6,
  processingVolume: 0.7,
  breathingIntervalMs: 4000, // Every 4 seconds
  maxDurationMs: 30000, // Max 30 seconds
};

/**
 * Thinking Sounds Service
 * Manages subtle audio feedback during AI processing
 */
class ThinkingSoundsService {
  private config: ThinkingSoundsConfig = { ...DEFAULT_CONFIG };
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private breathingInterval: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentGainNode: GainNode | null = null;
  private activeSources: Set<AudioNode> = new Set();

  constructor() {
    this.loadConfig();
  }

  // ============ Configuration ============

  /**
   * Check if thinking sounds are enabled
   */
  public get isEnabled(): boolean {
    return FEATURES.ENABLE_THINKING_SOUNDS && this.config.enabled;
  }

  /**
   * Get current configuration
   */
  public getConfig(): ThinkingSoundsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<ThinkingSoundsConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Enable thinking sounds
   */
  public enable(): void {
    this.config.enabled = true;
    this.saveConfig();
    logger.log('SYSTEM', 'Thinking sounds enabled', 'info');
  }

  /**
   * Disable thinking sounds
   */
  public disable(): void {
    this.config.enabled = false;
    this.stop();
    this.saveConfig();
    logger.log('SYSTEM', 'Thinking sounds disabled', 'info');
  }

  /**
   * Set master volume (0.0 - 1.0)
   */
  public setVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
  }

  // ============ Sound Playback ============

  /**
   * Start playing thinking sounds
   * @param type - Type of sound to play
   * @param durationMs - How long to play (defaults to config max)
   */
  public start(type: ThinkingSoundType = 'breathing', durationMs?: number): void {
    if (!this.isEnabled) return;
    if (this.isPlaying) this.stop();

    const duration = durationMs || this.config.maxDurationMs;
    
    try {
      this.ensureAudioContext();
      if (!this.audioContext) return;

      this.isPlaying = true;
      
      // Play initial sound
      this.playSound(type);

      // Set up breathing interval for longer operations
      if (type === 'breathing' || type === 'processing') {
        this.breathingInterval = setInterval(() => {
          if (this.isPlaying) {
            this.playSound('breathing');
          }
        }, this.config.breathingIntervalMs);
      }

      // Auto-stop after max duration
      this.maxDurationTimeout = setTimeout(() => {
        this.stop();
      }, duration);

      logger.log('SYSTEM', `Started ${type} sounds`, 'info');
    } catch (error) {
      logger.log('SYSTEM', `Failed to start sounds: ${error}`, 'error');
    }
  }

  /**
   * Stop all thinking sounds
   */
  public stop(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Clear timers
    if (this.breathingInterval) {
      clearInterval(this.breathingInterval);
      this.breathingInterval = null;
    }
    if (this.maxDurationTimeout) {
      clearTimeout(this.maxDurationTimeout);
      this.maxDurationTimeout = null;
    }

    // Fade out and stop all active sources
    this.fadeOutAndStop();

    logger.log('SYSTEM', 'Stopped thinking sounds', 'info');
  }

  /**
   * Play a single sound (one-shot)
   */
  public play(type: ThinkingSoundType): void {
    if (!this.isEnabled) return;
    
    try {
      this.ensureAudioContext();
      if (!this.audioContext) return;
      
      this.playSound(type);
    } catch (error) {
      logger.log('SYSTEM', `Failed to play sound: ${error}`, 'error');
    }
  }

  // ============ Private Sound Generation ============

  private playSound(type: ThinkingSoundType): void {
    if (!this.audioContext) return;

    switch (type) {
      case 'breathing':
        this.playBreathingSound();
        break;
      case 'hmm':
        this.playHmmSound();
        break;
      case 'click':
        this.playClickSound();
        break;
      case 'processing':
        this.playProcessingSound();
        break;
    }
  }

  /**
   * Play a soft breathing sound
   * Synthesized using filtered noise
   */
  private playBreathingSound(): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const volume = this.config.masterVolume * this.config.breathingVolume;

    // Create noise buffer for breath sound
    const bufferSize = ctx.sampleRate * 0.8; // 800ms breath
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate pink-ish noise
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain
    }

    // Create noise source
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to make it sound like breath (lowpass)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    // Gain envelope for natural breath shape
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.5, ctx.currentTime + 0.4);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    // Connect
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play
    noise.start();
    noise.stop(ctx.currentTime + 0.8);

    // Track for cleanup
    this.activeSources.add(noise);
    noise.onended = () => {
      this.activeSources.delete(noise);
      filter.disconnect();
      gainNode.disconnect();
    };
  }

  /**
   * Play a "hmm" thinking sound
   * Synthesized using oscillator
   */
  private playHmmSound(): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const volume = this.config.masterVolume * this.config.hmmVolume;

    // Fundamental frequency
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);

    // Add harmonics for vocal quality
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(300, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.3);

    // Gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.5, ctx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(volume * 0.5, ctx.currentTime + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    // Filter for "muffled" hmm sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    // Connect
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.35);

    // Track
    this.activeSources.add(osc);
    this.activeSources.add(osc2);
    
    const cleanup = () => {
      this.activeSources.delete(osc);
      this.activeSources.delete(osc2);
      filter.disconnect();
      gainNode.disconnect();
    };
    osc.onended = cleanup;
  }

  /**
   * Play a subtle click/acknowledgment sound
   */
  private playClickSound(): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const volume = this.config.masterVolume * this.config.clickVolume;

    // Short sine burst
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);

    this.activeSources.add(osc);
    osc.onended = () => {
      this.activeSources.delete(osc);
      gainNode.disconnect();
    };
  }

  /**
   * Play a processing/activity sound
   * Subtle electronic "working" sound
   */
  private playProcessingSound(): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const volume = this.config.masterVolume * this.config.processingVolume;

    // Low frequency pulse
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.2, ctx.currentTime + 0.1);
    
    // Add subtle modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4; // 4Hz modulation
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = volume * 0.1;

    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    // Filter for softer sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    lfo.start();

    // Stop after 500ms
    osc.stop(ctx.currentTime + 0.5);
    lfo.stop(ctx.currentTime + 0.5);

    this.activeSources.add(osc);
    osc.onended = () => {
      this.activeSources.delete(osc);
      lfo.disconnect();
      filter.disconnect();
      gainNode.disconnect();
    };
  }

  // ============ Utility ============

  private ensureAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  private fadeOutAndStop(): void {
    if (!this.audioContext) return;

    // Fade out over 100ms
    this.activeSources.forEach(source => {
      try {
        if ((source as any).gain) {
          const gainNode = (source as any).gain as GainNode;
          gainNode.gain.cancelScheduledValues(this.audioContext!.currentTime);
          gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1);
        }
      } catch {
        // Ignore errors during cleanup
      }
    });

    // Clear after fade
    setTimeout(() => {
      this.activeSources.clear();
    }, 150);
  }

  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('jarvis_thinking_sounds_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Use defaults
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('jarvis_thinking_sounds_config', JSON.stringify(this.config));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get service status
   */
  public getStatus(): {
    enabled: boolean;
    isPlaying: boolean;
    activeSources: number;
    volume: number;
  } {
    return {
      enabled: this.isEnabled,
      isPlaying: this.isPlaying,
      activeSources: this.activeSources.size,
      volume: this.config.masterVolume,
    };
  }
}

// Pink noise helper state
let lastOut = 0;

// Export singleton
export const thinkingSounds = new ThinkingSoundsService();
export default thinkingSounds;
