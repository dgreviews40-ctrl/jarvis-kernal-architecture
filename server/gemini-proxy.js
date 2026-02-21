/**
 * JARVIS Gemini API Proxy
 * Server-side proxy for Gemini API calls to keep API keys secure
 * 
 * This module proxies requests to Google's Gemini API, adding the API key
 * server-side so it never gets exposed to the client.
 */

import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root directory
const projectRoot = resolve(__dirname, '..');

// Cache for the Gemini client
let geminiClient = null;
let lastApiKey = null;
let lastConfigCheck = 0;
const CONFIG_CHECK_INTERVAL = 5000; // Check for config changes every 5 seconds

/**
 * Read API key directly from .env files (bypasses cached process.env)
 */
function readApiKeyFromEnv() {
  const envPaths = [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env')
  ];
  
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        
        // Look for GEMINI_API_KEY or VITE_GEMINI_API_KEY
        for (const line of lines) {
          const match = line.match(/^\s*(GEMINI_API_KEY|VITE_GEMINI_API_KEY)\s*=\s*(.+)$/);
          if (match) {
            const key = match[2].trim();
            // Remove quotes if present
            return key.replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (e) {
      console.error(`[GEMINI PROXY] Error reading ${envPath}:`, e.message);
    }
  }
  
  // Fallback to process.env (for keys set via actual environment variables)
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || null;
}

/**
 * Get or create the Gemini client
 */
function getGeminiClient() {
  const now = Date.now();
  
  // Check if we need to refresh (new API key might have been saved)
  if (!geminiClient || (now - lastConfigCheck > CONFIG_CHECK_INTERVAL)) {
    const apiKey = readApiKeyFromEnv();
    
    if (!apiKey) {
      console.error('[GEMINI PROXY] No API key configured');
      return null;
    }
    
    // Only recreate client if API key changed
    if (apiKey !== lastApiKey) {
      console.log('[GEMINI PROXY] API key changed, reinitializing client');
      geminiClient = new GoogleGenAI({ apiKey });
      lastApiKey = apiKey;
    }
    
    lastConfigCheck = now;
  }
  
  return geminiClient;
}

/**
 * Handle Gemini API requests
 */
export async function handleGeminiRequest(req, res) {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const client = getGeminiClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Gemini not configured',
      message: 'API key not configured. Please set VITE_GEMINI_API_KEY in .env.local'
    });
  }
  
  try {
    const { model, contents, config } = req.body;
    
    if (!model || !contents) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Model and contents are required'
      });
    }
    
    console.log(`[GEMINI PROXY] Request to model: ${model}`);
    
    // Make the request to Gemini
    const response = await client.models.generateContent({
      model,
      contents,
      config
    });
    
    // Return the response
    res.json({
      success: true,
      text: response.text,
      candidates: response.candidates
    });
    
  } catch (error) {
    console.error('[GEMINI PROXY] Error:', error);
    
    // Handle specific error types
    if (error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'API quota exceeded. Please try again later.'
      });
    }
    
    if (error.message?.includes('API key not valid')) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The configured API key is invalid'
      });
    }
    
    res.status(500).json({
      error: 'Gemini API error',
      message: error.message || 'Unknown error'
    });
  }
}

/**
 * Handle streaming Gemini API requests
 */
export async function handleGeminiStreamRequest(req, res) {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Content-Type', 'text/event-stream');
  res.header('Cache-Control', 'no-cache');
  res.header('Connection', 'keep-alive');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const client = getGeminiClient();
  if (!client) {
    return res.status(500).json({ 
      error: 'Gemini not configured',
      message: 'API key not configured'
    });
  }
  
  try {
    const { model, contents, config } = req.body;
    
    if (!model || !contents) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Model and contents are required'
      });
    }
    
    console.log(`[GEMINI PROXY] Streaming request to model: ${model}`);
    
    // Make the streaming request to Gemini
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config
    });
    
    // Stream the response
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
      }
    }
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('[GEMINI PROXY] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
    res.end();
  }
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured() {
  const apiKey = readApiKeyFromEnv();
  return !!apiKey;
}

/**
 * Get Gemini status for health check
 */
export function getGeminiStatus() {
  return {
    configured: isGeminiConfigured(),
    hasClient: !!geminiClient
  };
}
