/**
 * Conversation Flow Manager
 * 
 * Manages the flow and structure of conversations:
 * - Turn-taking management
 * - Conversation state tracking
 * - Graceful interruptions
 * - Topic transitions
 * - Conversation recovery
 */

import { ConversationTurn } from "../../types";
import { conversationalContext } from "./conversationalContext";
import { personalityEngine } from "./personalityEngine";
import { naturalResponse } from "./naturalResponse";

interface FlowState {
  stage: 'opening' | 'exploration' | 'deepening' | 'resolution' | 'closing';
  userEngagement: 'high' | 'medium' | 'low';
  conversationDepth: number;
  lastTopicChange: number;
  turnCount: number;
  silenceDuration: number;
}

interface Transition {
  from: FlowState['stage'];
  to: FlowState['stage'];
  trigger: string;
  handler: () => string;
}

interface PendingAction {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: number;
}

export class ConversationFlowManager {
  private state: FlowState;
  private pendingActions: Map<string, PendingAction> = new Map();
  private topicStack: string[] = [];
  private lastUserInput: string = '';
  private lastResponse: string = '';
  private interruptionContext: {
    wasInterrupted: boolean;
    interruptedAt: number;
    resumePoint?: string;
  } = { wasInterrupted: false, interruptedAt: 0 };

  private readonly ENGAGEMENT_THRESHOLD_HIGH = 0.7;
  private readonly ENGAGEMENT_THRESHOLD_LOW = 0.3;
  private readonly TOPIC_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.state = {
      stage: 'opening',
      userEngagement: 'medium',
      conversationDepth: 0,
      lastTopicChange: Date.now(),
      turnCount: 0,
      silenceDuration: 0
    };
  }

  /**
   * Process a new turn in the conversation
   */
  processTurn(userInput: string, currentTurns: ConversationTurn[]): {
    response: string;
    state: FlowState;
    suggestions: string[];
    shouldFollowUp: boolean;
  } {
    this.lastUserInput = userInput;
    this.state.turnCount++;

    // Analyze engagement
    this.updateEngagement(userInput, currentTurns);

    // Check for topic change
    this.detectTopicChange(userInput);

    // Determine appropriate response strategy
    const strategy = this.determineResponseStrategy();

    // Generate response based on strategy
    const response = this.generateStrategicResponse(userInput, strategy);
    this.lastResponse = response;

    // Update conversation stage
    this.updateStage();

    // Generate follow-up suggestions
    const suggestions = this.generateSuggestions();

    return {
      response,
      state: { ...this.state },
      suggestions,
      shouldFollowUp: this.shouldFollowUp()
    };
  }

  /**
   * Update user engagement level
   */
  private updateEngagement(userInput: string, turns: ConversationTurn[]): void {
    let engagementScore = 0.5;

    // Input length indicates engagement
    if (userInput.length > 100) engagementScore += 0.2;
    else if (userInput.length < 20) engagementScore -= 0.1;

    // Questions indicate engagement
    const questionCount = (userInput.match(/\?/g) || []).length;
    engagementScore += questionCount * 0.1;

    // Follow-up references indicate engagement
    const followUpWords = ['and', 'also', 'additionally', 'moreover', 'furthermore'];
    if (followUpWords.some(w => userInput.toLowerCase().includes(w))) {
      engagementScore += 0.15;
    }

    // Short responses might indicate low engagement
    const shortResponses = ['ok', 'okay', 'sure', 'fine', 'whatever', 'k'];
    if (shortResponses.some(r => userInput.toLowerCase().trim() === r)) {
      engagementScore -= 0.2;
    }

    // Check conversation history trend
    const recentTurns = turns.slice(-3);
    const userRecentInputs = recentTurns.filter(t => t.speaker === 'USER');
    if (userRecentInputs.length >= 2) {
      const avgLength = userRecentInputs.reduce((sum, t) => sum + t.text.length, 0) / userRecentInputs.length;
      if (avgLength < 30) engagementScore -= 0.1;
      if (avgLength > 80) engagementScore += 0.1;
    }

    // Update state
    if (engagementScore >= this.ENGAGEMENT_THRESHOLD_HIGH) {
      this.state.userEngagement = 'high';
    } else if (engagementScore <= this.ENGAGEMENT_THRESHOLD_LOW) {
      this.state.userEngagement = 'low';
    } else {
      this.state.userEngagement = 'medium';
    }

    // Track conversation depth
    this.state.conversationDepth = turns.filter(t => t.speaker === 'USER').length;
  }

  /**
   * Detect if user is changing topics
   */
  private detectTopicChange(userInput: string): boolean {
    const topicChangeIndicators = [
      'anyway', 'by the way', 'speaking of', 'that reminds me',
      'changing subject', 'on another note', 'moving on',
      'let\'s talk about', 'what about', 'how about'
    ];

    const lowerInput = userInput.toLowerCase();
    const isTopicChange = topicChangeIndicators.some(indicator => 
      lowerInput.includes(indicator)
    );

    if (isTopicChange) {
      this.state.lastTopicChange = Date.now();
      this.topicStack.push(userInput.substring(0, 50));
      if (this.topicStack.length > 5) this.topicStack.shift();
      return true;
    }

    return false;
  }

  /**
   * Determine response strategy based on state
   */
  private determineResponseStrategy(): {
    type: 'direct' | 'exploratory' | 'clarifying' | 'concluding' | 're-engaging';
    tone: 'enthusiastic' | 'neutral' | 'supportive' | 'concise';
  } {
    // Low engagement - try to re-engage
    if (this.state.userEngagement === 'low') {
      return { type: 're-engaging', tone: 'enthusiastic' };
    }

    // High engagement with depth - exploratory
    if (this.state.userEngagement === 'high' && this.state.conversationDepth > 3) {
      return { type: 'exploratory', tone: 'enthusiastic' };
    }

    // Opening stage - direct and helpful
    if (this.state.stage === 'opening') {
      return { type: 'direct', tone: 'neutral' };
    }

    // Closing stage - concluding
    if (this.state.stage === 'closing') {
      return { type: 'concluding', tone: 'supportive' };
    }

    // Default
    return { type: 'direct', tone: 'neutral' };
  }

  /**
   * Generate response based on strategy
   */
  private generateStrategicResponse(userInput: string, strategy: {
    type: 'direct' | 'exploratory' | 'clarifying' | 'concluding' | 're-engaging';
    tone: 'enthusiastic' | 'neutral' | 'supportive' | 'concise';
  }): string {
    // This would integrate with the AI response
    // For now, return strategic guidance
    return `[${strategy.type.toUpperCase()}|${strategy.tone.toUpperCase()}]`;
  }

  /**
   * Update conversation stage
   */
  private updateStage(): void {
    const userTurns = this.state.conversationDepth;

    switch (this.state.stage) {
      case 'opening':
        if (userTurns > 2) {
          this.state.stage = 'exploration';
        }
        break;

      case 'exploration':
        if (userTurns > 5 && this.state.userEngagement === 'high') {
          this.state.stage = 'deepening';
        } else if (this.state.userEngagement === 'low') {
          this.state.stage = 'resolution';
        }
        break;

      case 'deepening':
        if (this.state.userEngagement === 'low' || userTurns > 10) {
          this.state.stage = 'resolution';
        }
        break;

      case 'resolution':
        if (userTurns > 12 || this.state.userEngagement === 'low') {
          this.state.stage = 'closing';
        }
        break;
    }
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    switch (this.state.stage) {
      case 'opening':
        suggestions.push('What can I help you with today?');
        break;

      case 'exploration':
        if (this.state.userEngagement === 'high') {
          suggestions.push('Would you like to explore this topic further?');
          suggestions.push('Is there a specific aspect you\'re most interested in?');
        }
        break;

      case 'deepening':
        suggestions.push('Shall I look into related topics?');
        suggestions.push('Would you like me to save this information for later?');
        break;

      case 'resolution':
        suggestions.push('Does this answer your question?');
        suggestions.push('Is there anything else you\'d like to know?');
        break;
    }

    // Add engagement-based suggestions
    if (this.state.userEngagement === 'low') {
      suggestions.push('Would you prefer a different approach?');
      suggestions.push('Should we try something else?');
    }

    return suggestions.slice(0, 2);
  }

  /**
   * Determine if follow-up is appropriate
   */
  private shouldFollowUp(): boolean {
    return this.state.userEngagement === 'high' && 
           this.state.stage !== 'closing' &&
           this.state.turnCount % 3 === 0;
  }

  /**
   * Handle interruption gracefully
   */
  handleInterruption(): {
    acknowledgment: string;
    saveContext: boolean;
    resumePoint?: string;
  } {
    this.interruptionContext = {
      wasInterrupted: true,
      interruptedAt: Date.now(),
      resumePoint: this.lastResponse
    };

    const acknowledgments = [
      "I'll pause there.",
      "No problem, stopping now.",
      "Understood, I'll wait.",
      "Got it, take your time."
    ];

    return {
      acknowledgment: acknowledgments[Math.floor(Math.random() * acknowledgments.length)],
      saveContext: true,
      resumePoint: this.lastResponse
    };
  }

  /**
   * Resume after interruption
   */
  resumeAfterInterruption(): {
    shouldResume: boolean;
    resumeMessage?: string;
    context?: string;
  } {
    if (!this.interruptionContext.wasInterrupted) {
      return { shouldResume: false };
    }

    const timeSinceInterruption = Date.now() - this.interruptionContext.interruptedAt;
    
    // Only resume if within reasonable time
    if (timeSinceInterruption > 60000) { // 1 minute
      this.interruptionContext.wasInterrupted = false;
      return { shouldResume: false };
    }

    const resumeMessages = [
      "To continue where I left off...",
      "As I was saying...",
      "Picking up from before...",
      "To finish my thought..."
    ];

    const context = this.interruptionContext.resumePoint;
    this.interruptionContext.wasInterrupted = false;

    return {
      shouldResume: true,
      resumeMessage: resumeMessages[Math.floor(Math.random() * resumeMessages.length)],
      context
    };
  }

  /**
   * Manage turn-taking
   */
  shouldYieldTurn(userInput: string): boolean {
    // Yield if user asks a question
    if (userInput.includes('?')) return true;

    // Yield if user seems to want to continue
    const continuationWords = ['and', 'also', 'plus', 'additionally'];
    if (continuationWords.some(w => userInput.toLowerCase().endsWith(w))) {
      return false; // Don't yield, user wants to continue
    }

    // Yield if input is complete sentence
    const endsWithPunctuation = /[.!?]$/.test(userInput.trim());
    if (endsWithPunctuation && userInput.length > 30) {
      return true;
    }

    return true; // Default to yielding
  }

  /**
   * Add pending action for follow-up
   */
  addPendingAction(description: string, priority: 'high' | 'medium' | 'low' = 'medium', deadline?: number): string {
    const id = `action_${Date.now()}`;
    this.pendingActions.set(id, {
      id,
      description,
      priority,
      deadline
    });
    return id;
  }

  /**
   * Complete a pending action
   */
  completePendingAction(actionId: string): boolean {
    return this.pendingActions.delete(actionId);
  }

  /**
   * Get pending actions
   */
  getPendingActions(): PendingAction[] {
    return Array.from(this.pendingActions.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Generate topic transition
   */
  generateTopicTransition(newTopic: string): string {
    const transitions = [
      `Speaking of which, ${newTopic}`,
      `That reminds me, ${newTopic}`,
      `On a related note, ${newTopic}`,
      `By the way, ${newTopic}`,
      `Shifting gears a bit, ${newTopic}`
    ];

    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  /**
   * Check if conversation is stale
   */
  isConversationStale(): boolean {
    const timeSinceLastTopic = Date.now() - this.state.lastTopicChange;
    return timeSinceLastTopic > this.TOPIC_TIMEOUT_MS && this.state.userEngagement === 'low';
  }

  /**
   * Generate re-engagement attempt
   */
  generateReengagement(): string {
    const attempts = [
      "I notice we haven't talked in a bit. Is there anything else I can help you with?",
      "Just checking in - do you need assistance with anything?",
      "I'm here if you have any other questions!",
      "Feel free to ask if something comes up."
    ];

    return attempts[Math.floor(Math.random() * attempts.length)];
  }

  /**
   * Get conversation summary
   */
  getSummary(): {
    stage: string;
    engagement: string;
    depth: number;
    topics: string[];
    pendingActions: number;
  } {
    return {
      stage: this.state.stage,
      engagement: this.state.userEngagement,
      depth: this.state.conversationDepth,
      topics: [...this.topicStack],
      pendingActions: this.pendingActions.size
    };
  }

  /**
   * Reset conversation flow
   */
  reset(): void {
    this.state = {
      stage: 'opening',
      userEngagement: 'medium',
      conversationDepth: 0,
      lastTopicChange: Date.now(),
      turnCount: 0,
      silenceDuration: 0
    };
    this.pendingActions.clear();
    this.topicStack = [];
    this.interruptionContext = { wasInterrupted: false, interruptedAt: 0 };
  }
}

export const conversationFlow = new ConversationFlowManager();
