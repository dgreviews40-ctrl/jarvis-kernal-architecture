/**
 * Contextual Greeting Service
 * Generates emotionally intelligent, time-aware greetings based on relationship history
 */

import { emotionalMemory, type EmotionalMoment, type TimeContext } from './emotionalMemory';
import { jarvisPersonality } from './jarvisPersonality';

export interface GreetingContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  timeContext: TimeContext;
  userMood: string;
  hasUnresolvedConcerns: boolean;
  significantMemory: EmotionalMoment | null;
  sessionCount: number;
}

export interface GreetingResult {
  greeting: string;
  tone: 'warm' | 'professional' | 'concerned' | 'celebratory' | 'casual';
  includesCheckIn: boolean;
  includesMemoryReference: boolean;
}

/**
 * Service for generating contextual, emotionally intelligent greetings
 */
export class ContextualGreetingService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await emotionalMemory.initialize();
    this.initialized = true;
  }

  /**
   * Generate a contextual greeting based on time, mood, and history
   */
  async generateGreeting(origin: 'voice' | 'text' = 'text'): Promise<GreetingResult> {
    await this.ensureInitialized();

    const context = await this.buildGreetingContext();
    const userName = jarvisPersonality.getUserName();
    const name = userName ? `, ${userName}` : '';

    // First-time user
    if (context.timeContext.sessionCount === 0 || context.timeContext.totalInteractions < 5) {
      return this.generateFirstTimeGreeting(name, origin);
    }

    // Returning after a gap
    if (context.timeContext.isReturningAfterGap) {
      return this.generateReturningGreeting(context, name, origin);
    }

    // Within the same session
    return this.generateSessionGreeting(context, name, origin);
  }

  /**
   * Build the context needed for greeting generation
   */
  private async buildGreetingContext(): Promise<GreetingContext> {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    
    const timeContext = emotionalMemory.getTimeContext();
    const mood = emotionalMemory.getCurrentMood();
    const hasUnresolvedConcerns = emotionalMemory.hasRecentConcern();
    const significantMemory = emotionalMemory.getSignificantMemoryToReference();

    return {
      timeOfDay,
      timeContext,
      userMood: mood.currentMood,
      hasUnresolvedConcerns,
      significantMemory,
      sessionCount: timeContext.sessionCount,
    };
  }

  /**
   * Generate greeting for first-time or new users
   */
  private generateFirstTimeGreeting(name: string, origin: 'voice' | 'text'): GreetingResult {
    const greetings = [
      `Welcome${name}! I'm JARVIS, your AI assistant. It's a pleasure to meet you.`,
      `Hello${name}! I'm JARVIS. I'm here to help you with whatever you need.`,
      `Good to meet you${name}! I'm JARVIS, and I'm looking forward to assisting you.`,
    ];

    // Voice gets shorter, warmer greetings
    if (origin === 'voice') {
      return {
        greeting: `Welcome${name}! I'm JARVIS. How can I help you today?`,
        tone: 'warm',
        includesCheckIn: false,
        includesMemoryReference: false,
      };
    }

    return {
      greeting: greetings[Math.floor(Math.random() * greetings.length)],
      tone: 'warm',
      includesCheckIn: false,
      includesMemoryReference: false,
    };
  }

  /**
   * Generate greeting for returning users after a gap
   */
  private generateReturningGreeting(
    context: GreetingContext,
    name: string,
    origin: 'voice' | 'text'
  ): GreetingResult {
    const timeOfDay = context.timeOfDay;
    const gap = context.timeContext.gapDuration || 'a while';
    const mood = context.userMood;
    
    // Build greeting components
    let greeting = '';
    let tone: GreetingResult['tone'] = 'warm';
    let includesCheckIn = false;
    let includesMemoryReference = false;

    // Time-appropriate opening
    const timeGreetings: Record<string, string[]> = {
      morning: [`Good morning${name}!`, `Morning${name}!`],
      afternoon: [`Good afternoon${name}!`, `Afternoon${name}!`],
      evening: [`Good evening${name}!`, `Evening${name}!`],
      night: [`Good evening${name}!`, `Hello${name}!`],
    };

    greeting = timeGreetings[timeOfDay][Math.floor(Math.random() * timeGreetings[timeOfDay].length)];

    // Acknowledge the gap
    const gapAcknowledgments = [
      `It's been ${gap}.`,
      `I haven't seen you for ${gap}.`,
      `Welcome back after ${gap}.`,
    ];

    if (origin === 'text' || gap.includes('day') || gap.includes('week')) {
      greeting += ' ' + gapAcknowledgments[Math.floor(Math.random() * gapAcknowledgments.length)];
    }

    // Add context based on mood or concerns
    if (context.hasUnresolvedConcerns) {
      const checkIns = [
        `I wanted to check in on you. How are things going?`,
        `I was thinking about our last conversation. How are you feeling now?`,
        `I've been wondering how you're doing. Is everything okay?`,
      ];
      greeting += ' ' + checkIns[Math.floor(Math.random() * checkIns.length)];
      tone = 'concerned';
      includesCheckIn = true;
    } else if (context.significantMemory && origin === 'text') {
      // Reference a significant memory
      const memoryRef = this.buildMemoryReference(context.significantMemory);
      if (memoryRef) {
        greeting += ' ' + memoryRef;
        includesMemoryReference = true;
      }
    } else if (mood === 'excited' || mood === 'happy') {
      const positiveFollowUps = [
        `You seem to be in good spirits! What's new?`,
        `I can tell something good is happening. Care to share?`,
        `It's great to see you! What can I help you with today?`,
      ];
      greeting += ' ' + positiveFollowUps[Math.floor(Math.random() * positiveFollowUps.length)];
      tone = 'celebratory';
    } else if (mood === 'frustrated' || mood === 'anxious') {
      const supportiveFollowUps = [
        `I hope things have been going better for you.`,
        `I'm here to help make things easier. What do you need?`,
        `Let me know how I can support you today.`,
      ];
      greeting += ' ' + supportiveFollowUps[Math.floor(Math.random() * supportiveFollowUps.length)];
      tone = 'concerned';
    } else {
      // Neutral follow-up
      const neutralFollowUps = [
        `How can I help you today?`,
        `What would you like to work on?`,
        `What can I do for you?`,
      ];
      greeting += ' ' + neutralFollowUps[Math.floor(Math.random() * neutralFollowUps.length)];
    }

    // Voice gets shorter version
    if (origin === 'voice' && greeting.length > 150) {
      greeting = greeting.substring(0, greeting.indexOf('.') + 1) + ' How can I help you today?';
    }

    return {
      greeting,
      tone,
      includesCheckIn,
      includesMemoryReference,
    };
  }

  /**
   * Generate greeting within the same session
   */
  private generateSessionGreeting(
    context: GreetingContext,
    name: string,
    origin: 'voice' | 'text'
  ): GreetingResult {
    // Within same session - keep it brief and casual
    const briefGreetings = [
      `Yes${name}?`,
      `I'm here${name}.`,
      `What else can I do${name}?`,
      `Go ahead${name}.`,
      `Listening${name}.`,
    ];

    const greeting = briefGreetings[Math.floor(Math.random() * briefGreetings.length)];

    return {
      greeting,
      tone: 'casual',
      includesCheckIn: false,
      includesMemoryReference: false,
    };
  }

  /**
   * Generate a specific follow-up about a previous concern
   */
  async generateConcernFollowUp(concern: EmotionalMoment): Promise<string> {
    const userName = jarvisPersonality.getUserName();
    const name = userName ? `, ${userName}` : '';
    
    const age = this.formatConcernAge(Date.now() - concern.timestamp);
    
    const followUps = [
      `${age} you mentioned you were dealing with "${concern.content}". How are things with that${name}?`,
      `I wanted to follow up${name}. ${age} you shared: "${concern.content}". Has that been resolved?`,
      `Checking in${name} - ${age} we talked about "${concern.content}". How are you feeling about it now?`,
    ];

    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  /**
   * Generate a celebratory reference to an achievement
   */
  generateAchievementReference(achievement: EmotionalMoment): string {
    const userName = jarvisPersonality.getUserName();
    const name = userName ? `, ${userName}` : '';
    
    const references = [
      `By the way${name}, I wanted to say again how impressed I was when you ${achievement.content}. That was great!`,
      `I was just thinking about your recent ${achievement.content}. You should be proud of that${name}!`,
      `${name}, I'm still thinking about how you ${achievement.content}. That was quite an achievement!`,
    ];

    return references[Math.floor(Math.random() * references.length)];
  }

  /**
   * Build a natural reference to a significant memory
   */
  private buildMemoryReference(memory: EmotionalMoment): string | null {
    const age = Date.now() - memory.timestamp;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    // Don't reference very old memories
    if (age > oneWeek * 2) return null;

    switch (memory.type) {
      case 'achievement':
        return this.generateAchievementReference(memory);
      
      case 'concern':
        if (!memory.resolved) {
          return `I wanted to check in - you mentioned ${memory.content}. How are things with that?`;
        }
        return null;
      
      case 'joy':
        return `I hope you're still feeling good after ${memory.content}!`;
      
      case 'milestone':
        return `I was thinking about how you ${memory.content}. That's still pretty significant!`;
      
      default:
        return null;
    }
  }

  /**
   * Get suggested response style based on user's current mood
   */
  getResponseStyleSuggestion(): {
    tone: string;
    pace: 'slower' | 'normal' | 'faster';
    formality: 'casual' | 'neutral' | 'formal';
    empathy: 'high' | 'normal' | 'low';
  } {
    const mood = emotionalMemory.getCurrentMood();

    switch (mood.currentMood) {
      case 'frustrated':
        return {
          tone: 'patient and supportive',
          pace: 'slower',
          formality: 'neutral',
          empathy: 'high',
        };
      
      case 'anxious':
        return {
          tone: 'calm and reassuring',
          pace: 'slower',
          formality: 'neutral',
          empathy: 'high',
        };
      
      case 'excited':
        return {
          tone: 'enthusiastic and energetic',
          pace: 'faster',
          formality: 'casual',
          empathy: 'normal',
        };
      
      case 'sad':
        return {
          tone: 'gentle and supportive',
          pace: 'slower',
          formality: 'neutral',
          empathy: 'high',
        };
      
      case 'grateful':
        return {
          tone: 'warm and appreciative',
          pace: 'normal',
          formality: 'neutral',
          empathy: 'normal',
        };
      
      case 'angry':
        return {
          tone: 'calm and professional',
          pace: 'slower',
          formality: 'neutral',
          empathy: 'high',
        };
      
      default:
        return {
          tone: 'friendly and helpful',
          pace: 'normal',
          formality: 'neutral',
          empathy: 'normal',
        };
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private formatConcernAge(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days === 0) return 'Earlier today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return 'Recently';
  }
}

// Singleton instance
export const contextualGreeting = new ContextualGreetingService();
