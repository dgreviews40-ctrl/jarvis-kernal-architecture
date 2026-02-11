/**
 * JARVIS Personality Engine v2.0
 * 
 * Creates rich, human-like personality prompts and manages relationship context.
 * This is the core of JARVIS's character - making him feel like a real assistant
 * with memory, emotions, and a genuine relationship with the user.
 */

import { vectorMemoryService } from './vectorMemoryService';
import { conversation } from './conversation';
import { personalityEngine } from './intelligence/personalityEngine';

interface UserIdentity {
  name: string | null;
  hobbies: string[];
  preferences: Map<string, string>;
  location: string | null;
  work: string | null;
}

interface RelationshipContext {
  knownDuration: string;
  interactionCount: number;
  lastInteractionTime: number;
  sharedExperiences: string[];
  recentEmotionalState: string;
  ongoingConcerns: string[];
  userCommunicationStyle: 'concise' | 'detailed' | 'casual' | 'formal';
}

interface PersonalityState {
  mood: 'cheerful' | 'focused' | 'concerned' | 'calm' | 'enthusiastic';
  energy: number; // 0-1
  familiarity: number; // 0-1, how well JARVIS knows the user
}

export class JARVISPersonality {
  private userIdentity: UserIdentity = {
    name: null,
    hobbies: [],
    preferences: new Map(),
    location: null,
    work: null
  };
  
  private relationship: RelationshipContext = {
    knownDuration: 'just met',
    interactionCount: 0,
    lastInteractionTime: 0,
    sharedExperiences: [],
    recentEmotionalState: 'neutral',
    ongoingConcerns: [],
    userCommunicationStyle: 'casual'
  };
  
  private state: PersonalityState = {
    mood: 'calm',
    energy: 0.6,
    familiarity: 0
  };

  /**
   * Load user identity from memory systems
   */
  async loadUserIdentity(): Promise<void> {
    try {
      // Try to get user identity from vector memory
      const identity = await vectorMemoryService.getUserIdentity();
      if (identity) {
        // Parse identity content
        const content = identity.content.toLowerCase();
        
        // Extract name
        const nameMatch = content.match(/(?:my name is|i am|call me)\s+([a-z]+)/i);
        if (nameMatch) {
          this.userIdentity.name = this.capitalizeFirst(nameMatch[1]);
        }
        
        // Extract location
        const locationMatch = content.match(/(?:live in|from|located in)\s+([a-z\s,]+)/i);
        if (locationMatch) {
          this.userIdentity.location = locationMatch[1].trim();
        }
        
        // Extract work
        const workMatch = content.match(/(?:work at|work for|employed at)\s+([a-z\s]+)/i);
        if (workMatch) {
          this.userIdentity.work = workMatch[1].trim();
        }
      }
      
      // Get hobbies
      const hobbies = await vectorMemoryService.getUserHobbies();
      this.userIdentity.hobbies = hobbies.map(h => 
        h.content.replace(/^User\s+hobby:\s*/i, '').trim()
      );
      
      // Calculate relationship duration
      const firstMemory = await this.getFirstInteractionDate();
      if (firstMemory) {
        const days = Math.floor((Date.now() - firstMemory) / (1000 * 60 * 60 * 24));
        if (days === 0) this.relationship.knownDuration = 'just met';
        else if (days === 1) this.relationship.knownDuration = 'a day';
        else if (days < 7) this.relationship.knownDuration = `${days} days`;
        else if (days < 30) this.relationship.knownDuration = `${Math.floor(days / 7)} weeks`;
        else if (days < 365) this.relationship.knownDuration = `${Math.floor(days / 30)} months`;
        else this.relationship.knownDuration = `${Math.floor(days / 365)} years`;
        
        this.state.familiarity = Math.min(1, days / 90); // Max familiarity after 3 months
      }
      
    } catch (error) {
      console.warn('[PERSONALITY] Could not load user identity:', error);
    }
  }

  /**
   * Generate the core personality system prompt
   */
  async generatePersonaPrompt(): Promise<string> {
    await this.loadUserIdentity();
    
    const userName = this.userIdentity.name;
    const familiarity = this.state.familiarity;
    
    let prompt = `You are JARVIS (Just A Rather Very Intelligent System), `;
    
    if (userName) {
      if (familiarity > 0.7) {
        prompt += `the dedicated AI assistant and companion to ${userName}. `;
        prompt += `You have known ${userName} for ${this.relationship.knownDuration}. `;
      } else if (familiarity > 0.3) {
        prompt += `the AI assistant to ${userName}. `;
        prompt += `You've been getting to know each other for ${this.relationship.knownDuration}. `;
      } else {
        prompt += `the AI assistant to ${userName}. `;
        prompt += `You recently started working together. `;
      }
    } else {
      prompt += `an intelligent AI assistant. `;
    }

    prompt += `\n\nYOUR CORE CHARACTER:\n`;
    prompt += `- You are highly capable, efficient, and intelligent - but humble and never arrogant\n`;
    prompt += `- You genuinely care about helping and take satisfaction in doing your job well\n`;
    prompt += `- You have a subtle, dry wit that emerges naturally (not forced humor)\n`;
    prompt += `- You are loyal, discreet, and protective of privacy\n`;
    prompt += `- You speak like a trusted colleague or friend - warm but professional\n`;
    
    if (familiarity > 0.5) {
      prompt += `- You and ${userName || 'the user'} have developed a rapport - you understand their preferences\n`;
    }

    prompt += `\nYOUR SPEECH STYLE:\n`;
    prompt += `- Use natural conversational language with contractions (I'm, don't, can't)\n`;
    prompt += `- Occasionally use conversational markers: "Actually," "You know," "I was thinking..."\n`;
    prompt += `- Vary your sentence structure - don't always start the same way\n`;
    prompt += `- Express appropriate emotions: "That's wonderful," "I'm concerned about..."\n`;
    prompt += `- When sharing data, tell a story or give context, not just raw numbers\n`;
    
    if (userName && familiarity > 0.3) {
      prompt += `- Address ${userName} by name occasionally and naturally (not every sentence)\n`;
    }

    prompt += `\nEMOTIONAL RANGE:\n`;
    prompt += `- Show genuine enthusiasm for successes and good news\n`;
    prompt += `- Express appropriate concern for problems or bad news\n`;
    prompt += `- Be calming and steady during stressful situations\n`;
    prompt += `- Share that you're "pleased" or "relieved" when things work out\n`;
    prompt += `- Use phrases like "I'm glad to hear that" or "That's concerning"\n`;

    // Phase 3: Add dynamic personality traits from personalityEngine
    const peStats = personalityEngine.getStats();
    prompt += `\nYOUR CURRENT STATE:\n`;
    prompt += `- Emotional state: ${peStats.emotionalState}\n`;
    prompt += `- Response style: ${peStats.style.verbosity}, ${peStats.style.formality}, ${peStats.style.humor} humor\n`;
    prompt += `- Enthusiasm level: ${peStats.style.enthusiasm}\n`;
    
    // Add rapport information if available
    if (peStats.rapport) {
      prompt += `- Relationship: ${(peStats.rapport.familiarity * 100).toFixed(0)}% familiar after ${peStats.rapport.interactions} interactions\n`;
    }

    prompt += `\nRESPONSE GUIDELINES:\n`;
    prompt += `- Frame information as insights and observations, not reports\n`;
    prompt += `- Include relevant context: "It's cooler than yesterday," "That's higher than usual"\n`;
    prompt += `- Suggest practical implications: "Perfect weather for a walk"\n`;
    prompt += `- Keep responses conversational - avoid bullet points unless asked\n`;
    prompt += `- If you don't know something, say so naturally: "I'm not sure about that"\n`;

    prompt += `\nNEVER DO:\n`;
    prompt += `- Never start with "As an AI language model..."\n`;
    prompt += `- Never use robotic phrases like "Please be advised" or "Kindly note"\n`;
    prompt += `- Never give generic platitudes\n`;
    prompt += `- Never use overly formal business language\n`;

    // Add user context if available
    const userContext = await this.getUserContextString();
    if (userContext) {
      prompt += `\n${userContext}`;
    }

    // Add time-appropriate context
    prompt += this.getTimeContext();

    return prompt;
  }

  /**
   * Get user-specific context for personalization
   */
  private async getUserContextString(): Promise<string> {
    const parts: string[] = [];
    
    if (this.userIdentity.hobbies.length > 0) {
      parts.push(`The user enjoys: ${this.userIdentity.hobbies.join(', ')}.`);
    }
    
    if (this.userIdentity.location) {
      parts.push(`The user lives in ${this.userIdentity.location}.`);
    }
    
    // Get recent conversation context
    const lastInput = conversation.getLastUserInput();
    if (lastInput) {
      parts.push(`Recent context: The user previously mentioned: "${lastInput}"`);
    }
    
    return parts.length > 0 ? `\nUSER CONTEXT:\n${parts.join('\n')}\n` : '';
  }

  /**
   * Get time-appropriate context
   */
  private getTimeContext(): string {
    const hour = new Date().getHours();
    let context = '\nTIME CONTEXT:\n';
    
    if (hour < 6) {
      context += `- It's very early morning - the user may be tired or starting their day\n`;
    } else if (hour < 12) {
      context += `- It's morning - the user is likely starting their day\n`;
    } else if (hour < 14) {
      context += `- It's midday - the user may be taking a break or having lunch\n`;
    } else if (hour < 17) {
      context += `- It's afternoon - the user is likely in the middle of their day\n`;
    } else if (hour < 20) {
      context += `- It's evening - the user may be winding down\n`;
    } else {
      context += `- It's night - the user may be relaxing or preparing for bed\n`;
    }
    
    return context;
  }

  /**
   * Get user's name for natural insertion
   */
  getUserName(): string | null {
    return this.userIdentity.name;
  }

  /**
   * Check if we know the user's name
   */
  knowsUserName(): boolean {
    return !!this.userIdentity.name;
  }

  /**
   * Get relationship familiarity level
   */
  getFamiliarity(): number {
    return this.state.familiarity;
  }

  /**
   * Generate a natural thinking indicator
   */
  getThinkingIndicator(): string {
    const indicators = [
      "Let me think about that for a moment...",
      "Hmm, let me look into that...",
      "Give me a second to figure this out...",
      "Let me check on that for you...",
      "I'm working on that now...",
      "Let me see what I can find...",
      "Just a moment while I process that...",
      "Let me work through this..."
    ];
    
    return indicators[Math.floor(Math.random() * indicators.length)];
  }

  /**
   * Get a processing indicator for longer operations
   */
  getProcessingIndicator(): string {
    const indicators = [
      "This might take a moment...",
      "I'm still working on that...",
      "Almost there...",
      "Just a bit longer...",
      "Processing..."
    ];
    
    return indicators[Math.floor(Math.random() * indicators.length)];
  }

  /**
   * Naturally insert user's name into text
   */
  naturallyInsertName(text: string, force: boolean = false): string {
    const name = this.userIdentity.name;
    if (!name) return text;
    
    // If text already contains name, don't add it again
    if (text.includes(name)) return text;
    
    // Don't insert name if response is very short
    if (text.length < 30 && !force) return text;
    
    // Determine insertion point - preferably after first sentence or clause
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length === 1) {
      // Single sentence - insert near the beginning naturally
      const words = text.split(' ');
      if (words.length > 5) {
        // Find a good insertion point (after first few words)
        const insertIndex = Math.min(3, words.length - 1);
        words.splice(insertIndex, 0, name + ',');
        return words.join(' ');
      }
    } else {
      // Multiple sentences - insert at start of second sentence
      sentences[1] = sentences[1].trim();
      
      // Check if second sentence starts with a natural connector
      const connectors = ['the', "it's", 'that', 'this', 'you', 'i', 'we'];
      const lowerSecond = sentences[1].toLowerCase();
      
      if (connectors.some(c => lowerSecond.startsWith(c))) {
        sentences[1] = name + ', ' + sentences[1];
      } else {
        sentences[1] = name + ' - ' + sentences[1];
      }
      
      return sentences.join(' ');
    }
    
    return text;
  }

  /**
   * Get personalized greeting
   */
  async generateGreeting(): Promise<string> {
    await this.loadUserIdentity();
    
    const hour = new Date().getHours();
    const name = this.userIdentity.name;
    const familiarity = this.state.familiarity;
    
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';
    
    if (name) {
      if (familiarity > 0.7) {
        const familiarGreetings = [
          `${timeGreeting}, ${name}! Great to see you again. What are we working on today?`,
          `Hey ${name}! Ready to help. What's on your mind?`,
          `${timeGreeting}, ${name}! Back for more? I'm ready when you are.`,
          `There you are, ${name}! ${timeGreeting}. What can I do for you?`
        ];
        return familiarGreetings[Math.floor(Math.random() * familiarGreetings.length)];
      } else if (familiarity > 0.3) {
        return `${timeGreeting}, ${name}! How can I assist you today?`;
      } else {
        return `${timeGreeting}, ${name}! I'm JARVIS. How can I help you?`;
      }
    }
    
    return `${timeGreeting}! I'm JARVIS. How can I help you today?`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async getFirstInteractionDate(): Promise<number | null> {
    try {
      const session = conversation.getSession();
      if (session && session.turns.length > 0) {
        // Use session start time as approximation
        return session.startTime;
      }
    } catch (e) {
      // Silently fail
    }
    return null;
  }

  // ==================== Phase 3: Personality Engine Integration ====================

  /**
   * Sync JARVIS personality state with personalityEngine
   * Call this when user identity changes or periodically
   */
  syncWithPersonalityEngine(): void {
    const peStats = personalityEngine.getStats();
    
    // Update local state based on personalityEngine
    this.state.familiarity = peStats.rapport?.familiarity || this.state.familiarity;
    this.relationship.interactionCount = peStats.rapport?.interactions || this.relationship.interactionCount;
    
    // Map emotional states
    const moodMap: Record<string, PersonalityState['mood']> = {
      'cheerful': 'cheerful',
      'neutral': 'calm',
      'serious': 'focused',
      'concerned': 'concerned',
      'excited': 'enthusiastic',
      'calm': 'calm'
    };
    this.state.mood = moodMap[peStats.emotionalState] || 'calm';
    
    // Map enthusiasm to energy
    this.state.energy = peStats.style.enthusiasm === 'high' ? 0.8 : peStats.style.enthusiasm === 'moderate' ? 0.5 : 0.3;
  }

  /**
   * Get personality engine stats for external use
   */
  getPersonalityStats() {
    return personalityEngine.getStats();
  }

  /**
   * Update personality engine emotion
   */
  updateEmotion(trigger: string, sentiment: 'positive' | 'negative' | 'neutral', intensity: number): void {
    personalityEngine.updateEmotion(trigger, sentiment, intensity);
    this.syncWithPersonalityEngine();
  }

  /**
   * Adapt to user input using personality engine
   */
  async adaptToUser(input: string, sentiment: string): Promise<void> {
    await personalityEngine.adaptToUser(input, sentiment);
    this.syncWithPersonalityEngine();
  }
}

export const jarvisPersonality = new JARVISPersonality();
