/**
 * Conversational Context Engine
 * 
 * Manages deep conversation context including:
 * - Long-term conversation memory
 * - Topic tracking and threading
 * - User intent history
 * - Conversation sentiment tracking
 * - Cross-session memory persistence
 */

import { memory as memoryOptimized } from "../memory";
import { ConversationTurn, MemoryType } from "../../types";

interface Topic {
  id: string;
  name: string;
  keywords: string[];
  startTime: number;
  lastActive: number;
  turnCount: number;
  parentTopicId?: string;
  relatedTopics: string[];
}

interface ConversationThread {
  id: string;
  topicId: string;
  turns: ConversationTurn[];
  summary: string;
  createdAt: number;
  lastActive: number;
}

interface UserIntentHistory {
  intent: string;
  confidence: number;
  timestamp: number;
  successful: boolean;
  context: Record<string, unknown>;
}

interface SentimentSnapshot {
  timestamp: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited';
  score: number; // -1 to 1
  triggers: string[];
}

interface EnrichedContext {
  recentTurns: ConversationTurn[];
  activeTopics: Topic[];
  currentThread?: ConversationThread;
  sentimentHistory: SentimentSnapshot[];
  intentHistory: UserIntentHistory[];
  userPreferences: Record<string, unknown>;
  pendingClarifications: string[];
  suggestedResponses: string[];
}

export class ConversationalContextEngine {
  private topics: Map<string, Topic> = new Map();
  private threads: Map<string, ConversationThread> = new Map();
  private currentThreadId: string | null = null;
  private sentimentHistory: SentimentSnapshot[] = [];
  private intentHistory: UserIntentHistory[] = [];
  private userPreferences: Map<string, unknown> = new Map();
  
  // Maximum history to keep in memory
  private readonly MAX_SENTIMENT_HISTORY = 50;
  private readonly MAX_INTENT_HISTORY = 100;
  private readonly MAX_ACTIVE_TOPICS = 5;
  private readonly THREAD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Analyze and extract topics from conversation text
   */
  async extractTopics(text: string): Promise<Topic[]> {
    const extractedTopics: Topic[] = [];
    const lowerText = text.toLowerCase();
    
    // Topic extraction patterns
    const topicPatterns = [
      // Technology
      { name: 'Technology', keywords: ['computer', 'software', 'hardware', 'app', 'program', 'code', 'ai', 'robot', 'device', 'internet', 'wifi', 'network'] },
      // Home
      { name: 'Home Automation', keywords: ['light', 'temperature', 'thermostat', 'fan', 'door', 'lock', 'camera', 'sensor', 'home', 'house', 'room'] },
      // Entertainment
      { name: 'Entertainment', keywords: ['movie', 'music', 'song', 'video', 'game', 'play', 'watch', 'listen', 'show', 'series'] },
      // Work
      { name: 'Work', keywords: ['project', 'deadline', 'meeting', 'email', 'task', 'work', 'job', 'office', 'colleague', 'boss'] },
      // Personal
      { name: 'Personal', keywords: ['family', 'friend', 'birthday', 'appointment', 'schedule', 'plan', 'reminder', 'preference'] },
      // Information
      { name: 'Information', keywords: ['what', 'how', 'why', 'when', 'where', 'who', 'explain', 'tell me', 'search', 'find', 'look up'] },
      // Commands
      { name: 'Commands', keywords: ['turn on', 'turn off', 'set', 'change', 'open', 'close', 'start', 'stop', 'enable', 'disable'] }
    ];

    for (const pattern of topicPatterns) {
      const matchedKeywords = pattern.keywords.filter(kw => lowerText.includes(kw));
      if (matchedKeywords.length > 0) {
        const existingTopic = this.findExistingTopic(pattern.name, matchedKeywords);
        
        if (existingTopic) {
          // Update existing topic
          existingTopic.lastActive = Date.now();
          existingTopic.turnCount++;
          existingTopic.keywords = [...new Set([...existingTopic.keywords, ...matchedKeywords])];
          extractedTopics.push(existingTopic);
        } else {
          // Create new topic
          const newTopic: Topic = {
            id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: pattern.name,
            keywords: matchedKeywords,
            startTime: Date.now(),
            lastActive: Date.now(),
            turnCount: 1,
            relatedTopics: []
          };
          this.topics.set(newTopic.id, newTopic);
          extractedTopics.push(newTopic);
        }
      }
    }

    // Prune old topics if too many
    this.pruneInactiveTopics();
    
    return extractedTopics;
  }

  /**
   * Find existing topic by name or keywords
   */
  private findExistingTopic(name: string, keywords: string[]): Topic | undefined {
    for (const topic of this.topics.values()) {
      if (topic.name === name) return topic;
      // Check keyword overlap
      const overlap = topic.keywords.filter(k => keywords.includes(k));
      if (overlap.length >= 2) return topic;
    }
    return undefined;
  }

  /**
   * Prune inactive topics to maintain performance
   */
  private pruneInactiveTopics(): void {
    if (this.topics.size <= this.MAX_ACTIVE_TOPICS) return;

    const sortedTopics = Array.from(this.topics.values())
      .sort((a, b) => b.lastActive - a.lastActive);
    
    const topicsToRemove = sortedTopics.slice(this.MAX_ACTIVE_TOPICS);
    topicsToRemove.forEach(topic => {
      // Archive to long-term memory before removing
      this.archiveTopic(topic);
      this.topics.delete(topic.id);
    });
  }

  /**
   * Archive topic to long-term memory
   */
  private async archiveTopic(topic: Topic): Promise<void> {
    await memoryOptimized.store(
      `Topic "${topic.name}" was discussed with ${topic.turnCount} exchanges. Keywords: ${topic.keywords.join(', ')}`,
      'SUMMARY',
      ['topic', 'conversation', 'archived', topic.name.toLowerCase().replace(' ', '_')]
    );
  }

  /**
   * Create or continue a conversation thread
   */
  async manageThread(turn: ConversationTurn, topics: Topic[]): Promise<ConversationThread> {
    const now = Date.now();
    
    // Check if current thread is still active
    if (this.currentThreadId) {
      const currentThread = this.threads.get(this.currentThreadId);
      if (currentThread && (now - currentThread.lastActive) < this.THREAD_TIMEOUT_MS) {
        // Continue current thread
        currentThread.turns.push(turn);
        currentThread.lastActive = now;
        
        // Update thread summary every 5 turns
        if (currentThread.turns.length % 5 === 0) {
          currentThread.summary = await this.generateThreadSummary(currentThread);
        }
        
        return currentThread;
      }
    }

    // Start new thread
    const primaryTopic = topics[0] || {
      id: `topic_${now}`,
      name: 'General',
      keywords: [],
      startTime: now,
      lastActive: now,
      turnCount: 1,
      relatedTopics: []
    };

    const newThread: ConversationThread = {
      id: `thread_${now}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: primaryTopic.id,
      turns: [turn],
      summary: '',
      createdAt: now,
      lastActive: now
    };

    this.threads.set(newThread.id, newThread);
    this.currentThreadId = newThread.id;

    // Link related topics
    if (topics.length > 1) {
      for (let i = 1; i < topics.length; i++) {
        primaryTopic.relatedTopics.push(topics[i].id);
      }
    }

    return newThread;
  }

  /**
   * Generate a summary of conversation thread
   */
  private async generateThreadSummary(thread: ConversationThread): Promise<string> {
    const topic = this.topics.get(thread.topicId);
    const userTurns = thread.turns.filter(t => t.speaker === 'USER');
    const jarvisTurns = thread.turns.filter(t => t.speaker === 'JARVIS');
    
    return `Thread about "${topic?.name || 'General'}" with ${userTurns.length} user inputs and ${jarvisTurns.length} responses.`;
  }

  /**
   * Analyze sentiment of conversation text
   */
  analyzeSentiment(text: string): SentimentSnapshot {
    const lowerText = text.toLowerCase();
    let score = 0;
    const triggers: string[] = [];

    // Positive indicators
    const positiveWords = ['great', 'awesome', 'excellent', 'thank', 'thanks', 'love', 'perfect', 'amazing', 'good', 'happy', 'excited', 'wonderful', 'fantastic', 'brilliant'];
    const positivePhrases = ['thank you', 'that helps', 'good job', 'well done', 'i appreciate', 'love it'];
    
    // Negative indicators
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'stupid', 'wrong', 'error', 'broken', 'annoying', 'frustrated', 'angry', 'disappointed'];
    const negativePhrases = ['not working', 'does not work', 'you don\'t understand', 'that\'s wrong', 'stop', 'shut up', 'be quiet'];
    
    // Frustration indicators
    const frustrationPhrases = ['i said', 'i already told you', 'why don\'t you', 'you never', 'you always', 'not again'];

    // Check for positive sentiment
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) {
        score += 0.2;
        triggers.push(word);
      }
    });
    positivePhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        score += 0.4;
        triggers.push(phrase);
      }
    });

    // Check for negative sentiment
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) {
        score -= 0.25;
        triggers.push(word);
      }
    });
    negativePhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        score -= 0.5;
        triggers.push(phrase);
      }
    });

    // Check for frustration (strong negative)
    let isFrustrated = false;
    frustrationPhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        score -= 0.6;
        triggers.push(phrase);
        isFrustrated = true;
      }
    });

    // Determine sentiment category
    let sentiment: SentimentSnapshot['sentiment'] = 'neutral';
    if (isFrustrated || score < -0.5) {
      sentiment = 'frustrated';
    } else if (score < -0.2) {
      sentiment = 'negative';
    } else if (score > 0.5) {
      sentiment = 'excited';
    } else if (score > 0.2) {
      sentiment = 'positive';
    }

    const snapshot: SentimentSnapshot = {
      timestamp: Date.now(),
      sentiment,
      score: Math.max(-1, Math.min(1, score)),
      triggers
    };

    // Add to history
    this.sentimentHistory.push(snapshot);
    if (this.sentimentHistory.length > this.MAX_SENTIMENT_HISTORY) {
      this.sentimentHistory.shift();
    }

    return snapshot;
  }

  /**
   * Record user intent for learning
   */
  recordIntent(intent: string, confidence: number, successful: boolean, context: Record<string, unknown> = {}): void {
    const historyEntry: UserIntentHistory = {
      intent,
      confidence,
      timestamp: Date.now(),
      successful,
      context
    };

    this.intentHistory.push(historyEntry);
    if (this.intentHistory.length > this.MAX_INTENT_HISTORY) {
      this.intentHistory.shift();
    }

    // Learn from patterns
    this.learnFromIntent(historyEntry);
  }

  /**
   * Learn patterns from intent history
   */
  private learnFromIntent(entry: UserIntentHistory): void {
    // Track successful intent patterns
    if (entry.successful && entry.confidence > 0.8) {
      const key = `intent_pattern_${entry.intent}`;
      const current = (this.userPreferences.get(key) as number) || 0;
      this.userPreferences.set(key, current + 1);
    }
  }

  /**
   * Get enriched context for AI response generation
   */
  async getEnrichedContext(recentTurns: ConversationTurn[]): Promise<EnrichedContext> {
    const activeTopics = Array.from(this.topics.values())
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, 3);

    const currentThread = this.currentThreadId ? this.threads.get(this.currentThreadId) : undefined;

    // Get user preferences from memory
    const preferenceResults = await memoryOptimized.recall('preference', 5);
    const preferences: Record<string, unknown> = {};
    preferenceResults.forEach(({ node }) => {
      const key = node.tags.find(t => t !== 'preference' && t !== 'PREFERENCE');
      if (key) preferences[key] = node.content;
    });

    // Generate suggested responses based on context
    const suggestedResponses = this.generateSuggestedResponses(activeTopics, recentTurns);

    return {
      recentTurns,
      activeTopics,
      currentThread,
      sentimentHistory: [...this.sentimentHistory],
      intentHistory: [...this.intentHistory],
      userPreferences: { ...Object.fromEntries(this.userPreferences), ...preferences },
      pendingClarifications: this.detectNeedForClarification(recentTurns),
      suggestedResponses
    };
  }

  /**
   * Generate suggested response templates based on context
   */
  private generateSuggestedResponses(topics: Topic[], recentTurns: ConversationTurn[]): string[] {
    const suggestions: string[] = [];
    const lastTurn = recentTurns[recentTurns.length - 1];
    
    if (!lastTurn || lastTurn.speaker !== 'USER') return suggestions;

    const lowerText = lastTurn.text.toLowerCase();

    // Context-aware suggestions
    if (topics.some(t => t.name === 'Home Automation')) {
      suggestions.push('Would you like me to adjust any other devices?');
    }
    
    if (topics.some(t => t.name === 'Information')) {
      suggestions.push('Would you like me to search for more details on this topic?');
    }

    if (lowerText.includes('remind') || lowerText.includes('remember')) {
      suggestions.push('When would you like me to remind you about this?');
    }

    // Sentiment-based suggestions
    const recentSentiment = this.sentimentHistory[this.sentimentHistory.length - 1];
    if (recentSentiment?.sentiment === 'frustrated') {
      suggestions.push('I apologize for the confusion. Let me try a different approach.');
    }

    return suggestions;
  }

  /**
   * Detect if clarification is needed
   */
  private detectNeedForClarification(recentTurns: ConversationTurn[]): string[] {
    const clarifications: string[] = [];
    
    if (recentTurns.length < 2) return clarifications;

    const lastTwoUserTurns = recentTurns
      .filter(t => t.speaker === 'USER')
      .slice(-2);

    if (lastTwoUserTurns.length === 2) {
      const similarity = this.calculateSimilarity(
        lastTwoUserTurns[0].text,
        lastTwoUserTurns[1].text
      );
      
      // If user is repeating themselves, they might be frustrated
      if (similarity > 0.7) {
        clarifications.push('User may be repeating request - previous response may not have addressed their need');
      }
    }

    return clarifications;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Build context-aware system prompt
   */
  buildContextualSystemPrompt(basePrompt: string, context: EnrichedContext): string {
    let prompt = basePrompt;

    // Add topic context
    if (context.activeTopics.length > 0) {
      prompt += `\n\nCURRENT CONVERSATION TOPICS:\n`;
      context.activeTopics.forEach(topic => {
        prompt += `- ${topic.name} (${topic.turnCount} exchanges)\n`;
      });
    }

    // Add sentiment awareness
    if (context.sentimentHistory.length > 0) {
      const recent = context.sentimentHistory[context.sentimentHistory.length - 1];
      if (recent.sentiment !== 'neutral') {
        prompt += `\nUSER SENTIMENT: ${recent.sentiment.toUpperCase()} (score: ${recent.score.toFixed(2)})`;
        if (recent.sentiment === 'frustrated') {
          prompt += `\nThe user appears frustrated. Be extra helpful, acknowledge any difficulties, and offer clear solutions.`;
        }
      }
    }

    // Add thread context
    if (context.currentThread && context.currentThread.summary) {
      prompt += `\n\nCONVERSATION CONTEXT: ${context.currentThread.summary}`;
    }

    // Add user preferences
    const prefs = context.userPreferences ? Object.entries(context.userPreferences).slice(0, 5) : [];
    if (prefs.length > 0) {
      prompt += `\n\nUSER PREFERENCES:\n`;
      prefs.forEach(([key, value]) => {
        prompt += `- ${key}: ${value}\n`;
      });
    }

    return prompt;
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    topicCount: number;
    threadCount: number;
    sentimentHistoryCount: number;
    intentHistoryCount: number;
    currentTopic?: string;
  } {
    return {
      topicCount: this.topics.size,
      threadCount: this.threads.size,
      sentimentHistoryCount: this.sentimentHistory.length,
      intentHistoryCount: this.intentHistory.length,
      currentTopic: this.currentThreadId 
        ? this.topics.get(this.threads.get(this.currentThreadId)?.topicId || '')?.name
        : undefined
    };
  }

  /**
   * Clear all context (for privacy/reset)
   */
  clearContext(): void {
    this.topics.clear();
    this.threads.clear();
    this.currentThreadId = null;
    this.sentimentHistory = [];
    this.intentHistory = [];
    this.userPreferences.clear();
  }
}

export const conversationalContext = new ConversationalContextEngine();
