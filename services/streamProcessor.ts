/**
 * Streaming Data Processor
 * Processes data in chunks for better memory efficiency
 * Supports backpressure and flow control
 */

export interface StreamChunk<T> {
  data: T;
  index: number;
  isLast: boolean;
}

export interface StreamProcessorConfig {
  chunkSize: number;
  maxConcurrency: number;
  bufferSize: number;
  backpressureThreshold: number;
}

export type TransformFn<TInput, TOutput> = (chunk: TInput) => TOutput | Promise<TOutput>;
export type FilterFn<T> = (chunk: T) => boolean | Promise<boolean>;

const DEFAULT_CONFIG: StreamProcessorConfig = {
  chunkSize: 100,
  maxConcurrency: 4,
  bufferSize: 10,
  backpressureThreshold: 0.8
};

class StreamProcessor<TInput, TOutput> {
  private config: StreamProcessorConfig;
  private transforms: TransformFn<any, any>[] = [];
  private filters: FilterFn<any>[] = [];
  private buffer: TOutput[] = [];
  private isProcessing = false;
  private isPaused = false;
  private observers: {
    onData?: (chunk: TOutput) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
    onBackpressure?: (pressure: number) => void;
  } = {};

  constructor(config: Partial<StreamProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a transform step
   */
  pipe<TNewOutput>(transform: TransformFn<TOutput, TNewOutput>): StreamProcessor<TInput, TNewOutput> {
    this.transforms.push(transform);
    return this as unknown as StreamProcessor<TInput, TNewOutput>;
  }

  /**
   * Add a filter step
   */
  filter(predicate: FilterFn<TOutput>): StreamProcessor<TInput, TOutput> {
    this.filters.push(predicate);
    return this;
  }

  /**
   * Subscribe to stream events
   */
  subscribe(handlers: {
    onData?: (chunk: TOutput) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
    onBackpressure?: (pressure: number) => void;
  }): () => void {
    this.observers = { ...this.observers, ...handlers };
    
    return () => {
      this.observers = {};
    };
  }

  /**
   * Process an array as a stream
   */
  async processArray(array: TInput[]): Promise<TOutput[]> {
    const results: TOutput[] = [];
    
    this.subscribe({
      onData: (chunk) => results.push(chunk),
    });

    await this.writeMany(array);
    await this.end();

    return results;
  }

  /**
   * Write a single chunk
   */
  async write(chunk: TInput): Promise<void> {
    if (this.isPaused) {
      await this.waitForResume();
    }

    await this.processChunk(chunk);
    this.checkBackpressure();
  }

  /**
   * Write multiple chunks
   */
  async writeMany(chunks: TInput[]): Promise<void> {
    // Process in batches
    for (let i = 0; i < chunks.length; i += this.config.chunkSize) {
      const batch = chunks.slice(i, i + this.config.chunkSize);
      await Promise.all(batch.map(chunk => this.write(chunk)));
    }
  }

  /**
   * Signal end of stream
   */
  async end(): Promise<void> {
    await this.flush();
    this.observers.onComplete?.();
  }

  /**
   * Pause the stream
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the stream
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    bufferSize: number;
    bufferCapacity: number;
    isPaused: boolean;
    isProcessing: boolean;
  } {
    return {
      bufferSize: this.buffer.length,
      bufferCapacity: this.config.bufferSize,
      isPaused: this.isPaused,
      isProcessing: this.isProcessing
    };
  }

  private async processChunk(chunk: TInput): Promise<void> {
    this.isProcessing = true;
    
    try {
      let result: any = chunk;

      // Apply transforms
      for (const transform of this.transforms) {
        result = await transform(result);
      }

      // Apply filters
      for (const filter of this.filters) {
        const passes = await filter(result);
        if (!passes) {
          this.isProcessing = false;
          return;
        }
      }

      // Add to buffer
      this.buffer.push(result);

      // Notify if buffer is getting full
      if (this.buffer.length >= this.config.bufferSize * this.config.backpressureThreshold) {
        const pressure = this.buffer.length / this.config.bufferSize;
        this.observers.onBackpressure?.(pressure);
      }

      // Flush if buffer is full
      if (this.buffer.length >= this.config.bufferSize) {
        await this.flush();
      }

      // Notify data available
      this.observers.onData?.(result);

    } catch (error) {
      this.observers.onError?.(error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // Process buffered items
    const toProcess = [...this.buffer];
    this.buffer = [];

    // Apply backpressure if needed
    if (toProcess.length > this.config.chunkSize) {
      this.pause();
      setTimeout(() => this.resume(), 100);
    }
  }

  private checkBackpressure(): void {
    const pressure = this.buffer.length / this.config.bufferSize;
    
    if (pressure >= this.config.backpressureThreshold && !this.isPaused) {
      this.pause();
      this.observers.onBackpressure?.(pressure);
      
      // Auto-resume when buffer clears
      setTimeout(() => {
        if (this.buffer.length < this.config.bufferSize * 0.5) {
          this.resume();
        }
      }, 100);
    }
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.isPaused) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }
}

// Export
export { StreamProcessor };

/**
 * Create a stream from an async iterator
 */
export async function* createStream<T>(
  source: AsyncIterable<T> | Iterable<T>
): AsyncGenerator<StreamChunk<T>> {
  let index = 0;
  
  for await (const item of source) {
    yield {
      data: item,
      index: index++,
      isLast: false
    };
  }
}

/**
 * Process large arrays in chunks
 */
export async function processInChunks<TInput, TOutput>(
  array: TInput[],
  processor: (chunk: TInput[]) => Promise<TOutput[]>,
  options: { chunkSize?: number; onProgress?: (progress: number) => void } = {}
): Promise<TOutput[]> {
  const { chunkSize = 100, onProgress } = options;
  const results: TOutput[] = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const processed = await processor(chunk);
    results.push(...processed);
    
    if (onProgress) {
      onProgress(Math.min(100, (i + chunk.length) / array.length * 100));
    }
  }
  
  return results;
}

/**
 * Parallel map with concurrency control
 */
export async function parallelMap<TInput, TOutput>(
  array: TInput[],
  mapper: (item: TInput) => Promise<TOutput>,
  options: { concurrency?: number; onProgress?: (progress: number) => void } = {}
): Promise<TOutput[]> {
  const { concurrency = 4, onProgress } = options;
  const results: TOutput[] = new Array(array.length);
  let completed = 0;

  // Process in batches
  for (let i = 0; i < array.length; i += concurrency) {
    const batch = array.slice(i, i + concurrency);
    const batchIndices = batch.map((_, idx) => i + idx);

    await Promise.all(
      batch.map(async (item, idx) => {
        const result = await mapper(item);
        results[batchIndices[idx]] = result;
        completed++;
        
        if (onProgress) {
          onProgress(completed / array.length * 100);
        }
      })
    );
  }

  return results;
}

/**
 * Debounced stream - batches rapid updates
 */
export class DebouncedStream<T> {
  private buffer: T[] = [];
  private timeout: number | null = null;
  private readonly delay: number;
  private callback: (items: T[]) => void;

  constructor(callback: (items: T[]) => void, delay: number = 100) {
    this.callback = callback;
    this.delay = delay;
  }

  push(item: T): void {
    this.buffer.push(item);
    
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = window.setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.buffer.length > 0) {
      this.callback([...this.buffer]);
      this.buffer = [];
    }
  }
}

/**
 * Throttled stream - limits update frequency
 */
export class ThrottledStream<T> {
  private lastEmit = 0;
  private pending: T | null = null;
  private readonly interval: number;
  private callback: (item: T) => void;

  constructor(callback: (item: T) => void, interval: number = 100) {
    this.callback = callback;
    this.interval = interval;
  }

  push(item: T): void {
    const now = Date.now();
    const elapsed = now - this.lastEmit;

    if (elapsed >= this.interval) {
      this.emit(item);
    } else {
      this.pending = item;
      setTimeout(() => {
        if (this.pending !== null) {
          this.emit(this.pending);
          this.pending = null;
        }
      }, this.interval - elapsed);
    }
  }

  private emit(item: T): void {
    this.lastEmit = Date.now();
    this.callback(item);
  }
}
