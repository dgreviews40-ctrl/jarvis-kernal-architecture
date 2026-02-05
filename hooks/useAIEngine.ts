/**
 * useAIEngine Hook - JARVIS AI Engine v1.1 Integration
 * 
 * Provides easy access to new v1.1 features:
 * - Streaming responses
 * - Tool calling
 * - Conversation persistence
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { AIProvider } from '../types';
import { enhancedKernelProcessor } from '../services/enhancedKernelProcessor';
import { streamingHandler } from '../services/streaming';
import { conversationPersistence } from '../services/conversationPersistence';
import { toolRegistry } from '../services/tools';
import { useKernelStore } from '../stores';

interface UseAIEngineOptions {
  streaming?: boolean;
  useTools?: boolean;
  origin?: 'USER_TEXT' | 'USER_VOICE';
}

interface UseAIEngineReturn {
  // Processing
  processMessage: (input: string) => Promise<string>;
  isProcessing: boolean;
  streamingText: string | null;
  
  // Streaming control
  abortStreaming: () => void;
  isStreaming: boolean;
  
  // Tools
  availableTools: string[];
  
  // Conversations
  currentConversationId: string | null;
  startNewConversation: () => string;
  switchConversation: (id: string) => boolean;
  
  // Settings
  streamingEnabled: boolean;
  setStreamingEnabled: (enabled: boolean) => void;
  toolsEnabled: boolean;
  setToolsEnabled: (enabled: boolean) => void;
}

export function useAIEngine(options: UseAIEngineOptions = {}): UseAIEngineReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const streamingText = useKernelStore((state) => state.streamingText);
  const isStreaming = useKernelStore((state) => state.isStreaming);
  const forcedMode = useKernelStore((state) => state.forcedMode);
  
  const setState = useCallback((state: any) => {
    useKernelStore.getState().setProcessorState(state);
  }, []);
  
  const setActiveModule = useCallback((module: string | null) => {
    useKernelStore.getState().setActiveModule(module);
  }, []);
  
  const setProvider = useCallback((provider: AIProvider | null) => {
    useKernelStore.getState().setProvider(provider);
  }, []);

  const processMessage = useCallback(async (input: string): Promise<string> => {
    if (isProcessing) return '';
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    setIsProcessing(true);
    useKernelStore.getState().setIsStreaming(options.streaming !== false && streamingEnabled);
    
    try {
      const response = await enhancedKernelProcessor.processRequest(
        input,
        {
          forcedMode,
          setState,
          setActiveModule,
          setProvider,
          origin: options.origin || 'USER_TEXT',
          recentVoiceCommands: [],
          isProcessing: { current: false },
          processingRequests: new Set(),
          lastRequestTime: { current: 0 },
          lastRequestText: { current: '' },
          streamingEnabled,
          toolsEnabled
        },
        {
          streaming: options.streaming !== false && streamingEnabled,
          useTools: options.useTools !== false && toolsEnabled
        }
      );
      
      return response;
    } finally {
      setIsProcessing(false);
      useKernelStore.getState().setIsStreaming(false);
    }
  }, [isProcessing, forcedMode, streamingEnabled, toolsEnabled, options.origin, options.streaming, options.useTools]);

  const abortStreaming = useCallback(() => {
    streamingHandler.abort();
    abortControllerRef.current?.abort();
    useKernelStore.getState().setIsStreaming(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortStreaming();
    };
  }, [abortStreaming]);

  const startNewConversation = useCallback(() => {
    return conversationPersistence.startNewConversation();
  }, []);

  const switchConversation = useCallback((id: string) => {
    return conversationPersistence.switchConversation(id);
  }, []);

  return {
    // Processing
    processMessage,
    isProcessing,
    streamingText,
    
    // Streaming
    abortStreaming,
    isStreaming,
    
    // Tools
    availableTools: toolRegistry.getAll().map(t => t.name),
    
    // Conversations
    currentConversationId: conversationPersistence.getCurrentId(),
    startNewConversation,
    switchConversation,
    
    // Settings
    streamingEnabled,
    setStreamingEnabled,
    toolsEnabled,
    setToolsEnabled
  };
}

export default useAIEngine;
