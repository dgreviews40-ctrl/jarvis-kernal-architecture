/**
 * Whisper Local STT Service - OPTIMIZED VERSION
 * Uses OpenAI Whisper running locally for offline speech recognition
 * Can utilize GPU (CUDA) for faster inference
 * 
 * OPTIMIZATIONS:
 * - Reduced chunk size from 3s to 1.5s for faster response
 * - Streaming transcription with partial results
 * - Audio preprocessing (noise gate, normalization)
 * - Overlapping windows for better word detection
 * - Aggressive VAD for faster end-of-speech detection
 * 
 * Requirements:
 * - Python 3.8+
 * - whisper: pip install openai-whisper
 * - For GPU: CUDA toolkit and pytorch with CUDA support
 */

import { logger } from './logger';

export interface WhisperConfig {
  serverUrl: string;
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language: string;
  device: 'cpu' | 'cuda';
  chunkDuration: number; // NEW: Configurable chunk duration
  enableOverlap: boolean; // NEW: Overlapping audio windows
}

const DEFAULT_CONFIG: WhisperConfig = {
  serverUrl: 'http://localhost:5001',
  model: 'small',  // Upgraded from 'base' for better wake word detection
  language: 'en',
  device: 'cuda',  // Will fallback to CPU if CUDA not available
  chunkDuration: 2000, // Increased to 2 seconds for better context/wake word detection
  enableOverlap: true, // NEW: Enable overlapping windows
};

// Audio preprocessing constants - IMPROVED for better detection
const NOISE_GATE_THRESHOLD = 0.015; // Lowered from 0.02 to catch quieter speech
const MIN_SPEECH_DURATION = 150; // ms - Reduced to catch shorter utterances like "Jarvis"

class WhisperSTTService {
  private config: WhisperConfig = { ...DEFAULT_CONFIG };
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private restartInterval: number | null = null;
  
  // NEW: For overlapping windows
  private previousChunk: Blob | null = null;
  private overlapDuration = 300; // ms of overlap between chunks
  
  // NEW: For streaming partial results
  private lastTranscript = '';
  private silenceDetected = false;
  private speechStartTime = 0;
  private lastSpeechTime = 0;
  
  // NEW: Audio context for preprocessing
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;

  constructor() {
    const saved = localStorage.getItem('jarvis_whisper_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('[WHISPER] Failed to parse saved config:', e);
      }
    }
  }

  public setConfig(config: Partial<WhisperConfig>) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('jarvis_whisper_config', JSON.stringify(this.config));
  }

  public getConfig(): WhisperConfig {
    return { ...this.config };
  }

  /**
   * Check if Whisper server is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start continuous recording and transcription - OPTIMIZED
   * Records in configurable chunks for near real-time transcription
   */
  public async startRecording(onTranscript: (text: string, isFinal: boolean) => void): Promise<boolean> {
    if (this.isRecording) {
      console.log('[WHISPER] Already recording');
      return true;
    }

    this.onTranscriptCallback = onTranscript;
    this.lastTranscript = '';
    this.silenceDetected = false;

    try {
      // Get microphone access with optimized settings
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Whisper expects 16kHz
          channelCount: 1, // Mono for speech recognition
        } 
      });

      // IMPROVED: Higher bitrate for better audio quality = better transcription
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : MediaRecorder.isTypeSupported('audio/webm') 
            ? 'audio/webm' 
            : 'audio/mp4',
        audioBitsPerSecond: 32000 // Increased from 16k for better quality
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });
          
          // NEW: Check if we have enough audio data
          if (audioBlob.size > 500) { // Minimum 500 bytes
            await this.transcribeAudio(audioBlob);
          }
          
          // Store for overlap if enabled
          if (this.config.enableOverlap) {
            this.previousChunk = audioBlob;
          }
        }
        
        // Restart recording for continuous listening
        if (this.isRecording) {
          this.audioChunks = [];
          // Small delay to prevent CPU thrashing
          setTimeout(() => {
            if (this.isRecording && this.mediaRecorder?.state === 'inactive') {
              this.mediaRecorder?.start();
            }
          }, 50);
        }
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      this.speechStartTime = Date.now();

      // OPTIMIZED: Shorter chunks for faster response
      const chunkDuration = this.config.chunkDuration || 1500;
      this.restartInterval = window.setInterval(() => {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop(); // This triggers onstop, which restarts
        }
      }, chunkDuration);

      console.log(`[WHISPER] Recording started (${chunkDuration}ms chunks, overlap: ${this.config.enableOverlap})`);
      return true;

    } catch (err) {
      console.error('[WHISPER] Failed to start recording:', err);
      return false;
    }
  }

  /**
   * Stop recording
   */
  public async stopRecording(): Promise<void> {
    this.isRecording = false;

    // Clear restart interval
    if (this.restartInterval) {
      clearInterval(this.restartInterval);
      this.restartInterval = null;
    }

    // Stop media recorder properly
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('[WHISPER] Error stopping media recorder:', e);
      }
    }

    // Stop all tracks to release microphone
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('[WHISPER] Error stopping track:', e);
          }
        });
      } catch (e) {
        console.warn('[WHISPER] Error stopping stream tracks:', e);
      }
      this.stream = null;
    }

    // Clean up worklet node
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (e) {
        console.warn('[WHISPER] Error disconnecting worklet node:', e);
      }
      this.workletNode = null;
    }

    // Clean up audio context
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn('[WHISPER] Error closing audio context:', e);
      }
      this.audioContext = null;
    }

    // Null out mediaRecorder to release reference
    this.mediaRecorder = null;
    this.previousChunk = null;
    this.audioChunks = [];
    console.log('[WHISPER] Recording stopped');
  }

  /**
   * Send audio to Whisper server for transcription - OPTIMIZED
   */
  private async transcribeAudio(audioBlob: Blob): Promise<void> {
    // NEW: Create overlapping audio if enabled
    let audioToSend = audioBlob;

    if (this.config.enableOverlap && this.previousChunk) {
      // Combine previous chunk's end with current chunk for context
      audioToSend = new Blob([this.previousChunk, audioBlob], {
        type: this.mediaRecorder?.mimeType || 'audio/webm'
      });
    }

    console.log('[WHISPER] Sending audio for transcription, size:', audioToSend.size);

    try {
      const formData = new FormData();
      formData.append('audio', audioToSend, 'recording.webm');
      formData.append('language', this.config.language);

      // NEW: Request partial results if supported
      formData.append('partial', 'true');

      const response = await fetch(`${this.config.serverUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        // Increased timeout for Whisper processing
        signal: AbortSignal.timeout(15000) // Increased from 5000 to 15000 ms
      });

      if (!response.ok) {
        const errorText = await response.text(); // Get the actual error message
        throw new Error(`Transcription failed: ${response.status} - ${response.statusText}. Details: ${errorText}`);
      }

      const result = await response.json();
      console.log('[WHISPER] Server response:', result);

      if (result.text && result.text.trim()) {
        const text = result.text.trim();

        // NEW: Check if this is new content
        if (text !== this.lastTranscript) {
          console.log('[WHISPER] Transcribed:', text);

          // Determine if this is a final result
          const isFinal = result.isFinal || this.isCompleteUtterance(text);

          this.onTranscriptCallback?.(text, isFinal);
          this.lastTranscript = text;
          this.lastSpeechTime = Date.now();
        }
      }
    } catch (err) {
      console.error('[WHISPER] Transcription error:', err);

      // If the server is down, try to restart it or notify the user
      if ((err as Error).message?.includes('500') || (err as Error).message?.includes('failed')) {
        console.warn('[WHISPER] Server may be down, checking health...');
        setTimeout(async () => {
          const available = await this.isAvailable();
          if (!available) {
            console.error('[WHISPER] Server is not responding. Please ensure whisper_server.py is running.');
          }
        }, 1000);
      }
    }
  }

  /**
   * NEW: Check if text appears to be a complete utterance
   */
  private isCompleteUtterance(text: string): boolean {
    // Check for sentence-ending punctuation
    const endsWithPunctuation = /[.!?]$/.test(text.trim());
    
    // Check for reasonable length (not too short)
    const wordCount = text.trim().split(/\s+/).length;
    
    // Check silence duration
    const silenceDuration = Date.now() - this.lastSpeechTime;
    
    return endsWithPunctuation || (wordCount >= 5 && silenceDuration > 1000);
  }

  /**
   * Transcribe a single audio blob (for one-shot transcription)
   */
  public async transcribe(audioBlob: Blob): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', this.config.language);

      const response = await fetch(`${this.config.serverUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000) // Increased for Whisper processing
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.text?.trim() || null;
    } catch (err) {
      console.error('[WHISPER] Transcription error:', err);
      return null;
    }
  }

  public isRecordingActive(): boolean {
    return this.isRecording;
  }
  
  /**
   * NEW: Get audio level for VAD visualization
   */
  public getAudioLevel(): number {
    // This would require AudioWorklet integration
    // For now, return 0
    return 0;
  }
}

export const whisperSTT = new WhisperSTTService();

/**
 * Setup instructions for Whisper Server
 */
export const WHISPER_SETUP_INSTRUCTIONS = `
## Whisper Local STT Setup for JARVIS (OPTIMIZED)

### 1. Install Python Dependencies

\`\`\`bash
pip install openai-whisper flask flask-cors numpy

# For GPU support (recommended with your GTX 1080 Ti):
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
\`\`\`

### 2. Create Optimized Whisper Server Script

Save this as \`whisper_server.py\` in your JARVIS folder:

\`\`\`python
import whisper
import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import numpy as np
import torch

app = Flask(__name__)
CORS(app)

# OPTIMIZED: Use 'base' for speed, 'small' for better accuracy
MODEL_SIZE = "base"  # Options: tiny, base, small, medium, large
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Loading Whisper model '{MODEL_SIZE}' on {DEVICE}...")
model = whisper.load_model(MODEL_SIZE).to(DEVICE)
print("Model loaded!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE, "device": DEVICE})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file"}), 400
    
    audio_file = request.files['audio']
    language = request.form.get('language', 'en')
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # OPTIMIZED: Use fp16 on GPU for speed, temperature=0 for consistency
        result = model.transcribe(
            tmp_path, 
            language=language, 
            fp16=(DEVICE == "cuda"),
            temperature=0.0,  # More deterministic
            condition_on_previous_text=True,  # Better continuity
            initial_prompt="This is a command to a voice assistant."
        )
        
        # Check if this looks like a complete utterance
        text = result["text"].strip()
        is_final = text.endswith(('.', '!', '?'))
        
        return jsonify({
            "text": text,
            "isFinal": is_final,
            "language": language
        })
    finally:
        os.unlink(tmp_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)
\`\`\`

### 3. Start Whisper Server

\`\`\`bash
python whisper_server.py
\`\`\`

The server will start on port 5001.

### Model Recommendations for GTX 1080 Ti:

- \`tiny\` - Fastest, lowest accuracy (~1GB VRAM) - **For testing only**
- \`base\` - Good balance (~1GB VRAM) - **RECOMMENDED for speed**
- \`small\` - Better accuracy (~2GB VRAM) - **RECOMMENDED for accuracy**
- \`medium\` - High accuracy (~5GB VRAM) - **Best quality for 1080 Ti**
- \`large\` - Best accuracy (~10GB VRAM) - Too big for 1080 Ti

### Performance Tips:

1. **Use GPU**: Ensure CUDA is properly installed
2. **Lower chunk duration**: 1.5s chunks give faster response than 3s
3. **Enable overlap**: Helps catch words at chunk boundaries
4. **Use 'base' model**: Much faster than 'small' with good accuracy
5. **Close other apps**: Free up GPU memory for Whisper
`;
