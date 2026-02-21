/**
 * Gemini Proxy Client
 * 
 * This service routes Gemini API calls through the local proxy server
 * instead of calling Google directly. This keeps the API key secure
 * on the server side.
 */

import { logger } from './logger';

const PROXY_URL = 'http://localhost:3101';

interface GeminiRequest {
  model: string;
  contents: any[];
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    [key: string]: any;
  };
}

interface GeminiResponse {
  success: boolean;
  text?: string;
  candidates?: any[];
  error?: string;
}

/**
 * Check if the Gemini proxy is available
 */
export async function isGeminiProxyAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PROXY_URL}/gemini/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const status = await response.json();
      return status.configured;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Generate content through the proxy
 */
export async function generateViaProxy(
  request: GeminiRequest
): Promise<GeminiResponse> {
  try {
    const response = await fetch(`${PROXY_URL}/gemini/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      logger.log('SYSTEM', `Request failed: ${data.error}`, 'error');
      return {
        success: false,
        error: data.message || data.error || 'Unknown error'
      };
    }
    
    return data as GeminiResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    logger.log('SYSTEM', `Request failed: ${message}`, 'error');
    return {
      success: false,
      error: message
    };
  }
}

/**
 * Stream content through the proxy
 */
export async function* streamViaProxy(
  request: GeminiRequest
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await fetch(`${PROXY_URL}/gemini/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Stream request failed');
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE format
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              yield data.text;
            }
            if (data.done) {
              return;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    logger.log('SYSTEM', `Stream error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
    throw error;
  }
}

/**
 * Get the appropriate Gemini client based on configuration
 * Returns either the proxy-based client or direct client info
 */
export async function getGeminiClientInfo(): Promise<{
  useProxy: boolean;
  proxyAvailable: boolean;
  hasApiKey: boolean;
}> {
  const proxyAvailable = await isGeminiProxyAvailable();
  const hasApiKey = !!(import.meta.env?.VITE_GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY);
  
  // Prefer proxy if available
  const useProxy = proxyAvailable;
  
  return {
    useProxy,
    proxyAvailable,
    hasApiKey
  };
}

