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
import { weatherService } from './weather';
import { taskAutomation } from './integrations/taskAutomation';
import { haService, HAEntity } from './home_assistant';
import { getKernelStoreState, setKernelDisplay } from '../stores';

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
    await this.processLearning(input, context);

    // Module 6: Intent Analysis
    const analysis = await this.analyzeIntent(input, context);

    // Module 7: Execution Routing
    await this.routeExecution(analysis, input, sanitizedInput, context, intelligenceResult);
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
   */
  private async processIntelligence(input: string, context: ProcessorContext, now: number): Promise<any> {
    let intelligenceResult;
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
   */
  private async processLearning(input: string, context: ProcessorContext): Promise<void> {
    // Check if this is a correction of previous response
    if (learningService.isCorrection(input)) {
      logger.log('KERNEL', 'Correction detected - learning from feedback', 'info');
      const learnedFact = await learningService.processCorrection(input);
      if (learnedFact) {
        logger.log('MEMORY', `Learned: ${learnedFact}`, 'success');
      }
    }

    // Check for implicit preferences in input
    const learnedPreference = await learningService.detectAndLearnPreference(input);
    if (learnedPreference) {
      logger.log('MEMORY', `Noted preference: ${learnedPreference.content}`, 'info');
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
    const isImageCreationRequest =
      (lowerInput.includes('create') || lowerInput.includes('generate') || lowerInput.includes('make') || lowerInput.includes('draw')) &&
      (lowerInput.includes('image') || lowerInput.includes('picture') || lowerInput.includes('photo') ||
       lowerInput.includes('jpeg') || lowerInput.includes('png') || lowerInput.includes('gif') ||
       lowerInput.includes('svg') || lowerInput.includes('diagram') || lowerInput.includes('schematic') ||
       lowerInput.includes('illustration') || lowerInput.includes('drawing'));

    let analysis;

    if (isImageCreationRequest) {
      // Classify as QUERY to route to handleQuery which has our custom image generation
      logger.log('KERNEL', 'Detected image creation request, routing to custom handler', 'info');
      analysis = {
        type: IntentType.QUERY,
        entities: [],
        suggestedProvider: 'GEMINI'
      };
    } else {
      // Analyze intent with AI provider for other requests
      logger.log('KERNEL', `Analyzing intent with ${context.forcedMode === AIProvider.GEMINI ? 'Core Engine' : 'Local Ollama'}...`, 'info');
      analysis = await analyzeIntent(input);
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
    intelligenceResult: IntelligenceResult
  ): Promise<void> {
    const { analysis, selectedProvider, relevantCorrection } = analysisResult;
    let outputText = "";

    // If we have a relevant correction, include it in context
    let correctionContext = '';
    if (relevantCorrection) {
      correctionContext = `\n\nIMPORTANT: A similar query was previously corrected. The user indicated: "${relevantCorrection.correctionText}". Please take this into account.`;
    }

    try {
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
            outputText = await this.handleTimerReminder(input, context);
            break;
            
          case IntentType.COMMAND:
            outputText = await this.handleCommand(input, analysis, context, correctionContext, selectedProvider, intelligenceResult);
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

    await this.finalizeResponse(outputText, input, context, intelligenceResult);
  }

  private async handleVisionAnalysis(input: string, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider): Promise<string> {
    context.setActiveModule('EXECUTION');
    context.setActiveModule('VISION');
    logger.log('KERNEL', 'Initiating Visual Analysis Protocol...', 'info');

    let imageBase64: string | null = null;
    let captureSource = 'local';

    // Check if HA camera is active first
    const haCameraState = visionHACamera.getState();
    if (haCameraState.type === 'home_assistant' && haCameraState.isActive && haCameraState.currentCamera) {
      logger.log('VISION', `Capturing from HA camera: ${haCameraState.currentCamera}`, 'info');
      imageBase64 = await visionHACamera.captureCurrentFeed();
      captureSource = 'ha_camera';
    }

    // Fall back to local camera if HA camera not available
    if (!imageBase64) {
      if (vision.getState() !== 'ACTIVE') {
        await vision.startCamera();
        // Brief delay for camera to initialize - only when camera wasn't already active
        await new Promise(r => setTimeout(r, 300));
      }
      imageBase64 = vision.captureFrame();
      captureSource = 'local';
    }
    if (imageBase64) {
      logger.log('VISION', `Frame captured from ${captureSource}. Size: ${imageBase64.length} chars`, 'success');
      
      // Get current Ollama config to ensure we use the correct model
      const ollamaConfig = providerManager.getOllamaConfig();
      logger.log('VISION', `Using Ollama model: ${ollamaConfig.model}`, 'info');
      
      // Log first 100 chars of image data for debugging
      console.log('[VISION DEBUG] Image data preview:', imageBase64.substring(0, 100) + '...');
      
      const response = await providerManager.route({
        prompt: input + correctionContext,
        images: [imageBase64],
        systemInstruction: "You are JARVIS. Analyze the visual input concisely.",
        // Pass the model from config to ensure the correct one is used
        model: selectedProvider === AIProvider.OLLAMA ? ollamaConfig.model : undefined,
      }, selectedProvider);
      logger.log(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', response.text, 'success');
      return response.text;
    } else {
      return "Optical sensors failed to return frame buffer.";
    }
  }

  private async handleMemoryRead(input: string, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider, analysis: ParsedIntent): Promise<string> {
    context.setActiveModule('MEMORY');

    // v1.4.0: Try local vector DB first for semantic search
    try {
      const localResults = await localVectorDB.search(input, {
        maxResults: 5,
        minScore: 0.7
      });

      if (localResults.length > 0) {
        const topResult = localResults[0];
        const synthesis = await providerManager.route({
          prompt: `IMPORTANT: Use ONLY the following context to answer the user's question. Do not make up information.\n\nContext: ${topResult.node.content}\n\nUser Question: ${input}\n\nAnswer:`
        }, selectedProvider);
        logger.log('VECTOR_DB', `Retrieved from local vector DB: ${topResult.node.id} (score: ${topResult.score.toFixed(3)})`, 'success');
        return synthesis.text;
      }
    } catch (error) {
      logger.log('VECTOR_DB', `Local search failed, falling back: ${(error as Error).message}`, 'warning');
    }

    // Check if this is actually a Home Assistant sensor query misclassified as memory
    const lowerInput = input.toLowerCase();
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
    } else {
      // Check if this is an identity-related query
      const isIdentityQuery = lowerInput.includes('my name') ||
                             lowerInput.includes('what is my name') ||
                             lowerInput.includes('who am i') ||
                             lowerInput.includes('identify me') ||
                             lowerInput.includes('remember me');

      if (isIdentityQuery) {
        // Use the dedicated identity method for identity queries
        const identityNode = await vectorMemoryService.getUserIdentity();
        if (identityNode) {
          const synthesis = await providerManager.route({
            prompt: `IMPORTANT: Use ONLY the following context to answer the user's question. Do not make up information.\n\nContext: ${identityNode.content}\n\nUser Question: ${input}\n\nAnswer:`
          }, selectedProvider);
          logger.log(synthesis.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', synthesis.text, 'success');
          return synthesis.text;
        } else {
          return "I don't have any information about your name or identity.";
        }
      } else {
        // Normal memory recall
        const results = await vectorMemoryService.recall(input);
        if (results.length > 0) {
          const topResult = results[0];
          const synthesis = await providerManager.route({
            prompt: `IMPORTANT: Use ONLY the following context to answer the user's question. Do not make up information.\n\nContext: ${topResult.node.content}\n\nUser Question: ${input}\n\nAnswer:`
          }, selectedProvider);
          logger.log(synthesis.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', synthesis.text, 'success');
          return synthesis.text;
        } else {
          return "Memory banks returned no relevant records.";
        }
      }
    }
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
                          lowerInput.includes('known as');

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

        // Generate a more personalized and contextual timer completion message
        let completionMessage = "";
        const lowerReminder = reminderText.toLowerCase();

        // Check if the reminder is related to a specific activity
        if (lowerReminder.includes('work') || lowerReminder.includes('task') || lowerReminder.includes('focus')) {
          completionMessage = `Sir, your focused work time has concluded. I recommend taking a brief moment to assess your progress.`;
        } else if (lowerReminder.includes('break') || lowerReminder.includes('rest') || lowerReminder.includes('relax')) {
          completionMessage = `Sir, your break time has concluded. I trust you found it restorative. How may I assist you now?`;
        } else if (lowerReminder.includes('exercise') || lowerReminder.includes('workout') || lowerReminder.includes('stretch')) {
          completionMessage = `Sir, your exercise period has ended. I hope your routine was beneficial to your wellbeing.`;
        } else if (lowerReminder.includes('meeting') || lowerReminder.includes('call') || lowerReminder.includes('conference')) {
          completionMessage = `Sir, your meeting time has concluded. I trust the discussion was productive.`;
        } else if (lowerReminder.includes('meditate') || lowerReminder.includes('meditation') || lowerReminder.includes('mindfulness')) {
          completionMessage = `Sir, your meditation session has concluded. I trust it brought clarity to your thoughts.`;
        } else if (lowerReminder.includes('cook') || lowerReminder.includes('cooking') || lowerReminder.includes('food') || lowerReminder.includes('meal')) {
          completionMessage = `Sir, your cooking timer has elapsed. Your meal should be ready now.`;
        } else {
          completionMessage = `Sir, your timer for "${reminderText}" has concluded. Time to attend to this matter.`;
        }

        voice.speak(completionMessage);
        logger.log('TIMER', `Timer completed: ${reminderText}`, 'success');
      }, durationMs);

      const durationText = durationMs < 60000 ? `${durationMs / 1000} seconds` :
                          durationMs < 3600000 ? `${Math.round(durationMs / 60000)} minutes` :
                          `${Math.round(durationMs / 3600000)} hours`;

      const result = `Timer set for ${durationText}: ${reminderText}`;
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

      const result = `Reminder created: ${reminderText}`;
      logger.log('TIMER', `Created reminder "${reminderText}" (Task ID: ${task.id})`, 'success');
      return result;
    }
  }

  private async handleCommand(input: string, analysis: ParsedIntent, context: ProcessorContext, correctionContext: string, selectedProvider: AIProvider, intelligenceResult: IntelligenceResult): Promise<string> {
    context.setActiveModule('EXECUTION');
    context.setActiveModule('COMMAND');

    // Check if this is a Home Assistant command
    const lower = input.toLowerCase();

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
    // Check if this is a diagram/schematic creation request (but NOT if it explicitly asks for SVG)
    const lowerInput = input.toLowerCase();
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
      try {
        logger.log('WEATHER', `Processing weather request: "${input}"`, 'info');

        // Check if weather data is available
        const weatherData = weatherService.getData();
        if (weatherData) {
          // Format a response based on the specific weather query
          const current = weatherData.current;
          const location = weatherData.location.name;

          if (lowerInput.includes('weather') || lowerInput.includes('condition')) {
            return `Currently in ${location}, it's ${current.condition.description.toLowerCase()}. The temperature is ${weatherService.formatTemperatureOnlyFahrenheit(current.temperature)} with ${current.humidity}% humidity. Winds are blowing at ${(current.windSpeed * 0.621371).toFixed(1)} mph from the ${weatherService.getWindDirectionLabel(current.windDirection)}.`;
          } else if (lowerInput.includes('temperature') || lowerInput.includes('temp')) {
            return `The current temperature in ${location} is ${weatherService.formatTemperatureOnlyFahrenheit(current.temperature)}, which feels like ${weatherService.formatTemperatureOnlyFahrenheit(current.feelsLike)}.`;
          } else if (lowerInput.includes('forecast') || lowerInput.includes('tomorrow')) {
            const tomorrow = weatherData.daily[1]; // Next day
            return `Tomorrow in ${location}, expect a high of ${weatherService.formatTemperatureOnlyFahrenheit(tomorrow.tempMax)} and a low of ${weatherService.formatTemperatureOnlyFahrenheit(tomorrow.tempMin)}. Conditions will be ${tomorrow.condition.description.toLowerCase()}.`;
          } else if (lowerInput.includes('rain') || lowerInput.includes('precipitation')) {
            return `Currently in ${location}, there's ${(current.precipitation * 0.03937).toFixed(2)} inches of precipitation. Today's forecast shows ${(weatherData.daily[0].precipitationSum * 0.03937).toFixed(2)} inches of total precipitation.`;
          } else {
            // General weather query
            return `Here's the weather in ${location}: ${current.condition.description.toLowerCase()}. The temperature is ${weatherService.formatTemperatureOnlyFahrenheit(current.temperature)} with ${current.humidity}% humidity.`;
          }
        } else {
          // No weather data available, try to refresh
          const locationSet = weatherService.getLocation();

          if (!locationSet) {
            // Try to automatically get user's current location if no location is set
            const locationFound = await weatherService.useCurrentLocation();
            if (locationFound) {
              // Location was successfully set, now try to refresh
              await weatherService.refresh();
              const newData = weatherService.getData();
              if (newData) {
                const current = newData.current;
                const location = newData.location.name;
                return `Currently in ${location}, it's ${current.condition.description.toLowerCase()}. The temperature is ${weatherService.formatTemperatureOnlyFahrenheit(current.temperature)} with ${current.humidity}% humidity. Winds are blowing at ${(current.windSpeed * 0.621371).toFixed(1)} mph from the ${weatherService.getWindDirectionLabel(current.windDirection)}.`;
              }
            }
          } else {
            // Location was already set, try to refresh
            await weatherService.refresh();
            const newData = weatherService.getData();
            if (newData) {
              const current = newData.current;
              const location = newData.location.name;
              return `Currently in ${location}, it's ${current.condition.description.toLowerCase()}. The temperature is ${weatherService.formatTemperatureOnlyFahrenheit(current.temperature)} with ${current.humidity}% humidity. Winds are blowing at ${(current.windSpeed * 0.621371).toFixed(1)} mph from the ${weatherService.getWindDirectionLabel(current.windDirection)}.`;
            }
          }

          return "I couldn't retrieve weather data. The weather service may be temporarily unavailable or location access was denied.";
        }
      } catch (error: unknown) {
        const result = `Error retrieving weather information: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.log('WEATHER', result, 'error');
        return result;
      }
    } else if (lowerInput.includes('home assistant') || lowerInput.includes('smart home') || lowerInput.includes('connected') || lowerInput.includes('integration')) {
      // Handle queries about Home Assistant integration
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
      // Handle date and time queries
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      };
      const dateTimeString = now.toLocaleString('en-US', options);

      const result = `The current date and time is ${dateTimeString}.`;
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
      // General Query - Use intelligence-enhanced context
      let prompt = input + correctionContext;
      let systemInstruction = intelligenceResult?.systemPrompt || "You are JARVIS, an advanced AI assistant. Be concise and helpful.";

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

      // Post-process with intelligence system for naturalness
      if (intelligenceResult) {
        const result = intelligence.postProcessResponse(response.text, intelligenceResult.responseModifiers);
        logger.log('INTELLIGENCE', `Response naturalized: ${intelligenceResult.responseModifiers.tone} tone`, 'info');
        return result;
      } else {
        return response.text;
      }
    }
  }

  private async finalizeResponse(outputText: string, input: string, context: ProcessorContext, intelligenceResult: IntelligenceResult): Promise<void> {
    try {
      // Track conversation turns for context
      conversation.addTurn('USER', input);
      if (outputText) {
        conversation.addTurn('JARVIS', outputText);
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
}

// Export singleton instance
export const kernelProcessor = new KernelProcessor();