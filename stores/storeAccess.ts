/**
 * Safe Store Access Utilities
 * 
 * Provides defensive wrappers for accessing Zustand stores from services.
 * Prevents errors when stores are accessed before initialization.
 */

import { useKernelStore } from './kernelStore';
import { useUIStore } from './uiStore';
import { useMemoryStore } from './memoryStore';

/**
 * Safely access kernel store state
 * Returns null if store is not available
 */
export function getKernelStoreState() {
  try {
    return useKernelStore.getState();
  } catch (e) {
    console.warn('[STORE_ACCESS] Kernel store not available:', e);
    return null;
  }
}

/**
 * Safely access UI store state
 * Returns null if store is not available
 */
export function getUIStoreState() {
  try {
    return useUIStore.getState();
  } catch (e) {
    console.warn('[STORE_ACCESS] UI store not available:', e);
    return null;
  }
}

/**
 * Safely access memory store state
 * Returns null if store is not available
 */
export function getMemoryStoreState() {
  try {
    return useMemoryStore.getState();
  } catch (e) {
    console.warn('[STORE_ACCESS] Memory store not available:', e);
    return null;
  }
}

/**
 * Safely update kernel store health
 * No-op if store is not available
 */
export function updateKernelHealth(health: { status: 'healthy' | 'degraded' | 'critical'; issues?: string[] }): void {
  const store = getKernelStoreState();
  if (store?.setHealth) {
    store.setHealth(health);
  }
}

/**
 * Safely update kernel store streaming state
 * No-op if store is not available
 */
export function setKernelStreaming(streaming: boolean, text?: string): void {
  const store = getKernelStoreState();
  if (store) {
    if (store.setIsStreaming) {
      store.setIsStreaming(streaming);
    }
    if (text !== undefined && store.setStreamingText) {
      store.setStreamingText(text);
    }
  }
}

/**
 * Safely update kernel processor state
 * No-op if store is not available
 */
export function setKernelProcessorState(state: any): void {
  const store = getKernelStoreState();
  if (store?.setProcessorState) {
    store.setProcessorState(state);
  }
}

/**
 * Safely update kernel display
 * No-op if store is not available
 */
export function setKernelDisplay(mode: any, content?: any): void {
  const store = getKernelStoreState();
  if (store) {
    if (store.setDisplayMode) {
      store.setDisplayMode(mode);
    }
    if (content !== undefined && store.setDisplayContent) {
      store.setDisplayContent(content);
    }
  }
}

/**
 * Safely set active module
 * No-op if store is not available
 */
export function setKernelActiveModule(module: string | null): void {
  const store = getKernelStoreState();
  if (store?.setActiveModule) {
    store.setActiveModule(module);
  }
}

/**
 * Safely set AI provider
 * No-op if store is not available
 */
export function setKernelProvider(provider: any): void {
  const store = getKernelStoreState();
  if (store?.setProvider) {
    store.setProvider(provider);
  }
}

/**
 * Check if kernel store is ready
 */
export function isKernelStoreReady(): boolean {
  return getKernelStoreState() !== null;
}
