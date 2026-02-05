/**
 * Advanced Memory Management Service for JARVIS Kernel v1.3
 * 
 * Implements sophisticated memory management features:
 * - Semantic search capabilities
 * - Memory compression for older entries
 * - Automatic memory archival
 * - Vector-based similarity matching
 */

import { MemoryNode, MemoryType, MemorySearchResult } from '../types';
import { logger } from './logger';

interface MemoryIndex {
  [key: string]: number[]; // Maps terms to memory node indices
}

interface VectorEmbedding {
  id: string;
  vector: number[];
  text: string;
}

export class AdvancedMemoryService {
  private static instance: AdvancedMemoryService;
  private memoryNodes: MemoryNode[] = [];
  private memoryIndex: MemoryIndex = {};
  private vectorEmbeddings: Map<string, VectorEmbedding> = new Map();
  private readonly MAX_EMBEDDING_DIMENSION = 1536; // Common dimension for OpenAI embeddings
  private readonly SEMANTIC_THRESHOLD = 0.7; // Minimum similarity for semantic matches
  private readonly COMPRESSION_AGE_DAYS = 30; // Age in days after which memories are compressed
  private readonly ARCHIVE_AGE_DAYS = 365; // Age in days after which memories are archived

  private constructor() {}

  public static getInstance(): AdvancedMemoryService {
    if (!AdvancedMemoryService.instance) {
      AdvancedMemoryService.instance = new AdvancedMemoryService();
    }
    return AdvancedMemoryService.instance;
  }

  /**
   * Store a memory node with automatic indexing
   */
  public async store(node: MemoryNode): Promise<void> {
    this.memoryNodes.push(node);
    this.indexMemoryNode(node);
    await this.generateVectorEmbedding(node);
    
    logger.log('MEMORY', `Stored memory node: ${node.id}`, 'info');
  }

  /**
   * Store identity information with special indexing
   */
  public async storeIdentity(content: string): Promise<void> {
    const identityNode: MemoryNode = {
      id: `identity_${Date.now()}`,
      content,
      type: 'FACT',
      tags: ['identity', 'user-info', 'permanent'],
      created: Date.now(),
      lastAccessed: Date.now()
    };
    
    await this.store(identityNode);
    logger.log('MEMORY', 'Stored identity information', 'info');
  }

  /**
   * Retrieve a memory node by ID
   */
  public async getById(id: string): Promise<MemoryNode | null> {
    const node = this.memoryNodes.find(n => n.id === id);
    if (node) {
      node.lastAccessed = Date.now();
      this.updateMemoryIndex(id, node);
      logger.log('MEMORY', `Retrieved memory node: ${id}`, 'info');
    }
    return node || null;
  }

  /**
   * Recall memories using semantic search
   */
  public async recall(query: string, maxResults: number = 10): Promise<MemorySearchResult[]> {
    // First, try semantic search using vector embeddings
    const semanticResults = await this.semanticSearch(query, maxResults);
    
    if (semanticResults.length > 0) {
      logger.log('MEMORY', `Semantic search found ${semanticResults.length} results`, 'info');
      return semanticResults;
    }
    
    // Fall back to keyword-based search
    const keywordResults = this.keywordSearch(query, maxResults);
    logger.log('MEMORY', `Keyword search found ${keywordResults.length} results`, 'info');
    
    return keywordResults;
  }

  /**
   * Semantic search using vector embeddings
   */
  private async semanticSearch(query: string, maxResults: number): Promise<MemorySearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.generateTextEmbedding(query);
    
    // Calculate cosine similarity with all stored embeddings
    const similarities: Array<{ id: string; similarity: number }> = [];
    
    for (const [id, embedding] of this.vectorEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding.vector);
      if (similarity >= this.SEMANTIC_THRESHOLD) {
        similarities.push({ id, similarity });
      }
    }
    
    // Sort by similarity and return top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    const results: MemorySearchResult[] = [];
    for (const { id, similarity } of similarities.slice(0, maxResults)) {
      const node = this.memoryNodes.find(n => n.id === id);
      if (node) {
        results.push({
          node,
          score: similarity
        });
      }
    }
    
    return results;
  }

  /**
   * Keyword-based search
   */
  private keywordSearch(query: string, maxResults: number): MemorySearchResult[] {
    const queryTerms = this.tokenize(query.toLowerCase());
    const scoredResults: Array<{ node: MemoryNode; score: number }> = [];

    for (const node of this.memoryNodes) {
      let score = 0;
      
      // Score based on content matching
      const contentLower = node.content.toLowerCase();
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 2; // Higher weight for content matches
        }
      }
      
      // Score based on tag matching
      for (const tag of node.tags) {
        if (queryTerms.includes(tag.toLowerCase())) {
          score += 1; // Lower weight for tag matches
        }
      }
      
      if (score > 0) {
        scoredResults.push({ node, score });
      }
    }

    // Sort by score and return top results
    scoredResults.sort((a, b) => b.score - a.score);
    
    return scoredResults
      .slice(0, maxResults)
      .map(({ node, score }) => ({
        node,
        score: score / (queryTerms.length || 1) // Normalize score
      }));
  }

  /**
   * Forget a memory node by ID
   */
  public async forget(id: string): Promise<boolean> {
    const initialLength = this.memoryNodes.length;
    this.memoryNodes = this.memoryNodes.filter(node => node.id !== id);
    
    // Remove from index
    this.removeFromIndex(id);
    
    // Remove from embeddings
    this.vectorEmbeddings.delete(id);
    
    const removed = initialLength !== this.memoryNodes.length;
    if (removed) {
      logger.log('MEMORY', `Forgot memory node: ${id}`, 'info');
    }
    
    return removed;
  }

  /**
   * Compress older memories to save space
   */
  public async compressOldMemories(): Promise<number> {
    const now = Date.now();
    const cutoffDate = now - (this.COMPRESSION_AGE_DAYS * 24 * 60 * 60 * 1000); // Convert days to ms
    let compressedCount = 0;

    for (const node of this.memoryNodes) {
      if (node.created < cutoffDate && !node.tags.includes('compressed')) {
        // Compress the content (in a real implementation, this would use actual compression)
        node.content = this.compressContent(node.content);
        node.tags.push('compressed');
        compressedCount++;
        
        // Regenerate embedding for compressed content
        await this.generateVectorEmbedding(node);
      }
    }

    logger.log('MEMORY', `Compressed ${compressedCount} old memories`, 'info');
    return compressedCount;
  }

  /**
   * Archive old memories that are rarely accessed
   */
  public async archiveOldMemories(): Promise<number> {
    const now = Date.now();
    const cutoffDate = now - (this.ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000); // Convert days to ms
    let archivedCount = 0;

    for (const node of this.memoryNodes) {
      // Archive if older than threshold and not accessed recently
      const lastAccessed = node.lastAccessed || node.created;
      const wasAccessedRecently = (now - lastAccessed) < (30 * 24 * 60 * 60 * 1000); // Within last 30 days
      
      if (node.created < cutoffDate && !wasAccessedRecently && !node.tags.includes('archived')) {
        node.tags.push('archived');
        archivedCount++;
        
        // In a real implementation, we would move this to an archive store
        // For now, we'll just mark it as archived
      }
    }

    logger.log('MEMORY', `Archived ${archivedCount} old memories`, 'info');
    return archivedCount;
  }

  /**
   * Get user identity information
   */
  public async getUserIdentity(): Promise<MemoryNode | null> {
    const identityNodes = this.memoryNodes.filter(node => 
      node.tags.includes('identity') || node.tags.includes('user-info')
    );
    
    if (identityNodes.length > 0) {
      // Return the most recently stored identity information
      identityNodes.sort((a, b) => b.created - a.created);
      return identityNodes[0];
    }
    
    return null;
  }

  /**
   * Index a memory node for faster keyword search
   */
  private indexMemoryNode(node: MemoryNode): void {
    const terms = [
      ...this.tokenize(node.content.toLowerCase()),
      ...node.tags.map(tag => tag.toLowerCase())
    ];
    
    for (const term of terms) {
      if (!this.memoryIndex[term]) {
        this.memoryIndex[term] = [];
      }
      this.memoryIndex[term].push(this.memoryNodes.length - 1); // Store index of the node
    }
  }

  /**
   * Update index for an existing memory node
   */
  private updateMemoryIndex(id: string, node: MemoryNode): void {
    // Remove old index entries
    this.removeFromIndex(id);
    
    // Add new index entries
    this.indexMemoryNode(node);
  }

  /**
   * Remove a memory node from the index
   */
  private removeFromIndex(id: string): void {
    const nodeIndex = this.memoryNodes.findIndex(n => n.id === id);
    if (nodeIndex === -1) return;
    
    // Remove this node index from all term indexes
    for (const [term, indices] of Object.entries(this.memoryIndex)) {
      this.memoryIndex[term] = indices.filter(idx => idx !== nodeIndex);
    }
  }

  /**
   * Generate vector embedding for a memory node
   */
  private async generateVectorEmbedding(node: MemoryNode): Promise<void> {
    const embedding = await this.generateTextEmbedding(node.content);
    this.vectorEmbeddings.set(node.id, {
      id: node.id,
      vector: embedding,
      text: node.content
    });
  }

  /**
   * Generate text embedding (simulated)
   */
  private async generateTextEmbedding(text: string): Promise<number[]> {
    // In a real implementation, this would call an embedding API
    // For simulation, we'll create a deterministic vector based on the text
    const vector: number[] = new Array(this.MAX_EMBEDDING_DIMENSION).fill(0);
    
    // Create a simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const position = i % this.MAX_EMBEDDING_DIMENSION;
      vector[position] = (vector[position] + charCode) % 1;
    }
    
    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] ** 2;
      normB += vecB[i] ** 2;
    }
    
    if (normA === 0 || normB === 0) {
      return 0; // Undefined similarity if one vector is zero
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    // Simple tokenization: split on non-word characters and filter empty strings
    return text
      .split(/\W+/)
      .filter(token => token.length > 0);
  }

  /**
   * Compress content (simulated)
   */
  private compressContent(content: string): string {
    // In a real implementation, this would use actual compression
    // For simulation, we'll just truncate very long content
    if (content.length > 1000) {
      return content.substring(0, 1000) + '... [COMPRESSED]';
    }
    return content;
  }

  /**
   * Get memory statistics
   */
  public getStats(): {
    totalMemories: number;
    compressedMemories: number;
    archivedMemories: number;
    indexedTerms: number;
    embeddingCount: number;
  } {
    const compressedCount = this.memoryNodes.filter(n => n.tags.includes('compressed')).length;
    const archivedCount = this.memoryNodes.filter(n => n.tags.includes('archived')).length;
    
    return {
      totalMemories: this.memoryNodes.length,
      compressedMemories: compressedCount,
      archivedMemories: archivedCount,
      indexedTerms: Object.keys(this.memoryIndex).length,
      embeddingCount: this.vectorEmbeddings.size
    };
  }

  /**
   * Get all memory nodes
   */
  public getAll(): MemoryNode[] {
    return [...this.memoryNodes];
  }

  /**
   * Clear all memories (for testing purposes)
   */
  public clear(): void {
    this.memoryNodes = [];
    this.memoryIndex = {};
    this.vectorEmbeddings.clear();
    logger.log('MEMORY', 'Cleared all memories', 'info');
  }
}

// Export singleton instance
export const advancedMemoryService = AdvancedMemoryService.getInstance();

// Initialize advanced memory service when module loads
logger.log('MEMORY', 'Advanced memory service initialized', 'info');