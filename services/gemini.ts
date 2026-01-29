
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION_KERNEL } from "../constants";
import { providerManager } from "./providers";
import { AIProvider } from "../types";

export const hasApiKey = (): boolean => {
  // Only check localStorage in the browser environment
  const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  return !!storedKey;
};

const createClient = () => {
  // Only use localStorage in the browser environment
  const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;

  if (!storedKey) {
    throw new Error("API Key missing");
  }
  return new GoogleGenAI({ apiKey: storedKey });
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
  const currentMode = providerManager.getMode();
  const hasValidApiKey = hasApiKey();

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

  // Use Gemini when available and not forced to Ollama
  try {
    const ai = createClient();
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

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as ParsedIntent;
  } catch (error: any) {
    console.error("Gemini Intent Parsing Error:", error);

    // Check if it's an invalid API key error
    if (error?.error?.message?.includes("API key not valid") || error?.error?.code === 400) {
      throw new Error("INVALID_API_KEY: Please check your Gemini API key in Settings > API & Security. Get a key at https://aistudio.google.com/app/apikey");
    }

    return {
      type: 'UNKNOWN',
      confidence: 0,
      complexity: 0,
      suggestedProvider: 'SYSTEM',
      entities: [],
      reasoning: "Analysis failed due to API error."
    };
  }
};

/**
 * Validates if the parsed object has the correct structure for ParsedIntent
 */
function isValidParsedIntent(obj: any): obj is ParsedIntent {
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
