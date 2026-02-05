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
  lengthScale: 0.90, // Slower speech for better clarity and flow (higher = slower)
  noiseScale: 0.667,
  noiseW: 0.8,
  enableStreaming: true, // NEW: Enable streaming by default
  chunkSize: 150, // NEW: Characters per chunk
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
    
    // NEW: Pre-warm audio context
    this.prewarmAudioContext();
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
   */
  public async getVoices(): Promise<PiperVoice[]> {
    try {
      const response = await fetch(`${this.config.serverUrl}/voices`);
      if (!response.ok) throw new Error('Failed to fetch voices');
      return await response.json();
    } catch (error) {
      console.error('[PIPER] Failed to get voices:', error);
      return [];
    }
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
   * NEW: Smart text chunking that respects sentence boundaries
   */
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    if (text.length <= maxChunkSize) return [text];
    
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      // If single sentence is too long, split on commas
      if (sentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        const parts = sentence.split(/,(?=\s)/);
        for (const part of parts) {
          if ((currentChunk + part).length > maxChunkSize && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = part;
          } else {
            currentChunk += part;
          }
        }
      } else if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
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
      source.onerror = () => {
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
        if (startError.name === 'InvalidStateError' || startError.message.includes('autoplay')) {
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
    description: 'JARVIS from Iron Man - Best match for JARVIS assistant',
    quality: 'high',
    style: 'British, professional, calm'
  },
  {
    name: 'alan',
    language: 'en_GB',
    description: 'British male - Professional, authoritative',
    quality: 'high'
  },
  {
    name: 'joe',
    language: 'en_US',
    description: 'American male - Clear, neutral',
    quality: 'high'
  },
  {
    name: 'kristin',
    language: 'en_US',
    description: 'American female - Professional',
    quality: 'high'
  }
];

/**
 * Setup instructions for Piper
 */
export const PIPER_SETUP_INSTRUCTIONS = `
## Piper TTS Setup for JARVIS (OPTIMIZED)

### 1. Download Piper
- Windows: Download from https://github.com/rhasspy/piper/releases
- Extract to a folder (e.g., C:\\piper)

### 2. Download JARVIS Voice
- Go to: https://huggingface.co/jgkawell/jarvis
- Download: jarvis.onnx and jarvis.onnx.json
- Place in your piper/voices/ folder

### 3. Start Piper Server
Open Command Prompt and run:
\`\`\`
cd C:\\piper
piper.exe --http-server --model voices/jarvis.onnx
\`\`\`

### 4. Configure JARVIS
- Open JARVIS Settings
- Go to Voice tab
- Select "Piper Local" as voice type
- Set speed to 0.75 for faster responses
- Test the voice!

### Optimization Tips:

1. **Use length_scale=0.75**: Faster speech without quality loss
2. **Enable streaming**: Chunks long text for faster start
3. **Pre-warm audio**: Reduces first-play latency
4. **Use GPU if available**: Piper supports CUDA acceleration
5. **Chunk size 150**: Good balance for streaming

### Alternative: Docker (Recommended for advanced users)
\`\`\`bash
docker run -it -p 5000:5000 \
  -v "$(pwd)/voices:/voices" \
  rhasspy/wyoming-piper \
  --voice jarvis
\`\`\`
`;
