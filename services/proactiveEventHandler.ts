/**
 * Proactive Event Handler
 * 
 * Bridges proactive intelligence systems to user-facing outputs:
 * - Subscribes to proactive:opportunities_available events
 * - Routes to notifications, TTS, or UI based on context
 * - Manages proactive suggestion state and user interactions
 * - Integrates with notificationService, voice, and eventBus
 * 
 * Phase 1, Task 1 of Humanization implementation
 */

import { eventBus } from './eventBus';
import { notificationService } from './notificationService';
import { voice } from './voice';
import { logger } from './logger';
import { proactiveCheckIn, CheckInOpportunity } from './proactiveCheckIn';
import { contextualGreeting } from './contextualGreeting';

export interface ProactiveDisplayOptions {
  /** Show as notification toast */
  showNotification: boolean;
  /** Speak via TTS */
  speak: boolean;
  /** Require user interaction before dismissing */
  requireInteraction: boolean;
  /** Priority level affects display style */
  priority: 'low' | 'medium' | 'high';
}

export interface ProactiveSuggestion {
  id: string;
  type: 'concern' | 'achievement' | 'milestone' | 'general';
  message: string;
  title: string;
  actions: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  timestamp: number;
  spoken: boolean;
}

export class ProactiveEventHandler {
  private initialized = false;
  private unsubscribe: (() => void) | null = null;
  private recentSuggestions: Map<string, number> = new Map();
  private readonly DEDUPLICATION_WINDOW = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RECENT_SUGGESTIONS = 10;

  /**
   * Initialize the proactive event handler
   * Must be called after proactiveCheckIn.initialize()
   */
  initialize(): void {
    if (this.initialized) {
      logger.log('KERNEL', 'Event handler already initialized', 'warning');
      return;
    }

    // Subscribe to proactive opportunity events
    this.unsubscribe = eventBus.subscribe(
      'proactive:opportunities_available',
      this.handleOpportunitiesAvailable.bind(this) as any
    );

    this.initialized = true;
    logger.log('KERNEL', 'Event handler initialized - listening for opportunities', 'success');
  }

  /**
   * Clean up event subscriptions
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.initialized = false;
    this.recentSuggestions.clear();
    logger.log('KERNEL', 'Event handler destroyed', 'info');
  }

  /**
   * Handle proactive opportunities available event
   */
  private async handleOpportunitiesAvailable(event: { 
    payload?: { 
      opportunities?: CheckInOpportunity[]; 
      count?: number;
    };
  }): Promise<void> {
    const opportunities = event.payload?.opportunities || [];
    
    if (opportunities.length === 0) return;

    logger.log('KERNEL', `${opportunities.length} proactive opportunity(s) available`, 'info');

    // Process each opportunity
    for (const opportunity of opportunities) {
      await this.processOpportunity(opportunity);
    }
  }

  /**
   * Process a single proactive opportunity
   */
  private async processOpportunity(opportunity: CheckInOpportunity): Promise<void> {
    // Deduplication check
    if (this.isRecentlyShown(opportunity)) {
      logger.log('KERNEL', `Skipping duplicate opportunity: ${opportunity.type}`, 'info');
      return;
    }

    // Mark as shown
    this.markAsShown(opportunity);

    // Determine display strategy based on type and context
    const options = this.determineDisplayOptions(opportunity);

    // Build suggestion
    const suggestion = await this.buildSuggestion(opportunity, options);

    // Display to user
    await this.displaySuggestion(suggestion, options);
  }

  /**
   * Check if this opportunity was recently shown
   */
  private isRecentlyShown(opportunity: CheckInOpportunity): boolean {
    const key = `${opportunity.type}_${opportunity.message}`;
    const lastShown = this.recentSuggestions.get(key);
    
    if (!lastShown) return false;
    
    return (Date.now() - lastShown) < this.DEDUPLICATION_WINDOW;
  }

  /**
   * Mark opportunity as shown
   */
  private markAsShown(opportunity: CheckInOpportunity): void {
    const key = `${opportunity.type}_${opportunity.message}`;
    this.recentSuggestions.set(key, Date.now());

    // Clean up old entries
    const cutoff = Date.now() - this.DEDUPLICATION_WINDOW;
    for (const [k, v] of this.recentSuggestions) {
      if (v < cutoff) {
        this.recentSuggestions.delete(k);
      }
    }

    // Limit size
    if (this.recentSuggestions.size > this.MAX_RECENT_SUGGESTIONS) {
      const oldest = Array.from(this.recentSuggestions.entries())
        .sort((a, b) => a[1] - b[1])[0];
      if (oldest) {
        this.recentSuggestions.delete(oldest[0]);
      }
    }
  }

  /**
   * Determine how to display this opportunity
   */
  private determineDisplayOptions(opportunity: CheckInOpportunity): ProactiveDisplayOptions {
    const voiceEnabled = voice.getState() !== 'MUTED';

    switch (opportunity.type) {
      case 'concern':
        // High priority - always show notification, optionally speak
        return {
          showNotification: true,
          speak: voiceEnabled,
          requireInteraction: true,
          priority: 'high'
        };

      case 'achievement':
        // Medium priority - notification, speak if voice active
        return {
          showNotification: true,
          speak: voiceEnabled,
          requireInteraction: false,
          priority: 'medium'
        };

      case 'milestone':
        // Medium priority
        return {
          showNotification: true,
          speak: voiceEnabled,
          requireInteraction: false,
          priority: 'medium'
        };

      case 'general':
      default:
        // Low priority - notification only, don't interrupt
        return {
          showNotification: true,
          speak: false,
          requireInteraction: false,
          priority: 'low'
        };
    }
  }

  /**
   * Build a suggestion object from opportunity
   */
  private async buildSuggestion(
    opportunity: CheckInOpportunity,
    options: ProactiveDisplayOptions
  ): Promise<ProactiveSuggestion> {
    const id = `proactive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine title based on type
    const titles: Record<string, string> = {
      concern: 'Checking In',
      achievement: 'Following Up',
      milestone: 'Milestone Reminder',
      habit: 'Pattern Noticed',
      general: 'JARVIS'
    };

    // Build actions based on type
    const actions: ProactiveSuggestion['actions'] = [];

    if (opportunity.type === 'concern') {
      actions.push({
        label: 'I\'m Better Now',
        action: () => this.handleConcernResolved(opportunity, id, 'resolved'),
        variant: 'primary'
      });
      actions.push({
        label: 'Still Dealing With It',
        action: () => this.handleConcernContinues(opportunity, id),
        variant: 'secondary'
      });
    } else if (opportunity.type === 'achievement') {
      actions.push({
        label: 'Thanks for Asking!',
        action: () => this.handleAcknowledgeAchievement(opportunity, id),
        variant: 'primary'
      });
    }

    // Always add dismiss
    actions.push({
      label: 'Dismiss',
      action: () => this.handleDismiss(id),
      variant: 'secondary'
    });

    return {
      id,
      type: opportunity.type,
      message: opportunity.message,
      title: titles[opportunity.type] || titles.general,
      actions,
      timestamp: Date.now(),
      spoken: false
    };
  }

  /**
   * Display suggestion to user via notification and/or TTS
   */
  private async displaySuggestion(
    suggestion: ProactiveSuggestion,
    options: ProactiveDisplayOptions
  ): Promise<void> {
    // Speak first if enabled (before showing notification)
    if (options.speak && !suggestion.spoken) {
      await this.speakSuggestion(suggestion);
      suggestion.spoken = true;
    }

    // Show notification
    if (options.showNotification) {
      this.showNotification(suggestion, options);
    }

    // Log
    logger.log('KERNEL', `Displayed ${suggestion.type} suggestion: ${suggestion.message.substring(0, 50)}...`, 'info');
  }

  /**
   * Speak suggestion via TTS
   */
  private async speakSuggestion(suggestion: ProactiveSuggestion): Promise<void> {
    try {
      // Use contextual greeting for natural speech if available
      let speechText = suggestion.message;
      
      // Add natural opening for voice
      if (suggestion.type === 'concern') {
        speechText = `I wanted to check in. ${suggestion.message}`;
      } else if (suggestion.type === 'achievement') {
        speechText = `By the way, ${suggestion.message.toLowerCase()}`;
      }

      await voice.speak(speechText);
    } catch (error) {
      logger.log('KERNEL', `TTS failed: ${(error as Error).message}`, 'warning');
    }
  }

  /**
   * Show notification for suggestion
   */
  private showNotification(
    suggestion: ProactiveSuggestion,
    options: ProactiveDisplayOptions
  ): void {
    const notificationOptions = {
      title: suggestion.title,
      message: suggestion.message,
      type: this.mapPriorityToType(options.priority),
      duration: options.requireInteraction ? 0 : this.getDurationForPriority(options.priority),
      actions: suggestion.actions.map(a => ({
        label: a.label,
        onClick: a.action,
        variant: a.variant
      }))
    };

    notificationService.show(notificationOptions);
  }

  /**
   * Map priority to notification type
   */
  private mapPriorityToType(priority: ProactiveDisplayOptions['priority']) {
    const map: Record<string, 'info' | 'success' | 'warning'> = {
      low: 'info',
      medium: 'success',
      high: 'warning'
    };
    return map[priority] || 'info';
  }

  /**
   * Get duration based on priority
   */
  private getDurationForPriority(priority: ProactiveDisplayOptions['priority']): number {
    const durations = {
      low: 5000,
      medium: 8000,
      high: 10000
    };
    return durations[priority] || 5000;
  }

  // ==================== ACTION HANDLERS ====================

  /**
   * Handle concern resolved
   */
  private async handleConcernResolved(
    opportunity: CheckInOpportunity,
    suggestionId: string,
    resolution: string
  ): Promise<void> {
    logger.log('KERNEL', 'User marked concern as resolved', 'success');
    
    // Resolve in proactiveCheckIn
    if (opportunity.moment?.id) {
      await proactiveCheckIn.resolveConcern(opportunity.moment.id, resolution);
    }

    // Acknowledge via TTS if voice is active
    if (voice.getState() !== 'MUTED') {
      const acknowledgments = [
        "I'm glad to hear that!",
        "That's wonderful news.",
        "I'm happy things worked out.",
        "Great to hear you're doing better."
      ];
      const response = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      await voice.speak(response);
    }

    notificationService.success('Thanks for letting me know!');
  }

  /**
   * Handle concern continues
   */
  private async handleConcernContinues(
    opportunity: CheckInOpportunity,
    suggestionId: string
  ): Promise<void> {
    logger.log('KERNEL', 'User indicates concern continues', 'info');
    
    // Offer help via TTS
    if (voice.getState() !== 'MUTED') {
      await voice.speak("I'm sorry to hear that. Would you like to talk about it, or is there anything I can do to help?");
    }

    notificationService.info('I\'m here if you want to talk about it.');
  }

  /**
   * Handle achievement acknowledgment
   */
  private async handleAcknowledgeAchievement(
    opportunity: CheckInOpportunity,
    suggestionId: string
  ): Promise<void> {
    logger.log('KERNEL', 'User acknowledged achievement follow-up', 'info');
    
    // Mark as completed
    if (opportunity.moment?.id) {
      proactiveCheckIn.markCheckInCompleted(opportunity.moment.id);
    }

    notificationService.success('That\'s great to hear!');
  }

  /**
   * Handle dismiss
   */
  private handleDismiss(suggestionId: string): void {
    logger.log('KERNEL', `Suggestion ${suggestionId} dismissed`, 'info');
    // Just close notification - no other action needed
  }

  /**
   * Manually trigger a proactive check (for testing)
   */
  async manualCheck(): Promise<ProactiveSuggestion[]> {
    const opportunities = await proactiveCheckIn.checkForOpportunities();
    const suggestions: ProactiveSuggestion[] = [];

    for (const opportunity of opportunities) {
      const options = this.determineDisplayOptions(opportunity);
      const suggestion = await this.buildSuggestion(opportunity, options);
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Get handler state
   */
  getState(): {
    initialized: boolean;
    recentSuggestionsCount: number;
  } {
    return {
      initialized: this.initialized,
      recentSuggestionsCount: this.recentSuggestions.size
    };
  }
}

// Export singleton
export const proactiveEventHandler = new ProactiveEventHandler();
