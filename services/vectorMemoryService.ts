/**
 * Vector-Based Memory Management Service - Compatibility Layer
 * 
 * This file now provides a compatibility wrapper around the unified vectorDB.ts.
 * New code should import directly from './vectorDB'.
 * 
 * @deprecated Use vectorDB.ts instead
 */

import { MemoryNode, MemoryType, MemorySearchResult } from '../types';
import { logger } from './logger';
import { vectorDB } from './vectorDB';

interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    content: string;
    type: MemoryType;
    tags: string[];
    created: number;
    lastAccessed: number;
  };
}

/**
 * @deprecated Use vectorDB instead
 */
export class VectorMemoryService {
  private static instance: VectorMemoryService;
  private fallbackStorage: Map<string, VectorRecord> = new Map();
  private memoryIndex: Record<string, string[]> = {};
  private readonly SEMANTIC_THRESHOLD = 0.7;

  private constructor() {}

  public static getInstance(): VectorMemoryService {
    if (!VectorMemoryService.instance) {
      VectorMemoryService.instance = new VectorMemoryService();
    }
    return VectorMemoryService.instance;
  }

  /**
   * Store a memory node
   */
  public async store(node: MemoryNode): Promise<void> {
    try {
      await vectorDB.store(node);
      this.indexMemoryNode(node);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.log('VECTOR_MEMORY', `Failed to store: ${errMsg}`, 'error');
      throw error;
    }
  }

  /**
   * Store identity information
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
  }

  /**
   * Get a memory by ID
   */
  public async getById(id: string): Promise<MemoryNode | null> {
    return vectorDB.getById(id);
  }

  /**
   * Recall memories using semantic search
   */
  public async recall(query: string, maxResults: number = 10): Promise<MemorySearchResult[]> {
    return vectorDB.search(query, { maxResults, minScore: this.SEMANTIC_THRESHOLD });
  }

  /**
   * Forget a memory
   */
  public async forget(id: string): Promise<boolean> {
    return vectorDB.delete(id);
  }

  /**
   * Get user identity
   */
  public async getUserIdentity(): Promise<MemoryNode | null> {
    const results = await vectorDB.search('identity user-info', { maxResults: 1 });
    return results.length > 0 ? results[0].node : null;
  }

  /**
   * Get all memories
   */
  public async getAll(): Promise<MemoryNode[]> {
    const records = await vectorDB.getAll();
    return records.map(r => ({
      id: r.id,
      content: r.metadata.content,
      type: r.metadata.type,
      tags: r.metadata.tags,
      created: r.metadata.created,
      lastAccessed: r.metadata.lastAccessed,
    }));
  }

  /**
   * Get memory statistics
   */
  public async getStats(): Promise<{
    totalMemories: number;
    compressedMemories: number;
    archivedMemories: number;
    indexedTerms: number;
  }> {
    const stats = await vectorDB.getStats();
    return {
      totalMemories: stats.totalVectors,
      compressedMemories: 0,
      archivedMemories: 0,
      indexedTerms: Object.keys(this.memoryIndex).length,
    };
  }

  /**
   * Clear all memories
   */
  public async clear(): Promise<void> {
    await vectorDB.clear();
    this.fallbackStorage.clear();
    this.memoryIndex = {};
  }

  // Private helper methods
  private indexMemoryNode(node: MemoryNode): void {
    const terms = this.tokenize(node.content.toLowerCase());
    const tags = node.tags.map(tag => tag.toLowerCase());
    const allTerms = [...terms, ...tags];

    for (const term of allTerms) {
      if (!this.memoryIndex[term]) {
        this.memoryIndex[term] = [];
      }
      if (!this.memoryIndex[term].includes(node.id)) {
        this.memoryIndex[term].push(node.id);
      }
    }
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\W+/)
      .filter(token => token.length > 0);
  }
}

// Export singleton instance
export const vectorMemoryService = VectorMemoryService.getInstance();

// Initialize
logger.log('VECTOR_MEMORY', 'Vector memory service initialized (compatibility layer)', 'info');
