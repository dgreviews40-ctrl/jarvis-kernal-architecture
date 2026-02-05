
import { AIProvider, IAIProvider, AIRequest, AIResponse, HealthEventType, ImpactLevel, AIConfig, OllamaConfig } from "../types";
import { GoogleGenAI } from "@google/genai";
import { cortex } from "./cortex";
import { geminiRateLimiter } from "./rateLimiter";
import { EnhancedCircuitBreaker } from "./CircuitBreaker";

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

// Helper function to create a timeout promise
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
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

  constructor() {
    this.circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      timeout: 30000 // 30 seconds
    });

    const apiKey = this.getApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  public getApiKey(): string | null {
    // Check environment variables first (VITE_ prefixed), then localStorage
    let apiKey = typeof process !== 'undefined' ? (process.env.VITE_GEMINI_API_KEY || process.env.API_KEY) : null;

    // If no environment variable, check localStorage
    if (!apiKey) {
      let storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;

      if (storedKey) {
        try {
          apiKey = atob(storedKey);
        } catch (decodeError) {
          console.error("Failed to decode API key:", decodeError);
          return null;
        }
      }
    }

    return apiKey || null;
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

    // === RATE LIMIT CHECK ===
    const check = geminiRateLimiter.canMakeRequest(request.images ? 2000 : 500);
    if (!check.allowed) {
      console.warn(`[GEMINI] Rate limit check failed: ${check.reason}. Retry after: ${check.retryAfter}s`);
      throw new Error(`RATE_LIMITED: ${check.reason}. Please retry in ${check.retryAfter}s or switch to Ollama mode.`);
    }

    if (!this.client) {
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
          const parts: any[] = [];

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
      if (!response || !response.text) {
        throw new Error('Gemini API returned invalid response');
      }

      return {
        text: response.text || "",
        provider: AIProvider.GEMINI,
        model: request.images ? 'gemini-2.5-flash-image' : config.model,
        latencyMs: latency
      };

    } catch (error: any) {
        const latency = Date.now() - start;

        // Track error for rate limiting
        geminiRateLimiter.trackError(error);

        cortex.reportEvent({
            sourceId: this.sourceId,
            type: HealthEventType.API_ERROR,
            impact: ImpactLevel.MEDIUM,
            latencyMs: latency,
            context: { errorMessage: error?.message || 'Unknown error' }
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

  constructor() {
    this.circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 60000, // 1 minute
      timeout: 20000 // 20 seconds
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

    const start = Date.now();
    const config = providerManager.getOllamaConfig();
    
    // Use request-specific model if provided, otherwise fall back to config
    const model = request.model || config.model;

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

        // Validate image data
        for (const img of request.images) {
          if (!img || typeof img !== 'string') {
            throw new Error('Invalid image data provided to Ollama');
          }
        }

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
                images: request.images, // Ollama accepts base64 images directly
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

        if (!result || !result.response) {
          throw new Error('Ollama returned empty response');
        }

        return {
          text: result.response,
          provider: AIProvider.OLLAMA,
          model: model,
          latencyMs: Date.now() - start
        };

      } catch (error: any) {
        console.error('[OLLAMA VISION] Error:', error);
        return {
          text: `[VISION ERROR] ${error?.message || 'Failed to analyze image'}.\n\nMake sure you have a vision model installed:\nollama pull llava`,
          provider: AIProvider.OLLAMA,
          model: model,
          latencyMs: Date.now() - start
        };
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

    try {
      // Use request timeout if provided, otherwise default
      const timeoutMs = request.timeout ?? REQUEST_TIMEOUT_MS;
      
      // Wrap the API call with circuit breaker (pass timeout to circuit breaker)
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
              prompt: finalPrompt,
              system: request.systemInstruction,
              stream: false,
              options: {
                temperature: request.temperature ?? config.temperature
              }
            }),
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
      // Add a small delay before returning fallback
      await new Promise(r => setTimeout(r, 800));
      return {
        text: `[SIMULATED] Local kernel fallback active. You requested: "${request.prompt}". (Error: ${e instanceof Error ? e.message : 'Unknown'})`,
        provider: AIProvider.OLLAMA,
        model: 'simulated-7b-quantized',
        latencyMs: Date.now() - start
      };
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
        return data.models.map((model: any) => model.name || model.model);
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
       return await provider.generate(request);
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
}

export const providerManager = new ProviderManager();
