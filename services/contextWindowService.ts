/**
 * Context Window Management Service for JARVIS Kernel v1.4.0
 * 
 * Manages conversation context to fit within AI provider token limits:
 * - Token counting and estimation
 * - Smart context pruning and summarization
 * - Conversation compression for long sessions
 * - Provider-specific limit handling
 * 
 * Features:
 * - Accurate token estimation
 * - Priority-based turn retention
 * - Automatic summarization triggers
 * - Context-aware truncation
 */

import { ConversationTurn, AIProvider } from '../types';
import { logger } from './logger';
import { CONTEXT_WINDOW, LIMITS } from '../constants/config';
import { localVectorDB } from './localVectorDB';

interface TokenCount {
  total: number;
  system: number;
  conversation: number;
  reserved: number;
  available: number;
}

interface ContextStats {
  totalTurns: number;
  compressedTurns: number;
  summaryTokens: number;
  lastSummaryAt: number;
}

interface TurnPriority {
  turn: ConversationTurn;
  priority: number;
  tokens: number;
  index: number;
}

export class ContextWindowService {
  private static instance: ContextWindowService;
  private stats: ContextStats = {
    totalTurns: 0,
    compressedTurns: 0,
    summaryTokens: 0,
    lastSummaryAt: 0,
  };
  private summaries: Map<string, string> = new Map(); // sessionId -> summary

  private constructor() {}

  public static getInstance(): ContextWindowService {
    if (!ContextWindowService.instance) {
      ContextWindowService.instance = new ContextWindowService();
    }
    return ContextWindowService.instance;
  }

  /**
   * Get the context limit for a specific provider
   */
  public getContextLimit(provider: AIProvider): number {
    switch (provider) {
      case AIProvider.GEMINI:
        return CONTEXT_WINDOW.GEMINI_FLASH_LIMIT;
      case AIProvider.OLLAMA:
        return CONTEXT_WINDOW.OLLAMA_DEFAULT_LIMIT;
      default:
        return CONTEXT_WINDOW.GEMINI_FLASH_LIMIT;
    }
  }

  /**
   * Estimate token count for text
   * Uses a simple heuristic: ~4 characters per token on average
   */
  public estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation: count words and adjust for punctuation
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    // Blend character and word-based estimates
    const charEstimate = Math.ceil(chars / CONTEXT_WINDOW.CHARS_PER_TOKEN);
    const wordEstimate = Math.ceil(words * 1.3); // ~0.75 tokens per word
    return Math.round((charEstimate + wordEstimate) / 2);
  }

  /**
   * Count tokens for a conversation turn
   */
  public countTurnTokens(turn: ConversationTurn): number {
    const speakerTokens = 4; // "USER:" or "JARVIS:"
    const contentTokens = this.estimateTokens(turn.text);
    return speakerTokens + contentTokens;
  }

  /**
   * Calculate full token count for a conversation
   */
  public calculateTokenCount(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider
  ): TokenCount {
    const limit = this.getContextLimit(provider);
    const systemTokens = this.estimateTokens(systemPrompt);
    const reservedTokens = CONTEXT_WINDOW.SYSTEM_PROMPT_RESERVE + CONTEXT_WINDOW.RESPONSE_RESERVE;
    
    let conversationTokens = 0;
    for (const turn of turns) {
      conversationTokens += this.countTurnTokens(turn);
    }

    const total = systemTokens + conversationTokens + reservedTokens;

    return {
      total,
      system: systemTokens,
      conversation: conversationTokens,
      reserved: reservedTokens,
      available: limit - total,
    };
  }

  /**
   * Check if context fits within limits
   */
  public fitsWithinLimits(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider
  ): boolean {
    const count = this.calculateTokenCount(turns, systemPrompt, provider);
    return count.total <= this.getContextLimit(provider);
  }

  /**
   * Get context utilization ratio (0-1)
   */
  public getUtilization(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider
  ): number {
    const limit = this.getContextLimit(provider);
    const count = this.calculateTokenCount(turns, systemPrompt, provider);
    return Math.min(count.total / limit, 1);
  }

  /**
   * Should trigger summarization?
   */
  public shouldSummarize(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider
  ): boolean {
    // Check token threshold
    const utilization = this.getUtilization(turns, systemPrompt, provider);
    if (utilization >= CONTEXT_WINDOW.SUMMARY_THRESHOLD) {
      return true;
    }

    // Check turn count threshold
    if (turns.length >= CONTEXT_WINDOW.MAX_TURNS_BEFORE_SUMMARY) {
      return true;
    }

    return false;
  }

  /**
   * Calculate priority score for a turn
   * Higher score = more important to keep
   */
  private calculatePriority(turn: ConversationTurn, index: number, totalTurns: number): number {
    let priority = 0;

    // Recency boost (newer turns are more important)
    const recencyBoost = (index / Math.max(totalTurns - 1, 1)) * 100;
    priority += recencyBoost;

    // User turns are slightly more important than assistant turns
    if (turn.speaker === 'USER') {
      priority += 10;
    }

    // Turns with questions are important
    if (turn.text.includes('?')) {
      priority += 15;
    }

    // Turns with context indicators are important
    const contextIndicators = [
      'remember', 'earlier', 'before', 'previous', 'said', 'mentioned',
      'talked about', 'discussed', 'asked', 'told'
    ];
    if (contextIndicators.some(indicator => 
      turn.text.toLowerCase().includes(indicator)
    )) {
      priority += 20;
    }

    // Interrupted turns are important (user wanted to correct something)
    if (turn.interrupted) {
      priority += 25;
    }

    // Apply decay for very old turns
    const age = Date.now() - turn.timestamp;
    const hoursOld = age / (1000 * 60 * 60);
    if (hoursOld > 1) {
      priority *= Math.pow(CONTEXT_WINDOW.TURN_DECAY_FACTOR, hoursOld);
    }

    return priority;
  }

  /**
   * Smart context pruning - removes least important turns first
   */
  public pruneContext(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider,
    targetUtilization: number = 0.7
  ): ConversationTurn[] {
    if (turns.length <= CONTEXT_WINDOW.MIN_TURNS) {
      return turns;
    }

    const limit = this.getContextLimit(provider);
    const targetTokens = limit * targetUtilization;

    // Calculate priority for each turn
    const priorities: TurnPriority[] = turns.map((turn, index) => ({
      turn,
      priority: this.calculatePriority(turn, index, turns.length),
      tokens: this.countTurnTokens(turn),
      index,
    }));

    // Sort by priority (highest first)
    priorities.sort((a, b) => b.priority - a.priority);

    // Select turns until we hit the target
    const selected: TurnPriority[] = [];
    let currentTokens = this.estimateTokens(systemPrompt) + CONTEXT_WINDOW.RESERVED;

    for (const item of priorities) {
      if (currentTokens + item.tokens <= targetTokens) {
        selected.push(item);
        currentTokens += item.tokens;
      }
    }

    // Sort back to original order
    selected.sort((a, b) => a.index - b.index);

    logger.log('CONTEXT_WINDOW', 
      `Pruned context from ${turns.length} to ${selected.length} turns`, 
      'info'
    );

    return selected.map(s => s.turn);
  }

  /**
   * Generate a summary of conversation turns
   */
  public async generateSummary(turns: ConversationTurn[]): Promise<string> {
    if (turns.length === 0) return '';

    // Extract key topics and facts
    const topics = this.extractTopics(turns);
    const keyFacts = this.extractKeyFacts(turns);
    const decisions = this.extractDecisions(turns);

    let summary = 'Previous conversation summary:\n';

    if (topics.length > 0) {
      summary += `Topics discussed: ${topics.join(', ')}.\n`;
    }

    if (keyFacts.length > 0) {
      summary += `Key information: ${keyFacts.join('; ')}.\n`;
    }

    if (decisions.length > 0) {
      summary += `Decisions made: ${decisions.join('; ')}.\n`;
    }

    // Add most recent context
    const recentTurns = turns.slice(-4);
    summary += '\nRecent context:\n';
    for (const turn of recentTurns) {
      summary += `${turn.speaker}: ${turn.text.substring(0, 100)}${
        turn.text.length > 100 ? '...' : ''
      }\n`;
    }

    // Store in vector DB for future reference
    await this.storeSummary(summary, turns);

    this.stats.summaryTokens = this.estimateTokens(summary);
    this.stats.lastSummaryAt = Date.now();

    return summary;
  }

  /**
   * Compress conversation by replacing old turns with summary
   */
  public async compressConversation(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider
  ): Promise<{
    compressed: ConversationTurn[];
    summary: string;
    originalCount: number;
  }> {
    if (turns.length < 10) {
      return { compressed: turns, summary: '', originalCount: turns.length };
    }

    // Keep recent turns uncompressed
    const recentTurns = turns.slice(-6);
    const oldTurns = turns.slice(0, -6);

    // Generate summary of old turns
    const summary = await this.generateSummary(oldTurns);

    // Create summary turn
    const summaryTurn: ConversationTurn = {
      id: `summary_${Date.now()}`,
      timestamp: oldTurns[oldTurns.length - 1]?.timestamp || Date.now(),
      speaker: 'SYSTEM',
      text: summary,
    };

    const compressed = [summaryTurn, ...recentTurns];

    this.stats.compressedTurns += oldTurns.length;

    logger.log('CONTEXT_WINDOW', 
      `Compressed ${turns.length} turns into ${compressed.length} (summary + recent)`, 
      'success'
    );

    return {
      compressed,
      summary,
      originalCount: turns.length,
    };
  }

  /**
   * Optimize context for AI request
   * This is the main entry point - handles all context optimization
   */
  public async optimizeContext(
    turns: ConversationTurn[],
    systemPrompt: string,
    provider: AIProvider,
    options: {
      enableSummarization?: boolean;
      enablePruning?: boolean;
      preserveRecent?: number;
    } = {}
  ): Promise<{
    optimized: ConversationTurn[];
    tokenCount: TokenCount;
    wasCompressed: boolean;
    wasPruned: boolean;
    summary?: string;
  }> {
    const {
      enableSummarization = true,
      enablePruning = true,
      preserveRecent = 4,
    } = options;

    let optimized = [...turns];
    let wasCompressed = false;
    let wasPruned = false;
    let summary: string | undefined;

    // Check if we need to compress
    if (enableSummarization && this.shouldSummarize(optimized, systemPrompt, provider)) {
      const compression = await this.compressConversation(
        optimized,
        systemPrompt,
        provider
      );
      optimized = compression.compressed;
      summary = compression.summary;
      wasCompressed = true;
    }

    // Check if we still need to prune
    if (enablePruning && !this.fitsWithinLimits(optimized, systemPrompt, provider)) {
      optimized = this.pruneContext(optimized, systemPrompt, provider);
      wasPruned = true;
    }

    const tokenCount = this.calculateTokenCount(optimized, systemPrompt, provider);

    return {
      optimized,
      tokenCount,
      wasCompressed,
      wasPruned,
      summary,
    };
  }

  /**
   * Format turns for AI prompt
   */
  public formatForPrompt(turns: ConversationTurn[]): string {
    return turns.map(turn => {
      if (turn.speaker === 'SYSTEM') {
        return `[System Note]\n${turn.text}\n`;
      }
      return `${turn.speaker}: ${turn.text}`;
    }).join('\n\n');
  }

  /**
   * Get context statistics
   */
  public getStats(): ContextStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalTurns: 0,
      compressedTurns: 0,
      summaryTokens: 0,
      lastSummaryAt: 0,
    };
    this.summaries.clear();
  }

  // ==================== PRIVATE METHODS ====================

  private extractTopics(turns: ConversationTurn[]): string[] {
    const topics = new Set<string>();
    const allText = turns.map(t => t.text.toLowerCase()).join(' ');

    // Simple topic extraction based on keywords
    const topicKeywords: Record<string, string[]> = {
      'programming': ['code', 'programming', 'developer', 'software', 'app', 'application'],
      'home automation': ['light', 'thermostat', 'switch', 'sensor', 'home assistant'],
      'weather': ['weather', 'temperature', 'rain', 'sunny', 'forecast'],
      'schedule': ['meeting', 'appointment', 'calendar', 'schedule', 'reminder'],
      'music': ['music', 'song', 'playlist', 'spotify', 'album'],
      'news': ['news', 'headlines', 'current events', 'happening'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => allText.includes(kw))) {
        topics.add(topic);
      }
    }

    return Array.from(topics);
  }

  private extractKeyFacts(turns: ConversationTurn[]): string[] {
    const facts: string[] = [];

    for (const turn of turns) {
      // Look for statements that might be facts
      if (turn.speaker === 'USER') {
        // User preferences
        const preferenceMatch = turn.text.match(/I (?:like|prefer|enjoy|love|hate|dislike) (.+)/i);
        if (preferenceMatch) {
          facts.push(`User ${preferenceMatch[0].toLowerCase()}`);
        }

        // User information
        const infoMatch = turn.text.match(/(?:my name is|I'm|I am|I work as|I live in) (.+)/i);
        if (infoMatch) {
          facts.push(infoMatch[0]);
        }
      }
    }

    // Remove duplicates
    return Array.from(new Set(facts)).slice(0, 5);
  }

  private extractDecisions(turns: ConversationTurn[]): string[] {
    const decisions: string[] = [];

    for (let i = 0; i < turns.length - 1; i++) {
      const current = turns[i];
      const next = turns[i + 1];

      // Look for command + confirmation pattern
      if (current.speaker === 'USER' && next.speaker === 'JARVIS') {
        const commandWords = ['set', 'create', 'schedule', 'remind', 'turn on', 'turn off'];
        if (commandWords.some(cw => current.text.toLowerCase().includes(cw))) {
          if (next.text.toLowerCase().includes('done') || 
              next.text.toLowerCase().includes('set') ||
              next.text.toLowerCase().includes('created')) {
            decisions.push(`${current.text.substring(0, 50)}... (completed)`);
          }
        }
      }
    }

    return decisions.slice(0, 3);
  }

  private async storeSummary(summary: string, turns: ConversationTurn[]): Promise<void> {
    try {
      // Store in vector DB for semantic retrieval
      const sessionId = turns[0]?.id?.split('_')[0] || 'unknown';
      await localVectorDB.store({
        id: `summary_${sessionId}_${Date.now()}`,
        content: summary,
        type: 'SUMMARY',
        tags: ['conversation_summary', 'compressed_context'],
        created: Date.now(),
        lastAccessed: Date.now(),
      });
    } catch (error) {
      logger.log('CONTEXT_WINDOW', `Failed to store summary: ${(error as Error).message}`, 'warning');
    }
  }
}

// Export singleton instance
export const contextWindowService = ContextWindowService.getInstance();
