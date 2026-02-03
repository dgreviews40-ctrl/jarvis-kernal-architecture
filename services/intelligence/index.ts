/**
 * JARVIS Intelligence Services (Consolidated)
 * 
 * Previously 6+ separate services, now consolidated into 3 focused modules:
 * - Conversation Service: Context, personality, natural responses
 * - Reasoning Service: Multi-turn reasoning, knowledge graph
 * - Prediction Service: User behavior prediction, proactive suggestions
 */

// Consolidated services
export { conversationService } from './conversationService';
export { reasoningService } from './reasoningService';
export { predictionService } from './predictionService';

// Legacy exports for backward compatibility (deprecated)
export { conversationFlow, ConversationFlowManager } from './conversationFlow';
export { advancedSentiment, AdvancedSentimentAnalyzer } from './advancedSentiment';
export { semanticMemory, SemanticMemorySystem } from './semanticMemory';

// ==================== UNIFIED INTERFACE ====================

import { conversationService } from './conversationService';
import { reasoningService } from './reasoningService';
import { predictionService } from './predictionService';
import { advancedSentiment } from './advancedSentiment';
import { semanticMemory } from './semanticMemory';
import { conversationFlow } from './conversationFlow';
import { ConversationTurn } from '../../types';

export interface IntelligenceContext {
  userInput: string;
  conversationHistory: ConversationTurn[];
  userId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceResult {
  systemPrompt: string;
  userPrompt: string;
  responseModifiers: {
    tone: string;
    style: string;
    addOpening: boolean;
    addClosing: boolean;
  };
  proactiveSuggestions: string[];
  requiresReasoning: boolean;
  reasoningContext?: string;
  sentimentAnalysis?: ReturnType<typeof advancedSentiment.analyzeWithContext>;
}

/**
 * Simplified Intelligence Orchestrator
 * Uses consolidated services for better maintainability
 */
export class IntelligenceOrchestrator {
  
  async process(context: IntelligenceContext): Promise<IntelligenceResult> {
    const { userInput, conversationHistory, userId } = context;

    // 1. Set up user context
    conversationService.setCurrentUser(userId);

    // 2. Extract topics and manage conversation context
    const topics = await conversationService.extractTopics(userInput);
    const turn: ConversationTurn = {
      id: `turn_${Date.now()}`,
      timestamp: Date.now(),
      speaker: 'USER',
      text: userInput
    };
    await conversationService.manageThread(turn, topics);

    // 3. Sentiment analysis
    const sentimentAnalysis = advancedSentiment.analyzeWithContext(
      userInput,
      userId,
      conversationHistory.slice(-3).map(t => t.text)
    );
    
    // 4. Update personality with sentiment
    conversationService.updateEmotion('user_input',
      sentimentAnalysis.overallSentiment.includes('positive') ? 'positive' :
      sentimentAnalysis.overallSentiment.includes('negative') ? 'negative' : 'neutral',
      Math.abs(sentimentAnalysis.dimensions.valence)
    );
    
    await conversationService.adaptToUser(userInput, sentimentAnalysis.overallSentiment);
    
    // Store semantic memory
    await semanticMemory.store(userInput, 'EPISODE', 
      topics.map(t => t.name),
      sentimentAnalysis.dimensions.valence
    );

    // 5. Extract entities and build knowledge
    reasoningService.extractEntities(userInput);
    reasoningService.inferRelationships(userInput);

    // 6. Check for multi-turn reasoning needs
    const reasoningCheck = reasoningService.requiresReasoning(userInput);
    let reasoningContext: string | undefined;
    
    if (reasoningCheck.required) {
      if (!reasoningService.getActiveChains().length) {
        reasoningService.startReasoning(userInput);
      }
      reasoningContext = reasoningService.buildReasoningPrompt(userInput);
    }

    // 7. Get enriched context
    const enrichedContext = conversationService.getEnrichedContext(conversationHistory);

    // 8. Build system prompt
    let systemPrompt = `You are JARVIS, an intelligent AI assistant.`;
    systemPrompt += conversationService.getPersonalityPrompt();
    systemPrompt += `\n\nContext: ${enrichedContext.activeTopics.map(t => t.name).join(', ')}`;

    // 9. Get predictions and suggestions
    predictionService.recordInteraction(userId, userInput, { topics: topics.map(t => t.name) });
    
    const predictions = predictionService.predict(userId, {
      topics: topics.map(t => t.name),
      sentiment: sentimentAnalysis.overallSentiment,
      timeOfDay: new Date().getHours()
    });
    
    const suggestions = predictionService.getSuggestions({
      currentTopic: topics[0]?.name,
      sentiment: sentimentAnalysis.overallSentiment
    });
    
    const proactiveSuggestions = [
      ...predictions.map(p => p.action),
      ...suggestions
    ].slice(0, 3);

    // 10. Process through conversation flow
    const flowResult = conversationFlow.processTurn(userInput, conversationHistory);

    // 11. Determine response modifiers
    const personalityStats = conversationService.getStats();
    
    return {
      systemPrompt,
      userPrompt: reasoningContext || userInput,
      responseModifiers: {
        tone: personalityStats.emotionalState,
        style: `${personalityStats.style.verbosity}_${personalityStats.style.formality}`,
        addOpening: flowResult.state.turnCount > 1,
        addClosing: flowResult.shouldFollowUp
      },
      proactiveSuggestions,
      requiresReasoning: reasoningCheck.required,
      reasoningContext,
      sentimentAnalysis
    };
  }

  postProcessResponse(
    rawResponse: string,
    modifiers: IntelligenceResult['responseModifiers']
  ): string {
    return conversationService.generateResponse(rawResponse, {
      addOpening: modifiers.addOpening,
      addClosing: modifiers.addClosing,
      tone: modifiers.tone as any
    });
  }

  handleInterruption(): string {
    const result = conversationFlow.handleInterruption();
    return conversationService.generateResponse(result.acknowledgment, {
      addOpening: false,
      addClosing: false,
      tone: 'neutral'
    });
  }

  generateGreeting(): string {
    const personalityGreeting = conversationService.generateGreeting();
    return conversationService.generateResponse(personalityGreeting, {
      addOpening: false,
      addClosing: true,
      tone: 'friendly'
    });
  }

  getStats(): {
    conversation: ReturnType<typeof conversationService.getStats>;
    reasoning: ReturnType<typeof reasoningService.getStats>;
    prediction: ReturnType<typeof predictionService.getStats>;
  } {
    return {
      conversation: conversationService.getStats(),
      reasoning: reasoningService.getStats(),
      prediction: predictionService.getStats()
    };
  }

  reset(): void {
    conversationService.clearContext();
    conversationService.resetPersonality();
    reasoningService.clear();
    reasoningService.resetChains();
    predictionService.clearAllData();
    conversationFlow.reset();
  }
}

export const intelligence = new IntelligenceOrchestrator();
