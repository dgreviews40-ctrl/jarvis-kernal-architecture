/**
 * Voice Streaming Service v1.1
 * Token-level TTS synchronization for real-time responses
 * 
 * Features:
 * - Streams TTS while AI is still generating tokens
 * - Smart sentence boundary detection
 * - Overlapping generation and playback
 * - Configurable buffer size and flush triggers
 */

import { piperTTS } from './piperTTS';
import { voice } from './voice';
import { logger } from './logger';

export interface StreamingTTSConfig {
  /** Minimum characters before speaking (default: 80) */
  minBufferSize: number;
  /** Maximum characters to buffer (default: 300) */
  maxBufferSize: number;
  /** Sentence delimiters that trigger immediate speech */
  sentenceDelimiters: string[];
  /** Enable overlapping generation/playback */
  enableOverlap: boolean;
  /** Delay between chunks in ms (default: 50) */
  chunkDelayMs: number;
  /** Voice type to use */
  voiceType: 'SYSTEM' | 'PIPER' | 'GEMINI';
}

export interface StreamingSession {
  id: string;
  buffer: string;
  isSpeaking: boolean;
  isComplete: boolean;
  finalized?: boolean;
  firstSpeechTime?: number;
  tokensReceived: number;
  tokensSpoken: number;
  startTime: number;
  lastTokenTime: number;
}

export interface StreamingMetrics {
  sessionId: string;
  timeToFirstSpeech: number;
  totalLatency: number;
  tokensReceived: number;
  tokensSpoken: number;
  efficiency: number; // tokens spoken / total time
}

const DEFAULT_CONFIG: StreamingTTSConfig = {
  minBufferSize: 80,
  maxBufferSize: 300,
  sentenceDelimiters: ['.', '!', '?', '\n', '...', '—'],
  enableOverlap: true,
  chunkDelayMs: 50,
  voiceType: 'PIPER'
};

class VoiceStreamingService {
  private config: StreamingTTSConfig = { ...DEFAULT_CONFIG };
  private activeSession: StreamingSession | null = null;
  private speechQueue: string[] = [];
  private isProcessingQueue: boolean = false;
  private onCompleteCallbacks: (() => void)[] = [];
  private metrics: StreamingMetrics[] = [];
  private finalized: boolean = false;

  constructor() {
    // Load saved config
    if (typeof window === 'undefined' || !window.localStorage) return;
    const saved = localStorage.getItem('jarvis_streaming_tts_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('[STREAMING_TTS] Failed to parse saved config:', e);
      }
    }
  }

  /**
   * Update streaming configuration
   */
  public setConfig(config: Partial<StreamingTTSConfig>): void {
    this.config = { ...this.config, ...config };
    localStorage.setItem('jarvis_streaming_tts_config', JSON.stringify(this.config));
  }

  public getConfig(): StreamingTTSConfig {
    return { ...this.config };
  }

  /**
   * Start a new streaming TTS session
   */
  public startSession(voiceType?: 'SYSTEM' | 'PIPER' | 'GEMINI'): string {
    // End any existing session
    if (this.activeSession) {
      this.endSession();
    }

    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeSession = {
      id: sessionId,
      buffer: '',
      isSpeaking: false,
      isComplete: false,
      finalized: false,
      firstSpeechTime: undefined,
      tokensReceived: 0,
      tokensSpoken: 0,
      startTime: performance.now(),
      lastTokenTime: performance.now()
    };

    this.speechQueue = [];
    this.isProcessingQueue = false;
    this.finalized = false;

    if (voiceType) {
      this.config.voiceType = voiceType;
    }

    logger.log('SYSTEM', `[STREAMING_TTS] Started session ${sessionId}`, 'info');
    return sessionId;
  }

  /**
   * Receive a token from the AI stream
   * Returns true if the token triggered speech
   */
  public onToken(token: string): boolean {
    if (!this.activeSession) {
      console.warn('[STREAMING_TTS] No active session, ignoring token');
      return false;
    }

    const session = this.activeSession;
    session.tokensReceived += token.length;
    session.lastTokenTime = performance.now();
    session.buffer += token;

    // Check if we should flush the buffer
    const shouldFlush = this.shouldFlushBuffer(session.buffer);
    
    if (shouldFlush) {
      this.flushBuffer();
      return true;
    }

    return false;
  }

  /**
   * Determine if buffer should be flushed to TTS
   */
  private shouldFlushBuffer(buffer: string): boolean {
    // Always flush if we hit max buffer size
    if (buffer.length >= this.config.maxBufferSize) {
      return true;
    }

    // Don't flush if below minimum
    if (buffer.length < this.config.minBufferSize) {
      return false;
    }

    // Check for sentence delimiters
    const lastChars = buffer.slice(-10);
    return this.config.sentenceDelimiters.some(delim => lastChars.includes(delim));
  }

  /**
   * Find the best split point in the buffer
   */
  private findSplitPoint(text: string): number {
    // Look for sentence delimiters from the end
    for (let i = text.length - 1; i >= 0; i--) {
      if (this.config.sentenceDelimiters.includes(text[i])) {
        return i + 1;
      }
    }
    
    // If no delimiter found, look for comma or space
    const lastComma = text.lastIndexOf(',', text.length - 20);
    if (lastComma > this.config.minBufferSize) {
      return lastComma + 1;
    }

    const lastSpace = text.lastIndexOf(' ', text.length - 20);
    if (lastSpace > this.config.minBufferSize) {
      return lastSpace + 1;
    }

    // Fall back to max buffer size
    return Math.min(text.length, this.config.maxBufferSize);
  }

  /**
   * Flush the current buffer to speech queue
   */
  private flushBuffer(): void {
    if (!this.activeSession || this.activeSession.buffer.length === 0) return;

    const session = this.activeSession;
    const splitPoint = this.findSplitPoint(session.buffer);
    
    const toSpeak = session.buffer.slice(0, splitPoint).trim();
    const remainder = session.buffer.slice(splitPoint).trim();

    if (toSpeak.length > 0) {
      this.speechQueue.push(toSpeak);
      session.tokensSpoken += toSpeak.length;
      
      // Process queue asynchronously
      this.processQueue();
    }

    // Keep remainder for next flush
    session.buffer = remainder;
  }

  /**
   * Process the speech queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.speechQueue.length > 0) {
      const text = this.speechQueue.shift();
      if (!text) continue;

      if (this.activeSession) {
        this.activeSession.isSpeaking = true;
        // Track first speech time for accurate metrics
        if (!this.activeSession.firstSpeechTime) {
          this.activeSession.firstSpeechTime = performance.now();
        }
      }

      try {
        await this.speakText(text);
      } catch (e) {
        console.error('[STREAMING_TTS] Speech error:', e);
      }

      // Small delay between chunks for natural pauses
      if (this.speechQueue.length > 0) {
        await this.delay(this.config.chunkDelayMs);
      }
    }

    this.isProcessingQueue = false;

    if (this.activeSession) {
      this.activeSession.isSpeaking = false;
      
      // If session is complete and buffer is empty, finalize
      if (this.activeSession.isComplete && this.activeSession.buffer.length === 0) {
        this.finalizeSession();
      }
    }
  }

  /**
   * Speak a single text chunk
   */
  private async speakText(text: string): Promise<void> {
    switch (this.config.voiceType) {
      case 'PIPER':
        await this.speakWithPiper(text);
        break;
      case 'GEMINI':
        await this.speakWithGemini(text);
        break;
      case 'SYSTEM':
      default:
        await this.speakWithSystem(text);
        break;
    }
  }

  private async speakWithPiper(text: string): Promise<void> {
    return new Promise((resolve) => {
      piperTTS.speak(text, () => resolve()).then(success => {
        if (!success) {
          // Fallback to system voice
          voice.speak(text).then(() => resolve()).catch(() => resolve());
        }
      }).catch(() => {
        // Fallback to system voice
        voice.speak(text).then(() => resolve()).catch(() => resolve());
      });
    });
  }

  private async speakWithGemini(text: string): Promise<void> {
    // For now, use the main voice service which handles Gemini
    return new Promise((resolve) => {
      voice.speak(text).then(() => resolve()).catch(() => resolve());
    });
  }

  private async speakWithSystem(text: string): Promise<void> {
    return new Promise((resolve) => {
      voice.speak(text).then(() => resolve()).catch(() => resolve());
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mark the session as complete (all tokens received)
   * This flushes any remaining buffer
   */
  public async endSession(): Promise<StreamingMetrics | null> {
    if (!this.activeSession || this.finalized) return null;

    this.activeSession.isComplete = true;
    
    // Flush any remaining content
    if (this.activeSession.buffer.length > 0) {
      const remaining = this.activeSession.buffer.trim();
      if (remaining.length > 0) {
        this.speechQueue.push(remaining);
        this.activeSession.tokensSpoken += remaining.length;
        await this.processQueue();
      }
    }

    // Wait for queue to drain
    let attempts = 0;
    while ((this.isProcessingQueue || this.speechQueue.length > 0) && attempts < 100) {
      await this.delay(50);
      attempts++;
    }

    return this.finalizeSession();
  }

  /**
   * Finalize the session and calculate metrics
   */
  private finalizeSession(): StreamingMetrics | null {
    if (!this.activeSession || this.finalized) return null;
    
    this.finalized = true;
    const metrics = this.calculateMetrics();
    this.metrics.push(metrics);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    logger.log('SYSTEM', `[STREAMING_TTS] Session ${this.activeSession.id} complete`, 'info');
    
    this.activeSession = null;
    
    // Notify completion
    this.onCompleteCallbacks.forEach(cb => cb());
    
    return metrics;
  }

  /**
   * Calculate current session metrics
   */
  private calculateMetrics(): StreamingMetrics {
    if (!this.activeSession) {
      return {
        sessionId: 'unknown',
        timeToFirstSpeech: 0,
        totalLatency: 0,
        tokensReceived: 0,
        tokensSpoken: 0,
        efficiency: 0
      };
    }

    const session = this.activeSession;
    const now = performance.now();
    const totalTime = now - session.startTime;

    const timeToFirstSpeech = session.firstSpeechTime 
      ? session.firstSpeechTime - session.startTime 
      : 0;

    return {
      sessionId: session.id,
      timeToFirstSpeech,
      totalLatency: totalTime,
      tokensReceived: session.tokensReceived,
      tokensSpoken: session.tokensSpoken,
      efficiency: totalTime > 0 ? session.tokensSpoken / totalTime : 0
    };
  }

  /**
   * Get current session info
   */
  public getSession(): StreamingSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  /**
   * Check if currently streaming
   */
  public isStreaming(): boolean {
    return this.activeSession !== null;
  }

  /**
   * Check if currently speaking
   */
  public isSpeaking(): boolean {
    return this.activeSession?.isSpeaking || this.isProcessingQueue;
  }

  /**
   * Get recent metrics
   */
  public getMetrics(count: number = 10): StreamingMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get average performance stats
   */
  public getAverageStats() {
    if (this.metrics.length === 0) {
      return {
        avgTimeToFirstSpeech: 0,
        avgTotalLatency: 0,
        avgEfficiency: 0,
        totalSessions: 0
      };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      avgTimeToFirstSpeech: avg(this.metrics.map(m => m.timeToFirstSpeech)),
      avgTotalLatency: avg(this.metrics.map(m => m.totalLatency)),
      avgEfficiency: avg(this.metrics.map(m => m.efficiency)),
      totalSessions: this.metrics.length
    };
  }

  /**
   * Subscribe to completion events
   */
  public onComplete(callback: () => void): () => void {
    this.onCompleteCallbacks.push(callback);
    return () => {
      this.onCompleteCallbacks = this.onCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Abort the current session
   */
  public abort(): void {
    if (this.activeSession) {
      logger.log('SYSTEM', `[STREAMING_TTS] Session ${this.activeSession.id} aborted`, 'info');
      this.activeSession = null;
      this.speechQueue = [];
      this.isProcessingQueue = false;
      voice.interrupt();
    }
  }

  /**
   * Reset all state
   */
  public reset(): void {
    this.abort();
    this.metrics = [];
    this.onCompleteCallbacks = [];
  }
}

// Export singleton instance
export const voiceStreaming = new VoiceStreamingService();
export default voiceStreaming;
