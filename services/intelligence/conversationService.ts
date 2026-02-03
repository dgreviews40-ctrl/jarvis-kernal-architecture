/**
 * Conversation Service
 * 
 * Consolidated from:
 * - conversationalContext.ts (topic extraction, thread management)
 * - personalityEngine.ts (emotional state, personality adaptation)
 * - naturalResponse.ts (response generation)
 * 
 * Provides: Context awareness, personality, natural language generation
 */

import { ConversationTurn, Topic } from '../../types';

// ==================== TYPES ====================

interface ConversationThread {
  id: string;
  topic: string;
  summary: string;
  turns: string[];
  lastActive: number;
}

interface EmotionalState {
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
  dominance: number; // 0 to 1 (submissive to dominant)
}

interface PersonalityProfile {
  emotionalState: EmotionalState;
  style: {
    verbosity: 'concise' | 'moderate' | 'verbose';
    formality: 'casual' | 'neutral' | 'formal';
    humor: number; // 0 to 1
  };
  userPreferences: Map<string, number>; // preference -> score
}

// ==================== STATE ====================

class ConversationService {
  private threads: Map<string, ConversationThread> = new Map();
  private currentThreadId: string | null = null;
  private topics: Map<string, Topic> = new Map();
  private personality: PersonalityProfile = {
    emotionalState: { valence: 0, arousal: 0.3, dominance: 0.5 },
    style: { verbosity: 'moderate', formality: 'neutral', humor: 0.3 },
    userPreferences: new Map()
  };
  private currentUser: string | null = null;
  private conversationCount: number = 0;

  // ==================== TOPIC & CONTEXT ====================

  async extractTopics(text: string): Promise<Topic[]> {
    const topics: Topic[] = [];
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based topic extraction
    const topicPatterns: Record<string, string[]> = {
      'Home Automation': ['light', 'temperature', 'thermostat', 'switch', 'sensor', 'automation'],
      'System': ['status', 'health', 'performance', 'cpu', 'memory', 'error'],
      'Information': ['what', 'how', 'why', 'when', 'who', 'explain', 'tell me'],
      'Entertainment': ['music', 'play', 'movie', 'video', 'joke', 'fun'],
      'Productivity': ['reminder', 'schedule', 'task', 'note', 'calendar', 'timer']
    };

    Object.entries(topicPatterns).forEach(([name, keywords]) => {
      const relevance = keywords.reduce((score, keyword) => {
        return lowerText.includes(keyword) ? score + 0.2 : score;
      }, 0);
      
      if (relevance > 0) {
        topics.push({
          name,
          relevance: Math.min(relevance, 1),
          lastActive: Date.now()
        });
      }
    });

    // Store topics
    topics.forEach(t => this.topics.set(t.name, t));
    
    return topics.sort((a, b) => b.relevance - a.relevance);
  }

  async manageThread(turn: ConversationTurn, topics: Topic[]): Promise<void> {
    const mainTopic = topics[0]?.name || 'General';
    
    // Find or create thread
    let thread = Array.from(this.threads.values()).find(t => t.topic === mainTopic);
    
    if (!thread) {
      thread = {
        id: `thread_${Date.now()}`,
        topic: mainTopic,
        summary: `${mainTopic} discussion`,
        turns: [],
        lastActive: Date.now()
      };
      this.threads.set(thread.id, thread);
    }
    
    thread.turns.push(turn.id);
    thread.lastActive = Date.now();
    this.currentThreadId = thread.id;
  }

  getEnrichedContext(recentTurns: ConversationTurn[]): {
    recentTurns: ConversationTurn[];
    activeTopics: Topic[];
    currentThread?: ConversationThread;
    sentiment: string;
  } {
    const activeTopics = Array.from(this.topics.values())
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, 3);
    
    const currentThread = this.currentThreadId 
      ? this.threads.get(this.currentThreadId) 
      : undefined;

    return {
      recentTurns: recentTurns.slice(-5),
      activeTopics,
      currentThread,
      sentiment: this.getSentimentLabel()
    };
  }

  // ==================== PERSONALITY ====================

  setCurrentUser(userId: string): void {
    this.currentUser = userId;
  }

  updateEmotion(source: string, sentiment: 'positive' | 'negative' | 'neutral', intensity: number): void {
    const targetValence = sentiment === 'positive' ? 0.5 : sentiment === 'negative' ? -0.5 : 0;
    
    // Gradual emotional shift
    this.personality.emotionalState.valence = 
      this.personality.emotionalState.valence * 0.7 + targetValence * 0.3;
    this.personality.emotionalState.arousal = 
      Math.min(1, this.personality.emotionalState.arousal + intensity * 0.1);
  }

  async adaptToUser(input: string, sentiment: string): Promise<void> {
    const lowerInput = input.toLowerCase();
    
    // Adapt verbosity based on input length
    if (input.length < 20) {
      this.personality.style.verbosity = 'concise';
    } else if (input.length > 100) {
      this.personality.style.verbosity = 'verbose';
    }
    
    // Adapt formality
    const casualWords = ['hey', 'hi', 'yo', 'lol', 'haha', 'cool', 'nice'];
    const formalWords = ['hello', 'please', 'would', 'could', 'thank you', 'regards'];
    
    const casualCount = casualWords.filter(w => lowerInput.includes(w)).length;
    const formalCount = formalWords.filter(w => lowerInput.includes(w)).length;
    
    if (casualCount > formalCount) {
      this.personality.style.formality = 'casual';
    } else if (formalCount > casualCount) {
      this.personality.style.formality = 'formal';
    }
    
    // Track preferences
    const words = lowerInput.split(/\s+/);
    words.forEach(word => {
      if (word.length > 3) {
        const current = this.personality.userPreferences.get(word) || 0;
        this.personality.userPreferences.set(word, current + 1);
      }
    });
  }

  getPersonalityPrompt(): string {
    const { emotionalState, style } = this.personality;
    
    let prompt = `\n\nYour personality traits:\n`;
    prompt += `- Emotional state: ${this.getSentimentLabel()}\n`;
    prompt += `- Communication style: ${style.verbosity}, ${style.formality}\n`;
    
    if (style.humor > 0.5) {
      prompt += `- Use light humor when appropriate\n`;
    }
    
    return prompt;
  }

  generateGreeting(): string {
    const hour = new Date().getHours();
    const { formality } = this.personality.style;
    
    if (formality === 'casual') {
      if (hour < 12) return "Morning! Ready to get stuff done?";
      if (hour < 18) return "Hey there! What's on the agenda?";
      return "Evening! Burning the midnight oil?";
    } else {
      if (hour < 12) return "Good morning. I am online and ready to assist.";
      if (hour < 18) return "Good afternoon. How may I be of service?";
      return "Good evening. I await your instructions.";
    }
  }

  // ==================== RESPONSE GENERATION ====================

  generateResponse(rawResponse: string, options: {
    addOpening?: boolean;
    addClosing?: boolean;
    tone?: string;
  } = {}): string {
    const { addOpening = false, addClosing = false, tone = 'neutral' } = options;
    
    let response = rawResponse;
    
    // Add opening if requested
    if (addOpening) {
      const openings = this.getOpenings(tone);
      response = `${openings[Math.floor(Math.random() * openings.length)]} ${response}`;
    }
    
    // Add closing if requested
    if (addClosing) {
      const closings = this.getClosings(tone);
      response = `${response} ${closings[Math.floor(Math.random() * closings.length)]}`;
    }
    
    return response;
  }

  private getOpenings(tone: string): string[] {
    const openings: Record<string, string[]> = {
      positive: ["Great!", "Excellent.", "Perfect!"],
      negative: ["I see.", "Understood.", "Noted."],
      neutral: ["", "Alright.", "Okay."]
    };
    return openings[tone] || openings.neutral;
  }

  private getClosings(tone: string): string[] {
    const closings: Record<string, string[]> = {
      positive: ["Let me know if you need anything else!", "Happy to help!"],
      negative: ["Is there anything else I can assist with?", "Let me know if the issue persists."],
      neutral: ["", "Anything else?"]
    };
    return closings[tone] || closings.neutral;
  }

  // ==================== HELPERS ====================

  private getSentimentLabel(): string {
    const valence = this.personality.emotionalState.valence;
    if (valence > 0.3) return 'positive';
    if (valence < -0.3) return 'negative';
    return 'neutral';
  }

  clearContext(): void {
    this.threads.clear();
    this.topics.clear();
    this.currentThreadId = null;
  }

  resetPersonality(): void {
    this.personality = {
      emotionalState: { valence: 0, arousal: 0.3, dominance: 0.5 },
      style: { verbosity: 'moderate', formality: 'neutral', humor: 0.3 },
      userPreferences: new Map()
    };
    this.conversationCount = 0;
  }

  getStats(): {
    threads: number;
    topics: number;
    emotionalState: string;
    style: typeof this.personality.style;
  } {
    return {
      threads: this.threads.size,
      topics: this.topics.size,
      emotionalState: this.getSentimentLabel(),
      style: this.personality.style
    };
  }
}

export const conversationService = new ConversationService();
