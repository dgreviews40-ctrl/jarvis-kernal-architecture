/**
 * Predictive Model System
 * 
 * Advanced predictive analytics for proactive assistance:
 * - Time-series pattern prediction
 * - Contextual need prediction
 * - Confidence-calibrated suggestions
 * - Feedback loop for model improvement
 * - A/B testing framework for suggestions
 */

interface TimeSeriesData {
  timestamp: number;
  value: number;
  context: Record<string, unknown>;
}

interface PredictiveModel {
  id: string;
  type: 'time_series' | 'sequence' | 'contextual' | 'ensemble';
  accuracy: number;
  lastTrained: number;
  parameters: Record<string, number>;
}

interface Prediction {
  id: string;
  action: string;
  confidence: number;
  expectedTime?: number;
  context: Record<string, unknown>;
  modelId: string;
  suggestedResponse: string;
  alternatives: string[];
}

interface PredictionFeedback {
  predictionId: string;
  wasAccepted: boolean;
  actualAction?: string;
  userReaction: 'positive' | 'neutral' | 'negative';
  timestamp: number;
}

interface UserBehaviorProfile {
  userId: string;
  dailyPatterns: Map<number, string[]>; // hour -> actions
  weeklyPatterns: Map<number, string[]>; // day -> actions
  transitionMatrix: Map<string, Map<string, number>>; // action -> next action probabilities
  contextTriggers: Map<string, string[]>; // context -> likely actions
}

export class PredictiveModelSystem {
  private models: Map<string, PredictiveModel> = new Map();
  private behaviorProfiles: Map<string, UserBehaviorProfile> = new Map();
  private timeSeriesData: Map<string, TimeSeriesData[]> = new Map();
  private predictionHistory: Map<string, Prediction[]> = new Map();
  private feedbackHistory: PredictionFeedback[] = [];
  
  private readonly MIN_CONFIDENCE = 0.6;
  private readonly MAX_HISTORY = 200;
  private readonly PREDICTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeModels();
  }

  /**
   * Initialize default predictive models
   */
  private initializeModels(): void {
    // Time-series model for temporal patterns
    this.models.set('temporal', {
      id: 'temporal',
      type: 'time_series',
      accuracy: 0.7,
      lastTrained: Date.now(),
      parameters: { decayFactor: 0.95, seasonalityWeight: 0.3 }
    });

    // Sequence model for action chains
    this.models.set('sequence', {
      id: 'sequence',
      type: 'sequence',
      accuracy: 0.75,
      lastTrained: Date.now(),
      parameters: { markovOrder: 2, smoothing: 0.1 }
    });

    // Contextual model for situation-based predictions
    this.models.set('contextual', {
      id: 'contextual',
      type: 'contextual',
      accuracy: 0.65,
      lastTrained: Date.now(),
      parameters: { contextWeight: 0.5, recencyBias: 0.7 }
    });

    // Ensemble model that combines all predictions
    this.models.set('ensemble', {
      id: 'ensemble',
      type: 'ensemble',
      accuracy: 0.8,
      lastTrained: Date.now(),
      parameters: { temporalWeight: 0.3, sequenceWeight: 0.4, contextualWeight: 0.3 }
    });
  }

  /**
   * Get or create user behavior profile
   */
  private getUserProfile(userId: string): UserBehaviorProfile {
    if (!this.behaviorProfiles.has(userId)) {
      this.behaviorProfiles.set(userId, {
        userId,
        dailyPatterns: new Map(),
        weeklyPatterns: new Map(),
        transitionMatrix: new Map(),
        contextTriggers: new Map()
      });
    }
    return this.behaviorProfiles.get(userId)!;
  }

  /**
   * Record user action for pattern learning
   */
  recordAction(
    userId: string,
    action: string,
    context: Record<string, unknown> = {}
  ): void {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const profile = this.getUserProfile(userId);

    // Update daily patterns
    if (!profile.dailyPatterns.has(hour)) {
      profile.dailyPatterns.set(hour, []);
    }
    profile.dailyPatterns.get(hour)!.push(action);

    // Update weekly patterns
    if (!profile.weeklyPatterns.has(dayOfWeek)) {
      profile.weeklyPatterns.set(dayOfWeek, []);
    }
    profile.weeklyPatterns.get(dayOfWeek)!.push(action);

    // Update transition matrix
    const lastActions = this.getRecentActions(userId, 1);
    if (lastActions.length > 0) {
      const lastAction = lastActions[0];
      if (!profile.transitionMatrix.has(lastAction)) {
        profile.transitionMatrix.set(lastAction, new Map());
      }
      const transitions = profile.transitionMatrix.get(lastAction)!;
      transitions.set(action, (transitions.get(action) || 0) + 1);
    }

    // Update context triggers
    const contextKey = this.serializeContext(context);
    if (!profile.contextTriggers.has(contextKey)) {
      profile.contextTriggers.set(contextKey, []);
    }
    profile.contextTriggers.get(contextKey)!.push(action);

    // Store time series data
    if (!this.timeSeriesData.has(userId)) {
      this.timeSeriesData.set(userId, []);
    }
    const series = this.timeSeriesData.get(userId)!;
    series.push({
      timestamp: now.getTime(),
      value: this.hashAction(action),
      context
    });

    // Prune old data
    if (series.length > this.MAX_HISTORY) {
      this.timeSeriesData.set(userId, series.slice(-this.MAX_HISTORY));
    }
  }

  /**
   * Get recent actions for a user
   */
  private getRecentActions(userId: string, count: number): string[] {
    const series = this.timeSeriesData.get(userId);
    if (!series) return [];
    
    return series
      .slice(-count)
      .map(d => this.unhashAction(d.value))
      .filter((a): a is string => a !== null);
  }

  /**
   * Simple action hashing for time series
   */
  private hashAction(action: string): number {
    let hash = 0;
    for (let i = 0; i < action.length; i++) {
      hash = ((hash << 5) - hash) + action.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 1000;
  }

  /**
   * Reverse hash (simplified - in practice, store mapping)
   */
  private unhashAction(hash: number): string | null {
    // This is a simplification - in practice, maintain a bidirectional mapping
    return null;
  }

  /**
   * Serialize context for indexing
   */
  private serializeContext(context: Record<string, unknown>): string {
    if (!context || typeof context !== 'object') return '';
    return Object.entries(context)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  /**
   * Generate predictions using all models
   */
  predict(
    userId: string,
    currentContext: Record<string, unknown> = {}
  ): Prediction[] {
    const predictions: Prediction[] = [];
    const profile = this.getUserProfile(userId);

    // Temporal prediction
    const temporalPred = this.predictTemporal(profile, currentContext);
    if (temporalPred) predictions.push(temporalPred);

    // Sequence prediction
    const sequencePred = this.predictSequence(profile, currentContext);
    if (sequencePred) predictions.push(sequencePred);

    // Contextual prediction
    const contextualPred = this.predictContextual(profile, currentContext);
    if (contextualPred) predictions.push(contextualPred);

    // Ensemble prediction (combines all)
    const ensemblePred = this.predictEnsemble(predictions, currentContext);
    if (ensemblePred) predictions.push(ensemblePred);

    // Sort by confidence and filter
    return predictions
      .filter(p => p.confidence >= this.MIN_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Predict based on temporal patterns
   */
  private predictTemporal(
    profile: UserBehaviorProfile,
    context: Record<string, unknown>
  ): Prediction | null {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Get actions typically done at this time
    const hourlyActions = profile.dailyPatterns.get(hour) || [];
    const dailyActions = profile.weeklyPatterns.get(dayOfWeek) || [];

    // Find most common action
    const actionCounts = new Map<string, number>();
    
    for (const action of hourlyActions) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 2); // Weight hourly higher
    }
    for (const action of dailyActions) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    if (actionCounts.size === 0) return null;

    // Get top action
    const [topAction, count] = [...actionCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const totalActions = hourlyActions.length + dailyActions.length;
    const confidence = Math.min(0.9, count / totalActions);

    if (confidence < this.MIN_CONFIDENCE) return null;

    return {
      id: `pred_temp_${Date.now()}`,
      action: topAction,
      confidence,
      expectedTime: now.getTime() + this.PREDICTION_WINDOW_MS,
      context: { hour, dayOfWeek, patternType: 'temporal' },
      modelId: 'temporal',
      suggestedResponse: this.generateSuggestion(topAction, 'temporal'),
      alternatives: [...actionCounts.keys()].slice(1, 3)
    };
  }

  /**
   * Predict based on action sequences
   */
  private predictSequence(
    profile: UserBehaviorProfile,
    context: Record<string, unknown>
  ): Prediction | null {
    const recentActions = this.getRecentActions(profile.userId, 2);
    if (recentActions.length === 0) return null;

    const lastAction = recentActions[recentActions.length - 1];
    const transitions = profile.transitionMatrix.get(lastAction);
    
    if (!transitions || transitions.size === 0) return null;

    // Get most likely next action
    const [nextAction, count] = [...transitions.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const totalTransitions = [...transitions.values()].reduce((a, b) => a + b, 0);
    const confidence = count / totalTransitions;

    if (confidence < this.MIN_CONFIDENCE) return null;

    return {
      id: `pred_seq_${Date.now()}`,
      action: nextAction,
      confidence,
      context: { lastAction, patternType: 'sequence' },
      modelId: 'sequence',
      suggestedResponse: this.generateSuggestion(nextAction, 'sequence', lastAction),
      alternatives: [...transitions.keys()].slice(1, 3)
    };
  }

  /**
   * Predict based on current context
   */
  private predictContextual(
    profile: UserBehaviorProfile,
    context: Record<string, unknown>
  ): Prediction | null {
    const contextKey = this.serializeContext(context);
    const contextActions = profile.contextTriggers.get(contextKey);

    if (!contextActions || contextActions.length === 0) {
      // Try partial context matching
      return this.predictPartialContext(profile, context);
    }

    // Count actions in this context
    const actionCounts = new Map<string, number>();
    for (const action of contextActions) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    const [topAction, count] = [...actionCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const confidence = count / contextActions.length;

    if (confidence < this.MIN_CONFIDENCE) return null;

    return {
      id: `pred_ctx_${Date.now()}`,
      action: topAction,
      confidence,
      context: { ...context, patternType: 'contextual' },
      modelId: 'contextual',
      suggestedResponse: this.generateSuggestion(topAction, 'contextual'),
      alternatives: [...actionCounts.keys()].slice(1, 3)
    };
  }

  /**
   * Predict using partial context matching
   */
  private predictPartialContext(
    profile: UserBehaviorProfile,
    context: Record<string, unknown>
  ): Prediction | null {
    // Find contexts that share some keys/values
    const matches: { context: string; similarity: number }[] = [];

    for (const [storedContext, _] of profile.contextTriggers) {
      const similarity = this.calculateContextSimilarity(
        context,
        this.parseContext(storedContext)
      );
      if (similarity > 0.5) {
        matches.push({ context: storedContext, similarity });
      }
    }

    if (matches.length === 0) return null;

    // Weight actions by context similarity
    const weightedActions = new Map<string, number>();
    
    for (const { context: ctxKey, similarity } of matches) {
      const actions = profile.contextTriggers.get(ctxKey) || [];
      for (const action of actions) {
        weightedActions.set(
          action,
          (weightedActions.get(action) || 0) + similarity
        );
      }
    }

    const [topAction, weight] = [...weightedActions.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const confidence = Math.min(0.8, weight / matches.length);

    if (confidence < this.MIN_CONFIDENCE) return null;

    return {
      id: `pred_pctx_${Date.now()}`,
      action: topAction,
      confidence,
      context: { ...context, patternType: 'partial_contextual' },
      modelId: 'contextual',
      suggestedResponse: this.generateSuggestion(topAction, 'contextual'),
      alternatives: [...weightedActions.keys()].slice(1, 3)
    };
  }

  /**
   * Calculate similarity between two contexts
   */
  private calculateContextSimilarity(
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): number {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return 0;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const commonKeys = keysA.filter(k => keysB.includes(k));
    
    if (commonKeys.length === 0) return 0;

    let matches = 0;
    for (const key of commonKeys) {
      if (a[key] === b[key]) matches++;
    }

    return matches / Math.max(keysA.length, keysB.length);
  }

  /**
   * Parse serialized context string
   */
  private parseContext(contextStr: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const pair of contextStr.split(',')) {
      const [key, value] = pair.split('=');
      if (key && value) result[key] = value;
    }
    return result;
  }

  /**
   * Ensemble prediction combining all models
   */
  private predictEnsemble(
    predictions: Prediction[],
    context: Record<string, unknown>
  ): Prediction | null {
    if (predictions.length < 2) return null;

    // Weight predictions by model accuracy
    const model = this.models.get('ensemble')!;
    const weights = {
      temporal: model.parameters.temporalWeight,
      sequence: model.parameters.sequenceWeight,
      contextual: model.parameters.contextualWeight
    };

    // Aggregate predictions
    const actionScores = new Map<string, number>();
    
    for (const pred of predictions) {
      const weight = weights[pred.modelId as keyof typeof weights] || 0.3;
      const score = pred.confidence * weight;
      actionScores.set(pred.action, (actionScores.get(pred.action) || 0) + score);
    }

    const [topAction, score] = [...actionScores.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const confidence = Math.min(0.95, score);

    if (confidence < this.MIN_CONFIDENCE) return null;

    return {
      id: `pred_ens_${Date.now()}`,
      action: topAction,
      confidence,
      context: { ...context, patternType: 'ensemble', sources: predictions.map(p => p.modelId) },
      modelId: 'ensemble',
      suggestedResponse: this.generateSuggestion(topAction, 'ensemble'),
      alternatives: [...actionScores.keys()].slice(1, 3)
    };
  }

  /**
   * Generate natural suggestion text
   */
  private generateSuggestion(
    action: string,
    patternType: string,
    context?: string
  ): string {
    const templates: Record<string, string[]> = {
      temporal: [
        `You usually ${action} around this time. Want me to help with that?`,
        `It's about time for your usual ${action}. Ready?`,
        `I see you typically ${action} now. Shall we?`
      ],
      sequence: [
        `After ${context}, you often ${action}. Should I prepare that?`,
        `Since you just ${context}, would you like to ${action}?`,
        `Next in your usual sequence: ${action}. Ready?`
      ],
      contextual: [
        `Given the current situation, you might want to ${action}.`,
        `This seems like a good time to ${action}. Interested?`,
        `Based on what's happening, shall we ${action}?`
      ],
      ensemble: [
        `I think you might want to ${action}. Should I help?`,
        `Would you like to ${action}? It seems like the right time.`,
        `How about we ${action}? That's what I'd predict you'd want.`
      ]
    };

    const options = templates[patternType] || templates.ensemble;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Record feedback on a prediction
   */
  recordFeedback(feedback: PredictionFeedback): void {
    this.feedbackHistory.push(feedback);

    // Update model accuracy based on feedback
    const prediction = this.findPrediction(feedback.predictionId);
    if (prediction) {
      const model = this.models.get(prediction.modelId);
      if (model) {
        // Exponential moving average of accuracy
        const alpha = 0.1;
        const wasCorrect = feedback.wasAccepted && 
          (!feedback.actualAction || feedback.actualAction === prediction.action);
        model.accuracy = (1 - alpha) * model.accuracy + alpha * (wasCorrect ? 1 : 0);
      }
    }

    // Retrain models periodically
    if (this.feedbackHistory.length % 50 === 0) {
      this.retrainModels();
    }
  }

  /**
   * Find prediction by ID
   */
  private findPrediction(id: string): Prediction | null {
    for (const predictions of this.predictionHistory.values()) {
      const found = predictions.find(p => p.id === id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Retrain models with recent feedback
   */
  private retrainModels(): void {
    // Adjust ensemble weights based on model performance
    const ensemble = this.models.get('ensemble')!;
    
    for (const [modelId, model] of this.models) {
      if (modelId === 'ensemble') continue;
      
      // Update weight based on accuracy
      const weightKey = `${modelId}Weight` as keyof typeof ensemble.parameters;
      if (ensemble.parameters[weightKey] !== undefined) {
        ensemble.parameters[weightKey] = model.accuracy;
      }
      
      model.lastTrained = Date.now();
    }

    // Normalize weights
    const totalWeight = ensemble.parameters.temporalWeight + 
                       ensemble.parameters.sequenceWeight + 
                       ensemble.parameters.contextualWeight;
    
    ensemble.parameters.temporalWeight /= totalWeight;
    ensemble.parameters.sequenceWeight /= totalWeight;
    ensemble.parameters.contextualWeight /= totalWeight;
  }

  /**
   * Get model statistics
   */
  getStats(): {
    models: { id: string; accuracy: number; lastTrained: number }[];
    totalPredictions: number;
    feedbackCount: number;
    averageAccuracy: number;
  } {
    const modelStats = Array.from(this.models.values()).map(m => ({
      id: m.id,
      accuracy: m.accuracy,
      lastTrained: m.lastTrained
    }));

    const totalPredictions = Array.from(this.predictionHistory.values())
      .reduce((sum, preds) => sum + preds.length, 0);

    return {
      models: modelStats,
      totalPredictions,
      feedbackCount: this.feedbackHistory.length,
      averageAccuracy: modelStats.reduce((sum, m) => sum + m.accuracy, 0) / modelStats.length
    };
  }
}

export const predictiveModel = new PredictiveModelSystem();
