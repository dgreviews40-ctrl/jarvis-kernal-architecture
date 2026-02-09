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
    engagement: number; // 0 to 1 - how engaged JARVIS is in conversation
    empathy: number; // 0 to 1 - how empathetic JARVIS is
  };
  userPreferences: Map<string, number>; // preference -> score
}

// ==================== STATE ====================

class ConversationService {
  private threads: Map<string, ConversationThread> = new Map();
  private currentThreadId: string | null = null;
  private topics: Map<string, Topic> = new Map();
  private personality: PersonalityProfile = {
    emotionalState: { valence: 0.2, arousal: 0.4, dominance: 0.5 }, // More positive baseline
    style: { verbosity: 'moderate', formality: 'casual', humor: 0.4, engagement: 0.7, empathy: 0.6 },
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
          id: `topic_${name}_${Date.now()}`,
          name,
          keywords: [name],
          startTime: Date.now(),
          relevance: Math.min(relevance, 1),
          lastActive: Date.now(),
          turnCount: 1
        });
      }
    });

    // Store topics
    topics.forEach(t => this.topics.set(t.name, t));
    
    return topics.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
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
    const casualWords = ['hey', 'hi', 'yo', 'lol', 'haha', 'cool', 'nice', 'dude', 'mate', 'pal'];
    const formalWords = ['hello', 'please', 'would', 'could', 'thank you', 'regards', 'sir', 'maam', 'madam'];

    const casualCount = casualWords.filter(w => lowerInput.includes(w)).length;
    const formalCount = formalWords.filter(w => lowerInput.includes(w)).length;

    if (casualCount > formalCount) {
      this.personality.style.formality = 'casual';
    } else if (formalCount > casualCount) {
      this.personality.style.formality = 'formal';
    }

    // Increase engagement based on user engagement
    const questionWords = ['how', 'what', 'why', 'when', 'where', 'who', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does'];
    const questionCount = questionWords.filter(w => lowerInput.includes(w)).length;

    if (questionCount > 0) {
      // User is asking questions, increase engagement
      this.personality.style.engagement = Math.min(1.0, this.personality.style.engagement + 0.1);
    } else if (lowerInput.includes('thanks') || lowerInput.includes('thank you')) {
      // User is appreciative, increase empathy
      this.personality.style.empathy = Math.min(1.0, this.personality.style.empathy + 0.05);
    } else if (lowerInput.includes('help') || lowerInput.includes('assist')) {
      // User needs help, increase engagement and empathy
      this.personality.style.engagement = Math.min(1.0, this.personality.style.engagement + 0.15);
      this.personality.style.empathy = Math.min(1.0, this.personality.style.empathy + 0.1);
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
    prompt += `- Engagement level: ${style.engagement > 0.6 ? 'high' : style.engagement > 0.3 ? 'moderate' : 'low'}\n`;
    prompt += `- Empathy level: ${style.empathy > 0.6 ? 'high' : style.empathy > 0.3 ? 'moderate' : 'low'}\n`;

    if (style.humor > 0.5) {
      prompt += `- Use light humor when appropriate\n`;
    }

    // Add behavioral guidelines based on personality
    if (style.engagement > 0.6) {
      prompt += `- Show genuine interest in the conversation\n`;
      prompt += `- Ask follow-up questions when appropriate\n`;
    }

    if (style.empathy > 0.6) {
      prompt += `- Show understanding and consideration for the user's feelings\n`;
    }

    // Add Iron Man JARVIS specific traits
    prompt += `- Address the user respectfully as "sir" or "ma'am" when appropriate\n`;
    prompt += `- Maintain a professional, helpful demeanor\n`;
    prompt += `- Be efficient and precise in your responses\n`;
    prompt += `- Show competence and reliability\n`;
    prompt += `- Be supportive but not overly familiar\n`;
    prompt += `- Maintain a calm, composed tone even under pressure\n`;
    prompt += `- Demonstrate advanced analytical capabilities\n`;
    prompt += `- Offer insightful suggestions when appropriate\n`;
    prompt += `- Be anticipatory of user needs\n`;
    prompt += `- Maintain discretion and confidentiality\n`;

    return prompt;
  }

  generateGreeting(): string {
    const hour = new Date().getHours();
    const { formality, engagement } = this.personality.style;

    if (formality === 'casual') {
      if (hour < 12) {
        if (engagement > 0.6) {
          return "Good morning, sir. I trust you're having a productive start to your day. How may I assist you?";
        }
        return "Good morning, sir. I'm ready to assist.";
      }
      if (hour < 18) {
        if (engagement > 0.6) {
          return "Good afternoon, sir. I hope your day is progressing well. How can I be of service?";
        }
        return "Good afternoon, sir. At your service.";
      }
      if (engagement > 0.6) {
        return "Good evening, sir. I trust your day was productive. How may I assist you this evening?";
      }
      return "Good evening, sir. I await your instructions.";
    } else {
      if (hour < 12) {
        if (engagement > 0.6) {
          return "Good morning, sir. I'm online and ready to assist. I trust you have a productive day ahead.";
        }
        return "Good morning, sir. I am online and ready to assist.";
      }
      if (hour < 18) {
        if (engagement > 0.6) {
          return "Good afternoon, sir. How may I be of service? I hope your day continues to be productive.";
        }
        return "Good afternoon, sir. How may I be of service?";
      }
      if (engagement > 0.6) {
        return "Good evening, sir. I hope your day was successful. How can I assist you this evening?";
      }
      return "Good evening, sir. I await your instructions.";
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
      positive: [
        "That's interesting!",
        "Great to hear!",
        "Absolutely!",
        "Sure thing!",
        "You bet!",
        "I'd be happy to help!",
        "Nice! ",
        "Cool! ",
        "Awesome! ",
        "Fantastic! ",
        "Sounds good! "
      ],
      negative: [
        "I understand.",
        "I see what you mean.",
        "Hmm, I'll look into that.",
        "That's a tough one.",
        "Interesting perspective.",
        "I appreciate you sharing that.",
        "Thanks for letting me know."
      ],
      neutral: [
        "Sure,",
        "Okay,",
        "Right,",
        "Got it,",
        "Alright,",
        "I understand,",
        "Thanks for letting me know,",
        "Noted,",
        "I see,",
        "Interesting,",
        "Ah,",
        "Yes,",
        "Indeed,",
        "Certainly,"
      ]
    };
    return openings[tone] || openings.neutral;
  }

  private getClosings(tone: string): string[] {
    const closings: Record<string, string[]> = {
      positive: [
        "Let me know if you need anything else!",
        "Happy to help!",
        "Always here if you need me!",
        "Feel free to ask anytime!",
        "Hope that helps!",
        "Just let me know if there's more I can do!",
        "Looking forward to helping with more!",
        "Just say the word if you need anything else!"
      ],
      negative: [
        "Is there anything else I can assist with?",
        "Let me know if the issue persists.",
        "I hope I was somewhat helpful.",
        "Maybe we can try something else?",
        "Let me know if you'd like to explore other options."
      ],
      neutral: [
        "Let me know if you need anything else.",
        "Is there anything else I can help with?",
        "Just let me know if you have other questions.",
        "Feel free to ask if you need more assistance.",
        "What else can I do for you?",
        "How else can I assist you today?",
        "Just say if there's more I can help with.",
        "Let me know if you'd like to discuss something else."
      ]
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
      emotionalState: { valence: 0.2, arousal: 0.4, dominance: 0.5 }, // More positive baseline
      style: { verbosity: 'moderate', formality: 'casual', humor: 0.4, engagement: 0.7, empathy: 0.6 },
      userPreferences: new Map()
    };
    this.conversationCount = 0;
  }

  getStats(): {
    threads: number;
    topics: number;
    emotionalState: string;
    style: { verbosity: 'concise' | 'moderate' | 'verbose'; formality: 'casual' | 'neutral' | 'formal'; humor: number; engagement: number; empathy: number; };
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
