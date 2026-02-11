/**
 * JARVIS Intelligence Services (Consolidated)
 * 
 * Previously 6+ separate services, now consolidated into 3 focused modules:
 * - Conversation Service: Context, personality, natural responses
 * - Reasoning Service: Multi-turn reasoning, knowledge graph
 * - Prediction Service: User behavior prediction, proactive suggestions
 * 
 * v2.0: Added JARVIS Personality Engine for human-like interactions
 */

// Consolidated services
export { conversationService } from './conversationService';
export { reasoningService } from './reasoningService';
export { predictionService } from './predictionService';

// NEW: Human-like personality and formatting
export { jarvisPersonality, JARVISPersonality } from '../jarvisPersonality';
export { conversationalFormatter, ConversationalFormatter } from '../conversationalFormatter';

// NEW: Emotional Intelligence System
export { 
  emotionalMemory, 
  EmotionalMemoryService,
  type EmotionalMoment,
  type MomentType,
  type EmotionalContext,
  type UserMoodState,
  type TimeContext
} from '../emotionalMemory';

export { 
  contextualGreeting, 
  ContextualGreetingService,
  type GreetingContext,
  type GreetingResult
} from '../contextualGreeting';

export { 
  proactiveCheckIn, 
  ProactiveCheckInService,
  type CheckInOpportunity,
  type ConversationContext
} from '../proactiveCheckIn';

export { 
  moodDetection, 
  MoodDetectionService,
  type MoodAnalysis,
  type ConversationMetrics
} from '../moodDetection';

// Phase 1, Task 1: Proactive Event Handler
export {
  proactiveEventHandler,
  ProactiveEventHandler,
  type ProactiveDisplayOptions,
  type ProactiveSuggestion
} from '../proactiveEventHandler';

// Phase 1, Task 2: Natural Response Generator
export {
  naturalResponse,
  NaturalResponseGenerator
} from './naturalResponse';

// Phase 2, Task 2: Knowledge Graph
export {
  knowledgeGraph,
  KnowledgeGraph
} from './knowledgeGraph';

// Phase 4, Task 2: Unified Sentiment Service (consolidates moodDetection, advancedSentiment, emotionalMemory)
export {
  unifiedSentiment,
  UnifiedSentimentService,
  type UnifiedSentimentResult
} from './unifiedSentiment';

// Legacy exports for backward compatibility (deprecated)
export { conversationFlow, ConversationFlowManager } from './conversationFlow';
export { advancedSentiment, AdvancedSentimentAnalyzer } from './advancedSentiment';
export { semanticMemory, SemanticMemorySystem } from './semanticMemory';

// Helper function to get user identity for system prompts
async function getUserIdentityContext(): Promise<string> {
  try {
    // Try vector memory service first
    const { vectorMemoryService } = await import('../vectorMemoryService');
    const identity = await vectorMemoryService.getUserIdentity();
    const hobbies = await vectorMemoryService.getUserHobbies();
    
    let context = '';
    
    if (identity) {
      context = `\n\nUSER INFORMATION:\n${identity.content}`;
    }
    
    // Add hobbies if found
    if (hobbies.length > 0) {
      const hobbyList = hobbies.map(h => h.content.replace(/^User\s+hobby:\s*/i, '').trim()).join(', ');
      if (context) {
        context += `\nHOBBIES: ${hobbyList}`;
      } else {
        context = `\n\nUSER INFORMATION:\nHOBBIES: ${hobbyList}`;
      }
    }
    
    if (context) {
      return context;
    }
    
    // Fallback to legacy memory
    const { memory } = await import('../memory');
    const legacyIdentity = await memory.getUserIdentity();
    if (legacyIdentity) {
      return `\n\nUSER INFORMATION:\n${legacyIdentity.content}`;
    }
  } catch (error) {
    // Silently fail - identity context is optional
  }
  return '';
}

// ==================== UNIFIED INTERFACE ====================

import { conversationService } from './conversationService';
import { reasoningService } from './reasoningService';
import { predictionService } from './predictionService';
import { advancedSentiment } from './advancedSentiment';
import { semanticMemory } from './semanticMemory';
import { conversationFlow } from './conversationFlow';
import { knowledgeGraph } from './knowledgeGraph';
import { ConversationTurn } from '../../types';
import { jarvisPersonality } from '../jarvisPersonality';
import { conversationalFormatter } from '../conversationalFormatter';

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
  // Phase 1, Task 3: Strategic response guidance
  strategicGuidance?: {
    strategy: string;
    tone: string;
    stage: string;
    engagement: string;
    guidance: string;
  };
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

    // 5b. Phase 2, Task 2: Query knowledge graph for contextual information
    const kgContext = knowledgeGraph.getContextForPrompt(userInput);
    if (kgContext.hasContext) {
      // Add entities to knowledge graph for future reference
      knowledgeGraph.extractEntities(userInput);
      knowledgeGraph.inferRelationships(userInput);
    }

    // 5c. Phase 4, Task 1: Retrieve relevant semantic memories for context
    const semanticContext = await semanticMemory.getRelevantMemories(userInput, {
      maxResults: 3,
      minScore: 0.3,
      includeRelated: true
    });

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

    // 8. Build system prompt with NEW rich personality
    // v2.0: Use the comprehensive personality engine
    let systemPrompt = await jarvisPersonality.generatePersonaPrompt();
    systemPrompt += conversationService.getPersonalityPrompt();
    systemPrompt += `\n\nContext: ${enrichedContext.activeTopics.map(t => t.name).join(', ')}`;

    // Phase 2, Task 2: Add knowledge graph context if available
    if (kgContext.hasContext) {
      systemPrompt += `\n\nKNOWN FACTS: ${kgContext.contextText}`;
      systemPrompt += `\n(You know these facts about: ${kgContext.entities.join(', ')})`;
    }

    // Phase 4, Task 1: Add semantic memory context if available
    if (semanticContext.hasMemories) {
      systemPrompt += `\n\nRELEVANT MEMORIES:\n${semanticContext.contextText}`;
      systemPrompt += `\n(Use this context naturally, don't explicitly mention "remembering")`;
    }

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

    // 11. Get strategic guidance for response generation
    const strategicGuidance = conversationFlow.getStrategicGuidance();

    // 12. Enhance system prompt with strategic guidance
    systemPrompt += `\n\nRESPONSE STRATEGY: ${strategicGuidance.strategy.toUpperCase()} (${strategicGuidance.tone})`;
    systemPrompt += `\nCONVERSATION STAGE: ${strategicGuidance.stage} | ENGAGEMENT: ${strategicGuidance.engagement}`;
    systemPrompt += `\n\nGuidance: ${strategicGuidance.guidance}`;

    // 13. Determine response modifiers
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
      sentimentAnalysis,
      strategicGuidance
    };
  }

  postProcessResponse(
    rawResponse: string,
    modifiers: IntelligenceResult['responseModifiers']
  ): string {
    // v2.0: First apply conversation service formatting
    let response = conversationService.generateResponse(rawResponse, {
      addOpening: modifiers.addOpening,
      addClosing: modifiers.addClosing,
      tone: modifiers.tone as any
    });
    
    // v2.0: Then naturally insert user's name if appropriate
    if (jarvisPersonality.knowsUserName() && Math.random() > 0.5) {
      response = jarvisPersonality.naturallyInsertName(response);
    }
    
    return response;
  }

  /**
   * NEW v2.0: Get thinking indicator for complex operations
   */
  getThinkingIndicator(): string {
    return jarvisPersonality.getThinkingIndicator();
  }

  /**
   * NEW v2.0: Get processing indicator for longer operations
   */
  getProcessingIndicator(): string {
    return jarvisPersonality.getProcessingIndicator();
  }

  /**
   * NEW v2.0: Generate personalized greeting
   */
  async generateGreeting(): Promise<string> {
    return jarvisPersonality.generateGreeting();
  }

  handleInterruption(): string {
    const result = conversationFlow.handleInterruption();
    return conversationService.generateResponse(result.acknowledgment, {
      addOpening: false,
      addClosing: false,
      tone: 'neutral'
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
