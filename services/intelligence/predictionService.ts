/**
 * Prediction Service
 * 
 * Consolidated from:
 * - predictiveModel.ts (ML-based predictions)
 * - proactiveIntelligence.ts (legacy suggestions)
 * 
 * Provides: User behavior prediction, proactive suggestions
 */

// ==================== TYPES ====================

interface UserProfile {
  userId: string;
  actionHistory: string[];
  topicPreferences: Map<string, number>;
  timePatterns: Map<number, string[]>; // hour -> actions
  lastActive: number;
}

interface Prediction {
  action: string;
  confidence: number;
  reason: string;
}

interface SuggestionContext {
  currentTopic?: string;
  sentiment?: string;
  timeOfDay?: number;
  recentActions?: string[];
}

// ==================== STATE ====================

class PredictionService {
  private profiles: Map<string, UserProfile> = new Map();
  private globalPatterns: Map<string, number> = new Map(); // action -> frequency
  
  // Follow-up patterns for suggestion generation
  private followupPatterns: Record<string, string[]> = {
    'light': ['Would you like me to adjust the brightness?', 'Shall I turn off the lights later?'],
    'temperature': ['Should I maintain this temperature?', 'Would you like me to schedule a change?'],
    'music': ['Want me to queue more songs?', 'Should I adjust the volume?'],
    'weather': ['Would you like a forecast for tomorrow?', 'Shall I alert you of any changes?'],
    'status': ['Is there anything specific you want me to check?', 'Would you like a detailed report?']
  };

  // ==================== USER TRACKING ====================

  recordInteraction(userId: string, input: string, context: { topics?: string[] }): void {
    let profile = this.profiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        actionHistory: [],
        topicPreferences: new Map(),
        timePatterns: new Map(),
        lastActive: Date.now()
      };
      this.profiles.set(userId, profile);
    }
    
    // Record action
    profile.actionHistory.push(input);
    if (profile.actionHistory.length > 100) {
      profile.actionHistory.shift(); // Keep last 100
    }
    
    // Record topic preferences
    context.topics?.forEach(topic => {
      const current = profile!.topicPreferences.get(topic) || 0;
      profile!.topicPreferences.set(topic, current + 1);
    });
    
    // Record time pattern
    const hour = new Date().getHours();
    const hourActions = profile.timePatterns.get(hour) || [];
    hourActions.push(input);
    profile.timePatterns.set(hour, hourActions);
    
    profile.lastActive = Date.now();
    
    // Update global patterns
    const normalizedAction = this.normalizeAction(input);
    const currentFreq = this.globalPatterns.get(normalizedAction) || 0;
    this.globalPatterns.set(normalizedAction, currentFreq + 1);
  }

  // ==================== PREDICTION ====================

  predict(userId: string, context: SuggestionContext = {}): Prediction[] {
    const profile = this.profiles.get(userId);
    const predictions: Prediction[] = [];
    
    if (!profile) {
      return this.getGlobalPredictions(context);
    }
    
    // Time-based predictions
    if (context.timeOfDay !== undefined) {
      const hourActions = profile.timePatterns.get(context.timeOfDay) || [];
      const actionCounts = this.countActions(hourActions);
      
      Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([action, count]) => {
          predictions.push({
            action,
            confidence: Math.min(0.9, count / 10),
            reason: `You often do this around ${context.timeOfDay}:00`
          });
        });
    }
    
    // Topic-based predictions
    if (context.currentTopic) {
      const topicScore = profile.topicPreferences.get(context.currentTopic) || 0;
      if (topicScore > 2) {
        predictions.push({
          action: `Continue with ${context.currentTopic}`,
          confidence: Math.min(0.8, topicScore / 10),
          reason: `You've shown interest in ${context.currentTopic}`
        });
      }
    }
    
    // Recent action patterns
    const recentActions = profile.actionHistory.slice(-5);
    const commonRecent = this.getMostCommon(recentActions);
    if (commonRecent) {
      predictions.push({
        action: `Repeat: ${commonRecent}`,
        confidence: 0.6,
        reason: 'Based on your recent activity'
      });
    }
    
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  // ==================== SUGGESTIONS ====================

  getSuggestions(context: SuggestionContext): string[] {
    const suggestions: string[] = [];
    
    // Pattern-based suggestions
    if (context.currentTopic) {
      const patterns = this.followupPatterns[context.currentTopic.toLowerCase()];
      if (patterns) {
        suggestions.push(...patterns);
      }
    }
    
    // Sentiment-based suggestions
    if (context.sentiment?.includes('negative')) {
      suggestions.push('Would you like me to help troubleshoot?');
      suggestions.push('Is there something specific bothering you?');
    }
    
    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      suggestions.push('It\'s getting late. Should I prepare for night mode?');
    } else if (hour >= 17 && hour <= 19) {
      suggestions.push('Evening routine? I can adjust the lights and temperature.');
    }
    
    return suggestions.slice(0, 3);
  }

  // ==================== HELPERS ====================

  private normalizeAction(input: string): string {
    // Extract the core action from input
    const lower = input.toLowerCase();
    
    if (lower.includes('light') || lower.includes('lamp')) return 'lighting';
    if (lower.includes('temperature') || lower.includes('thermostat')) return 'climate';
    if (lower.includes('music') || lower.includes('play')) return 'media';
    if (lower.includes('status') || lower.includes('check')) return 'status';
    if (lower.includes('weather')) return 'weather';
    
    return 'general';
  }

  private countActions(actions: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    actions.forEach(action => {
      const normalized = this.normalizeAction(action);
      counts[normalized] = (counts[normalized] || 0) + 1;
    });
    return counts;
  }

  private getMostCommon(actions: string[]): string | null {
    const counts = this.countActions(actions);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  private getGlobalPredictions(context: SuggestionContext): Prediction[] {
    // For new users, use global patterns
    const globalSorted = Array.from(this.globalPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return globalSorted.map(([action, count]) => ({
      action,
      confidence: 0.3,
      reason: 'Popular among users'
    }));
  }

  // ==================== LIFECYCLE ====================

  clearUserData(userId: string): void {
    this.profiles.delete(userId);
  }

  clearAllData(): void {
    this.profiles.clear();
    this.globalPatterns.clear();
  }

  getStats(): {
    users: number;
    totalInteractions: number;
    topPatterns: Array<{ action: string; count: number }>;
  } {
    const totalInteractions = Array.from(this.profiles.values())
      .reduce((sum, p) => sum + p.actionHistory.length, 0);
    
    const topPatterns = Array.from(this.globalPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));
    
    return {
      users: this.profiles.size,
      totalInteractions,
      topPatterns
    };
  }
}

export const predictionService = new PredictionService();
