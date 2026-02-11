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
   * 
   * Uses multiple strategies to find user identity:
   * 1. Direct search with expanded tag filters (most reliable)
   * 2. Semantic search with expanded query
   * 3. Fallback to legacy memory service
   */
  public async getUserIdentity(): Promise<MemoryNode | null> {
    // Strategy 1: Search with expanded tag filters (includes 'auto_learned' from learning.ts)
    try {
      const results = await vectorDB.search('my name user identity', { 
        maxResults: 10,
        minScore: 0.5, // Lower threshold for identity searches
        filter: (record) => {
          const tags = record.metadata.tags || [];
          return tags.includes('identity') || 
                 tags.includes('user-info') ||
                 tags.includes('user_identity') ||
                 tags.includes('auto_learned');
        }
      });
      
      if (results.length > 0) {
        // Sort by relevance and pick the best match
        const bestMatch = results.sort((a, b) => b.score - a.score)[0];
        logger.log('VECTOR_MEMORY', `Found identity via tag filter: ${bestMatch.node.content.substring(0, 50)}...`, 'info');
        return bestMatch.node;
      }
    } catch (error) {
      logger.log('VECTOR_MEMORY', `Tag filter search failed: ${error}`, 'warning');
    }
    
    // Strategy 2: Broader semantic search without tag filter
    try {
      const fallbackResults = await vectorDB.search('user identity name personal information', { 
        maxResults: 5,
        minScore: 0.4 // Even lower threshold for fallback
      });
      
      // Filter results to find identity-related content
      const identityResult = fallbackResults.find(r => {
        const content = r.node.content.toLowerCase();
        const tags = r.node.tags || [];
        return tags.some(t => ['identity', 'user-info', 'user_identity', 'auto_learned', 'name'].includes(t)) ||
               content.includes('my name') ||
               content.includes('i am') ||
               content.includes("i'm") ||
               content.includes('call me');
      });
      
      if (identityResult) {
        logger.log('VECTOR_MEMORY', `Found identity via semantic search: ${identityResult.node.content.substring(0, 50)}...`, 'info');
        return identityResult.node;
      }
    } catch (error) {
      logger.log('VECTOR_MEMORY', `Semantic search failed: ${error}`, 'warning');
    }
    
    // Strategy 3: Fallback to legacy memory service
    try {
      const { memory } = await import('./memory');
      const identityNode = await memory.getUserIdentity();
      if (identityNode) {
        logger.log('VECTOR_MEMORY', `Found identity via legacy memory: ${identityNode.content.substring(0, 50)}...`, 'info');
        return identityNode;
      }
    } catch (error) {
      logger.log('VECTOR_MEMORY', `Legacy memory fallback failed: ${error}`, 'warning');
    }
    
    logger.log('VECTOR_MEMORY', 'No user identity found in any storage', 'info');
    return null;
  }

  /**
   * Get user hobbies
   * 
   * Searches for memories tagged with hobby-related tags
   */
  public async getUserHobbies(): Promise<MemoryNode[]> {
    const hobbies: MemoryNode[] = [];
    
    // Strategy 1: Search with hobby tag filter
    try {
      const results = await vectorDB.search('user hobbies interests activities', { 
        maxResults: 10,
        minScore: 0.4,
        filter: (record) => {
          const tags = record.metadata.tags || [];
          return tags.includes('hobby') || 
                 tags.includes('hobbies') ||
                 tags.includes('interest') ||
                 tags.includes('auto_learned');
        }
      });
      
      for (const result of results) {
        const content = result.node.content.toLowerCase();
        // Check if it's actually hobby-related content
        if (content.includes('hobby') || content.includes('like') || content.includes('enjoy')) {
          hobbies.push(result.node);
        }
      }
    } catch (error) {
      logger.log('VECTOR_MEMORY', `Hobby search failed: ${error}`, 'warning');
    }
    
    // Strategy 2: Fallback to legacy memory
    if (hobbies.length === 0) {
      try {
        const { memory } = await import('./memory');
        const allMemories = await memory.getAll();
        for (const node of allMemories) {
          const content = node.content.toLowerCase();
          const tags = node.tags.map(t => t.toLowerCase());
          if (tags.includes('hobby') || tags.includes('hobbies') ||
              content.includes('user hobby') || content.includes('hobby:')) {
            hobbies.push(node);
          }
        }
      } catch (error) {
        logger.log('VECTOR_MEMORY', `Legacy memory hobby fallback failed: ${error}`, 'warning');
      }
    }
    
    return hobbies;
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
