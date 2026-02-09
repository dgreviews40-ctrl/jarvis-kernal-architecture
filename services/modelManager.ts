/**
 * Smart Model Manager - Intelligent Model Management for JARVIS
 * 
 * Provides:
 * - Model preloading (keep hot models in VRAM)
 * - Context-based model prediction
 * - Quick model switching (<2s)
 * - VRAM usage estimation
 * - Model recommendation engine
 */

import { EventEmitter } from './eventEmitter';
import { gpuMonitor, GpuStats } from './gpuMonitor';
import { logger } from './logger';

// Model definitions with metadata
export interface ModelInfo {
  id: string;
  name: string;
  size: number;  // Size in GB
  parameters: string;  // e.g., "7B", "13B"
  quantization: string;  // e.g., "Q4_0", "Q5_K_M"
  capabilities: ModelCapability[];
  useCases: string[];  // e.g., ["coding", "chat", "analysis"]
  vramRequired: number;  // GB
  loadTime: number;  // Estimated seconds to load
  description: string;
  isVision: boolean;
}

export type ModelCapability = 
  | 'chat' 
  | 'code' 
  | 'analysis' 
  | 'vision' 
  | 'math' 
  | 'creative'
  | 'reasoning'
  | 'summarization';

// Model state tracking
export interface ModelState {
  modelId: string;
  status: 'unloaded' | 'loading' | 'loaded' | 'hot';
  loadedAt?: number;
  lastUsed?: number;
  useCount: number;
  vramUsed?: number;
}

// Context prediction
export interface ContextHints {
  hasCode?: boolean;
  hasImage?: boolean;
  hasMath?: boolean;
  topic?: string;
  complexity?: 'low' | 'medium' | 'high';
}

// VRAM estimation
export interface VRAMEstimate {
  modelId: string;
  canFit: boolean;
  requiredGB: number;
  availableGB: number;
  afterLoadGB: number;
  confidence: 'certain' | 'likely' | 'maybe' | 'unlikely';
}

// Known models registry
export const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    size: 4.7,
    parameters: '8B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'analysis', 'reasoning'],
    useCases: ['general chat', 'questions', 'analysis'],
    vramRequired: 6,
    loadTime: 2,
    description: 'General purpose chat model - good all-rounder',
    isVision: false
  },
  {
    id: 'llama3.1:70b',
    name: 'Llama 3.1 70B',
    size: 40,
    parameters: '70B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'analysis', 'reasoning', 'math'],
    useCases: ['complex reasoning', 'deep analysis'],
    vramRequired: 45,
    loadTime: 15,
    description: 'Large model for complex tasks (requires 48GB VRAM)',
    isVision: false
  },
  {
    id: 'codellama:7b',
    name: 'CodeLlama 7B',
    size: 3.8,
    parameters: '7B',
    quantization: 'Q4_0',
    capabilities: ['code', 'chat', 'analysis'],
    useCases: ['coding', 'debugging', 'code review'],
    vramRequired: 5,
    loadTime: 2,
    description: 'Code-specialized model for programming tasks',
    isVision: false
  },
  {
    id: 'codellama:13b',
    name: 'CodeLlama 13B',
    size: 7.4,
    parameters: '13B',
    quantization: 'Q4_0',
    capabilities: ['code', 'chat', 'reasoning'],
    useCases: ['complex coding', 'architecture', 'algorithms'],
    vramRequired: 9,
    loadTime: 3,
    description: 'Larger code model for complex programming',
    isVision: false
  },
  {
    id: 'llava:7b',
    name: 'LLaVA 7B',
    size: 3.8,
    parameters: '7B',
    quantization: 'Q4_0',
    capabilities: ['vision', 'chat', 'analysis'],
    useCases: ['image analysis', 'visual questions'],
    vramRequired: 5,
    loadTime: 2,
    description: 'Vision model for analyzing images',
    isVision: true
  },
  {
    id: 'llava:13b',
    name: 'LLaVA 13B',
    size: 7.4,
    parameters: '13B',
    quantization: 'Q4_0',
    capabilities: ['vision', 'chat', 'analysis', 'reasoning'],
    useCases: ['detailed image analysis', 'visual reasoning'],
    vramRequired: 9,
    loadTime: 3,
    description: 'Larger vision model for detailed image analysis',
    isVision: true
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B',
    size: 4.1,
    parameters: '7B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'analysis', 'creative'],
    useCases: ['general chat', 'writing', 'creative tasks'],
    vramRequired: 5.5,
    loadTime: 2,
    description: 'Efficient general purpose model',
    isVision: false
  },
  {
    id: 'mixtral:8x7b',
    name: 'Mixtral 8x7B',
    size: 26,
    parameters: '47B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'analysis', 'reasoning', 'math'],
    useCases: ['complex reasoning', 'multi-task'],
    vramRequired: 28,
    loadTime: 8,
    description: 'MoE model - excellent reasoning (requires 32GB VRAM)',
    isVision: false
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    size: 4.1,
    parameters: '7B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'code', 'math', 'analysis'],
    useCases: ['coding', 'math', 'general tasks'],
    vramRequired: 5.5,
    loadTime: 2,
    description: 'Strong coding and math capabilities',
    isVision: false
  },
  {
    id: 'qwen2.5:14b',
    name: 'Qwen 2.5 14B',
    size: 9.0,
    parameters: '14B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'code', 'math', 'reasoning'],
    useCases: ['complex coding', 'advanced math'],
    vramRequired: 11,
    loadTime: 3,
    description: 'Larger Qwen for complex tasks (fits in 11GB)',
    isVision: false
  },
  {
    id: 'phi3:14b',
    name: 'Phi-3 14B',
    size: 7.6,
    parameters: '14B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'reasoning', 'analysis'],
    useCases: ['reasoning', 'analysis', 'chat'],
    vramRequired: 9,
    loadTime: 3,
    description: 'Microsoft model - good reasoning',
    isVision: false
  },
  {
    id: 'gemma2:9b',
    name: 'Gemma 2 9B',
    size: 5.4,
    parameters: '9B',
    quantization: 'Q4_0',
    capabilities: ['chat', 'analysis', 'reasoning'],
    useCases: ['general chat', 'analysis'],
    vramRequired: 7,
    loadTime: 2,
    description: 'Google model - efficient and capable',
    isVision: false
  }
];

// Configuration
const MODEL_CONFIG = {
  ollamaUrl: 'http://localhost:11434',
  hotModelCount: 2,  // Keep 2 models hot in VRAM
  predictionConfidence: 0.7,
  vramSafetyMargin: 1.0,  // GB to keep free
  cacheTimeMs: 30 * 60 * 1000,  // 30 minutes
  checkIntervalMs: 10000  // Check every 10s
};

class ModelManagerService extends EventEmitter {
  private models: Map<string, ModelState> = new Map();
  private installedModels: Set<string> = new Set();
  private currentModel: string | null = null;
  private hotModels: string[] = [];
  private gpuStats: GpuStats | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor() {
    super();
    this.initializeModels();
  }

  /**
   * Initialize model states
   */
  private initializeModels() {
    for (const model of KNOWN_MODELS) {
      this.models.set(model.id, {
        modelId: model.id,
        status: 'unloaded',
        useCount: 0
      });
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Subscribe to GPU monitor
      gpuMonitor.on('stats', (stats) => {
        this.gpuStats = stats;
      });

      // Fetch installed models
      await this.refreshInstalledModels();

      // Start monitoring
      this.checkInterval = setInterval(() => {
        this.monitorModels();
      }, MODEL_CONFIG.checkIntervalMs);

      this.initialized = true;
      this.emit('initialized');
      logger.log('MODEL_MANAGER', 'Service initialized', 'success');
      
      return true;
    } catch (error) {
      logger.log('MODEL_MANAGER', `Initialization failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Get list of installed models from Ollama
   */
  async refreshInstalledModels(): Promise<string[]> {
    try {
      const response = await fetch(`${MODEL_CONFIG.ollamaUrl}/api/tags`);
      const data = await response.json();
      
      this.installedModels.clear();
      for (const model of data.models || []) {
        this.installedModels.add(model.name);
      }

      this.emit('installedModelsUpdated', Array.from(this.installedModels));
      return Array.from(this.installedModels);
    } catch (error) {
      logger.log('MODEL_MANAGER', 'Failed to fetch installed models', 'warning');
      return [];
    }
  }

  /**
   * Check if a model is installed
   */
  isInstalled(modelId: string): boolean {
    return this.installedModels.has(modelId);
  }

  /**
   * Get model info
   */
  getModelInfo(modelId: string): ModelInfo | undefined {
    return KNOWN_MODELS.find(m => m.id === modelId);
  }

  /**
   * Get all available models (installed only)
   */
  getAvailableModels(): ModelInfo[] {
    return KNOWN_MODELS.filter(m => this.installedModels.has(m.id));
  }

  /**
   * Get model state
   */
  getModelState(modelId: string): ModelState | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get current model
   */
  getCurrentModel(): string | null {
    return this.currentModel;
  }

  /**
   * Load a model into VRAM
   */
  async loadModel(modelId: string, keepHot: boolean = false): Promise<boolean> {
    const modelInfo = this.getModelInfo(modelId);
    if (!modelInfo) {
      logger.log('MODEL_MANAGER', `Unknown model: ${modelId}`, 'error');
      return false;
    }

    if (!this.isInstalled(modelId)) {
      logger.log('MODEL_MANAGER', `Model not installed: ${modelId}`, 'error');
      return false;
    }

    // Check VRAM availability
    const estimate = this.estimateVRAM(modelId);
    if (!estimate.canFit) {
      logger.log('MODEL_MANAGER', `Insufficient VRAM for ${modelId}`, 'warning');
      
      // Try to free up VRAM
      await this.freeVRAM(modelId);
      
      // Re-check
      const newEstimate = this.estimateVRAM(modelId);
      if (!newEstimate.canFit) {
        this.emit('loadFailed', { modelId, reason: 'insufficient_vram', estimate: newEstimate });
        return false;
      }
    }

    const state = this.models.get(modelId)!;
    state.status = 'loading';
    this.emit('modelLoading', modelId);

    try {
      // Send load request to Ollama
      const response = await fetch(`${MODEL_CONFIG.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: '',  // Empty prompt just loads the model
          keep_alive: keepHot ? '30m' : '5m'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update state
      state.status = keepHot ? 'hot' : 'loaded';
      state.loadedAt = Date.now();
      state.vramUsed = estimate.requiredGB;
      
      this.currentModel = modelId;
      
      if (keepHot && !this.hotModels.includes(modelId)) {
        this.hotModels.push(modelId);
        this.manageHotModels();
      }

      this.emit('modelLoaded', modelId);
      logger.log('MODEL_MANAGER', `Loaded ${modelId}`, 'success');
      
      return true;
    } catch (error) {
      state.status = 'unloaded';
      this.emit('loadFailed', { modelId, reason: 'load_error', error });
      logger.log('MODEL_MANAGER', `Failed to load ${modelId}: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Unload a model from VRAM
   */
  async unloadModel(modelId: string): Promise<boolean> {
    try {
      await fetch(`${MODEL_CONFIG.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: '',
          keep_alive: 0  // Unload immediately
        })
      });

      const state = this.models.get(modelId);
      if (state) {
        state.status = 'unloaded';
        state.vramUsed = undefined;
      }

      this.hotModels = this.hotModels.filter(id => id !== modelId);
      
      if (this.currentModel === modelId) {
        this.currentModel = null;
      }

      this.emit('modelUnloaded', modelId);
      logger.log('MODEL_MANAGER', `Unloaded ${modelId}`, 'info');
      
      return true;
    } catch (error) {
      logger.log('MODEL_MANAGER', `Failed to unload ${modelId}: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Switch to a different model (quick switch if hot)
   */
  async switchModel(modelId: string): Promise<{ success: boolean; timeMs: number }> {
    const start = Date.now();
    
    // Already current
    if (this.currentModel === modelId) {
      return { success: true, timeMs: 0 };
    }

    const state = this.models.get(modelId);
    
    // If model is hot/loaded, switch instantly
    if (state?.status === 'hot' || state?.status === 'loaded') {
      this.currentModel = modelId;
      state.lastUsed = Date.now();
      state.useCount++;
      
      this.emit('modelSwitched', { from: this.currentModel, to: modelId, timeMs: 0 });
      return { success: true, timeMs: Date.now() - start };
    }

    // Need to load
    const loaded = await this.loadModel(modelId, true);
    
    if (loaded) {
      this.emit('modelSwitched', { from: this.currentModel, to: modelId, timeMs: Date.now() - start });
    }
    
    return { success: loaded, timeMs: Date.now() - start };
  }

  /**
   * Predict best model for context
   */
  predictModel(input: string, hints: ContextHints = {}): { modelId: string; confidence: number; reason: string } {
    const lowerInput = input.toLowerCase();
    
    // Detect code
    const codePatterns = [
      /```[\s\S]*?```/,  // Code blocks
      /function\s+\w+\s*\(/,  // Function definitions
      /const\s+\w+\s*=/,  // Variable declarations
      /class\s+\w+/,  // Class definitions
      /import\s+.*from/,  // Imports
      /for\s*\(.*\)\s*\{/,  // Loops
      /if\s*\(.*\)\s*\{/,  // Conditionals
    ];
    
    const hasCode = hints.hasCode || codePatterns.some(p => p.test(input));
    
    // Detect math
    const mathPatterns = [
      /\$\$?[\s\S]*?\$\$?/,  // LaTeX
      /[\d\s]+[\+\-\*\/\^][\d\s]+/,  // Math expressions
      /integral|derivative|sum|equation/,  // Math terms
      /calculate|solve|compute/,  // Math verbs
    ];
    
    const hasMath = hints.hasMath || mathPatterns.some(p => p.test(lowerInput));
    
    // Detect vision
    const hasImage = hints.hasImage || /image|photo|picture|screenshot|look at/i.test(lowerInput);
    
    // Detect complexity
    const wordCount = input.split(/\s+/).length;
    const complexity = hints.complexity || (wordCount > 100 ? 'high' : wordCount > 30 ? 'medium' : 'low');
    
    // Get available models
    const available = this.getAvailableModels();
    
    // Score each model
    const scores: { modelId: string; score: number; reason: string }[] = [];
    
    for (const model of available) {
      let score = 0;
      let reasons: string[] = [];
      
      // Code tasks
      if (hasCode && model.capabilities.includes('code')) {
        score += 50;
        reasons.push('code-specialized');
      }
      
      // Vision tasks
      if (hasImage && model.isVision) {
        score += 100;  // High priority for vision
        reasons.push('vision-capable');
      }
      
      // Math tasks
      if (hasMath && model.capabilities.includes('math')) {
        score += 30;
        reasons.push('math-capable');
      }
      
      // Complexity matching
      if (complexity === 'high' && ['13B', '14B', '70B', '47B'].includes(model.parameters)) {
        score += 30;
        reasons.push('complex-task');
      }
      
      if (complexity === 'low' && ['7B', '8B', '9B'].includes(model.parameters)) {
        score += 10;
        reasons.push('efficient-for-simple');
      }
      
      // VRAM check
      const estimate = this.estimateVRAM(model.id);
      if (!estimate.canFit) {
        score -= 100;  // Penalize if won't fit
        reasons.push('vram-warning');
      }
      
      // Prefer loaded/hot models
      const state = this.models.get(model.id);
      if (state?.status === 'hot') {
        score += 40;
        reasons.push('already-hot');
      } else if (state?.status === 'loaded') {
        score += 20;
        reasons.push('already-loaded');
      }
      
      // Boost recently used
      if (state && state.lastUsed && Date.now() - state.lastUsed < 5 * 60 * 1000) {
        score += 15;
        reasons.push('recently-used');
      }
      
      scores.push({
        modelId: model.id,
        score,
        reason: reasons.join(', ')
      });
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    const best = scores[0];
    if (!best) {
      return { modelId: 'llama3.1:8b', confidence: 0.5, reason: 'fallback' };
    }
    
    // Calculate confidence
    const maxScore = 200;
    const confidence = Math.min(best.score / maxScore, 1);
    
    return {
      modelId: best.modelId,
      confidence,
      reason: best.reason
    };
  }

  /**
   * Preload models likely to be needed
   */
  async preloadModels(context?: string): Promise<void> {
    const toPreload: string[] = [];
    
    if (context) {
      // Predict based on context
      const prediction = this.predictModel(context);
      if (prediction.confidence > MODEL_CONFIG.predictionConfidence) {
        toPreload.push(prediction.modelId);
      }
    }
    
    // Always keep a general chat model hot
    const generalModels = ['llama3.1:8b', 'mistral:7b', 'qwen2.5:7b'];
    for (const id of generalModels) {
      if (this.isInstalled(id) && !toPreload.includes(id)) {
        toPreload.push(id);
        break;
      }
    }
    
    // Load them
    for (const modelId of toPreload.slice(0, MODEL_CONFIG.hotModelCount)) {
      const state = this.models.get(modelId);
      if (state?.status === 'unloaded') {
        await this.loadModel(modelId, true);
      }
    }
  }

  /**
   * Estimate VRAM requirements
   */
  estimateVRAM(modelId: string): VRAMEstimate {
    const model = this.getModelInfo(modelId);
    const vramAvailable = this.gpuStats?.vram_total || 11;  // Default to 11GB (in GB)
    
    if (!model) {
      return {
        modelId,
        canFit: false,
        requiredGB: 0,
        availableGB: vramAvailable,
        afterLoadGB: vramAvailable,
        confidence: 'unlikely'
      };
    }
    
    // Account for currently loaded models (convert MB to GB)
    const usedVRAM = Array.from(this.models.values())
      .filter(s => s.status === 'loaded' || s.status === 'hot')
      .reduce((sum, s) => sum + (s.vramUsed || 0), 0);
    
    const availableAfterCurrent = Math.max(0, vramAvailable - usedVRAM);
    const requiredWithMargin = model.vramRequired + MODEL_CONFIG.vramSafetyMargin;
    const canFit = availableAfterCurrent >= model.vramRequired;
    const afterLoad = vramAvailable - usedVRAM - model.vramRequired;
    
    // Confidence level
    let confidence: VRAMEstimate['confidence'] = 'maybe';
    if (availableAfterCurrent >= requiredWithMargin * 1.5) {
      confidence = 'certain';
    } else if (availableAfterCurrent >= requiredWithMargin) {
      confidence = 'likely';
    } else if (availableAfterCurrent >= model.vramRequired) {
      confidence = 'maybe';
    } else {
      confidence = 'unlikely';
    }
    
    return {
      modelId,
      canFit,
      requiredGB: model.vramRequired,
      availableGB: availableAfterCurrent,
      afterLoadGB: afterLoad,
      confidence
    };
  }

  /**
   * Get recommendation for current situation
   */
  getRecommendation(): { type: 'info' | 'warning' | 'error'; message: string } | null {
    if (!this.gpuStats) return null;
    
    const vramUsed = this.gpuStats.vram_used / this.gpuStats.vram_total;
    
    if (vramUsed > 0.95) {
      return {
        type: 'error',
        message: 'VRAM critically full! Unload some models to prevent crashes.'
      };
    }
    
    if (vramUsed > 0.85) {
      return {
        type: 'warning',
        message: 'VRAM nearly full. Consider unloading unused models.'
      };
    }
    
    const hotCount = this.hotModels.length;
    if (hotCount === 0) {
      return {
        type: 'info',
        message: 'No models preloaded. Responses may be slower until models load.'
      };
    }
    
    if (hotCount < MODEL_CONFIG.hotModelCount && vramUsed < 0.5) {
      return {
        type: 'info',
        message: `Only ${hotCount} model(s) hot. Space available for more.`
      };
    }
    
    return null;
  }

  /**
   * Free up VRAM by unloading models
   */
  private async freeVRAM(exceptModelId?: string): Promise<void> {
    // Sort by last used (oldest first)
    const loaded = Array.from(this.models.values())
      .filter(s => 
        (s.status === 'loaded' || s.status === 'hot') &&
        s.modelId !== exceptModelId
      )
      .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    
    // Unload oldest until we have space
    for (const state of loaded) {
      const estimate = exceptModelId ? this.estimateVRAM(exceptModelId) : null;
      if (estimate?.canFit) break;
      
      await this.unloadModel(state.modelId);
    }
  }

  /**
   * Manage hot models (keep only top N)
   */
  private manageHotModels(): void {
    if (this.hotModels.length <= MODEL_CONFIG.hotModelCount) return;
    
    // Sort by use count and recency
    const sorted = this.hotModels
      .map(id => this.models.get(id)!)
      .sort((a, b) => {
        const scoreA = a.useCount * 100 + (a.lastUsed || 0);
        const scoreB = b.useCount * 100 + (b.lastUsed || 0);
        return scoreB - scoreA;
      });
    
    // Keep only top N
    const toKeep = sorted.slice(0, MODEL_CONFIG.hotModelCount).map(s => s.modelId);
    const toUnload = this.hotModels.filter(id => !toKeep.includes(id));
    
    for (const id of toUnload) {
      this.unloadModel(id);
    }
    
    this.hotModels = toKeep;
  }

  /**
   * Monitor and manage models
   */
  private monitorModels(): void {
    // Check if hot models need refreshing
    for (const modelId of this.hotModels) {
      const state = this.models.get(modelId);
      if (state?.status !== 'hot') {
        // Model got unloaded, reload it
        this.loadModel(modelId, true);
      }
    }
  }

  /**
   * Get all model states
   */
  getAllStates(): ModelState[] {
    return Array.from(this.models.values());
  }

  /**
   * Get hot models
   */
  getHotModels(): string[] {
    return [...this.hotModels];
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    gpuMonitor.off('stats', () => {});
  }
}

export const modelManager = new ModelManagerService();
export default modelManager;
