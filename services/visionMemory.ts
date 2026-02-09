/**
 * Vision Memory Service - Persistent Visual Memory for JARVIS
 * 
 * Remembers images you've shown JARVIS and allows searching through them
 * using natural language. Uses CLIP embeddings for semantic image search.
 * 
 * Features:
 * - Store images with visual embeddings
 * - Search past images by text description
 * - Persistent storage across sessions
 * - GPU-accelerated embedding generation
 */

import { EventEmitter } from './eventEmitter';

// Types
export interface VisionMemoryEntry {
  id: string;
  timestamp: number;
  imageUrl: string;  // Base64 or blob URL
  thumbnailUrl: string;
  description: string;  // Generated caption
  tags: string[];
  context: string;  // Chat context when image was shared
  embedding?: Float32Array;
  metadata: {
    width: number;
    height: number;
    size: number;  // bytes
    format: string;  // png, jpg, etc.
  };
}

export interface VisionSearchResult {
  entry: VisionMemoryEntry;
  similarity: number;
}

export interface VisionStats {
  totalImages: number;
  totalSize: number;
  oldestMemory: number;
  newestMemory: number;
  topTags: { tag: string; count: number }[];
}

// Configuration
const VISION_CONFIG = {
  maxMemories: 1000,  // Max images to store
  maxStorageMB: 500,  // Max storage in MB
  embeddingDim: 512,  // CLIP embedding dimension
  similarityThreshold: 0.7,
  serverUrl: 'http://localhost:5004',
  storageKey: 'jarvis_vision_memory'
};

class VisionMemoryService extends EventEmitter {
  private memories: Map<string, VisionMemoryEntry> = new Map();
  private initialized: boolean = false;
  private serverAvailable: boolean = false;
  private lastCheck: number = 0;

  constructor() {
    super();
    this.loadFromStorage();
  }

  /**
   * Initialize the vision memory service
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Check if vision server is available
      this.serverAvailable = await this.checkServerHealth();
      
      if (this.serverAvailable) {
        console.log('[VisionMemory] CLIP server connected');
      } else {
        console.warn('[VisionMemory] CLIP server unavailable, using hash-based search');
      }

      this.initialized = true;
      this.emit('initialized', { serverAvailable: this.serverAvailable });
      return true;
    } catch (error) {
      console.error('[VisionMemory] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if vision embedding server is running
   */
  private async checkServerHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheck < 30000) {
      return this.serverAvailable;
    }
    this.lastCheck = now;

    try {
      const response = await fetch(`${VISION_CONFIG.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Store a new image in vision memory
   */
  async storeImage(
    imageData: string,  // Base64 encoded image
    options: {
      description?: string;
      context?: string;
      tags?: string[];
    } = {}
  ): Promise<VisionMemoryEntry | null> {
    try {
      // Check storage limits
      await this.enforceStorageLimits();

      // Generate embedding via CLIP server
      let embedding: Float32Array | undefined;
      let description = options.description || '';
      let tags = options.tags || [];

      if (this.serverAvailable || await this.checkServerHealth()) {
        const analysis = await this.analyzeImage(imageData);
        embedding = analysis.embedding;
        description = description || analysis.description;
        tags = [...new Set([...tags, ...analysis.tags])];
      }

      // Create memory entry
      const entry: VisionMemoryEntry = {
        id: this.generateId(),
        timestamp: Date.now(),
        imageUrl: imageData,
        thumbnailUrl: await this.createThumbnail(imageData),
        description,
        tags,
        context: options.context || '',
        embedding,
        metadata: await this.getImageMetadata(imageData)
      };

      // Store locally
      this.memories.set(entry.id, entry);
      this.saveToStorage();

      this.emit('memoryAdded', entry);
      console.log(`[VisionMemory] Stored image: ${entry.id}`);

      return entry;
    } catch (error) {
      console.error('[VisionMemory] Failed to store image:', error);
      return null;
    }
  }

  /**
   * Analyze image using CLIP server
   */
  private async analyzeImage(imageData: string): Promise<{
    embedding: Float32Array;
    description: string;
    tags: string[];
  }> {
    const response = await fetch(`${VISION_CONFIG.serverUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    });

    if (!response.ok) {
      throw new Error(`CLIP server error: ${response.status}`);
    }

    const data = await response.json();
    return {
      embedding: new Float32Array(data.embedding),
      description: data.description,
      tags: data.tags
    };
  }

  /**
   * Search vision memories by text query
   */
  async searchMemories(query: string, limit: number = 10): Promise<VisionSearchResult[]> {
    try {
      if (!this.serverAvailable) {
        // Fall back to text-based search
        return this.textSearchMemories(query, limit);
      }

      // Get query embedding
      const response = await fetch(`${VISION_CONFIG.serverUrl}/embed/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query })
      });

      const data = await response.json();
      const queryEmbedding = new Float32Array(data.embedding);

      // Search locally using cosine similarity
      const results: VisionSearchResult[] = [];
      for (const entry of this.memories.values()) {
        if (entry.embedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
          if (similarity > 0.5) {  // Threshold for relevance
            results.push({ entry, similarity });
          }
        }
      }

      // Sort by similarity and limit
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.warn('[VisionMemory] Semantic search failed, using text search:', error);
      return this.textSearchMemories(query, limit);
    }
  }

  /**
   * Text-based search fallback
   */
  private textSearchMemories(query: string, limit: number): VisionSearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    const results: VisionSearchResult[] = [];

    for (const entry of this.memories.values()) {
      let score = 0;
      const text = `${entry.description} ${entry.tags.join(' ')} ${entry.context}`.toLowerCase();

      // Simple term matching
      for (const term of queryTerms) {
        if (text.includes(term)) score += 0.3;
      }

      // Tag exact match
      for (const tag of entry.tags) {
        if (tag.toLowerCase().includes(queryLower)) score += 0.5;
      }

      if (score > 0) {
        results.push({ entry, similarity: Math.min(score, 1) });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find similar images to a given image
   */
  async findSimilarImages(imageData: string, limit: number = 5): Promise<VisionSearchResult[]> {
    if (!this.serverAvailable) {
      return [];
    }

    try {
      // Get image embedding
      const response = await fetch(`${VISION_CONFIG.serverUrl}/embed/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      const data = await response.json();
      const imageEmbedding = new Float32Array(data.embedding);

      // Find similar using cosine similarity
      const results: VisionSearchResult[] = [];
      for (const entry of this.memories.values()) {
        if (entry.embedding) {
          const similarity = this.cosineSimilarity(imageEmbedding, entry.embedding);
          if (similarity > 0.7) {
            results.push({ entry, similarity });
          }
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('[VisionMemory] Similar image search failed:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
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

  /**
   * Get memory by ID
   */
  getMemory(id: string): VisionMemoryEntry | undefined {
    return this.memories.get(id);
  }

  /**
   * Get all memories sorted by date
   */
  getAllMemories(): VisionMemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get memories by tag
   */
  getMemoriesByTag(tag: string): VisionMemoryEntry[] {
    return this.getAllMemories()
      .filter(m => m.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
  }

  /**
   * Get memories from a time range
   */
  getMemoriesByTimeRange(start: number, end: number): VisionMemoryEntry[] {
    return this.getAllMemories()
      .filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<boolean> {
    const entry = this.memories.get(id);
    if (!entry) return false;

    this.memories.delete(id);
    this.saveToStorage();

    this.emit('memoryDeleted', { id });
    return true;
  }

  /**
   * Clear all memories
   */
  async clearAllMemories(): Promise<void> {
    this.memories.clear();
    this.saveToStorage();

    this.emit('memoriesCleared');
  }

  /**
   * Get vision memory statistics
   */
  getStats(): VisionStats {
    const memories = this.getAllMemories();
    const tagCounts = new Map<string, number>();

    for (const m of memories) {
      for (const tag of m.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalImages: memories.length,
      totalSize: memories.reduce((sum, m) => sum + m.metadata.size, 0),
      oldestMemory: memories[memories.length - 1]?.timestamp || 0,
      newestMemory: memories[0]?.timestamp || 0,
      topTags
    };
  }

  /**
   * Create thumbnail from base64 image
   */
  private async createThumbnail(imageData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = imageData;
    });
  }

  /**
   * Get image metadata
   */
  private async getImageMetadata(imageData: string): Promise<VisionMemoryEntry['metadata']> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Estimate size (base64 is ~4/3 of binary)
        const size = Math.ceil((imageData.length * 3) / 4);
        const format = imageData.match(/data:image\/(\w+);/)?.[1] || 'unknown';
        
        resolve({
          width: img.width,
          height: img.height,
          size,
          format
        });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0, size: 0, format: 'unknown' });
      };
      img.src = imageData;
    });
  }

  /**
   * Enforce storage limits
   */
  private async enforceStorageLimits(): Promise<void> {
    const memories = this.getAllMemories();
    
    // Check count limit
    while (memories.length >= VISION_CONFIG.maxMemories) {
      const oldest = memories.pop();
      if (oldest) {
        await this.deleteMemory(oldest.id);
      }
    }

    // Check size limit
    let totalSize = memories.reduce((sum, m) => sum + m.metadata.size, 0);
    const maxBytes = VISION_CONFIG.maxStorageMB * 1024 * 1024;
    
    while (totalSize > maxBytes && memories.length > 0) {
      const oldest = memories.pop();
      if (oldest) {
        totalSize -= oldest.metadata.size;
        await this.deleteMemory(oldest.id);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `vm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save to local storage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify({
        memories: Array.from(this.memories.entries()),
        version: 1
      });
      localStorage.setItem(VISION_CONFIG.storageKey, data);
    } catch (error) {
      console.error('[VisionMemory] Failed to save to storage:', error);
    }
  }

  /**
   * Load from local storage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(VISION_CONFIG.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.memories) {
          this.memories = new Map(parsed.memories);
        }
      }
    } catch (error) {
      console.error('[VisionMemory] Failed to load from storage:', error);
    }
  }

  /**
   * Export memories to file
   */
  exportMemories(): string {
    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      memories: this.getAllMemories()
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import memories from file
   */
  async importMemories(jsonData: string): Promise<number> {
    try {
      const data = JSON.parse(jsonData);
      if (!data.memories || !Array.isArray(data.memories)) {
        throw new Error('Invalid import format');
      }

      let imported = 0;
      for (const memory of data.memories) {
        if (memory.id && memory.imageUrl) {
          this.memories.set(memory.id, memory);
          imported++;
        }
      }

      this.saveToStorage();
      this.emit('memoriesImported', { count: imported });
      return imported;
    } catch (error) {
      console.error('[VisionMemory] Import failed:', error);
      throw error;
    }
  }
}

export const visionMemory = new VisionMemoryService();
export default visionMemory;
