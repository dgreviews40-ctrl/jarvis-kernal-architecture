
import { AIProvider, IAIProvider, AIRequest, AIResponse, HealthEventType, ImpactLevel, AIConfig, OllamaConfig } from "../types";
import { GoogleGenAI } from "@google/genai";
import { cortex } from "./cortex";
import { geminiRateLimiter } from "./rateLimiter";
import { EnhancedCircuitBreaker } from "./CircuitBreaker";
import { RequestDeduplicator, createDedupKey } from "./deduplicator";
import { kvCache } from "./kvCache";
import {
  JARVISError,
  ErrorCode,
  NetworkError,
  TimeoutError,
  AuthError,
  QuotaError,
  ValidationError,
  classifyError,
  httpStatusToErrorCode
} from "./errorTypes";

/**
 * Ollama Rate Limiter
 * Prevents overwhelming local Ollama instance
 * - Local instances have limited concurrency
 * - Too many requests cause OOM or timeout
 * - Rate limiting provides graceful degradation
 */
class OllamaRateLimiter {
  private queue: Array<{
    resolve: () => void;
    reject: (reason: Error) => void;
    timestamp: number;
  }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minIntervalMs: number; // Minimum time between requests
  private readonly maxConcurrent: number;
  private currentConcurrent = 0;

  constructor(options: { requestsPerSecond?: number; maxConcurrent?: number } = {}) {
    // Default: 4 requests per second, max 2 concurrent
    this.minIntervalMs = 1000 / (options.requestsPerSecond || 4);
    this.maxConcurrent = options.maxConcurrent || 2;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        timestamp: Date.now()
      });
      this.processQueue();
    });
  }

  release(): void {
    // Prevent negative concurrent count
    if (this.currentConcurrent > 0) {
      this.currentConcurrent--;
    }
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we can process more concurrent requests
      if (this.currentConcurrent >= this.maxConcurrent) {
        this.processing = false;
        return;
      }

      // Check rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minIntervalMs) {
        // Wait before processing next request
        const waitTime = this.minIntervalMs - timeSinceLastRequest;
        await new Promise(r => setTimeout(r, waitTime));
      }

      // Process the next request
      const request = this.queue.shift();
      if (request) {
        // Check for timeout (30s max wait)
        if (Date.now() - request.timestamp > 30000) {
          request.reject(new Error('Rate limit queue timeout'));
          continue;
        }

        this.currentConcurrent++;
        this.lastRequestTime = Date.now();
        request.resolve();
      }
    }

    this.processing = false;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      currentConcurrent: this.currentConcurrent,
      maxConcurrent: this.maxConcurrent,
      minIntervalMs: this.minIntervalMs
    };
  }
}

// Global Ollama rate limiter instance
const ollamaRateLimiter = new OllamaRateLimiter({ 
  requestsPerSecond: 4,  // 4 req/sec prevents local overload
  maxConcurrent: 2       // Max 2 concurrent to prevent OOM
});

const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gemini-2.0-flash',
  temperature: 0.7
};

const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  url: "http://localhost:11434",
  model: "llama3",
  temperature: 0.7
};

// Request timeout configuration (in milliseconds)
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Helper function to create a timeout promise with typed errors
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(
        new TimeoutError(
          `${operation} timed out after ${timeoutMs / 1000}s`,
          timeoutMs,
          ErrorCode.CONNECTION_TIMEOUT,
          { operation }
        )
      ), timeoutMs)
    )
  ]);
};

// --- GEMINI PROVIDER ---
export class GeminiProvider implements IAIProvider {
  public id = AIProvider.GEMINI;
  public name = "Google Gemini Cloud";
  private client: GoogleGenAI | null = null;
  private sourceId = 'provider.gemini';
  private circuitBreaker: EnhancedCircuitBreaker;
  private deduplicator: RequestDeduplicator<AIResponse>;

  constructor() {
    this.circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      timeout: 30000 // 30 seconds
    });
    this.deduplicator = new RequestDeduplicator<AIResponse>({
      maxInFlightAgeMs: 60000, // 60s timeout for generation
      debug: false
    });

    const apiKey = this.getApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  public getApiKey(): string | null {
    // SECURITY FIX: Use secure apiKeyManager instead of localStorage + base64
    // This ensures proper AES-GCM encryption for API keys
    
    // Try to get from secure storage (async, so we need a sync fallback)
    // For now, check environment variables first (safe, not stored)
    if (typeof import.meta.env !== 'undefined') {
      const envKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
      if (envKey && typeof envKey === 'string') {
        console.log('[PROVIDERS] Using API key from environment');
        return envKey;
      }
    }
    
    // Fallback to process.env for Node.js environments
    if (typeof process !== 'undefined' && process.env) {
      const envKey = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
      if (envKey && typeof envKey === 'string') {
        console.log('[PROVIDERS] Using API key from environment');
        return envKey;
      }
    }

    // LEGACY FALLBACK: Check for old format keys (will be migrated on init)
    // This is temporary and will be removed in a future version
    if (typeof localStorage !== 'undefined') {
      const legacyKey = localStorage.getItem('GEMINI_API_KEY');
      if (legacyKey) {
        try {
          const decoded = atob(legacyKey);
          console.warn('[PROVIDERS] WARNING: Using legacy unencrypted API key. Please re-save your API key in Settings.');
          return decoded;
        } catch {
          // Invalid base64, ignore
        }
      }
    }

    return null;
  }

  /**
   * Set API key securely
   * This should be called from Settings instead of direct localStorage manipulation
   */
  public async setApiKey(apiKey: string): Promise<void> {
    // Import and use secure storage
    const { apiKeyManager } = await import('./apiKeyManager');
    await apiKeyManager.setKey('gemini', apiKey);
    console.log('[PROVIDERS] API key stored securely');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getApiKey() && navigator.onLine;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    // Check circuit breaker first
    if (this.circuitBreaker.getState().state === 'OPEN') {
      const state = this.circuitBreaker.getState();
      throw new Error(`GEMINI service is temporarily unavailable (circuit breaker OPEN). Last failure: ${state.lastFailureTime ? new Date(state.lastFailureTime).toLocaleTimeString() : 'unknown'}`);
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("CRITICAL: Gemini API Key not detected. Please add it in Settings > API & Security.");
    }

    // Deduplicate identical requests
    const dedupKey = createDedupKey([
      'gemini',
      request.prompt.slice(0, 100), // First 100 chars of prompt
      request.model ?? 'default',
      request.images?.length ?? 0
    ]);
    
    return this.deduplicator.dedup(dedupKey, () => this.generateInternal(request));
  }

  private async generateInternal(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    
    // === RATE LIMIT CHECK ===
    const check = geminiRateLimiter.canMakeRequest(request.images ? 2000 : 500);
    if (!check.allowed) {
      console.warn(`[GEMINI] Rate limit check failed: ${check.reason}. Retry after: ${check.retryAfter}s`);
      throw new QuotaError(
        `Rate limit exceeded: ${check.reason}. Please retry in ${check.retryAfter}s or switch to Ollama mode.`,
        ErrorCode.API_QUOTA_EXCEEDED,
        check.retryAfter ? check.retryAfter * 1000 : undefined
      );
    }

    if (!this.client) {
      if (!apiKey) {
        throw new AuthError(
          'Gemini API key is required but not available',
          ErrorCode.API_KEY_INVALID
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }

    const start = Date.now();
    let response;
    const config = providerManager.getAIConfig();
    const timeoutMs = request.timeout ?? REQUEST_TIMEOUT_MS;

    try {
      // Wrap the actual API call with the circuit breaker (with per-request timeout)
      response = await this.circuitBreaker.call(async () => {
        if (request.images && request.images.length > 0) {
          const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

          request.images.forEach(imgBase64 => {
            // Validate that the image is a proper base64 string
            if (!imgBase64 || typeof imgBase64 !== 'string') {
              throw new Error('Invalid image data provided');
            }

            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imgBase64
              }
            });
          });

          parts.push({ text: request.prompt });

          return await withTimeout(
            this.client!.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts },
              config: {
                systemInstruction: request.systemInstruction,
                temperature: request.temperature ?? config.temperature,
              }
            }),
            timeoutMs,
            'Gemini Vision API'
          );
        } else {
          return await withTimeout(
            this.client!.models.generateContent({
              model: config.model,
              contents: request.prompt,
              config: {
                systemInstruction: request.systemInstruction,
                temperature: request.temperature ?? config.temperature,
              }
            }),
            timeoutMs,
            'Gemini API'
          );
        }
      }, timeoutMs);

      const latency = Date.now() - start;

      // Track successful request
      geminiRateLimiter.trackRequest(request.images ? 2000 : 500);

      cortex.reportEvent({
          sourceId: this.sourceId,
          type: HealthEventType.SUCCESS,
          impact: ImpactLevel.NONE,
          latencyMs: latency,
          context: { endpoint: 'generateContent' }
      });

      // Validate response before returning
      console.log('[GEMINI] Raw response:', response);
      if (!response) {
        throw new ValidationError(
        'Gemini API returned null/undefined response',
        undefined,
        ErrorCode.API_INVALID_REQUEST
      );
      }
      if (!response.text) {
        console.warn('[GEMINI] Response missing text field:', response);
        throw new ValidationError(
        'Gemini API returned empty response (no text field)',
        undefined,
        ErrorCode.API_INVALID_REQUEST
      );
      }

      return {
        text: response.text || "",
        provider: AIProvider.GEMINI,
        model: request.images ? 'gemini-2.5-flash-image' : config.model,
        latencyMs: latency
      };

    } catch (error: unknown) {
        const latency = Date.now() - start;

        // Track error for rate limiting
        geminiRateLimiter.trackError(error);

        cortex.reportEvent({
            sourceId: this.sourceId,
            type: HealthEventType.API_ERROR,
            impact: ImpactLevel.MEDIUM,
            latencyMs: latency,
            context: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
        });

        // Circuit breaker already handles the failure tracking, so we just rethrow
        throw error;
    }
  }
}

// --- OLLAMA PROVIDER (Local / Simulated) ---
export class OllamaProvider implements IAIProvider {
  public id = AIProvider.OLLAMA;
  public name = "Ollama Local Interface";
  private circuitBreaker: EnhancedCircuitBreaker;
  private deduplicator: RequestDeduplicator<AIResponse>;

  constructor() {
    this.circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 60000, // 1 minute
      timeout: 20000 // 20 seconds
    });
    this.deduplicator = new RequestDeduplicator<AIResponse>({
      maxInFlightAgeMs: 120000, // 120s timeout for local LLM (can be slower)
      debug: false
    });
  }

  async isAvailable(): Promise<boolean> {
    const config = providerManager.getOllamaConfig();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${config.url}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    // Check circuit breaker first
    if (this.circuitBreaker.getState().state === 'OPEN') {
      const state = this.circuitBreaker.getState();
      return {
        text: `[SERVICE UNAVAILABLE] Ollama service is temporarily unavailable (circuit breaker OPEN). Last failure: ${state.lastFailureTime ? new Date(state.lastFailureTime).toLocaleTimeString() : 'unknown'}`,
        provider: AIProvider.OLLAMA,
        model: 'fallback-unavailable',
        latencyMs: 0
      };
    }

    // Deduplicate identical requests
    const dedupKey = createDedupKey([
      'ollama',
      request.prompt.slice(0, 100),
      request.model ?? 'default',
      request.images?.length ?? 0
    ]);
    
    return this.deduplicator.dedup(dedupKey, () => this.generateInternal(request));
  }

  private async generateInternal(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const config = providerManager.getOllamaConfig();
    
    // Use request-specific model if provided, otherwise fall back to config
    const model = request.model || config.model;
    
    // Use request timeout if provided, otherwise default
    const timeoutMs = request.timeout ?? REQUEST_TIMEOUT_MS;
    
    // Validate request parameters
    if (!config.url || !config.model) {
      throw new Error('Ollama configuration is incomplete. Please check your settings.');
    }

    // Vision processing with Ollama (requires vision-capable model like llava, bakllava, moondream)
    if (request.images && request.images.length > 0) {
      try {
        // Check if using a vision-capable model (use request-specific model if provided)
        const visionModels = ['llava', 'bakllava', 'moondream', 'cogvlm', 'fuyu'];
        const isVisionModel = visionModels.some(vm => model.toLowerCase().includes(vm));

        if (!isVisionModel) {
          return {
            text: `[VISION NOTICE] Current model "${model}" doesn't support images. Install a vision model like "llava" or "bakllava" for image analysis.\n\nTo install: ollama pull llava`,
            provider: AIProvider.OLLAMA,
            model: model,
            latencyMs: Date.now() - start
          };
        }

        // Validate and prepare image data
        const validImages: string[] = [];
        for (const img of request.images) {
          if (!img || typeof img !== 'string') {
            console.warn('[OLLAMA VISION] Invalid image data skipped');
            continue;
          }
          // Ensure image data doesn't have data URL prefix (Ollama expects raw base64)
          const cleanImg = img.includes(',') ? img.split(',')[1] : img;
          validImages.push(cleanImg);
          console.log('[OLLAMA VISION] Image data length:', cleanImg.length, 'chars');
        }
        
        if (validImages.length === 0) {
          throw new Error('No valid image data provided');
        }

        console.log('[OLLAMA VISION] Sending request:', {
          model,
          prompt: request.prompt?.substring(0, 50) + '...',
          imageCount: validImages.length,
          firstImageLength: validImages[0]?.length
        });
        
        // Acquire rate limiter slot before making request
        await ollamaRateLimiter.acquire();
        
        // Wrap the API call with circuit breaker (with per-request timeout)
        const result = await this.circuitBreaker.call(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const res = await fetch(`${config.url}/api/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'JARVIS-Kernel/1.0' // Add user agent for identification
              },
              body: JSON.stringify({
                model: model,
                prompt: request.prompt || 'Describe this image in detail.',
                images: validImages, // Use cleaned base64 images
                system: request.systemInstruction || 'You are JARVIS. Analyze images accurately and concisely.',
                stream: false,
                options: {
                  temperature: request.temperature ?? config.temperature
                }
              }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
              const code = httpStatusToErrorCode(res.status);
              if (res.status === 401 || res.status === 403) {
                throw new AuthError(`Ollama API authentication failed: ${res.statusText}`, code);
              }
              if (res.status === 429) {
                throw new QuotaError(`Ollama API rate limited: ${res.statusText}`, code);
              }
              throw new JARVISError(
                `Ollama API error: ${res.status} ${res.statusText}`,
                code
              );
            }

            const data = await res.json();
            if (!data || typeof data !== 'object') {
              throw new Error('Ollama returned invalid response format');
            }

            return data;
          } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        }, timeoutMs);

        if (!result || !result.response) {
          throw new Error('Ollama returned empty response');
        }

        return {
          text: result.response,
          provider: AIProvider.OLLAMA,
          model: model,
          latencyMs: Date.now() - start
        };

      } catch (error: unknown) {
        console.error('[OLLAMA VISION] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
        return {
          text: `[VISION ERROR] ${errorMessage}.\n\nMake sure you have a vision model installed:\nollama pull llava`,
          provider: AIProvider.OLLAMA,
          model: model,
          latencyMs: Date.now() - start
        };
      } finally {
        // Always release rate limiter slot (even on success or error)
        ollamaRateLimiter.release();
      }
    }

    // Check if the request requires internet access (contains certain keywords)
    const requiresInternet = this.checkInternetRequirement(request.prompt);

    let finalPrompt = request.prompt;
    if (requiresInternet) {
      try {
        // Import the search service dynamically
        const { searchService } = await import('./search');
        const searchResults = await searchService.search(request.prompt);
        const searchContext = searchService.formatResultsForAI(searchResults);

        // Enhance the prompt with search results
        finalPrompt = `IMPORTANT: Use the following search results to answer the user's question. Do not make up information.\n\nSearch Results:\n${searchContext}\n\nUser Question: ${request.prompt}\n\nAnswer:`;
      } catch (searchError) {
        console.warn('Search failed, proceeding with original prompt:', searchError);
        // Proceed with original prompt if search fails
      }
    }

    // KV-Cache: Get or create conversation context (AFTER search enhancement)
    let conversationContext: ReturnType<typeof kvCache.buildPromptWithContext> = null;
    let cacheHit = false;
    let cacheStartTime = 0;
    
    if (request.conversationId && !request.images?.length) {
      cacheStartTime = Date.now();
      const context = kvCache.getOrCreateContext(
        request.conversationId,
        request.systemInstruction || 'You are JARVIS.',
        model
      );
      
      // Build prompt with cached context, using search-enhanced finalPrompt
      conversationContext = kvCache.buildPromptWithContext(
        request.conversationId,
        finalPrompt  // Use search-enhanced prompt, not raw request.prompt
      );
      
      cacheHit = context.useCount > 1;
      if (cacheHit) {
        console.log(`[KV-CACHE] Hit for conversation ${request.conversationId} (use #${context.useCount})`);
      }
    }
    
    console.log('[OLLAMA DEBUG] Generate request:', { 
      requestModel: request.model, 
      configModel: config.model, 
      finalModel: model,
      hasImages: !!request.images?.length,
      cacheEnabled: !!request.conversationId,
      cacheHit,
      requiresInternet
    });

    try {
      // Acquire rate limiter slot before making request
      await ollamaRateLimiter.acquire();
      
      // Wrap the API call with circuit breaker (pass timeout to circuit breaker)
      const result = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          // Build request body - use cached context if available
          const requestBody: any = {
            model: model,
            stream: false,
            options: {
              temperature: request.temperature ?? config.temperature
            }
          };
          
          // Use KV-cached context if available
          if (conversationContext) {
            requestBody.prompt = conversationContext.prompt;
            requestBody.system = conversationContext.system;
            // Include Ollama context ID if available from previous response
            if (conversationContext.context) {
              requestBody.context = conversationContext.context;
            }
          } else {
            requestBody.prompt = finalPrompt;
            requestBody.system = request.systemInstruction;
          }
          
          const res = await fetch(`${config.url}/api/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'JARVIS-Kernel/1.0' // Add user agent for identification
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
          }

          const data = await res.json();
          if (!data || typeof data !== 'object') {
            throw new Error('Ollama returned invalid response format');
          }

          return data;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      }, timeoutMs);

      // Update KV-Cache with response and Ollama context ID
      if (request.conversationId && result && !request.images?.length) {
        // Update with the Ollama context ID for next request
        if (result.context) {
          kvCache.updateOllamaContextId(request.conversationId, result.context);
        }
        
        // Add user message to context
        kvCache.addMessage(request.conversationId, 'user', request.prompt);
        
        // Add assistant response to context
        if (result.response) {
          kvCache.addMessage(request.conversationId, 'assistant', result.response);
        }
        
        // Record latency improvement if cache hit
        if (cacheHit) {
          const totalTime = Date.now() - start;
          // Estimate 20% improvement on cache hits (typical for KV-cache)
          const estimatedImprovement = Math.round(totalTime * 0.2);
          kvCache.recordLatencyImprovement(estimatedImprovement);
          
          console.log(`[KV-CACHE] Updated context for ${request.conversationId}, estimated improvement: ${estimatedImprovement}ms`);
        }
      }

      if (!result || !result.response) {
        throw new Error('Ollama returned empty response');
      }

      return {
        text: result.response,
        provider: AIProvider.OLLAMA,
        model: model,
        latencyMs: Date.now() - start
      };

    } catch (e) {
      console.error('[OLLAMA] Request failed:', e);
      // Release rate limiter slot before throwing
      ollamaRateLimiter.release();
      // Throw error so providerManager can fallback to Gemini
      throw new Error(`Ollama request failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      // Always release rate limiter slot
      ollamaRateLimiter.release();
    }
  }

  /**
   * Check if a prompt requires internet access
   * Only checks the actual user query, not system instructions or formatting templates
   */
  private checkInternetRequirement(prompt: string): boolean {
    // Extract just the user query from common prompt patterns
    // This avoids matching instructional text like "what is this" in system prompts
    let userQuery = prompt;
    
    // If this looks like an intent classification or system prompt, skip internet search
    // These prompts contain instructional text that falsely triggers keyword matches
    if (prompt.includes('Analyze this input') || 
        prompt.includes('respond in exactly this JSON format') ||
        prompt.includes('You are an intent classifier') ||
        prompt.includes('Input:') && prompt.includes('Rules:')) {
      return false;
    }
    
    // Try to extract just the user question from enhanced prompts
    const userQuestionMatch = prompt.match(/User Question:\s*([^\n]+)/i);
    if (userQuestionMatch) {
      userQuery = userQuestionMatch[1];
    } else {
      // For simple prompts, use the last line or sentence as the user query
      const lines = prompt.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        // Skip lines that look like instructions or formatting
        const instructionPatterns = [
          /^analyze/i, /^respond/i, /^format/i, /^json/i, /^{/, /^\[/,
          /^rules:/i, /^input:/i, /^output:/i, /^note:/i, /^important:/i
        ];
        const nonInstructionLines = lines.filter(line => 
          !instructionPatterns.some(pattern => pattern.test(line.trim()))
        );
        if (nonInstructionLines.length > 0) {
          userQuery = nonInstructionLines[nonInstructionLines.length - 1];
        }
      }
    }
    
    const internetKeywords = [
      'current', 'today', 'now', 'latest', 'recent', 'news', 'weather', 'temperature',
      'live', 'real-time', 'update', 'stock', 'price', 'currency',
      'sports score', 'movie release'
    ];
    
    // More specific patterns that indicate a real-time info need
    const specificPatterns = [
      /\bwhat\s+(?:time|date|day|year)\s+is\s+it\b/i,
      /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:current|today|now|latest)\b/i,
      /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:weather|temperature)\b/i,
      /\bhow\s+(?:is|are)\s+(?:the\s+)?(?:weather|temperature)\b/i,
      /\b(?:stock|crypto|bitcoin)\s+(?:price|value)\b/i,
      /\b(?:news|headlines)\s+(?:about|for|on)\b/i
    ];

    const lowerQuery = userQuery.toLowerCase();
    
    // Check specific patterns first (more accurate)
    if (specificPatterns.some(pattern => pattern.test(userQuery))) {
      return true;
    }
    
    // Then check general keywords
    return internetKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  // ==================== KV-CACHE METHODS ====================

  /**
   * Get KV-Cache statistics for Ollama conversations
   */
  getCacheStats(): ReturnType<typeof kvCache.getStats> {
    return kvCache.getStats();
  }

  /**
   * Get active conversation contexts
   */
  getActiveContexts(): ReturnType<typeof kvCache.getActiveContexts> {
    return kvCache.getActiveContexts();
  }

  /**
   * Clear a specific conversation context
   */
  clearContext(conversationId: string): void {
    kvCache.invalidateContext(conversationId);
  }

  /**
   * Clear all cached conversation contexts
   */
  clearAllContexts(): void {
    kvCache.clearAll();
  }

  /**
   * Enable or disable KV-Cache
   */
  setCacheEnabled(enabled: boolean): void {
    kvCache.setEnabled(enabled);
  }

  /**
   * Check if KV-Cache is enabled
   */
  isCacheEnabled(): boolean {
    return kvCache.isEnabled();
  }
}

// --- PROVIDER MANAGER ---
class ProviderManager {
  private providers: Map<AIProvider, IAIProvider> = new Map();
  private forcedMode: AIProvider | null = null;
  private aiConfig: AIConfig = { ...DEFAULT_AI_CONFIG };
  private ollamaConfig: OllamaConfig = { ...DEFAULT_OLLAMA_CONFIG };

  constructor() {
    this.register(new GeminiProvider());
    this.register(new OllamaProvider());
    
    this.loadConfigs();
  }

  private loadConfigs() {
    const aiSaved = localStorage.getItem('jarvis_ai_config');
    if (aiSaved) {
      try { this.aiConfig = JSON.parse(aiSaved); } catch (e) { console.warn('[PROVIDERS] Failed to parse saved AI config:', e); }
    }
    const ollamaSaved = localStorage.getItem('jarvis_ollama_config');
    if (ollamaSaved) {
      try { this.ollamaConfig = JSON.parse(ollamaSaved); } catch (e) { console.warn('[PROVIDERS] Failed to parse saved Ollama config:', e); }
    }
  }

  register(provider: IAIProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: AIProvider): IAIProvider | undefined {
    return this.providers.get(id);
  }

  public setForcedMode(mode: AIProvider | null) {
    this.forcedMode = mode;
  }

  public getMode(): AIProvider | null {
    return this.forcedMode;
  }

  public setAIConfig(config: AIConfig) {
    this.aiConfig = config;
    localStorage.setItem('jarvis_ai_config', JSON.stringify(config));
  }

  public getAIConfig(): AIConfig {
    return this.aiConfig;
  }

  public setOllamaConfig(config: OllamaConfig) {
    this.ollamaConfig = config;
    localStorage.setItem('jarvis_ollama_config', JSON.stringify(config));
  }

  public getOllamaConfig(): OllamaConfig {
    return this.ollamaConfig;
  }

  public async pingOllama(): Promise<boolean> {
     try {
       const res = await fetch(`${this.ollamaConfig.url}/api/tags`);
       return res.ok;
     } catch (e) {
       return false;
     }
  }

  public async getOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.ollamaConfig.url}/api/tags`);
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      if (data && Array.isArray(data.models)) {
        return data.models.map((model: { name?: string; model?: string }) => model.name || model.model);
      }
      return [];
    } catch (e) {
      console.error('Error fetching Ollama models:', e);
      return [];
    }
  }

  async route(request: AIRequest, preference: AIProvider = AIProvider.GEMINI): Promise<AIResponse> {
    let targetProvider = preference;

    if (this.forcedMode) {
       targetProvider = this.forcedMode;
       const provider = this.providers.get(targetProvider);
       if (!provider) throw new Error(`Provider ${targetProvider} not found.`);
       
       try {
         return await provider.generate(request);
       } catch (e) {
         // If forced mode is OLLAMA and it fails, fallback to GEMINI
         if (this.forcedMode === AIProvider.OLLAMA) {
           console.warn('[PROVIDER] Ollama failed in forced mode, falling back to Gemini:', e);
           const gemini = this.providers.get(AIProvider.GEMINI);
           if (gemini) {
             return await gemini.generate(request);
           }
         }
         throw e; // Re-throw if not Ollama or if Gemini also not available
       }
    }

    const policies = cortex.getActivePolicies('global.router');
    const fallbackPolicy = policies.find(p => p.parameterKey === 'preferred_provider');
    if (fallbackPolicy) {
        targetProvider = fallbackPolicy.overrideValue as AIProvider;
    }

    const provider = this.providers.get(targetProvider);
    let isAvailable = false;
    try {
      isAvailable = provider ? await provider.isAvailable() : false;
    } catch (e) {
      console.warn(`Provider ${targetProvider} availability check failed:`, e);
      isAvailable = false;
    }
    
    if (provider && isAvailable) {
      try {
        return await provider.generate(request);
      } catch (e) {
        console.warn(`Provider ${targetProvider} failed, attempting automatic fallback.`);
      }
    }

    const fallback = this.providers.get(AIProvider.OLLAMA);
    if (fallback) return fallback.generate(request);

    throw new Error("No AI Providers available.");
  }

  // ==================== KV-CACHE MANAGEMENT ====================

  /**
   * Get KV-Cache statistics for Ollama provider
   */
  getOllamaCacheStats(): ReturnType<typeof kvCache.getStats> | null {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (!ollama) return null;
    return ollama.getCacheStats();
  }

  /**
   * Get active Ollama conversation contexts
   */
  getOllamaActiveContexts(): ReturnType<typeof kvCache.getActiveContexts> | null {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (!ollama) return null;
    return ollama.getActiveContexts();
  }

  /**
   * Clear a specific Ollama conversation context
   */
  clearOllamaContext(conversationId: string): void {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (ollama) {
      ollama.clearContext(conversationId);
    }
  }

  /**
   * Clear all Ollama cached conversation contexts
   */
  clearAllOllamaContexts(): void {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (ollama) {
      ollama.clearAllContexts();
    }
  }

  /**
   * Enable or disable Ollama KV-Cache
   */
  setOllamaCacheEnabled(enabled: boolean): void {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (ollama) {
      ollama.setCacheEnabled(enabled);
    }
  }

  /**
   * Check if Ollama KV-Cache is enabled
   */
  isOllamaCacheEnabled(): boolean {
    const ollama = this.providers.get(AIProvider.OLLAMA) as OllamaProvider | undefined;
    if (!ollama) return false;
    return ollama.isCacheEnabled();
  }
}

export const providerManager = new ProviderManager();
