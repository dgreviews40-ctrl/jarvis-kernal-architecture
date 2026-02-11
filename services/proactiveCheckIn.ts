/**
 * Proactive Check-In Service
 * Monitors for opportunities to follow up on previous concerns and topics
 */

import { emotionalMemory, type EmotionalMoment } from './emotionalMemory';
import { contextualGreeting } from './contextualGreeting';
import { eventBus } from './eventBus';

export interface CheckInOpportunity {
  type: 'concern' | 'achievement' | 'milestone' | 'general';
  moment: EmotionalMoment;
  message: string;
  priority: number; // 0-1, higher = more important
  suggestedTiming: 'immediate' | 'after_greeting' | 'during_conversation';
}

export interface ConversationContext {
  topics: string[];
  emotionalTone: string;
  userInitiated: boolean;
  messageCount: number;
}

/**
 * Service for proactive check-ins and follow-ups
 */
export class ProactiveCheckInService {
  private lastCheckInTime: number = 0;
  private checkInCooldown: number = 60 * 60 * 1000; // 1 hour between proactive check-ins
  private recentCheckIns: Set<string> = new Set(); // Track recently checked-in moments
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await emotionalMemory.initialize();
    this.initialized = true;
    
    // Start periodic check for opportunities
    this.startPeriodicCheck();
    
    eventBus.publish('proactive:initialized', {});
  }

  /**
   * Check for and return any check-in opportunities
   */
  async checkForOpportunities(context?: ConversationContext): Promise<CheckInOpportunity[]> {
    await this.ensureInitialized();

    const opportunities: CheckInOpportunity[] = [];
    const now = Date.now();

    // Respect cooldown
    if (now - this.lastCheckInTime < this.checkInCooldown && !context?.userInitiated) {
      return opportunities;
    }

    // Check for unresolved concerns
    const concerns = emotionalMemory.getUnresolvedConcerns();
    for (const concern of concerns) {
      if (this.shouldCheckInOnMoment(concern)) {
        const opportunity = await this.createConcernOpportunity(concern);
        if (opportunity) opportunities.push(opportunity);
      }
    }

    // Check for recent achievements worth celebrating
    const achievements = emotionalMemory.getRecentMoments(3, 'achievement');
    for (const achievement of achievements) {
      if (this.shouldReferenceAchievement(achievement)) {
        const opportunity = await this.createAchievementOpportunity(achievement);
        if (opportunity) opportunities.push(opportunity);
      }
    }

    // Sort by priority
    opportunities.sort((a, b) => b.priority - a.priority);

    return opportunities;
  }

  /**
   * Get the highest priority check-in for immediate use
   */
  async getPriorityCheckIn(): Promise<CheckInOpportunity | null> {
    const opportunities = await this.checkForOpportunities();
    return opportunities.length > 0 ? opportunities[0] : null;
  }

  /**
   * Mark a check-in as completed
   */
  markCheckInCompleted(momentId: string): void {
    this.recentCheckIns.add(momentId);
    this.lastCheckInTime = Date.now();
    
    // Clean up old check-ins after some time
    setTimeout(() => {
      this.recentCheckIns.delete(momentId);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Mark a concern as resolved
   */
  async resolveConcern(momentId: string, resolution?: string): Promise<void> {
    await emotionalMemory.resolveMoment(momentId, resolution);
    this.markCheckInCompleted(momentId);
  }

  /**
   * Should we check in on this moment?
   */
  private shouldCheckInOnMoment(moment: EmotionalMoment): boolean {
    // Don't check in if already done recently
    if (this.recentCheckIns.has(moment.id)) return false;

    const age = Date.now() - moment.timestamp;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const threeDays = 3 * oneDay;

    // Concerns: check after 1 day, then 3 days, then drop off
    if (moment.type === 'concern') {
      if (age < oneDay) return false; // Too soon
      if (age > 7 * oneDay) return false; // Too old
      return true;
    }

    // Frustrations: check after 1 day
    if (moment.type === 'frustration') {
      return age > oneDay && age < threeDays;
    }

    return false;
  }

  /**
   * Should we reference this achievement?
   */
  private shouldReferenceAchievement(achievement: EmotionalMoment): boolean {
    // Don't reference if already done
    if (this.recentCheckIns.has(achievement.id)) return false;

    const age = Date.now() - achievement.timestamp;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    // Reference achievements within the past week
    return age > oneHour && age < oneWeek;
  }

  /**
   * Create a check-in opportunity for a concern
   */
  private async createConcernOpportunity(concern: EmotionalMoment): Promise<CheckInOpportunity | null> {
    const message = await contextualGreeting.generateConcernFollowUp(concern);
    
    // Calculate priority based on importance and age
    const age = Date.now() - concern.timestamp;
    const daysOld = age / (24 * 60 * 60 * 1000);
    const priority = concern.importance * (1 + daysOld / 3); // Older concerns get higher priority

    return {
      type: 'concern',
      moment: concern,
      message,
      priority: Math.min(1, priority),
      suggestedTiming: 'after_greeting',
    };
  }

  /**
   * Create a reference opportunity for an achievement
   */
  private async createAchievementOpportunity(achievement: EmotionalMoment): Promise<CheckInOpportunity | null> {
    const message = contextualGreeting.generateAchievementReference(achievement);
    
    return {
      type: 'achievement',
      moment: achievement,
      message,
      priority: achievement.importance * 0.6, // Lower priority than concerns
      suggestedTiming: 'during_conversation',
    };
  }

  /**
   * Get a natural insertion for a check-in during conversation
   */
  getConversationInsertion(opportunity: CheckInOpportunity, currentTopic?: string): string {
    if (opportunity.type === 'concern') {
      // Seamlessly transition to concern check-in
      const transitions = [
        `Before we continue, I wanted to ask: ${opportunity.message}`,
        `On a different note - ${opportunity.message}`,
        `I've been thinking about you. ${opportunity.message}`,
      ];
      return transitions[Math.floor(Math.random() * transitions.length)];
    }

    if (opportunity.type === 'achievement') {
      // Celebrate achievement
      const transitions = [
        `That reminds me - ${opportunity.message}`,
        `Speaking of accomplishments - ${opportunity.message}`,
        `By the way - ${opportunity.message}`,
      ];
      return transitions[Math.floor(Math.random() * transitions.length)];
    }

    return opportunity.message;
  }

  /**
   * Analyze if a user message indicates resolution of a concern
   */
  detectResolution(text: string, concern: EmotionalMoment): {
    isResolved: boolean;
    confidence: number;
    resolutionText?: string;
  } {
    const lower = text.toLowerCase();
    
    // Positive resolution indicators
    const resolvedIndicators = [
      'worked out', 'resolved', 'fixed', 'solved', 'better now',
      'all good', 'working', 'taken care of', 'done with',
      'no longer', 'not anymore', 'finished', 'completed',
    ];

    // Negative persistence indicators
    const persistedIndicators = [
      'still', 'ongoing', 'continues', 'hasn\'t changed',
      'getting worse', 'not better', 'still dealing with',
    ];

    let resolvedScore = 0;
    let persistedScore = 0;

    for (const indicator of resolvedIndicators) {
      if (lower.includes(indicator)) resolvedScore += 0.3;
    }

    for (const indicator of persistedIndicators) {
      if (lower.includes(indicator)) persistedScore += 0.4;
    }

    // Direct responses to check-ins
    if (lower.includes('much better') || lower.includes('doing great')) {
      resolvedScore += 0.5;
    }
    if (lower.includes('still struggling') || lower.includes('not good')) {
      persistedScore += 0.5;
    }

    if (resolvedScore > persistedScore && resolvedScore > 0.3) {
      return {
        isResolved: true,
        confidence: resolvedScore,
        resolutionText: text,
      };
    }

    if (persistedScore > resolvedScore && persistedScore > 0.3) {
      return {
        isResolved: false,
        confidence: persistedScore,
      };
    }

    return { isResolved: false, confidence: 0 };
  }

  /**
   * Get a supportive response based on user's emotional state
   */
  getSupportiveResponse(mood: string): string {
    const responses: Record<string, string[]> = {
      frustrated: [
        "I understand that can be frustrating. Let me see how I can help.",
        "That sounds challenging. I'm here to help work through it.",
        "I can sense your frustration. Let's tackle this together.",
      ],
      anxious: [
        "Take your time. I'm here to help make this easier.",
        "I understand this might be stressful. Let's work through it step by step.",
        "No pressure at all. I'm here whenever you're ready.",
      ],
      sad: [
        "I'm sorry you're feeling that way. I'm here if you need anything.",
        "That sounds difficult. Is there anything I can do to help?",
        "I appreciate you sharing that with me. How can I support you?",
      ],
      angry: [
        "I understand you're upset. Let me see what I can do to help.",
        "That sounds frustrating. I'm here to help find a solution.",
        "I hear your frustration. Let's see how we can fix this.",
      ],
      excited: [
        "That sounds exciting! Tell me more!",
        "I love your enthusiasm! What can I do to help?",
        "That energy is contagious! Let's make it happen!",
      ],
      grateful: [
        "You're very welcome! I'm always happy to help.",
        "It's my pleasure! That's what I'm here for.",
        "I'm glad I could help. Let me know if you need anything else!",
      ],
    };

    const moodResponses = responses[mood] || responses['neutral'] || ["I'm here to help."];
    return moodResponses[Math.floor(Math.random() * moodResponses.length)];
  }

  /**
   * Check if we should proactively reach out (for idle moments)
   */
  shouldProactivelyReachOut(): boolean {
    const timeContext = emotionalMemory.getTimeContext();
    const now = Date.now();
    
    // Only if there's been a significant gap
    if (!timeContext.isReturningAfterGap) return false;
    
    // Respect cooldown
    if (now - this.lastCheckInTime < this.checkInCooldown) return false;
    
    // Check for opportunities
    const concerns = emotionalMemory.getUnresolvedConcerns();
    return concerns.length > 0;
  }

  /**
   * Generate a proactive outreach message
   */
  async generateProactiveOutreach(): Promise<string | null> {
    if (!this.shouldProactivelyReachOut()) return null;

    const concerns = emotionalMemory.getUnresolvedConcerns();
    if (concerns.length === 0) return null;

    // Get the highest priority concern
    const concern = concerns[0];
    const opportunity = await this.createConcernOpportunity(concern);
    
    if (!opportunity) return null;

    this.markCheckInCompleted(concern.id);

    return opportunity.message;
  }

  /**
   * Start periodic background checking
   */
  private startPeriodicCheck(): void {
    // Check every 5 minutes for opportunities (when idle)
    setInterval(() => {
      this.checkForIdleOpportunities();
    }, 5 * 60 * 1000);
  }

  /**
   * Check for opportunities during idle time
   */
  private async checkForIdleOpportunities(): Promise<void> {
    // This would integrate with the app's idle detection
    // For now, just emit events that the app can listen to
    const opportunities = await this.checkForOpportunities();
    
    if (opportunities.length > 0) {
      eventBus.publish('proactive:opportunities_available', {
        opportunities,
        count: opportunities.length,
      });
    }
  }

  /**
   * Get statistics about check-ins
   */
  getStats(): {
    totalCheckIns: number;
    recentCheckIns: number;
    unresolvedConcerns: number;
    lastCheckInTime: number;
  } {
    return {
      totalCheckIns: this.recentCheckIns.size,
      recentCheckIns: this.recentCheckIns.size,
      unresolvedConcerns: emotionalMemory.getUnresolvedConcerns().length,
      lastCheckInTime: this.lastCheckInTime,
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance
export const proactiveCheckIn = new ProactiveCheckInService();
