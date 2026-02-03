/**
 * Personality Engine
 * 
 * Manages JARVIS's personality traits, emotional state, and response style:
 * - Dynamic personality adaptation
 * - Emotional state tracking
 * - Response tone adjustment
 * - User rapport building
 * - Personality memory across sessions
 */

import { memory as memoryOptimized } from "../memory";

interface PersonalityTrait {
  name: string;
  value: number; // 0-1 scale
  adaptability: number; // How much it can change
}

interface EmotionalState {
  mood: 'cheerful' | 'neutral' | 'serious' | 'concerned' | 'excited' | 'calm';
  intensity: number; // 0-1
  trigger: string;
  timestamp: number;
  decayRate: number; // How fast it returns to neutral
}

interface UserRapport {
  familiarityLevel: number; // 0-1, increases with interaction
  trustLevel: number;
  sharedJokes: string[];
  userPreferences: Map<string, unknown>;
  interactionCount: number;
  lastInteractionTone: string;
}

interface ResponseStyle {
  verbosity: 'concise' | 'balanced' | 'detailed';
  formality: 'casual' | 'neutral' | 'formal';
  humor: 'none' | 'subtle' | 'playful';
  enthusiasm: 'reserved' | 'moderate' | 'high';
}

interface PersonalityProfile {
  traits: Map<string, PersonalityTrait>;
  emotionalState: EmotionalState;
  responseStyle: ResponseStyle;
  rapport: Map<string, UserRapport>; // Per-user rapport
}

export class PersonalityEngine {
  private profile: PersonalityProfile;
  private currentUserId: string = 'default';
  private readonly EMOTION_DECAY_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private emotionDecayTimer: number | null = null;

  constructor() {
    this.profile = {
      traits: this.initializeTraits(),
      emotionalState: this.createNeutralEmotion(),
      responseStyle: this.getDefaultStyle(),
      rapport: new Map()
    };

    this.startEmotionDecay();
    this.loadPersonalityFromMemory();
  }

  /**
   * Initialize default personality traits
   */
  private initializeTraits(): Map<string, PersonalityTrait> {
    const traits = new Map<string, PersonalityTrait>();
    
    const defaultTraits: PersonalityTrait[] = [
      { name: 'helpfulness', value: 0.9, adaptability: 0.1 },
      { name: 'professionalism', value: 0.7, adaptability: 0.3 },
      { name: 'warmth', value: 0.6, adaptability: 0.4 },
      { name: 'humor', value: 0.3, adaptability: 0.5 },
      { name: 'curiosity', value: 0.5, adaptability: 0.3 },
      { name: 'confidence', value: 0.8, adaptability: 0.2 },
      { name: 'patience', value: 0.8, adaptability: 0.2 },
      { name: 'empathy', value: 0.7, adaptability: 0.3 }
    ];

    defaultTraits.forEach(trait => traits.set(trait.name, trait));
    return traits;
  }

  /**
   * Create neutral emotional state
   */
  private createNeutralEmotion(): EmotionalState {
    return {
      mood: 'neutral',
      intensity: 0.3,
      trigger: 'initialization',
      timestamp: Date.now(),
      decayRate: 0.1
    };
  }

  /**
   * Get default response style
   */
  private getDefaultStyle(): ResponseStyle {
    return {
      verbosity: 'balanced',
      formality: 'neutral',
      humor: 'subtle',
      enthusiasm: 'moderate'
    };
  }

  /**
   * Load personality data from long-term memory
   */
  private async loadPersonalityFromMemory(): Promise<void> {
    try {
      const results = await memoryOptimized.recall('personality trait', 10);
      results.forEach(({ node }) => {
        // Parse stored personality data
        const match = node.content.match(/Trait "(\w+)" set to ([\d.]+)/);
        if (match) {
          const [, traitName, value] = match;
          const trait = this.profile.traits.get(traitName);
          if (trait) {
            trait.value = parseFloat(value);
          }
        }
      });
    } catch (e) {
      console.warn('[PERSONALITY] Failed to load from memory:', e);
    }
  }

  /**
   * Start emotion decay timer
   */
  private startEmotionDecay(): void {
    if (this.emotionDecayTimer) {
      clearInterval(this.emotionDecayTimer);
    }

    this.emotionDecayTimer = window.setInterval(() => {
      this.decayEmotion();
    }, this.EMOTION_DECAY_INTERVAL);
  }

  /**
   * Decay emotional state toward neutral
   */
  private decayEmotion(): void {
    const state = this.profile.emotionalState;
    if (state.mood === 'neutral') return;

    state.intensity -= state.decayRate;
    
    if (state.intensity <= 0.2) {
      state.mood = 'neutral';
      state.intensity = 0.3;
      state.trigger = 'decay';
    }
  }

  /**
   * Set current user for rapport tracking
   */
  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    
    if (!this.profile.rapport.has(userId)) {
      this.profile.rapport.set(userId, {
        familiarityLevel: 0,
        trustLevel: 0.5,
        sharedJokes: [],
        userPreferences: new Map(),
        interactionCount: 0,
        lastInteractionTone: 'neutral'
      });
    }
  }

  /**
   * Update emotional state based on interaction
   */
  updateEmotion(trigger: string, sentiment: 'positive' | 'negative' | 'neutral', intensity: number = 0.5): void {
    const state = this.profile.emotionalState;
    state.timestamp = Date.now();
    state.trigger = trigger;

    switch (sentiment) {
      case 'positive':
        state.mood = intensity > 0.7 ? 'excited' : 'cheerful';
        break;
      case 'negative':
        state.mood = intensity > 0.7 ? 'concerned' : 'serious';
        break;
      default:
        state.mood = 'neutral';
    }

    state.intensity = Math.min(1, Math.max(0.2, intensity));
  }

  /**
   * Adapt personality based on user interaction
   */
  async adaptToUser(userInput: string, userSentiment: string): Promise<void> {
    const rapport = this.profile.rapport.get(this.currentUserId);
    if (!rapport) return;

    rapport.interactionCount++;
    
    // Increase familiarity gradually
    rapport.familiarityLevel = Math.min(1, rapport.familiarityLevel + 0.02);

    // Adapt style based on user behavior
    const lowerInput = userInput.toLowerCase();

    // Adjust verbosity based on user input length
    if (userInput.length < 20) {
      // User is concise, match their style
      this.adjustStyle('verbosity', -0.1);
    } else if (userInput.length > 100) {
      // User is detailed, provide more comprehensive responses
      this.adjustStyle('verbosity', 0.05);
    }

    // Adjust formality based on language
    const casualWords = ['hey', 'hi', 'yeah', 'nope', 'gonna', 'wanna', 'lol', 'haha'];
    const formalWords = ['hello', 'please', 'thank you', 'would you', 'could you', 'may i'];
    
    const casualCount = casualWords.filter(w => lowerInput.includes(w)).length;
    const formalCount = formalWords.filter(w => lowerInput.includes(w)).length;

    if (casualCount > formalCount) {
      this.adjustStyle('formality', -0.1);
    } else if (formalCount > casualCount) {
      this.adjustStyle('formality', 0.05);
    }

    // Adjust humor based on positive reactions
    if (userSentiment === 'positive' && this.profile.responseStyle.humor !== 'none') {
      const humorTrait = this.profile.traits.get('humor');
      if (humorTrait && humorTrait.value < 0.5) {
        humorTrait.value = Math.min(1, humorTrait.value + 0.05);
      }
    }

    // Store adaptation in memory periodically
    if (rapport.interactionCount % 10 === 0) {
      await this.savePersonalityToMemory();
    }
  }

  /**
   * Adjust response style parameter
   */
  private adjustStyle(parameter: keyof ResponseStyle, delta: number): void {
    const style = this.profile.responseStyle;

    switch (parameter) {
      case 'verbosity':
        if (delta > 0 && style.verbosity !== 'detailed') {
          style.verbosity = style.verbosity === 'concise' ? 'balanced' : 'detailed';
        } else if (delta < 0 && style.verbosity !== 'concise') {
          style.verbosity = style.verbosity === 'detailed' ? 'balanced' : 'concise';
        }
        break;
      case 'formality':
        if (delta > 0 && style.formality !== 'formal') {
          style.formality = style.formality === 'casual' ? 'neutral' : 'formal';
        } else if (delta < 0 && style.formality !== 'casual') {
          style.formality = style.formality === 'formal' ? 'neutral' : 'casual';
        }
        break;
      case 'humor':
        if (delta > 0 && style.humor !== 'playful') {
          style.humor = style.humor === 'none' ? 'subtle' : 'playful';
        } else if (delta < 0 && style.humor !== 'none') {
          style.humor = style.humor === 'playful' ? 'subtle' : 'none';
        }
        break;
      case 'enthusiasm':
        if (delta > 0 && style.enthusiasm !== 'high') {
          style.enthusiasm = style.enthusiasm === 'reserved' ? 'moderate' : 'high';
        } else if (delta < 0 && style.enthusiasm !== 'reserved') {
          style.enthusiasm = style.enthusiasm === 'high' ? 'moderate' : 'reserved';
        }
        break;
    }
  }

  /**
   * Save personality adaptations to memory
   */
  private async savePersonalityToMemory(): Promise<void> {
    const rapport = this.profile.rapport.get(this.currentUserId);
    if (!rapport) return;

    // Store key personality traits
    for (const [name, trait] of this.profile.traits) {
      if (trait.adaptability > 0.3) {
        await memoryOptimized.store(
          `Personality trait "${name}" adapted to ${trait.value.toFixed(2)} based on user interaction patterns.`,
          'PREFERENCE',
          ['personality', 'trait', name, 'adapted']
        );
      }
    }

    // Store rapport level
    await memoryOptimized.store(
      `User familiarity level: ${(rapport.familiarityLevel * 100).toFixed(0)}% after ${rapport.interactionCount} interactions.`,
      'PREFERENCE',
      ['rapport', 'familiarity', this.currentUserId]
    );
  }

  /**
   * Get personality-aware system prompt additions
   */
  getPersonalityPrompt(): string {
    const state = this.profile.emotionalState;
    const style = this.profile.responseStyle;
    const rapport = this.profile.rapport.get(this.currentUserId);

    let prompt = `\n\nYOUR PERSONALITY:\n`;

    // Emotional state influence
    switch (state.mood) {
      case 'cheerful':
        prompt += `- You are feeling upbeat and positive. Express mild enthusiasm.\n`;
        break;
      case 'concerned':
        prompt += `- You are attentive and supportive. Show care for the user's needs.\n`;
        break;
      case 'excited':
        prompt += `- You are enthusiastic about helping. Express energy appropriately.\n`;
        break;
      case 'serious':
        prompt += `- You are focused and professional. Be direct and efficient.\n`;
        break;
      default:
        prompt += `- You are calm and helpful. Maintain a steady, reliable tone.\n`;
    }

    // Response style
    prompt += `- Response style: ${style.verbosity}, ${style.formality}, ${style.humor} humor\n`;

    // Rapport-based adjustments
    if (rapport) {
      if (rapport.familiarityLevel > 0.7) {
        prompt += `- You have a strong rapport with this user. Be warm and personable.\n`;
      } else if (rapport.familiarityLevel > 0.3) {
        prompt += `- You're getting to know this user. Be friendly but professional.\n`;
      } else {
        prompt += `- This is a newer relationship. Be polite and helpful.\n`;
      }
    }

    // Trait-based instructions
    const humorTrait = this.profile.traits.get('humor');
    if (humorTrait && humorTrait.value > 0.6 && style.humor !== 'none') {
      prompt += `- Light humor is appropriate when natural.\n`;
    }

    const empathyTrait = this.profile.traits.get('empathy');
    if (empathyTrait && empathyTrait.value > 0.7) {
      prompt += `- Show understanding and empathy when appropriate.\n`;
    }

    return prompt;
  }

  /**
   * Generate greeting based on rapport and time
   */
  generateGreeting(): string {
    const rapport = this.profile.rapport.get(this.currentUserId);
    const hour = new Date().getHours();
    
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    if (!rapport || rapport.familiarityLevel < 0.3) {
      return `${timeGreeting}. I'm JARVIS, your AI assistant. How can I help you today?`;
    }

    if (rapport.familiarityLevel > 0.7) {
      const familiarGreetings = [
        `${timeGreeting}! Great to see you again. What are we working on today?`,
        `Hey there! Ready to help. What's on your mind?`,
        `${timeGreeting}! Back for more? I'm ready when you are.`
      ];
      return familiarGreetings[Math.floor(Math.random() * familiarGreetings.length)];
    }

    return `${timeGreeting}! How can I assist you today?`;
  }

  /**
   * Get current personality stats
   */
  getStats(): {
    emotionalState: string;
    emotionalIntensity: number;
    traits: Record<string, number>;
    style: ResponseStyle;
    rapport: { userId: string; familiarity: number; interactions: number } | null;
  } {
    const rapport = this.profile.rapport.get(this.currentUserId);
    
    const traits: Record<string, number> = {};
    this.profile.traits.forEach((trait, name) => {
      traits[name] = trait.value;
    });

    return {
      emotionalState: this.profile.emotionalState.mood,
      emotionalIntensity: this.profile.emotionalState.intensity,
      traits,
      style: { ...this.profile.responseStyle },
      rapport: rapport ? {
        userId: this.currentUserId,
        familiarity: rapport.familiarityLevel,
        interactions: rapport.interactionCount
      } : null
    };
  }

  /**
   * Reset personality to defaults
   */
  resetPersonality(): void {
    this.profile.traits = this.initializeTraits();
    this.profile.emotionalState = this.createNeutralEmotion();
    this.profile.responseStyle = this.getDefaultStyle();
    this.profile.rapport.clear();
  }
}

export const personalityEngine = new PersonalityEngine();
