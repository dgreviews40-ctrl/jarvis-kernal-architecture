/**
 * Predictive Capabilities Service for JARVIS Kernel v1.3
 * 
 * Implements machine learning features for:
 * - User behavior prediction
 * - Proactive suggestion engine
 * - Adaptive learning algorithms
 */

import { logger } from './logger';
import { eventBus } from './eventBus';

interface UserInteraction {
  userId: string;
  timestamp: number;
  action: string;
  context: string;
  outcome: 'success' | 'failure' | 'abandoned';
}

interface PredictionModel {
  id: string;
  userId: string;
  featureWeights: Map<string, number>;
  bias: number;
  lastUpdated: number;
  accuracy: number;
}

interface Suggestion {
  action: string;
  confidence: number;
  context: string;
  timestamp: number;
}

export class PredictiveService {
  private static instance: PredictiveService;
  private userInteractions: Map<string, UserInteraction[]> = new Map();
  private predictionModels: Map<string, PredictionModel> = new Map();
  private proactiveSuggestions: Map<string, Suggestion[]> = new Map();
  private readonly LEARNING_RATE = 0.1;
  private readonly FORGET_FACTOR = 0.95; // How much past data to retain
  private readonly MIN_INTERACTIONS = 5; // Minimum interactions to build a model
  private readonly SUGGESTION_TTL = 3600000; // 1 hour in milliseconds

  private constructor() {}

  public static getInstance(): PredictiveService {
    if (!PredictiveService.instance) {
      PredictiveService.instance = new PredictiveService();
    }
    return PredictiveService.instance;
  }

  /**
   * Record a user interaction for learning
   */
  public recordInteraction(userId: string, action: string, context: string, outcome: 'success' | 'failure' | 'abandoned' = 'success'): void {
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, []);
    }

    const interactions = this.userInteractions.get(userId)!;
    interactions.push({
      userId,
      timestamp: Date.now(),
      action,
      context,
      outcome
    });

    // Keep only recent interactions to prevent memory bloat
    if (interactions.length > 1000) {
      this.userInteractions.set(userId, interactions.slice(-500)); // Keep last 500
    }

    // Update the prediction model for this user
    this.updateUserModel(userId);

    logger.log('SYSTEM', `Recorded interaction for user ${userId}: ${action}`, 'info');
  }

  /**
   * Predict what action a user might take next
   */
  public predictNextAction(userId: string, context: { topics?: string[], sentiment?: string, timeOfDay?: number }): { action: string; confidence: number } | null {
    const model = this.predictionModels.get(userId);
    if (!model) {
      // If no model exists, return null
      return null;
    }

    // Create feature vector from context
    const features = this.createFeatureVector(context);

    // Calculate prediction score
    let score = model.bias;
    for (const [feature, value] of features.entries()) {
      const weight = model.featureWeights.get(feature) || 0;
      score += weight * value;
    }

    // Normalize score to 0-1 range
    const confidence = Math.max(0, Math.min(1, (score + 1) / 2));

    // For now, return a dummy action based on the highest weighted feature
    let predictedAction = 'unknown';
    let maxWeight = -Infinity;
    for (const [feature, weight] of model.featureWeights.entries()) {
      if (weight > maxWeight) {
        maxWeight = weight;
        predictedAction = feature;
      }
    }

    logger.log('SYSTEM', `Predicted action for user ${userId}: ${predictedAction} (confidence: ${confidence})`, 'info');
    return { action: predictedAction, confidence };
  }

  /**
   * Get proactive suggestions for a user
   */
  public getSuggestions(context: { currentTopic?: string, sentiment?: string, timeOfDay?: number }): string[] {
    const now = Date.now();
    const suggestions: string[] = [];

    // Clean up expired suggestions
    for (const [userId, userSuggestions] of this.proactiveSuggestions.entries()) {
      const validSuggestions = userSuggestions.filter(s => now - s.timestamp < this.SUGGESTION_TTL);
      this.proactiveSuggestions.set(userId, validSuggestions);
    }

    // Get all suggestions across all users
    for (const userSuggestions of this.proactiveSuggestions.values()) {
      suggestions.push(...userSuggestions
        .filter(s => now - s.timestamp < this.SUGGESTION_TTL)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
        .map(s => s.action)
      );
    }

    logger.log('SYSTEM', `Generated ${suggestions.length} proactive suggestions`, 'info');
    return suggestions;
  }

  /**
   * Generate a proactive suggestion for a user
   */
  public generateSuggestion(userId: string, action: string, confidence: number, context: string): void {
    if (!this.proactiveSuggestions.has(userId)) {
      this.proactiveSuggestions.set(userId, []);
    }

    const suggestions = this.proactiveSuggestions.get(userId)!;
    suggestions.push({
      action,
      confidence,
      context,
      timestamp: Date.now()
    });

    // Keep only recent suggestions
    if (suggestions.length > 10) {
      this.proactiveSuggestions.set(userId, suggestions.slice(-10));
    }

    logger.log('SYSTEM', `Generated suggestion for user ${userId}: ${action} (confidence: ${confidence})`, 'info');
  }

  /**
   * Update the prediction model for a user based on their interactions
   */
  private updateUserModel(userId: string): void {
    const interactions = this.userInteractions.get(userId) || [];
    
    if (interactions.length < this.MIN_INTERACTIONS) {
      // Not enough data to build a model yet
      return;
    }

    // Create feature matrix and target vector
    const featureMatrix: Map<string, number>[] = [];
    const targetVector: number[] = []; // 1 for success, 0 for failure/abandoned

    for (const interaction of interactions) {
      const features = this.createFeatureVector({
        topics: interaction.context.split(' '),
        sentiment: 'neutral', // Placeholder
        timeOfDay: new Date(interaction.timestamp).getHours()
      });

      featureMatrix.push(features);
      targetVector.push(interaction.outcome === 'success' ? 1 : 0);
    }

    // Initialize or get existing model
    let model = this.predictionModels.get(userId);
    if (!model) {
      model = {
        id: `model_${userId}`,
        userId,
        featureWeights: new Map(),
        bias: 0,
        lastUpdated: Date.now(),
        accuracy: 0
      };
    }

    // Update weights using gradient descent
    const newWeights = new Map(model.featureWeights);
    let newBias = model.bias;

    // Perform one iteration of gradient descent
    for (let i = 0; i < featureMatrix.length; i++) {
      const features = featureMatrix[i];
      const target = targetVector[i];

      // Calculate prediction
      let prediction = model.bias;
      for (const [feature, value] of features.entries()) {
        const weight = model.featureWeights.get(feature) || 0;
        prediction += weight * value;
      }

      // Calculate error
      const error = prediction - target;

      // Update bias
      newBias -= this.LEARNING_RATE * error;

      // Update weights
      for (const [feature, value] of features.entries()) {
        const currentWeight = model.featureWeights.get(feature) || 0;
        const gradient = error * value;
        const newWeight = currentWeight - this.LEARNING_RATE * gradient;
        newWeights.set(feature, newWeight);
      }
    }

    // Calculate accuracy
    let correctPredictions = 0;
    for (let i = 0; i < featureMatrix.length; i++) {
      const features = featureMatrix[i];
      const target = targetVector[i];

      let prediction = newBias;
      for (const [feature, value] of features.entries()) {
        const weight = newWeights.get(feature) || 0;
        prediction += weight * value;
      }

      // Round to nearest class (0 or 1)
      const predictedClass = prediction > 0.5 ? 1 : 0;
      if (predictedClass === target) {
        correctPredictions++;
      }
    }

    const accuracy = correctPredictions / featureMatrix.length;

    // Update the model
    model.featureWeights = newWeights;
    model.bias = newBias;
    model.lastUpdated = Date.now();
    model.accuracy = accuracy;

    this.predictionModels.set(userId, model);

    logger.log('SYSTEM', `Updated model for user ${userId} (accuracy: ${accuracy})`, 'info');
  }

  /**
   * Create a feature vector from context
   */
  private createFeatureVector(context: { topics?: string[], sentiment?: string, timeOfDay?: number }): Map<string, number> {
    const features = new Map<string, number>();

    // Add topic features
    if (context.topics) {
      for (const topic of context.topics) {
        const feature = `topic_${topic.toLowerCase()}`;
        features.set(feature, (features.get(feature) || 0) + 1);
      }
    }

    // Add sentiment feature
    if (context.sentiment) {
      const feature = `sentiment_${context.sentiment.toLowerCase()}`;
      features.set(feature, 1);
    }

    // Add time of day feature
    if (context.timeOfDay !== undefined) {
      const hour = context.timeOfDay;
      const feature = `timeofday_${Math.floor(hour / 6)}`; // Group into 6-hour periods
      features.set(feature, 1);
    }

    // Add interaction patterns
    features.set('feature_intercept', 1); // Bias term

    return features;
  }

  /**
   * Get user interaction history
   */
  public getUserInteractions(userId: string): UserInteraction[] {
    return this.userInteractions.get(userId) || [];
  }

  /**
   * Get prediction model for a user
   */
  public getUserModel(userId: string): PredictionModel | null {
    return this.predictionModels.get(userId) || null;
  }

  /**
   * Get all user suggestions
   */
  public getUserSuggestions(userId: string): Suggestion[] {
    return this.proactiveSuggestions.get(userId) || [];
  }

  /**
   * Train the model with historical data
   */
  public async trainModel(userId: string, historicalData: UserInteraction[]): Promise<void> {
    // Add historical data to user interactions
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, []);
    }

    const interactions = this.userInteractions.get(userId)!;
    interactions.push(...historicalData);

    // Update the model
    this.updateUserModel(userId);

    logger.log('SYSTEM', `Trained model for user ${userId} with ${historicalData.length} historical interactions`, 'info');
  }

  /**
   * Get predictive service statistics
   */
  public getStats(): {
    totalUsers: number;
    totalInteractions: number;
    trainedModels: number;
    totalSuggestions: number;
    avgAccuracy: number;
  } {
    const totalInteractions = Array.from(this.userInteractions.values())
      .reduce((sum, interactions) => sum + interactions.length, 0);

    const trainedModels = this.predictionModels.size;
    const avgAccuracy = trainedModels > 0 
      ? Array.from(this.predictionModels.values()).reduce((sum, model) => sum + model.accuracy, 0) / trainedModels
      : 0;

    const totalSuggestions = Array.from(this.proactiveSuggestions.values())
      .reduce((sum, suggestions) => sum + suggestions.length, 0);

    return {
      totalUsers: this.userInteractions.size,
      totalInteractions,
      trainedModels,
      totalSuggestions,
      avgAccuracy
    };
  }

  /**
   * Clear all data for a user (for privacy compliance)
   */
  public clearUserData(userId: string): void {
    this.userInteractions.delete(userId);
    this.predictionModels.delete(userId);
    this.proactiveSuggestions.delete(userId);

    logger.log('SYSTEM', `Cleared all data for user ${userId}`, 'info');
  }

  /**
   * Clear all data (for testing purposes)
   */
  public clearAllData(): void {
    this.userInteractions.clear();
    this.predictionModels.clear();
    this.proactiveSuggestions.clear();

    logger.log('SYSTEM', 'Cleared all predictive data', 'info');
  }
}

// Export singleton instance
export const predictiveService = PredictiveService.getInstance();

// Initialize predictive service when module loads
logger.log('SYSTEM', 'Predictive service initialized', 'info');