/**
 * Semantic Memory System
 * 
 * Vector-based semantic memory with:
 * - Embedding-based similarity search
 * - Context-aware retrieval
 * - Memory consolidation and summarization
 * - Forgetting curve simulation
 * - Cross-reference linking
 */

import { memory as memoryOptimized } from "../memory";
import { MemoryNode, MemoryType } from "../../types";

interface SemanticVector {
  id: string;
  values: number[];
  magnitude: number;
}

interface EmbeddedMemory extends MemoryNode {
  embedding: SemanticVector;
  accessCount: number;
  lastAccessed: number;
  importanceScore: number;
  relatedMemories: string[];
  consolidationLevel: number; // 0-1, higher = more consolidated
}

interface RetrievalContext {
  query: string;
  queryEmbedding: SemanticVector;
  recentTopics: string[];
  currentSentiment: number;
  timeContext: number;
}

interface SearchResult {
  memory: EmbeddedMemory;
  semanticScore: number;
  contextualScore: number;
  finalScore: number;
  whyRelevant: string;
}

export class SemanticMemorySystem {
  private memories: Map<string, EmbeddedMemory> = new Map();
  private embeddingIndex: Map<string, number[]> = new Map(); // Simplified index
  private readonly VECTOR_DIMENSION = 50; // Simplified for client-side
  private readonly CONSOLIDATION_THRESHOLD = 5; // Accesses before consolidation

  /**
   * Generate simple embedding vector from text
   * (In production, use a proper embedding model like OpenAI or local embeddings)
   */
  private generateEmbedding(text: string): SemanticVector {
    const words = this.tokenize(text);
    const vector: number[] = new Array(this.VECTOR_DIMENSION).fill(0);
    
    // Simple bag-of-words style embedding with hash-based positioning
    for (const word of words) {
      const hash = this.simpleHash(word);
      for (let i = 0; i < this.VECTOR_DIMENSION; i++) {
        // Distribute word influence across vector based on hash
        const influence = Math.sin(hash * (i + 1)) * (1 / words.length);
        vector[i] += influence;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    const normalized = magnitude > 0 ? vector.map(v => v / magnitude) : vector;

    return {
      id: `emb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      values: normalized,
      magnitude: magnitude > 0 ? magnitude : 1
    };
  }

  /**
   * Simple string hash for embedding generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  /**
   * Tokenize text for embedding
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.isStopWord(w));
  }

  /**
   * Common stop words to filter
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
      'your', 'his', 'her', 'its', 'our', 'their', 'and', 'but',
      'or', 'yet', 'so', 'for', 'nor', 'in', 'on', 'at', 'to',
      'from', 'by', 'with', 'about', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between',
      'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'any',
      'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'not', 'only', 'own', 'same', 'than',
      'too', 'very', 'just', 'now'
    ]);
    return stopWords.has(word);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
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

  /**
   * Store memory with semantic embedding
   */
  async store(
    content: string,
    type: MemoryType = 'FACT',
    tags: string[] = [],
    importance: number = 0.5
  ): Promise<EmbeddedMemory> {
    const embedding = this.generateEmbedding(content);
    
    const memory: EmbeddedMemory = {
      id: `sem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      tags,
      created: Date.now(),
      embedding,
      accessCount: 0,
      lastAccessed: Date.now(),
      importanceScore: importance,
      relatedMemories: [],
      consolidationLevel: 0
    };

    // Find related memories
    memory.relatedMemories = this.findRelatedMemoryIds(memory);
    
    // Store in both systems
    this.memories.set(memory.id, memory);
    await memoryOptimized.store(content, type, tags);

    return memory;
  }

  /**
   * Find related memory IDs based on embedding similarity
   */
  private findRelatedMemoryIds(memory: EmbeddedMemory, threshold: number = 0.7): string[] {
    const related: string[] = [];
    
    for (const [id, other] of this.memories) {
      if (id === memory.id) continue;
      
      const similarity = this.cosineSimilarity(
        memory.embedding.values,
        other.embedding.values
      );
      
      if (similarity > threshold) {
        related.push(id);
        // Bidirectional link
        if (!other.relatedMemories.includes(memory.id)) {
          other.relatedMemories.push(memory.id);
        }
      }
    }
    
    return related.slice(0, 5); // Limit to top 5
  }

  /**
   * Semantic search with context awareness
   */
  async search(
    query: string,
    context: Partial<RetrievalContext> = {},
    limit: number = 5
  ): Promise<SearchResult[]> {
    const queryEmbedding = this.generateEmbedding(query);
    
    const fullContext: RetrievalContext = {
      query,
      queryEmbedding,
      recentTopics: context.recentTopics || [],
      currentSentiment: context.currentSentiment || 0,
      timeContext: context.timeContext || Date.now()
    };

    const results: SearchResult[] = [];

    for (const memory of this.memories.values()) {
      // Calculate semantic similarity
      const semanticScore = this.cosineSimilarity(
        queryEmbedding.values,
        memory.embedding.values
      );

      // Calculate contextual relevance
      const contextualScore = this.calculateContextualScore(memory, fullContext);

      // Calculate forgetting curve penalty
      const forgettingPenalty = this.calculateForgettingPenalty(memory);

      // Boost by importance and access count
      const importanceBoost = memory.importanceScore * 0.1;
      const familiarityBoost = Math.min(0.1, memory.accessCount * 0.01);

      // Final score
      const finalScore = (
        semanticScore * 0.5 +
        contextualScore * 0.3 +
        importanceBoost +
        familiarityBoost
      ) * (1 - forgettingPenalty);

      if (finalScore > 0.2) {
        results.push({
          memory,
          semanticScore,
          contextualScore,
          finalScore,
          whyRelevant: this.explainRelevance(memory, semanticScore, contextualScore)
        });
      }
    }

    // Sort by final score and update access counts
    const sorted = results
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    // Update access statistics
    for (const result of sorted) {
      result.memory.accessCount++;
      result.memory.lastAccessed = Date.now();
      
      // Check for consolidation
      if (result.memory.accessCount >= this.CONSOLIDATION_THRESHOLD) {
        result.memory.consolidationLevel = Math.min(1, 
          result.memory.consolidationLevel + 0.1
        );
      }
    }

    return sorted;
  }

  /**
   * Calculate contextual relevance score
   */
  private calculateContextualScore(
    memory: EmbeddedMemory,
    context: RetrievalContext
  ): number {
    let score = 0;
    let factors = 0;

    // Topic overlap
    if (context.recentTopics.length > 0) {
      const memoryTopics = new Set(memory.tags);
      const overlap = context.recentTopics.filter(t => memoryTopics.has(t)).length;
      score += overlap / Math.max(context.recentTopics.length, memoryTopics.size);
      factors++;
    }

    // Sentiment alignment
    if (context.currentSentiment !== 0) {
      // Memories created during similar emotional states are more relevant
      const sentimentAlignment = 1 - Math.abs(context.currentSentiment * 0.1);
      score += sentimentAlignment;
      factors++;
    }

    // Recency boost (within last hour)
    const hoursSinceCreation = (context.timeContext - memory.created) / (1000 * 60 * 60);
    if (hoursSinceCreation < 1) {
      score += 0.3 * (1 - hoursSinceCreation);
      factors++;
    }

    // Related memory boost
    if (memory.relatedMemories.length > 0) {
      // Check if any recently accessed memories are related
      const recentlyAccessed = Array.from(this.memories.values())
        .filter(m => context.timeContext - m.lastAccessed < 300000) // 5 minutes
        .map(m => m.id);
      
      const relatedOverlap = memory.relatedMemories.filter(id => 
        recentlyAccessed.includes(id)
      ).length;
      
      if (relatedOverlap > 0) {
        score += 0.2 * relatedOverlap;
        factors++;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate forgetting curve penalty (Ebbinghaus curve)
   */
  private calculateForgettingPenalty(memory: EmbeddedMemory): number {
    const daysSinceAccess = (Date.now() - memory.lastAccessed) / (1000 * 60 * 60 * 24);
    const retention = Math.exp(-daysSinceAccess / (memory.consolidationLevel * 30 + 5));
    return 1 - retention;
  }

  /**
   * Generate explanation for why memory is relevant
   */
  private explainRelevance(
    memory: EmbeddedMemory,
    semanticScore: number,
    contextualScore: number
  ): string {
    const reasons: string[] = [];

    if (semanticScore > 0.8) {
      reasons.push('high semantic similarity');
    } else if (semanticScore > 0.6) {
      reasons.push('moderate semantic match');
    }

    if (contextualScore > 0.7) {
      reasons.push('strong contextual relevance');
    }

    if (memory.accessCount > 5) {
      reasons.push('frequently accessed');
    }

    if (memory.consolidationLevel > 0.5) {
      reasons.push('well-consolidated memory');
    }

    if (memory.relatedMemories.length > 0) {
      reasons.push('connected to other memories');
    }

    return reasons.join(', ') || 'general relevance';
  }

  /**
   * Consolidate similar memories into summaries
   */
  async consolidateMemories(threshold: number = 0.85): Promise<EmbeddedMemory[]> {
    const consolidated: EmbeddedMemory[] = [];
    const processed = new Set<string>();

    for (const memory of this.memories.values()) {
      if (processed.has(memory.id)) continue;

      // Find highly similar memories
      const similar: EmbeddedMemory[] = [memory];
      for (const other of this.memories.values()) {
        if (other.id === memory.id || processed.has(other.id)) continue;
        
        const similarity = this.cosineSimilarity(
          memory.embedding.values,
          other.embedding.values
        );
        
        if (similarity > threshold) {
          similar.push(other);
          processed.add(other.id);
        }
      }

      if (similar.length > 2) {
        // Create consolidated summary
        const summary = this.summarizeMemories(similar);
        const consolidatedMemory = await this.store(
          summary,
          'SUMMARY',
          [...new Set(similar.flatMap(m => m.tags))],
          Math.max(...similar.map(m => m.importanceScore))
        );
        
        consolidated.push(consolidatedMemory);
        processed.add(memory.id);
      }
    }

    return consolidated;
  }

  /**
   * Summarize multiple memories into one
   */
  private summarizeMemories(memories: EmbeddedMemory[]): string {
    const topics = [...new Set(memories.flatMap(m => m.tags))].slice(0, 3);
    const count = memories.length;
    
    return `Consolidated memory of ${count} related items about ${topics.join(', ')}. ` +
           `Key points: ${memories.map(m => m.content.substring(0, 50)).join('; ')}`;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalMemories: number;
    averageConsolidation: number;
    totalAccesses: number;
    averageEmbeddingMagnitude: number;
    memoryTypes: Record<MemoryType, number>;
  } {
    const memories = Array.from(this.memories.values());
    
    const types: Record<MemoryType, number> = { FACT: 0, PREFERENCE: 0, EPISODE: 0, SUMMARY: 0 };
    memories.forEach(m => types[m.type]++);

    return {
      totalMemories: memories.length,
      averageConsolidation: memories.reduce((sum, m) => sum + m.consolidationLevel, 0) / memories.length || 0,
      totalAccesses: memories.reduce((sum, m) => sum + m.accessCount, 0),
      averageEmbeddingMagnitude: memories.reduce((sum, m) => sum + m.embedding.magnitude, 0) / memories.length || 0,
      memoryTypes: types
    };
  }

  /**
   * Export memory graph for visualization
   */
  exportMemoryGraph(): {
    nodes: { id: string; label: string; type: MemoryType; importance: number }[];
    edges: { source: string; target: string; weight: number }[];
  } {
    const nodes = Array.from(this.memories.values()).map(m => ({
      id: m.id,
      label: m.content.substring(0, 30) + '...',
      type: m.type,
      importance: m.importanceScore
    }));

    const edges: { source: string; target: string; weight: number }[] = [];
    const added = new Set<string>();

    for (const memory of this.memories.values()) {
      for (const relatedId of memory.relatedMemories) {
        const edgeKey = [memory.id, relatedId].sort().join('-');
        if (!added.has(edgeKey)) {
          const related = this.memories.get(relatedId);
          if (related) {
            const similarity = this.cosineSimilarity(
              memory.embedding.values,
              related.embedding.values
            );
            edges.push({
              source: memory.id,
              target: relatedId,
              weight: similarity
            });
            added.add(edgeKey);
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Phase 4, Task 1: Get relevant memories for prompt context
   * Retrieves semantically similar memories to enhance AI context
   */
  async getRelevantMemories(
    query: string,
    options: {
      maxResults?: number;
      minScore?: number;
      includeRelated?: boolean;
    } = {}
  ): Promise<{
    hasMemories: boolean;
    memories: Array<{
      content: string;
      type: MemoryType;
      relevance: number;
      whyRelevant: string;
    }>;
    contextText: string;
  }> {
    const { maxResults = 3, minScore = 0.3, includeRelated = true } = options;

    const results = await this.search(query, {}, maxResults * 2);
    
    // Filter by minimum score
    const filtered = results.filter(r => r.finalScore >= minScore).slice(0, maxResults);

    if (filtered.length === 0) {
      return { hasMemories: false, memories: [], contextText: '' };
    }

    const memories = filtered.map(r => ({
      content: r.memory.content,
      type: r.memory.type,
      relevance: r.finalScore,
      whyRelevant: r.whyRelevant
    }));

    // Build context text
    const contextParts: string[] = [];
    
    // Group by type for better organization
    const byType = memories.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<MemoryType, typeof memories>);

    // Add facts first
    if (byType['FACT']?.length) {
      contextParts.push('Known facts:');
      byType['FACT'].forEach(m => contextParts.push(`- ${m.content}`));
    }

    // Add preferences
    if (byType['PREFERENCE']?.length) {
      contextParts.push('User preferences:');
      byType['PREFERENCE'].forEach(m => contextParts.push(`- ${m.content}`));
    }

    // Add episodes (recent experiences)
    if (byType['EPISODE']?.length) {
      contextParts.push('Recent interactions:');
      byType['EPISODE'].forEach(m => contextParts.push(`- ${m.content}`));
    }

    // Add summaries
    if (byType['SUMMARY']?.length) {
      contextParts.push('Context:');
      byType['SUMMARY'].forEach(m => contextParts.push(`- ${m.content}`));
    }

    // Include related memories if requested
    if (includeRelated && filtered.length > 0) {
      const relatedMemories = new Set<EmbeddedMemory>();
      
      for (const result of filtered) {
        for (const relatedId of result.memory.relatedMemories) {
          const related = this.memories.get(relatedId);
          if (related && !filtered.some(f => f.memory.id === related.id)) {
            relatedMemories.add(related);
          }
        }
      }

      if (relatedMemories.size > 0) {
        contextParts.push('Related information:');
        Array.from(relatedMemories)
          .slice(0, 2)
          .forEach(m => contextParts.push(`- ${m.content}`));
      }
    }

    return {
      hasMemories: true,
      memories,
      contextText: contextParts.join('\n')
    };
  }

  /**
   * Quick memory recall for a specific topic
   */
  async recall(topic: string, limit: number = 3): Promise<string[]> {
    const results = await this.search(topic, {}, limit);
    return results.map(r => r.memory.content);
  }
}

export const semanticMemory = new SemanticMemorySystem();
