/**
 * Enhanced Kernel Processor for JARVIS AI Engine v1.1
 * 
 * Integrates new v1.1 features:
 * - Streaming responses with real-time TTS
 * - Tool/function calling
 * - Conversation persistence
 * - Enhanced context management
 */

import { 
  IntentType, 
  ProcessorState, 
  AIProvider, 
  KernelRequest,
  AIRequest 
} from '../types';
import { inputValidator } from './inputValidator';
import { LIMITS, TIMING } from '../constants/config';
import { analyzeIntent, ParsedIntent } from './gemini';
import { providerManager } from './providers';
import { 
  resilientGenerate, 
  resilientAnalyzeIntent, 
  resilientStream,
  initializeResilientAI 
} from './resilientAI';
import { voice } from './voice';
import { vision } from './vision';
import { streamingHandler, StreamingOptions } from './streaming';
import { toolRegistry, ToolCall } from './tools';
import { conversationPersistence } from './conversationPersistence';
import { vectorMemoryService } from './vectorMemoryService';
import { logger } from './logger';
import { conversation } from './conversation';
import { intelligence } from './intelligence';
import { isHomeAssistantQuery, searchEntities, generateEntityResponse } from './haEntitySearch';
import { weatherService } from './weather';
import { haService } from './home_assistant';
import { setKernelStreaming } from '../stores';
import { registerVirtualProcess, unregisterVirtualProcess, updateVirtualProcessMetrics } from './coreOs';

interface EnhancedProcessorContext {
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
  streamingEnabled: boolean;
  toolsEnabled: boolean;
}

export class EnhancedKernelProcessor {
  private readonly debounceMs: number = TIMING.DEBOUNCE_MS;

  /**
   * Main entry point - process a user request
   */
  async processRequest(
    input: string, 
    context: EnhancedProcessorContext,
    options: {
      streaming?: boolean;
      useTools?: boolean;
    } = {}
  ): Promise<string> {
    const startTime = Date.now();
    
    // Module 1: Input Validation
    const validation = await this.validateInput(input, context);
    if (!validation.isValid) {
      return validation.errorResponse || "Invalid input";
    }

    // Module 2: Duplicate Prevention
    if (await this.isDuplicate(validation.trimmedInput!, context)) {
      return "";
    }

    // Module 3: Request Initiation
    this.initiateRequest(context, input);

    // Add to persistence
    conversationPersistence.addTurn('USER', input, { 
      interrupted: false 
    });

    // Register virtual process for dashboard visibility
    const processName = options.streaming !== false && context.streamingEnabled 
      ? 'ai.streaming.request' 
      : 'ai.standard.request';
    const pid = registerVirtualProcess(
      processName,
      JSON.stringify({ input: input.substring(0, 100), streaming: options.streaming !== false && context.streamingEnabled })
    );
    
    try {
      let response: string;

      // Check if streaming is enabled and appropriate
      if (options.streaming !== false && context.streamingEnabled && 
          !context.forcedMode && this.shouldUseStreaming(input)) {
        
        response = await this.processWithStreaming(input, context, options, pid);
      } else {
        response = await this.processStandard(input, context, options, pid);
      }

      // Add response to persistence
      conversationPersistence.addTurn('JARVIS', response);

      // Update legacy conversation service for compatibility
      conversation.addTurn('USER', input);
      conversation.addTurn('JARVIS', response);

      const duration = Date.now() - startTime;
      logger.log('KERNEL', `Request processed in ${duration}ms`, 'success');

      return response;

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.log('KERNEL', `Processing error: ${errMsg}`, 'error');
      
      const errorResponse = `I encountered an error: ${errMsg}`;
      conversationPersistence.addTurn('JARVIS', errorResponse);
      
      return errorResponse;
    } finally {
      this.finalizeRequest(context);
      // Unregister virtual process
      unregisterVirtualProcess(pid);
    }
  }

  /**
   * Process with streaming (real-time response)
   */
  private async processWithStreaming(
    input: string,
    context: EnhancedProcessorContext,
    options: { useTools?: boolean },
    pid?: number
  ): Promise<string> {
    context.setActiveModule('STREAMING');
    if (pid) updateVirtualProcessMetrics(pid, 1024 * 1024, 15); // ~1MB, 15% CPU
    
    // Get conversation context
    const conversationContext = conversationPersistence.getContextAsString(6);
    
    // Check for tool calls if enabled
    if (options.useTools !== false && context.toolsEnabled) {
      const toolCall = await this.detectToolCall(input);
      if (toolCall) {
        return this.executeWithTool(input, toolCall, context);
      }
    }

    const request: AIRequest = {
      prompt: conversationContext 
        ? `Previous context:\n${conversationContext}\n\nCurrent request: ${input}`
        : input,
      systemInstruction: this.buildSystemPrompt(context)
    };

    let fullResponse = '';
    const streamingOptions: StreamingOptions = {
      enableTTS: voice.getState() !== 'MUTED',
      ttsDelayMs: 200,
      onChunk: (chunk) => {
        if (!chunk.isComplete) {
          fullResponse += chunk.text;
          // Update UI with partial response
          setKernelStreaming(true, fullResponse);
        }
      },
      onComplete: (text) => {
        setKernelStreaming(false, undefined);
      },
      onError: (error) => {
        logger.log('ERROR', `Streaming error: ${error.message}`, 'error');
        setKernelStreaming(false, undefined);
      }
    };

    try {
      // Use resilient streaming with offline queue support
      await resilientStream(
        request,
        context.forcedMode || AIProvider.GEMINI,
        {
          ...streamingOptions,
          priority: 'HIGH',
          context: { userInput: input },
          notifyUser: true
        }
      );

      return fullResponse || streamingHandler.getFullResponse();
    } catch (error) {
      // Fall back to standard processing
      logger.log('KERNEL', 'Streaming failed, falling back to standard', 'warning');
      return this.processStandard(input, context, options);
    }
  }

  /**
   * Standard (non-streaming) processing
   */
  private async processStandard(
    input: string,
    context: EnhancedProcessorContext,
    options: { useTools?: boolean },
    pid?: number
  ): Promise<string> {
    
    // Intent analysis (with offline resilience)
    context.setActiveModule('PARSER');
    if (pid) updateVirtualProcessMetrics(pid, 512 * 1024, 10); // ~512KB, 10% CPU
    const analysis = await resilientAnalyzeIntent(input, {
      priority: 'HIGH',
      context: { userInput: input },
      notifyUser: true
    });
    
    // If queued, return the queued response
    if ((analysis as ParsedIntent & { queued?: boolean }).queued) {
      return analysis.reasoning;
    }
    
    context.setActiveModule('ROUTER');
    const selectedProvider = context.forcedMode || 
      (analysis.suggestedProvider === 'OLLAMA' ? AIProvider.OLLAMA : AIProvider.GEMINI);

    context.setProvider(selectedProvider);
    context.setState(ProcessorState.EXECUTING);

    // Check for tool calls
    if (options.useTools !== false && context.toolsEnabled) {
      const toolCall = await this.detectToolCall(input);
      if (toolCall) {
        return this.executeWithTool(input, toolCall, context);
      }
    }

    // Route based on intent
    switch (analysis.type) {
      case IntentType.VISION_ANALYSIS:
        return this.handleVisionAnalysis(input, context, selectedProvider);
      
      case IntentType.MEMORY_READ:
        return this.handleMemoryRead(input, context, selectedProvider);
      
      case IntentType.MEMORY_WRITE:
        return this.handleMemoryWrite(input, context);
      
      case IntentType.COMMAND:
        return this.handleCommand(input, context, selectedProvider);
      
      case IntentType.QUERY:
      default:
        return this.handleQuery(input, context, selectedProvider);
    }
  }

  /**
   * Detect if input should trigger a tool call
   */
  private async detectToolCall(input: string): Promise<ToolCall | null> {
    const lowerInput = input.toLowerCase();
    
    // Quick keyword matching for common tools
    // This is a lightweight pre-filter before AI-based detection
    
    // Light control
    if (/\b(turn on|turn off|toggle|dim)\b.*\b(light|lights)\b/i.test(input)) {
      const room = this.extractRoom(input) || 'living room';
      const action = lowerInput.includes('turn on') ? 'on' : 
                     lowerInput.includes('turn off') ? 'off' : 
                     lowerInput.includes('toggle') ? 'toggle' : 'on';
      return { tool: 'control_light', parameters: { room, action } };
    }

    // Temperature/sensors
    if (/\b(what's|what is|how|temperature|humidity|sensor)\b/i.test(input) && 
        /\b(temperature|humidity|weather|sensor)\b/i.test(input)) {
      const sensorType = lowerInput.includes('temperature') ? 'temperature' :
                        lowerInput.includes('humidity') ? 'humidity' : 'temperature';
      const room = this.extractRoom(input);
      return { tool: 'get_sensor_value', parameters: { sensor_type: sensorType, room } };
    }

    // Timer
    const timerMatch = input.match(/\b(set|start)\s+(?:a\s+)?timer\s+(?:for\s+)?(\d+)\s+(second|seconds|minute|minutes|hour|hours)/i);
    if (timerMatch) {
      const duration = `${timerMatch[2]} ${timerMatch[3]}`;
      const label = input.replace(timerMatch[0], '').trim() || 'Timer';
      return { tool: 'set_timer', parameters: { duration, label } };
    }

    // Weather
    if (/\b(weather|temperature|forecast|rain|sunny|cloudy)\b/i.test(input)) {
      const type = lowerInput.includes('forecast') || lowerInput.includes('tomorrow') ? 'forecast' : 'current';
      return { tool: 'get_weather', parameters: { type } };
    }

    // Memory
    if (/\b(remember|save|store)\s+(?:that\s+)?(.+)/i.test(input)) {
      const contentMatch = input.match(/\b(remember|save|store)\s+(?:that\s+)?(.+)/i);
      if (contentMatch) {
        return { tool: 'remember_fact', parameters: { content: contentMatch[2], category: 'fact' } };
      }
    }

    // Recall
    if (/\b(what did|do you remember|what was|tell me about)\b/i.test(input)) {
      return { tool: 'recall_information', parameters: { query: input } };
    }

    return null;
  }

  /**
   * Execute a tool call
   */
  private async executeWithTool(
    input: string,
    toolCall: ToolCall,
    context: EnhancedProcessorContext
  ): Promise<string> {
    context.setActiveModule('TOOLS');
    
    logger.log('KERNEL', `Executing tool: ${toolCall.tool}`, 'info', toolCall.parameters);
    
    const result = await toolRegistry.execute(toolCall);
    
    if (result.success) {
      // If there's a display message, use it
      if (result.display) {
        return result.display;
      }
      
      // For vision tool, let the AI analyze the image
      if (toolCall.tool === 'analyze_image' && (result.data as {imageBase64?: string})?.imageBase64) {
        return this.handleVisionAnalysis(input, context, AIProvider.GEMINI);
      }
      
      return `Done! ${JSON.stringify(result.data)}`;
    } else {
      // Tool failed - fall back to AI
      logger.log('KERNEL', `Tool ${toolCall.tool} failed: ${result.error}`, 'warning');
      return this.handleQuery(input, context, AIProvider.GEMINI);
    }
  }

  /**
   * Determine if streaming is appropriate for this request
   */
  private shouldUseStreaming(input: string): boolean {
    // Don't stream for:
    // - Very short queries (overhead not worth it)
    // - Vision requests (needs full processing)
    // - Commands (usually short responses)
    
    if (input.length < 20) return false;
    if (/\b(look|see|analyze|describe this|what is this)\b.*\b(image|picture|camera|this)\b/i.test(input)) {
      return false;
    }
    if (/\b(turn on|turn off|toggle|set|open|close)\b/i.test(input)) {
      return false;
    }
    
    return true;
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: EnhancedProcessorContext): string {
    let prompt = `You are JARVIS, an advanced AI assistant. `;
    prompt += `You have access to tools for smart home control, memory, and information retrieval. `;
    prompt += `Be concise but helpful. `;
    
    // Add conversation summary if available
    const currentConv = conversationPersistence.getCurrentConversation();
    if (currentConv?.summary) {
      prompt += `\n\nContext: ${currentConv.summary}`;
    }
    
    return prompt;
  }

  /**
   * Extract room name from input
   */
  private extractRoom(input: string): string | undefined {
    const roomMatch = input.match(/\b(living room|bedroom|kitchen|bathroom|office|garage|hallway|basement)\b/i);
    return roomMatch ? roomMatch[1] : undefined;
  }

  // ==================== HANDLERS ====================

  private async handleVisionAnalysis(
    input: string, 
    context: EnhancedProcessorContext,
    provider: AIProvider
  ): Promise<string> {
    context.setActiveModule('VISION');
    
    if (vision.getState() !== 'ACTIVE') {
      await vision.startCamera();
      await new Promise(r => setTimeout(r, 300));
    }

    const imageBase64 = vision.captureFrame();
    if (!imageBase64) {
      return "Optical sensors failed to return frame buffer.";
    }

    // Get current Ollama config to ensure we use the correct model
    const ollamaConfig = providerManager.getOllamaConfig();
    
    const response = await providerManager.route({
      prompt: input,
      images: [imageBase64],
      systemInstruction: "You are JARVIS. Analyze the visual input concisely.",
      // Pass the model from config to ensure the correct one is used
      model: provider === AIProvider.OLLAMA ? ollamaConfig.model : undefined,
    }, provider);

    return response.text;
  }

  private async handleMemoryRead(
    input: string,
    context: EnhancedProcessorContext,
    provider: AIProvider
  ): Promise<string> {
    context.setActiveModule('MEMORY');
    
    const results = await conversationPersistence.search(input);
    
    if (results.length > 0 && results[0].relevanceScore > 5) {
      const topResult = results[0];
      const recentContext = topResult.conversation.turns
        .slice(-5)
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');
      
      const synthesis = await providerManager.route({
        prompt: `Context from previous conversation:\n${recentContext}\n\nUser asks: ${input}\n\nAnswer based on the context.`,
        systemInstruction: "You are JARVIS. Answer based on the provided context."
      }, provider);
      
      return synthesis.text;
    }

    // Fall back to vector memory (already imported at top)
    const memories = await vectorMemoryService.recall(input);
    
    if (memories.length > 0) {
      return `I found this in my memory: ${memories[0].node.content}`;
    }

    return "I don't have any information about that in my memory banks.";
  }

  private async handleMemoryWrite(
    input: string,
    context: EnhancedProcessorContext
  ): Promise<string> {
    context.setActiveModule('MEMORY');
    
    const content = input.replace(/\b(remember|save|store|note that)\b/gi, '').trim();
    
    const currentId = conversationPersistence.getCurrentId();
    if (currentId) {
      await conversationPersistence.tagConversation(
        currentId,
        ['memory', 'important']
      );
    }

    const { vectorMemoryService } = await import('./vectorMemoryService');
    await vectorMemoryService.store({
      id: `memory_${Date.now()}`,
      content,
      type: 'FACT',
      tags: ['user_stored', 'memory'],
      created: Date.now(),
      lastAccessed: Date.now()
    });

    return "I've stored that information.";
  }

  private async handleCommand(
    input: string,
    context: EnhancedProcessorContext,
    provider: AIProvider
  ): Promise<string> {
    context.setActiveModule('COMMAND');
    
    const lower = input.toLowerCase();
    
    // Try Home Assistant first
    if (haService.initialized && /\b(light|lights|switch|thermostat|lock|fan)\b/i.test(input)) {
      try {
        const result = await haService.executeSmartCommand(input.split(' '));
        return result;
      } catch (error) {
        // Fall through to AI
      }
    }

    // Use AI for complex commands
    const response = await providerManager.route({
      prompt: input,
      systemInstruction: "You are JARVIS. Execute the command or provide instructions."
    }, provider);

    return response.text;
  }

  private async handleQuery(
    input: string,
    context: EnhancedProcessorContext,
    provider: AIProvider
  ): Promise<string> {
    context.setActiveModule('QUERY');
    
    // Get conversation context
    const convContext = conversationPersistence.getContextAsString(6);
    
    // Check for weather
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('weather') || lowerInput.includes('temperature')) {
      const data = weatherService.getData();
      if (data) {
        return `Currently in ${data.location.name}: ${data.current.condition.description}, ` +
               `${Math.round(data.current.temperature)}°F with ${data.current.humidity}% humidity.`;
      }
    }

    // Check for Home Assistant sensors
    if (isHomeAssistantQuery(lowerInput) && haService.initialized) {
      const result = await searchEntities(input);
      if (result.matches.length > 0) {
        return generateEntityResponse(input, result);
      }
    }

    // Standard query with context
    let prompt = input;
    if (convContext) {
      prompt = `Previous conversation:\n${convContext}\n\nCurrent request: ${input}\n\n` +
               `Respond naturally, considering the conversation context.`;
    }

    const response = await providerManager.route({
      prompt,
      systemInstruction: "You are JARVIS. Be helpful and concise."
    }, provider);

    return response.text;
  }

  // ==================== UTILITY METHODS ====================

  private async validateInput(
    input: string, 
    context: EnhancedProcessorContext
  ): Promise<{ isValid: boolean; errorResponse?: string; trimmedInput?: string }> {
    if (!input || typeof input !== 'string') {
      return { isValid: false, errorResponse: "Invalid input received" };
    }

    const validation = inputValidator.validate(input, {
      maxLength: LIMITS.MAX_INPUT_LENGTH,
      strictMode: false,
      context: 'user_input'
    });

    if (!validation.valid) {
      const errorResponse = validation.error?.includes('injection')
        ? "I've detected potentially harmful content. Please rephrase."
        : "Your input couldn't be processed. Please try again.";
      return { isValid: false, errorResponse };
    }

    return { 
      isValid: true, 
      trimmedInput: validation.sanitized.trim().toLowerCase() 
    };
  }

  private async isDuplicate(
    trimmedInput: string,
    context: EnhancedProcessorContext
  ): Promise<boolean> {
    const now = Date.now();
    
    // Check recent voice commands
    const isRecent = context.recentVoiceCommands.some(
      cmd => cmd.text === trimmedInput && (now - cmd.timestamp) < 2000
    );
    
    if (isRecent) return true;
    if (context.isProcessing.current) return true;
    if (trimmedInput === context.lastRequestText.current && 
        (now - context.lastRequestTime.current) < this.debounceMs) {
      return true;
    }

    // Update tracking
    context.lastRequestTime.current = now;
    context.lastRequestText.current = trimmedInput;
    context.isProcessing.current = true;

    return false;
  }

  private initiateRequest(context: EnhancedProcessorContext, input: string): void {
    context.setState(ProcessorState.ANALYZING);
    context.setActiveModule('PARSER');
    logger.log(context.origin === 'USER_VOICE' ? 'VOICE' : 'USER', input, 'info');
  }

  private finalizeRequest(context: EnhancedProcessorContext): void {
    context.setState(ProcessorState.IDLE);
    context.setActiveModule(null);
    context.setProvider(null);
    context.isProcessing.current = false;
  }
}

// Export singleton
export const enhancedKernelProcessor = new EnhancedKernelProcessor();
