/**
 * Unified Vector Database Service for JARVIS Kernel v1.5.0
 * 
 * Features:
 * - Multiple embedding backends (Transformers.js, API, hash-based fallback)
 * - HNSW index for fast approximate nearest neighbor search
 * - IndexedDB for persistent storage
 * - Embedding cache to avoid regenerating embeddings
 * - Batch operations for efficiency
 * - Graceful degradation when services unavailable
 */

import { MemoryNode, MemoryType, MemorySearchResult } from '../types';

import { VECTOR_DB } from '../constants/config';
import { logger } from './logger';

// Embedding types
export type EmbeddingBackend = 'embedding_server' | 'transformers' | 'api' | 'local' | 'hash';

// Embedding server config
interface EmbeddingServerConfig {
  url: string;
  enabled: boolean;
}

interface EmbeddingCacheEntry {
  text: string;
  vector: Float32Array;
  timestamp: number;
}

interface VectorRecord {
  id: string;
  vector: Float32Array;
  metadata: {
    content: string;
    type: MemoryType;
    tags: string[];
    created: number;
    lastAccessed: number;
    accessCount: number;
  };
}

interface HNSWNode {
  id: string;
  vector: Float32Array;
  neighbors: Map<number, string[]>; // layer -> neighbor ids
}

interface VectorDBStats {
  totalVectors: number;
  indexSize: number;
  cacheSize: number;
  embeddingCacheSize: number;
  averageVectorSize: number;
  backend: EmbeddingBackend;
}

export class VectorDB {
  private static instance: VectorDB;
  private db: IDBDatabase | null = null;
  private hnswIndex: Map<string, HNSWNode> = new Map();
  private vectorCache: Map<string, VectorRecord> = new Map();
  private embeddingCache: Map<string, EmbeddingCacheEntry> = new Map();
  private isInitialized = false;
  
  public get initialized(): boolean {
    return this.isInitialized;
  }
  private isInitializing = false;
  private initCallbacks: ((success: boolean) => void)[] = [];
  
  // Embedding state
  private embedder: any = null;
  private embeddingBackend: EmbeddingBackend = 'hash';
  private apiEmbeddingUrl: string | null = null;
  private apiEmbeddingKey: string | null = null;
  private embeddingServerConfig: EmbeddingServerConfig = {
    url: 'http://localhost:5002',
    enabled: true
  };
  
  // HNSW parameters
  private readonly M = VECTOR_DB.HNSW.M;
  private readonly efConstruction = VECTOR_DB.HNSW.efConstruction;
  private readonly efSearch = VECTOR_DB.HNSW.efSearch;
  private readonly maxLevel = 16;
  private readonly embeddingDimension = VECTOR_DB.EMBEDDING_DIMENSION;
  
  private constructor() {}

  public static getInstance(): VectorDB {
    if (!VectorDB.instance) {
      VectorDB.instance = new VectorDB();
    }
    return VectorDB.instance;
  }

  /**
   * Initialize the vector database
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) {
      return new Promise((resolve) => {
        this.initCallbacks.push(resolve);
      });
    }

    this.isInitializing = true;
    logger.log('VECTOR_DB', 'Initializing vector database...', 'info');

    try {
      // Initialize embedding backend (has internal 8s timeout)
      await this.initializeEmbedder();
      
      // Initialize IndexedDB (with error handling)
      try {
        await this.initializeIndexedDB();
      } catch (dbError) {
        logger.log('VECTOR_DB', 'IndexedDB failed, using memory-only mode', 'warning');
        this.db = null;
      }
      
      // Rebuild HNSW index from stored vectors
      await this.rebuildIndex();
      
      this.isInitialized = true;
      this.isInitializing = false;
      
      logger.log('VECTOR_DB', `Vector database initialized with ${this.embeddingBackend} backend`, 'success');
      this.initCallbacks.forEach(cb => cb(true));
      this.initCallbacks = [];
      
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Initialization failed: ${errMsg}`, 'error');
      this.isInitializing = false;
      this.initCallbacks.forEach(cb => cb(false));
      this.initCallbacks = [];
      return false;
    }
  }

  /**
   * Configure API-based embeddings (OpenAI-compatible)
   */
  public configureApiEmbeddings(url: string, apiKey: string): void {
    this.apiEmbeddingUrl = url;
    this.apiEmbeddingKey = apiKey;
    // Will be used on next embedder initialization
    logger.log('VECTOR_DB', 'API embeddings configured', 'info');
  }

  /**
   * Initialize the embedding pipeline with fallback chain
   * Priority: Embedding Server (CUDA) > API > Transformers.js > Hash
   */
  private async initializeEmbedder(): Promise<void> {
    // Try local embedding server first (CUDA on GPU)
    if (this.embeddingServerConfig.enabled) {
      // Retry a few times in case server is still starting
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          
          const healthResponse = await fetch(`${this.embeddingServerConfig.url}/health`, {
            signal: controller.signal
          });
          
          clearTimeout(timeout);
          
          if (healthResponse.ok) {
            const health = await healthResponse.json();
            this.embeddingBackend = 'embedding_server';
            logger.log('VECTOR_DB', `Using CUDA embedding server (${health.device})`, 'success');
            return;
          }
        } catch (error) {
          if (attempt === 3) {
            logger.log('VECTOR_DB', 'Embedding server not available, trying next backend', 'warning');
          } else {
            // Wait before retry
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }

    // Try API embeddings if configured
    if (this.apiEmbeddingUrl && this.apiEmbeddingKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const testResponse = await fetch(this.apiEmbeddingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiEmbeddingKey}`
          },
          body: JSON.stringify({
            input: 'test',
            model: 'text-embedding-ada-002'
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (testResponse.ok) {
          this.embeddingBackend = 'api';
          logger.log('VECTOR_DB', 'Using API embeddings', 'success');
          return;
        }
      } catch (error) {
        logger.log('VECTOR_DB', 'API embeddings test failed, trying next backend', 'warning');
      }
    }

    // Try Transformers.js with a strict timeout
    try {
      const transformersPromise = this.loadTransformersJs();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Transformers.js loading timeout')), 8000);
      });
      
      await Promise.race([transformersPromise, timeoutPromise]);
      return;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Transformers.js failed: ${errMsg}`, 'warning');
    }

    // Fallback to hash-based embeddings
    this.embeddingBackend = 'hash';
    this.embedder = null;
    logger.log('VECTOR_DB', 'Using hash-based embeddings (fallback)', 'warning');
  }

  /**
   * Load Transformers.js with proper timeout handling
   */
  private async loadTransformersJs(): Promise<void> {
    const transformers = await import('@xenova/transformers');
    
    // Set cache directory to avoid CORS issues
    transformers.env.cacheDir = '/models';
    transformers.env.allowLocalModels = true;
    // Enable remote models with local fallback - required for first-time model download
    transformers.env.allowRemoteModels = true;
    
    this.embedder = await transformers.pipeline(
      'feature-extraction', 
      'Xenova/all-MiniLM-L6-v2',
      {
        quantized: true,
        revision: 'main',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            logger.log('VECTOR_DB', `Loading model: ${Math.round(progress.progress)}%`, 'info');
          }
        }
      }
    );
    
    this.embeddingBackend = 'transformers';
    logger.log('VECTOR_DB', 'Using Transformers.js embeddings', 'success');
  }

  /**
   * Initialize IndexedDB
   */
  private initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set a timeout for IndexedDB operations
      const timeout = setTimeout(() => {
        reject(new Error('IndexedDB initialization timeout'));
      }, 5000);
      
      const request = indexedDB.open(VECTOR_DB.DB_NAME, VECTOR_DB.DB_VERSION);

      request.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to open IndexedDB'));
      };
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(VECTOR_DB.STORE_NAME)) {
          const store = db.createObjectStore(VECTOR_DB.STORE_NAME, { keyPath: 'id' });
          store.createIndex('created', 'metadata.created', { unique: false });
          store.createIndex('type', 'metadata.type', { unique: false });
          store.createIndex('tags', 'metadata.tags', { unique: false, multiEntry: true });
        }
      };
    });
  }

  // ==================== EMBEDDING ====================

  /**
   * Generate embedding for text with caching
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    // Check cache first
    const cacheKey = this.hashText(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.vector;
    }

    let vector: Float32Array;

    switch (this.embeddingBackend) {
      case 'embedding_server':
        vector = await this.generateServerEmbedding(text);
        break;
      case 'api':
        vector = await this.generateApiEmbedding(text);
        break;
      case 'transformers':
        vector = await this.generateTransformersEmbedding(text);
        break;
      case 'local':
      case 'hash':
      default:
        vector = this.generateHashEmbedding(text);
        break;
    }

    // Cache the result
    this.embeddingCache.set(cacheKey, {
      text,
      vector,
      timestamp: Date.now()
    });

    // Clean old cache entries if too many
    if (this.embeddingCache.size > 10000) {
      this.cleanEmbeddingCache();
    }

    return vector;
  }

  private async generateApiEmbedding(text: string): Promise<Float32Array> {
    if (!this.apiEmbeddingUrl || !this.apiEmbeddingKey) {
      return this.generateHashEmbedding(text);
    }

    try {
      const response = await fetch(this.apiEmbeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiEmbeddingKey}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002'
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding || data.embedding;
      
      if (Array.isArray(embedding)) {
        return new Float32Array(embedding);
      }
      
      throw new Error('Invalid API response format');
    } catch (error) {
      logger.log('VECTOR_DB', 'API embedding failed, using hash fallback', 'warning');
      return this.generateHashEmbedding(text);
    }
  }

  /**
   * Generate embedding using local CUDA embedding server
   * 10x faster than Transformers.js (GPU vs CPU)
   */
  private async generateServerEmbedding(text: string): Promise<Float32Array> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`${this.embeddingServerConfig.url}/embed/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.embedding && Array.isArray(data.embedding)) {
        return new Float32Array(data.embedding);
      }
      
      throw new Error('Invalid server response format');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Embedding server failed: ${errMsg}, falling back`, 'warning');
      // Fall back to transformers or hash
      if (this.embedder) {
        return this.generateTransformersEmbedding(text);
      }
      return this.generateHashEmbedding(text);
    }
  }

  private async generateTransformersEmbedding(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      return this.generateHashEmbedding(text);
    }

    try {
      const output = await this.embedder(text, { 
        pooling: 'mean', 
        normalize: true 
      });
      
      // Handle different output formats
      if (output.data) {
        return new Float32Array(output.data);
      }
      
      // Try to extract from tensor
      const data = await output.tolist?.() || output;
      if (Array.isArray(data)) {
        const flat = data.flat();
        return new Float32Array(flat);
      }
      
      throw new Error('Unexpected output format');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Transformers embedding failed: ${errMsg}`, 'warning');
      return this.generateHashEmbedding(text);
    }
  }

  /**
   * Generate deterministic hash-based embedding (fallback)
   */
  private generateHashEmbedding(text: string): Float32Array {
    const vector = new Float32Array(this.embeddingDimension);
    
    // Use multiple hash functions for better distribution
    let hash1 = 0;
    let hash2 = 5381;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash1 = ((hash1 << 5) - hash1) + char;
      hash1 = hash1 & hash1;
      hash2 = ((hash2 << 5) + hash2) + char;
    }

    // Fill vector using both hashes
    for (let i = 0; i < this.embeddingDimension; i++) {
      const h1 = Math.sin(hash1 + i) * 10000;
      const h2 = Math.cos(hash2 + i * 0.5) * 10000;
      vector[i] = ((h1 - Math.floor(h1)) + (h2 - Math.floor(h2))) / 2;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private cleanEmbeddingCache(): void {
    const entries = Array.from(this.embeddingCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.embeddingCache.delete(entries[i][0]);
    }
  }

  // ==================== BATCH EMBEDDINGS (CUDA Server) ====================

  /**
   * Generate embeddings for multiple texts in batch (efficient for CUDA server)
   * 10x faster than individual calls when using embedding server
   */
  public async generateEmbeddingsBatch(texts: string[]): Promise<Float32Array[]> {
    await this.ensureInitialized();
    
    // Validate input
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      logger.log('VECTOR_DB', 'Invalid input to generateEmbeddingsBatch, returning empty array', 'warning');
      return [];
    }
    
    if (this.embeddingBackend === 'embedding_server' && texts.length > 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s for batch
        
        const response = await fetch(`${this.embeddingServerConfig.url}/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ texts }),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`Batch embed error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.embeddings && Array.isArray(data.embeddings)) {
          return data.embeddings.map((e: number[]) => new Float32Array(e));
        }
        
        throw new Error('Invalid batch response');
      } catch (error) {
        logger.log('VECTOR_DB', 'Batch embedding failed, falling back to individual', 'warning');
        // Fall back to individual embeddings
      }
    }
    
    // Generate individually (for transformers, api, or hash backends)
    return Promise.all(texts.map(t => this.generateEmbedding(t)));
  }

  /**
   * Get current embedding backend info
   */
  public getEmbeddingBackend(): { 
    backend: EmbeddingBackend; 
  } {
    return { backend: this.embeddingBackend };
  }
  
  /**
   * Get detailed embedding server health info (async)
   */
  public async getEmbeddingServerHealth(): Promise<{ 
    device: string; 
    vram_total_gb: number;
    vram_allocated_gb: number;
    cache_size: number;
  } | null> {
    if (this.embeddingBackend !== 'embedding_server') {
      return null;
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.embeddingServerConfig.url}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        return {
          device: data.device,
          vram_total_gb: data.gpu?.vram_total_gb || 0,
          vram_allocated_gb: data.gpu?.vram_allocated_gb || 0,
          cache_size: data.cache_size
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if embedding server is available
   */
  public async isEmbeddingServerAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.embeddingServerConfig.url}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Store identity information with special handling
   */
  public async storeIdentity(content: string): Promise<void> {
    const identityNode: MemoryNode = {
      id: `identity_${Date.now()}`,
      content,
      type: 'FACT',
      tags: ['identity', 'user-info', 'permanent'],
      created: Date.now(),
      lastAccessed: Date.now(),
    };

    await this.store(identityNode);
    logger.log('VECTOR_DB', 'Identity information stored', 'info');
  }

  /**
   * Store a single memory node
   */
  public async store(node: MemoryNode): Promise<void> {
    await this.ensureInitialized();

    try {
      const vector = await this.generateEmbedding(node.content);

      const record: VectorRecord = {
        id: node.id,
        vector,
        metadata: {
          content: node.content,
          type: node.type,
          tags: node.tags || [],
          created: node.created,
          lastAccessed: node.lastAccessed || Date.now(),
          accessCount: 0,
        },
      };

      await this.saveToIndexedDB(record);
      this.vectorCache.set(node.id, record);
      this.addToHNSW(record.id, vector);

      logger.log('VECTOR_DB', `Stored: ${node.id}`, 'info');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Failed to store: ${errMsg}`, 'error');
      throw error;
    }
  }

  /**
   * Store multiple memory nodes (batch operation)
   * Optimized for bulk imports - generates embeddings in parallel,
   * uses single IndexedDB transaction for storage.
   */
  public async storeBatch(nodes: MemoryNode[]): Promise<{ success: number; failed: number }> {
    await this.ensureInitialized();

    let success = 0;
    let failed = 0;
    const records: VectorRecord[] = [];

    // Process in chunks to avoid memory pressure
    const CHUNK_SIZE = VECTOR_DB.BATCH_SIZE;
    
    for (let i = 0; i < nodes.length; i += CHUNK_SIZE) {
      const chunk = nodes.slice(i, i + CHUNK_SIZE);
      
      // Generate embeddings in parallel within chunk
      const embeddingResults = await Promise.allSettled(
        chunk.map(async (node) => {
          try {
            const vector = await this.generateEmbedding(node.content);
            return {
              node,
              vector,
              success: true
            };
          } catch (error) {
            return {
              node,
              vector: null as unknown as Float32Array,
              success: false,
              error
            };
          }
        })
      );

      // Build records from successful embeddings
      for (let j = 0; j < embeddingResults.length; j++) {
        const result = embeddingResults[j];
        if (result.status === 'fulfilled' && result.value.success) {
          const { node, vector } = result.value;
          const record: VectorRecord = {
            id: node.id,
            vector,
            metadata: {
              content: node.content,
              type: node.type,
              tags: node.tags || [],
              created: node.created,
              lastAccessed: node.lastAccessed || Date.now(),
              accessCount: 0,
            },
          };
          records.push(record);
          success++;
        } else {
          failed++;
        }
      }

      // Small yield between chunks
      if (i + CHUNK_SIZE < nodes.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Bulk save to IndexedDB in single transaction
    let savedCount = 0;
    if (records.length > 0 && this.db) {
      try {
        await this.saveBatchToIndexedDB(records);
        savedCount = records.length;
        
        // Update in-memory structures
        for (const record of records) {
          this.vectorCache.set(record.id, record);
          this.addToHNSW(record.id, record.vector);
        }
      } catch (error) {
        // If batch save fails, try individual saves
        logger.log('VECTOR_DB', 'Batch save failed, falling back to individual saves', 'warning');
        for (const record of records) {
          try {
            await this.saveToIndexedDB(record);
            this.vectorCache.set(record.id, record);
            this.addToHNSW(record.id, record.vector);
            savedCount++;
          } catch (e) {
            // Individual save failed
          }
        }
      }
    } else if (records.length > 0) {
      // Memory-only mode - just update in-memory
      for (const record of records) {
        this.vectorCache.set(record.id, record);
        this.addToHNSW(record.id, record.vector);
      }
      savedCount = records.length;
    }
    
    // Recalculate success/failed based on actual saves
    const finalSuccess = savedCount;
    const finalFailed = (success + failed) - finalSuccess;

    logger.log('VECTOR_DB', `Batch stored: ${success} success, ${failed} failed`, 'info');
    return { success, failed };
  }

  /**
   * Search for similar memories
   */
  public async search(
    query: string,
    options: {
      maxResults?: number;
      minScore?: number;
      filter?: (record: VectorRecord) => boolean;
    } = {}
  ): Promise<MemorySearchResult[]> {
    await this.ensureInitialized();

    const { maxResults = 10, minScore = VECTOR_DB.SIMILARITY_THRESHOLD, filter } = options;

    try {
      const queryVector = await this.generateEmbedding(query);
      const candidates = this.searchHNSW(queryVector, this.efSearch);

      const results: MemorySearchResult[] = [];

      for (const candidateId of candidates) {
        const record = this.vectorCache.get(candidateId) || await this.loadFromIndexedDB(candidateId);
        if (!record) continue;

        if (filter && !filter(record)) continue;

        const similarity = this.cosineSimilarity(queryVector, record.vector);

        if (similarity >= minScore) {
          results.push({
            node: {
              id: record.id,
              content: record.metadata.content,
              type: record.metadata.type,
              tags: record.metadata.tags,
              created: record.metadata.created,
              lastAccessed: record.metadata.lastAccessed,
            },
            score: similarity,
          });
        }
      }

      results.sort((a, b) => b.score - a.score);
      const limitedResults = results.slice(0, maxResults);

      // Update access counts
      for (const result of limitedResults) {
        await this.updateAccess(result.node.id);
      }

      return limitedResults;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Search failed: ${errMsg}`, 'error');
      return [];
    }
  }

  /**
   * Get a memory by ID
   */
  public async getById(id: string): Promise<MemoryNode | null> {
    await this.ensureInitialized();

    const record = this.vectorCache.get(id) || await this.loadFromIndexedDB(id);
    if (!record) return null;

    await this.updateAccess(id);

    return {
      id: record.id,
      content: record.metadata.content,
      type: record.metadata.type,
      tags: record.metadata.tags,
      created: record.metadata.created,
      lastAccessed: Date.now(),
    };
  }

  /**
   * Delete a memory by ID
   */
  public async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      await this.deleteFromIndexedDB(id);
      this.vectorCache.delete(id);
      this.hnswIndex.delete(id);

      logger.log('VECTOR_DB', `Deleted: ${id}`, 'info');
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Failed to delete: ${errMsg}`, 'error');
      return false;
    }
  }

  /**
   * Delete multiple memories by ID (batch operation)
   */
  public async deleteBatch(ids: string[]): Promise<{ success: number; failed: number }> {
    await this.ensureInitialized();

    let success = 0;
    let failed = 0;

    await Promise.all(ids.map(async (id) => {
      try {
        await this.delete(id);
        success++;
      } catch (error) {
        failed++;
      }
    }));

    logger.log('VECTOR_DB', `Batch delete: ${success} success, ${failed} failed`, 'info');
    return { success, failed };
  }

  /**
   * Get all vectors (use sparingly)
   */
  public async getAll(): Promise<VectorRecord[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readonly');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get all vectors'));
    });
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<VectorDBStats> {
    await this.ensureInitialized();

    const allVectors = await this.getAll();
    const totalBytes = allVectors.reduce((sum, v) => {
      return sum + v.vector.length * 4 + JSON.stringify(v.metadata).length * 2;
    }, 0);

    return {
      totalVectors: allVectors.length,
      indexSize: this.hnswIndex.size,
      cacheSize: this.vectorCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      averageVectorSize: allVectors.length > 0 ? Math.round(totalBytes / allVectors.length) : 0,
      backend: this.embeddingBackend,
    };
  }

  /**
   * Clear all vectors
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.vectorCache.clear();
        this.hnswIndex.clear();
        this.embeddingCache.clear();
        logger.log('VECTOR_DB', 'All vectors cleared', 'info');
        resolve();
      };
      request.onerror = () => reject(new Error('Failed to clear vectors'));
    });
  }

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export all vectors to JSON
   */
  public async export(): Promise<string> {
    const vectors = await this.getAll();
    return JSON.stringify({
      version: '1.5.0',
      exportedAt: Date.now(),
      backend: this.embeddingBackend,
      vectors: vectors.map(v => ({
        ...v,
        vector: Array.from(v.vector),
      })),
    });
  }

  /**
   * Import vectors from JSON
   * Uses batch processing for efficiency
   */
  public async import(jsonData: string): Promise<{ imported: number; errors: number }> {
    await this.ensureInitialized();

    try {
      const data = JSON.parse(jsonData);
      const vectors = data.vectors || [];

      // Convert to VectorRecords
      const records: VectorRecord[] = [];
      let parseErrors = 0;

      for (const v of vectors) {
        try {
          records.push({
            id: v.id,
            vector: new Float32Array(v.vector),
            metadata: v.metadata,
          });
        } catch (e) {
          parseErrors++;
        }
      }

      // Process in batches using single transaction
      let imported = 0;
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        try {
          await this.saveBatchToIndexedDB(batch);
          
          // Update in-memory structures
          for (const record of batch) {
            this.vectorCache.set(record.id, record);
            this.addToHNSW(record.id, record.vector);
          }
          
          imported += batch.length;
        } catch (e) {
          // Fallback to individual saves
          for (const record of batch) {
            try {
              await this.saveToIndexedDB(record);
              this.vectorCache.set(record.id, record);
              this.addToHNSW(record.id, record.vector);
              imported++;
            } catch (err) {
              parseErrors++;
            }
          }
        }

        // Yield between batches
        if (i + BATCH_SIZE < records.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      logger.log('VECTOR_DB', `Imported ${imported} vectors (${parseErrors} errors)`, 'success');
      return { imported, errors: parseErrors };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_DB', `Import failed: ${errMsg}`, 'error');
      throw error;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async saveToIndexedDB(record: VectorRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save vector'));
    });
  }

  /**
   * Save multiple records in a single IndexedDB transaction
   */
  private async saveBatchToIndexedDB(records: VectorRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      
      let completed = 0;
      let hasError = false;

      for (const record of records) {
        const request = store.put(record);
        
        request.onsuccess = () => {
          completed++;
          if (completed === records.length && !hasError) {
            resolve();
          }
        };
        
        request.onerror = () => {
          hasError = true;
          // Continue processing other records
        };
      }

      transaction.oncomplete = () => {
        if (!hasError) {
          resolve();
        }
      };

      transaction.onerror = () => {
        reject(new Error('Batch transaction failed'));
      };

      transaction.onabort = () => {
        reject(new Error('Batch transaction aborted'));
      };
    });
  }

  private async loadFromIndexedDB(id: string): Promise<VectorRecord | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readonly');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          if (!(result.vector instanceof Float32Array)) {
            result.vector = new Float32Array(result.vector);
          }
        }
        resolve(result || null);
      };
      request.onerror = () => reject(new Error('Failed to load vector'));
    });
  }

  private async deleteFromIndexedDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([VECTOR_DB.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete vector'));
    });
  }

  private async updateAccess(id: string): Promise<void> {
    const record = this.vectorCache.get(id) || await this.loadFromIndexedDB(id);
    if (record) {
      record.metadata.lastAccessed = Date.now();
      record.metadata.accessCount++;
      await this.saveToIndexedDB(record);
      this.vectorCache.set(id, record);
    }
  }

  private async rebuildIndex(): Promise<void> {
    // Don't use getAll() here - it requires initialization to be complete
    // which causes a deadlock during initialization
    if (!this.db) {
      logger.log('VECTOR_DB', 'No IndexedDB available, skipping index rebuild', 'info');
      return;
    }

    try {
      const vectors = await new Promise<VectorRecord[]>((resolve, reject) => {
        const transaction = this.db!.transaction([VECTOR_DB.STORE_NAME], 'readonly');
        const store = transaction.objectStore(VECTOR_DB.STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Failed to get all vectors'));
      });

      for (const record of vectors) {
        this.vectorCache.set(record.id, record);
        this.addToHNSW(record.id, record.vector);
      }

      logger.log('VECTOR_DB', `Rebuilt index with ${vectors.length} vectors`, 'info');
    } catch (error) {
      logger.log('VECTOR_DB', 'Failed to rebuild index, continuing with empty index', 'warning');
    }
  }

  // ==================== HNSW INDEX ====================

  private addToHNSW(id: string, vector: Float32Array): void {
    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      neighbors: new Map(),
    };

    if (this.hnswIndex.size === 0) {
      this.hnswIndex.set(id, node);
      return;
    }

    let entryPoint = this.getEntryPoint();
    if (!entryPoint) {
      this.hnswIndex.set(id, node);
      return;
    }

    for (let currentLevel = this.maxLevel; currentLevel >= 0; currentLevel--) {
      if (currentLevel <= level) {
        const neighbors = this.searchLevel(vector, entryPoint!, currentLevel, this.M);
        node.neighbors.set(currentLevel, neighbors);

        for (const neighborId of neighbors) {
          const neighbor = this.hnswIndex.get(neighborId);
          if (neighbor) {
            const neighborNeighbors = neighbor.neighbors.get(currentLevel) || [];
            neighborNeighbors.push(id);
            if (neighborNeighbors.length > this.M) {
              const weakest = this.findWeakestConnection(neighbor, currentLevel);
              const index = neighborNeighbors.indexOf(weakest);
              if (index > -1) neighborNeighbors.splice(index, 1);
            }
            neighbor.neighbors.set(currentLevel, neighborNeighbors);
          }
        }
      }

      if (currentLevel > 0) {
        const candidates = this.searchLevel(vector, entryPoint!, currentLevel, 1);
        if (candidates.length > 0) {
          entryPoint = candidates[0];
        }
      }
    }

    this.hnswIndex.set(id, node);
  }

  private searchHNSW(queryVector: Float32Array, ef: number): string[] {
    if (this.hnswIndex.size === 0) return [];

    const entryPoint = this.getEntryPoint();
    if (!entryPoint) return [];

    let current = entryPoint;

    for (let level = this.maxLevel; level >= 0; level--) {
      const neighbors = this.searchLevel(queryVector, current, level, 1);
      if (neighbors.length > 0) {
        current = neighbors[0];
      }
    }

    return this.searchLevel(queryVector, current, 0, ef);
  }

  private searchLevel(
    queryVector: Float32Array,
    entryPoint: string,
    level: number,
    ef: number
  ): string[] {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; distance: number }> = [];
    const results: Array<{ id: string; distance: number }> = [];

    const entryNode = this.hnswIndex.get(entryPoint);
    if (!entryNode) return [];

    const entryDistance = this.vectorDistance(queryVector, entryNode.vector);
    candidates.push({ id: entryPoint, distance: entryDistance });
    results.push({ id: entryPoint, distance: entryDistance });
    visited.add(entryPoint);

    while (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      if (results.length >= ef && current.distance > results[results.length - 1].distance) {
        break;
      }

      const node = this.hnswIndex.get(current.id);
      if (!node) continue;

      const neighbors = node.neighbors.get(level) || [];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = this.hnswIndex.get(neighborId);
        if (!neighbor) continue;

        const distance = this.vectorDistance(queryVector, neighbor.vector);

        if (results.length < ef || distance < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance });
          results.push({ id: neighborId, distance });
          results.sort((a, b) => a.distance - b.distance);
          if (results.length > ef) {
            results.pop();
          }
        }
      }
    }

    return results.map(r => r.id);
  }

  private findWeakestConnection(node: HNSWNode, level: number): string {
    const neighbors = node.neighbors.get(level) || [];
    if (neighbors.length === 0) return '';

    let weakest = neighbors[0];
    let maxDistance = -1;

    for (const neighborId of neighbors) {
      const neighbor = this.hnswIndex.get(neighborId);
      if (!neighbor) continue;

      const distance = this.vectorDistance(node.vector, neighbor.vector);
      if (distance > maxDistance) {
        maxDistance = distance;
        weakest = neighborId;
      }
    }

    return weakest;
  }

  private getEntryPoint(): string | null {
    if (this.hnswIndex.size === 0) return null;
    const entry = this.hnswIndex.keys().next().value;
    return entry ?? null;
  }

  private randomLevel(): number {
    let level = 0;
    while (Math.random() < 0.5 && level < this.maxLevel) {
      level++;
    }
    return level;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private vectorDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

// Export singleton instance
export const vectorDB = VectorDB.getInstance();

// Re-export types
export type { VectorRecord, VectorDBStats };
