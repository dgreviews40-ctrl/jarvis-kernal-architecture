/**
 * Unified Sentiment Service
 * 
 * Phase 4, Task 2: Consolidates sentiment analysis systems
 * Combines moodDetection, advancedSentiment, and emotionalMemory
 * into a single, efficient pipeline
 */

import { advancedSentiment } from './advancedSentiment';
import { moodDetection, type MoodAnalysis } from '../moodDetection';
import { emotionalMemory, type EmotionalMoment, type MomentType } from '../emotionalMemory';

export interface UnifiedSentimentResult {
  // Core sentiment
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  
  // Emotional dimensions
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  dominance: number; // 0 to 1
  
  // Detected mood
  primaryMood: string;
  secondaryMoods: string[];
  moodIntensity: number;
  
  // Trend analysis
  trend: 'improving' | 'declining' | 'stable' | 'fluctuating';
  trendConfidence: number;
  
  // Sarcasm detection
  isSarcastic: boolean;
  sarcasmIndicators: string[];
  
  // Response guidance
  responseGuidance: {
    tone: string;
    pace: 'slower' | 'normal' | 'faster';
    empathy: 'high' | 'normal' | 'low';
    formality: 'casual' | 'neutral' | 'formal';
    useName: boolean;
    offerHelp: boolean;
  };
  
  // Indicators
  indicators: string[];
  
  // Timestamp for tracking
  timestamp: number;
}

export interface SentimentHistoryEntry {
  timestamp: number;
  sentiment: string;
  mood: string;
  valence: number;
}

interface MoodWithTrend extends MoodAnalysis {
  trend: {
    trend: 'improving' | 'declining' | 'stable' | 'fluctuating';
    trendConfidence: number;
  };
}

/**
 * Unified sentiment analysis service
 * Consolidates multiple sentiment systems into one efficient pipeline
 */
export class UnifiedSentimentService {
  private history: SentimentHistoryEntry[] = [];
  private readonly MAX_HISTORY = 20;
  private lastAnalysis: UnifiedSentimentResult | null = null;
  private cacheExpiry = 5000; // 5 seconds
  private lastAnalysisTime = 0;

  /**
   * Analyze text with unified sentiment pipeline
   * Combines advancedSentiment, moodDetection, and emotionalMemory
   */
  async analyze(
    text: string,
    options: {
      userId?: string;
      conversationHistory?: string[];
      origin?: 'USER_TEXT' | 'USER_VOICE';
      useCache?: boolean;
    } = {}
  ): Promise<UnifiedSentimentResult> {
    const { 
      userId = 'default', 
      conversationHistory = [], 
      origin = 'USER_TEXT',
      useCache = true 
    } = options;

    // Check cache for recent identical analysis
    if (useCache && this.lastAnalysis && (Date.now() - this.lastAnalysisTime) < this.cacheExpiry) {
      return this.lastAnalysis;
    }

    // Run analyses in parallel for efficiency
    const [advancedResult, moodResult] = await Promise.all([
      advancedSentiment.analyzeWithContext(
        text,
        userId,
        conversationHistory.slice(-3)
      ),
      this.runMoodDetection(text, origin)
    ]);

    // Merge results into unified format
    const unified = this.mergeResults(advancedResult, moodResult);
    
    // Add to history
    this.addToHistory(unified);
    
    // Update cache
    this.lastAnalysis = unified;
    this.lastAnalysisTime = Date.now();

    return unified;
  }

  /**
   * Run mood detection with trend
   */
  private async runMoodDetection(
    text: string,
    origin: 'USER_TEXT' | 'USER_VOICE'
  ): Promise<MoodWithTrend> {
    const mood = await moodDetection.analyzeMood(text, origin);
    const trend = moodDetection.getMoodWithTrend();
    return { ...mood, trend };
  }

  /**
   * Merge results from multiple sentiment systems
   */
  private mergeResults(
    advanced: ReturnType<typeof advancedSentiment.analyzeWithContext>,
    mood: MoodWithTrend
  ): UnifiedSentimentResult {
    // Determine primary sentiment
    let sentiment: UnifiedSentimentResult['sentiment'];
    if (advanced.overallSentiment.includes('positive')) sentiment = 'positive';
    else if (advanced.overallSentiment.includes('negative')) sentiment = 'negative';
    else sentiment = 'neutral';

    // Calculate confidence from both systems
    const confidence = Math.max(
      0.5, // default if not available
      mood.confidence || 0.5
    );

    // Merge emotional dimensions (prioritize advanced sentiment)
    const valence = advanced.dimensions?.valence ?? (mood.valence === 'positive' ? 0.5 : mood.valence === 'negative' ? -0.5 : 0);
    const arousal = advanced.dimensions?.arousal ?? mood.intensity ?? 0.5;
    const dominance = advanced.dimensions?.dominance ?? 0.5;

    // Merge moods
    const primaryMood = mood.primaryMood || 'neutral';
    const secondaryMoods = mood.secondaryMoods || [];

    // Merge indicators
    const indicators = [
      ...(advanced.sarcasm?.indicators || []),
      ...(mood.indicators || [])
    ];

    // Build response guidance
    const responseGuidance: UnifiedSentimentResult['responseGuidance'] = {
      tone: mood.suggestedApproach?.tone || this.getToneFromSentiment(sentiment),
      pace: mood.suggestedApproach?.pace || 'normal',
      empathy: mood.suggestedApproach?.empathy || this.getEmpathyFromSentiment(sentiment),
      formality: mood.suggestedApproach?.formality || 'neutral',
      useName: mood.suggestedApproach?.useName || sentiment !== 'neutral',
      offerHelp: mood.suggestedApproach?.offerHelp || sentiment === 'negative'
    };

    return {
      sentiment,
      confidence,
      valence,
      arousal,
      dominance,
      primaryMood,
      secondaryMoods,
      moodIntensity: mood.intensity || 0.5,
      trend: mood.trend?.trend || 'stable',
      trendConfidence: mood.trend?.trendConfidence || 0.5,
      isSarcastic: advanced.sarcasm?.isSarcastic || false,
      sarcasmIndicators: advanced.sarcasm?.indicators || [],
      responseGuidance,
      indicators,
      timestamp: Date.now()
    };
  }

  /**
   * Get tone from sentiment
   */
  private getToneFromSentiment(sentiment: string): string {
    switch (sentiment) {
      case 'positive': return 'friendly and enthusiastic';
      case 'negative': return 'calm and supportive';
      default: return 'neutral and professional';
    }
  }

  /**
   * Get empathy level from sentiment
   */
  private getEmpathyFromSentiment(sentiment: string): 'high' | 'normal' | 'low' {
    switch (sentiment) {
      case 'negative': return 'high';
      case 'positive': return 'normal';
      default: return 'low';
    }
  }

  /**
   * Add entry to history
   */
  private addToHistory(result: UnifiedSentimentResult): void {
    this.history.push({
      timestamp: result.timestamp,
      sentiment: result.sentiment,
      mood: result.primaryMood,
      valence: result.valence
    });

    // Trim history
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get sentiment history
   */
  getHistory(): SentimentHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Record emotional moment (proxied to emotionalMemory)
   */
  async recordMoment(
    type: MomentType,
    content: string,
    emotion: { valence: 'positive' | 'negative' | 'neutral'; intensity: number; primaryEmotion: string }
  ): Promise<void> {
    await emotionalMemory.recordMoment(type, content, emotion);
  }

  /**
   * Get unresolved concerns (proxied to emotionalMemory)
   */
  getUnresolvedConcerns(): EmotionalMoment[] {
    return emotionalMemory.getUnresolvedConcerns();
  }

  /**
   * Get current mood summary
   */
  getCurrentMoodSummary(): {
    currentMood: string;
    recentTrend: string;
    averageValence: number;
  } {
    if (this.history.length === 0) {
      return { currentMood: 'neutral', recentTrend: 'stable', averageValence: 0 };
    }

    const recent = this.history.slice(-5);
    const averageValence = recent.reduce((sum, h) => sum + h.valence, 0) / recent.length;
    
    // Determine trend
    let trend = 'stable';
    if (recent.length >= 3) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const firstAvg = firstHalf.reduce((sum, h) => sum + h.valence, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, h) => sum + h.valence, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.2) trend = 'improving';
      else if (secondAvg < firstAvg - 0.2) trend = 'declining';
    }

    return {
      currentMood: recent[recent.length - 1].mood,
      recentTrend: trend,
      averageValence
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.lastAnalysis = null;
  }
}

// Export singleton
export const unifiedSentiment = new UnifiedSentimentService();
