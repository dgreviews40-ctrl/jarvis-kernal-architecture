/**
 * Audio Analyzer Service
 * Provides real-time FFT analysis for the JARVIS waveform visualization
 * Follows the JarvisPresenceWaveform spec v1.0
 */

export interface AudioFeatures {
  fft: Float32Array;        // FFT spectrum data
  rms: number;              // Root mean square volume (0-1)
  peak: number;             // Peak energy (0-1)
  spectralCentroid: number; // Brightness bias (0-1)
  zeroCrossRate: number;    // Edge sharpness (0-1)
}

export type AudioDataCallback = (features: AudioFeatures) => void;

class AudioAnalyzerService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private callbacks: Set<AudioDataCallback> = new Set();
  
  // FFT configuration per spec: ≥1024 bins
  private fftSize = 2048;  // Gives us 1024 frequency bins
  private smoothingTimeConstant = 0.8;
  
  // Analysis buffers
  private fftBuffer: Float32Array;
  private timeBuffer: Float32Array;
  
  constructor() {
    this.fftBuffer = new Float32Array(this.fftSize / 2);
    this.timeBuffer = new Float32Array(this.fftSize);
  }
  
  /**
   * Initialize audio analysis from microphone
   */
  async initialize(): Promise<boolean> {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      });
      
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      // Create analyser node per spec: ≥1024 FFT bins
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      
      // Connect stream to analyser
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      
      // Start analysis loop
      this.startAnalysis();
      
      console.log('[AudioAnalyzer] Initialized with FFT size:', this.fftSize);
      return true;
    } catch (error) {
      console.error('[AudioAnalyzer] Failed to initialize:', error);
      return false;
    }
  }
  
  /**
   * Subscribe to audio feature updates
   */
  subscribe(callback: AudioDataCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }
  
  /**
   * Start the analysis loop (60fps)
   */
  private startAnalysis(): void {
    const analyze = () => {
      if (!this.analyser) return;
      
      // Get FFT data (frequency domain)
      this.analyser.getFloatFrequencyData(this.fftBuffer);
      
      // Get time domain data for zero-crossing rate
      this.analyser.getFloatTimeDomainData(this.timeBuffer);
      
      // Extract features per spec
      const features = this.extractFeatures();
      
      // Notify all subscribers
      this.callbacks.forEach(cb => {
        try {
          cb(features);
        } catch (e) {
          console.error('[AudioAnalyzer] Callback error:', e);
        }
      });
      
      this.animationFrame = requestAnimationFrame(analyze);
    };
    
    this.animationFrame = requestAnimationFrame(analyze);
  }
  
  /**
   * Extract audio features per Jarvis spec
   */
  private extractFeatures(): AudioFeatures {
    // Convert FFT from dB to linear magnitude (0-1)
    const fft = new Float32Array(this.fftBuffer.length);
    let totalEnergy = 0;
    let peakEnergy = 0;
    let weightedFrequency = 0;
    
    for (let i = 0; i < this.fftBuffer.length; i++) {
      // Convert dB to linear: 10^(dB/20)
      const magnitude = Math.pow(10, this.fftBuffer[i] / 20);
      fft[i] = magnitude;
      totalEnergy += magnitude;
      
      if (magnitude > peakEnergy) {
        peakEnergy = magnitude;
      }
      
      // For spectral centroid (brightness)
      weightedFrequency += i * magnitude;
    }
    
    // RMS volume calculation from time domain
    let sumSquares = 0;
    let zeroCrossings = 0;
    
    for (let i = 0; i < this.timeBuffer.length; i++) {
      sumSquares += this.timeBuffer[i] * this.timeBuffer[i];
      
      // Zero-crossing rate
      if (i > 0) {
        if ((this.timeBuffer[i] >= 0 && this.timeBuffer[i - 1] < 0) ||
            (this.timeBuffer[i] < 0 && this.timeBuffer[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
    }
    
    const rms = Math.sqrt(sumSquares / this.timeBuffer.length);
    const zeroCrossRate = zeroCrossings / this.timeBuffer.length;
    
    // Spectral centroid (normalized to 0-1)
    const spectralCentroid = totalEnergy > 0 
      ? weightedFrequency / (totalEnergy * this.fftBuffer.length)
      : 0;
    
    return {
      fft,
      rms: Math.min(rms * 4, 1), // Scale up and clamp
      peak: Math.min(peakEnergy * 2, 1),
      spectralCentroid: Math.min(spectralCentroid * 4, 1),
      zeroCrossRate: Math.min(zeroCrossRate * 10, 1)
    };
  }
  
  /**
   * Get frequency range indices for specific Hz ranges
   * Used by waveform layers per spec
   */
  getFrequencyRange(lowHz: number, highHz: number): { start: number; end: number } {
    if (!this.audioContext) return { start: 0, end: 0 };
    
    const nyquist = this.audioContext.sampleRate / 2;
    const binCount = this.fftSize / 2;
    
    const start = Math.floor((lowHz / nyquist) * binCount);
    const end = Math.min(Math.floor((highHz / nyquist) * binCount), binCount);
    
    return { start, end };
  }
  
  /**
   * Stop analysis and cleanup
   */
  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.callbacks.clear();
    
    console.log('[AudioAnalyzer] Destroyed');
  }
  
  /**
   * Check if analyzer is active
   */
  isActive(): boolean {
    return this.analyser !== null && this.audioContext?.state === 'running';
  }
}

// Singleton instance
export const audioAnalyzer = new AudioAnalyzerService();
export default audioAnalyzer;
