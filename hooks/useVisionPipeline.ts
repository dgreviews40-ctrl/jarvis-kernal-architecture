/**
 * Vision Pipeline Hook for React Components
 * 
 * Provides reactive access to video stream processing and visual memory
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  visionPipeline, 
  VideoFrame, 
  FrameAnalysis, 
  VisualMemoryEntry,
  BatchProcessResult 
} from '../services/visionPipeline';

interface UseVisionPipelineReturn {
  // Status
  isInitialized: boolean;
  isProcessing: boolean;
  visionServerAvailable: boolean;
  visualMemorySize: number;
  
  // Active streams
  activeStreams: string[];
  
  // Methods
  initialize: () => Promise<boolean>;
  startVideoSampling: (stream: MediaStream, options?: {
    fps?: number;
    sourceName?: string;
    maxDurationMs?: number;
  }) => Promise<VideoFrame[]>;
  stopVideoSampling: (sourceName: string) => boolean;
  queryVisualMemory: (query: string, options?: {
    timeWindowMs?: number;
    source?: string;
    maxResults?: number;
  }) => Promise<VisualMemoryEntry[]>;
  getActivitySummary: (timeWindowMs?: number) => {
    totalFrames: number;
    uniqueObjects: string[];
    topTags: Array<{ tag: string; count: number }>;
    sources: string[];
  };
  clearVisualMemory: () => void;
  
  // Recent activity
  recentAnalyses: FrameAnalysis[];
  recentMemory: VisualMemoryEntry[];
}

export function useVisionPipeline(): UseVisionPipelineReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visionServerAvailable, setVisionServerAvailable] = useState(false);
  const [visualMemorySize, setVisualMemorySize] = useState(0);
  const [activeStreams, setActiveStreams] = useState<string[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<FrameAnalysis[]>([]);
  const [recentMemory, setRecentMemory] = useState<VisualMemoryEntry[]>([]);
  
  const analysesRef = useRef<FrameAnalysis[]>([]);
  const memoryRef = useRef<VisualMemoryEntry[]>([]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const success = await visionPipeline.initialize();
      setIsInitialized(success);
      updateStatus();
    };
    
    init();
    
    // Set up status polling
    const interval = setInterval(updateStatus, 2000);
    
    // Event listeners
    const handleBatchStart = () => setIsProcessing(true);
    const handleBatchComplete = (data: { frameCount: number; batchTimeMs: number }) => {
      setIsProcessing(false);
      updateStatus();
    };
    const handleMemoryAdded = (entry: VisualMemoryEntry) => {
      memoryRef.current = [entry, ...memoryRef.current].slice(0, 20);
      setRecentMemory(memoryRef.current);
      setVisualMemorySize(prev => prev + 1);
    };
    
    visionPipeline.on('batchStart', handleBatchStart);
    visionPipeline.on('batchComplete', handleBatchComplete);
    visionPipeline.on('memoryAdded', handleMemoryAdded);
    
    return () => {
      clearInterval(interval);
      visionPipeline.off('batchStart', handleBatchStart);
      visionPipeline.off('batchComplete', handleBatchComplete);
      visionPipeline.off('memoryAdded', handleMemoryAdded);
    };
  }, []);

  const updateStatus = useCallback(() => {
    const status = visionPipeline.getStatus();
    setVisionServerAvailable(status.visionServerAvailable);
    setVisualMemorySize(status.visualMemorySize);
    setIsProcessing(status.isProcessing);
    setActiveStreams(status.activeStreamNames || []);
  }, []);

  const initialize = useCallback(async (): Promise<boolean> => {
    const success = await visionPipeline.initialize();
    setIsInitialized(success);
    updateStatus();
    return success;
  }, [updateStatus]);

  const startVideoSampling = useCallback(async (
    stream: MediaStream,
    options?: {
      fps?: number;
      sourceName?: string;
      maxDurationMs?: number;
    }
  ): Promise<VideoFrame[]> => {
    const frames = await visionPipeline.sampleVideoStream(stream, options);
    updateStatus();
    return frames;
  }, [updateStatus]);

  const stopVideoSampling = useCallback((sourceName: string): boolean => {
    const success = visionPipeline.stopSampling(sourceName);
    updateStatus();
    return success;
  }, [updateStatus]);

  const queryVisualMemory = useCallback(async (
    query: string,
    options?: {
      timeWindowMs?: number;
      source?: string;
      maxResults?: number;
    }
  ): Promise<VisualMemoryEntry[]> => {
    return visionPipeline.queryVisualMemory(query, options);
  }, []);

  const getActivitySummary = useCallback((timeWindowMs?: number) => {
    return visionPipeline.getVisualActivitySummary(timeWindowMs);
  }, []);

  const clearVisualMemory = useCallback(() => {
    visionPipeline.clearVisualMemory();
    memoryRef.current = [];
    setRecentMemory([]);
    setVisualMemorySize(0);
  }, []);

  return {
    isInitialized,
    isProcessing,
    visionServerAvailable,
    visualMemorySize,
    activeStreams,
    initialize,
    startVideoSampling,
    stopVideoSampling,
    queryVisualMemory,
    getActivitySummary,
    clearVisualMemory,
    recentAnalyses,
    recentMemory
  };
}

export default useVisionPipeline;
