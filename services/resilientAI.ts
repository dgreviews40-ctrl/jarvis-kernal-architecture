/**
 * Resilient AI Service - JARVIS Kernel v1.5
 * 
 * Wraps AI operations with offline queue support.
 * Automatically queues requests when network is unavailable
 * and provides seamless retry when connection is restored.
 * 
 * Features:
 * - Transparent queueing for all AI operations
 * - User notification on queue status
 * - Configurable retry behavior
 * - Fallback responses when appropriate
 */

import { AIProvider, AIRequest, AIResponse, ResilientAIOptions } from '../types';
import { offlineQueue, queueOperation } from './offlineQueue';
import { eventBus } from './eventBus';
import { logger } from './logger';

const DEFAULT_OPTIONS: ResilientAIOptions = {
  queueWhenOffline: true,
  priority: 'HIGH',
  notifyUser: true
};

/**
 * Generate AI response with offline resilience
 * 
 * Usage:
 * ```typescript
 * const response = await resilientGenerate('What is the weather?', {
 *   context: { userInput: 'What is the weather?' }
 * });
 * ```
 */
export async function resilientGenerate(
  prompt: string,
  options?: { conversationId?: string } & ResilientAIOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check if we're online
  const isOnline = offlineQueue.isNetworkOnline();
  
  if (!isOnline && opts.queueWhenOffline) {
    // Queue the request
    const operationId = await queueOperation(
      'AI_REQUEST',
      {
        prompt,
        options: { conversationId: options?.conversationId }
      },
      {
        priority: opts.priority,
        context: {
          conversationId: options?.conversationId,
          userInput: prompt
        }
      }
    );
    
    if (opts.notifyUser) {
      notifyQueued('Your request has been queued and will be processed when you\'re back online.');
    }
    
    logger.log('RESILIENCE', `AI request queued (${operationId}) - offline`, 'warning');
    
    // Return a special response indicating queuing
    return `I'm currently offline. Your request "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}" has been queued and will be processed when the connection is restored.`;
  }
  
  // Online - execute directly with error handling
  try {
    const { generateResponse } = await import('./gemini');
    return await generateResponse(prompt, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if this is a network error
    if (isNetworkError(error) && opts.queueWhenOffline) {
      const operationId = await queueOperation(
        'AI_REQUEST',
        {
          prompt,
          options: { conversationId: options?.conversationId }
        },
        {
          priority: opts.priority,
          context: {
            conversationId: options?.conversationId,
            userInput: prompt
          }
        }
      );
      
      if (opts.notifyUser) {
        notifyQueued('Network error. Your request has been queued for retry.');
      }
      
      logger.log('RESILIENCE', `AI request queued (${operationId}) - network error`, 'warning');
      
      return `Network error. Your request has been saved and will retry automatically.`;
    }
    
    // Non-network error - rethrow
    throw error;
  }
}

/**
 * Analyze intent with offline resilience
 */
export async function resilientAnalyzeIntent(
  input: string,
  options?: ResilientAIOptions
): Promise<import('./gemini').ParsedIntent> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const isOnline = offlineQueue.isNetworkOnline();
  
  if (!isOnline && opts.queueWhenOffline) {
    const operationId = await queueOperation(
      'INTENT_CLASSIFICATION',
      { input },
      {
        priority: opts.priority,
        context: { userInput: input }
      }
    );
    
    logger.log('RESILIENCE', `Intent analysis queued (${operationId}) - offline`, 'warning');
    
    // Return a generic intent for offline mode
    return {
      type: 'UNKNOWN',
      confidence: 0.5,
      complexity: 1,
      suggestedProvider: 'GEMINI',
      entities: [],
      reasoning: 'Offline mode - unable to classify intent',
      queued: true,
      operationId
    } as import('./gemini').ParsedIntent & { queued: boolean; operationId: string };
  }
  
  try {
    const { analyzeIntent } = await import('./gemini');
    return await analyzeIntent(input);
  } catch (error) {
    if (isNetworkError(error) && opts.queueWhenOffline) {
      const operationId = await queueOperation(
        'INTENT_CLASSIFICATION',
        { input },
        {
          priority: opts.priority,
          context: { userInput: input }
        }
      );
      
      logger.log('RESILIENCE', `Intent analysis queued (${operationId}) - network error`, 'warning');
      
      return {
        type: 'UNKNOWN',
        confidence: 0.5,
        complexity: 1,
        suggestedProvider: 'GEMINI',
        entities: [],
        reasoning: 'Network error - intent classification queued',
        queued: true,
        operationId
      } as import('./gemini').ParsedIntent & { queued: boolean; operationId: string };
    }
    
    throw error;
  }
}

/**
 * Stream response with offline resilience
 * 
 * Note: Streaming cannot be truly queued as it's real-time.
 * This provides a fallback to non-streaming queued request.
 */
export async function resilientStream(
  request: AIRequest,
  preference: AIProvider = AIProvider.GEMINI,
  options?: import('./streaming').StreamingOptions & ResilientAIOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isOnline = offlineQueue.isNetworkOnline();
  
  // Helper to call onComplete callback safely
  const notifyComplete = (message: string) => {
    try {
      options?.onComplete?.(message);
    } catch {
      // Callback errors should not break the flow
    }
  };
  
  if (!isOnline && opts.queueWhenOffline) {
    const operationId = await queueOperation(
      'STREAMING_REQUEST',
      { 
        request, 
        provider: preference, 
        options: {
          enableTTS: options?.enableTTS,
          ttsDelayMs: options?.ttsDelayMs
        }
      },
      {
        priority: opts.priority,
        context: {
          userInput: request.prompt
        }
      }
    );
    
    if (opts.notifyUser) {
      notifyQueued('Your request has been queued for when you\'re back online.');
    }
    
    logger.log('RESILIENCE', `Streaming request queued (${operationId}) - offline`, 'warning');
    
    // Return queued message and notify via callback
    const queuedMessage = 'Currently offline. Your request has been queued and will be processed when the connection is restored.';
    notifyComplete(queuedMessage);
    return queuedMessage;
  }
  
  try {
    const { streamingHandler } = await import('./streaming');
    return await streamingHandler.stream(request, preference, options);
  } catch (error) {
    if (isNetworkError(error) && opts.queueWhenOffline) {
      const operationId = await queueOperation(
        'STREAMING_REQUEST',
        { 
          request, 
          provider: preference, 
          options: {
            enableTTS: options?.enableTTS,
            ttsDelayMs: options?.ttsDelayMs
          }
        },
        {
          priority: opts.priority,
          context: {
            userInput: request.prompt
          }
        }
      );
      
      if (opts.notifyUser) {
        notifyQueued('Network error. Your request has been queued for retry.');
      }
      
      logger.log('RESILIENCE', `Streaming request queued (${operationId}) - network error`, 'warning');
      
      const queuedMessage = 'Network error. Your request has been saved and will retry automatically.';
      notifyComplete(queuedMessage);
      return queuedMessage;
    }
    
    throw error;
  }
}

/**
 * Check if an error is network-related
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const networkErrorPatterns = [
    'network',
    'fetch',
    'timeout',
    'abort',
    'offline',
    'failed to fetch',
    'networkerror',
    'net::',
    'err_internet_disconnected',
    'err_network_changed'
  ];
  
  const message = error.message.toLowerCase();
  return networkErrorPatterns.some(pattern => message.includes(pattern));
}

/**
 * Notify user that request was queued
 */
function notifyQueued(message: string): void {
  eventBus.publish('system.health', {
    type: 'QUEUE_QUEUED',
    message,
    timestamp: Date.now()
  });
}

/**
 * Get current network and queue status
 */
export async function getResilienceStatus(): Promise<{
  isOnline: boolean;
  queueStats: import('../types').QueueStats;
  pendingUserRequests: number;
}> {
  const [queueStats] = await Promise.all([
    offlineQueue.getStats()
  ]);
  
  return {
    isOnline: offlineQueue.isNetworkOnline(),
    queueStats,
    pendingUserRequests: queueStats.pending + queueStats.processing
  };
}

/**
 * Cancel a queued operation
 */
export async function cancelQueuedRequest(operationId: string): Promise<boolean> {
  return offlineQueue.cancel(operationId);
}

/**
 * Retry a failed operation immediately
 */
export async function retryFailedRequest(operationId: string): Promise<boolean> {
  return offlineQueue.retryNow(operationId);
}

/**
 * Initialize the resilient AI service
 */
export async function initializeResilientAI(): Promise<void> {
  await offlineQueue.initialize();
  logger.log('RESILIENCE', 'Resilient AI service initialized', 'success');
}

/**
 * Listen for queue status changes
 */
export function onQueueStatusChange(
  callback: (stats: import('../types').QueueStats) => void
): () => void {
  const unsubscribe = eventBus.subscribe('system.health', (event) => {
    const payload = event.payload as { type?: string; stats?: import('../types').QueueStats } | undefined;
    if (payload?.type === 'QUEUE_STATUS_CHANGED' && payload.stats) {
      callback(payload.stats);
    }
  });
  
  return unsubscribe;
}

/**
 * Listen for completed queued operations
 */
export function onQueuedOperationCompleted(
  callback: (data: { operationId: string; type: string; userInput?: string }) => void
): () => void {
  const unsubscribe = eventBus.subscribe('system.health', (event) => {
    const payload = event.payload as { type?: string; operationId?: string; operationType?: string; userInput?: string } | undefined;
    if (payload?.type === 'QUEUE_SUCCESS' && payload.operationId) {
      callback({
        operationId: payload.operationId,
        type: payload.operationType || 'UNKNOWN',
        userInput: payload.userInput
      });
    }
  });
  
  return unsubscribe;
}
