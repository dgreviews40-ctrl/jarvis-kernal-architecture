/**
 * Image Processing Pool
 * Reuses canvas elements and ImageData objects to reduce GC pressure
 * Optimizes vision processing and image manipulation
 */

interface PooledCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  inUse: boolean;
  lastUsed: number;
}

interface PooledImageData {
  data: ImageData;
  inUse: boolean;
}

interface ImagePoolConfig {
  maxCanvasPoolSize: number;
  maxImageDataPoolSize: number;
  defaultWidth: number;
  defaultHeight: number;
}

const DEFAULT_CONFIG: ImagePoolConfig = {
  maxCanvasPoolSize: 5,
  maxImageDataPoolSize: 10,
  defaultWidth: 1920,
  defaultHeight: 1080
};

class ImageProcessingPool {
  private canvasPool: PooledCanvas[] = [];
  private imageDataPool: Map<string, PooledImageData[]> = new Map();
  private config: ImagePoolConfig;

  constructor(config: Partial<ImagePoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Acquire a canvas from the pool or create new one
   */
  acquireCanvas(width?: number, height?: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; release: () => void } {
    const targetWidth = width ?? this.config.defaultWidth;
    const targetHeight = height ?? this.config.defaultHeight;

    // Find available canvas with sufficient size
    const availableIndex = this.canvasPool.findIndex(
      pool => !pool.inUse && pool.canvas.width >= targetWidth && pool.canvas.height >= targetHeight
    );

    let pooled: PooledCanvas;

    if (availableIndex >= 0) {
      pooled = this.canvasPool[availableIndex];
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      
      // Resize if needed (but not smaller)
      if (pooled.canvas.width !== targetWidth || pooled.canvas.height !== targetHeight) {
        pooled.canvas.width = targetWidth;
        pooled.canvas.height = targetHeight;
      }
    } else {
      // Create new canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d', {
        alpha: false,  // Optimize for no transparency
        desynchronized: true  // Reduce latency
      });
      
      if (!ctx) {
        throw new Error('Failed to get 2D context');
      }

      pooled = {
        canvas,
        ctx,
        inUse: true,
        lastUsed: Date.now()
      };

      this.canvasPool.push(pooled);
      this.enforceCanvasPoolLimit();
    }

    // Clear canvas before use
    pooled.ctx.clearRect(0, 0, pooled.canvas.width, pooled.canvas.height);

    return {
      canvas: pooled.canvas,
      ctx: pooled.ctx,
      release: () => {
        pooled.inUse = false;
        pooled.lastUsed = Date.now();
      }
    };
  }

  /**
   * Acquire ImageData buffer from pool
   */
  acquireImageData(width: number, height: number): { data: ImageData; release: () => void } {
    const key = `${width}x${height}`;
    
    if (!this.imageDataPool.has(key)) {
      this.imageDataPool.set(key, []);
    }

    const pool = this.imageDataPool.get(key)!;
    const available = pool.find(p => !p.inUse);

    if (available) {
      available.inUse = true;
      // Clear the data
      available.data.data.fill(0);
      
      return {
        data: available.data,
        release: () => { available.inUse = false; }
      };
    }

    // Create new ImageData
    const data = new ImageData(width, height);
    const pooled: PooledImageData = { data, inUse: true };
    pool.push(pooled);

    this.enforceImageDataPoolLimit();

    return {
      data,
      release: () => { pooled.inUse = false; }
    };
  }

  /**
   * Process an image with automatic pool management
   */
  async processImage<T>(
    imageSource: HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement,
    processor: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => T,
    options: { width?: number; height?: number } = {}
  ): Promise<T> {
    const width = options.width ?? (imageSource as any).videoWidth ?? (imageSource as any).width ?? 1920;
    const height = options.height ?? (imageSource as any).videoHeight ?? (imageSource as any).height ?? 1080;

    const { canvas, ctx, release } = this.acquireCanvas(width, height);

    try {
      // Draw source to canvas
      ctx.drawImage(imageSource, 0, 0, width, height);
      
      // Run processor
      return processor(ctx, canvas);
    } finally {
      release();
    }
  }

  /**
   * Resize image efficiently using pool
   */
  async resize(
    source: HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<HTMLCanvasElement> {
    const { canvas, ctx, release } = this.acquireCanvas(targetWidth, targetHeight);

    // Set image smoothing based on quality
    ctx.imageSmoothingEnabled = quality !== 'low';
    ctx.imageSmoothingQuality = quality === 'high' ? 'high' : 'medium';

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    // Create a new canvas to return (don't release the pooled one)
    const result = document.createElement('canvas');
    result.width = targetWidth;
    result.height = targetHeight;
    result.getContext('2d')?.drawImage(canvas, 0, 0);

    release();
    return result;
  }

  /**
   * Convert video frame to compressed base64 efficiently
   */
  async captureFrame(
    video: HTMLVideoElement,
    options: {
      maxWidth?: number;
      quality?: number;
      format?: 'image/jpeg' | 'image/webp';
    } = {}
  ): Promise<string | null> {
    const { maxWidth = 1280, quality = 0.85, format = 'image/jpeg' } = options;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) return null;

    // Calculate dimensions maintaining aspect ratio
    let width = videoWidth;
    let height = videoHeight;
    
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const { canvas, ctx, release } = this.acquireCanvas(width, height);

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const base64 = canvas.toDataURL(format, quality).split(',')[1];
      return base64;
    } finally {
      release();
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    canvasPoolSize: number;
    canvasInUse: number;
    imageDataPools: number;
    totalImageDataBuffers: number;
    imageDataInUse: number;
  } {
    let totalImageDataBuffers = 0;
    let imageDataInUse = 0;

    for (const pool of this.imageDataPool.values()) {
      totalImageDataBuffers += pool.length;
      imageDataInUse += pool.filter(p => p.inUse).length;
    }

    return {
      canvasPoolSize: this.canvasPool.length,
      canvasInUse: this.canvasPool.filter(c => c.inUse).length,
      imageDataPools: this.imageDataPool.size,
      totalImageDataBuffers,
      imageDataInUse
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.canvasPool = [];
    this.imageDataPool.clear();
  }

  private enforceCanvasPoolLimit(): void {
    if (this.canvasPool.length > this.config.maxCanvasPoolSize) {
      // Sort by last used, remove oldest not in use
      const sorted = this.canvasPool
        .map((c, i) => ({ ...c, index: i }))
        .filter(c => !c.inUse)
        .sort((a, b) => a.lastUsed - b.lastUsed);

      const toRemove = sorted.slice(0, this.canvasPool.length - this.config.maxCanvasPoolSize);
      const indicesToRemove = new Set(toRemove.map(t => t.index));
      
      this.canvasPool = this.canvasPool.filter((_, i) => !indicesToRemove.has(i));
    }
  }

  private enforceImageDataPoolLimit(): void {
    let totalSize = 0;
    for (const pool of this.imageDataPool.values()) {
      totalSize += pool.length;
    }

    if (totalSize > this.config.maxImageDataPoolSize) {
      // Clear oldest pools entirely (simple strategy)
      const entries = Array.from(this.imageDataPool.entries());
      this.imageDataPool = new Map(entries.slice(-this.config.maxImageDataPoolSize));
    }
  }
}

// Export singleton
export const imagePool = new ImageProcessingPool();

// Export class for custom instances
export { ImageProcessingPool };
