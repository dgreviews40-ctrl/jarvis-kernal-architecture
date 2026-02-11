/**
 * Piper TTS Integration for JARVIS - OPTIMIZED VERSION
 * 
 * OPTIMIZATIONS:
 * - Streaming audio playback (play while generating)
 * - Audio buffer pooling for reduced GC
 * - Pre-warmed audio context
 * - Faster speech settings (configurable length_scale)
 * - Parallel audio generation for long text
 * - Smart text chunking for natural breaks
 * 
 * Piper is a fast, local neural text-to-speech system that runs entirely
 * on your machine - no cloud, no API keys, completely free!
 * 
 * For JARVIS-like voice, download the JARVIS voice model from:
 * https://huggingface.co/jgkawell/jarvis
 * 
 * Installation:
 * 1. Download Piper from: https://github.com/rhasspy/piper/releases
 * 2. Download JARVIS voice model (jarvis.onnx and jarvis.onnx.json)
 * 3. Place in a voices/ directory
 * 4. Start Piper HTTP server: piper --http-server --model jarvis.onnx
 * 
 * This service connects to a local Piper HTTP server for TTS generation.
 */

export interface PiperVoice {
  name: string;
  language: string;
  quality: 'low' | 'medium' | 'high';
  description?: string;
}

export interface PiperConfig {
  serverUrl: string;
  defaultVoice: string;
  speakerId?: number; // For multi-speaker voices
  lengthScale: number; // Speed (1.0 = normal, 0.8 = faster)
  noiseScale: number; // Variability (0.0-1.0)
  noiseW: number; // Phoneme width (0.0-1.0)
  enableStreaming: boolean; // NEW: Stream audio while generating
  chunkSize: number; // NEW: Characters per chunk for streaming
}

// Default config - Piper server runs locally on port 5000
// When Piper is in the JARVIS folder, the launcher starts it automatically
const DEFAULT_CONFIG: PiperConfig = {
  serverUrl: 'http://localhost:5000', // Default, can be overridden
  defaultVoice: 'jarvis',
  lengthScale: 0.85, // Slightly faster for more natural flow (higher = slower)
  noiseScale: 0.667,
  noiseW: 0.8,
  enableStreaming: true, // NEW: Enable streaming by default
  chunkSize: 300, // INCREASED: Larger chunks for better sentence flow
};

// NEW: Audio buffer pool for reduced garbage collection
interface PooledAudioContext {
  context: AudioContext;
  inUse: boolean;
}

class PiperTTSService {
  private config: PiperConfig = { ...DEFAULT_CONFIG };
  private audioContextPool: PooledAudioContext[] = [];
  private readonly maxPoolSize = 3;
  
  // NEW: Pre-warmed audio context
  private prewarmedContext: AudioContext | null = null;
  
  // NEW: Queue for sequential playback
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  private hasUserInteracted = false;
  
  constructor() {
    // Load saved config
    const saved = localStorage.getItem('jarvis_piper_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('[PIPER] Failed to parse saved config:', e);
      }
    }
    
    // Defer pre-warming until first user interaction to avoid autoplay policy warnings
    this.setupUserInteractionListener();
  }
  
  private setupUserInteractionListener(): void {
    const startAudioContext = () => {
      if (!this.hasUserInteracted) {
        this.hasUserInteracted = true;
        this.prewarmAudioContext();
        // Remove listeners after first interaction
        document.removeEventListener('click', startAudioContext);
        document.removeEventListener('keydown', startAudioContext);
        document.removeEventListener('touchstart', startAudioContext);
      }
    };
    
    document.addEventListener('click', startAudioContext);
    document.addEventListener('keydown', startAudioContext);
    document.addEventListener('touchstart', startAudioContext);
  }
  
  /**
   * NEW: Pre-warm audio context to reduce first-play latency
   */
  private prewarmAudioContext(): void {
    try {
      // Check if we're in a context where audio context can be created
      if (typeof window !== 'undefined' && window.AudioContext) {
        this.prewarmedContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        // Create a silent buffer to initialize the audio pipeline
        const silentBuffer = this.prewarmedContext.createBuffer(1, 1, 22050);
        const source = this.prewarmedContext.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(this.prewarmedContext.destination);
        source.start();
      }
    } catch (e) {
      console.warn('[PIPER] Failed to pre-warm audio context:', e);
    }
  }

  public setConfig(config: Partial<PiperConfig>) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('jarvis_piper_config', JSON.stringify(this.config));
  }

  public getConfig(): PiperConfig {
    return { ...this.config };
  }

  /**
   * Switch to a different voice by name
   * @param voiceName The voice name (e.g., 'alan', 'joe', 'jarvis')
   * @returns True if voice was switched successfully
   */
  public async switchVoice(voiceName: string): Promise<boolean> {
    const oldVoice = this.config.defaultVoice;
    this.config.defaultVoice = voiceName;
    
    // Test if the new voice works
    try {
      const isAvailable = await this.isAvailable();
      if (isAvailable) {
        // Save the config
        localStorage.setItem('jarvis_piper_config', JSON.stringify(this.config));
        console.log(`[PIPER] Switched voice from "${oldVoice}" to "${voiceName}"`);
        return true;
      } else {
        // Revert if not available
        this.config.defaultVoice = oldVoice;
        console.warn(`[PIPER] Voice "${voiceName}" not available, reverted to "${oldVoice}"`);
        return false;
      }
    } catch (error) {
      this.config.defaultVoice = oldVoice;
      console.error(`[PIPER] Error switching voice:`, error);
      return false;
    }
  }

  /**
   * Get current voice information
   */
  public getCurrentVoiceInfo(): { name: string; isBritish: boolean; language: string } {
    const name = this.config.defaultVoice;
    const britishVoice = BRITISH_PIPER_VOICES.find(v => v.name === name);
    return {
      name,
      isBritish: britishVoice?.accent?.includes('British') || britishVoice?.accent?.includes('Scotland') || britishVoice?.accent?.includes('England') || false,
      language: britishVoice?.accent || 'Unknown'
    };
  }

  /**
   * Check if Piper server is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available voices from Piper server
   * Falls back to local detection if server is not available
   */
  public async getVoices(): Promise<PiperVoice[]> {
    try {
      const response = await fetch(`${this.config.serverUrl}/voices`);
      if (!response.ok) throw new Error('Failed to fetch voices');
      return await response.json();
    } catch (error) {
      console.warn('[PIPER] Server not available for voice list, falling back to local detection');
      // Fallback: try to detect voices locally
      return this.detectLocalVoices();
    }
  }

  /**
   * Detect available voices from local filesystem
   * This works even if the server isn't running
   */
  private detectLocalVoices(): PiperVoice[] {
    // In browser context, we can't directly scan filesystem
    // But we can check common voice names based on what's typically installed
    const commonVoices = [
      { name: 'jarvis', language: 'en_US', quality: 'high' as const },
      { name: 'alan', language: 'en_GB', quality: 'medium' as const },
      { name: 'joe', language: 'en_GB', quality: 'medium' as const },
      { name: 'amy', language: 'en_GB', quality: 'medium' as const },
      { name: 'libritts_rmedium', language: 'en_US', quality: 'medium' as const },
      { name: 'lessac', language: 'en_US', quality: 'high' as const },
      { name: 'arctic', language: 'en_US', quality: 'medium' as const }
    ];
    
    // Return voices that might be installed based on platform
    // The actual availability will be determined when the server starts
    return commonVoices;
  }

  /**
   * Synthesize speech using Piper - OPTIMIZED with streaming
   */
  private lastSpokenText: string = '';
  private lastSpokenTimestamp: number = 0;

  public async speak(text: string, onComplete?: () => void): Promise<boolean> {
    if (!text.trim()) {
      onComplete?.();
      return true;
    }

    // Prevent duplicate responses within a short timeframe
    const now = Date.now();
    if (this.lastSpokenText === text && (now - this.lastSpokenTimestamp) < 3000) {
      console.log('[PIPER] Duplicate response prevented:', text.substring(0, 50) + '...');
      onComplete?.();
      return true;
    }

    // Store the spoken text and timestamp
    this.lastSpokenText = text;
    this.lastSpokenTimestamp = now;

    try {
      // NEW: Split text into chunks for streaming
      const chunks = this.config.enableStreaming
        ? this.splitTextIntoChunks(text, this.config.chunkSize)
        : [text];

      if (chunks.length === 1) {
        // Single chunk - simple path
        return await this.speakSingleChunk(text, onComplete);
      } else {
        // Multiple chunks - stream them
        return await this.speakStreaming(chunks, onComplete);
      }
    } catch (error) {
      console.error('[PIPER] TTS failed:', error);
      return false;
    }
  }
  
  /**
   * NEW: Speak a single chunk of text
   */
  private async speakSingleChunk(text: string, onComplete?: () => void): Promise<boolean> {
    const audioData = await this.synthesizeChunk(text);
    if (!audioData) return false;
    
    await this.playAudio(audioData, onComplete);
    return true;
  }
  
  /**
   * NEW: Stream multiple chunks with overlapping generation/playback
   */
  private async speakStreaming(chunks: string[], onComplete?: () => void): Promise<boolean> {
    this.audioQueue = [];
    this.isPlaying = false;
    
    // Start generating first chunk immediately
    let generationPromise = this.synthesizeChunk(chunks[0]);
    
    for (let i = 0; i < chunks.length; i++) {
      // Wait for current chunk to be generated
      const audioData = await generationPromise;
      
      if (!audioData) {
        console.error(`[PIPER] Failed to generate chunk ${i}`);
        continue;
      }
      
      // Start generating next chunk while playing current
      if (i < chunks.length - 1) {
        generationPromise = this.synthesizeChunk(chunks[i + 1]);
      }
      
      // Play current chunk
      const isLastChunk = i === chunks.length - 1;
      await this.playAudio(audioData, isLastChunk ? onComplete : undefined);
    }
    
    return true;
  }
  
  /**
   * NEW: Synthesize a single chunk of text
   */
  private async synthesizeChunk(text: string): Promise<ArrayBuffer | null> {
    const response = await fetch(`${this.config.serverUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: this.config.defaultVoice,
        speaker_id: this.config.speakerId,
        length_scale: this.config.lengthScale,
        noise_scale: this.config.noiseScale,
        noise_w: this.config.noiseW
      }),
      signal: AbortSignal.timeout(10000) // 10 second timeout per chunk
    });

    if (!response.ok) {
      throw new Error(`Piper TTS failed: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }
  
  /**
   * NEW: Smart text chunking that respects NATURAL SPEECH boundaries
   * Keeps phrases together to avoid word-by-word staccato delivery
   */
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    // If short enough, speak as one continuous unit
    if (text.length <= maxChunkSize) return [text];
    
    const chunks: string[] = [];
    
    // Split into natural speech units: sentences first
    // Match sentences but keep the delimiter attached
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      // If a single sentence is too long, we need to find natural break points
      if (sentence.length > maxChunkSize) {
        // First save any accumulated chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Split long sentence on natural pause points: commas, semicolons, conjunctions
        // This regex matches: comma+space, semicolon+space, or conjunction words with spaces
        const naturalBreaks = sentence.split(/(,\s+|;\s+|\s+\b(and|but|or|so|yet|for|nor|because|since|although|while|if|when|where|which|who|that)\b\s+)/gi);
        
        let phraseBuffer = '';
        for (let i = 0; i < naturalBreaks.length; i++) {
          const segment = naturalBreaks[i];
          if (!segment) continue;
          
          // Skip standalone conjunctions/break markers (they're separators, not content)
          if (/^(,\s+|;\s+|and|but|or|so|yet|for|nor|because|since|although|while|if|when|where|which|who|that)$/i.test(segment.trim())) {
            phraseBuffer += segment;
            continue;
          }
          
          // Try to add this segment to the buffer
          if ((phraseBuffer + segment).length > maxChunkSize && phraseBuffer.trim()) {
            // Buffer is full - save it and start new
            chunks.push(phraseBuffer.trim());
            phraseBuffer = segment;
          } else {
            phraseBuffer += segment;
          }
        }
        
        // Don't lose the last part of the long sentence
        if (phraseBuffer.trim()) {
          currentChunk = phraseBuffer;
        }
      } 
      // Normal case: sentence fits in chunk
      else if ((currentChunk + sentence).length > maxChunkSize && currentChunk.trim()) {
        // Current chunk is full, save it and start fresh
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Add to current chunk
        currentChunk += sentence;
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Post-process: merge very small chunks with previous/next to avoid staccato effect
    const mergedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prevChunk = mergedChunks[mergedChunks.length - 1];
      
      // If this chunk is very short (less than 30 chars) and we have a previous chunk
      // AND combining them won't exceed max size, merge them
      if (chunk.length < 30 && prevChunk && (prevChunk.length + chunk.length + 1) <= maxChunkSize) {
        mergedChunks[mergedChunks.length - 1] = prevChunk + ' ' + chunk;
      } else {
        mergedChunks.push(chunk);
      }
    }
    
    return mergedChunks;
  }

  /**
   * Play audio data using Web Audio API - OPTIMIZED with pooling
   */
  private async playAudio(audioData: ArrayBuffer, onComplete?: () => void): Promise<void> {
    // Get or create audio context
    let audioCtx = this.getAudioContext();
    if (!audioCtx) {
      // Create a new context if none available
      try {
        // Check if we're in a browser context and handle autoplay policy
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Add to pool for reuse
        this.audioContextPool.push({ context: audioCtx, inUse: true });
      } catch (error) {
        console.error('[PIPER] Failed to create audio context:', error);
        throw new Error('Could not create audio context');
      }
    }

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended' || audioCtx.state === 'closed') {
      try {
        if (audioCtx.state === 'closed') {
          // If context was closed, we need to create a new one
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          // Add to pool for reuse
          this.audioContextPool.push({ context: audioCtx, inUse: true });
        }
        await audioCtx.resume();
      } catch (resumeError) {
        console.error('[PIPER] Failed to resume audio context:', resumeError);
        throw new Error('Could not resume audio context');
      }
    }

    // Piper returns WAV format, decode it
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(audioData);
    } catch (error) {
      console.error('[PIPER] Failed to decode audio data:', error);
      // Clean up the audio context if decoding fails
      try {
        const pooled = this.audioContextPool.find(p => p.context === audioCtx);
        if (pooled) {
          pooled.inUse = false;
        }
      } catch (cleanupError) {
        console.warn('[PIPER] Error cleaning up audio context:', cleanupError);
      }
      throw new Error('Failed to decode audio data');
    }

    // Wait for previous audio to finish if playing
    if (this.isPlaying) {
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isPlaying) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });
    }

    this.isPlaying = true;

    return new Promise((resolve) => {
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      // Add source to active sources set to track it
      this.activeSources.add(source);

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.currentSource === source) {
          this.currentSource = null;
        }

        // Only set isPlaying to false if this was the last source
        if (this.activeSources.size === 0) {
          this.isPlaying = false;
        }

        // Release the audio context back to the pool after playback
        const pooled = this.audioContextPool.find(p => p.context === audioCtx);
        if (pooled) {
          pooled.inUse = false;
        }

        onComplete?.();
        resolve();
      };

      // Handle errors
      (source as any).onerror = () => {
        this.activeSources.delete(source);
        if (this.currentSource === source) {
          this.currentSource = null;
        }

        if (this.activeSources.size === 0) {
          this.isPlaying = false;
        }

        // Release the audio context back to the pool after error
        const pooled = this.audioContextPool.find(p => p.context === audioCtx);
        if (pooled) {
          pooled.inUse = false;
        }

        console.error('[PIPER] Audio source error');
        resolve(); // Resolve to prevent hanging
      };

      // Check if we can actually start the source (autoplay policy)
      try {
        source.start();
        this.currentSource = source;
      } catch (startError) {
        console.error('[PIPER] Failed to start audio source:', startError);
        // This might be due to autoplay policy, try to handle gracefully
        if ((startError as Error).name === 'InvalidStateError' || (startError as Error).message?.includes('autoplay')) {
          console.warn('[PIPER] Autoplay policy preventing audio playback. User interaction required.');
          // Release the audio context back to the pool
          const pooled = this.audioContextPool.find(p => p.context === audioCtx);
          if (pooled) {
            pooled.inUse = false;
          }
          // Still call onComplete to continue the flow
          onComplete?.();
          resolve();
        } else {
          // Release the audio context back to the pool
          const pooled = this.audioContextPool.find(p => p.context === audioCtx);
          if (pooled) {
            pooled.inUse = false;
          }
          resolve(); // Resolve to prevent hanging
        }
      }
    });
  }
  
  /**
   * NEW: Get pooled audio context
   */
  private getAudioContext(): AudioContext | null {
    // First, try to use pre-warmed context
    if (this.prewarmedContext && this.prewarmedContext.state !== 'closed') {
      const ctx = this.prewarmedContext;
      this.prewarmedContext = null; // It's now in use
      return ctx;
    }

    // Try to find an available pooled context
    for (const pooled of this.audioContextPool) {
      if (!pooled.inUse && pooled.context.state !== 'closed') {
        pooled.inUse = true;
        return pooled.context;
      }
    }

    // Create new if pool not full
    if (this.audioContextPool.length < this.maxPoolSize) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audioContextPool.push({ context: ctx, inUse: true });
        return ctx;
      } catch (e) {
        console.warn('[PIPER] Failed to create audio context:', e);
      }
    }

    // If all contexts are in use, try to reuse an inactive one (but this is risky)
    // Instead, return null and let the caller handle creating a new context
    return null;
  }
  
  /**
   * NEW: Release audio context back to pool
   */
  private releaseAudioContext(ctx: AudioContext): void {
    const pooled = this.audioContextPool.find(p => p.context === ctx);
    if (pooled) {
      pooled.inUse = false;
    }
  }

  /**
   * Stop any playing audio
   */
  public stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors from already stopped source
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
  }
  
  /**
   * NEW: Preload/synthesize text in advance (for anticipated responses)
   */
  public async preload(text: string): Promise<ArrayBuffer | null> {
    try {
      return await this.synthesizeChunk(text);
    } catch (e) {
      console.warn('[PIPER] Preload failed:', e);
      return null;
    }
  }
  
  /**
   * NEW: Play preloaded audio
   */
  public async playPreloaded(audioData: ArrayBuffer, onComplete?: () => void): Promise<void> {
    await this.playAudio(audioData, onComplete);
  }
}

export const piperTTS = new PiperTTSService();

/**
 * Recommended Piper voices for JARVIS-like experience
 */
export const RECOMMENDED_PIPER_VOICES = [
  {
    name: 'jarvis',
    source: 'https://huggingface.co/jgkawell/jarvis',
    description: 'Named "JARVIS" but actually American male (Ryan dataset). NOT the movie voice.',
    quality: 'high',
    style: 'American male, professional',
    language: 'en_US',
    warning: 'This is NOT the British JARVIS from Iron Man movies - it\'s an American voice'
  },
  {
    name: 'alan',
    source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/alan',
    language: 'en_GB',
    description: 'British male - Medium quality, Scottish accent',
    quality: 'medium',
    style: 'Scottish male'
  },
  {
    name: 'libritts_rmedium',
    source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/libritts_rmedium',
    language: 'en_US',
    description: 'American male - Natural, medium quality',
    quality: 'medium',
    style: 'Natural American male'
  },
  {
    name: 'lessac',
    source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac',
    language: 'en_US',
    description: 'American female - High quality, natural',
    quality: 'high',
    style: 'Natural American female'
  },
  {
    name: 'amy',
    source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/amy',
    language: 'en_GB',
    description: 'British female - Medium quality, Southern English',
    quality: 'medium',
    style: 'Southern English female'
  },
  {
    name: 'joe',
    source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/joe',
    language: 'en_GB',
    description: 'British male - Medium quality, Northern English',
    quality: 'medium',
    style: 'Northern English male'
  }
];

/**
 * British voices available for Piper that actually sound British
 * For the true JARVIS experience (Paul Bettany-style)
 */
export const BRITISH_PIPER_VOICES = [
  {
    name: 'alan',
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json',
    accent: 'Scottish',
    gender: 'male',
    quality: 'medium'
  },
  {
    name: 'joe', 
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx.json',
    accent: 'Northern England',
    gender: 'male',
    quality: 'medium'
  },
  {
    name: 'amy',
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx.json',
    accent: 'Southern England',
    gender: 'female',
    quality: 'medium'
  },
  {
    name: 'arctic',
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic_medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic_medium.onnx.json',
    accent: 'American (but very professional sounding)',
    gender: 'male',
    quality: 'medium',
    note: 'Not British, but professional tone similar to JARVIS'
  }
];

/**
 * Helper function to download a voice file (for use in browser/node)
 */
export function getVoiceDownloadUrl(voiceName: string): { onnx: string; json: string } | null {
  const voice = BRITISH_PIPER_VOICES.find(v => v.name === voiceName);
  if (voice) {
    return { onnx: voice.url, json: voice.jsonUrl };
  }
  return null;
}

/**
 * Setup instructions for Piper
 */
export const PIPER_SETUP_INSTRUCTIONS = `
## Piper TTS Setup for JARVIS (OPTIMIZED)

### ⚠️ IMPORTANT: About the "JARVIS" Voice
The voice model named "jarvis" on HuggingFace is **NOT** the British JARVIS from Iron Man movies.
- It's an American male voice (trained on the "Ryan" dataset)
- It does NOT have a British accent
- For a true JARVIS-like experience, see British voice options below

### 1. Download Piper
- Windows: Download from https://github.com/rhasspy/piper/releases
- Extract to a folder (e.g., C:\\piper)

### 2. Download a Voice Model

#### Option A: British Voices (for that JARVIS feel)
| Voice | Accent | Quality | Download Links |
|-------|--------|---------|----------------|
| alan | Scottish | Medium | [ONNX](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx) / [JSON](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json) |
| joe | Northern England | Medium | [ONNX](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx) / [JSON](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx.json) |
| amy | Southern England | Medium | [ONNX](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx) / [JSON](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx.json) |

#### Option B: American Voices
| Voice | Description | Quality | Download Links |
|-------|-------------|---------|----------------|
| libritts_rmedium | Natural male | Medium | [ONNX](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx) / [JSON](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx.json) |
| lessac | Natural female | High | [ONNX](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx) / [JSON](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json) |

### 3. Place Voice Files
Put both the .onnx and .onnx.json files in your Piper/voices/ folder:
\`\`\`
Piper/
  └── voices/
      ├── alan.onnx
      ├── alan.onnx.json
      ├── jarvis.onnx
      └── jarvis.onnx.json
\`\`\`

### 4. Start Piper Server with Your Chosen Voice

**For British voice (alan):**
\`\`\`
cd C:\\piper
piper.exe --http-server --model voices/alan.onnx
\`\`\`

**For American voice (jarvis):**
\`\`\`
cd C:\\piper  
piper.exe --http-server --model voices/jarvis.onnx
\`\`\`

### 5. Configure JARVIS
- Open JARVIS Settings
- Go to Voice tab
- Select "Piper Local" as voice type
- Set voice name to match your file (e.g., "alan" or "jarvis")
- Set speed to 0.85 for natural flow
- Test the voice!

### Optimization Tips:

1. **Use length_scale=0.85**: Natural speech speed
2. **Enable streaming**: Chunks long text for faster start  
3. **Pre-warm audio**: Reduces first-play latency
4. **Use GPU if available**: Piper supports CUDA acceleration
5. **British voices**: The "alan" voice has the closest vibe to movie JARVIS

### Voice Comparison
- **alan**: Scottish male, professional, closest to authoritative AI feel
- **joe**: Northern English, casual
- **jarvis**: American male, NOT the movie voice
- **libritts_rmedium**: Natural American male, good clarity
`;
