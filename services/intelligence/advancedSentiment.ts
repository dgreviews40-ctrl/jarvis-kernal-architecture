/**
 * Advanced Sentiment Analysis
 * 
 * ML-enhanced sentiment analysis with:
 * - Multi-dimensional emotion detection
 * - Sarcasm and irony detection
 * - Contextual sentiment (previous messages affect current)
 * - Confidence scoring
 * - Temporal sentiment tracking
 */

interface EmotionDimensions {
  valence: number;      // Positive vs negative (-1 to 1)
  arousal: number;      // Intensity/calm vs excited (0 to 1)
  dominance: number;    // In control vs submissive (0 to 1)
}

interface SentimentFeatures {
  words: string[];
  negations: string[];
  intensifiers: string[];
  emojiSentiment: number;
  punctuationImpact: number;
  capitalizationImpact: number;
}

interface ContextualSentiment {
  baseline: number;           // User's typical sentiment
  current: number;            // Current message sentiment
  delta: number;              // Change from baseline
  trend: 'improving' | 'stable' | 'declining';
  confidence: number;
}

interface SarcasmIndicator {
  score: number;
  indicators: string[];
  isSarcastic: boolean;
}

export class AdvancedSentimentAnalyzer {
  // Emotion lexicon with intensity scores
  private emotionLexicon: Map<string, { valence: number; arousal: number }> = new Map([
    // Positive emotions
    ['excellent', { valence: 0.9, arousal: 0.6 }],
    ['amazing', { valence: 0.95, arousal: 0.8 }],
    ['love', { valence: 0.9, arousal: 0.7 }],
    ['perfect', { valence: 0.95, arousal: 0.5 }],
    ['great', { valence: 0.8, arousal: 0.5 }],
    ['good', { valence: 0.7, arousal: 0.4 }],
    ['happy', { valence: 0.85, arousal: 0.6 }],
    ['excited', { valence: 0.9, arousal: 0.9 }],
    ['wonderful', { valence: 0.9, arousal: 0.5 }],
    ['fantastic', { valence: 0.95, arousal: 0.7 }],
    ['brilliant', { valence: 0.85, arousal: 0.6 }],
    ['awesome', { valence: 0.9, arousal: 0.7 }],
    ['thanks', { valence: 0.7, arousal: 0.3 }],
    ['thank', { valence: 0.7, arousal: 0.3 }],
    ['appreciate', { valence: 0.75, arousal: 0.4 }],
    
    // Negative emotions
    ['terrible', { valence: -0.9, arousal: 0.7 }],
    ['awful', { valence: -0.9, arousal: 0.6 }],
    ['hate', { valence: -0.95, arousal: 0.8 }],
    ['worst', { valence: -0.9, arousal: 0.7 }],
    ['bad', { valence: -0.7, arousal: 0.5 }],
    ['annoying', { valence: -0.6, arousal: 0.6 }],
    ['frustrated', { valence: -0.7, arousal: 0.7 }],
    ['angry', { valence: -0.85, arousal: 0.9 }],
    ['disappointed', { valence: -0.7, arousal: 0.4 }],
    ['stupid', { valence: -0.8, arousal: 0.6 }],
    ['broken', { valence: -0.7, arousal: 0.5 }],
    ['wrong', { valence: -0.6, arousal: 0.5 }],
    ['error', { valence: -0.6, arousal: 0.5 }],
    ['fail', { valence: -0.7, arousal: 0.6 }],
    ['useless', { valence: -0.8, arousal: 0.5 }],
    
    // Neutral/Context-dependent
    ['fine', { valence: 0.1, arousal: 0.2 }],
    ['okay', { valence: 0.1, arousal: 0.2 }],
    ['ok', { valence: 0.1, arousal: 0.2 }],
    ['sure', { valence: 0.2, arousal: 0.3 }],
    ['whatever', { valence: -0.2, arousal: 0.3 }],
    ['meh', { valence: -0.1, arousal: 0.1 }],
  ]);

  // Negation words that flip sentiment
  private negations = [
    'not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nowhere',
    'hardly', 'scarcely', 'barely', 'doesnt', 'dont', 'didnt', 'wasnt',
    "n't", 'aint', 'without'
  ];

  // Intensifiers that amplify sentiment
  private intensifiers: Map<string, number> = new Map([
    ['very', 1.5],
    ['extremely', 2.0],
    ['incredibly', 2.0],
    ['absolutely', 1.8],
    ['completely', 1.6],
    ['totally', 1.6],
    ['really', 1.4],
    ['quite', 1.3],
    ['pretty', 1.2],
    ['fairly', 1.1],
    ['somewhat', 0.8],
    ['slightly', 0.6],
    ['kind of', 0.7],
    ['sort of', 0.7],
  ]);

  // Sarcasm indicators
  private sarcasmPatterns = [
    /yeah,? right/i,
    /sure,? (whatever|thing)/i,
    /oh,? (really|great|perfect|wonderful)/i,
    /because that['']?s what i need/i,
    /just what i (wanted|needed)/i,
    /how (convenient|lucky|wonderful) for me/i,
    /of course (it is|you do|i do)/i,
  ];

  // User sentiment history for baseline calculation
  private userSentimentHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_WINDOW = 20;

  /**
   * Extract features from text for analysis
   */
  private extractFeatures(text: string): SentimentFeatures {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    // Find negations
    const negations = words.filter(w => this.negations.includes(w));
    
    // Find intensifiers (including multi-word)
    const intensifiers: string[] = [];
    const lowerText = text.toLowerCase();
    for (const [phrase, _] of this.intensifiers) {
      if (lowerText.includes(phrase)) {
        intensifiers.push(phrase);
      }
    }

    // Emoji sentiment (basic)
    const positiveEmojis = (text.match(/[😀😃😄😁😊🙂👍❤️🎉✨]/g) || []).length;
    const negativeEmojis = (text.match(/[😠😡😢😭😞😔👎💔]/g) || []).length;
    const emojiSentiment = positiveEmojis > 0 ? 0.3 : negativeEmojis > 0 ? -0.3 : 0;

    // Punctuation impact
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    const punctuationImpact = Math.min(0.3, exclamationCount * 0.1 - questionCount * 0.05);

    // Capitalization impact (shouting)
    const capsRatio = text.replace(/[^a-zA-Z]/g, '').length > 0
      ? (text.match(/[A-Z]/g) || []).length / text.replace(/[^a-zA-Z]/g, '').length
      : 0;
    const capitalizationImpact = capsRatio > 0.7 ? 0.2 : 0;

    return {
      words,
      negations,
      intensifiers,
      emojiSentiment,
      punctuationImpact,
      capitalizationImpact
    };
  }

  /**
   * Detect sarcasm in text
   */
  detectSarcasm(text: string): SarcasmIndicator {
    const indicators: string[] = [];
    let score = 0;

    // Check sarcasm patterns
    for (const pattern of this.sarcasmPatterns) {
      if (pattern.test(text)) {
        indicators.push(`Pattern match: ${pattern.source}`);
        score += 0.4;
      }
    }

    // Check for excessive punctuation (!!!, ???)
    if (/!{2,}/.test(text) || /\?{2,}/.test(text)) {
      indicators.push('Excessive punctuation');
      score += 0.2;
    }

    // Check for quotes (often used sarcastically)
    if (text.includes('"') || text.includes("'")) {
      indicators.push('Contains quotes');
      score += 0.15;
    }

    // Check for contradictory sentiment in same sentence
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      const positiveWords = ['great', 'awesome', 'perfect', 'love', 'amazing'];
      const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worst'];
      
      const hasPositive = positiveWords.some(w => sentence.toLowerCase().includes(w));
      const hasNegative = negativeWords.some(w => sentence.toLowerCase().includes(w));
      
      if (hasPositive && hasNegative) {
        indicators.push('Contradictory sentiment');
        score += 0.3;
      }
    }

    return {
      score: Math.min(1, score),
      indicators,
      isSarcastic: score > 0.5
    };
  }

  /**
   * Calculate emotion dimensions
   */
  calculateEmotions(text: string): EmotionDimensions & { confidence: number } {
    const features = this.extractFeatures(text);
    let totalValence = 0;
    let totalArousal = 0;
    let matchedWords = 0;
    let confidence = 0.5;

    // Process each word
    for (let i = 0; i < features.words.length; i++) {
      const word = features.words[i];
      const lexiconEntry = this.emotionLexicon.get(word);
      
      if (lexiconEntry) {
        let valence = lexiconEntry.valence;
        let arousal = lexiconEntry.arousal;

        // Check for negation (look back 3 words)
        const startIdx = Math.max(0, i - 3);
        const context = features.words.slice(startIdx, i);
        const hasNegation = context.some(w => this.negations.includes(w));
        
        if (hasNegation) {
          valence *= -0.5; // Flip and reduce intensity
        }

        // Check for intensifiers in context
        for (const intensifier of features.intensifiers) {
          const multiplier = this.intensifiers.get(intensifier) || 1;
          valence *= multiplier;
          arousal *= Math.min(1.5, multiplier);
        }

        totalValence += valence;
        totalArousal += arousal;
        matchedWords++;
      }
    }

    // Calculate averages
    const avgValence = matchedWords > 0 ? totalValence / matchedWords : 0;
    const avgArousal = matchedWords > 0 ? totalArousal / matchedWords : 0.3;

    // Add emoji and punctuation impact
    const finalValence = Math.max(-1, Math.min(1, 
      avgValence + features.emojiSentiment
    ));
    const finalArousal = Math.max(0, Math.min(1,
      avgArousal + features.punctuationImpact + features.capitalizationImpact
    ));

    // Calculate confidence based on matched words and features
    confidence = Math.min(1, 
      0.3 + (matchedWords / features.words.length) * 0.4 +
      (features.emojiSentiment !== 0 ? 0.15 : 0) +
      (features.punctuationImpact !== 0 ? 0.15 : 0)
    );

    // Calculate dominance (feeling in control vs overwhelmed)
    const dominance = 0.5 + (finalValence * 0.3) - (finalArousal * 0.2);

    return {
      valence: finalValence,
      arousal: finalArousal,
      dominance: Math.max(0, Math.min(1, dominance)),
      confidence
    };
  }

  /**
   * Analyze sentiment with user baseline context
   */
  analyzeWithContext(
    text: string,
    userId: string,
    conversationHistory: string[] = []
  ): {
    dimensions: EmotionDimensions;
    sarcasm: SarcasmIndicator;
    contextual: ContextualSentiment;
    overallSentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' | 'mixed';
  } {
    // Calculate current sentiment
    const dimensions = this.calculateEmotions(text);
    const sarcasm = this.detectSarcasm(text);

    // Adjust for sarcasm
    if (sarcasm.isSarcastic) {
      dimensions.valence *= -0.8;
      dimensions.arousal = Math.min(1, dimensions.arousal + 0.2);
    }

    // Get user baseline
    const baseline = this.getUserBaseline(userId);

    // Calculate contextual sentiment
    const delta = dimensions.valence - baseline;
    const contextual: ContextualSentiment = {
      baseline,
      current: dimensions.valence,
      delta,
      trend: delta > 0.2 ? 'improving' : delta < -0.2 ? 'declining' : 'stable',
      confidence: dimensions.confidence
    };

    // Consider conversation history trend
    if (conversationHistory.length > 0) {
      const historySentiments = conversationHistory.map(h => 
        this.calculateEmotions(h).valence
      );
      const avgHistory = historySentiments.reduce((a, b) => a + b, 0) / historySentiments.length;
      
      // Adjust confidence based on consistency with history
      const consistency = 1 - Math.abs(dimensions.valence - avgHistory);
      contextual.confidence = (contextual.confidence + consistency) / 2;
    }

    // Determine overall sentiment category
    let overallSentiment: typeof this.prototype.analyzeWithContext extends (...args: any[]) => infer R ? R extends Promise<infer P> ? P extends { overallSentiment: infer S } ? S : never : never : never;
    const v = dimensions.valence;
    const a = dimensions.arousal;

    if (sarcasm.isSarcastic) {
      overallSentiment = 'mixed';
    } else if (v > 0.6) {
      overallSentiment = 'very_positive';
    } else if (v > 0.2) {
      overallSentiment = 'positive';
    } else if (v < -0.6) {
      overallSentiment = 'very_negative';
    } else if (v < -0.2) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }

    // Store for future baseline calculation
    this.storeSentiment(userId, dimensions.valence);

    return {
      dimensions,
      sarcasm,
      contextual,
      overallSentiment
    };
  }

  /**
   * Get user's baseline sentiment
   */
  private getUserBaseline(userId: string): number {
    const history = this.userSentimentHistory.get(userId);
    if (!history || history.length === 0) return 0;
    
    const recent = history.slice(-this.HISTORY_WINDOW);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  /**
   * Store sentiment for baseline calculation
   */
  private storeSentiment(userId: string, valence: number): void {
    if (!this.userSentimentHistory.has(userId)) {
      this.userSentimentHistory.set(userId, []);
    }
    const history = this.userSentimentHistory.get(userId)!;
    history.push(valence);
    
    if (history.length > this.HISTORY_WINDOW * 2) {
      this.userSentimentHistory.set(userId, history.slice(-this.HISTORY_WINDOW));
    }
  }

  /**
   * Get sentiment trend for user
   */
  getSentimentTrend(userId: string): {
    trend: 'improving' | 'stable' | 'declining';
    volatility: number;
    average: number;
  } {
    const history = this.userSentimentHistory.get(userId) || [];
    if (history.length < 3) {
      return { trend: 'stable', volatility: 0, average: 0 };
    }

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((a, b) => a + b, 0) / older.length 
      : recentAvg;

    // Calculate volatility (standard deviation)
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - recentAvg, 2), 0) / recent.length;
    const volatility = Math.sqrt(variance);

    return {
      trend: recentAvg > olderAvg + 0.1 ? 'improving' : recentAvg < olderAvg - 0.1 ? 'declining' : 'stable',
      volatility,
      average: recentAvg
    };
  }

  /**
   * Generate sentiment-aware response guidance
   */
  generateResponseGuidance(analysis: ReturnType<typeof this.analyzeWithContext>): string {
    const guidance: string[] = [];

    // Emotional state guidance
    if (analysis.dimensions.arousal > 0.7) {
      guidance.push('User is highly aroused/emotional. Respond calmly and reassuringly.');
    }

    if (analysis.dimensions.dominance < 0.3) {
      guidance.push('User may feel overwhelmed. Offer clear, structured help.');
    }

    // Sarcasm handling
    if (analysis.sarcasm.isSarcastic) {
      guidance.push('Sarcasm detected. Acknowledge frustration without being defensive.');
    }

    // Contextual trend guidance
    if (analysis.contextual.trend === 'declining' && analysis.contextual.delta < -0.3) {
      guidance.push('User sentiment is declining significantly. Extra empathy needed.');
    }

    if (analysis.contextual.trend === 'improving') {
      guidance.push('User sentiment is improving. Maintain positive momentum.');
    }

    // Confidence-based guidance
    if (analysis.contextual.confidence < 0.5) {
      guidance.push('Low sentiment confidence. Ask clarifying questions if needed.');
    }

    return guidance.join(' ');
  }
}

export const advancedSentiment = new AdvancedSentimentAnalyzer();
