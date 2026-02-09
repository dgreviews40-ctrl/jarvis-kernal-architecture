/**
 * Memory Consolidation Service for JARVIS Kernel v1.4.1
 * 
 * Implements intelligent memory management:
 * - Automatic merging of similar memories
 * - Memory decay for low-priority items
 * - Cross-session context persistence
 * - Memory deduplication
 * - Importance scoring
 * 
 * Features:
 * - Semantic similarity detection using vector DB
 * - Configurable merge strategies
 * - Time-based decay with configurable curves
 * - Session summary persistence
 * - Memory cleanup and optimization
 */

import { MemoryNode, MemoryType, MemorySearchResult } from '../types';
import { localVectorDB } from './localVectorDB';
import { logger } from './logger';
import { VECTOR_DB } from '../constants/config';
import { useKernelStore } from '../stores';

interface ConsolidationConfig {
  /** Similarity threshold for merging (0-1) */
  mergeThreshold: number;
  /** High similarity threshold for deduplication */
  duplicateThreshold: number;
  /** Days before decay starts */
  decayStartDays: number;
  /** Decay rate per day (0-1) */
  decayRate: number;
  /** Minimum relevance score to keep */
  minRelevanceScore: number;
  /** Maximum memories before forced consolidation */
  maxMemories: number;
  /** Enable automatic consolidation */
  autoConsolidate: boolean;
  /** Consolidation interval (ms) */
  consolidationIntervalMs: number;
}

interface MemoryStats {
  totalMemories: number;
  mergedThisSession: number;
  decayedThisSession: number;
  duplicatesRemoved: number;
  averageSimilarity: number;
  oldestMemory: number;
  newestMemory: number;
}

interface SessionSummary {
  id: string;
  sessionStart: number;
  sessionEnd: number;
  topics: string[];
  keyFacts: string[];
  userPreferences: string[];
  summary: string;
  vectorEmbedding?: Float32Array;
}

interface ConsolidationResult {
  action: 'merged' | 'decayed' | 'deduplicated' | 'kept';
  memoryId: string;
  details: string;
  relevanceScore: number;
}

export class MemoryConsolidationService {
  private static instance: MemoryConsolidationService;
  private config: ConsolidationConfig;
  private stats: MemoryStats;
  private consolidationTimer: number | null = null;
  private sessionSummaries: Map<string, SessionSummary> = new Map();
  private currentSessionId: string;

  private constructor() {
    this.config = {
      mergeThreshold: 0.85,
      duplicateThreshold: 0.95,
      decayStartDays: 30,
      decayRate: 0.05,
      minRelevanceScore: 0.3,
      maxMemories: 10000,
      autoConsolidate: true,
      consolidationIntervalMs: 5 * 60 * 1000, // 5 minutes
    };

    this.stats = {
      totalMemories: 0,
      mergedThisSession: 0,
      decayedThisSession: 0,
      duplicatesRemoved: 0,
      averageSimilarity: 0,
      oldestMemory: 0,
      newestMemory: 0,
    };

    this.currentSessionId = `session_${Date.now()}`;
  }

  public static getInstance(): MemoryConsolidationService {
    if (!MemoryConsolidationService.instance) {
      MemoryConsolidationService.instance = new MemoryConsolidationService();
    }
    return MemoryConsolidationService.instance;
  }

  /**
   * Initialize the consolidation service
   */
  public async initialize(): Promise<void> {
    logger.log('MEMORY', 'Initializing v1.4.1 memory consolidation...', 'info');

    // Load session summaries from storage
    await this.loadSessionSummaries();

    // Start auto-consolidation if enabled
    if (this.config.autoConsolidate) {
      this.startAutoConsolidation();
    }

    logger.log('MEMORY', 'Memory consolidation ready', 'success');
  }

  /**
   * Store a memory with automatic consolidation
   */
  public async storeWithConsolidation(memory: MemoryNode): Promise<{
    stored: boolean;
    action: 'stored' | 'merged' | 'deduplicated';
    memoryId: string;
  }> {
    await this.ensureInitialized();

    // Check for duplicates first
    const duplicates = await this.findDuplicates(memory);
    if (duplicates.length > 0) {
      this.stats.duplicatesRemoved++;
      logger.log('MEMORY', `Deduplicated memory: ${memory.id}`, 'info');
      return { stored: false, action: 'deduplicated', memoryId: duplicates[0].node.id };
    }

    // Check for similar memories to merge
    const similar = await this.findSimilarMemories(memory, this.config.mergeThreshold);
    if (similar.length > 0) {
      // Merge with the most similar memory
      const merged = await this.mergeMemories(similar[0].node, memory);
      this.stats.mergedThisSession++;
      logger.log('MEMORY', `Merged memory ${memory.id} into ${merged.id}`, 'info');
      return { stored: true, action: 'merged', memoryId: merged.id };
    }

    // Store as new memory
    await localVectorDB.store(memory);
    this.stats.totalMemories++;
    
    return { stored: true, action: 'stored', memoryId: memory.id };
  }

  /**
   * Find duplicate memories (very high similarity)
   */
  private async findDuplicates(memory: MemoryNode): Promise<MemorySearchResult[]> {
    const results = await localVectorDB.search(memory.content, {
      maxResults: 5,
      minScore: this.config.duplicateThreshold,
    });

    // Additional check: exact or near-exact content match
    return results.filter(r => {
      const contentSimilarity = this.calculateContentSimilarity(
        memory.content.toLowerCase(),
        r.node.content.toLowerCase()
      );
      return contentSimilarity > 0.9;
    });
  }

  /**
   * Find similar memories for potential merging
   */
  private async findSimilarMemories(
    memory: MemoryNode,
    minScore: number
  ): Promise<MemorySearchResult[]> {
    return await localVectorDB.search(memory.content, {
      maxResults: 5,
      minScore: minScore,
    });
  }

  /**
   * Merge two similar memories into one
   */
  private async mergeMemories(existing: MemoryNode, incoming: MemoryNode): Promise<MemoryNode> {
    // Combine content intelligently
    const mergedContent = this.combineContent(existing.content, incoming.content);
    
    // Merge tags
    const mergedTags = Array.from(new Set([...existing.tags, ...incoming.tags]));
    
    // Keep the older creation date
    const created = Math.min(existing.created, incoming.created);
    
    // Update last accessed
    const lastAccessed = Date.now();
    
    // Calculate new relevance score
    const relevanceBoost = 0.1; // Merged memories get a boost
    
    const merged: MemoryNode = {
      id: existing.id, // Keep existing ID
      content: mergedContent,
      type: existing.type,
      tags: mergedTags,
      created,
      lastAccessed,
    };

    // Store merged memory
    await localVectorDB.store(merged);

    // Delete the incoming memory if it was already stored
    if (incoming.id !== existing.id) {
      await localVectorDB.delete(incoming.id);
    }

    return merged;
  }

  /**
   * Combine two memory contents intelligently
   */
  private combineContent(existing: string, incoming: string): string {
    // If one is a substring of the other, use the longer one
    if (existing.includes(incoming)) return existing;
    if (incoming.includes(existing)) return incoming;

    // If they're very similar, merge sentences
    const existingSentences = existing.split(/[.!?]+/).filter(s => s.trim());
    const incomingSentences = incoming.split(/[.!?]+/).filter(s => s.trim());

    const uniqueSentences = new Set([...existingSentences, ...incomingSentences]);
    
    return Array.from(uniqueSentences).join('. ') + '.';
  }

  /**
   * Calculate text similarity (Jaccard index)
   */
  private calculateContentSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Apply decay to old memories
   */
  public async applyDecay(): Promise<{
    decayed: number;
    removed: number;
  }> {
    await this.ensureInitialized();

    const allMemories = await localVectorDB.getAll();
    const now = Date.now();
    const decayStartMs = this.config.decayStartDays * 24 * 60 * 60 * 1000;

    let decayed = 0;
    let removed = 0;

    for (const record of allMemories) {
      const age = now - record.metadata.created;
      
      if (age > decayStartMs) {
        const daysOld = age / (24 * 60 * 60 * 1000);
        const decayFactor = Math.pow(1 - this.config.decayRate, daysOld - this.config.decayStartDays);
        
        // Check access count - frequently accessed memories decay slower
        const accessBonus = Math.min(record.metadata.accessCount * 0.1, 0.5);
        const adjustedRelevance = decayFactor + accessBonus;

        if (adjustedRelevance < this.config.minRelevanceScore) {
          // Remove very old, irrelevant memories
          await localVectorDB.delete(record.id);
          removed++;
        } else if (decayFactor < 0.8) {
          // Mark as decayed but keep
          decayed++;
        }
      }
    }

    this.stats.decayedThisSession += decayed;
    
    if (decayed > 0 || removed > 0) {
      logger.log('MEMORY', 
        `Decay applied: ${decayed} decayed, ${removed} removed`, 
        'info'
      );
    }

    return { decayed, removed };
  }

  /**
   * Run full consolidation
   */
  public async runConsolidation(): Promise<{
    merged: number;
    decayed: number;
    removed: number;
    duplicates: number;
  }> {
    await this.ensureInitialized();

    logger.log('MEMORY', 'Running full consolidation...', 'info');

    const startStats = { ...this.stats };

    // Apply decay
    const { decayed, removed } = await this.applyDecay();

    // Check for duplicates across all memories
    const allMemories = await localVectorDB.getAll();
    let duplicates = 0;

    for (let i = 0; i < allMemories.length; i++) {
      for (let j = i + 1; j < allMemories.length; j++) {
        const memA = allMemories[i];
        const memB = allMemories[j];

        const similarity = this.calculateContentSimilarity(
          memA.metadata.content,
          memB.metadata.content
        );

        if (similarity > this.config.duplicateThreshold) {
          // Remove duplicate
          await localVectorDB.delete(memB.id);
          duplicates++;
        }
      }
    }

    const merged = this.stats.mergedThisSession - startStats.mergedThisSession;

    logger.log('MEMORY', 
      `Consolidation complete: ${merged} merged, ${decayed} decayed, ${removed} removed, ${duplicates} duplicates`, 
      'success'
    );

    return { merged, decayed, removed, duplicates };
  }

  /**
   * Save session summary for cross-session context
   */
  public async saveSessionSummary(
    topics: string[],
    keyFacts: string[],
    userPreferences: string[]
  ): Promise<void> {
    const summary: SessionSummary = {
      id: this.currentSessionId,
      sessionStart: parseInt(this.currentSessionId.split('_')[1]),
      sessionEnd: Date.now(),
      topics,
      keyFacts,
      userPreferences,
      summary: this.generateSummary(topics, keyFacts, userPreferences),
    };

    // Generate embedding for the summary
    summary.vectorEmbedding = await localVectorDB.generateEmbedding(summary.summary);

    this.sessionSummaries.set(this.currentSessionId, summary);
    
    // Persist to storage
    await this.persistSessionSummaries();

    // Store in vector DB for semantic retrieval
    await localVectorDB.store({
      id: `session_summary_${this.currentSessionId}`,
      content: summary.summary,
      type: 'SUMMARY',
      tags: ['session_summary', 'cross_session', ...topics],
      created: Date.now(),
      lastAccessed: Date.now(),
    });

    logger.log('MEMORY', `Session summary saved: ${this.currentSessionId}`, 'info');
  }

  /**
   * Retrieve relevant session summaries
   */
  public async retrieveRelevantSessions(query: string, maxResults: number = 3): Promise<SessionSummary[]> {
    const results = await localVectorDB.search(query, {
      maxResults: maxResults * 2, // Get more to filter
      minScore: 0.6,
    });

    // Filter to only session summaries
    const sessionResults = results.filter(r => 
      r.node.tags.includes('session_summary')
    );

    // Map back to SessionSummary objects
    const summaries: SessionSummary[] = [];
    for (const result of sessionResults.slice(0, maxResults)) {
      const sessionId = result.node.id.replace('session_summary_', '');
      const summary = this.sessionSummaries.get(sessionId);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Get cross-session context
   */
  public async getCrossSessionContext(query: string): Promise<string> {
    const relevantSessions = await this.retrieveRelevantSessions(query, 2);
    
    if (relevantSessions.length === 0) {
      return '';
    }

    let context = 'Previous session context:\n';
    
    for (const session of relevantSessions) {
      context += `\nSession (${new Date(session.sessionStart).toLocaleDateString()}):\n`;
      context += `Topics: ${session.topics.join(', ')}\n`;
      if (session.keyFacts.length > 0) {
        context += `Key facts: ${session.keyFacts.join('; ')}\n`;
      }
      if (session.userPreferences.length > 0) {
        context += `Preferences: ${session.userPreferences.join('; ')}\n`;
      }
    }

    return context;
  }

  /**
   * Get current statistics
   */
  public getStats(): MemoryStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<ConsolidationConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Restart auto-consolidation if interval changed
    if (updates.consolidationIntervalMs && this.config.autoConsolidate) {
      this.stopAutoConsolidation();
      this.startAutoConsolidation();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ConsolidationConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalMemories: 0,
      mergedThisSession: 0,
      decayedThisSession: 0,
      duplicatesRemoved: 0,
      averageSimilarity: 0,
      oldestMemory: 0,
      newestMemory: 0,
    };
  }

  /**
   * Clean up and stop service
   */
  public destroy(): void {
    this.stopAutoConsolidation();
    this.persistSessionSummaries();
  }

  // ==================== PRIVATE METHODS ====================

  private async ensureInitialized(): Promise<void> {
    // Vector DB should already be initialized
  }

  private startAutoConsolidation(): void {
    if (this.consolidationTimer) return;

    this.consolidationTimer = window.setInterval(async () => {
      try {
        await this.runConsolidation();
      } catch (error) {
        logger.log('MEMORY', `Auto-consolidation error: ${(error as Error).message}`, 'error');
      }
    }, this.config.consolidationIntervalMs);

    logger.log('MEMORY', 'Auto-consolidation started', 'info');
  }

  private stopAutoConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
      logger.log('MEMORY', 'Auto-consolidation stopped', 'info');
    }
  }

  private generateSummary(topics: string[], keyFacts: string[], userPreferences: string[]): string {
    let summary = '';
    
    if (topics.length > 0) {
      summary += `Discussed: ${topics.join(', ')}. `;
    }
    
    if (keyFacts.length > 0) {
      summary += `Learned: ${keyFacts.join('; ')}. `;
    }
    
    if (userPreferences.length > 0) {
      summary += `User preferences: ${userPreferences.join('; ')}.`;
    }
    
    return summary.trim();
  }

  private async persistSessionSummaries(): Promise<void> {
    try {
      const data = JSON.stringify({
        summaries: Array.from(this.sessionSummaries.entries()),
        currentSessionId: this.currentSessionId,
      });
      localStorage.setItem('jarvis_session_summaries', data);
    } catch (error) {
      logger.log('MEMORY', `Failed to persist summaries: ${(error as Error).message}`, 'error');
    }
  }

  private async loadSessionSummaries(): Promise<void> {
    try {
      const data = localStorage.getItem('jarvis_session_summaries');
      if (data) {
        const parsed = JSON.parse(data);
        this.sessionSummaries = new Map(parsed.summaries);
        this.currentSessionId = parsed.currentSessionId || this.currentSessionId;
        logger.log('MEMORY', `Loaded ${this.sessionSummaries.size} session summaries`, 'info');
      }
    } catch (error) {
      logger.log('MEMORY', `Failed to load summaries: ${(error as Error).message}`, 'warning');
    }
  }
}

// Export singleton instance
export const memoryConsolidationService = MemoryConsolidationService.getInstance();
