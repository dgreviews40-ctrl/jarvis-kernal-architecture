/**
 * Emotional Memory Service
 * Tracks significant moments with emotional context for a more human-like relationship
 */

import { vectorMemoryService } from './vectorMemoryService';
import { eventBus } from './eventBus';

// Local type definition for vector memory entries
interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  type: 'EPISODE';
  tags: string[];
  created: number;
  metadata?: Record<string, any>;
}

export interface EmotionalMoment {
  id: string;
  timestamp: number;
  type: MomentType;
  content: string;
  emotionalContext: EmotionalContext;
  importance: number; // 0-1, significance score
  relatedMemories?: string[]; // IDs of related memories
  resolved?: boolean;
  resolutionTimestamp?: number;
}

export type MomentType = 
  | 'first_meeting'
  | 'achievement'
  | 'concern'
  | 'frustration'
  | 'joy'
  | 'milestone'
  | 'preference_shared'
  | 'help_requested'
  | 'gratitude_expressed'
  | 'sadness'
  | 'excitement';

export interface EmotionalContext {
  valence: 'positive' | 'negative' | 'neutral'; // Overall tone
  intensity: number; // 0-1, how strong the emotion was
  primaryEmotion: string; // e.g., 'happy', 'worried', 'grateful'
  secondaryEmotions?: string[];
}

export interface UserMoodState {
  currentMood: string;
  confidence: number;
  recentValence: 'positive' | 'negative' | 'neutral';
  streak: number; // How many messages in this mood
  lastUpdated: number;
}

export interface TimeContext {
  lastInteraction: number;
  timeSinceLastInteraction: string; // human readable
  sessionCount: number;
  totalInteractions: number;
  isReturningAfterGap: boolean;
  gapDuration?: string;
}

const EMOTIONAL_MEMORY_KEY = 'jarvis_emotional_memories';
const MOOD_STATE_KEY = 'jarvis_mood_state';
const SESSION_KEY = 'jarvis_session_data';

/**
 * Service for tracking emotional context and significant moments
 */
export class EmotionalMemoryService {
  private moments: Map<string, EmotionalMoment> = new Map();
  private currentMood: UserMoodState = {
    currentMood: 'neutral',
    confidence: 0.5,
    recentValence: 'neutral',
    streak: 0,
    lastUpdated: Date.now(),
  };
  private sessionData = {
    sessionCount: 0,
    totalInteractions: 0,
    lastInteraction: 0,
  };
  private initialized = false;

  /**
   * Initialize the emotional memory service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadMemories();
    await this.loadMoodState();
    await this.loadSessionData();
    
    this.initialized = true;
    
    eventBus.publish('emotional:initialized', {
      momentCount: this.moments.size,
      currentMood: this.currentMood,
    });
  }

  /**
   * Record a significant emotional moment
   */
  async recordMoment(
    type: MomentType,
    content: string,
    emotionalContext: EmotionalContext,
    importance: number = 0.5
  ): Promise<EmotionalMoment> {
    const moment: EmotionalMoment = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      content,
      emotionalContext,
      importance: Math.min(1, Math.max(0, importance)),
    };

    this.moments.set(moment.id, moment);
    
    // Also store in vector memory for semantic retrieval
    await this.storeInVectorMemory(moment);
    
    // Persist to localStorage
    await this.saveMemories();

    eventBus.publish('emotional:moment_recorded', { moment });

    return moment;
  }

  /**
   * Mark a concern or issue as resolved
   */
  async resolveMoment(momentId: string, resolution?: string): Promise<void> {
    const moment = this.moments.get(momentId);
    if (!moment) return;

    moment.resolved = true;
    moment.resolutionTimestamp = Date.now();
    
    if (resolution) {
      moment.content += ` [Resolved: ${resolution}]`;
    }

    await this.saveMemories();
    
    eventBus.publish('emotional:moment_resolved', { moment });
  }

  /**
   * Get unresolved concerns or issues
   */
  getUnresolvedConcerns(): EmotionalMoment[] {
    return Array.from(this.moments.values())
      .filter(m => m.type === 'concern' && !m.resolved)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get recent significant moments
   */
  getRecentMoments(limit: number = 5, type?: MomentType): EmotionalMoment[] {
    let moments = Array.from(this.moments.values());
    
    if (type) {
      moments = moments.filter(m => m.type === type);
    }
    
    return moments
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get moments that should trigger a follow-up
   */
  getFollowUpCandidates(): EmotionalMoment[] {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * oneDay;
    const oneWeek = 7 * oneDay;

    return Array.from(this.moments.values()).filter(m => {
      // Don't follow up on resolved items
      if (m.resolved) return false;
      
      const age = now - m.timestamp;
      
      // Concerns: check after 1 day, then 3 days
      if (m.type === 'concern') {
        return age > oneDay;
      }
      
      // Achievements: celebrate for a week
      if (m.type === 'achievement' && age < oneWeek) {
        return true;
      }
      
      // Frustrations: follow up after 1 day
      if (m.type === 'frustration' && age > oneDay) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Update current mood based on new interaction
   */
  async updateMood(text: string, origin: 'USER_TEXT' | 'USER_VOICE'): Promise<UserMoodState> {
    const detectedMood = this.detectMoodFromText(text);
    const now = Date.now();

    // Update streak or reset
    if (detectedMood.valence === this.currentMood.recentValence) {
      this.currentMood.streak++;
    } else {
      this.currentMood.streak = 1;
    }

    this.currentMood.currentMood = detectedMood.mood;
    this.currentMood.confidence = detectedMood.confidence;
    this.currentMood.recentValence = detectedMood.valence;
    this.currentMood.lastUpdated = now;

    await this.saveMoodState();

    eventBus.publish('emotional:mood_updated', { mood: this.currentMood });

    return this.currentMood;
  }

  /**
   * Get current mood state
   */
  getCurrentMood(): UserMoodState {
    return { ...this.currentMood };
  }

  /**
   * Get time context for greeting generation
   */
  getTimeContext(): TimeContext {
    const now = Date.now();
    const lastInteraction = this.sessionData.lastInteraction;
    const timeSince = lastInteraction ? now - lastInteraction : 0;
    
    const isReturningAfterGap = timeSince > 30 * 60 * 1000; // 30 minutes
    
    return {
      lastInteraction,
      timeSinceLastInteraction: this.formatDuration(timeSince),
      sessionCount: this.sessionData.sessionCount,
      totalInteractions: this.sessionData.totalInteractions,
      isReturningAfterGap,
      gapDuration: isReturningAfterGap ? this.formatDuration(timeSince) : undefined,
    };
  }

  /**
   * Update session data when interaction occurs
   */
  async recordInteraction(): Promise<void> {
    const now = Date.now();
    
    // Check if this is a new session (gap > 30 min)
    if (now - this.sessionData.lastInteraction > 30 * 60 * 1000) {
      this.sessionData.sessionCount++;
    }
    
    this.sessionData.totalInteractions++;
    this.sessionData.lastInteraction = now;

    await this.saveSessionData();
  }

  /**
   * Check if user has expressed a concern recently
   */
  hasRecentConcern(timeWindowMs: number = 24 * 60 * 60 * 1000): boolean {
    const now = Date.now();
    return Array.from(this.moments.values()).some(m => 
      m.type === 'concern' && 
      !m.resolved && 
      now - m.timestamp < timeWindowMs
    );
  }

  /**
   * Get a significant memory to reference
   */
  getSignificantMemoryToReference(): EmotionalMoment | null {
    // Prioritize: unresolved concerns, recent achievements, then general moments
    const candidates = [
      ...this.getUnresolvedConcerns(),
      ...this.getRecentMoments(3, 'achievement'),
      ...this.getRecentMoments(3, 'milestone'),
    ];

    if (candidates.length === 0) return null;

    // Weight by importance and recency
    const weighted = candidates.map(m => ({
      moment: m,
      score: m.importance * (1 / (1 + (Date.now() - m.timestamp) / (24 * 60 * 60 * 1000))),
    }));

    weighted.sort((a, b) => b.score - a.score);
    return weighted[0]?.moment || null;
  }

  /**
   * Clear all emotional memories (for testing/reset)
   */
  async clear(): Promise<void> {
    this.moments.clear();
    this.currentMood = {
      currentMood: 'neutral',
      confidence: 0.5,
      recentValence: 'neutral',
      streak: 0,
      lastUpdated: Date.now(),
    };
    this.sessionData = {
      sessionCount: 0,
      totalInteractions: 0,
      lastInteraction: 0,
    };
    
    await this.saveMemories();
    await this.saveMoodState();
    await this.saveSessionData();
  }

  // Private methods

  private detectMoodFromText(text: string): { mood: string; valence: 'positive' | 'negative' | 'neutral'; confidence: number } {
    const lower = text.toLowerCase();
    
    // Simple sentiment analysis patterns
    const patterns: Record<string, { valence: 'positive' | 'negative' | 'neutral'; weight: number }> = {
      // Positive
      'happy': { valence: 'positive', weight: 0.8 },
      'great': { valence: 'positive', weight: 0.7 },
      'awesome': { valence: 'positive', weight: 0.9 },
      'love': { valence: 'positive', weight: 0.9 },
      'thanks': { valence: 'positive', weight: 0.6 },
      'thank you': { valence: 'positive', weight: 0.7 },
      'excited': { valence: 'positive', weight: 0.8 },
      'wonderful': { valence: 'positive', weight: 0.8 },
      'perfect': { valence: 'positive', weight: 0.7 },
      'good': { valence: 'positive', weight: 0.5 },
      
      // Negative
      'sad': { valence: 'negative', weight: 0.8 },
      'upset': { valence: 'negative', weight: 0.8 },
      'angry': { valence: 'negative', weight: 0.9 },
      'frustrated': { valence: 'negative', weight: 0.8 },
      'hate': { valence: 'negative', weight: 0.9 },
      'terrible': { valence: 'negative', weight: 0.8 },
      'awful': { valence: 'negative', weight: 0.8 },
      'worried': { valence: 'negative', weight: 0.7 },
      'stressed': { valence: 'negative', weight: 0.7 },
      'annoyed': { valence: 'negative', weight: 0.7 },
      'disappointed': { valence: 'negative', weight: 0.7 },
      
      // Concern-specific
      'concerned': { valence: 'negative', weight: 0.6 },
      'anxious': { valence: 'negative', weight: 0.7 },
      'nervous': { valence: 'negative', weight: 0.6 },
      'scared': { valence: 'negative', weight: 0.8 },
      'afraid': { valence: 'negative', weight: 0.8 },
    };

    let positiveScore = 0;
    let negativeScore = 0;
    let detectedMoods: string[] = [];

    for (const [pattern, data] of Object.entries(patterns)) {
      if (lower.includes(pattern)) {
        if (data.valence === 'positive') {
          positiveScore += data.weight;
        } else {
          negativeScore += data.weight;
        }
        detectedMoods.push(pattern);
      }
    }

    // Punctuation-based intensity detection
    const hasExclamation = text.includes('!');
    const hasMultiplePunctuation = /[!?]{2,}/.test(text);
    
    if (hasMultiplePunctuation) {
      positiveScore *= 1.3;
      negativeScore *= 1.3;
    } else if (hasExclamation) {
      positiveScore *= 1.1;
      negativeScore *= 1.1;
    }

    // Determine mood
    let valence: 'positive' | 'negative' | 'neutral';
    let mood: string;
    let confidence: number;

    if (positiveScore > negativeScore && positiveScore > 0.3) {
      valence = 'positive';
      mood = detectedMoods.includes('excited') ? 'excited' :
             detectedMoods.includes('love') ? 'appreciative' :
             detectedMoods.includes('thanks') || detectedMoods.includes('thank you') ? 'grateful' :
             'happy';
      confidence = Math.min(0.95, positiveScore);
    } else if (negativeScore > positiveScore && negativeScore > 0.3) {
      valence = 'negative';
      mood = detectedMoods.includes('frustrated') ? 'frustrated' :
             detectedMoods.includes('worried') || detectedMoods.includes('anxious') ? 'anxious' :
             detectedMoods.includes('angry') ? 'angry' :
             detectedMoods.includes('sad') ? 'sad' :
             'concerned';
      confidence = Math.min(0.95, negativeScore);
    } else {
      valence = 'neutral';
      mood = 'neutral';
      confidence = 0.5;
    }

    return { mood, valence, confidence };
  }

  private async storeInVectorMemory(moment: EmotionalMoment): Promise<void> {
    try {
      const entry: MemoryEntry = {
        id: moment.id,
        content: `[${moment.type}] ${moment.content}`,
        timestamp: moment.timestamp,
        type: 'EPISODE',
        tags: ['emotional', moment.type],
        created: moment.timestamp,
        metadata: {
          emotionalContext: moment.emotionalContext,
          importance: moment.importance,
          momentType: moment.type,
        },
      };

      await vectorMemoryService.store(entry);
    } catch (error) {
      // Non-critical: vector storage is enhancement, not required
      console.warn('[EMOTIONAL_MEMORY] Failed to store in vector DB:', error);
    }
  }

  private async loadMemories(): Promise<void> {
    try {
      const saved = localStorage.getItem(EMOTIONAL_MEMORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.moments = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to load memories:', error);
    }
  }

  private async saveMemories(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.moments);
      localStorage.setItem(EMOTIONAL_MEMORY_KEY, JSON.stringify(obj));
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to save memories:', error);
    }
  }

  private async loadMoodState(): Promise<void> {
    try {
      const saved = localStorage.getItem(MOOD_STATE_KEY);
      if (saved) {
        this.currentMood = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to load mood state:', error);
    }
  }

  private async saveMoodState(): Promise<void> {
    try {
      localStorage.setItem(MOOD_STATE_KEY, JSON.stringify(this.currentMood));
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to save mood state:', error);
    }
  }

  private async loadSessionData(): Promise<void> {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        this.sessionData = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to load session data:', error);
    }
  }

  private async saveSessionData(): Promise<void> {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.sessionData));
    } catch (error) {
      console.warn('[EMOTIONAL_MEMORY] Failed to save session data:', error);
    }
  }

  private generateId(): string {
    return `em_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 60000) return 'moments';
    if (ms < 3600000) return `${Math.floor(ms / 60000)} minutes`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)} hours`;
    if (ms < 604800000) return `${Math.floor(ms / 86400000)} days`;
    if (ms < 2592000000) return `${Math.floor(ms / 604800000)} weeks`;
    return `${Math.floor(ms / 2592000000)} months`;
  }
}

// Singleton instance
export const emotionalMemory = new EmotionalMemoryService();
