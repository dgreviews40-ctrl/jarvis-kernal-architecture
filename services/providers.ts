
import { AIProvider, IAIProvider, AIRequest, AIResponse, HealthEventType, ImpactLevel, AIConfig, OllamaConfig } from "../types";
import { GoogleGenAI } from "@google/genai";
import { cortex } from "./cortex";

const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gemini-2.0-flash',
  temperature: 0.7
};

const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  url: "http://localhost:11434",
  model: "llama3",
  temperature: 0.7
};

// --- GEMINI PROVIDER ---
export class GeminiProvider implements IAIProvider {
  public id = AIProvider.GEMINI;
  public name = "Google Gemini Cloud";
  private client: GoogleGenAI | null = null;
  private sourceId = 'provider.gemini';

  constructor() {
    const apiKey = this.getApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  private getApiKey(): string | null {
    // Only check localStorage in the browser environment
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
    return storedKey || null;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getApiKey() && navigator.onLine;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("CRITICAL: Gemini API Key not detected. Please add it in Settings > API & Security.");
    }
    
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    
    const start = Date.now();
    let response;
    const config = providerManager.getAIConfig();

    try {
        if (request.images && request.images.length > 0) {
          const parts: any[] = [];
          
          request.images.forEach(imgBase64 => {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imgBase64
              }
            });
          });

          parts.push({ text: request.prompt });

          response = await this.client.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: { parts },
            config: {
              systemInstruction: request.systemInstruction,
              temperature: request.temperature ?? config.temperature,
            }
          });
        } else {
          response = await this.client.models.generateContent({
            model: config.model,
            contents: request.prompt,
            config: {
              systemInstruction: request.systemInstruction,
              temperature: request.temperature ?? config.temperature,
            }
          });
        }
        
        const latency = Date.now() - start;
        
        cortex.reportEvent({
            sourceId: this.sourceId,
            type: HealthEventType.SUCCESS,
            impact: ImpactLevel.NONE,
            latencyMs: latency,
            context: { endpoint: 'generateContent' }
        });

        return {
          text: response.text || "",
          provider: AIProvider.GEMINI,
          model: request.images ? 'gemini-2.5-flash-image' : config.model,
          latencyMs: latency
        };

    } catch (error: any) {
        cortex.reportEvent({
            sourceId: this.sourceId,
            type: HealthEventType.API_ERROR,
            impact: ImpactLevel.MEDIUM,
            latencyMs: Date.now() - start,
            context: { errorMessage: error.message }
        });
        throw error;
    }
  }
}

// --- OLLAMA PROVIDER (Local / Simulated) ---
export class OllamaProvider implements IAIProvider {
  public id = AIProvider.OLLAMA;
  public name = "Ollama Local Interface";

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
    const start = Date.now();
    const config = providerManager.getOllamaConfig();

    // Simulate Vision processing if images are present (Ollama vision varies by model support)
    if (request.images && request.images.length > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return {
        text: "[SIMULATION] Optical ingestion confirmed. Analysis protocols are restricted in local sandbox mode, but I acknowledge the visual stream.",
        provider: AIProvider.OLLAMA,
        model: `${config.model}-sim`,
        latencyMs: Date.now() - start
      };
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for generation

      const res = await fetch(`${config.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: finalPrompt,
          system: request.systemInstruction,
          stream: false,
          options: {
            temperature: config.temperature
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          text: data.response,
          provider: AIProvider.OLLAMA,
          model: config.model,
          latencyMs: Date.now() - start
        };
      }
      throw new Error("Ollama returned non-OK status");

    } catch (e) {
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
   */
  private checkInternetRequirement(prompt: string): boolean {
    const internetKeywords = [
      'current', 'today', 'now', 'latest', 'recent', 'news', 'weather', 'temperature',
      'time', 'date', 'live', 'real-time', 'update', 'stock', 'price', 'currency',
      'sports score', 'movie release', 'event', 'fact', 'statistic', 'population',
      'distance', 'definition', 'meaning', 'who is', 'what is', 'when is', 'where is'
    ];

    const lowerPrompt = prompt.toLowerCase();
    return internetKeywords.some(keyword => lowerPrompt.includes(keyword));
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
      try { this.aiConfig = JSON.parse(aiSaved); } catch (e) {}
    }
    const ollamaSaved = localStorage.getItem('jarvis_ollama_config');
    if (ollamaSaved) {
      try { this.ollamaConfig = JSON.parse(ollamaSaved); } catch (e) {}
    }
  }

  register(provider: IAIProvider) {
    this.providers.set(provider.id, provider);
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
    if (provider && await provider.isAvailable()) {
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
