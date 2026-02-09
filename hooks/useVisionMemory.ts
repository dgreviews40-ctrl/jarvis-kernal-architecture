/**
 * Vision Memory Hook - Integrates visual memory with chat
 * 
 * Captures images shared in chat and stores them in vision memory
 * for future reference and search.
 */

import { useCallback, useEffect, useRef } from 'react';
import { visionMemory, VisionMemoryEntry } from '../services/visionMemory';

interface UseVisionMemoryOptions {
  /** Auto-capture images from chat messages */
  autoCapture?: boolean;
  /** Minimum image size (in bytes) to store */
  minSize?: number;
  /** Maximum images to auto-capture per session */
  maxPerSession?: number;
}

export function useVisionMemory(options: UseVisionMemoryOptions = {}) {
  const {
    autoCapture = true,
    minSize = 1024,
    maxPerSession = 100
  } = options;

  const capturedCount = useRef(0);
  const initialized = useRef(false);

  // Initialize vision memory on mount
  useEffect(() => {
    if (!initialized.current) {
      visionMemory.initialize();
      initialized.current = true;
    }
  }, []);

  /**
   * Store an image in vision memory
   */
  const storeImage = useCallback(async (
    imageData: string,
    context: {
      description?: string;
      userMessage?: string;
      aiResponse?: string;
    } = {}
  ): Promise<VisionMemoryEntry | null> => {
    // Check size
    const size = Math.ceil((imageData.length * 3) / 4);
    if (size < minSize) {
      console.log('[VisionMemory] Image too small, skipping');
      return null;
    }

    // Check session limit
    if (capturedCount.current >= maxPerSession) {
      console.log('[VisionMemory] Session limit reached');
      return null;
    }

    try {
      const entry = await visionMemory.storeImage(imageData, {
        description: context.description,
        context: context.userMessage || context.aiResponse || '',
        tags: context.description ? [context.description.toLowerCase()] : []
      });

      if (entry) {
        capturedCount.current++;
        console.log(`[VisionMemory] Stored image ${capturedCount.current}/${maxPerSession}`);
      }

      return entry;
    } catch (error) {
      console.error('[VisionMemory] Failed to store image:', error);
      return null;
    }
  }, [minSize, maxPerSession]);

  /**
   * Capture image from clipboard paste
   */
  const handlePaste = useCallback(async (
    event: ClipboardEvent,
    context?: { userMessage?: string; aiResponse?: string }
  ): Promise<VisionMemoryEntry | null> => {
    if (!autoCapture) return null;

    const items = event.clipboardData?.items;
    if (!items) return null;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        return storeImage(imageData, {
          description: `Pasted ${file.type}`,
          ...context
        });
      }
    }

    return null;
  }, [autoCapture, storeImage]);

  /**
   * Capture image from file drop
   */
  const handleDrop = useCallback(async (
    event: DragEvent,
    context?: { userMessage?: string; aiResponse?: string }
  ): Promise<VisionMemoryEntry | null> => {
    if (!autoCapture) return null;

    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files) return null;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        return storeImage(imageData, {
          description: `Dropped ${file.name}`,
          ...context
        });
      }
    }

    return null;
  }, [autoCapture, storeImage]);

  /**
   * Capture image from file input
   */
  const handleFileSelect = useCallback(async (
    file: File,
    context?: { userMessage?: string; aiResponse?: string }
  ): Promise<VisionMemoryEntry | null> => {
    if (!autoCapture || !file.type.startsWith('image/')) return null;

    const reader = new FileReader();
    const imageData = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

    return storeImage(imageData, {
      description: `Uploaded ${file.name}`,
      ...context
    });
  }, [autoCapture, storeImage]);

  /**
   * Capture screenshot from canvas/video
   */
  const captureFromElement = useCallback(async (
    element: HTMLCanvasElement | HTMLVideoElement,
    context?: { userMessage?: string; aiResponse?: string }
  ): Promise<VisionMemoryEntry | null> => {
    if (!autoCapture) return null;

    let canvas: HTMLCanvasElement;

    if (element instanceof HTMLCanvasElement) {
      canvas = element;
    } else if (element instanceof HTMLVideoElement) {
      canvas = document.createElement('canvas');
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      canvas.getContext('2d')?.drawImage(element, 0, 0);
    } else {
      return null;
    }

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    return storeImage(imageData, {
      description: 'Screenshot capture',
      ...context
    });
  }, [autoCapture, storeImage]);

  /**
   * Search vision memories
   */
  const searchMemories = useCallback(async (
    query: string,
    limit?: number
  ) => {
    return visionMemory.searchMemories(query, limit);
  }, []);

  /**
   * Find similar images
   */
  const findSimilar = useCallback(async (
    imageData: string,
    limit?: number
  ) => {
    return visionMemory.findSimilarImages(imageData, limit);
  }, []);

  /**
   * Get all memories
   */
  const getMemories = useCallback(() => {
    return visionMemory.getAllMemories();
  }, []);

  /**
   * Get stats
   */
  const getStats = useCallback(() => {
    return visionMemory.getStats();
  }, []);

  /**
   * Delete a memory
   */
  const deleteMemory = useCallback(async (id: string) => {
    return visionMemory.deleteMemory(id);
  }, []);

  return {
    storeImage,
    handlePaste,
    handleDrop,
    handleFileSelect,
    captureFromElement,
    searchMemories,
    findSimilar,
    getMemories,
    getStats,
    deleteMemory,
    capturedCount: capturedCount.current
  };
}

export default useVisionMemory;
