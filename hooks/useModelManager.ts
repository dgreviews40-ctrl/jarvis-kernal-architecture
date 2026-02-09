/**
 * Model Manager Hook - Integrates smart model management with chat
 * 
 * Provides:
 * - Automatic model selection based on chat context
 * - Quick model switching
 * - Preloading for anticipated tasks
 * - VRAM-aware model recommendations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  modelManager, 
  ModelInfo, 
  ModelState, 
  ContextHints,
  VRAMEstimate 
} from '../services/modelManager';
import { logger } from '../services/logger';

interface UseModelManagerOptions {
  /** Enable automatic model switching based on context */
  autoSwitch?: boolean;
  /** Minimum confidence to auto-switch (0-1) */
  autoSwitchThreshold?: number;
  /** Default model to fall back to */
  defaultModel?: string;
  /** Preload models on mount */
  preloadOnMount?: boolean;
}

interface ModelSwitchResult {
  success: boolean;
  modelId: string;
  timeMs: number;
  wasAlreadyLoaded: boolean;
}

export function useModelManager(options: UseModelManagerOptions = {}) {
  const {
    autoSwitch = true,
    autoSwitchThreshold = 0.8,
    defaultModel = 'llama3.1:8b',
    preloadOnMount = true
  } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelStates, setModelStates] = useState<Map<string, ModelState>>(new Map());
  const [isSwitching, setIsSwitching] = useState(false);
  const [lastSwitch, setLastSwitch] = useState<ModelSwitchResult | null>(null);
  
  const initialized = useRef(false);
  const lastInput = useRef('');

  // Initialize on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const success = await modelManager.initialize();
      if (success) {
        setIsInitialized(true);
        setCurrentModel(modelManager.getCurrentModel());
        setAvailableModels(modelManager.getAvailableModels());
        
        if (preloadOnMount) {
          await modelManager.preloadModels();
        }
      }
    };

    init();

    // Subscribe to updates
    const handleLoaded = () => refreshStates();
    const handleUnloaded = () => refreshStates();
    const handleSwitched = (data: { from: string | null; to: string; timeMs: number }) => {
      setCurrentModel(data.to);
      setLastSwitch({
        success: true,
        modelId: data.to,
        timeMs: data.timeMs,
        wasAlreadyLoaded: data.timeMs < 100
      });
    };

    modelManager.on('modelLoaded', handleLoaded);
    modelManager.on('modelUnloaded', handleUnloaded);
    modelManager.on('modelSwitched', handleSwitched);

    return () => {
      modelManager.off('modelLoaded', handleLoaded);
      modelManager.off('modelUnloaded', handleUnloaded);
      modelManager.off('modelSwitched', handleSwitched);
    };
  }, [preloadOnMount]);

  const refreshStates = useCallback(() => {
    const states = new Map<string, ModelState>();
    for (const state of modelManager.getAllStates()) {
      states.set(state.modelId, state);
    }
    setModelStates(states);
    setCurrentModel(modelManager.getCurrentModel());
  }, []);

  /**
   * Switch to a specific model
   */
  const switchModel = useCallback(async (modelId: string): Promise<ModelSwitchResult> => {
    setIsSwitching(true);
    try {
      const start = Date.now();
      const result = await modelManager.switchModel(modelId);
      
      const switchResult: ModelSwitchResult = {
        success: result.success,
        modelId,
        timeMs: result.timeMs,
        wasAlreadyLoaded: result.timeMs < 100
      };
      
      setLastSwitch(switchResult);
      return switchResult;
    } finally {
      setIsSwitching(false);
    }
  }, []);

  /**
   * Automatically select and switch to best model for input
   */
  const autoSelectModel = useCallback(async (
    input: string,
    hints?: ContextHints
  ): Promise<ModelSwitchResult | null> => {
    if (!autoSwitch) return null;

    // Don't re-analyze if input hasn't changed
    if (input === lastInput.current) {
      return null;
    }
    lastInput.current = input;

    // Get prediction
    const prediction = modelManager.predictModel(input, hints);
    
    // Check confidence threshold
    if (prediction.confidence < autoSwitchThreshold) {
      logger.log('MODEL_MANAGER', 
        `Confidence too low (${prediction.confidence.toFixed(2)}) for auto-switch`, 
        'info'
      );
      return null;
    }

    // Check if already on this model
    if (prediction.modelId === currentModel) {
      return null;
    }

    logger.log('MODEL_MANAGER', 
      `Auto-switching to ${prediction.modelId} (${prediction.reason})`, 
      'info'
    );

    return switchModel(prediction.modelId);
  }, [autoSwitch, autoSwitchThreshold, currentModel, switchModel]);

  /**
   * Ensure a model is loaded (for quick responses)
   */
  const ensureLoaded = useCallback(async (modelId?: string): Promise<boolean> => {
    const targetModel = modelId || currentModel || defaultModel;
    if (!targetModel) return false;

    const state = modelStates.get(targetModel);
    if (state?.status === 'hot' || state?.status === 'loaded') {
      return true;
    }

    return modelManager.loadModel(targetModel, true);
  }, [currentModel, defaultModel, modelStates]);

  /**
   * Preload models for expected context
   */
  const preloadForContext = useCallback(async (context: string) => {
    await modelManager.preloadModels(context);
    refreshStates();
  }, [refreshStates]);

  /**
   * Get VRAM estimate for a model
   */
  const getVRAMEstimate = useCallback((modelId: string): VRAMEstimate => {
    return modelManager.estimateVRAM(modelId);
  }, []);

  /**
   * Get model recommendation
   */
  const getRecommendation = useCallback(() => {
    return modelManager.getRecommendation();
  }, []);

  /**
   * Check if model can handle input
   */
  const canHandle = useCallback((input: string, modelId?: string): {
    canHandle: boolean;
    recommendedModel: string;
    confidence: number;
    reason: string;
  } => {
    const targetModel = modelId || currentModel;
    const prediction = modelManager.predictModel(input);
    
    return {
      canHandle: targetModel === prediction.modelId,
      recommendedModel: prediction.modelId,
      confidence: prediction.confidence,
      reason: prediction.reason
    };
  }, [currentModel]);

  /**
   * Get model info
   */
  const getModelInfo = useCallback((modelId: string) => {
    return modelManager.getModelInfo(modelId);
  }, []);

  /**
   * Format model name for display
   */
  const formatModelName = useCallback((modelId: string): string => {
    const info = modelManager.getModelInfo(modelId);
    return info?.name || modelId;
  }, []);

  return {
    // State
    isInitialized,
    currentModel,
    availableModels,
    modelStates,
    isSwitching,
    lastSwitch,
    
    // Actions
    switchModel,
    autoSelectModel,
    ensureLoaded,
    preloadForContext,
    refreshStates,
    
    // Queries
    getVRAMEstimate,
    getRecommendation,
    canHandle,
    getModelInfo,
    formatModelName
  };
}

export default useModelManager;
