
import { SYSTEM_INSTRUCTION_KERNEL } from "../constants";
import { providerManager } from "./providers";
import { AIProvider, IntentType } from "../types";
import { localIntentClassifier } from "./localIntent";
import { geminiRateLimiter } from "./rateLimiter";
import { RequestDeduplicator, createDedupKey } from "./deduplicator";

// Lazy load proxy client to avoid bundling in main chunk
const getGeminiProxyClient = async () => {
  const { generateViaProxy, streamViaProxy, isGeminiProxyAvailable } = await import('./geminiProxyClient');
  return { generateViaProxy, streamViaProxy, isGeminiProxyAvailable };
};

// LRU Cache for intent analysis results
const INTENT_CACHE_SIZE = 50;
const INTENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedIntent {
  result: ParsedIntent;
  timestamp: number;
}

class IntentCache {
  private cache: Map<string, CachedIntent> = new Map();
  private accessOrder: string[] = []; // Track access order for LRU
  
  private normalizeKey(input: string): string {
    return input.trim().toLowerCase();
  }
  
  get(input: string): ParsedIntent | null {
    const key = this.normalizeKey(input);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > INTENT_CACHE_TTL) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }
    
    // Update access order (move to end = most recently used)
    this.updateAccessOrder(key);
    
    return cached.result;
  }
  
  set(input: string, result: ParsedIntent): void {
    const key = this.normalizeKey(input);
    
    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, { result, timestamp: Date.now() });
      this.updateAccessOrder(key);
      return;
    }
    
    // Enforce LRU size limit
    if (this.cache.size >= INTENT_CACHE_SIZE) {
      // Delete oldest entry (first in accessOrder)
      const oldestKey = this.accessOrder[0];
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.shift();
      }
    }
    
    this.cache.set(key, { result, timestamp: Date.now() });
    this.accessOrder.push(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
}

const intentCache = new IntentCache();

// Deduplicator for intent analysis - prevents duplicate parallel API calls
const intentDedup = new RequestDeduplicator<ParsedIntent>({
  maxInFlightAgeMs: 30000, // 30s timeout
  debug: false
});

// Export stats from shared rate limiter
export const getGeminiStats = () => {
  const stats = geminiRateLimiter.getStats();
  return {
    used: stats.daily.used,
    remaining: stats.daily.remaining,
    limit: stats.daily.limit,
    perMinuteUsed: stats.perMinute.used,
    perMinuteRemaining: stats.perMinute.remaining,
    isRateLimited: stats.isRateLimited,
  };
};

// Export for testing/debugging
export const clearIntentCache = () => intentCache.clear();

/**
 * Check if Gemini is configured via proxy server
 */
export const hasApiKey = async (): Promise<boolean> => {
  // Check if proxy has the key configured
  const { isGeminiProxyAvailable } = await getGeminiProxyClient();
  return await isGeminiProxyAvailable();
};

/**
 * Generate content via proxy server (secure - no client-side API keys)
 */
async function generateViaProxyWrapper(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<{ text: string; candidates?: any[] }> {
  // Check if proxy is available
  const { generateViaProxy, isGeminiProxyAvailable } = await getGeminiProxyClient();
  const proxyAvailable = await isGeminiProxyAvailable();
  
  if (!proxyAvailable) {
    throw new Error(
      "Gemini proxy not available. Please ensure:\n" +
      "1. The proxy server is running (npm run proxy)\n" +
      "2. Your API key is configured in Settings > API & Security"
    );
  }
  
  const response = await generateViaProxy({
    model: params.model,
    contents: Array.isArray(params.contents) ? params.contents : [{ parts: [{ text: params.contents }] }],
    config: params.config
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Proxy request failed');
  }
  
  return { text: response.text || '', candidates: response.candidates };
}

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  complexity: number;
  suggestedProvider: string;
  entities: string[];
  reasoning: string;
}

export const analyzeIntent = async (input: string): Promise<ParsedIntent> => {
  // Check cache first (fast path)
  const cached = intentCache.get(input);
  if (cached) {
    console.log('[INTENT] Cache hit for:', input.substring(0, 30) + '...');
    return cached;
  }

  // Deduplicate in-flight requests with same input and mode
  const dedupKey = createDedupKey(['intent', input, providerManager.getMode() ?? 'auto']);
  return intentDedup.dedup(dedupKey, () => analyzeIntentInternal(input));
};

async function analyzeIntentInternal(input: string): Promise<ParsedIntent> {
  const currentMode = providerManager.getMode();
  const { isGeminiProxyAvailable } = await getGeminiProxyClient();
  const proxyAvailable = await isGeminiProxyAvailable();

  // === LOCAL INTENT CLASSIFICATION (FREE) ===
  // Try local classification first to reduce API calls
  const localResult = localIntentClassifier.classify(input);
  
  // If local classifier has high confidence, use it directly
  if (localResult.confidence >= 0.80) {
    console.log('[INTENT] Local classification (free):', localResult.type, '- confidence:', localResult.confidence.toFixed(2));
    intentCache.set(input, localResult);
    return localResult;
  }
  
  // If local suggests simple command/memory/query, still use local (no need for API)
  if ((localResult.type === 'COMMAND' || localResult.type === 'MEMORY_READ' || localResult.type === 'MEMORY_WRITE' || localResult.type === 'QUERY') 
      && localResult.confidence >= 0.70) {
    console.log('[INTENT] Local classification (free) - simple operation:', localResult.type);
    intentCache.set(input, localResult);
    return localResult;
  }
  
  console.log('[INTENT] Local confidence low (' + localResult.confidence.toFixed(2) + '), checking if Gemini needed...');

  // If forced to OLLAMA mode, use Ollama for intent analysis too
  if (currentMode === AIProvider.OLLAMA) {
    try {
      // Try to use Ollama for intent analysis by sending a structured request
      const response = await providerManager.route({
        prompt: `Analyze this input and respond in exactly this JSON format:
{
  "type": "QUERY" | "COMMAND" | "MEMORY_READ" | "MEMORY_WRITE" | "VISION_ANALYSIS",
  "confidence": number (0-1),
  "complexity": number (0-1),
  "suggestedProvider": "OLLAMA",
  "entities": [array of extracted keywords],
  "reasoning": "Short string explaining why"
}

Input: ${input}

Rules:
- If the user asks for factual info or creative writing -> QUERY
- If the user asks to change hardware state (lights, volume, launch app) -> COMMAND
- If the user references past conversations, stored information, or asks about remembered details (like location, preferences, facts) -> MEMORY_READ
- If the user asks to save something for later -> MEMORY_WRITE
- If the user asks to "look at", "see", "describe this", "what is this", "scan this" -> VISION_ANALYSIS
- Complexity should reflect the difficulty of the request.`,
        systemInstruction: "You are an intent classifier. Respond ONLY with the requested JSON format. No other text."
      }, AIProvider.OLLAMA);

      // Check if this is a simulated fallback response (Ollama not available)
      if (response.text.startsWith('[SIMULATED]')) {
        throw new Error('Ollama returned simulated response - server not available');
      }

      // Try to parse the JSON response
      const jsonString = response.text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(jsonString);

      // Validate the structure of the parsed object
      if (isValidParsedIntent(parsed)) {
        return parsed;
      } else {
        console.warn("Invalid intent structure received from Ollama:", parsed);
        throw new Error("Invalid response structure from AI provider");
      }
    } catch (error) {
      console.warn("Ollama intent analysis failed, falling back to heuristic:", error);
      // Fallback to heuristic if Ollama fails
      const lower = input.toLowerCase();
      if (lower.includes('save') || lower.includes('remind') || lower.includes('remember')) {
         return {
           type: IntentType.MEMORY_WRITE,
           confidence: 0.8,
           complexity: 0.2,
           suggestedProvider: 'OLLAMA',
           entities: input.split(' ').slice(1),
           reasoning: "Local heuristic detected memory keyword."
         };
      }
      if (lower.includes('what') && (lower.includes('did') || lower.includes('stored') || lower.includes('location') || lower.includes('where'))) {
         return {
          type: IntentType.MEMORY_READ,
           confidence: 0.8,
           complexity: 0.2,
           suggestedProvider: 'OLLAMA',
           entities: [],
           reasoning: "Local heuristic detected memory query."
         };
      }
      if (lower.includes('turn') || lower.includes('play') || lower.includes('stop') ||
          lower.includes('run') || lower.includes('activate') || lower.includes('initiate') ||
          lower.includes('enable') || lower.includes('reset') || lower.includes('optimize')) {
         return {
           type: IntentType.COMMAND,
           confidence: 0.9,
           complexity: 0.1,
           suggestedProvider: 'OLLAMA',
           entities: [],
           reasoning: "Local heuristic detected command verb."
         };
      }
      return {
        type: IntentType.QUERY,
        confidence: 0.5,
        complexity: 0.5,
        suggestedProvider: 'OLLAMA',
        entities: [],
        reasoning: "Defaulting to local query."
      };
    }
  }

  // If no API key available via proxy, also try Ollama for intent analysis
  if (!proxyAvailable) {
    try {
      // Try to use Ollama for intent analysis
      const response = await providerManager.route({
        prompt: `Analyze this input and respond in exactly this JSON format:
{
  "type": "QUERY" | "COMMAND" | "MEMORY_READ" | "MEMORY_WRITE" | "VISION_ANALYSIS",
  "confidence": number (0-1),
  "complexity": number (0-1),
  "suggestedProvider": "OLLAMA",
  "entities": [array of extracted keywords],
  "reasoning": "Short string explaining why"
}

Input: ${input}

Rules:
- If the user asks for factual info or creative writing -> QUERY
- If the user asks to change hardware state (lights, volume, launch app) -> COMMAND
- If the user references past conversations, stored information, or asks about remembered details (like location, preferences, facts) -> MEMORY_READ
- If the user asks to save something for later -> MEMORY_WRITE
- If the user asks to "look at", "see", "describe this", "what is this", "scan this" -> VISION_ANALYSIS
- Complexity should reflect the difficulty of the request.`,
        systemInstruction: "You are an intent classifier. Respond ONLY with the requested JSON format. No other text."
      }, AIProvider.OLLAMA);

      // Try to parse the JSON response
      const jsonString = response.text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(jsonString);

      // Validate the structure of the parsed object
      if (isValidParsedIntent(parsed)) {
        return parsed;
      }
    } catch {
      // Ollama not available, fall through to default
    }
    
    // Return a default QUERY intent if no AI is available
    return {
      type: IntentType.QUERY,
      confidence: 0.5,
      complexity: 0.5,
      suggestedProvider: 'OLLAMA',
      entities: [],
      reasoning: "No AI provider available - defaulting to query."
    };
  }

  // === GEMINI INTENT ANALYSIS (uses API credits) ===
  // Apply rate limiting
  const rateLimitResult = geminiRateLimiter.canMakeRequest();
  if (!rateLimitResult.allowed) {
    console.warn(`[INTENT] Rate limited: ${rateLimitResult.reason}, using local classification`);
    return localResult;
  }

  // Check if request is cacheable before making it
  const cached = intentCache.get(input);
  if (cached) {
    return cached;
  }

  try {
    console.log('[INTENT] Using Gemini API for intent analysis');
    const { generateViaProxy } = await getGeminiProxyClient();
    
    const response = await generateViaProxyWrapper({
      model: 'gemini-1.5-flash-8b',
      contents: `Analyze this input and respond in exactly this JSON format:
{
  "type": "QUERY" | "COMMAND" | "MEMORY_READ" | "MEMORY_WRITE" | "VISION_ANALYSIS",
  "confidence": number (0-1),
  "complexity": number (0-1),
  "suggestedProvider": "GEMINI" | "OLLAMA" | "ROUTED",
  "entities": [array of extracted keywords],
  "reasoning": "Short string explaining why"
}

Input: ${input}

Rules:
- If the user asks for factual info, coding, creative writing -> QUERY -> GEMINI
- If the user asks to change hardware state (lights, volume, launch app) -> COMMAND -> ROUTED
- If the user references past conversations, stored information, or asks about remembered details (like location, preferences, facts) -> MEMORY_READ -> GEMINI
- If the user asks to save something for later -> MEMORY_WRITE -> GEMINI
- If the user asks to "look at", "see", "describe this", "what is this", "scan this" -> VISION_ANALYSIS -> GEMINI
- Complexity > 0.7 or requires multi-step reasoning -> GEMINI
- Simple queries or casual conversation -> OLLAMA
- Complexity should reflect the difficulty of the request.`,
      config: {
        systemInstruction: "You are an intent classifier. Respond ONLY with the requested JSON format. No other text.",
        responseMimeType: "application/json",
      },
    });

    // Try to parse the JSON response
    const jsonString = response.text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(jsonString);

    // Validate the structure of the parsed object
    if (isValidParsedIntent(parsed)) {
      // Cache the result
      intentCache.set(input, parsed);
      return parsed;
    } else {
      console.warn("Invalid intent structure received from Gemini:", parsed);
      throw new Error("Invalid response structure from AI provider");
    }

  } catch (error) {
    console.error("Intent analysis error:", error);
    // Fallback to local result on error
    return localResult;
  }
}

// Type guard to validate ParsedIntent structure
function isValidParsedIntent(obj: any): obj is ParsedIntent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.type === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.complexity === 'number' &&
    typeof obj.suggestedProvider === 'string' &&
    Array.isArray(obj.entities) &&
    typeof obj.reasoning === 'string'
  );
}

// Keep the isValidParsedIntent function internal, but export if needed for testing
export { isValidParsedIntent };

interface GenerateParams {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export async function generateContent({
  prompt,
  systemInstruction = SYSTEM_INSTRUCTION_KERNEL,
  model = "gemini-1.5-flash",
  temperature = 0.7,
  maxTokens = 2048,
}: GenerateParams): Promise<string> {
  const response = await generateViaProxyWrapper({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  return response.text || "";
}

export async function* streamContent({
  prompt,
  systemInstruction = SYSTEM_INSTRUCTION_KERNEL,
  model = "gemini-1.5-flash",
  temperature = 0.7,
}: GenerateParams): AsyncGenerator<string, void, unknown> {
  // Check if proxy is available
  const { streamViaProxy, isGeminiProxyAvailable } = await getGeminiProxyClient();
  const proxyAvailable = await isGeminiProxyAvailable();
  
  if (!proxyAvailable) {
    throw new Error(
      "Gemini proxy not available. Please ensure:\n" +
      "1. The proxy server is running (npm run proxy)\n" +
      "2. Your API key is configured in Settings > API & Security"
    );
  }
  
  const stream = streamViaProxy({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature,
    },
  });

  for await (const chunk of stream) {
    // streamViaProxy yields strings directly
    yield chunk as string;
  }
}

/**
 * Generate a response using Gemini (used by kernelApi)
 * This is the main entry point for AI generation
 */
export async function generateResponse(
  prompt: string, 
  options?: { conversationId?: string; systemInstruction?: string }
): Promise<string> {
  return generateContent({
    prompt,
    systemInstruction: options?.systemInstruction || SYSTEM_INSTRUCTION_KERNEL,
    model: "gemini-1.5-flash",
    temperature: 0.7,
  });
}

// Simple health check - returns true if proxy has Gemini configured
export const isGeminiHealthy = async (): Promise<boolean> => {
  const { isGeminiProxyAvailable } = await getGeminiProxyClient();
  return await isGeminiProxyAvailable();
};
