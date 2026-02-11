/**
 * JARVIS Plugin SDK - React Integration
 * 
 * React hooks for building UI plugins
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import type { 
  PluginContext, 
  MemoryAPI, 
  NetworkAPI, 
  SystemAPI, 
  VoiceAPI, 
  EventsAPI,
  Config,
  MemoryResult 
} from './index.js';

// Context for plugin context
const PluginContextCtx = createContext<PluginContext | null>(null);

export const PluginProvider = PluginContextCtx.Provider;

export function usePluginContext(): PluginContext {
  const ctx = useContext(PluginContextCtx);
  if (!ctx) {
    throw new Error('usePluginContext must be used within PluginProvider');
  }
  return ctx;
}

// Hook for memory with React state
export function usePluginMemory() {
  const ctx = usePluginContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const store = useCallback(async (content: string, tags?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      await ctx.memory.store(content, tags);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ctx.memory]);
  
  const recall = useCallback(async (query: string, limit?: number): Promise<MemoryResult[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await ctx.memory.recall(query, limit);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ctx.memory]);
  
  const search = useCallback(async (tags: string[]): Promise<MemoryResult[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await ctx.memory.search(tags);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ctx.memory]);
  
  return { store, recall, search, isLoading, error };
}

// Hook for voice commands
export function useVoiceCommand(pattern: string, handler: (params: string[]) => void) {
  const ctx = usePluginContext();
  
  useEffect(() => {
    const unsubscribe = ctx.voice.onCommand(pattern, handler);
    return unsubscribe;
  }, [ctx.voice, pattern, handler]);
}

// Hook for listening to events
export function usePluginEvent(event: string, handler: (data: unknown) => void) {
  const ctx = usePluginContext();
  
  useEffect(() => {
    const unsubscribe = ctx.events.on(event, handler);
    return unsubscribe;
  }, [ctx.events, event, handler]);
}

// Hook for config with reactive updates
export function usePluginConfig<T = unknown>(key: string, defaultValue?: T): [T, (value: T) => void] {
  const ctx = usePluginContext();
  const [value, setValue] = useState<T>(() => ctx.config.get(key, defaultValue) as T);
  
  const updateValue = useCallback((newValue: T) => {
    ctx.config.set(key, newValue);
    setValue(newValue);
  }, [ctx.config, key]);
  
  return [value, updateValue];
}

// Hook for notifications
export function useNotification() {
  const ctx = usePluginContext();
  
  return useCallback((title: string, message: string) => {
    ctx.system.notify(title, message);
  }, [ctx.system]);
}

// Hook for clipboard
export function useClipboard() {
  const ctx = usePluginContext();
  
  const read = useCallback(async () => {
    return ctx.system.clipboard.read();
  }, [ctx.system.clipboard]);
  
  const write = useCallback(async (text: string) => {
    return ctx.system.clipboard.write(text);
  }, [ctx.system.clipboard]);
  
  return { read, write };
}

// Hook for network requests with loading state
export function useFetch() {
  const ctx = usePluginContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ctx.network.fetch(url, options);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ctx.network]);
  
  return { fetch, isLoading, error };
}

// Hook for plugin lifecycle
export function usePluginLifecycle(hooks: {
  onStart?: () => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}) {
  const ctx = usePluginContext();
  
  useEffect(() => {
    hooks.onStart?.();
    return () => {
      hooks.onStop?.();
    };
  }, []);
}

// Re-export types
export type {
  PluginContext,
  MemoryAPI,
  NetworkAPI,
  SystemAPI,
  VoiceAPI,
  EventsAPI,
  Config,
  MemoryResult
};
