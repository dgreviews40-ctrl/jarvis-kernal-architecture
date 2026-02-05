/**
 * Streaming Response Service for JARVIS AI Engine v1.1
 * 
 * Provides real-time streaming of AI responses with:
 * - Token-by-token streaming from supported providers
 * - Voice integration for speaking as text arrives
 * - Abort controller for cancellation
 * - Stream buffering for smooth TTS
 */

import { AIProvider, AIRequest } from '../types';
import { providerManager } from './providers';
import { voice } from './voice';
import { logger } from './logger';

export interface StreamChunk {
  text: string;
  isComplete: boolean;
  provider: AIProvider;
  model: string;
}

export interface StreamingOptions {
  enableTTS?: boolean;
  ttsDelayMs?: number;  // Delay before starting TTS to buffer tokens
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class StreamingResponseHandler {
  private abortController: AbortController | null = null;
  private ttsBuffer: string = '';
  private ttsTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStreaming: boolean = false;
  private fullResponse: string = '';

  /**
   * Check if currently streaming
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Abort current stream
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout);
      this.ttsTimeout = null;
    }
    this.isStreaming = false;
    this.ttsBuffer = '';
  }

  /**
   * Stream response from AI provider
   */
  async stream(
    request: AIRequest,
    preference: AIProvider = AIProvider.GEMINI,
    options: StreamingOptions = {}
  ): Promise<string> {
    const { 
      enableTTS = true, 
      ttsDelayMs = 150,
      onChunk,
      onComplete,
      onError
    } = options;

    // Abort any existing stream
    this.abort();

    this.isStreaming = true;
    this.fullResponse = '';
    this.ttsBuffer = '';
    this.abortController = new AbortController();

    try {
      const provider = providerManager.getProvider(preference);
      if (!provider) {
        throw new Error(`Provider ${preference} not found`);
      }

      // Check if provider supports streaming
      if (!this.supportsStreaming(preference)) {
        logger.log('KERNEL', 'Provider does not support streaming, falling back to standard', 'warning');
        const response = await provider.generate(request);
        this.fullResponse = response.text;
        
        if (enableTTS && voice.getState() !== 'MUTED') {
          await voice.speak(response.text);
        }
        
        onComplete?.(response.text);
        return response.text;
      }

      logger.log('KERNEL', `Starting stream with ${preference}`, 'info');

      // Start streaming based on provider
      if (preference === AIProvider.GEMINI) {
        await this.streamGemini(request, { enableTTS, ttsDelayMs, onChunk });
      } else {
        // Fallback for other providers
        const response = await provider.generate(request);
        this.fullResponse = response.text;
        
        if (enableTTS && voice.getState() !== 'MUTED') {
          await voice.speak(response.text);
        }
      }

      onComplete?.(this.fullResponse);
      return this.fullResponse;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.log('ERROR', `Stream error: ${err.message}`, 'error');
      onError?.(err);
      throw err;
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /**
   * Check if provider supports streaming
   */
  supportsStreaming(provider: AIProvider): boolean {
    return [AIProvider.GEMINI].includes(provider);
    // TODO: Add OPENAI, ANTHROPIC when implemented
  }

  /**
   * Stream from Gemini
   */
  private async streamGemini(
    request: AIRequest,
    options: { enableTTS: boolean; ttsDelayMs: number; onChunk?: (chunk: StreamChunk) => void }
  ): Promise<void> {
    const { GoogleGenAI } = await import('@google/genai');
    
    // Get API key from provider manager
    const geminiProvider = providerManager.getProvider(AIProvider.GEMINI);
    const apiKey = (geminiProvider as any)?.getApiKey?.() || 
                   (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : null) ||
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null);
    
    if (!apiKey) {
      throw new Error('Gemini API key not found. Please configure your API key in settings.');
    }

    const client = new GoogleGenAI({ apiKey });
    const config = providerManager.getAIConfig();

    const startTime = Date.now();
    let tokenCount = 0;

    // Check if generateContentStream is available (v1.1+ of SDK)
    const hasStreaming = typeof (client.models as any).generateContentStream === 'function';
    
    if (!hasStreaming) {
      // Fallback to non-streaming
      logger.log('KERNEL', 'Streaming not available in SDK, falling back to standard', 'warning');
      const response = await client.models.generateContent({
        model: request.images && request.images.length > 0 ? 'gemini-2.5-flash-image' : config.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature ?? config.temperature,
        }
      });
      
      const text = response.text || '';
      this.fullResponse = text;
      options.onChunk?.({
        text,
        isComplete: true,
        provider: AIProvider.GEMINI,
        model: config.model
      });
      return;
    }

    // Create streaming request
    const stream = await (client.models as any).generateContentStream({
      model: request.images && request.images.length > 0 ? 'gemini-2.5-flash-image' : config.model,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: request.temperature ?? config.temperature,
      }
    });

    for await (const chunk of stream) {
      // Check for abort before processing each chunk
      if (this.abortController?.signal.aborted) {
        logger.log('KERNEL', 'Stream aborted by user', 'warning');
        break;
      }

      const text = chunk.text || '';
      if (!text) continue;
      
      // Double-check abort after getting text
      if (this.abortController?.signal.aborted) break;

      this.fullResponse += text;
      tokenCount++;

      // Send chunk to callback
      options.onChunk?.({
        text,
        isComplete: false,
        provider: AIProvider.GEMINI,
        model: config.model
      });

      // Handle TTS streaming
      if (options.enableTTS) {
        this.bufferForTTS(text, options.ttsDelayMs);
      }
    }

    const latency = Date.now() - startTime;
    logger.log('KERNEL', `Stream complete: ${tokenCount} chunks in ${latency}ms`, 'success');

    // Flush remaining TTS buffer
    if (options.enableTTS && this.ttsBuffer.trim()) {
      this.speakBuffer();
    }

    // Send completion chunk
    options.onChunk?.({
      text: '',
      isComplete: true,
      provider: AIProvider.GEMINI,
      model: config.model
    });
  }

  /**
   * Buffer text for TTS to avoid speaking individual tokens
   */
  private bufferForTTS(text: string, delayMs: number): void {
    this.ttsBuffer += text;

    // Clear existing timeout
    if (this.ttsTimeout) {
      clearTimeout(this.ttsTimeout);
    }

    // Set new timeout to speak buffer (use global setTimeout for compatibility)
    this.ttsTimeout = setTimeout(() => {
      this.speakBuffer();
    }, delayMs);
  }

  /**
   * Speak buffered text
   */
  private speakBuffer(): void {
    if (!this.ttsBuffer.trim() || voice.getState() === 'MUTED') {
      this.ttsBuffer = '';
      return;
    }

    // Speak the buffer
    voice.speak(this.ttsBuffer).catch(err => {
      logger.log('ERROR', `TTS error: ${err.message}`, 'error');
    });

    this.ttsBuffer = '';
  }

  /**
   * Get full response text
   */
  getFullResponse(): string {
    return this.fullResponse;
  }
}

// Export singleton
export const streamingHandler = new StreamingResponseHandler();
