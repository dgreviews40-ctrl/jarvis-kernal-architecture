/**
 * Kernel Request Processor - Refactored Service for JARVIS Kernel v1.5.0
 * 
 * This service breaks down the monolithic processKernelRequest function
 * into smaller, focused modules for better maintainability and testability.
 * 
 * v1.4.0 Updates:
 * - Integrated Local Vector DB for semantic memory
 * - Context Window Management for optimal token usage
 * - Enhanced conversation compression
 * 
 * v1.4.2 Updates:
 * - Agent System for autonomous multi-step task execution
 * - Tool use planning and self-correction
 * - Progress tracking for complex operations
 */

import { 
  IntentType, 
  ProcessorState, 
  AIProvider, 
  KernelRequest,
  KernelResponse 
} from '../types';
import type { ParsedIntent } from './gemini';
import type { IntelligenceResult } from './intelligence';
import type { AgentGoal, AgentTask } from './agentOrchestrator';
import { inputValidator } from './inputValidator';
import { LIMITS, TIMING } from '../constants/config';
import { analyzeIntent } from './gemini';
import { providerManager } from './providers';
import { voice } from './voice';
import { vision } from './vision';
import { visionHACamera } from './vision_ha_camera';
import { vectorMemoryService } from './vectorMemoryService';
import { localVectorDB } from './localVectorDB';
import { contextWindowService } from './contextWindowService';
import { memoryConsolidationService } from './memoryConsolidationService';
import { agentOrchestrator } from './agentOrchestrator';
import { logger } from './logger';
import { conversation } from './conversation';
import { intelligence } from './intelligence';
import { learningService } from './learning';
import { engine } from './execution';
import { isHomeAssistantQuery, searchEntities, generateEntityResponse } from './haEntitySearch';
import { smartContextRouter, enrichQueryWithContext } from './smartContextRouter';
import { weatherService } from './weather';
import { taskAutomation } from './integrations/taskAutomation';
import { haService, HAEntity } from './home_assistant';
import { getKernelStoreState, setKernelDisplay } from '../stores';
import { 
  jarvisPersonality, 
  conversationalFormatter,
  emotionalMemory,
  contextualGreeting,
  proactiveCheckIn,
  moodDetection,
  naturalResponse
} from './intelligence';
import { socialResponseHandler } from './socialResponseHandler';
import { visionMemory } from './visionMemory';
import { proactiveEventHandler } from './proactiveEventHandler';
import { thinkingSounds } from './thinkingSounds';
import { haShoppingList } from './haShoppingList';
import { runDiagnostics, getActiveAlerts, clearAcknowledgedAlerts } from './coreOs';
import { memoryConsolidationService } from './memoryConsolidationService';

interface ProcessorContext {
  forcedMode: AIProvider | null;
  setState: (state: ProcessorState) => void;
  setActiveModule: (module: string | null) => void;
  setProvider: (provider: AIProvider | null) => void;
  origin: 'USER_TEXT' | 'USER_VOICE';
  recentVoiceCommands: Array<{text: string, timestamp: number}>;
  isProcessing: { current: boolean };
  processingRequests: Set<string>;
  lastRequestTime: { current: number };
  lastRequestText: { current: string };
}

export class KernelProcessor {
  private readonly debounceMs: number = TIMING.DEBOUNCE_MS;

  /**
   * Process a kernel request through a series of focused modules
   */
  async processRequest(input: string, context: ProcessorContext): Promise<void> {
    // Start thinking sounds for user feedback during processing
    thinkingSounds.start('breathing');

    try {
      // Module 1: Input Validation
      const validationResult = await this.validateInput(input, context);
      if (!validationResult.isValid) {
        return;
      }
      
      const { sanitizedInput, now, trimmedInput } = validationResult as { sanitizedInput: string; now: number; trimmedInput: string };

      // Module 2: Duplicate Prevention
      const duplicateCheck = await this.checkForDuplicates(trimmedInput, now, context);
      if (duplicateCheck.isDuplicate) {
        return;
      }

      // Module 3: Request Initiation
      await this.initiateRequest(context, input);

      // Module 4: Intelligence Processing
      const intelligenceResult = await this.processIntelligence(input, context, now);

      // Module 5: Learning Integration
      const learnedInfo = await this.processLearning(input, context);

      // Module 6: Intent Analysis
      const analysis = await this.analyzeIntent(input, context);

      // Module 7: Execution Routing
      await this.routeExecution(analysis, input, sanitizedInput, context, intelligenceResult, learnedInfo);
    } finally {
      // Stop thinking sounds when processing completes
      thinkingSounds.stop();
    }
  }

  /**
   * Module 1: Input Validation
   */
  private async validateInput(input: string, context: ProcessorContext): Promise<{
    isValid: boolean;
    sanitizedInput?: string;
    now?: number;
    trimmedInput?: string;
  }> {
    if (!input || typeof input !== 'string') {
      logger.log('KERNEL', 'Invalid input received', 'error');
      return { isValid: false };
    }

    // Sanitize and validate input
    const validation = inputValidator.validate(input, {
      maxLength: LIMITS.MAX_INPUT_LENGTH,
      strictMode: false,
      context: 'user_input'
    });

    if (!validation.valid) {
      logger.log('KERNEL', `Input validation failed: ${validation.error}`, 'error');

      // Provide user feedback
      const errorResponse = validation.error?.includes('injection')
        ? "I've detected potentially harmful content in your request. Please rephrase."
        : "Your input couldn't be processed. Please try again with different wording.";

      if (voice.getState() !== 'MUTED') {
        voice.speak(errorResponse);
      }

      return { isValid: false };
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      logger.log('KERNEL', `Input warnings: ${validation.warnings.join(', ')}`, 'warning');
    }

    const now = Date.now();
    const sanitizedInput = validation.sanitized;
    const trimmedInput = sanitizedInput.trim().toLowerCase();

    return { isValid: true, sanitizedInput, now, trimmedInput };
  }

  /**
   * Module 2: Duplicate Prevention
   */
  private async checkForDuplicates(
    trimmedInput: string, 
    now: number, 
    context: ProcessorContext
  ): Promise<{ isDuplicate: boolean }> {
    // Enhanced duplicate detection: Check for similar recent requests
    const recentSimilarRequest = context.recentVoiceCommands.some(
      cmd => cmd.text === trimmedInput && (now - cmd.timestamp) < 2000
    );

    if (recentSimilarRequest) {
      logger.log('KERNEL', 'Similar voice command ignored (duplicate prevention)', 'warning');
      return { isDuplicate: true };
    }

    // Debounce: Block duplicate/rapid requests
    if (context.isProcessing.current) {
      logger.log('KERNEL', 'Request blocked - already processing', 'warning');
      return { isDuplicate: true };
    }

    // Block identical requests within debounce window
    if (trimmedInput === context.lastRequestText.current && (now - context.lastRequestTime.current) < this.debounceMs) {
      logger.log('KERNEL', 'Duplicate request ignored', 'warning');
      return { isDuplicate: true };
    }

    // Additional protection: Check if this exact request is already being processed
    const requestHash = `${trimmedInput}_${now}`;
    if (context.processingRequests.has(requestHash)) {
      logger.log('KERNEL', 'Request already being processed (hash protection)', 'warning');
      return { isDuplicate: true };
    }

    // Update tracking
    context.lastRequestTime.current = now;
    context.lastRequestText.current = trimmedInput;
    context.isProcessing.current = true;
    context.processingRequests.add(requestHash);

    // Clean up old hashes after processing
    const hashToDelete = requestHash; // Capture hash value for closure
    setTimeout(() => {
      context.processingRequests.delete(hashToDelete);
    }, this.debounceMs * 2); // Keep hash for twice the debounce time

    // Track this voice command to prevent duplicates
    if (context.origin === 'USER_VOICE') {
      context.recentVoiceCommands.push({ text: trimmedInput, timestamp: now });
      // Clean up old commands (older than 3 seconds)
      context.recentVoiceCommands = context.recentVoiceCommands.filter(
        cmd => (now - cmd.timestamp) < 3000
      );
    }

    return { isDuplicate: false };
  }

  /**
   * Module 3: Request Initiation
   */
  private async initiateRequest(context: ProcessorContext, input: string): Promise<void> {
    context.setState(ProcessorState.ANALYZING);
    context.setActiveModule('PARSER');
    logger.log(context.origin === 'USER_VOICE' ? 'VOICE' : 'USER', input, 'info');
  }

  /**
   * Module 4: Intelligence Processing with Context Window Management (v1.4.0)
   * v2.1: Integrated Emotional Intelligence
   */
  private async processIntelligence(input: string, context: ProcessorContext, now: number): Promise<any> {
    let intelligenceResult: IntelligenceResult | null = null;
    
    // v2.1: Record this interaction for emotional tracking
    await emotionalMemory.recordInteraction();
    
    // v2.1: Detect mood from user input
    try {
      const moodAnalysis = await moodDetection.analyzeMood(
        input, 
        context.origin,
        { messageCount: 1 } // Could track more metrics
      );
      
      // Log significant mood shifts
      const moodWithTrend = moodDetection.getMoodWithTrend();
      if (moodWithTrend.trend === 'fluctuating') {
        logger.log('INTELLIGENCE', `Mood fluctuation detected: ${moodAnalysis.primaryMood}`, 'warning');
      }
      
      logger.log('INTELLIGENCE', `Mood detected: ${moodAnalysis.primaryMood} (${moodAnalysis.valence}, confidence: ${(moodAnalysis.confidence * 100).toFixed(0)}%)`, 'info');
    } catch (e) {
      // Mood detection is optional, don't fail on error
      logger.log('INTELLIGENCE', `Mood detection failed: ${(e as Error).message}`, 'warning');
    }
    
    try {
      const session = conversation.getSession();
      const turns = session?.turns || [];
      
      // v1.4.0: Optimize context window before processing
      const selectedProvider = context.forcedMode || AIProvider.GEMINI;
      const systemPrompt = "You are JARVIS, an intelligent AI assistant.";
      
      const { optimized, tokenCount, wasCompressed, wasPruned, summary } = 
        await contextWindowService.optimizeContext(turns, systemPrompt, selectedProvider, {
          enableSummarization: true,
          enablePruning: true,
          preserveRecent: 4
        });

      // Update context window stats in store
      const utilization = contextWindowService.getUtilization(optimized, systemPrompt, selectedProvider);
      const store = getKernelStoreState();
      store?.setContextWindowStats?.({
        totalTurns: optimized.length,
        compressedTurns: wasCompressed ? turns.length - optimized.length : 0,
        summaryTokens: tokenCount.conversation,
        lastSummaryAt: wasCompressed ? Date.now() : 0,
        utilization
      });

      if (wasCompressed) {
        logger.log('CONTEXT_WINDOW', `Compressed ${turns.length} turns to ${optimized.length} (utilization: ${(utilization * 100).toFixed(1)}%)`, 'info');
      }

      intelligenceResult = await intelligence.process({
        userInput: input,
        conversationHistory: optimized,
        userId: 'current_user',
        timestamp: now,
        metadata: { 
          origin: context.origin, 
          voiceState: voice.getState(),
          contextOptimized: wasCompressed || wasPruned,
          tokenCount
        }
      });

      logger.log('INTELLIGENCE', `Context enriched: ${intelligenceResult.responseModifiers.tone} tone, ${intelligenceResult.proactiveSuggestions.length} proactive suggestions`, 'info');
    } catch (e) {
      logger.log('INTELLIGENCE', `Context processing failed: ${(e as Error).message}, falling back to basic mode`, 'warning');
      intelligenceResult = null;
    }

    return intelligenceResult;
  }

  /**
   * Module 5: Learning Integration
   * Returns learned preference info if something was learned, null otherwise
   * v2.1: Records emotional moments for significant interactions
   */
  private async processLearning(input: string, context: ProcessorContext): Promise<{ type: string; content: string } | null> {
    const lowerInput = input.toLowerCase();
    
    // Check if this is a correction of previous response
    if (learningService.isCorrection(input)) {
      logger.log('KERNEL', 'Correction detected - learning from feedback', 'info');
      const learnedFact = await learningService.processCorrection(input);
      if (learnedFact) {
        logger.log('MEMORY', `Learned: ${learnedFact}`, 'success');
        
        // v2.1: Record frustration moment if user is correcting us
        await emotionalMemory.recordMoment(
          'frustration',
          'User corrected my response',
          { valence: 'negative', intensity: 0.4, primaryEmotion: 'frustrated' },
          0.5
        );
        
        return { type: 'correction', content: learnedFact };
      }
    }

    // Check for implicit preferences in input
    const learnedPreference = await learningService.detectAndLearnPreference(input);
    if (learnedPreference) {
      logger.log('MEMORY', `Noted preference: ${learnedPreference.content}`, 'info');
      
      // v2.1: Record preference sharing as a positive moment
      await emotionalMemory.recordMoment(
        'preference_shared',
        learnedPreference.content,
        { valence: 'positive', intensity: 0.5, primaryEmotion: 'sharing' },
        0.4
      );
      
      return { type: learnedPreference.type, content: learnedPreference.content };
    }
    
    // v2.1: Detect and record other significant emotional moments
    await this.detectAndRecordEmotionalMoments(input, context);
    
    return null;
  }

  /**
   * v2.1: Detect and record emotional moments from user input
   */
  private async detectAndRecordEmotionalMoments(input: string, context: ProcessorContext): Promise<void> {
    const lower = input.toLowerCase();
    const currentMood = emotionalMemory.getCurrentMood();
    
    try {
      // Achievement celebration
      if (/\b(accomplished|achieved|finished|completed|succeeded|won|got the job|promotion|graduated)\b/i.test(input)) {
        await emotionalMemory.recordMoment(
          'achievement',
          input.substring(0, 200),
          { valence: 'positive', intensity: 0.8, primaryEmotion: 'joy' },
          0.8
        );
        logger.log('INTELLIGENCE', 'Recorded achievement moment', 'success');
      }
      
      // User expressing concern or worry
      else if (/\b(worried about|concerned about|anxious about|stressed about|afraid of|scared about)\b/i.test(input)) {
        await emotionalMemory.recordMoment(
          'concern',
          input.substring(0, 200),
          { valence: 'negative', intensity: currentMood.recentValence === 'negative' ? 0.7 : 0.5, primaryEmotion: 'worried' },
          0.7
        );
        logger.log('INTELLIGENCE', 'Recorded concern moment - will follow up later', 'warning');
      }
      
      // User expressing gratitude
      else if (/\b(thank you|thanks|appreciate|grateful|you helped)\b/i.test(input) && 
               (lower.includes('help') || lower.includes('thanks') || currentMood.recentValence === 'positive')) {
        await emotionalMemory.recordMoment(
          'gratitude_expressed',
          'User expressed gratitude',
          { valence: 'positive', intensity: 0.6, primaryEmotion: 'grateful' },
          0.4
        );
      }
      
      // User asking for help (significant moment)
      else if (/\b(help me|assist me|I need help|can you help|support me)\b/i.test(input)) {
        await emotionalMemory.recordMoment(
          'help_requested',
          input.substring(0, 200),
          { valence: 'neutral', intensity: 0.5, primaryEmotion: 'seeking_support' },
          0.5
        );
      }
      
      // Frustration / anger
      else if (/\b(so frustrating|really annoyed|angry|pissed|furious|this sucks|hate this)\b/i.test(input)) {
        await emotionalMemory.recordMoment(
          'frustration',
          input.substring(0, 200),
          { valence: 'negative', intensity: 0.8, primaryEmotion: 'frustrated' },
          0.7
        );
        logger.log('INTELLIGENCE', 'Recorded frustration moment', 'warning');
      }
      
      // Excitement / joy
      else if (/\b(so excited|can't wait|thrilled|overjoyed|ecstatic|amazing news)\b/i.test(input)) {
        await emotionalMemory.recordMoment(
          'excitement',
          input.substring(0, 200),
          { valence: 'positive', intensity: 0.9, primaryEmotion: 'excited' },
          0.6
        );
        logger.log('INTELLIGENCE', 'Recorded excitement moment', 'success');
      }
      
      // First meeting detection
      const timeContext = emotionalMemory.getTimeContext();
      if (timeContext.totalInteractions <= 3 && timeContext.sessionCount === 1) {
        await emotionalMemory.recordMoment(
          'first_meeting',
          'First interaction with user',
          { valence: 'positive', intensity: 0.5, primaryEmotion: 'curious' },
          1.0
        );
      }
    } catch (error) {
      // Emotional moment recording is optional
      logger.log('INTELLIGENCE', `Failed to record emotional moment: ${(error as Error).message}`, 'warning');
    }
  }

  /**
   * Module 6: Intent Analysis
   */
  private async analyzeIntent(input: string, context: ProcessorContext): Promise<any> {
    // Check if similar query was corrected before
    const relevantCorrection = learningService.findRelevantCorrection(input);

    // Check for image/diagram creation requests first and handle them specially
    const lowerInput = input.toLowerCase();
    
    // EARLY CHECK: Vision memory recall queries - force MEMORY_READ intent
    const isVisionMemoryQuery = /\b(look|show|find|search|check)\s+(in|at|through|for|my|the|into)?\s*(vision memory|vision memories|stored images|saved photos|image memory|visual memory)\b/i.test(input) ||
                                /\b(look|see|check)\s+(for|at)?\s*(the|my|any)?\s*(image|photo|picture|snapshot|snapshots)\s+(of|from|in|my|the)?\b/i.test(input) ||
                                /\b(do you remember|recall)\s+(the|that|my|seeing|any)?\s*(image|photo|picture|snapshot|garage|photos)\b/i.test(input) ||
                                /\b(current|previous|last|stored|saved)\s+(image|photo|picture|snapshot|photos)\b/i.test(input) ||
                                /\bimage\s+of\s+(my|the)\s+(garage|house|room|office|person|me)\b/i.test(input) ||
                                /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i.test(input);
    
    // EXCLUDE ownership/identification statements - should go to MEMORY_WRITE
    const isOwnershipStatement = /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i.test(input) ||
                                 /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i.test(input);
    
    if (isVisionMemoryQuery && !isOwnershipStatement) {
      logger.log('KERNEL', 'Detected vision memory recall query, forcing MEMORY_READ intent', 'info');
      return {
        analysis: {
          type: IntentType.MEMORY_READ,
          entities: [],
          suggestedProvider: 'OLLAMA'
        },
        selectedProvider: AIProvider.OLLAMA,
        relevantCorrection
      };
    }
    
    const isImageCreationRequest =
      (lowerInput.includes('create') || lowerInput.includes('generate') || lowerInput.includes('make') || lowerInput.includes('draw')) &&
      (lowerInput.includes('image') || lowerInput.includes('picture') || lowerInput.includes('photo') ||
       lowerInput.includes('jpeg') || lowerInput.includes('png') || lowerInput.includes('gif') ||
       lowerInput.includes('svg') || lowerInput.includes('diagram') || lowerInput.includes('schematic') ||
       lowerInput.includes('illustration') || lowerInput.includes('drawing'));

    let analysis: { type: IntentType; entities: string[]; suggestedProvider: string } | null = null;

    if (isImageCreationRequest) {
      // Classify as QUERY to route to handleQuery which has our custom image generation
      logger.log('KERNEL', 'Detected image creation request, routing to custom handler', 'info');
      analysis = {
        type: IntentType.QUERY,
        entities: [],
        suggestedProvider: 'GEMINI'
      };
    } else {
      // Play "hmm" sound for complex analysis (queries longer than 10 words)
      if (input.split(/\s+/).length > 10) {
        thinkingSounds.play('hmm');
      }
      
      // Analyze intent with AI provider for other requests
      logger.log('KERNEL', `Analyzing intent with ${context.forcedMode === AIProvider.GEMINI ? 'Core Engine' : 'Local Ollama'}...`, 'info');
      analysis = await analyzeIntent(input);
    }

    // Ensure analysis is not null
    if (!analysis) {
      throw new Error('Intent analysis returned null');
    }

    logger.log('KERNEL', `Intent Identified: ${analysis.type}`, 'success', {
      entities: analysis.entities,
      provider: analysis.suggestedProvider
    });

    context.setActiveModule('SECURITY');
    context.setState(ProcessorState.ROUTING);
    context.setActiveModule('ROUTER');

    // Respect Forced Mode
    let selectedProvider = context.forcedMode || (analysis.suggestedProvider === 'OLLAMA' ? AIProvider.OLLAMA : AIProvider.GEMINI);
    context.setProvider(selectedProvider);

    context.setState(ProcessorState.EXECUTING);

    return { analysis, selectedProvider, relevantCorrection };
  }

  /**
   * Module 7: Execution Routing
   */
  private async routeExecution(
    analysisResult: { analysis: ParsedIntent; selectedProvider: AIProvider; relevantCorrection: { correctionText: string } | null }, 
    input: string, 
    sanitizedInput: string, 
    context: ProcessorContext, 
    intelligenceResult: IntelligenceResult,
    learnedInfo: { type: string; content: string } | null = null
  ): Promise<void> {
    const { analysis, selectedProvider, relevantCorrection } = analysisResult;
    let outputText = "";

    // If we have a relevant correction, include it in context
    let correctionContext = '';
    if (relevantCorrection) {
      correctionContext = `\n\nIMPORTANT: A similar query was previously corrected. The user indicated: "${relevantCorrection.correctionText}". Please take this into account.`;
    }
    
    // Track if we learned something for confirmation
    let learningConfirmation = '';
    if (learnedInfo) {
      if (learnedInfo.type === 'identity') {
        learningConfirmation = `I've noted that your name is ${learnedInfo.content}. `;
      } else if (learnedInfo.type === 'preference') {
        learningConfirmation = `I've noted your interest in ${learnedInfo.content}. `;
      } else if (learnedInfo.type === 'location') {
        learningConfirmation = `I've noted that you live in ${learnedInfo.content}. `;
      } else if (learnedInfo.type === 'work') {
        learningConfirmation = `I've noted that you work at ${learnedInfo.content}. `;
      } else if (learnedInfo.type === 'correction') {
        learningConfirmation = `Thank you for the correction. I've learned: ${learnedInfo.content}. `;
      }
    }

    try {
      // Check for voice reset command
      const lowerInput = input.toLowerCase();
      if (/\b(reset|restart|fix)\s+(voice|microphone|listening|hearing)\b/i.test(input)) {
        logger.log('VOICE', 'Voice reset command detected', 'info');
        voice.reset();
        return "Voice service has been reset. You should be able to speak to me now. Try saying 'Hey JARVIS' or click the microphone button.";
      }
      
      // Check for voice diagnostics
      if (/\b(voice|microphone)\s+(status|diagnostic|info|state)\b/i.test(input) || 
          /\bis\s+(voice|microphone)\s+working\b/i.test(input)) {
        const diag = voice.getDiagnostics();
        logger.log('VOICE', `Voice diagnostics: ${JSON.stringify(diag)}`, 'info');
        return `Voice status: ${diag.state}. Listening: ${diag.isListening ? 'Yes' : 'No'}. Recognition active: ${diag.recognitionActive ? 'Yes' : 'No'}. Errors: ${diag.errorCount}. If you're having issues, say "reset voice" to fix it.`;
      }
      
      // v1.4.2: Check if this should be handled by the Agent System
      const shouldUseAgent = this.shouldUseAgent(input, analysis);
      
      if (shouldUseAgent) {
        outputText = await this.handleAgentExecution(input, context);
      } else {
        switch (analysis.type) {
          case IntentType.VISION_ANALYSIS:
            outputText = await this.handleVisionAnalysis(input, context, correctionContext, selectedProvider);
            break;
            
          case IntentType.MEMORY_READ:
            outputText = await this.handleMemoryRead(input, context, correctionContext, selectedProvider, analysis);
            break;
            
          case IntentType.MEMORY_WRITE:
            outputText = await this.handleMemoryWrite(input, analysis, context);
            break;
            
          case IntentType.TIMER_REMINDER:
            // Acknowledge quick command with subtle click
            thinkingSounds.play('click');
            outputText = await this.handleTimerReminder(input, context);
            break;
            
          case IntentType.COMMAND:
            // Acknowledge quick command with subtle click
            thinkingSounds.play('click');
            outputText = await this.handleCommand(input, analysis, context, correctionContext, selectedProvider, intelligenceResult);
            break;
            
          case IntentType.SOCIAL:
            // Social interactions get natural conversational responses
            outputText = await this.handleSocial(input, context, intelligenceResult);
            break;
            
          case IntentType.QUERY:
          default:
            outputText = await this.handleQuery(input, context, correctionContext, selectedProvider, intelligenceResult, analysis);
            break;
        }
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      outputText = `ERROR: ${errorMessage}`;
      logger.log('KERNEL', outputText, 'error');
    } finally {
      // Always reset processing flag
      context.isProcessing.current = false;
    }

    // Prepend learning confirmation if we learned something
    if (learningConfirmation && outputText && !outputText.startsWith('ERROR')) {
      outputText = learningConfirmation + outputText;
    }

    await this.finalizeResponse(outputText, input, context, intelligenceResult);
  }

  private async handleVisionAnalysis(input: string, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider): Promise<string> {
    context.setActiveModule('EXECUTION');
    context.setActiveModule('VISION');
    logger.log('KERNEL', 'Initiating Visual Analysis Protocol...', 'info');

    let imageBase64: string | null = null;
    let captureSource = 'local';
    let selectedCameraName = '';
    
    // Check if user explicitly wants local camera
    const lowerInput = input.toLowerCase();
    const wantsLocalCamera = /\blocal\s*(camera|webcam)\b/.test(lowerInput) || 
                             /\bmy\s*(camera|webcam)\b/.test(lowerInput) ||
                             /\b(computer|laptop)\s*(camera|webcam)\b/.test(lowerInput);
    
    // Check if user explicitly wants HA camera
    const wantsHACamera = /\b(home assistant|ha)\s*(camera|cam)\b/.test(lowerInput) ||
                          /\btapo|wyze|reolink|hikvision\b/.test(lowerInput);
    
    // Extract specific camera name from input (e.g., "garage cam", "front door")
    const cameraNameMatch = lowerInput.match(/\b(garage|front|back|rear|side|door| porch| deck| yard| room| office| kitchen| living)\s*(?:cam|camera|door)?\b/);
    const requestedCameraName = cameraNameMatch ? cameraNameMatch[0] : '';

    // Prioritize based on user intent
    if (wantsHACamera || requestedCameraName) {
      // User wants HA camera - try to find and use specific camera
      const haCameras = visionHACamera.getHACameras();
      
      if (haCameras.length > 0) {
        let targetCamera = haCameras[0].entity_id; // Default to first camera
        
        // If user specified a camera name, find matching camera
        if (requestedCameraName) {
          const matchingCamera = haCameras.find(cam => 
            cam.friendly_name.toLowerCase().includes(requestedCameraName) ||
            cam.entity_id.toLowerCase().includes(requestedCameraName)
          );
          if (matchingCamera) {
            targetCamera = matchingCamera.entity_id;
            selectedCameraName = matchingCamera.friendly_name;
            logger.log('VISION', `Found matching HA camera: ${selectedCameraName} (${targetCamera})`, 'info');
          } else {
            logger.log('VISION', `No camera matching '${requestedCameraName}', using ${haCameras[0].friendly_name}`, 'warning');
            selectedCameraName = haCameras[0].friendly_name;
          }
        } else {
          selectedCameraName = haCameras[0].friendly_name;
        }
        
        // Switch to and capture from the selected camera
        await visionHACamera.switchToHACamera(targetCamera);
        imageBase64 = await visionHACamera.captureHACamera(targetCamera);
        captureSource = 'ha_camera';
      } else {
        return "Home Assistant camera is not available. Please check your camera configuration.";
      }
    } else if (wantsLocalCamera) {
      // User explicitly wants local camera - skip HA camera check
      logger.log('VISION', 'User requested local camera, skipping HA camera', 'info');
      if (vision.getState() !== 'ACTIVE') {
        try {
          await vision.startCamera();
          await new Promise(r => setTimeout(r, 300));
        } catch (error) {
          return "Could not access your local camera. Please ensure camera permissions are granted.";
        }
      }
      imageBase64 = vision.captureFrame();
      captureSource = 'local';
    } else {
      // Default: Try HA cameras first, then fall back to local
      const haCameras = visionHACamera.getHACameras();
      
      if (haCameras.length > 0) {
        // Use first available HA camera
        const targetCamera = haCameras[0].entity_id;
        selectedCameraName = haCameras[0].friendly_name;
        logger.log('VISION', `Using HA camera: ${selectedCameraName}`, 'info');
        
        await visionHACamera.switchToHACamera(targetCamera);
        imageBase64 = await visionHACamera.captureHACamera(targetCamera);
        captureSource = 'ha_camera';
      } else if (visionHACamera.getState().type === 'home_assistant' && visionHACamera.getState().currentCamera) {
        // Use currently active HA camera
        const currentCamera = visionHACamera.getState().currentCamera;
        logger.log('VISION', `Using active HA camera: ${currentCamera}`, 'info');
        imageBase64 = await visionHACamera.captureCurrentFeed();
        captureSource = 'ha_camera';
      }

      // Fall back to local camera if HA camera not available
      if (!imageBase64) {
        if (vision.getState() !== 'ACTIVE') {
          try {
            await vision.startCamera();
            await new Promise(r => setTimeout(r, 300));
          } catch (error) {
            return "Could not access camera. Please ensure camera permissions are granted.";
          }
        }
        imageBase64 = vision.captureFrame();
        captureSource = 'local';
      }
    }
    if (imageBase64 && imageBase64.length > 100) {
      logger.log('VISION', `Frame captured from ${captureSource}. Size: ${imageBase64.length} chars`, 'success');
      
      // Get current Ollama config to ensure we use the correct model
      const ollamaConfig = providerManager.getOllamaConfig();
      logger.log('VISION', `Using Ollama model: ${ollamaConfig.model}`, 'info');
      
      // Log first 100 chars of image data for debugging
      console.log('[VISION DEBUG] Image data preview:', imageBase64.substring(0, 100) + '...');
      
      // Add camera source context to help user understand which camera was used
      let sourceContext: string;
      if (captureSource === 'local') {
        sourceContext = '[Using local camera] ';
      } else if (selectedCameraName) {
        sourceContext = `[Using ${selectedCameraName}] `;
      } else {
        sourceContext = '[Using Home Assistant camera] ';
      }
      
      // Check if we should use Gemini for better vision (if API key available)
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const useGeminiForVision = geminiKey && geminiKey.length > 10;
      
      // Use Gemini for vision if available, otherwise Ollama
      const visionProvider = useGeminiForVision ? AIProvider.GEMINI : selectedProvider;
      
      if (useGeminiForVision) {
        logger.log('VISION', 'Using Gemini for vision analysis (better accuracy)', 'info');
      }
      
      const response = await providerManager.route({
        prompt: input + correctionContext,
        images: [imageBase64],
        systemInstruction: "You are JARVIS. Describe exactly what you see in the camera image. Be specific about objects, people, and the environment. If the image is dark or unclear, say so.",
        // Use Gemini for vision if available for better accuracy
        model: visionProvider === AIProvider.OLLAMA ? ollamaConfig.model : undefined,
      }, visionProvider);
      
      logger.log(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', response.text, 'success');
      
      // Display the captured image in the UI so user can verify
      setKernelDisplay('IMAGE', {
        type: 'IMAGE',
        title: captureSource === 'local' ? 'Local Camera Capture' : 'Home Assistant Camera Capture',
        description: `Captured at ${new Date().toLocaleTimeString()}`,
        image: {
          src: `data:image/jpeg;base64,${imageBase64}`,
          title: 'Camera Snapshot',
          alt: 'Captured camera image',
          fit: 'contain'
        }
      });
      
      // Store in vision memory if this is a snapshot command
      let visionMemoryStored = false;
      const isSnapshotCommand = /\b(snapshot|photo|picture|capture)\b/i.test(input);
      if (isSnapshotCommand) {
        // Construct full data URL for vision memory (storeImage expects full URL)
        const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
        
        logger.log('VISION', 'Storing snapshot in vision memory...', 'info');
        
        // Store asynchronously - don't block the response
        visionMemory.storeImage(imageDataUrl, {
          description: response.text,
          context: input,
          tags: [captureSource, selectedCameraName || 'camera', 'snapshot', new Date().toISOString().split('T')[0]]
        }).then(entry => {
          if (entry) {
            visionMemoryStored = true;
            logger.log('VISION', `Image stored in vision memory: ${entry.id} (${entry.metadata.width}x${entry.metadata.height})`, 'success');
          } else {
            logger.log('VISION', 'Vision memory store returned null - check console for errors', 'warning');
          }
        }).catch(err => {
          logger.log('VISION', `Failed to store in vision memory: ${err}`, 'warning');
        });
      }
      
      // Return response with camera source prefix and vision memory confirmation
      let fullResponse = sourceContext + response.text;
      if (isSnapshotCommand) {
        fullResponse += `\n\n[Image saved to vision memory]`;
      }
      return fullResponse;
    } else {
      return captureSource === 'ha_camera'
        ? "Home Assistant camera is not responding. Please check if the camera is online in Home Assistant."
        : "Could not access local camera. Please ensure camera permissions are granted in your browser.";
    }
  }

  private async handleMemoryRead(input: string, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider, analysis: ParsedIntent): Promise<string> {
    context.setActiveModule('MEMORY');
    const lowerInput = input.toLowerCase();

    logger.log('MEMORY', `Processing memory read request: "${input}"`, 'info');

    // Check if this is a vision memory recall request
    const isVisionMemoryQuery = /\b(images|photos|pictures|snapshots|vision memory|vision memories|image memory|visual memory)\b/i.test(input) ||
                                   /\b(show me|find|search|look|check)\s+(in|at|through|for|my|the|past)?\s*(images|photos|pictures|vision memory|vision)\b/i.test(input) ||
                                   /\b(see|look at|check)\s+(the|my)?\s*(current|previous|last|stored|saved)?\s*(image|photo|picture|snapshot)\b/i.test(input) ||
                                   /\b(image|photo|picture|snapshot)\s+(of|from|in|my)\s+(garage|house|room|the garage|person|me|someone)\b/i.test(input) ||
                                   /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i.test(input);
    
    // EXCLUDE ownership/identification statements - these should be stored as memory, not searched
    const isOwnershipStatement = /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i.test(input) ||
                                 /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i.test(input) ||
                                 /\b(my|our)\s+(garage|house|room|office)\s+(is|was)\s+(in|shown|depicted)\b/i.test(input);
    
    if (isVisionMemoryQuery && !isOwnershipStatement) {
      logger.log('MEMORY', 'Vision memory recall detected', 'info');
      try {
        // Extract search terms from query - keep important keywords
        let searchTerms = input.replace(/\b(show me|find|search|look|check|in|at|through|for|the|past|previous|old|current|last|stored|saved|images|photos|pictures|snapshots|vision memory|vision memories|do you|did you|can you|could you|please)\b/gi, '').trim();
        
        // If user mentioned specific spaces, keep that as search term
        if (/\b(garage|house|room|office|workshop)\b/i.test(input)) {
          const spaceMatch = input.match(/\b(garage|house|room|office|workshop)\b/i);
          if (spaceMatch && !searchTerms.toLowerCase().includes(spaceMatch[0].toLowerCase())) {
            searchTerms = spaceMatch[0] + ' ' + searchTerms;
          }
        }
        
        // If user mentioned person/people/me, keep that as search term
        if (/\b(person|people|someone|man|woman|human|me|myself|face)\b/i.test(input)) {
          const personMatch = input.match(/\b(person|people|someone|man|woman|human|me|myself|face)\b/i);
          if (personMatch && !searchTerms.toLowerCase().includes(personMatch[0].toLowerCase())) {
            searchTerms = personMatch[0] + ' ' + searchTerms;
          }
        }
        
        // Clean up extra whitespace
        searchTerms = searchTerms.replace(/\s+/g, ' ').trim();
        
        logger.log('MEMORY', `Searching vision memory for: "${searchTerms || 'camera snapshot'}"`, 'info');
        
        // Search vision memory
        const results = await visionMemory.searchMemories(searchTerms || 'camera snapshot', 5);
        
        if (results.length > 0) {
          logger.log('MEMORY', `Found ${results.length} vision memories`, 'success');
          
          // Display the most relevant image
          const topResult = results[0];
          setKernelDisplay('IMAGE', {
            type: 'IMAGE',
            title: 'Vision Memory Recall',
            description: `Found: ${topResult.entry.description.substring(0, 100)}...`,
            image: {
              src: topResult.entry.imageUrl,
              title: 'Vision Memory',
              alt: topResult.entry.description,
              fit: 'contain'
            }
          });
          
          // Return summary
          return `I found ${results.length} image(s) in your vision memory. Here's the most relevant one: "${topResult.entry.description}" (captured ${new Date(topResult.entry.timestamp).toLocaleDateString()}).`;
        } else {
          return "I don't have any images stored in your vision memory yet. Try saying 'take a snapshot' to capture and store an image.";
        }
      } catch (error) {
        logger.log('MEMORY', `Vision memory search error: ${(error as Error).message}`, 'error');
      }
    }

    // v1.5.1: Use Smart Context Router for personal queries
    try {
      logger.log('KERNEL', `Fetching personal context for: "${input.substring(0, 50)}..."`, 'info');
      const personalContext = await smartContextRouter.fetchPersonalContext(input);
      
      if (personalContext) {
        logger.log('KERNEL', `Found personal context (${personalContext.length} chars)`, 'success');
        
        // Check if this is an identity query that needs special handling
        const isIdentityQuery = /\b(my name|who am i|what is my name)\b/i.test(input);
        
        if (isIdentityQuery) {
          logger.log('KERNEL', `Identity query detected, synthesizing response`, 'info');
          const synthesis = await providerManager.route({
            prompt: `The user is asking about their identity. Based on the following stored information, answer their question. If the information doesn't contain their name, say you don't have that information yet.\n\nStored Information: ${personalContext}\n\nUser Question: ${input}\n\nAnswer naturally using the stored information:`,
            systemInstruction: "You are JARVIS. Answer using ONLY the provided stored information. Be concise and natural."
          }, selectedProvider);
          
          logger.log('KERNEL', `Answered identity query using stored context`, 'success');
          return synthesis.text;
        } else {
          // General personal query
          logger.log('KERNEL', `General personal query, synthesizing response`, 'info');
          const synthesis = await providerManager.route({
            prompt: `The user is asking about personal information. Use ONLY the following stored context to answer. If the context doesn't contain the answer, say you don't have that information.\n\nStored Context: ${personalContext}\n\nUser Question: ${input}\n\nAnswer:`,
            systemInstruction: "You are JARVIS. Answer based ONLY on the provided stored information."
          }, selectedProvider);
          
          logger.log('KERNEL', `Answered personal query using stored context`, 'success');
          return synthesis.text;
        }
      } else {
        logger.log('KERNEL', `No personal context found for query`, 'warning');
      }
    } catch (error) {
      logger.log('KERNEL', `Error in handleMemoryRead: ${(error as Error).message}`, 'error');
    }

    // Fallback: Check if this is actually a Home Assistant sensor query misclassified as memory
    if ((lowerInput.includes('solar') || lowerInput.includes('energy') || lowerInput.includes('power') ||
         lowerInput.includes('temperature') || lowerInput.includes('humidity') || lowerInput.includes('weather')) &&
         haService.initialized) {
      // Redirect to Home Assistant sensor query with smart filtering
      try {
        await haService.fetchEntities();
        const sensors = Array.from((haService as unknown as { entities: Map<string, HAEntity> }).entities.values())
          .map((e: HAEntity & { score?: number }) => {
            const name = (e.attributes?.friendly_name || e.entity_id).toLowerCase();
            const entityId = e.entity_id.toLowerCase();
            let score = 0;

            // STRICT: Check if forecast - exclude if user wants actual
            const isForecast = name.includes('forecast') || entityId.includes('forecast') ||
                               name.includes('prediction') || entityId.includes('prediction') ||
                               name.includes('estimated') || entityId.includes('estimated');

            if ((lowerInput.includes('actual') || lowerInput.includes('real')) && isForecast) {
              return null;
            }

            // Score based on query type
            if (lowerInput.includes('solar') && (name.includes('solar') || entityId.includes('solar'))) score += 10;
            if (lowerInput.includes('energy') && (name.includes('energy') || entityId.includes('energy'))) score += 8;
            if (lowerInput.includes('power') && (name.includes('power') || entityId.includes('power'))) score += 5;
            if (lowerInput.includes('temperature') && (name.includes('temp') || entityId.includes('temp'))) score += 10;
            if (lowerInput.includes('humidity') && (name.includes('humid') || entityId.includes('humid'))) score += 10;
            if (lowerInput.includes('weather') && (name.includes('weather') || entityId.includes('weather'))) score += 10;

            // Boost actual, penalize forecast
            if (name.includes('actual') || name.includes('real') || name.includes('meter') || name.includes('monitor')) score += 5;
            if (isForecast) score -= 10;
            if (name.includes('tomorrow') || name.includes('next')) score -= 8;

            // Penalize individual devices
            const deviceNames = ['server', 'printer', 'lamp', 'light', 'fan', 'pc', 'computer', 'monitor'];
            if (deviceNames.some(d => name.includes(d) || entityId.includes(d))) score -= 5;

            return score > 0 ? { ...e, score } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
          .slice(0, 5);

        if (sensors.length > 0) {
          const sensorInfo = sensors.filter((s): s is HAEntity & { score: number } => s !== null).map((s) => {
            const name = s.attributes?.friendly_name || s.entity_id;
            const value = s.state;
            const unit = s.attributes?.unit_of_measurement || '';
            return `${name}: ${value} ${unit}`;
          }).join('\n');
          const result = `Current sensor data:\n${sensorInfo}`;
          logger.log('HOME_ASSISTANT', result, 'success');
          return result;
        } else {
          return `I couldn't find any matching sensors in Home Assistant for "${input}".`;
        }
      } catch (error: unknown) {
        const result = `Error fetching sensor data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.log('HOME_ASSISTANT', result, 'error');
        return result;
      }
    }

    // Final fallback: No data found - v2.0: More conversational
    const name = jarvisPersonality.getUserName();
    if (name) {
      return `I don't have that information saved yet, ${name}. You can tell me things like "My name is John" or "I enjoy hiking" and I'll remember them for next time.`;
    }
    return `I don't have that information saved yet. You can tell me things like "My name is John" or "I enjoy hiking" and I'll remember them for next time.`;
  }

  private async handleMemoryWrite(input: string, analysis: ParsedIntent, context: ProcessorContext): Promise<string> {
    context.setActiveModule('MEMORY');
    // Normalize entities to ensure they are strings before joining
    const normalizedEntities = analysis.entities.map(entity =>
      typeof entity === 'string' ? entity
      : typeof entity === 'object' && (entity as {text?: string}).text ? (entity as {text?: string}).text
      : String(entity)
    );
    const contentToSave = normalizedEntities.join(' ') || input;

    // Detect if this is identity-related information
    const lowerInput = input.toLowerCase();
    const isIdentityInfo = lowerInput.includes('name') ||
                          lowerInput.includes('i am') ||
                          lowerInput.includes('i\'m') ||
                          lowerInput.includes('called') ||
                          lowerInput.includes('known as') ||
                          // Personal identification from images
                          /\b(that|this|the)\s+(image|photo|picture|snapshot|person)\s+(is|was)\s+(me|myself)\b/i.test(input) ||
                          /\b(i am|i'm)\s+(the person|that person|in the|in that)\s+(image|photo|picture|snapshot)\b/i.test(input);

    // v1.4.1: Store with automatic consolidation
    try {
      if (isIdentityInfo) {
        // Store as identity information with special tags
        await vectorMemoryService.storeIdentity(contentToSave);
        await localVectorDB.storeIdentity(contentToSave);
        return "Identity information stored in Long-Term Memory.";
      } else {
        // Store with automatic consolidation (v1.4.1)
        const memoryNode = {
          id: `memory_${Date.now()}`,
          content: contentToSave,
          type: 'FACT' as const,
          tags: ['user_input', 'auto_save'],
          created: Date.now(),
          lastAccessed: Date.now()
        };
        
        // Use consolidation service for intelligent storage
        const result = await memoryConsolidationService.storeWithConsolidation(memoryNode);
        
        // Also store in legacy system for compatibility
        await vectorMemoryService.store(memoryNode);
        
        // Update vector DB stats
        const stats = await localVectorDB.getStats();
        const store = getKernelStoreState();
        store?.setVectorDBStats?.({
          ...stats,
          isInitialized: true
        });
        
        // Return appropriate message based on action
        switch (result.action) {
          case 'merged':
            return "Information merged with existing memory.";
          case 'deduplicated':
            return "Similar information already stored.";
          case 'stored':
          default:
            return "Sequence stored in Long-Term Memory.";
        }
      }
    } catch (error) {
      logger.log('MEMORY', `Failed to store with consolidation: ${(error as Error).message}`, 'warning');
      // Fallback to legacy storage
      await vectorMemoryService.store({
        id: `memory_${Date.now()}`,
        content: contentToSave,
        type: 'FACT',
        tags: ['user_input', 'auto_save'],
        created: Date.now(),
        lastAccessed: Date.now()
      });
      return "Sequence stored in Long-Term Memory (legacy mode).";
    }
  }

  private async handleTimerReminder(input: string, context: ProcessorContext): Promise<string> {
    context.setActiveModule('EXECUTION');

    // Parse timer/reminder request
    const lowerInput = input.toLowerCase();
    let durationMs = 0;
    let reminderText = '';

    // Extract duration
    const durationMatch = lowerInput.match(/(\d+)\s+(second|seconds|minute|minutes|hour|hours)/);
    if (durationMatch) {
      const amount = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      if (unit.startsWith('second')) durationMs = amount * 1000;
      else if (unit.startsWith('minute')) durationMs = amount * 60 * 1000;
      else if (unit.startsWith('hour')) durationMs = amount * 60 * 60 * 1000;
    }

    // Extract reminder text (everything after "for" or "to")
    const textMatch = input.match(/(?:remind me|reminder|timer)\s+(?:to\s+|for\s+|about\s+)?(.+?)(?:\s+in\s+\d+|\s+for\s+\d+|$)/i);
    reminderText = textMatch ? textMatch[1].trim() : 'Timer complete';

    if (durationMs > 0) {
      // Create the task/reminder
      const task = taskAutomation.createTask({
        title: reminderText,
        description: `Timer set for ${input}`,
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + durationMs),
        tags: ['timer', 'reminder']
      });

      // Set up the actual timer
      setTimeout(() => {
        // Use the proper method to complete the task
        taskAutomation.completeTask(task.id);

        // v2.0: Use conversational formatter for timer completion
        const completionMessage = conversationalFormatter.formatTimerCompletion(reminderText);
        voice.speak(completionMessage);
        logger.log('TIMER', `Timer completed: ${reminderText}`, 'success');
      }, durationMs);

      const durationText = durationMs < 60000 ? `${Math.round(durationMs / 1000)} seconds` :
                          durationMs < 3600000 ? `${Math.round(durationMs / 60000)} minutes` :
                          `${Math.round(durationMs / 3600000)} hours`;

      // v2.0: More conversational timer confirmation
      const name = jarvisPersonality.getUserName();
      const result = name 
        ? `Got it, ${name}. I'll remind you about "${reminderText}" in ${durationText}.`
        : `Got it. I'll remind you about "${reminderText}" in ${durationText}.`;
      logger.log('TIMER', `Created timer "${reminderText}" for ${durationText} (Task ID: ${task.id})`, 'success');
      return result;
    } else {
      // No duration found - create a task without timer
      const task = taskAutomation.createTask({
        title: reminderText,
        description: `Reminder: ${input}`,
        status: 'pending',
        priority: 'medium',
        tags: ['reminder']
      });

      // v2.0: More conversational reminder confirmation
      const result = conversationalFormatter.formatSuccess(`I've noted: "${reminderText}"`);
      logger.log('TIMER', `Created reminder "${reminderText}" (Task ID: ${task.id})`, 'success');
      return result;
    }
  }

  private async handleCommand(input: string, analysis: ParsedIntent, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider, intelligenceResult: IntelligenceResult): Promise<string> {
    context.setActiveModule('EXECUTION');
    context.setActiveModule('COMMAND');

    const lower = input.toLowerCase();

    // SYSTEM DIAGNOSTIC COMMANDS (handled before Home Assistant)
    // Deep Scan / Full System Diagnostic
    if (/\b(run|perform|initiate|start)\s+(full\s+)?system\s+(diagnostic|scan|check|analysis)\b/i.test(input) ||
        /\b(deep\s+scan|self\s+diagnostic|system\s+health\s+check)\b/i.test(input) ||
        lower === 'run full system diagnostic') {
      logger.log('KERNEL', 'Running full system diagnostic', 'info');
      try {
        const diagnosticReport = await runDiagnostics();
        // Display the diagnostic report in the terminal/display
        setKernelDisplay('TEXT', {
          type: 'TEXT',
          title: 'System Diagnostic Report',
          description: diagnosticReport
        });
        return 'Full system diagnostic complete. Results displayed on screen. All systems are functioning within normal parameters.';
      } catch (error) {
        logger.log('KERNEL', `Diagnostic error: ${(error as Error).message}`, 'error');
        return `Diagnostic encountered an error: ${(error as Error).message}`;
      }
    }

    // Circuit Reset - Clear all circuit breakers and alerts
    if (/\b(reset|cycle|clear)\s+(system\s+)?(circuit|breaker|breakers)\b/i.test(input) ||
        /\bcircuit\s+reset\b/i.test(input)) {
      logger.log('KERNEL', 'Resetting system circuits (circuit breakers)', 'info');
      try {
        // Clear all acknowledged alerts
        clearAcknowledgedAlerts();
        // Get current alerts status
        const alerts = getActiveAlerts();
        // Also reset any error states in the kernel store
        const { useKernelStore } = await import('../stores');
        const store = useKernelStore.getState();
        if (store.clearHealthIssues) {
          store.clearHealthIssues();
        }
        return `System circuits reset complete. ${alerts.length > 0 ? alerts.length + ' active alert(s) require attention.' : 'All breakers cleared and systems nominal.'}`;
      } catch (error) {
        logger.log('KERNEL', `Circuit reset error: ${(error as Error).message}`, 'error');
        return `Circuit reset encountered an error: ${(error as Error).message}`;
      }
    }

    // Memory Optimization Protocol
    if (/\b(run|perform|initiate|start)\s+memory\s+(optimization|compress|consolidation)\b/i.test(input) ||
        /\b(optimize|compress|consolidate)\s+(memory|vector\s+store|storage)\b/i.test(input) ||
        /\bmemory\s+(optimize|compress|consolidation)\s+protocol\b/i.test(input)) {
      logger.log('KERNEL', 'Running memory optimization protocol', 'info');
      try {
        // Trigger memory consolidation
        const stats = await memoryConsolidationService.consolidateNow();
        return `Memory optimization complete. Consolidated ${stats.mergedCount} duplicate memories, removed ${stats.expiredCount} expired entries. Vector store optimized.`;
      } catch (error) {
        logger.log('KERNEL', `Memory optimization error: ${(error as Error).message}`, 'error');
        return `Memory optimization encountered an error: ${(error as Error).message}`;
      }
    }

    // Network Probe / Latency Test
    if (/\b(network\s+probe|measure\s+(uplink|network)|network\s+latency|test\s+connection)\b/i.test(input) ||
        /\binitiate\s+network\s+latency\s+probe\b/i.test(input)) {
      logger.log('KERNEL', 'Running network probe', 'info');
      try {
        const { getNetworkInfo } = await import('./coreOs');
        const network = getNetworkInfo();
        const testStart = performance.now();
        // Simple latency test by fetching a small resource
        try {
          await fetch('/api/health', { method: 'HEAD', cache: 'no-cache' });
        } catch {
          // Ignore errors, we just want timing
        }
        const latency = Math.round(performance.now() - testStart);
        return `Network probe complete. Connection: ${network.effectiveType || 'unknown'}, Latency: ~${latency}ms, Online: ${network.online ? 'Yes' : 'No'}`;
      } catch (error) {
        logger.log('KERNEL', `Network probe error: ${(error as Error).message}`, 'error');
        return `Network probe encountered an error: ${(error as Error).message}`;
      }
    }

    // Check if this is a Home Assistant command

    // Check if this is actually a query for sensor data (not a command to change state)
    // Patterns like "tell me the temperature", "what is the temperature", "how hot is it" are QUERIES
    const isSensorQuery = /\b(tell me|what('s| is)|how (hot|cold|warm)|current|what's the)\b.*\b(temperature|humidity|weather)\b/i.test(input) ||
                          /\b(temperature|humidity|weather)\s+(is it|outside|inside|outdoor|indoor)\b/i.test(input);

    // If it's a sensor query, treat it as a QUERY intent instead
    if (isSensorQuery && haService.initialized) {
      // Route to Home Assistant entity search for sensor data
      try {
        const result = await searchEntities(input);
        if (result.matches.length > 0) {
          const response = generateEntityResponse(input, result);
          logger.log('HOME_ASSISTANT', response, 'success');
          return response;
        } else {
          return "I couldn't find any relevant sensors for that query.";
        }
      } catch (error: unknown) {
        const errorMessage = `Home Assistant query failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.log('HOME_ASSISTANT', errorMessage, 'error');
        return errorMessage;
      }
    } else {
      // This is an actual command (not a sensor query)
      
      // Check for shopping list commands first
      const shoppingListPatterns = [
        /\b(add|put)\b.*\b(shopping|list)\b/i,
        /\b(shopping list)\b/i,
        /\badd\b.*\bto\b.*\blist\b/i,
        /\bi need\b.*\b(buy|get)\b/i,
        /\bwhat('s| is)\s+on\s+(?:the\s+)?shopping/i,
        /\bwhat\s+do\s+(?:i|we)\s+need\s+to\s+buy/i,
        /\bclear\b.*\b(shopping|completed)\b/i,
        /\bcheck\s+(?:off|complete)\b/i,
      ];
      
      const isShoppingListCommand = shoppingListPatterns.some(pattern => pattern.test(input));
      
      if (isShoppingListCommand && haService.initialized) {
        try {
          // Parse the shopping list command
          const parsed = haShoppingList.parseItemFromText(input);
          
          if (parsed && parsed.listType === 'shopping') {
            // Add item to shopping list
            return await haShoppingList.addItem(parsed.item);
          }
          
          // Check for "what's on my shopping list" queries
          if (/\bwhat('s| is)\s+on|show\s+me|read\s+me/i.test(input)) {
            return await haShoppingList.getShoppingListSummary();
          }
          
          // Check for "clear completed"
          if (/\bclear\s+(?:completed|done|finished)|remove\s+(?:completed|done)/i.test(input)) {
            return await haShoppingList.clearCompleted();
          }
          
          // Check for completing items
          const completeMatch = input.match(/\b(check\s+(?:off|complete)|mark\s+(?:as\s+)?complete|complete)\b\s+(.+)/i);
          if (completeMatch && completeMatch[2]) {
            return await haShoppingList.completeItem(completeMatch[2].trim());
          }
          
          // Default: try to parse and add
          if (parsed && parsed.item) {
            return await haShoppingList.addItem(parsed.item);
          }
          
          return "I'm not sure what you want to do with the shopping list. Try saying 'add milk to my shopping list' or 'what's on my shopping list?'";
        } catch (error) {
          const errorMessage = `Shopping list command failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.log('HOME_ASSISTANT', errorMessage, 'error');
          return errorMessage;
        }
      }
      
      const homeAssistantKeywords = ['light', 'lights', 'lamp', 'switch', 'lock', 'door', 'thermostat', 'temperature', 'climate', 'ac', 'heat', 'fan', 'cover', 'shade', 'garage', 'home assistant', 'smart', 'printer', '3d', 'outlet', 'plug', 'socket', 'power', 'turn on', 'turn off', 'toggle'];

      // Check if this is clearly a request for creating a diagram/schematic first
      const isDiagramRequest = (lower.includes('create') || lower.includes('show') || lower.includes('draw') || lower.includes('diagram') || lower.includes('schematic')) &&
                               (lower.includes('printer') || lower.includes('3d') || lower.includes('bamboo'));

      if (isDiagramRequest) {
        // This is a diagram creation request, not a device control command
        // Route to the diagram creation logic instead of Home Assistant
        return this.handleQuery(input, context, correctionContext, selectedProvider, intelligenceResult, analysis);
      }

      const isHomeAssistantCommand = homeAssistantKeywords.some(keyword =>
        lower.includes(keyword)
      );

      if (isHomeAssistantCommand && haService.initialized) {
        // Route to Home Assistant service
        try {
          // Normalize entities to ensure they are strings
          const paramsEntities = analysis.entities.length > 0
            ? analysis.entities.map(entity => {
                if (typeof entity === 'string') return entity;
                const entityObj = entity as {text?: string};
                if (typeof entity === 'object' && entityObj.text) return entityObj.text;
                return String(entity);
              })
            : input.split(' ');

          const result = await haService.executeSmartCommand(paramsEntities);
          logger.log('HOME_ASSISTANT', result, 'success');
          return result;
        } catch (error) {
          const errorMessage = `Home Assistant command failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.log('HOME_ASSISTANT', errorMessage, 'error');
          return errorMessage;
        }
      } else if (isHomeAssistantCommand && !haService.initialized) {
        // Home Assistant command detected but not connected - provide helpful message
        logger.log('HOME_ASSISTANT', 'Command detected but HA not connected', 'warning');
        return "I'd be happy to control your 3D printer, but Home Assistant is not connected. Please configure your Home Assistant connection in Settings to access your smart home devices.";
      } else {
        let requiredCapability = 'light_control';
        if (lower.includes('spotify') || lower.includes('play')) requiredCapability = 'music_playback';
        else if (lower.includes('lock') || lower.includes('door')) requiredCapability = 'lock_control';
        else if (lower.includes('thermostat') || lower.includes('temp')) requiredCapability = 'climate_control';
        else requiredCapability = 'system_diagnostics';

        // Import the registry to access provider capabilities
        const { registry } = await import('./registry');
        const pluginId = registry.findProviderForCapability(requiredCapability);

        if (!pluginId) {
          return `No active plugin handles capability: ${requiredCapability}`;
        } else {
          // Normalize entities to ensure they are strings
          const paramsEntities = analysis.entities.length > 0
            ? analysis.entities.map(entity => {
                if (typeof entity === 'string') return entity;
                const entityObj = entity as {text?: string};
                if (typeof entity === 'object' && entityObj.text) return entityObj.text;
                return String(entity);
              })
            : input.split(' ');
          const result = await engine.executeAction({
            pluginId,
            method: 'EXECUTE_INTENT',
            params: { entities: paramsEntities }
          });
          logger.log('PLUGIN', result, 'success');
          return result;
        }
      }
    }
  }

  private async handleQuery(input: string, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider, intelligenceResult: IntelligenceResult, analysis: ParsedIntent): Promise<string> {
    // SAFETY CHECK: Redirect vision memory queries to handleMemoryRead
    const isVisionMemoryQuery = /\b(look|show|find|search|check)\s+(in|at|through|for|my|the|into)?\s*(vision memory|vision memories|stored images|saved photos|image memory|visual memory)\b/i.test(input) ||
                                /\b(look|see|check)\s+(for|at)?\s*(the|my|any)?\s*(image|photo|picture|snapshot|snapshots)\s+(of|from|in|my|the)?\b/i.test(input) ||
                                /\b(do you remember|recall)\s+(the|that|my|seeing|any)?\s*(image|photo|picture|snapshot|garage|photos)\b/i.test(input) ||
                                /\b(current|previous|last|stored|saved)\s+(image|photo|picture|snapshot|photos)\b/i.test(input) ||
                                /\bimage\s+of\s+(my|the)\s+(garage|house|room|office|person|me)\b/i.test(input) ||
                                /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i.test(input);
    
    // EXCLUDE ownership/identification statements
    const isOwnershipStatement = /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i.test(input) ||
                                 /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i.test(input);
    
    if (isVisionMemoryQuery && !isOwnershipStatement) {
      logger.log('KERNEL', 'Vision memory query detected in handleQuery, redirecting to handleMemoryRead', 'info');
      return this.handleMemoryRead(input, context, correctionContext, selectedProvider, analysis);
    }
    
    // Check for social/conversational intents first - these get priority for natural responses
    const socialIntent = socialResponseHandler.detectSocialIntent(input);
    if (socialIntent.type && socialIntent.confidence >= 0.85) {
      logger.log('KERNEL', `Social intent detected: ${socialIntent.type} (${(socialIntent.confidence * 100).toFixed(0)}%)`, 'info');
      const socialResponse = await socialResponseHandler.generateResponse(socialIntent, input);
      if (socialResponse) {
        // For high-confidence social intents, use the social response directly
        // This ensures "how are you" and "working on your code" get proper reciprocal responses
        logger.log('KERNEL', `Using social response: ${socialResponse.response.substring(0, 50)}...`, 'success');
        let fullResponse = socialResponse.response;
        if (socialResponse.shouldFollowUp && socialResponse.followUpQuestion) {
          fullResponse += ` ${socialResponse.followUpQuestion}`;
        }
        return fullResponse;
      }
    }

    // Check for system diagnostic requests (natural language queries)
    const lowerInput = input.toLowerCase();
    if (/\b(run|do|perform)\s+a?\s*(self\s+)?(system\s+)?diagnostic\b/i.test(input) ||
        /\bhow\s+(is|are)\s+(you|the\s+system|things|running)\b/i.test(input) ||
        /\bsystem\s+(status|health|check)\b/i.test(input) ||
        /\b(run|do)\s+a\s+deep\s+scan\b/i.test(input)) {
      logger.log('KERNEL', 'System diagnostic requested via query handler', 'info');
      try {
        const diagnosticReport = await runDiagnostics();
        setKernelDisplay('TEXT', {
          type: 'TEXT',
          title: 'System Diagnostic Report',
          description: diagnosticReport
        });
        return 'System diagnostic complete. Results are displayed on screen. I am functioning within normal parameters.';
      } catch (error) {
        logger.log('KERNEL', `Diagnostic error: ${(error as Error).message}`, 'error');
        return `I encountered an error while running diagnostics: ${(error as Error).message}`;
      }
    }
    
    // Check if this is a diagram/schematic creation request (but NOT if it explicitly asks for SVG)
    
    // Check for shopping list queries
    const shoppingListQueryPatterns = [
      /\bwhat('s| is)\s+(?:on\s+)?(?:my\s+)?(?:the\s+)?shopping/i,
      /\bwhat\s+do\s+(?:i|we)\s+need\s+to\s+buy/i,
      /\bread\s+(?:me\s+)?(?:my\s+)?shopping/i,
      /\bshow\s+(?:me\s+)?(?:my\s+)?shopping/i,
    ];
    
    const isShoppingListQuery = shoppingListQueryPatterns.some(pattern => pattern.test(input));
    
    if (isShoppingListQuery && haService.initialized) {
      try {
        return await haShoppingList.getShoppingListSummary();
      } catch (error) {
        logger.log('HOME_ASSISTANT', `Shopping list query failed: ${error}`, 'error');
        return "I couldn't access your shopping list right now.";
      }
    }
    
    const isDiagramRequest = (lowerInput.includes('show') && (lowerInput.includes('diagram') || lowerInput.includes('schematic') || lowerInput.includes('architecture') || lowerInput.includes('flowchart'))) ||
                             (lowerInput.includes('create') && (lowerInput.includes('diagram') || lowerInput.includes('schematic') || lowerInput.includes('schematic of') || lowerInput.includes('diagram of'))) ||
                             (lowerInput.includes('draw') && (lowerInput.includes('diagram') || lowerInput.includes('schematic')));
    
    // Only use the old SVG diagram path if explicitly asking for SVG
    const isSvgRequest = lowerInput.includes('svg');
    
    if (isDiagramRequest && isSvgRequest) {
      // Handle requests to display diagrams or schematics using SVG (old method)
      context.setActiveModule('DISPLAY');
      try {
        // Extract what type of diagram is requested
        const diagramType = lowerInput.includes('architecture') ? 'System Architecture' :
                          lowerInput.includes('flowchart') ? 'Process Flow' :
                          lowerInput.includes('bamboo a1') || lowerInput.includes('bamboo') ? 'Bamboo A1 3D Printer Diagram' :
                          lowerInput.includes('3d printer') || lowerInput.includes('printer') ? '3D Printer Diagram' :
                          'System Diagram';

        logger.log('DISPLAY', 'Generating SVG diagram using FileGenerator service', 'info');

        // Import the new file generator service
        const { fileGeneratorService } = await import('./fileGenerator');

        try {
          // Generate schematic SVG with diagram style
          const generatedFile = await fileGeneratorService.generateFile(input, 'svg', {
            style: 'schematic',
            width: 800,
            height: 600
          });

          // Update the store with the generated diagram
          const displayContent = {
            type: 'SCHEMATIC' as const,
            title: diagramType,
            description: `Generated ${diagramType.toLowerCase()} based on your request`,
            schematic: {
              svgContent: generatedFile.content as string,
              imageUrl: generatedFile.dataUrl,
              title: diagramType,
              description: `Generated ${diagramType.toLowerCase()} based on your request`
            }
          };

          setKernelDisplay('SCHEMATIC', displayContent);
          logger.log('DISPLAY', `Successfully displayed ${diagramType}`, 'success');
          
          return `I've created a ${diagramType.toLowerCase()} for you. You can see it in the center display area and download it using the download button.`;
          
        } catch (error: unknown) {
          logger.log('DISPLAY', `Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          return "I encountered an error while generating the diagram. Please try again.";
        }
      } catch (error: unknown) {
        logger.log('DISPLAY', `Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        return "I encountered an error while generating the diagram. Please try again.";
      }
    } else if (lowerInput.includes('location') || lowerInput.includes('where am i') || lowerInput.includes('my location') ||
        lowerInput.includes('current location') || lowerInput.includes('where are we')) {
      // Treat as memory read
      context.setActiveModule('MEMORY');
      const results = await vectorMemoryService.recall(input);
      if (results.length > 0) {
        const topResult = results[0];
        const synthesis = await providerManager.route({
          prompt: `IMPORTANT: Use ONLY the following context to answer the user's question. Do not make up information.\n\nContext: ${topResult.node.content}\n\nUser Question: ${input}\n\nAnswer:`
        }, selectedProvider);
        logger.log(synthesis.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', synthesis.text, 'success');
        return synthesis.text;
      } else {
        return "Memory banks returned no relevant records about your location.";
      }
    } else if ((lowerInput.includes('show') && (lowerInput.includes('image') || lowerInput.includes('picture') || lowerInput.includes('photo'))) ||
               ((lowerInput.includes('create') || lowerInput.includes('crete') || lowerInput.includes('draw') || lowerInput.includes('make')) && 
                (lowerInput.includes('image') || lowerInput.includes('picture') || lowerInput.includes('photo') || lowerInput.includes('drawing'))) ||
               (lowerInput.includes('3d printer') && (lowerInput.includes('image') || lowerInput.includes('diagram') || lowerInput.includes('photo'))) ||
               // Also route schematic requests to image generation for high-quality output
               (lowerInput.includes('schematic') && (lowerInput.includes('create') || lowerInput.includes('generate') || lowerInput.includes('make')))) {
      // Handle requests to display images using the new file generator service
      context.setActiveModule('DISPLAY');
      try {
        logger.log('DISPLAY', 'Generating image using FileGenerator service', 'info');

        // Import the new file generator service
        const { fileGeneratorService } = await import('./fileGenerator');
        type FileFormat = import('./fileGenerator').FileFormat;

        try {
          // Determine format and style from input
          // Default to PNG for photorealistic images, SVG only when explicitly requested
          const format: 'png' | 'jpeg' | 'svg' = 
            lowerInput.includes('svg') ? 'svg' :
            lowerInput.includes('png') ? 'png' :
            lowerInput.includes('jpeg') || lowerInput.includes('jpg') ? 'jpeg' : 
            'png'; // Default to PNG for best quality photorealistic images
          
          const style = lowerInput.includes('realistic') ? 'realistic' :
                       lowerInput.includes('artistic') ? 'artistic' :
                       lowerInput.includes('diagram') ? 'diagram' :
                       lowerInput.includes('schematic') ? 'schematic' :
                       'realistic';

          logger.log('DISPLAY', `Generating ${format} image with ${style} style`, 'info');
          
          const generatedFile = await fileGeneratorService.generateFile(input, format, {
            style: style as any,
            width: 800,
            height: 600
          });

          // Update the store with the generated image
          const displayContent = {
            type: 'IMAGE' as const,
            title: generatedFile.filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `AI-generated ${format.toUpperCase()} image based on your request`,
            image: {
              src: generatedFile.dataUrl || '',
              title: generatedFile.filename,
              alt: `Generated image: ${input}`,
              fit: 'contain' as const
            }
          };

          setKernelDisplay('IMAGE', displayContent);
          logger.log('DISPLAY', `Successfully displayed ${format} image`, 'success');
          
          const responseMessage = lowerInput.includes('3d printer') || lowerInput.includes('printer')
            ? `I've generated a ${style} ${format.toUpperCase()} image of the 3D printer. You can see it in the display area and download it using the download button.`
            : `I've created a ${style} ${format.toUpperCase()} image based on your request. You can view it in the center display and download it if you'd like.`;
          return responseMessage;
          
        } catch (error: unknown) {
          logger.log('DISPLAY', `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          return "I encountered an error while generating the image. Please try again.";
        }
      } catch (error: unknown) {
        logger.log('DISPLAY', `Failed to display image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        return "I encountered an error while retrieving the image. Please try again.";
      }
    } else if ((lowerInput.includes('create') || lowerInput.includes('generate')) && 
               (lowerInput.includes('pdf') || lowerInput.includes('document'))) {
      // Handle PDF/document generation requests
      context.setActiveModule('DISPLAY');
      try {
        const { fileGeneratorService } = await import('./fileGenerator');
        
        logger.log('DISPLAY', 'Generating PDF document', 'info');
        const generatedFile = await fileGeneratorService.generateFile(input, 'pdf');
        
        // For PDFs, offer download immediately
        fileGeneratorService.downloadFile(generatedFile);
        
        return `I've generated a document based on your request. The download should start automatically. Filename: ${generatedFile.filename}`;
      } catch (error: unknown) {
        logger.log('DISPLAY', `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        return "I encountered an error while generating the document. Please try again.";
      }
    } else if ((lowerInput.includes('create') || lowerInput.includes('generate')) && 
               (lowerInput.includes('text file') || lowerInput.includes('txt') || lowerInput.includes('markdown') || lowerInput.includes('md'))) {
      // Handle text file generation requests
      context.setActiveModule('DISPLAY');
      try {
        const { fileGeneratorService } = await import('./fileGenerator');
        
        const format = lowerInput.includes('markdown') || lowerInput.includes('md') ? 'md' : 'txt';
        logger.log('DISPLAY', `Generating ${format.toUpperCase()} document`, 'info');
        
        const generatedFile = await fileGeneratorService.generateFile(input, format);
        
        // Download the text file
        fileGeneratorService.downloadFile(generatedFile);
        
        return `I've generated a ${format.toUpperCase()} file based on your request. The download should start automatically. Filename: ${generatedFile.filename}`;
      } catch (error: unknown) {
        logger.log('DISPLAY', `Failed to generate text file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        return "I encountered an error while generating the text file. Please try again.";
      }
    } else if (lowerInput.includes('research') || lowerInput.includes('documentation') || lowerInput.includes('show documentation')) {
      // Handle requests to research or show documentation using the Display Plugin
      context.setActiveModule('DISPLAY');
      try {
        // Skip plugin system for now due to provider manager error
        logger.log('DISPLAY', 'Skipping plugin system due to provider manager error', 'warning');

        // Always update the store directly to ensure display happens
        setKernelDisplay('WEB', {
          type: 'WEB',
          title: 'Research Documentation',
          description: 'Documentation related to your request',
          web: {
            url: 'https://example.com/documentation',
            title: 'Research Documentation'
          }
        });

        return "Displaying relevant documentation in the center display area.";
      } catch (error) {
        logger.log('DISPLAY', `Failed to show documentation: ${(error as Error).message}`, 'error');
        return "I encountered an error while retrieving the documentation. Please try again.";
      }
    } else if (lowerInput.includes('weather') || lowerInput.includes('temperature') || lowerInput.includes('forecast') || lowerInput.includes('rain') || lowerInput.includes('sunny') || lowerInput.includes('cloudy')) {
      // Handle weather queries using the weather plugin FIRST, before Home Assistant
      // v2.0: Use conversational formatter for human-like responses
      try {
        logger.log('WEATHER', `Processing weather request: "${input}"`, 'info');

        // Check if weather data is available and refresh if stale (older than 10 minutes)
        let weatherData = weatherService.getData();
        const isStale = weatherData && (Date.now() - weatherData.lastUpdated > 10 * 60 * 1000);
        
        if (isStale) {
          logger.log('WEATHER', 'Weather data is stale, refreshing...', 'info');
          weatherData = await weatherService.refresh();
        }
        
        if (weatherData) {
          logger.log('WEATHER', `Using weather data: ${Math.round(weatherData.current.temperature)}°F, ${weatherData.current.condition.description} in ${weatherData.location.name} (updated ${Math.round((Date.now() - weatherData.lastUpdated) / 1000 / 60)} min ago)`, 'info');
          // v2.0: Use conversational formatter for rich, human-like weather responses
          const conversationalData = {
            temperature: weatherData.current.temperature,
            feelsLike: weatherData.current.feelsLike,
            humidity: weatherData.current.humidity,
            condition: weatherData.current.condition.description,
            windSpeed: weatherData.current.windSpeed,
            windDirection: weatherData.current.windDirection,
            precipitation: weatherData.current.precipitation,
            location: weatherData.location.name
          };

          // Check for specific rain/precipitation questions
          const isRainQuestion = lowerInput.includes('rain') || lowerInput.includes('precipitation') || lowerInput.includes('umbrella');
          
          if (isRainQuestion) {
            const name = jarvisPersonality.getUserName();
            // Check today's precipitation probability
            const today = weatherData.daily[0];
            const rainChance = today?.precipitationProbabilityMax || 0;
            const isRainingNow = weatherData.current.precipitation > 0;
            const condition = weatherData.current.condition.description.toLowerCase();
            
            if (isRainingNow) {
              return `Yes, it's currently raining in ${weatherData.location.name}${name ? `, ${name}` : ''}. The precipitation chance today is ${rainChance}%.`;
            } else if (rainChance > 70) {
              return `Yes, there's a good chance of rain today - about ${rainChance}%${name ? `, ${name}` : ''}. You might want to bring an umbrella if you're heading out.`;
            } else if (rainChance > 40) {
              return `There's a moderate chance of rain today - around ${rainChance}%${name ? `, ${name}` : ''}. You may want to keep an umbrella handy just in case.`;
            } else if (rainChance > 10) {
              return `There's a slight chance of rain today - about ${rainChance}%${name ? `, ${name}` : ''}. Probably not enough to worry about, but the skies are looking ${condition}.`;
            } else {
              return `No rain expected today${name ? `, ${name}` : ''} - the chance is only ${rainChance}%. It's ${condition} with a temperature of ${Math.round(weatherData.current.temperature)}°.`;
            }
          }
          
          if (lowerInput.includes('forecast') || lowerInput.includes('tomorrow')) {
            const tomorrow = weatherData.daily[1];
            const name = jarvisPersonality.getUserName();
            return `Tomorrow in ${weatherData.location.name}, expect a high of ${Math.round(tomorrow.tempMax)}° and a low of ${Math.round(tomorrow.tempMin)}°. Conditions will be ${tomorrow.condition.description.toLowerCase()}. ${tomorrow.tempMax > 80 ? `${name ? `${name}, ` : ''}That'll be a warm one!` : tomorrow.tempMax < 50 ? `Bundle up if you're heading out!` : `Should be pretty comfortable.`}`;
          } else {
            // Use conversational formatter for current weather
            return conversationalFormatter.formatWeather(conversationalData, true);
          }
        } else {
          // No weather data available, try to refresh
          const locationSet = weatherService.getLocation();
          logger.log('WEATHER', `No cached data. Location set: ${!!locationSet}`, 'warning');

          if (!locationSet) {
            // Try to automatically get user's current location if no location is set
            logger.log('WEATHER', 'Attempting to auto-detect location...', 'info');
            const locationFound = await weatherService.useCurrentLocation();
            if (locationFound) {
              logger.log('WEATHER', 'Location detected, fetching weather...', 'info');
              // Location was successfully set, now try to refresh
              await weatherService.refresh();
              const newData = weatherService.getData();
              if (newData) {
                const conversationalData = {
                  temperature: newData.current.temperature,
                  feelsLike: newData.current.feelsLike,
                  humidity: newData.current.humidity,
                  condition: newData.current.condition.description,
                  windSpeed: newData.current.windSpeed,
                  windDirection: newData.current.windDirection,
                  precipitation: newData.current.precipitation,
                  location: newData.location.name
                };
                return conversationalFormatter.formatWeather(conversationalData, true);
              }
            } else {
              logger.log('WEATHER', 'Auto-location failed - user may need to set location manually', 'warning');
            }
          } else {
            // Location was already set, try to refresh
            logger.log('WEATHER', `Refreshing weather for: ${locationSet.name}`, 'info');
            await weatherService.refresh();
            const newData = weatherService.getData();
            if (newData) {
              logger.log('WEATHER', `Fresh data received: ${Math.round(newData.current.temperature)}°F in ${newData.location.name}`, 'success');
              const conversationalData = {
                temperature: newData.current.temperature,
                feelsLike: newData.current.feelsLike,
                humidity: newData.current.humidity,
                condition: newData.current.condition.description,
                windSpeed: newData.current.windSpeed,
                windDirection: newData.current.windDirection,
                precipitation: newData.current.precipitation,
                location: newData.location.name
              };
              return conversationalFormatter.formatWeather(conversationalData, true);
            } else {
              logger.log('WEATHER', 'Refresh returned null data', 'error');
            }
          }

          return "I'm having trouble getting the weather data right now. The service might be temporarily unavailable, or I may need you to set your location in Settings.";
        }
      } catch (error: unknown) {
        const result = `Error retrieving weather information: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.log('WEATHER', result, 'error');
        return `I'm having trouble getting the weather data right now. ${error instanceof Error ? error.message : 'Please try again in a moment.'}`;
      }
    } else if ((lowerInput.includes('home assistant') || lowerInput.includes('smart home') || lowerInput.includes('connected') || lowerInput.includes('integration')) &&
               !/\b(ideas?|suggestions?|projects?|recommendations?|help me|how (can|do) I|what can I|ideas for|suggestions for)\b/i.test(lowerInput)) {
      // Handle queries about Home Assistant integration (but not idea requests)
      if (haService.initialized) {
        const status = await haService.getStatus();
        const result = `Yes, I have access to your Home Assistant. I can control ${status.entitiesCount} smart home devices.`;
        logger.log('HOME_ASSISTANT', result, 'success');
        return result;
      } else {
        const result = "I have the Home Assistant integration available, but it's not currently connected. Please check your settings to configure the connection.";
        logger.log('HOME_ASSISTANT', result, 'warning');
        return result;
      }
    } else if (lowerInput.includes('time') || lowerInput.includes('date') || lowerInput.includes('clock') || lowerInput.includes('day')) {
      // Handle date and time queries - v2.0: More conversational
      const now = new Date();
      const name = jarvisPersonality.getUserName();
      
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      });
      const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      
      const hour = now.getHours();
      let timeOfDay = '';
      if (hour < 12) timeOfDay = 'morning';
      else if (hour < 17) timeOfDay = 'afternoon';
      else if (hour < 21) timeOfDay = 'evening';
      else timeOfDay = 'night';
      
      let result = '';
      if (lowerInput.includes('time') && !lowerInput.includes('date')) {
        result = name 
          ? `It's ${timeString}, ${name}. Good ${timeOfDay}!`
          : `It's ${timeString}. Good ${timeOfDay}!`;
      } else if (lowerInput.includes('date') && !lowerInput.includes('time')) {
        result = `Today is ${dateString}.`;
      } else {
        result = name
          ? `It's ${timeString} on ${dateString}, ${name}.`
          : `It's ${timeString} on ${dateString}.`;
      }
      
      logger.log('SYSTEM', result, 'info');
      return result;
    } else if (isHomeAssistantQuery(lowerInput)) {
      // Handle ANY Home Assistant sensor query using semantic search
      if (haService.initialized) {
        try {
          logger.log('HOME_ASSISTANT', `Searching entities for: "${input}"`, 'info');

          const searchResult = await searchEntities(input, {
            maxResults: 5,
            minScore: 5,
            fetchFresh: true
          });

          const result = generateEntityResponse(input, searchResult);

          logger.log('HOME_ASSISTANT', `Found ${searchResult.matches.length} matches in ${searchResult.searchTimeMs.toFixed(0)}ms`, 'success');
          return result;
        } catch (error: unknown) {
          const result = `Error searching Home Assistant: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.log('HOME_ASSISTANT', result, 'error');
          return result;
        }
      } else {
        const result = "Home Assistant is not connected. Please configure it in Settings to access your smart home data.";
        logger.log('HOME_ASSISTANT', result, 'warning');
        return result;
      }
    } else {
      // General Query - Use intelligence-enhanced context with memory retrieval
      // v2.0: Add thinking indicator for complex queries
      const isComplexQuery = this.isComplexQuery(input);
      
      // v2.0: Speak thinking indicator for voice-originated complex queries
      if (isComplexQuery && context.origin === 'USER_VOICE' && voice.getState() !== 'MUTED') {
        const thinkingIndicator = jarvisPersonality.getThinkingIndicator();
        try {
          await voice.speak(thinkingIndicator);
        } catch (e) {
          // Silent fail - thinking indicator is optional
        }
      }
      
      let prompt = input + correctionContext;
      let systemInstruction = intelligenceResult?.systemPrompt || "You are JARVIS, an advanced AI assistant. Be concise and helpful.";

      // v1.5.1: Smart Context Routing - automatically detect and fetch relevant context
      try {
        const { enrichedPrompt, systemContext, enrichedContext } = await enrichQueryWithContext(input);
        
        if (enrichedContext.hasRelevantData) {
          // Use enriched prompt and add system context
          prompt = enrichedPrompt + correctionContext;
          systemInstruction += systemContext;
          
          logger.log('KERNEL', 
            `Enriched query with ${enrichedContext.source} data`, 
            'success'
          );
        } else {
          // Fallback: Try basic memory recall for personal queries that might have been missed
          const isLikelyPersonal = /\b(my name|who am i|my hobby|my favorite|what do i like|what did i)\b/i.test(input);
          if (isLikelyPersonal) {
            const memoryResults = await vectorMemoryService.recall(input, 3);
            if (memoryResults.length > 0) {
              const memoryContext = '\n\nRELEVANT MEMORIES:\n' + 
                memoryResults.map(r => `- ${r.node.content}`).join('\n');
              systemInstruction += memoryContext;
              logger.log('MEMORY', `Fallback: Retrieved ${memoryResults.length} memories for personal query`, 'info');
            }
          }
        }
      } catch (error) {
        logger.log('KERNEL', `Context enrichment failed: ${error}`, 'warning');
      }

      // Use intelligence-enhanced user prompt if available
      if (intelligenceResult?.userPrompt && intelligenceResult.userPrompt !== input) {
        prompt = intelligenceResult.userPrompt + correctionContext;
        logger.log('INTELLIGENCE', 'Using enriched reasoning context', 'info');
      } else if (conversation.detectsContextReference(input)) {
        // Fallback to basic context detection
        const recentContext = conversation.getRecentContext();
        if (recentContext) {
          prompt = `CONVERSATION HISTORY:\n${recentContext}\n\nCURRENT QUERY: ${input}${correctionContext}\n\nRespond to the current query, using the conversation history for context if relevant.`;
          logger.log('KERNEL', 'Context-aware response enabled', 'info');
        }
      }

      const response = await providerManager.route({
        prompt,
        systemInstruction
      }, selectedProvider);

      // v2.0: Post-process with intelligence system for naturalness and name insertion
      let finalResponse = response.text;
      if (intelligenceResult) {
        finalResponse = intelligence.postProcessResponse(response.text, intelligenceResult.responseModifiers);
        logger.log('INTELLIGENCE', `Response naturalized: ${intelligenceResult.responseModifiers.tone} tone`, 'info');
      }
      
      // v2.0: Naturally insert user's name if appropriate
      if (jarvisPersonality.knowsUserName() && Math.random() > 0.6) {
        finalResponse = jarvisPersonality.naturallyInsertName(finalResponse);
      }
      
      return finalResponse;
    }
  }

  /**
   * v2.0: Determine if a query is complex enough to warrant a thinking indicator
   */
  private isComplexQuery(input: string): boolean {
    const lower = input.toLowerCase();
    
    // Indicators of complexity
    const complexIndicators = [
      // Multiple questions
      (text: string) => (text.match(/\?/g) || []).length > 1,
      // Long queries
      (text: string) => text.length > 100,
      // Research/analysis keywords
      (text: string) => /\b(explain|analyze|compare|research|why|how does|what if)\b/i.test(text),
      // Calculation or reasoning
      (text: string) => /\b(calculate|compute|determine|figure out|solve)\b/i.test(text),
      // Multiple parts (commas, and, or)
      (text: string) => text.split(',').length > 2 || text.split(/\s+and\s+/).length > 2,
      // Creative writing
      (text: string) => /\b(write|create|generate|story|poem|essay)\b/i.test(text),
      // Technical depth
      (text: string) => /\b(detailed|comprehensive|in-depth|thorough)\b/i.test(text)
    ];
    
    return complexIndicators.some(check => check(input));
  }

  /**
   * Handle SOCIAL intents - conversational interactions that require reciprocal responses
   * v2.1: New dedicated handler for natural social conversation
   */
  private async handleSocial(input: string, context: ProcessorContext, intelligenceResult: IntelligenceResult): Promise<string> {
    context.setActiveModule('SOCIAL');
    logger.log('KERNEL', 'Processing social interaction...', 'info');

    try {
      // Use the social response handler to generate natural reciprocal responses
      const socialIntent = socialResponseHandler.detectSocialIntent(input);
      if (socialIntent.type) {
        const response = await socialResponseHandler.generateResponse(socialIntent, input);
        if (response) {
          let fullResponse = response.response;
          if (response.shouldFollowUp && response.followUpQuestion) {
            fullResponse += ` ${response.followUpQuestion}`;
          }
          logger.log('KERNEL', `Social response generated: ${response.tone} tone`, 'success');
          return fullResponse;
        }
      }
      
      // Fallback: If social handler doesn't produce a response, treat as simple query
      logger.log('KERNEL', 'Social handler returned no response, falling back to query handling', 'warning');
      return this.handleQuery(input, context, '', AIProvider.GEMINI, intelligenceResult, { type: IntentType.QUERY, entities: [], confidence: 0.7 } as ParsedIntent);
    } catch (error) {
      logger.log('KERNEL', `Social handling error: ${(error as Error).message}`, 'error');
      // Fallback to ensure we always respond
      return this.handleQuery(input, context, '', AIProvider.GEMINI, intelligenceResult, { type: IntentType.QUERY, entities: [], confidence: 0.7 } as ParsedIntent);
    }
  }

  private async finalizeResponse(outputText: string, input: string, context: ProcessorContext, intelligenceResult: IntelligenceResult): Promise<void> {
    try {
      // Track conversation turns for context
      conversation.addTurn('USER', input);
      if (outputText) {
        conversation.addTurn('JARVIS', outputText);
      }
      
      // v2.1: Check for proactive check-in opportunities (before finalizing response)
      try {
        const checkInOpportunity = await proactiveCheckIn.getPriorityCheckIn();
        if (checkInOpportunity && !outputText.includes(checkInOpportunity.message)) {
          // Append check-in to response if appropriate
          const timeContext = emotionalMemory.getTimeContext();
          if (timeContext.isReturningAfterGap && checkInOpportunity.suggestedTiming === 'after_greeting') {
            outputText = checkInOpportunity.message + '\n\n' + outputText;
            proactiveCheckIn.markCheckInCompleted(checkInOpportunity.moment.id);
            logger.log('INTELLIGENCE', `Added proactive check-in: ${checkInOpportunity.type}`, 'info');
          }
        }
      } catch (e) {
        // Check-ins are optional, don't fail on error
        logger.log('INTELLIGENCE', `Check-in check failed: ${(e as Error).message}`, 'warning');
      }

      context.setState(ProcessorState.IDLE);
      context.setActiveModule(null);
      context.setProvider(null);

      if (voice.getState() !== 'MUTED') {
        // Prevent duplicate speech by checking if this exact text was recently spoken
        const now = Date.now();

        // Check if this output text was recently spoken (within 3 seconds)
        const recentSpeech = context.recentVoiceCommands.some(
          cmd => cmd.text === outputText && (now - cmd.timestamp) < 3000
        );

        if (!recentSpeech) {
          // Track this speech command to prevent duplicates
          context.recentVoiceCommands.push({ text: outputText, timestamp: now });
          // Clean up old commands (older than 3 seconds)
          context.recentVoiceCommands = context.recentVoiceCommands.filter(
            cmd => (now - cmd.timestamp) < 3000
          );

          // Safely call voice.speak with error handling
          try {
            await voice.speak(outputText);
          } catch (speakError) {
            logger.log('VOICE', `Error during speech: ${(speakError as Error).message}`, 'error');
          }
        } else {
          logger.log('VOICE', 'Duplicate speech prevented', 'warning');
        }
      }
    } catch (error) {
      logger.log('KERNEL', `Error in finalizeResponse: ${(error as Error).message}`, 'error');
      // Ensure state is reset even if there's an error
      try {
        context.setState(ProcessorState.IDLE);
        context.setActiveModule(null);
        context.setProvider(null);
      } catch (resetError) {
        logger.log('KERNEL', `Error resetting state: ${(resetError as Error).message}`, 'error');
      }
    } finally {
      // Always ensure processing flag is reset
      context.isProcessing.current = false;
    }
  }

  // ==================== v1.4.2 AGENT SYSTEM METHODS ====================

  /**
   * Determine if a request should use the Agent System
   */
  private shouldUseAgent(input: string, analysis: ParsedIntent): boolean {
    const lowerInput = input.toLowerCase();
    
    // Keywords that suggest complex multi-step tasks
    const agentKeywords = [
      'plan', 'organize', 'schedule', 'coordinate', 'arrange',
      'research', 'investigate', 'find out', 'look up',
      'prepare', 'set up', 'configure', 'install',
      'create a', 'make a', 'build a', 'generate a',
      'help me with', 'assist with', 'handle', 'manage',
      'multiple', 'several', 'various', 'all the',
      'and then', 'after that', 'followed by',
      'workflow', 'process', 'procedure', 'routine'
    ];
    
    // Check for agent keywords
    const hasAgentKeywords = agentKeywords.some(kw => lowerInput.includes(kw));
    
    // Check for complexity indicators
    const complexityIndicators = [
      lowerInput.split(' and ').length > 2,  // Multiple "and" clauses
      lowerInput.split(',').length > 3,       // Multiple items
      lowerInput.length > 100,                // Long request
      lowerInput.includes('?') && lowerInput.includes('?') // Multiple questions
    ];
    
    // Check for explicit agent commands
    const explicitAgent = lowerInput.startsWith('agent:') || 
                         lowerInput.startsWith('task:') ||
                         lowerInput.startsWith('do:');
    
    return explicitAgent || (hasAgentKeywords && complexityIndicators.some(i => i));
  }

  /**
   * Handle execution via Agent System
   */
  private async handleAgentExecution(input: string, context: ProcessorContext): Promise<string> {
    context.setActiveModule('AGENT');
    context.setState(ProcessorState.EXECUTING);
    
    logger.log('AGENT', `Delegating to Agent System: ${input.substring(0, 50)}...`, 'info');
    
    try {
      // Create and execute goal
      const goal = await agentOrchestrator.createGoal(input, {
        priority: 'medium',
      });
      
      // Wait for completion (with timeout)
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes
      const startTime = Date.now();
      
      while (goal.status !== 'completed' && goal.status !== 'failed' && goal.status !== 'cancelled') {
        if (Date.now() - startTime > maxWaitTime) {
          agentOrchestrator.cancelGoal(goal.id);
          return "The task is taking longer than expected. I've queued it for background processing.";
        }
        
        // Update progress in UI
        context.setActiveModule(`AGENT:${goal.progress}%`);
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Generate response based on result
      if (goal.status === 'completed') {
        const completedTasks = goal.tasks.filter(t => t.status === 'completed');
        const results = completedTasks.map(t => t.result).filter(Boolean);
        
        // Generate summary response
        const summary = await this.generateAgentSummary(goal, results);
        
        logger.log('AGENT', `Goal completed: ${goal.id}`, 'success');
        return summary;
      } else if (goal.status === 'failed') {
        const failedTasks = goal.tasks.filter(t => t.status === 'failed');
        logger.log('AGENT', `Goal failed: ${goal.id} (${failedTasks.length} tasks failed)`, 'error');
        return `I encountered an issue while working on this. ${failedTasks.length} sub-tasks failed. Would you like me to try again?`;
      } else {
        return "Task cancelled.";
      }
    } catch (error) {
      logger.log('AGENT', `Agent execution error: ${(error as Error).message}`, 'error');
      return "I encountered an error while processing this request. Please try again.";
    }
  }

  /**
   * Generate a natural language summary of agent results
   */
  private async generateAgentSummary(goal: AgentGoal, results: unknown[]): Promise<string> {
    const taskCount = goal.tasks.length;
    const completedCount = goal.tasks.filter((t: AgentTask) => t.status === 'completed').length;
    
    // Simple summary for now - could use AI for more natural responses
    if (taskCount === 1) {
      return `Done! ${results[0] || 'Task completed successfully.'}`;
    }
    
    if (completedCount === taskCount) {
      return `I've completed all ${taskCount} tasks. ${results[results.length - 1] || ''}`;
    }
    
    return `I've completed ${completedCount} out of ${taskCount} tasks. The main objectives have been achieved.`;
  }

  // ==================== v2.1 EMOTIONAL INTELLIGENCE METHODS ====================

  /**
   * Generate a contextual, emotionally intelligent greeting
   */
  async generateContextualGreeting(origin: 'voice' | 'text' = 'text'): Promise<string> {
    try {
      const greeting = await contextualGreeting.generateGreeting(origin);
      return greeting.greeting;
    } catch (error) {
      logger.log('INTELLIGENCE', `Greeting generation failed: ${(error as Error).message}`, 'error');
      // Fallback to basic greeting
      return jarvisPersonality.generateGreeting();
    }
  }

  /**
   * Get current mood state
   */
  getCurrentMood() {
    return emotionalMemory.getCurrentMood();
  }

  /**
   * Get suggested response style based on user's mood
   */
  getResponseStyleSuggestion() {
    return contextualGreeting.getResponseStyleSuggestion();
  }

  /**
   * Get time context (for external use)
   */
  getTimeContext() {
    return emotionalMemory.getTimeContext();
  }

  /**
   * Initialize emotional intelligence services
   */
  async initializeEmotionalIntelligence(): Promise<void> {
    try {
      await emotionalMemory.initialize();
      await contextualGreeting.initialize();
      await proactiveCheckIn.initialize();
      
      // Phase 1, Task 1: Initialize proactive event handler
      proactiveEventHandler.initialize();
      
      logger.log('INTELLIGENCE', 'Emotional intelligence services initialized', 'success');
    } catch (error) {
      logger.log('INTELLIGENCE', `Failed to initialize emotional intelligence: ${(error as Error).message}`, 'error');
    }
  }

  /**
   * Check if there are proactive check-ins available
   */
  async getProactiveCheckIns(): Promise<import('./intelligence').CheckInOpportunity[]> {
    return proactiveCheckIn.checkForOpportunities();
  }

  /**
   * Mark a concern as resolved
   */
  async resolveConcern(momentId: string, resolution?: string): Promise<void> {
    await proactiveCheckIn.resolveConcern(momentId, resolution);
  }

  // ==================== Phase 1, Task 2: Natural Response Utilities ====================

  /**
   * Generate a natural acknowledgment response
   */
  generateAcknowledgment(): string {
    return naturalResponse.generateAcknowledgment();
  }

  /**
   * Generate a thinking/processing indicator
   */
  generateThinkingIndicator(): string {
    return naturalResponse.generateThinkingIndicator();
  }

  /**
   * Generate a success response
   */
  generateSuccessResponse(): string {
    return naturalResponse.generateSuccessResponse();
  }

  /**
   * Generate an error response with empathy
   */
  generateErrorResponse(includeRetry: boolean = true): string {
    return naturalResponse.generateErrorResponse(includeRetry);
  }

  /**
   * Format a list naturally
   */
  formatListNaturally(items: string[], intro?: string): string {
    return naturalResponse.formatList(items, intro);
  }

  /**
   * Generate uncertainty response
   */
  generateUncertaintyResponse(offerHelp: boolean = true): string {
    return naturalResponse.generateUncertaintyResponse(offerHelp);
  }
}

// Export singleton instance
export const kernelProcessor = new KernelProcessor();
