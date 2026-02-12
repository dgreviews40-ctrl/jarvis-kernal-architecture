/**
 * Advanced Vision Pipeline for JARVIS
 * 
 * Provides video stream processing, batch frame analysis, and visual memory:
 * - Video stream frame sampling at configurable FPS
 * - Batch processing for efficient GPU utilization
 * - Visual memory with temporal queries ("What did I see 5 minutes ago?")
 * - Object tracking across frames
 * 
 * Hardware: GTX 1080 Ti 11GB
 */

import { logger } from './logger';
import { EventEmitter } from './eventEmitter';
import { gpuMonitor } from './gpuMonitor';

// Configuration
const VISION_CONFIG = {
  // Frame sampling rate for video streams
  defaultSampleFps: 1,  // 1 frame per second by default
  maxSampleFps: 5,      // Max 5 FPS to prevent overload
  
  // Batch processing
  maxBatchSize: 8,      // Process up to 8 frames at once
  batchTimeoutMs: 500,  // Wait up to 500ms to fill batch
  
  // Visual memory
  visualMemoryDurationMs: 10 * 60 * 1000, // Keep 10 minutes of visual memory
  maxStoredFrames: 600,  // Max frames to store (~10 min at 1 FPS)
  
  // Object tracking
  enableTracking: true,
  trackingConfidenceThreshold: 0.7,
  
  // Vision server endpoint
  visionServerUrl: 'http://localhost:5004',
  
  // GPU memory management
  maxGpuMemoryPercent: 80,  // Pause processing if GPU memory > 80%
};

// Types
export interface VideoFrame {
  id: string;
  timestamp: number;
  source: string;  // e.g., 'webcam', 'camera-1', 'stream-url'
  imageData: string;  // Base64 encoded image
  metadata?: {
    width?: number;
    height?: number;
    fps?: number;
  };
}

export interface FrameAnalysis {
  frameId: string;
  timestamp: number;
  description: string;
  tags: string[];
  embedding: number[];
  objects: DetectedObject[];
  confidence: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number];  // [x, y, width, height]
  tracked?: boolean;
  trackId?: string;
}

export interface VisualMemoryEntry {
  id: string;
  timestamp: number;
  source: string;
  description: string;
  tags: string[];
  objects: string[];
  thumbnail?: string;
  embedding: number[];
}

export interface BatchProcessResult {
  frames: FrameAnalysis[];
  batchTimeMs: number;
  gpuUtilization: number;
}

/**
 * Vision Pipeline Service
 * 
 * Manages video stream processing and visual memory
 */
class VisionPipelineService extends EventEmitter {
  private visualMemory: VisualMemoryEntry[] = [];
  private activeStreams: Map<string, {
    source: MediaStream | string;
    sampleFps: number;
    lastSampleTime: number;
    frameCount: number;
    intervalId: NodeJS.Timeout;
    videoElement?: HTMLVideoElement;
  }> = new Map();
  private batchQueue: VideoFrame[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private initialized: boolean = false;
  private visionServerAvailable: boolean = false;
  private memoryCleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.checkVisionServer();
  }

  /**
   * Initialize the vision pipeline
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Check GPU availability
      const gpuStats = gpuMonitor.getCurrentStats();
      if (!gpuStats) {
        logger.log('VISION', 'GPU monitor not available, continuing without GPU stats', 'warning');
      }

      // Check vision server
      await this.checkVisionServer();
      
      if (!this.visionServerAvailable) {
        logger.log('VISION', 'Vision server not available, some features disabled', 'warning');
      }

      // Start visual memory cleanup
      this.startMemoryCleanup();
      
      this.initialized = true;
      this.emit('initialized');
      logger.log('VISION', 'Vision Pipeline initialized', 'success');
      
      return true;
    } catch (error) {
      logger.log('VISION', `Initialization failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Sample frames from a video stream
   */
  async sampleVideoStream(
    stream: MediaStream,
    options: {
      fps?: number;
      sourceName?: string;
      maxDurationMs?: number;
    } = {}
  ): Promise<VideoFrame[]> {
    const fps = Math.min(options.fps || VISION_CONFIG.defaultSampleFps, VISION_CONFIG.maxSampleFps);
    const sourceName = options.sourceName || `stream-${Date.now()}`;
    const intervalMs = 1000 / fps;
    
    // Check if stream already exists
    if (this.activeStreams.has(sourceName)) {
      logger.log('VISION', `Stream ${sourceName} already exists, stopping previous`, 'warning');
      this.stopSampling(sourceName);
    }
    
    logger.log('VISION', `Starting video sampling: ${sourceName} at ${fps} FPS`, 'info');
    
    const frames: VideoFrame[] = [];
    const startTime = Date.now();
    
    // Create video element to capture frames
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;  // Mute to avoid autoplay issues
    
    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video stream'));
      
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Video load timeout')), 5000);
      
      video.play().catch(err => reject(err));
    });

    // Sample frames
    const sampleInterval = setInterval(() => {
      // Check if stream still exists (might have been stopped)
      if (!this.activeStreams.has(sourceName)) {
        clearInterval(sampleInterval);
        video.pause();
        video.srcObject = null;
        return;
      }
      
      // Check duration limit
      if (options.maxDurationMs && Date.now() - startTime > options.maxDurationMs) {
        this.stopSampling(sourceName);
        this.emit('samplingComplete', { source: sourceName, frameCount: frames.length });
        return;
      }
      
      // Check GPU memory
      const gpuStats = gpuMonitor.getCurrentStats();
      if (gpuStats && gpuStats.vram_percent > VISION_CONFIG.maxGpuMemoryPercent) {
        logger.log('VISION', 'GPU memory high, pausing sampling', 'warning');
        return;
      }

      try {
        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          
          const frame: VideoFrame = {
            id: `frame-${sourceName}-${Date.now()}-${frames.length}`,
            timestamp: Date.now(),
            source: sourceName,
            imageData: imageData.split(',')[1],  // Remove data URL prefix
            metadata: {
              width: canvas.width,
              height: canvas.height,
              fps
            }
          };
          
          frames.push(frame);
          this.emit('frameCaptured', frame);
          
          // Update stream stats
          const streamInfo = this.activeStreams.get(sourceName);
          if (streamInfo) {
            streamInfo.frameCount++;
            streamInfo.lastSampleTime = Date.now();
          }
          
          // Add to batch queue for processing
          this.queueFrameForBatchProcessing(frame);
        }
      } catch (error) {
        logger.log('VISION', `Frame capture error: ${error}`, 'error');
      }
    }, intervalMs);

    // Store stream reference
    this.activeStreams.set(sourceName, {
      source: stream,
      sampleFps: fps,
      lastSampleTime: Date.now(),
      frameCount: 0,
      intervalId: sampleInterval,
      videoElement: video
    });

    return frames;
  }

  /**
   * Stop sampling a video stream
   */
  stopSampling(sourceName: string): boolean {
    const stream = this.activeStreams.get(sourceName);
    if (stream) {
      // Clear the interval
      clearInterval(stream.intervalId);
      
      // Clean up video element
      if (stream.videoElement) {
        stream.videoElement.pause();
        stream.videoElement.srcObject = null;
      }
      
      this.activeStreams.delete(sourceName);
      this.emit('samplingStopped', { source: sourceName });
      logger.log('VISION', `Stopped sampling: ${sourceName} (captured ${stream.frameCount} frames)`, 'info');
      return true;
    }
    return false;
  }

  /**
   * Process frames in batch for efficiency
   */
  async processBatch(frames: VideoFrame[]): Promise<BatchProcessResult> {
    if (frames.length === 0) {
      return { frames: [], batchTimeMs: 0, gpuUtilization: 0 };
    }

    const startTime = Date.now();
    this.isProcessing = true;
    this.emit('batchStart', { frameCount: frames.length });

    try {
      // Process frames in parallel (up to batch size)
      const results: FrameAnalysis[] = [];
      
      for (let i = 0; i < frames.length; i += VISION_CONFIG.maxBatchSize) {
        const batch = frames.slice(i, i + VISION_CONFIG.maxBatchSize);
        
        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(frame => this.analyzeFrame(frame))
        );
        
        results.push(...batchResults);
        
        // Add to visual memory
        for (let j = 0; j < batch.length; j++) {
          this.addToVisualMemory(batch[j], batchResults[j]);
        }
        
        // Small delay between batches to prevent GPU overload
        if (i + VISION_CONFIG.maxBatchSize < frames.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      const batchTimeMs = Date.now() - startTime;
      const gpuStats = gpuMonitor.getCurrentStats();
      
      this.emit('batchComplete', { 
        frameCount: frames.length, 
        batchTimeMs,
        avgTimePerFrame: batchTimeMs / frames.length
      });

      return {
        frames: results,
        batchTimeMs,
        gpuUtilization: gpuStats?.gpu_utilization || 0
      };
    } catch (error) {
      logger.log('VISION', `Batch processing error: ${error}`, 'error');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Analyze a single frame
   */
  async analyzeFrame(frame: VideoFrame): Promise<FrameAnalysis> {
    try {
      if (!this.visionServerAvailable) {
        return this.getFallbackAnalysis(frame);
      }

      const response = await fetch(`${VISION_CONFIG.visionServerUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frame.imageData,
          include_embedding: true
        })
      });

      if (!response.ok) {
        throw new Error(`Vision server error: ${response.status}`);
      }

      const result = await response.json();

      return {
        frameId: frame.id,
        timestamp: frame.timestamp,
        description: result.description || result.caption || 'No description available',
        tags: result.tags || [],
        embedding: result.embedding || [],
        objects: result.objects || [],
        confidence: result.confidence || 0.8
      };
    } catch (error) {
      logger.log('VISION', `Frame analysis error: ${error}`, 'warning');
      return this.getFallbackAnalysis(frame);
    }
  }

  /**
   * Query visual memory with natural language
   * e.g., "What did I see 5 minutes ago?"
   */
  async queryVisualMemory(query: string, options: {
    timeWindowMs?: number;
    source?: string;
    maxResults?: number;
  } = {}): Promise<VisualMemoryEntry[]> {
    const {
      timeWindowMs = 5 * 60 * 1000,  // Default 5 minutes
      source,
      maxResults = 5
    } = options;

    const now = Date.now();
    const cutoffTime = now - timeWindowMs;

    // Filter by time and source
    let relevant = this.visualMemory.filter(entry => {
      if (entry.timestamp < cutoffTime) return false;
      if (source && entry.source !== source) return false;
      return true;
    });

    // If vision server is available, use semantic search
    if (this.visionServerAvailable && relevant.length > 0) {
      try {
        // Get text embedding for query
        const textEmbedding = await this.getTextEmbedding(query);
        
        // Score entries by similarity
        const scored = relevant.map(entry => ({
          entry,
          score: this.cosineSimilarity(textEmbedding, entry.embedding)
        }));
        
        // Sort by similarity and return top results
        scored.sort((a, b) => b.score - a.score);
        relevant = scored.slice(0, maxResults).map(s => s.entry);
      } catch (error) {
        logger.log('VISION', `Semantic search failed: ${error}`, 'warning');
        // Fall back to keyword search
        relevant = this.keywordSearch(relevant, query, maxResults);
      }
    } else {
      // Keyword search fallback
      relevant = this.keywordSearch(relevant, query, maxResults);
    }

    return relevant;
  }

  /**
   * Get recent visual activity summary
   */
  getVisualActivitySummary(timeWindowMs: number = 5 * 60 * 1000): {
    totalFrames: number;
    uniqueObjects: string[];
    topTags: Array<{ tag: string; count: number }>;
    sources: string[];
  } {
    const cutoffTime = Date.now() - timeWindowMs;
    const recent = this.visualMemory.filter(e => e.timestamp > cutoffTime);

    // Count objects and tags
    const objectCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const sources = new Set<string>();

    for (const entry of recent) {
      sources.add(entry.source);
      
      for (const obj of entry.objects) {
        objectCounts.set(obj, (objectCounts.get(obj) || 0) + 1);
      }
      
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Get top tags
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalFrames: recent.length,
      uniqueObjects: Array.from(objectCounts.keys()),
      topTags,
      sources: Array.from(sources)
    };
  }

  /**
   * Get current processing status
   */
  getStatus(): {
    initialized: boolean;
    visionServerAvailable: boolean;
    activeStreams: number;
    visualMemorySize: number;
    isProcessing: boolean;
    batchQueueSize: number;
    activeStreamNames: string[];
  } {
    return {
      initialized: this.initialized,
      visionServerAvailable: this.visionServerAvailable,
      activeStreams: this.activeStreams.size,
      visualMemorySize: this.visualMemory.length,
      isProcessing: this.isProcessing,
      batchQueueSize: this.batchQueue.length,
      activeStreamNames: Array.from(this.activeStreams.keys())
    };
  }

  /**
   * Clear visual memory
   */
  clearVisualMemory(): void {
    const count = this.visualMemory.length;
    this.visualMemory = [];
    this.emit('memoryCleared', { count });
    logger.log('VISION', `Cleared ${count} visual memory entries`, 'info');
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    // Stop all streams
    for (const [sourceName] of this.activeStreams) {
      this.stopSampling(sourceName);
    }
    this.activeStreams.clear();
    
    // Clear timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.memoryCleanupTimer) {
      clearInterval(this.memoryCleanupTimer);
      this.memoryCleanupTimer = null;
    }
    
    // Clear memory
    this.clearVisualMemory();
    
    this.initialized = false;
    this.removeAllListeners();
    logger.log('VISION', 'Vision Pipeline disposed', 'info');
  }

  // ==================== Private Methods ====================

  private async checkVisionServer(): Promise<void> {
    try {
      const response = await fetch(`${VISION_CONFIG.visionServerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      this.visionServerAvailable = response.ok;
    } catch {
      this.visionServerAvailable = false;
    }
  }

  private queueFrameForBatchProcessing(frame: VideoFrame): void {
    this.batchQueue.push(frame);
    
    // Process batch when full or timeout
    if (this.batchQueue.length >= VISION_CONFIG.maxBatchSize) {
      this.processBatchQueue();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatchQueue();
      }, VISION_CONFIG.batchTimeoutMs);
    }
  }

  private async processBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0 || this.isProcessing) return;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    try {
      await this.processBatch(batch);
    } catch (error) {
      logger.log('VISION', `Batch queue processing error: ${error}`, 'error');
    }
  }

  private async getTextEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${VISION_CONFIG.visionServerUrl}/embed/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error('Failed to get text embedding');
    }
    
    const result = await response.json();
    return result.embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private keywordSearch(
    entries: VisualMemoryEntry[],
    query: string,
    maxResults: number
  ): VisualMemoryEntry[] {
    const keywords = query.toLowerCase().split(/\s+/);
    
    const scored = entries.map(entry => {
      let score = 0;
      const text = `${entry.description} ${entry.tags.join(' ')} ${entry.objects.join(' ')}`.toLowerCase();
      
      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 1;
      }
      
      return { entry, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.entry);
  }

  private addToVisualMemory(frame: VideoFrame, analysis: FrameAnalysis): void {
    // Limit memory size
    if (this.visualMemory.length >= VISION_CONFIG.maxStoredFrames) {
      this.visualMemory.shift();  // Remove oldest
    }

    const entry: VisualMemoryEntry = {
      id: frame.id,
      timestamp: frame.timestamp,
      source: frame.source,
      description: analysis.description,
      tags: analysis.tags,
      objects: analysis.objects.map(o => o.label),
      embedding: analysis.embedding
    };

    this.visualMemory.push(entry);
    this.emit('memoryAdded', entry);
  }

  private startMemoryCleanup(): void {
    // Cleanup old entries every minute
    this.memoryCleanupTimer = setInterval(() => {
      const cutoff = Date.now() - VISION_CONFIG.visualMemoryDurationMs;
      const before = this.visualMemory.length;
      this.visualMemory = this.visualMemory.filter(e => e.timestamp > cutoff);
      const removed = before - this.visualMemory.length;
      
      if (removed > 0) {
        logger.log('VISION', `Cleaned up ${removed} old visual memory entries`, 'info');
      }
    }, 60000);
  }

  private getFallbackAnalysis(frame: VideoFrame): FrameAnalysis {
    return {
      frameId: frame.id,
      timestamp: frame.timestamp,
      description: 'Vision server unavailable - frame captured but not analyzed',
      tags: ['unprocessed'],
      embedding: [],
      objects: [],
      confidence: 0
    };
  }
}

// Export singleton instance
export const visionPipeline = new VisionPipelineService();
export default visionPipeline;

// Also export types
export {
  VISION_CONFIG,
  VisionPipelineService
};
