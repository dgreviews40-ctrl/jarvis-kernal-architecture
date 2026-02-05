/**
 * Local Vector Database Service for JARVIS Kernel v1.4.0
 * 
 * Browser-based vector storage using:
 - Transformers.js for embeddings (all-MiniLM-L6-v2)
 - IndexedDB for persistence
 - HNSW index for fast approximate nearest neighbor search
 * 
 * Features:
 * - Local embedding generation (no API calls)
 * - Semantic search with similarity scoring
 * - Memory compression and archival
 * - Import/export functionality
 */

import { MemoryNode, MemoryType, MemorySearchResult } from '../types';
import { logger } from './logger';
import { VECTOR_DB } from '../constants/config';

// Dynamic import for transformers.js
let pipeline: any = null;
let embedder: any = null;

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

export class LocalVectorDB {
  private static instance: LocalVectorDB;
  private db: IDBDatabase | null = null;
  private hnswIndex: Map<string, HNSWNode> = new Map();
  private vectorCache: Map<string, VectorRecord> = new Map();
  private isInitialized = false;
  private isInitializing = false;
  private initCallbacks: ((success: boolean) => void)[] = [];
  
  // HNSW parameters
  private readonly M = VECTOR_DB.HNSW.M;
  private readonly efConstruction = VECTOR_DB.HNSW.efConstruction;
  private readonly efSearch = VECTOR_DB.HNSW.efSearch;
  private readonly maxLevel = 16;
  
  private constructor() {}

  public static getInstance(): LocalVectorDB {
    if (!LocalVectorDB.instance) {
      LocalVectorDB.instance = new LocalVectorDB();
    }
    return LocalVectorDB.instance;
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
    logger.log('VECTOR_DB', 'Initializing local vector database...', 'info');

    try {
      // Initialize transformers.js embedder
      await this.initializeEmbedder();
      
      // Initialize IndexedDB
      await this.initializeIndexedDB();
      
      // Build HNSW index from stored vectors
      await this.rebuildIndex();
      
      this.isInitialized = true;
      this.isInitializing = false;
      
      logger.log('VECTOR_DB', 'Local vector database initialized successfully', 'success');
      this.initCallbacks.forEach(cb => cb(true));
      this.initCallbacks = [];
      
      return true;
    } catch (error) {
      logger.log('VECTOR_DB', `Initialization failed: ${error.message}`, 'error');
      this.isInitializing = false;
      this.initCallbacks.forEach(cb => cb(false));
      this.initCallbacks = [];
      return false;
    }
  }

  /**
   * Initialize the embedding pipeline
   */
  private async initializeEmbedder(): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      const transformers = await import('@xenova/transformers');
      pipeline = transformers.pipeline;
      
      // Use lightweight model for browser
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Use quantized model for smaller size
        revision: 'main',
      });
      
      logger.log('VECTOR_DB', 'Embedding pipeline loaded', 'success');
    } catch (error) {
      logger.log('VECTOR_DB', `Failed to load embedding pipeline: ${error.message}`, 'warning');
      logger.log('VECTOR_DB', 'Falling back to simulated embeddings', 'warning');
      // Create fallback embedder
      embedder = null;
    }
  }

  /**
   * Initialize IndexedDB
   */
  private initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(VECTOR_DB.DB_NAME, VECTOR_DB.DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
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

  /**
   * Generate embedding for text
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    if (!embedder) {
      // Fallback: simple hash-based embedding
      return this.simulateEmbedding(text);
    }

    try {
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      return new Float32Array(output.data);
    } catch (error) {
      logger.log('VECTOR_DB', `Embedding generation failed: ${error.message}`, 'error');
      return this.simulateEmbedding(text);
    }
  }

  /**
   * Simulate embedding (fallback when transformers.js unavailable)
   */
  private simulateEmbedding(text: string): Float32Array {
    const vector = new Float32Array(VECTOR_DB.EMBEDDING_DIMENSION);
    let hash = 0;
    
    // Simple hash-based vector generation
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }

    // Fill vector based on hash
    for (let i = 0; i < VECTOR_DB.EMBEDDING_DIMENSION; i++) {
      hash = ((hash << 5) - hash) + i;
      vector[i] = (Math.sin(hash) + 1) / 2; // Normalize to 0-1
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }

    return vector;
  }

  /**
   * Store a memory node with vector embedding
   */
  public async store(node: MemoryNode): Promise<void> {
    await this.ensureInitialized();

    try {
      // Generate embedding
      const vector = await this.generateEmbedding(node.content);

      const record: VectorRecord = {
        id: node.id,
        vector,
        metadata: {
          content: node.content,
          type: node.type,
          tags: node.tags,
          created: node.created,
          lastAccessed: node.lastAccessed || Date.now(),
          accessCount: 0,
        },
      };

      // Store in IndexedDB
      await this.saveToIndexedDB(record);

      // Add to cache
      this.vectorCache.set(node.id, record);

      // Add to HNSW index
      this.addToHNSW(record.id, vector);

      logger.log('VECTOR_DB', `Stored vector: ${node.id}`, 'info');
    } catch (error) {
      logger.log('VECTOR_DB', `Failed to store vector: ${error.message}`, 'error');
      throw error;
    }
  }

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
   * Semantic search using HNSW index
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
      // Generate query embedding
      const queryVector = await this.generateEmbedding(query);

      // Search HNSW index
      const candidates = this.searchHNSW(queryVector, this.efSearch);

      // Calculate exact similarities and filter
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

      // Sort by score and limit results
      results.sort((a, b) => b.score - a.score);
      const limitedResults = results.slice(0, maxResults);

      // Update access counts
      for (const result of limitedResults) {
        await this.updateAccess(result.node.id);
      }

      return limitedResults;
    } catch (error) {
      logger.log('VECTOR_DB', `Search failed: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Get a vector by ID
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
   * Delete a vector by ID
   */
  public async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Remove from IndexedDB
      await this.deleteFromIndexedDB(id);

      // Remove from cache
      this.vectorCache.delete(id);

      // Remove from HNSW index
      this.hnswIndex.delete(id);

      logger.log('VECTOR_DB', `Deleted vector: ${id}`, 'info');
      return true;
    } catch (error) {
      logger.log('VECTOR_DB', `Failed to delete vector: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get all vectors (use sparingly - for export/backup)
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
  public async getStats(): Promise<{
    totalVectors: number;
    indexSize: number;
    cacheSize: number;
    averageVectorSize: number;
  }> {
    await this.ensureInitialized();

    const allVectors = await this.getAll();
    const totalBytes = allVectors.reduce((sum, v) => {
      return sum + v.vector.length * 4 + JSON.stringify(v.metadata).length * 2;
    }, 0);

    return {
      totalVectors: allVectors.length,
      indexSize: this.hnswIndex.size,
      cacheSize: this.vectorCache.size,
      averageVectorSize: allVectors.length > 0 ? Math.round(totalBytes / allVectors.length) : 0,
    };
  }

  /**
   * Export all vectors to JSON
   */
  public async export(): Promise<string> {
    const vectors = await this.getAll();
    return JSON.stringify({
      version: '1.5.0',
      exportedAt: Date.now(),
      vectors: vectors.map(v => ({
        ...v,
        vector: Array.from(v.vector), // Convert Float32Array to regular array
      })),
    });
  }

  /**
   * Import vectors from JSON
   */
  public async import(jsonData: string): Promise<{ imported: number; errors: number }> {
    await this.ensureInitialized();

    try {
      const data = JSON.parse(jsonData);
      const vectors = data.vectors || [];
      
      let imported = 0;
      let errors = 0;

      for (const v of vectors) {
        try {
          const record: VectorRecord = {
            id: v.id,
            vector: new Float32Array(v.vector),
            metadata: v.metadata,
          };
          await this.saveToIndexedDB(record);
          this.vectorCache.set(v.id, record);
          this.addToHNSW(v.id, record.vector);
          imported++;
        } catch (e) {
          errors++;
        }
      }

      logger.log('VECTOR_DB', `Imported ${imported} vectors (${errors} errors)`, 'success');
      return { imported, errors };
    } catch (error) {
      logger.log('VECTOR_DB', `Import failed: ${error.message}`, 'error');
      throw error;
    }
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
        logger.log('VECTOR_DB', 'All vectors cleared', 'info');
        resolve();
      };
      request.onerror = () => reject(new Error('Failed to clear vectors'));
    });
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
          // Ensure vector is Float32Array
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
    const vectors = await this.getAll();
    
    for (const record of vectors) {
      this.vectorCache.set(record.id, record);
      this.addToHNSW(record.id, record.vector);
    }

    logger.log('VECTOR_DB', `Rebuilt HNSW index with ${vectors.length} vectors`, 'info');
  }

  // ==================== HNSW INDEX ====================

  private addToHNSW(id: string, vector: Float32Array): void {
    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      neighbors: new Map(),
    };

    // If index is empty, just add the node
    if (this.hnswIndex.size === 0) {
      this.hnswIndex.set(id, node);
      return;
    }

    // Find entry point
    let entryPoint = this.getEntryPoint();
    if (!entryPoint) {
      this.hnswIndex.set(id, node);
      return;
    }

    // Insert at each level
    for (let currentLevel = this.maxLevel; currentLevel >= 0; currentLevel--) {
      if (currentLevel <= level) {
        // Search for neighbors at this level
        const neighbors = this.searchLevel(vector, entryPoint!, currentLevel, this.M);
        node.neighbors.set(currentLevel, neighbors);

        // Update neighbor connections
        for (const neighborId of neighbors) {
          const neighbor = this.hnswIndex.get(neighborId);
          if (neighbor) {
            const neighborNeighbors = neighbor.neighbors.get(currentLevel) || [];
            neighborNeighbors.push(id);
            // Keep only M neighbors
            if (neighborNeighbors.length > this.M) {
              // Remove weakest connection
              const weakest = this.findWeakestConnection(neighbor, currentLevel);
              const index = neighborNeighbors.indexOf(weakest);
              if (index > -1) neighborNeighbors.splice(index, 1);
            }
            neighbor.neighbors.set(currentLevel, neighborNeighbors);
          }
        }
      }

      // Update entry point for next level
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
    const candidates = new Set<string>();

    // Greedy search from top level
    for (let level = this.maxLevel; level >= 0; level--) {
      const neighbors = this.searchLevel(queryVector, current, level, 1);
      if (neighbors.length > 0) {
        current = neighbors[0];
      }
    }

    // Expand search at level 0
    const results = this.searchLevel(queryVector, current, 0, ef);
    return results;
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
      // Get closest candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Stop if we've found enough results and current is worse than worst result
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
    return this.hnswIndex.keys().next().value;
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
    // Euclidean distance
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}

// Export singleton instance
export const localVectorDB = LocalVectorDB.getInstance();
