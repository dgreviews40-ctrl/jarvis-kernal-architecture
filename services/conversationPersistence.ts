/**
 * Conversation Persistence Service for JARVIS AI Engine v1.1
 * 
 * Provides cross-session conversation history:
 * - Persistent storage of all conversations
 * - Conversation threading and organization
 * - Context retrieval for long-term memory
 * - Import/export functionality
 * - Automatic summarization for long conversations
 */

import { ConversationTurn, Session } from '../types';
import { logger } from './logger';

// ==================== TYPES ====================

export interface PersistedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: ConversationTurn[];
  summary?: string;           // Auto-generated summary
  tags: string[];             // User-defined or auto tags
  messageCount: number;
  metadata: {
    origin: 'voice' | 'text' | 'mixed';
    interruptCount: number;
    averageResponseTime?: number;
  };
}

export interface ConversationSearchResult {
  conversation: PersistedConversation;
  relevanceScore: number;
  matchingTurns?: ConversationTurn[];
}

export interface PersistenceStats {
  totalConversations: number;
  totalMessages: number;
  oldestConversation: number;
  storageSizeBytes: number;
}

// ==================== CONFIGURATION ====================

interface PersistenceConfig {
  maxStoredConversations: number;
  maxTurnsPerConversation: number;
  autoSummarizeThreshold: number;  // Turns before auto-summarize
  retentionDays: number;           // Auto-delete older than this
  compressionEnabled: boolean;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  maxStoredConversations: 100,
  maxTurnsPerConversation: 500,
  autoSummarizeThreshold: 20,
  retentionDays: 365,
  compressionEnabled: true
};

// ==================== SERVICE ====================

class ConversationPersistenceService {
  private config: PersistenceConfig;
  private readonly STORAGE_KEY = 'jarvis_conversations_v1';
  private readonly CURRENT_KEY = 'jarvis_current_conversation';
  private conversations: Map<string, PersistedConversation> = new Map();
  private currentConversationId: string | null = null;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  // ==================== CONVERSATION MANAGEMENT ====================

  /**
   * Start a new conversation
   */
  startNewConversation(title?: string, origin: 'voice' | 'text' = 'text'): string {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conversation: PersistedConversation = {
      id,
      title: title || this.generateTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: [],
      tags: [],
      messageCount: 0,
      metadata: {
        origin,
        interruptCount: 0
      }
    };

    this.conversations.set(id, conversation);
    this.currentConversationId = id;
    this.saveToStorage();

    logger.log('CONVERSATION', `Started new conversation: ${id}`, 'info');
    return id;
  }

  /**
   * Add a turn to current conversation
   */
  addTurn(speaker: 'USER' | 'JARVIS', text: string, metadata?: Partial<ConversationTurn>): void {
    if (!this.currentConversationId) {
      this.startNewConversation();
    }

    const conversation = this.conversations.get(this.currentConversationId!);
    if (!conversation) return;

    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      speaker,
      text,
      interrupted: metadata?.interrupted
    };

    conversation.turns.push(turn);
    conversation.messageCount++;
    conversation.updatedAt = Date.now();

    // Auto-summarize if threshold reached
    if (conversation.turns.length === this.config.autoSummarizeThreshold) {
      this.summarizeConversation(conversation.id);
    }

    // Trim if too long
    if (conversation.turns.length > this.config.maxTurnsPerConversation) {
      this.archiveOldTurns(conversation.id);
    }

    this.saveToStorage();
  }

  /**
   * Get current conversation
   */
  getCurrentConversation(): PersistedConversation | null {
    if (!this.currentConversationId) return null;
    return this.conversations.get(this.currentConversationId) || null;
  }

  /**
   * Get current conversation ID
   */
  getCurrentId(): string | null {
    return this.currentConversationId;
  }

  /**
   * Switch to a different conversation
   */
  switchConversation(id: string): boolean {
    if (!this.conversations.has(id)) return false;
    
    this.currentConversationId = id;
    localStorage.setItem(this.CURRENT_KEY, id);
    
    logger.log('CONVERSATION', `Switched to conversation: ${id}`, 'info');
    return true;
  }

  /**
   * Get all conversations (sorted by updated, newest first)
   */
  getAllConversations(): PersistedConversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get recent conversations
   */
  getRecentConversations(limit: number = 10): PersistedConversation[] {
    return this.getAllConversations().slice(0, limit);
  }

  /**
   * Get a specific conversation
   */
  getConversation(id: string): PersistedConversation | null {
    return this.conversations.get(id) || null;
  }

  /**
   * Delete a conversation
   */
  deleteConversation(id: string): boolean {
    if (!this.conversations.has(id)) return false;
    
    this.conversations.delete(id);
    
    if (this.currentConversationId === id) {
      this.currentConversationId = null;
      localStorage.removeItem(this.CURRENT_KEY);
    }

    this.saveToStorage();
    logger.log('CONVERSATION', `Deleted conversation: ${id}`, 'info');
    return true;
  }

  /**
   * Rename a conversation
   */
  renameConversation(id: string, newTitle: string): boolean {
    const conversation = this.conversations.get(id);
    if (!conversation) return false;

    conversation.title = newTitle;
    conversation.updatedAt = Date.now();
    this.saveToStorage();
    
    return true;
  }

  /**
   * Tag a conversation
   */
  tagConversation(id: string, tags: string[]): boolean {
    const conversation = this.conversations.get(id);
    if (!conversation) return false;

    conversation.tags = [...new Set([...conversation.tags, ...tags])];
    conversation.updatedAt = Date.now();
    this.saveToStorage();
    
    return true;
  }

  // ==================== CONTEXT & SEARCH ====================

  /**
   * Get recent turns for context window
   */
  getRecentContext(maxTurns: number = 10): ConversationTurn[] {
    const conversation = this.getCurrentConversation();
    if (!conversation) return [];
    
    return conversation.turns.slice(-maxTurns);
  }

  /**
   * Get context as formatted string for AI prompts
   */
  getContextAsString(maxTurns: number = 10): string {
    const turns = this.getRecentContext(maxTurns);
    if (turns.length === 0) return '';

    return turns.map(t => {
      const speaker = t.speaker === 'USER' ? 'User' : 'JARVIS';
      return `${speaker}: ${t.text}`;
    }).join('\n\n');
  }

  /**
   * Search through all conversations
   */
  search(query: string): ConversationSearchResult[] {
    const results: ConversationSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const conversation of this.conversations.values()) {
      let relevanceScore = 0;
      const matchingTurns: ConversationTurn[] = [];

      // Check title
      if (conversation.title.toLowerCase().includes(lowerQuery)) {
        relevanceScore += 10;
      }

      // Check tags
      if (conversation.tags.some(t => t.toLowerCase().includes(lowerQuery))) {
        relevanceScore += 5;
      }

      // Check turns
      for (const turn of conversation.turns) {
        if (turn.text.toLowerCase().includes(lowerQuery)) {
          relevanceScore += 2;
          matchingTurns.push(turn);
        }
      }

      if (relevanceScore > 0) {
        results.push({
          conversation,
          relevanceScore,
          matchingTurns: matchingTurns.slice(0, 3) // Top 3 matching turns
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Find related conversations based on content similarity
   */
  findRelated(conversationId: string, limit: number = 5): PersistedConversation[] {
    const source = this.conversations.get(conversationId);
    if (!source) return [];

    const sourceTags = new Set(source.tags);
    const scored: { conversation: PersistedConversation; score: number }[] = [];

    for (const conversation of this.conversations.values()) {
      if (conversation.id === conversationId) continue;

      let score = 0;

      // Tag overlap
      for (const tag of conversation.tags) {
        if (sourceTags.has(tag)) score += 3;
      }

      // Time proximity (closer = more related)
      const timeDiff = Math.abs(conversation.updatedAt - source.updatedAt);
      const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
      if (daysDiff < 1) score += 5;
      else if (daysDiff < 7) score += 2;

      if (score > 0) {
        scored.push({ conversation, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.conversation);
  }

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export all conversations
   */
  exportAll(): { version: string; exportedAt: number; conversations: PersistedConversation[] } {
    return {
      version: '1.1',
      exportedAt: Date.now(),
      conversations: this.getAllConversations()
    };
  }

  /**
   * Export single conversation
   */
  exportConversation(id: string): PersistedConversation | null {
    return this.conversations.get(id) || null;
  }

  /**
   * Import conversations
   */
  import(data: { version: string; conversations: PersistedConversation[] }, merge: boolean = true): number {
    let imported = 0;

    for (const conv of data.conversations) {
      if (this.conversations.has(conv.id)) {
        if (merge) {
          // Merge turns if conversation exists
          const existing = this.conversations.get(conv.id)!;
          const existingIds = new Set(existing.turns.map(t => t.id));
          const newTurns = conv.turns.filter(t => !existingIds.has(t.id));
          existing.turns.push(...newTurns);
          existing.messageCount = existing.turns.length;
          existing.updatedAt = Math.max(existing.updatedAt, conv.updatedAt);
        }
      } else {
        this.conversations.set(conv.id, conv);
        imported++;
      }
    }

    this.enforceLimits();
    this.saveToStorage();
    
    logger.log('CONVERSATION', `Imported ${imported} conversations`, 'success');
    return imported;
  }

  // ==================== STATISTICS ====================

  /**
   * Get storage statistics
   */
  getStats(): PersistenceStats {
    let totalMessages = 0;
    let oldest = Date.now();

    for (const conv of this.conversations.values()) {
      totalMessages += conv.messageCount;
      oldest = Math.min(oldest, conv.createdAt);
    }

    // Estimate storage size
    const data = JSON.stringify(this.exportAll());
    const sizeBytes = new Blob([data]).size;

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      oldestConversation: oldest,
      storageSizeBytes: sizeBytes
    };
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
    this.currentConversationId = null;
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_KEY);
    
    logger.log('CONVERSATION', 'Cleared all conversations', 'warning');
  }

  // ==================== PRIVATE METHODS ====================

  private generateTitle(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `Conversation - ${dateStr}`;
  }

  private summarizeConversation(id: string): void {
    // Placeholder for AI summarization
    // In production, this would call the AI to generate a summary
    const conversation = this.conversations.get(id);
    if (!conversation) return;

    // Simple summary for now
    const firstUserMessage = conversation.turns.find(t => t.speaker === 'USER')?.text || '';
    const truncated = firstUserMessage.slice(0, 50);
    conversation.summary = truncated + (firstUserMessage.length > 50 ? '...' : '');
    
    logger.log('CONVERSATION', `Auto-summarized: ${id}`, 'info');
  }

  private archiveOldTurns(id: string): void {
    const conversation = this.conversations.get(id);
    if (!conversation) return;

    // Keep first turn, last 100 turns, and summarize the middle
    const toArchive = conversation.turns.splice(
      1, 
      conversation.turns.length - this.config.maxTurnsPerConversation
    );

    logger.log('CONVERSATION', `Archived ${toArchive.length} old turns from ${id}`, 'info');
  }

  private enforceLimits(): void {
    // Remove oldest conversations if over limit
    if (this.conversations.size > this.config.maxStoredConversations) {
      const sorted = this.getAllConversations();
      const toRemove = sorted.slice(this.config.maxStoredConversations);
      
      for (const conv of toRemove) {
        this.conversations.delete(conv.id);
      }
      
      logger.log('CONVERSATION', `Removed ${toRemove.length} old conversations`, 'warning');
    }

    // Remove expired conversations
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    for (const [id, conv] of this.conversations) {
      if (conv.updatedAt < cutoff) {
        this.conversations.delete(id);
      }
    }
  }

  private saveToStorage(): void {
    try {
      const data = this.exportAll();
      const json = JSON.stringify(data);
      
      // Compress if enabled and large
      if (this.config.compressionEnabled && json.length > 100000) {
        // Simple compression: truncate very old messages
        this.compressStorage();
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      
      if (this.currentConversationId) {
        localStorage.setItem(this.CURRENT_KEY, this.currentConversationId);
      }
    } catch (error) {
      logger.log('CONVERSATION', `Failed to save: ${error}`, 'error');
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.conversations && Array.isArray(data.conversations)) {
          for (const conv of data.conversations) {
            this.conversations.set(conv.id, conv);
          }
        }
      }

      const current = localStorage.getItem(this.CURRENT_KEY);
      if (current && this.conversations.has(current)) {
        this.currentConversationId = current;
      }

      logger.log('CONVERSATION', `Loaded ${this.conversations.size} conversations`, 'info');
    } catch (error) {
      logger.log('CONVERSATION', `Failed to load: ${error}`, 'error');
    }
  }

  private compressStorage(): void {
    // Remove detailed turn content from very old conversations
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    for (const conv of this.conversations.values()) {
      if (conv.updatedAt < cutoff && conv.turns.length > 10) {
        // Keep only first 5 and last 5 turns
        conv.turns = [
          ...conv.turns.slice(0, 5),
          { 
            id: 'compressed',
            timestamp: Date.now(),
            speaker: 'JARVIS',
            text: `[${conv.turns.length - 10} messages compressed]`
          },
          ...conv.turns.slice(-5)
        ];
      }
    }
  }
}

// Export singleton
export const conversationPersistence = new ConversationPersistenceService();
