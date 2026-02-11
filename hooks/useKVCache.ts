/**
 * KV-Cache Hook for React Components
 * 
 * Provides reactive access to KV-Cache statistics and management
 * for Ollama conversation contexts.
 */

import { useState, useEffect, useCallback } from 'react';
import { providerManager } from '../services/providers';

interface KVCacheStats {
  contextCount: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  totalTokens: number;
  avgLatencyImprovement: number;
}

interface ActiveContext {
  id: string;
  model: string;
  useCount: number;
  messageCount: number;
  estimatedTokens: number;
  ageMs: number;
}

interface UseKVCacheReturn {
  stats: KVCacheStats | null;
  activeContexts: ActiveContext[];
  isEnabled: boolean;
  isLoading: boolean;
  refresh: () => void;
  clearContext: (conversationId: string) => void;
  clearAll: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function useKVCache(pollIntervalMs: number = 5000): UseKVCacheReturn {
  const [stats, setStats] = useState<KVCacheStats | null>(null);
  const [activeContexts, setActiveContexts] = useState<ActiveContext[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const cacheStats = providerManager.getOllamaCacheStats();
      const contexts = providerManager.getOllamaActiveContexts();
      const enabled = providerManager.isOllamaCacheEnabled();

      if (cacheStats) {
        setStats(cacheStats);
      }
      if (contexts) {
        setActiveContexts(contexts);
      }
      setIsEnabled(enabled);
    } catch (error) {
      console.error('[useKVCache] Error refreshing stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearContext = useCallback((conversationId: string) => {
    providerManager.clearOllamaContext(conversationId);
    refresh();
  }, [refresh]);

  const clearAll = useCallback(() => {
    providerManager.clearAllOllamaContexts();
    refresh();
  }, [refresh]);

  const setEnabled = useCallback((enabled: boolean) => {
    providerManager.setOllamaCacheEnabled(enabled);
    refresh();
  }, [refresh]);

  // Initial load and polling
  useEffect(() => {
    refresh();
    
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return {
    stats,
    activeContexts,
    isEnabled,
    isLoading,
    refresh,
    clearContext,
    clearAll,
    setEnabled
  };
}

export default useKVCache;
