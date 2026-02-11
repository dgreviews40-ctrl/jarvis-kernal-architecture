/**
 * Mood Detection Service
 * Advanced sentiment analysis and mood detection for adaptive responses
 */

import { emotionalMemory, type UserMoodState } from './emotionalMemory';
import { eventBus } from './eventBus';

export interface MoodAnalysis {
  primaryMood: string;
  secondaryMoods: string[];
  valence: 'positive' | 'negative' | 'neutral';
  intensity: number; // 0-1
  confidence: number; // 0-1
  indicators: string[]; // What triggered this detection
  suggestedApproach: {
    tone: string;
    pace: 'slower' | 'normal' | 'faster';
    empathy: 'high' | 'normal' | 'low';
    formality: 'casual' | 'neutral' | 'formal';
    useName: boolean;
    offerHelp: boolean;
  };
}

export interface ConversationMetrics {
  messageCount: number;
  averageMessageLength: number;
  responseTimePattern: 'quick' | 'normal' | 'delayed' | 'inconsistent';
  punctuationPattern: 'enthusiastic' | 'measured' | 'neutral' | 'uncertain';
  capitalizationPattern: 'normal' | 'emphatic' | 'minimal';
}

/**
 * Service for advanced mood detection and adaptive response suggestions
 */
export class MoodDetectionService {
  private messageHistory: Array<{ text: string; timestamp: number }> = [];
  private maxHistoryLength = 10;

  /**
   * Analyze text for mood and emotional state
   */
  async analyzeMood(
    text: string,
    origin: 'USER_TEXT' | 'USER_VOICE',
    metrics?: Partial<ConversationMetrics>
  ): Promise<MoodAnalysis> {
    // Add to history
    this.messageHistory.push({ text, timestamp: Date.now() });
    if (this.messageHistory.length > this.maxHistoryLength) {
      this.messageHistory.shift();
    }

    // Run various detection algorithms
    const sentimentAnalysis = this.analyzeSentiment(text);
    const emotionDetection = this.detectEmotions(text);
    const linguisticPatterns = this.analyzeLinguisticPatterns(text, origin, metrics);
    const contextAnalysis = this.analyzeContextualPatterns();

    // Combine results
    const analysis = this.combineAnalyses(
      sentimentAnalysis,
      emotionDetection,
      linguisticPatterns,
      contextAnalysis,
      text
    );

    // Update emotional memory
    await emotionalMemory.updateMood(text, origin);

    // Emit event for other services
    eventBus.publish('mood:detected', { analysis, text: text.substring(0, 100) });

    return analysis;
  }

  /**
   * Get current mood with trend analysis
   */
  getMoodWithTrend(): UserMoodState & {
    trend: 'improving' | 'declining' | 'stable' | 'fluctuating';
    trendConfidence: number;
  } {
    const current = emotionalMemory.getCurrentMood();
    
    if (this.messageHistory.length < 3) {
      return { ...current, trend: 'stable', trendConfidence: 0 };
    }

    // Analyze trend from message history
    const sentiments = this.messageHistory.map(m => this.quickSentiment(m.text));
    
    let positiveCount = 0;
    let negativeCount = 0;
    let changes = 0;
    let lastValence = sentiments[0];

    for (const valence of sentiments) {
      if (valence === 'positive') positiveCount++;
      if (valence === 'negative') negativeCount++;
      if (valence !== lastValence) changes++;
      lastValence = valence;
    }

    let trend: 'improving' | 'declining' | 'stable' | 'fluctuating';
    let trendConfidence = 0;

    if (changes > sentiments.length / 2) {
      trend = 'fluctuating';
      trendConfidence = changes / sentiments.length;
    } else if (positiveCount > negativeCount * 2) {
      trend = 'improving';
      trendConfidence = positiveCount / sentiments.length;
    } else if (negativeCount > positiveCount * 2) {
      trend = 'declining';
      trendConfidence = negativeCount / sentiments.length;
    } else {
      trend = 'stable';
      trendConfidence = 0.5;
    }

    return { ...current, trend, trendConfidence };
  }

  /**
   * Analyze sentiment (positive/negative/neutral with intensity)
   */
  private analyzeSentiment(text: string): {
    valence: 'positive' | 'negative' | 'neutral';
    intensity: number;
    confidence: number;
    indicators: string[];
  } {
    const lower = text.toLowerCase();
    const indicators: string[] = [];

    // Expanded sentiment lexicon
    const positiveWords: Record<string, number> = {
      'excellent': 0.9, 'amazing': 0.95, 'wonderful': 0.9, 'fantastic': 0.95,
      'great': 0.7, 'good': 0.6, 'love': 0.85, 'perfect': 0.8,
      'awesome': 0.9, 'brilliant': 0.85, 'happy': 0.75, 'excited': 0.8,
      'thrilled': 0.85, 'delighted': 0.8, 'grateful': 0.7, 'thank': 0.5,
      'thanks': 0.55, 'appreciate': 0.6, 'best': 0.7, 'beautiful': 0.65,
      'joy': 0.8, 'fun': 0.6, 'win': 0.7, 'success': 0.75,
      'yes': 0.3, 'yeah': 0.35, 'yep': 0.35, 'sure': 0.3,
    };

    const negativeWords: Record<string, number> = {
      'terrible': 0.9, 'awful': 0.9, 'horrible': 0.95, 'hate': 0.85,
      'bad': 0.6, 'worst': 0.9, 'sad': 0.7, 'angry': 0.8,
      'frustrated': 0.75, 'annoyed': 0.65, 'disappointed': 0.7,
      'upset': 0.75, 'worried': 0.65, 'anxious': 0.7, 'stressed': 0.7,
      'scared': 0.8, 'afraid': 0.75, 'concerned': 0.55, 'sorry': 0.4,
      'fail': 0.7, 'failed': 0.75, 'error': 0.5, 'problem': 0.55,
      'issue': 0.5, 'bug': 0.5, 'broken': 0.65, 'no': 0.2,
      'not': 0.15, 'never': 0.3, 'nothing': 0.15, 'nobody': 0.2,
    };

    let positiveScore = 0;
    let negativeScore = 0;

    // Check for phrases (more specific than single words)
    const phrases = [
      { text: 'not good', sentiment: 'negative', weight: 0.6 },
      { text: 'not bad', sentiment: 'positive', weight: 0.5 },
      { text: 'thank you', sentiment: 'positive', weight: 0.6 },
      { text: 'thank you so much', sentiment: 'positive', weight: 0.8 },
      { text: 'I love', sentiment: 'positive', weight: 0.85 },
      { text: 'I hate', sentiment: 'negative', weight: 0.85 },
      { text: 'so happy', sentiment: 'positive', weight: 0.8 },
      { text: 'so sad', sentiment: 'negative', weight: 0.8 },
      { text: 'really appreciate', sentiment: 'positive', weight: 0.7 },
      { text: 'really frustrated', sentiment: 'negative', weight: 0.75 },
    ];

    for (const phrase of phrases) {
      if (lower.includes(phrase.text)) {
        if (phrase.sentiment === 'positive') {
          positiveScore += phrase.weight;
          indicators.push(phrase.text);
        } else {
          negativeScore += phrase.weight;
          indicators.push(phrase.text);
        }
      }
    }

    // Word-level analysis (excluding phrase components)
    const words = lower.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (positiveWords[clean] && !indicators.some(i => i.includes(clean))) {
        positiveScore += positiveWords[clean];
        indicators.push(clean);
      }
      if (negativeWords[clean] && !indicators.some(i => i.includes(clean))) {
        negativeScore += negativeWords[clean];
        indicators.push(clean);
      }
    }

    // Intensifiers
    const intensifiers = ['very', 'really', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely'];
    const negations = ['not', 'no', 'never', 'nothing', 'nobody', 'neither', 'nowhere'];

    let intensifierCount = 0;
    let negationCount = 0;

    for (const word of words) {
      if (intensifiers.includes(word)) intensifierCount++;
      if (negations.includes(word)) negationCount++;
    }

    // Apply intensifiers
    if (intensifierCount > 0) {
      positiveScore *= (1 + intensifierCount * 0.2);
      negativeScore *= (1 + intensifierCount * 0.2);
    }

    // Handle negations (flip sentiment)
    if (negationCount > 0) {
      // Simple negation handling - could be more sophisticated
      const temp = positiveScore;
      positiveScore = negativeScore * 0.5;
      negativeScore = temp * 0.5;
    }

    // Normalize
    positiveScore = Math.min(1, positiveScore);
    negativeScore = Math.min(1, negativeScore);

    let valence: 'positive' | 'negative' | 'neutral';
    let intensity: number;
    let confidence: number;

    if (positiveScore > negativeScore && positiveScore > 0.15) {
      valence = 'positive';
      intensity = positiveScore;
      confidence = Math.min(0.95, positiveScore + 0.3);
    } else if (negativeScore > positiveScore && negativeScore > 0.15) {
      valence = 'negative';
      intensity = negativeScore;
      confidence = Math.min(0.95, negativeScore + 0.3);
    } else {
      valence = 'neutral';
      // Calculate confidence based on how "empty" the sentiment is
      // If there are no indicators, confidence is lower (we're guessing)
      // If there are balanced indicators, confidence is higher
      const totalIndicators = indicators.length;
      const hasSentimentWords = positiveScore > 0 || negativeScore > 0;
      
      if (totalIndicators === 0) {
        // No sentiment words found - low confidence neutral
        intensity = 0.2;
        confidence = 0.4;
      } else if (hasSentimentWords) {
        // Balanced positive/negative sentiment words - higher confidence
        intensity = 0.4;
        confidence = 0.6 + (totalIndicators * 0.05);
      } else {
        // Some indicators but no strong sentiment
        intensity = 0.3;
        confidence = 0.5;
      }
      
      confidence = Math.min(0.85, confidence);
    }

    return { valence, intensity, confidence, indicators };
  }

  /**
   * Detect specific emotions
   */
  private detectEmotions(text: string): {
    emotions: Map<string, number>;
    dominantEmotion: string;
    confidence: number;
  } {
    const lower = text.toLowerCase();
    const emotions = new Map<string, number>();

    // Emotion patterns
    const emotionPatterns: Record<string, string[]> = {
      'joy': ['happy', 'joy', 'excited', 'thrilled', 'delighted', 'love', 'wonderful', 'amazing', 'yay', 'woohoo', 'great', 'awesome'],
      'gratitude': ['thank', 'thanks', 'grateful', 'appreciate', 'thankful', 'blessed'],
      'excitement': ['excited', 'can\'t wait', 'looking forward', 'thrilled', 'pumped', 'hyped'],
      'sadness': ['sad', 'depressed', 'down', 'unhappy', 'miserable', 'crying', 'tears', 'heartbroken'],
      'anger': ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'pissed', 'rage', 'hate'],
      'frustration': ['frustrated', 'annoyed', 'irritated', 'stuck', 'can\'t figure', 'giving up', 'ugh', 'annoying'],
      'anxiety': ['worried', 'anxious', 'nervous', 'stressed', 'overwhelmed', 'panic', 'scared', 'afraid'],
      'confusion': ['confused', 'don\'t understand', 'unclear', 'lost', 'what?', 'huh?', 'puzzled'],
      'curiosity': ['wonder', 'curious', 'interested', 'how does', 'why does', 'what is', 'tell me', 'how are', 'how do', 'what\'s', 'what is', 'who is', 'where is', 'when is', 'why is', 'can you', 'do you', 'will you', 'how much', 'how many'],
      'surprise': ['wow', 'omg', 'oh my', 'surprised', 'shocked', 'unexpected', 'can\'t believe'],
      'disappointment': ['disappointed', 'expected better', 'let down', 'hoped', 'unfortunately'],
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          score += 0.3;
        }
      }
      if (score > 0) {
        emotions.set(emotion, Math.min(1, score));
      }
    }

    // Find dominant emotion
    let dominantEmotion = 'neutral';
    let maxScore = 0;

    for (const [emotion, score] of emotions) {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }

    return {
      emotions,
      dominantEmotion,
      confidence: maxScore,
    };
  }

  /**
   * Analyze linguistic patterns
   */
  private analyzeLinguisticPatterns(
    text: string,
    origin: 'USER_TEXT' | 'USER_VOICE',
    metrics?: Partial<ConversationMetrics>
  ): {
    formality: 'casual' | 'neutral' | 'formal';
    urgency: 'low' | 'normal' | 'high';
    certainty: 'uncertain' | 'neutral' | 'confident';
    indicators: string[];
  } {
    const indicators: string[] = [];
    const lower = text.toLowerCase();

    // Formality detection
    const formalWords = ['would', 'could', 'please', 'thank you', 'appreciate', 'assistance'];
    const casualWords = ['hey', 'hi', 'yeah', 'nah', 'gonna', 'wanna', 'lol', 'cool'];

    let formalCount = 0;
    let casualCount = 0;

    for (const word of formalWords) {
      if (lower.includes(word)) formalCount++;
    }
    for (const word of casualWords) {
      if (lower.includes(word)) casualCount++;
    }

    let formality: 'casual' | 'neutral' | 'formal';
    if (formalCount > casualCount) {
      formality = 'formal';
      indicators.push('formal language');
    } else if (casualCount > formalCount) {
      formality = 'casual';
      indicators.push('casual language');
    } else {
      formality = 'neutral';
    }

    // Urgency detection
    const urgentWords = ['urgent', 'asap', 'immediately', 'quickly', 'emergency', 'now', 'hurry'];
    let urgency: 'low' | 'normal' | 'high' = 'normal';
    
    for (const word of urgentWords) {
      if (lower.includes(word)) {
        urgency = 'high';
        indicators.push('urgent language');
        break;
      }
    }

    // Multiple exclamation marks = higher urgency
    if (/!{2,}/.test(text)) {
      urgency = 'high';
      indicators.push('emphatic punctuation');
    }

    // Certainty detection
    const uncertainWords = ['maybe', 'perhaps', 'possibly', 'might', 'not sure', 'don\'t know', 'unsure'];
    const certainWords = ['definitely', 'absolutely', 'certainly', 'sure', 'know', 'confident'];

    let uncertainCount = 0;
    let certainCount = 0;

    for (const word of uncertainWords) {
      if (lower.includes(word)) uncertainCount++;
    }
    for (const word of certainWords) {
      if (lower.includes(word)) certainCount++;
    }

    let certainty: 'uncertain' | 'neutral' | 'confident';
    if (uncertainCount > certainCount) {
      certainty = 'uncertain';
      indicators.push('uncertain language');
    } else if (certainCount > uncertainCount) {
      certainty = 'confident';
      indicators.push('confident language');
    } else {
      certainty = 'neutral';
    }

    return { formality, urgency, certainty, indicators };
  }

  /**
   * Analyze patterns across conversation history
   */
  private analyzeContextualPatterns(): {
    moodShift: boolean;
    consistency: 'consistent' | 'shifting' | 'escalating';
    pattern: string | null;
  } {
    if (this.messageHistory.length < 3) {
      return { moodShift: false, consistency: 'consistent', pattern: null };
    }

    const sentiments = this.messageHistory.map(m => this.quickSentiment(m.text));
    
    // Check for shifts
    let shifts = 0;
    for (let i = 1; i < sentiments.length; i++) {
      if (sentiments[i] !== sentiments[i - 1]) shifts++;
    }

    const moodShift = shifts > sentiments.length / 3;
    
    let consistency: 'consistent' | 'shifting' | 'escalating';
    if (shifts > sentiments.length / 2) {
      consistency = 'escalating';
    } else if (shifts > 0) {
      consistency = 'shifting';
    } else {
      consistency = 'consistent';
    }

    // Detect patterns
    let pattern: string | null = null;
    if (sentiments.every(s => s === 'negative')) {
      pattern = 'persistent_negativity';
    } else if (sentiments.every(s => s === 'positive')) {
      pattern = 'persistent_positivity';
    } else if (sentiments[sentiments.length - 1] === 'positive' && 
               sentiments.slice(0, -1).every(s => s === 'negative')) {
      pattern = 'mood_improvement';
    }

    return { moodShift, consistency, pattern };
  }

  /**
   * Quick sentiment check for history analysis
   */
  private quickSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positive = ['good', 'great', 'happy', 'love', 'thanks', 'yes', 'awesome', 'nice'];
    const negative = ['bad', 'hate', 'sad', 'angry', 'frustrated', 'no', 'terrible', 'awful'];

    const lower = text.toLowerCase();
    let pos = 0, neg = 0;

    for (const word of positive) if (lower.includes(word)) pos++;
    for (const word of negative) if (lower.includes(word)) neg++;

    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }

  /**
   * Combine all analyses into final result
   */
  private combineAnalyses(
    sentiment: ReturnType<typeof this.analyzeSentiment>,
    emotions: ReturnType<typeof this.detectEmotions>,
    linguistic: ReturnType<typeof this.analyzeLinguisticPatterns>,
    context: ReturnType<typeof this.analyzeContextualPatterns>,
    text: string
  ): MoodAnalysis {
    // Determine primary mood
    let primaryMood = emotions.dominantEmotion;
    // Lower threshold for emotion detection so curiosity and other subtle emotions show up
    if (emotions.confidence < 0.2) {
      primaryMood = sentiment.valence === 'positive' ? 'content' : 
                    sentiment.valence === 'negative' ? 'dissatisfied' : 'neutral';
    }
    
    // Special case: if it's a question and curiosity was detected, use that
    const isQuestion = text.includes('?') || 
                       /\b(what|who|when|where|why|how|which|whose|whom|can|could|will|would|do|does|did|is|are|was|were)\b/i.test(text);
    if (isQuestion && emotions.emotions.has('curiosity')) {
      const curiosityScore = emotions.emotions.get('curiosity') || 0;
      if (curiosityScore >= 0.2) {
        primaryMood = 'curiosity';
      }
    }

    // Build secondary moods
    const secondaryMoods: string[] = [];
    for (const [emotion, score] of emotions.emotions) {
      if (emotion !== primaryMood && score > 0.3) {
        secondaryMoods.push(emotion);
      }
    }

    // Combine indicators
    const allIndicators = [...sentiment.indicators, ...linguistic.indicators];

    // Generate suggested approach
    const suggestedApproach = this.generateApproach(
      primaryMood,
      sentiment,
      linguistic,
      context
    );

    return {
      primaryMood,
      secondaryMoods,
      valence: sentiment.valence,
      intensity: sentiment.intensity,
      confidence: Math.max(sentiment.confidence, emotions.confidence),
      indicators: allIndicators,
      suggestedApproach,
    };
  }

  /**
   * Generate response approach based on mood analysis
   */
  private generateApproach(
    mood: string,
    sentiment: ReturnType<typeof this.analyzeSentiment>,
    linguistic: ReturnType<typeof this.analyzeLinguisticPatterns>,
    context: ReturnType<typeof this.analyzeContextualPatterns>
  ): MoodAnalysis['suggestedApproach'] {
    // Default approach
    const approach: MoodAnalysis['suggestedApproach'] = {
      tone: 'friendly and helpful',
      pace: 'normal',
      empathy: 'normal',
      formality: linguistic.formality,
      useName: sentiment.intensity > 0.5,
      offerHelp: true,
    };

    // Adjust based on mood
    switch (mood) {
      case 'frustration':
      case 'anger':
        approach.tone = 'calm and professional';
        approach.pace = 'slower';
        approach.empathy = 'high';
        break;
      
      case 'anxiety':
      case 'sadness':
        approach.tone = 'gentle and supportive';
        approach.pace = 'slower';
        approach.empathy = 'high';
        break;
      
      case 'excitement':
      case 'joy':
        approach.tone = 'enthusiastic and warm';
        approach.pace = 'faster';
        approach.empathy = 'normal';
        break;
      
      case 'confusion':
        approach.tone = 'patient and clear';
        approach.pace = 'slower';
        approach.empathy = 'high';
        break;
      
      case 'gratitude':
        approach.tone = 'warm and appreciative';
        approach.empathy = 'normal';
        break;
    }

    // Adjust for urgency
    if (linguistic.urgency === 'high') {
      approach.pace = 'faster';
      approach.tone = approach.tone.replace('calm', 'focused');
    }

    // Adjust for uncertainty
    if (linguistic.certainty === 'uncertain') {
      approach.empathy = 'high';
      approach.tone = 'reassuring and clear';
    }

    // Adjust for escalating pattern
    if (context.consistency === 'escalating') {
      approach.empathy = 'high';
      approach.pace = 'slower';
    }

    return approach;
  }

  /**
   * Clear history (for testing/reset)
   */
  clearHistory(): void {
    this.messageHistory = [];
  }
}

// Singleton instance
export const moodDetection = new MoodDetectionService();
