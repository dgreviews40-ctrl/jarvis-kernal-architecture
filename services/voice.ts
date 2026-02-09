/**
 * Optimized Voice Service
 * Features: VAD, audio compression, connection pooling, and efficient streaming
 */

import { VoiceState, VoiceConfig, VoiceType, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types";
import { conversation } from "./conversation";
import { GoogleGenAI, Modality } from "@google/genai";
import { geminiRateLimiter } from "./rateLimiter";
import { piperTTS } from "./piperTTS";
import { piperLauncher } from "./piperLauncher";
import { optimizer } from "./performance";
import { inputValidator } from "./inputValidator";
import { whisperSTT } from "./whisperSTT";
import { voiceStreaming } from "./voiceStreaming";
import EnhancedTTSService, { enhancedTTS } from "./enhancedTTS";

const DEFAULT_CONFIG: VoiceConfig = {
  wakeWord: "jarvis",
  voiceType: 'SYSTEM',
  voiceName: 'Kore',
  rate: 1.0,
  pitch: 1.0,
  sttProvider: 'AUTO' // Default to auto (try Whisper first, fallback to browser)
};

// Audio processing constants - IMPROVED for better wake word detection
const AUDIO_BUFFER_SIZE = 2048; // Reduced for faster processing
const VAD_THRESHOLD = 0.012; // Lowered from 0.015 to catch quieter speech/wake words
const VAD_SILENCE_TIMEOUT = 1200; // Increased from 800ms - gives more time for wake word detection
const VAD_SPEECH_TIMEOUT = 10000; // max speech duration
const VAD_MIN_SPEECH_DURATION = 300; // Minimum speech before processing (ms)

function decodeBase64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

class VoiceCoreOptimized {
  // FIXED: Use any to avoid TypeScript narrowing issues with Web Speech API
  private recognition: any = null;
  private synthesis: SpeechSynthesis = window.speechSynthesis;
  private state: VoiceState = VoiceState.MUTED;
  private config: VoiceConfig = { ...DEFAULT_CONFIG };
  private observers: ((state: VoiceState) => void)[] = [];
  private transcriptObservers: ((text: string, isFinal: boolean) => void)[] = [];
  private onCommandCallback: ((text: string) => void) | null = null;

  // Optimized state management
  private restartTimer: number | null = null;
  private errorCount: number = 0;
  private networkErrorCount: number = 0;
  private audioContext: AudioContext | null = null;
  private isRestarting: boolean = false;
  private sessionStartTime: number = 0;
  private lastManualActivation: number = 0;
  private hasProcessedSpeech: boolean = false;
  private consecutiveShortSessions: number = 0;

  // VAD (Voice Activity Detection)
  private vadAnalyser: AnalyserNode | null = null;
  private vadInterval: number | null = null;
  private isSpeaking: boolean = false;
  private silenceStartTime: number = 0;
  private speechStartTime: number = 0;

  // NEW: Flags to prevent audio feedback loop and duplicate processing
  private isCurrentlySpeaking: boolean = false;
  private lastSpokenText: string = '';
  private lastSpokenTimestamp: number = 0;

  // Audio queue for smooth playback
  private audioQueue: AudioBuffer[] = [];

  // Wake word detection timing - IMPROVED
  private wakeWordDetectedTime: number = 0;
  private readonly WAKE_WORD_GRACE_PERIOD = 10000; // 10 seconds to give command after wake word (more comfortable)

  // NEW: Response preloading
  private preloadedResponse: string | null = null;
  private isPlayingAudio: boolean = false;

  // Pre-initialized audio context pool - FIXED: dynamic pool with recovery
  private audioContextPool: AudioContext[] = [];
  private maxAudioContexts = 3; // Increased from 2 to handle concurrent operations
  private activeAudioContexts: Set<AudioContext> = new Set(); // Track contexts in use
  private poolExhaustionCount = 0; // Track how often pool exhausts for telemetry
  private lastPoolRecoveryAttempt = 0;
  private readonly POOL_RECOVERY_COOLDOWN = 1000; // ms between recovery attempts
  private readonly CONTEXT_IDLE_TIMEOUT = 30000; // Auto-close idle contexts after 30s
  private contextIdleTimers: Map<AudioContext, number> = new Map();

  // Whisper fallback
  private useWhisperFallback: boolean = false;
  private whisperAvailable: boolean = false;

  // Duplicate command prevention
  private lastProcessedText: string = '';
  private lastProcessedTime: number = 0;
  private recentCommands: {text: string, timestamp: number}[] = [];

  // Additional duplicate prevention for voice commands
  private voiceCommandHashes: Map<string, number> = new Map(); // Map of hash -> timestamp
  private readonly DUPLICATE_COMMAND_WINDOW = 5000; // 5 seconds

  // Web Worker for wake word detection
  private wakeWordWorker: Worker | null = null;

  constructor() {
    const saved = localStorage.getItem('jarvis_voice_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('[VOICE] Failed to parse saved voice config:', e);
      }
    }

    // Initialize the Web Worker for wake word detection
    try {
      // Dynamically import the worker
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data } = e.data;

          switch(type) {
            case 'calculateLevenshtein':
              const { str1, str2 } = data;
              const distance = calculateLevenshteinDistance(str1, str2);
              self.postMessage({ type: 'levenshteinResult', result: distance });
              break;

            case 'detectWakeWord':
              const { transcript, wakeWord } = data;
              const detected = detectWakeWordWithFuzzyMatching(transcript, wakeWord);
              self.postMessage({ type: 'wakeWordResult', result: detected });
              break;

            default:
              console.warn('Unknown message type received by worker:', type);
          }
        };

        function calculateLevenshteinDistance(a, b) {
          const matrix = [];

          for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
          }

          for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
          }

          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j] + 1
                );
              }
            }
          }

          return matrix[b.length][a.length];
        }

        function detectWakeWordWithFuzzyMatching(transcript, wakeWord) {
          const lowerTranscript = transcript.toLowerCase().trim();
          const lowerWakeWord = wakeWord.toLowerCase();

          // Exact matches - avoid duplicates
          if (lowerTranscript.includes('jarvis')) return true;
          if (lowerTranscript.includes(lowerWakeWord)) return true;

          // Common transcription variations of "Jarvis"
          const variations = [
            'jarves', 'jarvice', 'jarviss', 'jarvess', 'jarviz',
            'jarvus', 'jarv', 'jarvish', 'jervis', 'jerviss',
            'garvis', 'garves', 'carvis', 'charvis', 'jarveis',
            'jarvies'
          ];

          for (const variation of variations) {
            if (lowerTranscript.includes(variation)) {
              return true;
            }
          }

          // Phonetic similarity check for close matches (Levenshtein distance <= 2)
          const words = lowerTranscript.split(/\\s+/);
          for (const word of words) {
            if (word.length >= 4 && word.length <= 8) {
              // Check similarity to the wake word
              const distance = calculateLevenshteinDistance(word, 'jarvis');
              if (distance <= 2) {
                return true;
              }
            }
          }

          return false;
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      try {
        this.wakeWordWorker = new Worker(blobUrl);
      } finally {
        // Always revoke the blob URL to prevent memory leak
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.warn('[VOICE] Web Worker not supported, using main thread for wake word detection:', error);
    }

    // Initialize enhanced TTS with JARVIS-specific settings
    enhancedTTS.updateConfig({
      rate: 0.80,  // Slower for better clarity and more natural flow
      pitch: 1.05, // Slightly higher for friendliness
      intonationVariation: 0.6,  // Higher variation for more natural feel
      stressLevel: 0.4,          // Slightly lower emphasis to reduce choppy feeling
      rhythmVariation: 0.5,      // Higher timing variations for smoother flow
      baseTone: 'professional',  // Professional but friendly tone
      emotionalRange: 0.5,       // Slightly higher emotional expression
      ssmlSupported: false       // Disable SSML tags to prevent literal reading
    });

    // Pre-initialize audio contexts
    this.initAudioContextPool();
  }

  private initAudioContextPool(): void {
    // Create initial contexts but don't exceed browser limits
    const initialCount = Math.min(2, this.maxAudioContexts);
    for (let i = 0; i < initialCount; i++) {
      this.createAudioContextForPool();
    }
  }

  private createAudioContextForPool(): AudioContext | null {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      
      // Mark as available by default
      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'closed') {
          // Remove from pool and active sets when closed
          const poolIndex = this.audioContextPool.indexOf(ctx);
          if (poolIndex > -1) {
            this.audioContextPool.splice(poolIndex, 1);
          }
          this.activeAudioContexts.delete(ctx);
          this.clearIdleTimer(ctx);
        }
      });
      
      this.audioContextPool.push(ctx);
      return ctx;
    } catch (e) {
      console.warn('[VOICE] Failed to create audio context:', e);
      return null;
    }
  }

  private clearIdleTimer(ctx: AudioContext): void {
    const timer = this.contextIdleTimers.get(ctx);
    if (timer) {
      clearTimeout(timer);
      this.contextIdleTimers.delete(ctx);
    }
  }

  private startIdleTimer(ctx: AudioContext): void {
    this.clearIdleTimer(ctx);
    const timer = window.setTimeout(() => {
      // Close idle context to free resources
      if (ctx.state !== 'closed' && !this.activeAudioContexts.has(ctx)) {
        ctx.close().catch(() => {});
      }
      this.contextIdleTimers.delete(ctx);
    }, this.CONTEXT_IDLE_TIMEOUT);
    this.contextIdleTimers.set(ctx, timer);
  }

  private async recoverClosedContexts(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPoolRecoveryAttempt < this.POOL_RECOVERY_COOLDOWN) {
      return; // Prevent rapid recovery attempts
    }
    this.lastPoolRecoveryAttempt = now;

    // Remove closed contexts from pool
    this.audioContextPool = this.audioContextPool.filter(ctx => ctx.state !== 'closed');
    
    // Create new contexts to maintain minimum pool size
    while (this.audioContextPool.length < 2) {
      if (!this.createAudioContextForPool()) {
        break; // Browser limit reached
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    // First, try to find an available context (suspended = available, running = in use)
    for (const ctx of this.audioContextPool) {
      if (ctx.state === 'suspended' && !this.activeAudioContexts.has(ctx)) {
        this.activeAudioContexts.add(ctx);
        this.clearIdleTimer(ctx);
        return ctx;
      }
    }

    // Try to resume a suspended context that's marked as active (stale state)
    for (const ctx of this.audioContextPool) {
      if (ctx.state === 'suspended' && this.activeAudioContexts.has(ctx)) {
        // Context was marked active but may be stale - reuse it
        this.activeAudioContexts.delete(ctx); // Clear stale marker
        this.activeAudioContexts.add(ctx); // Mark as fresh
        this.clearIdleTimer(ctx);
        return ctx;
      }
    }

    // Create new if pool not at max capacity
    if (this.audioContextPool.length < this.maxAudioContexts) {
      const newCtx = this.createAudioContextForPool();
      if (newCtx) {
        this.activeAudioContexts.add(newCtx);
        return newCtx;
      }
    }

    // Pool exhausted - try recovery
    this.poolExhaustionCount++;
    console.warn(`[VOICE] Audio context pool exhausted (count: ${this.poolExhaustionCount})`);
    
    // Attempt to recover by cleaning up closed contexts
    this.recoverClosedContexts();

    // After recovery, try again
    for (const ctx of this.audioContextPool) {
      if (ctx.state === 'suspended' && !this.activeAudioContexts.has(ctx)) {
        this.activeAudioContexts.add(ctx);
        this.clearIdleTimer(ctx);
        return ctx;
      }
    }

    // Last resort: try to use a running context if available (shared usage)
    for (const ctx of this.audioContextPool) {
      if (ctx.state === 'running') {
        // Return running context - it's shared but better than nothing
        console.warn('[VOICE] Using shared running audio context');
        return ctx;
      }
    }

    console.error('[VOICE] No audio contexts available - browser limit reached');
    return null;
  }

  private releaseAudioContext(ctx: AudioContext): void {
    if (!ctx) return;
    
    this.activeAudioContexts.delete(ctx);
    
    // Suspend to allow reuse but free resources
    if (ctx.state === 'running') {
      ctx.suspend().catch(() => {});
    }
    
    // Start idle timer to auto-close after timeout
    this.startIdleTimer(ctx);
  }

  private initRecognition() {
    console.log('[VOICE] initRecognition called, window exists:', typeof window !== 'undefined', 'recognition exists:', !!this.recognition);
    if (typeof window === 'undefined') return;
    if (this.recognition) {
      console.log('[VOICE] Recognition already initialized, skipping');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('[VOICE] SpeechRecognition API available:', !!SpeechRecognition);
    
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        // Try to use local speech recognition if available (Chrome experimental)
        try {
          (this.recognition as any).alternativeServices = false;
        } catch (e) {
          // Ignore if not supported
        }
        
        // Optimized settings
        (this.recognition as any).maxAlternatives = 1;
        
        this.recognition.onresult = (event: SpeechRecognitionEvent | any) => this.handleResult(event);
        
        // Debug logging for recognition events
        this.recognition.onaudiostart = () => console.log('[VOICE] Audio input started');
        this.recognition.onsoundstart = () => console.log('[VOICE] Sound detected');
        this.recognition.onspeechstart = () => console.log('[VOICE] Speech detected');
        this.recognition.onerror = (event: SpeechRecognitionErrorEvent | any) => this.handleError(event as SpeechRecognitionErrorEvent);
        this.recognition.onend = () => this.handleEnd();
        this.recognition.onstart = () => {
          console.log('[VOICE] Recognition started successfully');
          // Reset error counts on successful start
          this.networkErrorCount = 0;
          this.errorCount = 0;
          this.sessionStartTime = Date.now();
          this.hasProcessedSpeech = false;
          this.initVAD();
        };
        console.log('[VOICE] Recognition initialized successfully');
      } catch (e) {
        console.error('[VOICE] Failed to initialize recognition:', e);
        this.setState(VoiceState.ERROR);
      }
    } else {
      console.error('[VOICE] SpeechRecognition API not available');
      this.setState(VoiceState.ERROR);
    }
  }

  // ==================== VAD (Voice Activity Detection) ====================

  private initVAD(): void {
    if (!this.audioContext) {
      this.audioContext = this.getAudioContext();
    }
    
    if (!this.audioContext) return;
    
    try {
      this.vadAnalyser = this.audioContext.createAnalyser();
      this.vadAnalyser.fftSize = 256;
      this.vadAnalyser.smoothingTimeConstant = 0.8;
      
      // Start VAD monitoring
      this.vadInterval = window.setInterval(() => {
        this.checkVAD();
      }, 100);
    } catch (e) {
      console.warn('[VOICE] VAD initialization failed:', e);
    }
  }

  private checkVAD(): void {
    if (!this.vadAnalyser || this.state !== VoiceState.LISTENING) return;
    
    const dataArray = new Uint8Array(this.vadAnalyser.frequencyBinCount);
    this.vadAnalyser.getByteFrequencyData(dataArray);
    
    // Calculate volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedVolume = average / 255;
    
    const now = Date.now();
    
    if (normalizedVolume > VAD_THRESHOLD) {
      // Speech detected
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = now;
        this.silenceStartTime = 0;
      }
      
      // Max speech duration check
      if (now - this.speechStartTime > VAD_SPEECH_TIMEOUT) {
        this.stopVAD();
        if (this.recognition) {
          try { this.recognition.stop(); } catch(e) {}
        }
      }
    } else {
      // Silence detected
      if (this.isSpeaking) {
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime > VAD_SILENCE_TIMEOUT) {
          // User stopped speaking
          this.isSpeaking = false;
          this.processFinalTranscript();
        }
      }
    }
  }

  private stopVAD(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.vadAnalyser = null;
    this.isSpeaking = false;
    this.silenceStartTime = 0;
    this.speechStartTime = 0;
    
    // FIXED: Release VAD audio context back to pool
    if (this.audioContext) {
      this.releaseAudioContext(this.audioContext);
      this.audioContext = null;
    }
  }

  private processFinalTranscript(): void {
    // Trigger processing if we have a transcript
    if (this.state === VoiceState.LISTENING) {
      // The recognition.onresult will handle the actual transcript
      // This just signals that user stopped speaking
    }
  }

  // ==================== PUBLIC API ====================

  public subscribe(callback: (state: VoiceState) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  public subscribeToTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.transcriptObservers.push(callback);
    return () => {
      this.transcriptObservers = this.transcriptObservers.filter(cb => cb !== callback);
    };
  }

  public setCommandCallback(cb: (text: string) => void) {
    this.onCommandCallback = cb;
  }

  private setState(newState: VoiceState) {
    if (this.state === newState) return;
    console.log(`[VOICE] State changing from ${VoiceState[this.state]} to ${VoiceState[newState]}`);
    this.state = newState;
    this.observers.forEach(cb => cb(newState));
  }

  private emitTranscript(text: string, isFinal: boolean) {
    this.transcriptObservers.forEach(cb => cb(text, isFinal));
  }

  public getState(): VoiceState {
    return this.state;
  }

  public setConfig(config: VoiceConfig) {
    this.config = config;
    localStorage.setItem('jarvis_voice_config', JSON.stringify(config));
  }

  public getConfig(): VoiceConfig {
    return this.config;
  }

  public toggleMute(): void {
    console.log('[VOICE] toggleMute called, current state:', this.state);
    
    if (this.state === VoiceState.MUTED || this.state === VoiceState.ERROR) {
      // Set state immediately (synchronously) so tests pass
      this.errorCount = 0;
      this.consecutiveShortSessions = 0;
      this.setState(VoiceState.IDLE); // Start in IDLE (listening for wake word)
      this.lastManualActivation = Date.now();
      
      // Then start Whisper asynchronously
      this.initVoiceWithWhisper();
      return;
    }

    if (this.state === VoiceState.IDLE) {
      // Already in IDLE, go to LISTENING (manual activation)
      this.errorCount = 0;
      this.consecutiveShortSessions = 0;
      this.setState(VoiceState.LISTENING);
      this.lastManualActivation = Date.now();
      return;
    }

    if (this.state === VoiceState.LISTENING || this.state === VoiceState.SPEAKING) {
      this.setState(VoiceState.IDLE);
    }
  }
  
  /**
   * Initialize voice with STT provider selection (async part)
   */
  private async initVoiceWithWhisper(): Promise<void> {
    // Request microphone permission first
    try {
      console.log('[VOICE] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[VOICE] Microphone permission granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('[VOICE] Microphone permission denied:', err);
      this.setState(VoiceState.ERROR);
      return;
    }
    
    const sttProvider = this.config.sttProvider || 'AUTO';
    console.log(`[VOICE] STT Provider setting: ${sttProvider}`);
    
    // Handle based on STT provider preference
    if (sttProvider === 'BROWSER') {
      // Force browser STT
      console.log('[VOICE] Using browser STT (forced by settings)');
      this.startListening();
    } else if (sttProvider === 'WHISPER') {
      // Force Whisper, fail if not available
      console.log('[VOICE] Using Whisper STT (forced by settings)');
      const whisperAvailable = await this.tryWhisperFallback();
      if (!whisperAvailable) {
        console.error('[VOICE] Whisper not available but forced by settings');
        this.setState(VoiceState.ERROR);
      }
    } else {
      // AUTO: Try Whisper first (preferred), fallback to browser STT
      console.log('[VOICE] Auto mode: trying Whisper first, then browser STT');
      const whisperAvailable = await this.tryWhisperFallback();
      if (!whisperAvailable) {
        console.log('[VOICE] Whisper not available, falling back to browser STT');
        this.startListening();
      }
    }
  }

  public setPower(on: boolean): void {
    console.log('[VOICE] setPower called:', on, 'current state:', this.state);
    if (on) {
      // Set state immediately (synchronously)
      this.errorCount = 0;
      this.consecutiveShortSessions = 0;
      this.setState(VoiceState.IDLE); // Start in IDLE (listening for wake word)
      this.lastManualActivation = Date.now();
      
      // Then initialize voice asynchronously
      this.initVoiceWithWhisper();
    } else {
      this.cleanup();
      this.setState(VoiceState.MUTED);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Properly clean up speech recognition - FIXED: clear listeners before nulling
    if (this.recognition) {
      // Remove all event listeners first to prevent callbacks during cleanup
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.onaudiostart = null;
      this.recognition.onsoundstart = null;
      this.recognition.onspeechstart = null;
      
      try {
        this.recognition.abort();
      } catch (e) {
        console.warn('[VOICE] Error aborting recognition:', e);
      }
      this.recognition = null;
    }

    // Stop Whisper recording if active (use stopWhisperSTT for proper error handling)
    if (this.useWhisperFallback) {
      await this.stopWhisperSTT();
    }

    this.stopVAD();

    // FIXED: Properly release active audio context back to pool instead of closing
    if (this.audioContext) {
      this.releaseAudioContext(this.audioContext);
      this.audioContext = null;
    }

    // Release any tracked active contexts
    for (const ctx of this.activeAudioContexts) {
      this.releaseAudioContext(ctx);
    }
    this.activeAudioContexts.clear();

    // Clear all idle timers
    for (const timer of this.contextIdleTimers.values()) {
      clearTimeout(timer);
    }
    this.contextIdleTimers.clear();

    // Close all pooled audio contexts gracefully
    for (const ctx of this.audioContextPool) {
      if (ctx && ctx.state !== 'closed') {
        try {
          await ctx.close();
        } catch (e) {
          console.warn('[VOICE] Error closing pooled audio context:', e);
        }
      }
    }
    this.audioContextPool = [];

    // Clean up Web Worker
    if (this.wakeWordWorker) {
      try {
        this.wakeWordWorker.terminate();
      } catch (e) {
        console.warn('[VOICE] Error terminating wake word worker:', e);
      }
      this.wakeWordWorker = null;
    }

    // Clean up any remaining audio resources
    this.audioQueue = [];
    this.isPlayingAudio = false;

    // Reset all state flags
    this.isCurrentlySpeaking = false;
    this.ignoreInputUntil = 0;
    this.isSpeaking = false;
    this.silenceStartTime = 0;
    this.speechStartTime = 0;
    this.wakeWordDetectedTime = 0;
    this.sessionStartTime = 0;
    this.lastManualActivation = 0;
    this.hasProcessedSpeech = false;
    this.consecutiveShortSessions = 0;
    this.isRestarting = false;

    // Clear any remaining timeouts/intervals
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
  }

  private async startListening(): Promise<void> {
    console.log('[VOICE] startListening called, current state:', this.state, 'isRestarting:', this.isRestarting);

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.isRestarting) {
      console.log('[VOICE] Already restarting, skipping');
      return;
    }
    this.isRestarting = true;

    try {
      this.lastManualActivation = Date.now();
      if (this.recognition) {
        console.log('[VOICE] Aborting existing recognition');
        this.recognition.onend = () => {};
        try { this.recognition.abort(); } catch(e) { }
        this.recognition = null;
      }

      // Stop Whisper STT if it's running (await to ensure proper cleanup)
      await this.stopWhisperSTT();
      
      // Store timeout ID for cleanup
      this.restartTimer = window.setTimeout(() => {
        console.log('[VOICE] startListening timeout fired, state:', this.state);
        // Check if we're still in a valid state before proceeding
        if (this.state === VoiceState.MUTED) {
          console.log('[VOICE] State is MUTED, aborting start');
          this.isRestarting = false;
          return;
        }
        
        try {
          this.initRecognition();
          console.log('[VOICE] Attempting to start recognition...');
          if (this.state !== VoiceState.ERROR) {
            this.recognition?.start();
            console.log('[VOICE] recognition.start() called');
          } else {
            console.log('[VOICE] Cannot start recognition, state:', this.state);
          }
        } catch(e) {
          console.error('[VOICE] Error starting recognition:', e);
          this.setState(VoiceState.ERROR);
        } finally {
          this.isRestarting = false;
          this.restartTimer = null;
        }
      }, 100);
    } catch (e) {
      console.error('[VOICE] Error in startListening:', e);
      this.setState(VoiceState.ERROR);
      this.isRestarting = false;
    }
  }

  public interrupt() {
    if (this.config.voiceType === 'SYSTEM') {
      if (this.synthesis.speaking || this.synthesis.pending) {
        this.synthesis.cancel();
        this.onSpeakComplete();
      }
    } else {
      // FIXED: Stop audio playback and release context back to pool
      if (this.audioContext) {
        // Suspend instead of close to allow reuse
        if (this.audioContext.state === 'running') {
          this.audioContext.suspend().catch(() => {});
        }
        // Release back to pool for reuse
        this.releaseAudioContext(this.audioContext);
        this.audioContext = null;
      }
      this.onSpeakComplete();
    }
    this.audioQueue = [];
    this.isPlayingAudio = false;
    // Clear the speaking flag when interrupted
    this.isCurrentlySpeaking = false;
    // Clear the deaf period to allow input after interruption
    this.ignoreInputUntil = 0;
  }

  private onSpeakComplete() {
    this.setState(VoiceState.IDLE);
    conversation.addTurn('JARVIS', "Interrupted");
    // Clear the deaf period to allow input after speaking completes
    this.ignoreInputUntil = 0;
  }

  // ==================== OPTIMIZED TTS ====================

  // Flag to temporarily ignore input to prevent audio feedback
  private ignoreInputUntil: number = 0;

  public async speak(text: string) {
    if (this.state === VoiceState.MUTED || this.state === VoiceState.ERROR) return;

    // Prevent duplicate responses within a short timeframe
    const now = Date.now();
    if (this.lastSpokenText === text && (now - this.lastSpokenTimestamp) < 3000) {
      console.log('[VOICE] Duplicate response prevented:', text.substring(0, 50) + '...');
      return;
    }

    this.interrupt();
    this.setState(VoiceState.SPEAKING);

    // Set flag to prevent audio feedback loop - SET BEFORE starting to speak
    this.isCurrentlySpeaking = true;

    // Set a temporary deaf period to prevent audio feedback (500ms)
    this.ignoreInputUntil = Date.now() + 500;

    // Store the spoken text and timestamp
    this.lastSpokenText = text;
    this.lastSpokenTimestamp = now;

    try {
      // OPTIMIZED: Start speaking faster with shorter initial chunks
      const chunks = this.splitTextIntoChunks(text, 150); // Reduced from 200

      if (this.config.voiceType === 'SYSTEM') {
        await this.speakWithSystemVoice(chunks);
      } else if (this.config.voiceType === 'PIPER') {
        await this.speakWithPiper(text);
      } else {
        await this.speakWithNeural(chunks);
      }
    } catch (error) {
      console.error('[VOICE] Error during speech:', error);
      // Still reset the speaking flag even if there's an error
      this.isCurrentlySpeaking = false;
      // Set state back to IDLE in case of error
      if (this.state === VoiceState.SPEAKING) {
        this.setState(VoiceState.IDLE);
      }
      throw error; // Re-throw to let caller handle the error
    }

    // Clear the speaking flag after speaking is complete
    this.isCurrentlySpeaking = false;

    // Ensure state is properly reset after speaking
    // Only set to IDLE if we're still in SPEAKING state (not interrupted)
    if (this.state === VoiceState.SPEAKING) {
      this.setState(VoiceState.IDLE);
    }
  }
  
  /**
   * NEW: Preload a response for instant playback
   */
  public async preloadResponse(text: string): Promise<void> {
    if (this.config.voiceType === 'PIPER') {
      // Pre-synthesize with Piper
      const launcherStatus = piperLauncher.getStatus();
      if (launcherStatus.state === 'RUNNING') {
        // Note: Actual preloading would require Piper service support
        this.preloadedResponse = text;
      }
    }
  }

  /**
   * NEW v1.1: Start streaming TTS session
   * Allows TTS to begin speaking while AI is still generating
   */
  public startStreamingTTS(voiceType?: 'SYSTEM' | 'PIPER' | 'GEMINI'): string {
    const type = voiceType || 
      (this.config.voiceType === 'NEURAL' ? 'GEMINI' : 
       this.config.voiceType === 'SYSTEM' ? 'SYSTEM' : 'PIPER');
    return voiceStreaming.startSession(type);
  }

  /**
   * NEW v1.1: Feed token to streaming TTS
   * Returns true if the token triggered speech
   */
  public streamToken(token: string): boolean {
    return voiceStreaming.onToken(token);
  }

  /**
   * NEW v1.1: End streaming TTS session
   */
  public endStreamingTTS(): void {
    voiceStreaming.endSession();
  }

  /**
   * NEW v1.1: Abort streaming TTS
   */
  public abortStreamingTTS(): void {
    voiceStreaming.abort();
  }

  /**
   * NEW v1.1: Check if streaming TTS is active
   */
  public isStreamingTTS(): boolean {
    return voiceStreaming.isStreaming();
  }

  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  private async speakWithSystemVoice(chunks: string[]): Promise<void> {
    for (const chunk of chunks) {
      // Enhance the text for more natural speech
      const enhancedText = enhancedTTS.enhanceTextForNaturalSpeech(chunk);

      // Clean SSML tags to prevent them from being read literally
      const cleanText = enhancedTTS.cleanSSML(enhancedText);

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Apply enhanced parameters
        const params = enhancedTTS.generateSpeechParameters();
        utterance.rate = params.rate;
        utterance.pitch = params.pitch;
        utterance.volume = params.volume;

        // Ensure the rate is appropriately slowed down for natural speech
        utterance.rate = Math.min(0.9, params.rate); // Cap at 0.9 for natural flow

        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => v.name === this.config.voiceName) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
          resolve();
        };
        utterance.onerror = () => {
          // Clear the speaking flag even if there's an error
          this.isCurrentlySpeaking = false;
          resolve();
        };

        this.synthesis.speak(utterance);
      });
    }

    // Don't change global state flags here - let the main speak() function handle that
    // NOTE: conversation.addTurn('JARVIS', ...) is called in App.tsx processKernelRequest
    // to avoid duplicate conversation entries
  }

  private async speakWithPiper(text: string): Promise<void> {
    console.log('[VOICE] Attempting to speak with Piper TTS');

    // Enhance the text for more natural speech
    const enhancedText = enhancedTTS.enhanceTextForNaturalSpeech(text);

    // Clean SSML tags to prevent them from being read literally
    const cleanText = enhancedTTS.cleanSSML(enhancedText);

    const launcherStatus = piperLauncher.getStatus();
    console.log('[VOICE] Piper launcher status:', launcherStatus);

    if (launcherStatus.state !== 'RUNNING') {
      console.log('[VOICE] Piper server not running, attempting to start...');
      const started = await piperLauncher.startServer();
      if (!started) {
        console.warn('[VOICE] Piper auto-start failed, falling back to system voice');
        await this.speakWithSystemVoice([cleanText]);
        return;
      }

      // Wait a bit for the server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Check if the server is actually available before trying to use it
    const isAvailable = await piperTTS.isAvailable();
    console.log('[VOICE] Piper TTS availability check:', isAvailable);

    if (!isAvailable) {
      console.warn('[VOICE] Piper server is not responding, falling back to system voice');
      await this.speakWithSystemVoice([cleanText]);
      return;
    }

    let success = false;
    try {
      success = await piperTTS.speak(cleanText, () => {
        // The callback is called when speaking is done, but don't change global state here
        // Let the main speak() function handle state management
      });
    } catch (error) {
      console.error('[VOICE] Piper TTS error:', error);
      success = false;
    }

    console.log('[VOICE] Piper TTS result:', success);

    if (!success) {
      console.warn('[VOICE] Piper TTS failed, falling back to system voice');
      await this.speakWithSystemVoice([cleanText]);
    }
    // NOTE: conversation.addTurn('JARVIS', ...) is called in App.tsx processKernelRequest
    // to avoid duplicate conversation entries
  }

  private async speakWithNeural(chunks: string[]): Promise<void> {
    const rateCheck = geminiRateLimiter.canMakeRequest(1000);
    if (!rateCheck.allowed) {
      console.warn(`[VOICE] Gemini TTS rate limited: ${rateCheck.reason}. Using system voice.`);
      await this.speakWithSystemVoice(chunks);
      return;
    }

    try {
      let apiKey = typeof process !== 'undefined' ? (process.env.VITE_GEMINI_API_KEY || process.env.API_KEY) : null;

      if (!apiKey) {
        const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
        if (storedKey) {
          try {
            apiKey = atob(storedKey);
          } catch (decodeError) {
            throw new Error("Invalid API Key format");
          }
        }
      }

      if (!apiKey) {
        await this.speakWithSystemVoice(chunks);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      for (const chunk of chunks) {
        // Enhance the text for more natural speech
        const enhancedText = enhancedTTS.enhanceTextForNaturalSpeech(chunk);

        // Clean SSML tags to prevent them from being read literally
        const cleanText = enhancedTTS.cleanSSML(enhancedText);

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Say naturally with emotion: ${cleanText}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: this.config.voiceName as any },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) continue;

        geminiRateLimiter.trackRequest(1000);

        const audioCtx = this.getAudioContext();
        if (!audioCtx) {
          console.error('[VOICE] No audio context available for playback');
          continue;
        }

        try {
          const audioBuffer = await decodeRawPCM(
            decodeBase64ToUint8Array(base64Audio),
            audioCtx,
            24000,
            1,
          );

          await this.playAudioBuffer(audioBuffer, audioCtx);
        } finally {
          // FIXED: Always release context back to pool, even on error
          this.releaseAudioContext(audioCtx);
        }
      }

      // NOTE: conversation.addTurn('JARVIS', ...) is called in App.tsx processKernelRequest
      // to avoid duplicate conversation entries

    } catch (e: any) {
      console.error("Neural TTS Failed:", e);
      // Don't change the speaking flag here - let the main speak() function handle that
      await this.speakWithSystemVoice(chunks);
    }
  }

  private playAudioBuffer(buffer: AudioBuffer, ctx: AudioContext): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // FIXED: Check if context is closed before attempting playback
        if (ctx.state === 'closed') {
          console.warn('[VOICE] Cannot play audio - context is closed');
          reject(new Error('AudioContext is closed'));
          return;
        }
        
        // Ensure context is running before playing
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          // Suspend context after playback to free resources
          if (ctx.state === 'running') {
            ctx.suspend().catch(() => {});
          }
          resolve();
        };
        (source as any).onerror = (err: any) => {
          console.error('[VOICE] Audio playback error:', err);
          // Suspend context on error too
          if (ctx.state === 'running') {
            ctx.suspend().catch(() => {});
          }
          reject(err);
        };
        source.start();
      } catch (err) {
        console.error('[VOICE] Failed to start audio playback:', err);
        // Suspend context on error
        if (ctx.state === 'running') {
          ctx.suspend().catch(() => {});
        }
        reject(err);
      }
    });
  }

  // ==================== SPEECH RECOGNITION ====================

  private handleResult(event: SpeechRecognitionEvent | any) {
    // NEW: Prevent processing audio when JARVIS is speaking to avoid feedback loop
    if (this.isCurrentlySpeaking || Date.now() < this.ignoreInputUntil) {
      console.log('[VOICE] Ignoring audio input - JARVIS is currently speaking or in deaf period');
      return;
    }

    this.hasProcessedSpeech = true;
    this.errorCount = 0;
    this.consecutiveShortSessions = 0;

    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      else interimTranscript += event.results[i][0].transcript;
    }

    const transcript = (finalTranscript || interimTranscript).toLowerCase().trim();
    console.log(`[VOICE] handleResult: state=${this.state}, final="${finalTranscript}", interim="${interimTranscript}", transcript="${transcript}"`);
    if (!transcript) return;

    this.emitTranscript(transcript, !!finalTranscript);

    // Handle interruptions
    // IMPORTANT: Don't process interrupt phrases when JARVIS is speaking to avoid audio feedback
    // If JARVIS is speaking, any transcript is likely audio feedback of its own voice
    if (this.state === VoiceState.SPEAKING && finalTranscript) {
      console.log('[VOICE] Audio feedback detected - ignoring transcript while speaking:', transcript);
      return;
    }

    // Only process interrupt phrases when not speaking
    if (this.state !== VoiceState.SPEAKING && finalTranscript) {
      const interruptPhrases = [
        'stop',
        'cancel',
        'shut up',
        'be quiet',
        'enough',
        'okay stop',
        'jarvis stop',
        'jarvis cancel',
        'cancel that',
        'never mind',
        'stop talking',
        'hold on'
      ];

      // Convert transcript to lowercase for case-insensitive matching
      const lowerTranscript = transcript.toLowerCase();
      const shouldInterrupt = interruptPhrases.some(phrase => lowerTranscript.includes(phrase.toLowerCase()));

      if (shouldInterrupt) {
        this.interrupt();
        this.setState(VoiceState.LISTENING);
        console.log('[VOICE] Interrupted by user command');
        return;
      }
    }

    // Handle wake word detection - IMPROVED with fuzzy matching
    const now = Date.now();
    const isWakeWord = this.detectWakeWord(transcript);

    if (this.state === VoiceState.IDLE || this.state === VoiceState.INTERRUPTED) {
      if (isWakeWord) {
        console.log('[VOICE] Wake word detected! Transitioning to LISTENING');
        this.wakeWordDetectedTime = now;
        this.setState(VoiceState.LISTENING);
        this.lastManualActivation = now;
      }
    }

    // Handle command (either in LISTENING state OR within grace period after wake word)
    const inGracePeriod = (now - this.wakeWordDetectedTime) < this.WAKE_WORD_GRACE_PERIOD;

    if ((this.state === VoiceState.LISTENING || inGracePeriod) && finalTranscript) {
      console.log('[VOICE] Processing final transcript:', finalTranscript, 'state:', this.state, 'inGracePeriod:', inGracePeriod);

      let cleanText = finalTranscript.trim();

      // Strip wake word from the beginning of the command if present
      const wakeWords = [this.config.wakeWord, 'jarvis'];
      for (const ww of wakeWords) {
        const lowerText = cleanText.toLowerCase();
        const wwIndex = lowerText.indexOf(ww);
        if (wwIndex !== -1) {
          // Remove the wake word and any leading/trailing punctuation/spaces around it
          cleanText = (cleanText.substring(0, wwIndex) + cleanText.substring(wwIndex + ww.length)).trim();
          // Remove leading punctuation
          cleanText = cleanText.replace(/^[,.!?\s]+/, '');
          break;
        }
      }

      if (cleanText) {
        // Validate voice input for security
        const validation = inputValidator.validate(cleanText, {
          maxLength: 500,
          strictMode: false,
          context: 'user_input'
        });

        if (!validation.valid) {
          console.warn('[VOICE] Input validation failed:', validation.error);
          this.setState(VoiceState.IDLE);
          return;
        }

        // Use sanitized text
        cleanText = validation.sanitized;

        // Prevent duplicate command callbacks for the same text within a short timeframe
        const now = Date.now();

        // Create a hash for the command to prevent duplicates
        const commandHash = this.createCommandHash(cleanText);

        // Check if this command was recently processed (within 2 seconds)
        const recentMatch = this.recentCommands.find(
          cmd => cmd.text === cleanText && (now - cmd.timestamp) < 2000
        );

        // Also check the hash-based duplicate prevention
        const isDuplicateHash = this.voiceCommandHashes.has(commandHash) &&
                               (now - this.lastProcessedTime) < this.DUPLICATE_COMMAND_WINDOW;

        if (recentMatch || isDuplicateHash) {
          console.log('[VOICE] Duplicate command ignored:', cleanText);
          return;
        }

        // Add this command to the recent commands list
        this.recentCommands.push({ text: cleanText, timestamp: now });

        // Add the command hash to prevent future duplicates
        this.voiceCommandHashes.set(commandHash, now);

        // Clean up old commands (older than 3 seconds)
        this.recentCommands = this.recentCommands.filter(
          cmd => (now - cmd.timestamp) < 3000
        );

        // Clean up old command hashes periodically
        this.cleanupOldCommandHashes(now);

        this.lastProcessedText = cleanText;
        this.lastProcessedTime = now;

        this.setState(VoiceState.PROCESSING);
        console.log('[VOICE] Calling command callback:', cleanText);
        // NOTE: conversation.addTurn('USER', cleanText) is called in App.tsx processKernelRequest
        // to avoid duplicate conversation entries

        // Store the command callback to prevent duplicate calls
        const commandCallback = this.onCommandCallback;
        if (commandCallback) {
          // Call the command callback with the clean text
          commandCallback(cleanText);
        }

        // Add a small delay to ensure the command is fully processed before accepting new ones
        setTimeout(() => {
          // Clean up old commands again after delay
          const laterTime = Date.now();
          this.recentCommands = this.recentCommands.filter(
            cmd => (laterTime - cmd.timestamp) < 3000
          );

          // Clean up old command hashes based on time
          this.cleanupOldCommandHashes(laterTime);
        }, 1500);
      } else {
        // Only wake word was said, no command - stay in LISTENING for a bit
        console.log('[VOICE] Only wake word detected, waiting for command...');
      }
    }
  }

  private handleError(event: SpeechRecognitionErrorEvent | any) {
    const error = event.error;
    console.warn('[VOICE] Speech recognition error:', error);
    
    // Handle network errors specially - they indicate no internet or blocked service
    if (error === 'network') {
      this.networkErrorCount++;
      console.warn(`[VOICE] Network error count: ${this.networkErrorCount}`);
      
      // After 3 network errors, try Whisper fallback (only if not forced to BROWSER)
      if (this.networkErrorCount >= 3 && !this.useWhisperFallback && this.config.sttProvider !== 'BROWSER') {
        console.log('[VOICE] Trying Whisper fallback...');
        this.tryWhisperFallback();
      }
      
      // After 5 network errors, give up on browser STT
      if (this.networkErrorCount >= 5) {
        console.error('[VOICE] Too many network errors. Browser STT requires internet connection.');
        if (!this.whisperAvailable) {
          this.setState(VoiceState.ERROR);
        }
      }
      return;
    }
    
    // Reset network error count on successful recognition
    if (this.state === VoiceState.LISTENING || this.state === VoiceState.IDLE) {
      this.networkErrorCount = 0;
    }
    
    // Ignore other non-critical errors
    if (error === 'no-speech' || error === 'aborted' || error === 'audio-capture') {
      return;
    }
    
    this.errorCount++;
    
    if (error === 'not-allowed') {
      console.error('[VOICE] Microphone permission denied');
      this.setState(VoiceState.ERROR);
    }
  }

  private handleEnd() {
    console.log('[VOICE] Recognition ended, state:', this.state, 'networkErrors:', this.networkErrorCount);
    
    if (this.state === VoiceState.ERROR || this.isRestarting) return;
    
    // Don't restart if we've had too many network errors
    if (this.networkErrorCount >= 5) {
      console.error('[VOICE] Not restarting due to persistent network errors');
      this.setState(VoiceState.ERROR);
      return;
    }
    
    if (this.state !== VoiceState.MUTED) {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const isShortSession = sessionDuration < 500 && !this.hasProcessedSpeech;
      
      if (isShortSession) this.consecutiveShortSessions++;
      else this.consecutiveShortSessions = 0;
      
      let delay = 50;
      if (this.consecutiveShortSessions > 5) delay = 5000;
      else if (this.errorCount > 0) delay = Math.min(10000, 500 * Math.pow(1.5, this.errorCount));
      
      // Increase delay if we're getting network errors
      if (this.networkErrorCount > 0) {
        delay = Math.max(delay, 2000 * this.networkErrorCount);
      }

      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
      }

      this.restartTimer = window.setTimeout(() => {
        try {
          if (this.state !== VoiceState.MUTED && this.state !== VoiceState.ERROR) {
            // If using Whisper fallback, don't restart browser recognition
            if (this.useWhisperFallback) {
              console.log('[VOICE] Using Whisper fallback, not restarting browser recognition');
              return;
            }
            
            console.log('[VOICE] Restarting recognition after end, creating fresh instance');
            // Create a fresh recognition instance to avoid network errors from stale connections
            this.recognition = null;
            this.initRecognition();
            if (this.recognition) {
              this.recognition.start();
              console.log('[VOICE] Fresh recognition instance started');
            }
            if (this.state === VoiceState.LISTENING) {
              if (Date.now() - this.lastManualActivation > 15000) this.setState(VoiceState.IDLE);
            }
          }
        } catch (e) { 
          console.warn('[VOICE] Error in recognition restart:', e); 
        }
      }, delay);
    }
  }
  
  /**
   * Try to switch to Whisper STT fallback
   */
  private whisperAvailabilityLogged = false;
  
  private async tryWhisperFallback(): Promise<boolean> {
    // Only log availability check once to reduce console noise
    if (!this.whisperAvailabilityLogged) {
      console.log('[VOICE] Checking Whisper availability...');
    }
    const available = await whisperSTT.isAvailable();

    if (available) {
      console.log('[VOICE] Whisper server available! Switching to Whisper STT.');
      this.whisperAvailable = true;
      this.useWhisperFallback = true;

      // Ensure browser recognition is stopped
      this.stopBrowserRecognition();

      // Start Whisper recording
      const started = await whisperSTT.startRecording((text, isFinal) => {
        this.handleWhisperTranscript(text, isFinal);
      });

      if (started) {
        console.log('[VOICE] Whisper STT started successfully');
        this.networkErrorCount = 0; // Reset error count
        this.whisperAvailabilityLogged = true; // Mark as logged since we confirmed it's working
        return true;
      } else {
        console.error('[VOICE] Failed to start Whisper STT');
        this.useWhisperFallback = false;
        return false;
      }
    } else {
      // Only log unavailability once per session to reduce console noise
      if (!this.whisperAvailabilityLogged) {
        console.log('[VOICE] Whisper server not available (port 5001). Run: python whisper_server.py to enable local STT.');
        this.whisperAvailabilityLogged = true;
      }
      return false;
    }
  }

  /**
   * Ensure browser recognition is properly stopped
   */
  private stopBrowserRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = () => {}; // Clear event handlers
        this.recognition.abort();
      } catch(e) {
        console.warn('[VOICE] Error stopping browser recognition:', e);
      }
      this.recognition = null;
    }
  }

  /**
   * Ensure Whisper STT is properly stopped
   */
  private async stopWhisperSTT(): Promise<void> {
    try {
      await whisperSTT.stopRecording();
      this.useWhisperFallback = false;
    } catch(e) {
      console.warn('[VOICE] Error stopping Whisper STT:', e);
    }
  }
  
  /**
   * Handle transcript from Whisper
   */
  private handleWhisperTranscript(text: string, isFinal: boolean): void {
    const transcript = text.toLowerCase().trim();
    if (!transcript) return;

    // Check for interrupt commands even if JARVIS is speaking
    const interruptPhrases = [
      'stop',
      'cancel',
      'shut up',
      'be quiet',
      'enough',
      'okay stop',
      'jarvis stop',
      'jarvis cancel',
      'cancel that',
      'never mind',
      'stop talking',
      'hold on'
    ];

    const shouldInterrupt = interruptPhrases.some(phrase => transcript.includes(phrase.toLowerCase()));

    // Handle interrupt commands, but NOT when JARVIS is speaking to avoid audio feedback
    // If JARVIS is speaking, any transcript is likely audio feedback of its own voice
    if (shouldInterrupt && this.isCurrentlySpeaking) {
      console.log('[VOICE] Audio feedback detected - ignoring interrupt while speaking:', transcript);
      return;
    }

    // Handle interrupt commands only when not speaking
    if (shouldInterrupt && !this.isCurrentlySpeaking) {
      console.log('[VOICE] Interrupt command detected');
      this.interrupt();
      this.setState(VoiceState.LISTENING);
      console.log('[VOICE] Interrupted by user command');
      return;
    }

    // Prevent processing other audio when JARVIS is speaking to avoid feedback loop
    if (this.isCurrentlySpeaking || Date.now() < this.ignoreInputUntil) {
      console.log('[VOICE] Ignoring Whisper input - JARVIS is currently speaking or in deaf period');
      return;
    }

    console.log('[VOICE] Whisper transcript:', text, 'isFinal:', isFinal);

    if (!isFinal) return; // Only process final transcripts

    // Emit for UI display
    this.emitTranscript(transcript, true);

    // Handle wake word - IMPROVED with fuzzy matching
    if (this.state === VoiceState.IDLE || this.state === VoiceState.INTERRUPTED) {
      if (this.detectWakeWord(transcript)) {
        console.log('[VOICE] Wake word detected via Whisper! Transitioning to LISTENING');
        this.wakeWordDetectedTime = Date.now();
        this.setState(VoiceState.LISTENING);
        this.lastManualActivation = Date.now();
      }
    } else if (this.state === VoiceState.LISTENING) {
      // Process the command
      console.log('[VOICE] Processing Whisper command:', text);

      // Strip wake word
      let cleanText = text.trim();
      const wakeWords = [this.config.wakeWord, 'jarvis', 'Jarvis'];
      for (const ww of wakeWords) {
        const lowerText = cleanText.toLowerCase();
        const wwIndex = lowerText.indexOf(ww);
        if (wwIndex !== -1) {
          cleanText = (cleanText.substring(0, wwIndex) + cleanText.substring(wwIndex + ww.length)).trim();
          cleanText = cleanText.replace(/^[,.!?\s]+/, '');
          break;
        }
      }

      if (cleanText) {
        const validation = inputValidator.validate(cleanText, {
          maxLength: 500,
          strictMode: false,
          context: 'user_input'
        });

        if (!validation.valid) {
          console.warn('[VOICE] Input validation failed:', validation.error);
          this.setState(VoiceState.IDLE);
          return;
        }

        // Get current timestamp for duplicate detection
        const now = Date.now();

        // Create a hash for the command to prevent duplicates
        const commandHash = this.createCommandHash(cleanText);

        // Check if this command was recently processed (within 2 seconds)
        const recentMatch = this.recentCommands.find(
          cmd => cmd.text === cleanText && (now - cmd.timestamp) < 2000
        );

        // Also check the hash-based duplicate prevention
        const existingHashTime = this.voiceCommandHashes.get(commandHash);
        const isDuplicateHash = existingHashTime !== undefined &&
                               (now - existingHashTime) < this.DUPLICATE_COMMAND_WINDOW;

        if (recentMatch || isDuplicateHash) {
          console.log('[VOICE] Duplicate command ignored:', cleanText);
          return;
        }

        // Add this command to the recent commands list
        this.recentCommands.push({ text: cleanText, timestamp: now });

        // Add the command hash to prevent future duplicates
        this.voiceCommandHashes.set(commandHash, now);

        // Clean up old commands (older than 3 seconds)
        this.recentCommands = this.recentCommands.filter(
          cmd => (now - cmd.timestamp) < 3000
        );

        // Clean up old command hashes periodically
        this.cleanupOldCommandHashes(now);

        this.lastProcessedText = cleanText;
        this.lastProcessedTime = now;

        this.setState(VoiceState.PROCESSING);
        console.log('[VOICE] Calling callback:', cleanText);
        // NOTE: conversation.addTurn('USER', cleanText) is called in App.tsx processKernelRequest
        // to avoid duplicate conversation entries
        this.onCommandCallback?.(cleanText);

        // Add a small delay to ensure the command is fully processed before accepting new ones
        setTimeout(() => {
          // Clean up old commands again after delay
          const laterTime = Date.now();
          this.recentCommands = this.recentCommands.filter(
            cmd => (laterTime - cmd.timestamp) < 3000
          );

          // Clean up old command hashes based on time
          this.cleanupOldCommandHashes(laterTime);
        }, 1500);
      }
    }
  }
  
  /**
   * IMPROVED: Fuzzy wake word detection to handle transcription variations
   * Handles cases like "jarvis", "jarvis", "jarvis", "jarves", "jarvice", etc.
   */
  private detectWakeWord(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase().trim();
    const lowerWakeWord = this.config.wakeWord.toLowerCase();

    // Exact matches - use Set to avoid duplicates
    const exactMatches = new Set(['jarvis', lowerWakeWord]);
    for (const ww of exactMatches) {
      if (lowerTranscript.includes(ww)) return true;
    }

    // Common transcription variations of "Jarvis"
    const variations = [
      'jarves', 'jarvice', 'jarviss', 'jarvess', 'jarviz',
      'jarvus', 'jarv', 'jarvish', 'jervis', 'jerviss',
      'garvis', 'garves', 'carvis', 'charvis', 'jarveis',
      'jarvies'
    ];

    for (const variation of variations) {
      if (lowerTranscript.includes(variation)) {
        console.log(`[VOICE] Wake word detected via variation: "${variation}" in "${transcript}"`);
        return true;
      }
    }

    // Phonetic similarity check for close matches (Levenshtein distance <= 2)
    const words = lowerTranscript.split(/\s+/);
    for (const word of words) {
      if (word.length >= 4 && word.length <= 8) {
        // Check similarity to "jarvis"
        if (this.levenshteinDistance(word, 'jarvis') <= 2) {
          console.log(`[VOICE] Wake word detected via phonetic similarity: "${word}"`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  
  /**
   * Create a hash for a command to prevent duplicates
   */
  private createCommandHash(text: string): string {
    // Simple hash function to create a unique identifier for the command
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Clean up old command hashes based on time
   */
  private cleanupOldCommandHashes(now: number): void {
    // Clean up command hashes that are older than the duplicate window
    for (const [hash, timestamp] of this.voiceCommandHashes.entries()) {
      if (now - timestamp > this.DUPLICATE_COMMAND_WINDOW) {
        this.voiceCommandHashes.delete(hash);
      }
    }

    // Also limit the total number of hashes to prevent memory buildup
    if (this.voiceCommandHashes.size > 100) {
      // Remove oldest entries if we exceed the limit
      const entries = Array.from(this.voiceCommandHashes.entries())
        .sort((a, b) => a[1] - b[1]) // Sort by timestamp (oldest first)
        .slice(0, Math.floor(this.voiceCommandHashes.size / 2)); // Remove oldest half

      entries.forEach(([hash, _]) => {
        this.voiceCommandHashes.delete(hash);
      });
    }
  }

  /**
   * Check if Whisper is being used as fallback
   */
  public isUsingWhisper(): boolean {
    return this.useWhisperFallback;
  }
  
  /**
   * Check if Whisper server is available
   */
  public async checkWhisperAvailable(): Promise<boolean> {
    this.whisperAvailable = await whisperSTT.isAvailable();
    return this.whisperAvailable;
  }
  
  /**
   * Get current STT provider being used
   */
  public getCurrentSTTProvider(): 'WHISPER' | 'BROWSER' | 'NONE' {
    if (this.useWhisperFallback) return 'WHISPER';
    if (this.recognition) return 'BROWSER';
    return 'NONE';
  }
  
  /**
   * Switch STT provider at runtime
   */
  public async switchSTTProvider(provider: 'WHISPER' | 'BROWSER' | 'AUTO'): Promise<boolean> {
    console.log(`[VOICE] Switching STT provider to: ${provider}`);
    
    // Update config
    this.config.sttProvider = provider;
    localStorage.setItem('jarvis_voice_config', JSON.stringify(this.config));
    
    // Stop current STT
    if (this.useWhisperFallback) {
      await this.stopWhisperSTT();
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch(e) {}
      this.recognition = null;
    }
    
    // Start new STT based on provider
    if (provider === 'BROWSER') {
      this.startListening();
      return true;
    } else if (provider === 'WHISPER') {
      const available = await whisperSTT.isAvailable();
      if (available) {
        const started = await whisperSTT.startRecording((text, isFinal) => {
          this.handleWhisperTranscript(text, isFinal);
        });
        this.useWhisperFallback = started;
        return started;
      }
      return false;
    } else {
      // AUTO: Try Whisper first, fallback to browser
      const whisperAvailable = await this.tryWhisperFallback();
      if (!whisperAvailable) {
        this.startListening();
      }
      return true;
    }
  }
}

export const voice = new VoiceCoreOptimized();

// Export for use in other modules
export default voice;
