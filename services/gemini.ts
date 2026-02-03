
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION_KERNEL } from "../constants";
import { providerManager } from "./providers";
import { AIProvider } from "../types";
import { localIntentClassifier } from "./localIntent";
import { geminiRateLimiter } from "./rateLimiter";

// LRU Cache for intent analysis results
const INTENT_CACHE_SIZE = 50;
const INTENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedIntent {
  result: ParsedIntent;
  timestamp: number;
}

class IntentCache {
  private cache: Map<string, CachedIntent> = new Map();
  
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
      return null;
    }
    
    return cached.result;
  }
  
  set(input: string, result: ParsedIntent): void {
    const key = this.normalizeKey(input);
    
    // Enforce LRU size limit
    if (this.cache.size >= INTENT_CACHE_SIZE) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { result, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const intentCache = new IntentCache();

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
export const hasApiKey = (): boolean => {
  // Check environment variables first (VITE_ prefixed), then localStorage
  const envKey = typeof process !== 'undefined' ? (process.env.VITE_GEMINI_API_KEY || process.env.API_KEY) : null;
  // Only check localStorage in the browser environment
  const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  return !!(envKey || storedKey);
};

const createClient = async () => {
  // Priority: encrypted storage > legacy storage > env vars
  // This ensures security while maintaining backward compatibility
  let apiKey: string | null = null;

  // Check encrypted storage first
  if (typeof localStorage !== 'undefined') {
    const encryptedStoredKey = localStorage.getItem('jarvis_gemini_api_key_encrypted');
    if (encryptedStoredKey) {
      try {
        apiKey = decodeURIComponent(atob(encryptedStoredKey));
        console.log('[GEMINI] Using API key from encrypted localStorage');
      } catch (e) {
        console.warn("Failed to decode encrypted API key, trying legacy format:", e);
        // Try legacy format as fallback
        const legacyStoredKey = localStorage.getItem('GEMINI_API_KEY');
        if (legacyStoredKey) {
          try {
            apiKey = atob(legacyStoredKey);
            console.log('[GEMINI] Using API key from legacy localStorage');
          } catch (legacyError) {
            console.error("Failed to decode legacy API key:", legacyError);
          }
        }
      }
    }
  }

  // Fallback to environment variables
  if (!apiKey && typeof process !== 'undefined') {
    apiKey = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || null;
    if (apiKey) {
      console.log('[GEMINI] Using API key from environment');
    }
  }

  if (!apiKey) {
    throw new Error("API Key missing. Please set your Gemini API key in Settings > API & Security.");
  }

  // Trim whitespace and validate key format
  apiKey = apiKey.trim();

  if (apiKey.length < 10) {
    throw new Error("API Key appears to be invalid (too short)");
  }

  // Validate key format (Google API keys typically start with "AI" followed by letters and numbers)
  if (!/^AIza[a-zA-Z0-9_-]{30,}$/.test(apiKey)) {
    console.warn("API key format appears unusual - verify it's correct");
  }

  // Log key prefix for debugging (don't log full key)
  console.log(`[GEMINI] API key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)`);

  return new GoogleGenAI({ apiKey });
};

export interface ParsedIntent {
  type: string;
  confidence: number;
  complexity: number;
  suggestedProvider: string;
  entities: string[];
  reasoning: string;
}

export const analyzeIntent = async (input: string): Promise<ParsedIntent> => {
  // Check cache first
  const cached = intentCache.get(input);
  if (cached) {
    console.log('[INTENT] Cache hit for:', input.substring(0, 30) + '...');
    return cached;
  }

  const currentMode = providerManager.getMode();
  const hasValidApiKey = hasApiKey();
  
  // === LOCAL INTENT CLASSIFICATION (FREE) ===
  // Try local classification first to reduce API calls
  const localResult = localIntentClassifier.classify(input);
  
  // If local classifier has high confidence, use it directly
  if (localResult.confidence >= 0.85) {
    console.log('[INTENT] Local classification (free):', localResult.type, '- confidence:', localResult.confidence.toFixed(2));
    intentCache.set(input, localResult);
    return localResult;
  }
  
  // If local suggests simple command/memory, still use local (no need for API)
  if ((localResult.type === 'COMMAND' || localResult.type === 'MEMORY_READ' || localResult.type === 'MEMORY_WRITE') 
      && localResult.confidence >= 0.75) {
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
           type: 'MEMORY_WRITE',
           confidence: 0.8,
           complexity: 0.2,
           suggestedProvider: 'OLLAMA',
           entities: input.split(' ').slice(1),
           reasoning: "Local heuristic detected memory keyword."
         };
      }
      if (lower.includes('what') && (lower.includes('did') || lower.includes('stored') || lower.includes('location') || lower.includes('where'))) {
         return {
          type: 'MEMORY_READ',
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
           type: 'COMMAND',
           confidence: 0.9,
           complexity: 0.1,
           suggestedProvider: 'OLLAMA',
           entities: [],
           reasoning: "Local heuristic detected command verb."
         };
      }
      return {
        type: 'QUERY',
        confidence: 0.5,
        complexity: 0.5,
        suggestedProvider: 'OLLAMA',
        entities: [],
        reasoning: "Defaulting to local query."
      };
    }
  }

  // If no API key, also try Ollama for intent analysis
  if (!hasValidApiKey) {
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
           type: 'MEMORY_WRITE',
           confidence: 0.8,
           complexity: 0.2,
           suggestedProvider: 'OLLAMA',
           entities: input.split(' ').slice(1),
           reasoning: "Local heuristic detected memory keyword."
         };
      }
      if (lower.includes('what') && (lower.includes('did') || lower.includes('stored') || lower.includes('location') || lower.includes('where'))) {
         return {
          type: 'MEMORY_READ',
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
           type: 'COMMAND',
           confidence: 0.9,
           complexity: 0.1,
           suggestedProvider: 'OLLAMA',
           entities: [],
           reasoning: "Local heuristic detected command verb."
         };
      }
      return {
        type: 'QUERY',
        confidence: 0.5,
        complexity: 0.5,
        suggestedProvider: 'OLLAMA',
        entities: [],
        reasoning: "Defaulting to local query."
      };
    }
  }

  // === CHECK RATE LIMITS BEFORE USING GEMINI ===
  const rateLimitCheck = geminiRateLimiter.canMakeRequest(500);
  if (!rateLimitCheck.allowed) {
    console.log(`[INTENT] Gemini rate limited: ${rateLimitCheck.reason}. Using local classification.`);
    // Enhance local result with a note about rate limiting
    const enhancedLocal = {
      ...localResult,
      reasoning: `${localResult.reasoning} (Gemini rate limited: ${rateLimitCheck.reason})`
    };
    intentCache.set(input, enhancedLocal);
    return enhancedLocal;
  }

  // Use Gemini when available and not forced to Ollama
  try {
    const ai = await createClient(); // Updated to await the async function
    const config = providerManager.getAIConfig();

    const response = await ai.models.generateContent({
      model: config.model,
      contents: input,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_KERNEL,
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    // Track this API call
    geminiRateLimiter.trackRequest(500);

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanText) as ParsedIntent;

    // Cache successful result
    intentCache.set(input, result);
    return result;
  } catch (error: unknown) {
    console.error("Gemini Intent Parsing Error:", error);

    // Check if it's an invalid API key error - log but still fallback
    const errorMessage = error?.error?.message || error?.message || '';
    if (errorMessage.includes("API key not valid") || (error as any)?.error?.code === 400) {
      console.warn("[INTENT] Invalid API key, falling back to local heuristics");
    }

    // Graceful degradation: Use local heuristics when API fails
    console.warn("[INTENT] Gemini failed, falling back to local heuristics");
    const result = analyzeIntentWithHeuristics(input);

    // Cache the heuristic result too (but with lower confidence)
    intentCache.set(input, result);
    return result;
  }
};

/**
 * Local heuristic-based intent analysis (no API required)
 * Used as fallback when Gemini is unavailable
 * Now delegates to the more sophisticated LocalIntentClassifier
 */
function analyzeIntentWithHeuristics(input: string): ParsedIntent {
  // Use the new local classifier for consistent results
  const result = localIntentClassifier.classify(input);
  
  // Add note that this was a fallback
  return {
    ...result,
    reasoning: `${result.reasoning} (fallback from Gemini failure)`
  };
}

/**
 * Validates if the parsed object has the correct structure for ParsedIntent
 */
function isValidParsedIntent(obj: unknown): obj is ParsedIntent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.type === 'string' &&
    ['QUERY', 'COMMAND', 'MEMORY_READ', 'MEMORY_WRITE', 'VISION_ANALYSIS', 'UNKNOWN'].includes(obj.type) &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 && obj.confidence <= 1 &&
    typeof obj.complexity === 'number' &&
    obj.complexity >= 0 && obj.complexity <= 1 &&
    typeof obj.suggestedProvider === 'string' &&
    Array.isArray(obj.entities) &&
    typeof obj.reasoning === 'string'
  );
}
