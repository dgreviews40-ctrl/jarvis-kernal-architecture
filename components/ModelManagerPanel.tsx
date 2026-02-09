/**
 * Model Manager Panel Component
 * 
 * UI for managing Ollama models with smart features:
 * - View installed models with VRAM requirements
 * - Load/unload models
 * - Keep models "hot" (preloaded in VRAM)
 * - Context-based model recommendations
 * - Quick switching between models
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, Zap, Thermometer, MemoryStick, Download, 
  Trash2, Activity, Sparkles, AlertTriangle, CheckCircle,
  RefreshCw, Flame, Snowflake, Brain, Code, Eye, Calculator,
  X, ChevronRight, Gauge
} from 'lucide-react';

import { 
  modelManager, 
  ModelInfo, 
  ModelState, 
  VRAMEstimate,
  KNOWN_MODELS,
  ContextHints
} from '../services/modelManager';
import { gpuMonitor, GpuStats } from '../services/gpuMonitor';

interface ModelManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModelManagerPanel: React.FC<ModelManagerPanelProps> = ({ isOpen, onClose }) => {
  // State
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [states, setStates] = useState<Map<string, ModelState>>(new Map());
  const [gpuStats, setGpuStats] = useState<GpuStats | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [hotModels, setHotModels] = useState<string[]>([]);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [testInput, setTestInput] = useState('');
  const [prediction, setPrediction] = useState<{ modelId: string; confidence: number; reason: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'installed' | 'hot' | 'vision' | 'code'>('all');
  const [recommendation, setRecommendation] = useState<{ type: 'info' | 'warning' | 'error'; message: string } | null>(null);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      modelManager.initialize();
      refreshData();
    }
  }, [isOpen]);

  // Subscribe to updates
  useEffect(() => {
    const handleStats = (stats: GpuStats) => setGpuStats(stats);
    const handleLoaded = () => refreshData();
    const handleUnloaded = () => refreshData();

    gpuMonitor.on('stats', handleStats);
    modelManager.on('modelLoaded', handleLoaded);
    modelManager.on('modelUnloaded', handleUnloaded);

    return () => {
      gpuMonitor.off('stats', handleStats);
      modelManager.off('modelLoaded', handleLoaded);
      modelManager.off('modelUnloaded', handleUnloaded);
    };
  }, []);

  const refreshData = useCallback(async () => {
    await modelManager.refreshInstalledModels();
    setModels(modelManager.getAvailableModels());
    
    const statesMap = new Map<string, ModelState>();
    for (const state of modelManager.getAllStates()) {
      statesMap.set(state.modelId, state);
    }
    setStates(statesMap);
    
    setCurrentModel(modelManager.getCurrentModel());
    setHotModels(modelManager.getHotModels());
    setRecommendation(modelManager.getRecommendation());
  }, []);

  // Handle load/unload
  const handleToggleModel = async (modelId: string) => {
    const state = states.get(modelId);
    if (!state) return;

    setLoading(prev => new Set(prev).add(modelId));

    try {
      if (state.status === 'unloaded') {
        await modelManager.loadModel(modelId, true);
      } else {
        await modelManager.unloadModel(modelId);
      }
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
      refreshData();
    }
  };

  // Handle switch
  const handleSwitchModel = async (modelId: string) => {
    setLoading(prev => new Set(prev).add(modelId));
    try {
      await modelManager.switchModel(modelId);
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
      refreshData();
    }
  };

  // Test prediction
  const handleTestPrediction = () => {
    if (!testInput.trim()) return;
    const result = modelManager.predictModel(testInput);
    setPrediction(result);
  };

  // Filter models
  const filteredModels = models.filter(model => {
    switch (filter) {
      case 'installed': return true;
      case 'hot': return hotModels.includes(model.id);
      case 'vision': return model.isVision;
      case 'code': return model.capabilities.includes('code');
      default: return true;
    }
  });

  // Helper functions
  const getStatusIcon = (status: ModelState['status']) => {
    switch (status) {
      case 'hot': return <Flame className="w-4 h-4 text-orange-400" />;
      case 'loaded': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'loading': return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      default: return <Snowflake className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status: ModelState['status']) => {
    switch (status) {
      case 'hot': return 'border-orange-500/50 bg-orange-950/20';
      case 'loaded': return 'border-green-500/50 bg-green-950/20';
      case 'loading': return 'border-blue-500/50 bg-blue-950/20';
      default: return 'border-slate-700 bg-slate-800/50';
    }
  };

  const getCapabilityIcon = (cap: string) => {
    switch (cap) {
      case 'code': return <Code className="w-3 h-3" />;
      case 'vision': return <Eye className="w-3 h-3" />;
      case 'math': return <Calculator className="w-3 h-3" />;
      case 'chat': return <Brain className="w-3 h-3" />;
      default: return <Sparkles className="w-3 h-3" />;
    }
  };

  const formatSize = (gb: number): string => {
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(gb * 1024).toFixed(0)} MB`;
  };

  const getVRAMBarColor = (used: number, total: number): string => {
    const pct = used / total;
    if (pct > 0.9) return 'bg-red-500';
    if (pct > 0.75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate VRAM usage (convert MB to GB)
  const vramUsed = (gpuStats?.vram_used || 0) / 1024;
  const vramTotal = (gpuStats?.vram_total || 11264) / 1024;  // 11GB = 11264MB
  const vramPercent = (vramUsed / vramTotal) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[95vw] h-[90vh] bg-slate-900/95 rounded-2xl border border-slate-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Cpu className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Smart Model Manager</h2>
              <p className="text-sm text-slate-400">
                {models.length} installed · {hotModels.length} hot · {currentModel || 'No model active'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VRAM Bar */}
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">VRAM Usage</span>
            </div>
            <span className={`text-sm font-mono ${vramPercent > 90 ? 'text-red-400' : vramPercent > 75 ? 'text-yellow-400' : 'text-green-400'}`}>
              {vramUsed.toFixed(1)} / {vramTotal.toFixed(1)} GB ({vramPercent.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getVRAMBarColor(vramUsed, vramTotal)}`}
              style={{ width: `${vramPercent}%` }}
            />
          </div>
          
          {/* Recommendation */}
          {recommendation && (
            <div className={`mt-2 flex items-center gap-2 text-sm ${
              recommendation.type === 'error' ? 'text-red-400' :
              recommendation.type === 'warning' ? 'text-yellow-400' :
              'text-cyan-400'
            }`}>
              {recommendation.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
               recommendation.type === 'warning' ? <Activity className="w-4 h-4" /> :
               <Sparkles className="w-4 h-4" />}
              {recommendation.message}
            </div>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Model List */}
          <div className="w-2/3 border-r border-slate-700 flex flex-col">
            {/* Filters */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-700 bg-slate-800/30">
              {(['all', 'installed', 'hot', 'vision', 'code'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filter === f 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={refreshData}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Model Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredModels.map(model => {
                  const state = states.get(model.id);
                  const isHot = hotModels.includes(model.id);
                  const isCurrent = currentModel === model.id;
                  const estimate = modelManager.estimateVRAM(model.id);
                  const isLoading = loading.has(model.id);

                  return (
                    <div
                      key={model.id}
                      className={`relative p-4 rounded-xl border transition-all ${
                        getStatusColor(state?.status || 'unloaded')
                      } ${isCurrent ? 'ring-2 ring-cyan-500' : ''}`}
                    >
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/30 rounded-full">
                        {getStatusIcon(state?.status || 'unloaded')}
                        <span className="text-xs capitalize text-slate-300">{state?.status}</span>
                      </div>

                      {/* Model Info */}
                      <div className="mb-3">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {model.name}
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 rounded-full">
                              Active
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{model.description}</p>
                      </div>

                      {/* Specs */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                        <div className="p-2 bg-black/20 rounded">
                          <span className="text-slate-500 block">Size</span>
                          <span className="text-slate-300 font-mono">{model.size} GB</span>
                        </div>
                        <div className="p-2 bg-black/20 rounded">
                          <span className="text-slate-500 block">VRAM</span>
                          <span className={`font-mono ${estimate.canFit ? 'text-green-400' : 'text-red-400'}`}>
                            {model.vramRequired} GB
                          </span>
                        </div>
                        <div className="p-2 bg-black/20 rounded">
                          <span className="text-slate-500 block">Load</span>
                          <span className="text-slate-300 font-mono">~{model.loadTime}s</span>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {model.capabilities.map(cap => (
                          <span 
                            key={cap}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded-full"
                          >
                            {getCapabilityIcon(cap)}
                            {cap}
                          </span>
                        ))}
                        {model.isVision && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                            <Eye className="w-3 h-3" />
                            vision
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {state?.status === 'unloaded' ? (
                          <button
                            onClick={() => handleToggleModel(model.id)}
                            disabled={isLoading || !estimate.canFit}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
                          >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Load
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleModel(model.id)}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600/80 hover:bg-red-500 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                          >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Unload
                          </button>
                        )}
                        
                        {!isCurrent && state?.status !== 'unloaded' && (
                          <button
                            onClick={() => handleSwitchModel(model.id)}
                            disabled={isLoading}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* VRAM Warning */}
                      {!estimate.canFit && state?.status === 'unloaded' && (
                        <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Insufficient VRAM
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredModels.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <Cpu className="w-12 h-12 mb-3 opacity-50" />
                  <p>No models match the selected filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Prediction & Tools */}
          <div className="w-1/3 flex flex-col bg-slate-800/30">
            {/* Prediction Tester */}
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                Model Predictor
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Test what model would be selected for a given input.
              </p>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type something... e.g., 'Write a Python function to sort a list'"
                className="w-full h-24 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none mb-2"
              />
              <button
                onClick={handleTestPrediction}
                disabled={!testInput.trim()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Predict Model
              </button>

              {/* Prediction Result */}
              {prediction && (
                  <div className="mt-3 p-3 bg-slate-700/50 rounded-lg animate-in slide-in-from-top-2 duration-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">
                        {KNOWN_MODELS.find(m => m.id === prediction.modelId)?.name}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        prediction.confidence > 0.7 ? 'bg-green-500/20 text-green-300' :
                        prediction.confidence > 0.4 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-slate-600 text-slate-300'
                      }`}>
                        {(prediction.confidence * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{prediction.reason}</p>
                    {prediction.modelId !== currentModel && (
                      <button
                        onClick={() => handleSwitchModel(prediction.modelId)}
                        className="mt-2 w-full px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded transition-colors"
                      >
                        Switch to this model
                      </button>
                    )}
                  </div>
                )}
              
            </div>

            {/* Hot Models */}
            <div className="p-4 border-b border-slate-700 flex-1">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Hot Models
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Models kept in VRAM for instant switching.
              </p>
              
              <div className="space-y-2">
                {hotModels.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No hot models</p>
                ) : (
                  hotModels.map(id => {
                    const model = KNOWN_MODELS.find(m => m.id === id);
                    const state = states.get(id);
                    return (
                      <div key={id} className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{model?.name}</p>
                          <p className="text-xs text-slate-400">
                            Used {state?.useCount || 0} times
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => modelManager.preloadModels('general chat')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  Preload Chat Models
                </button>
                <button
                  onClick={() => {
                    for (const id of hotModels) {
                      modelManager.unloadModel(id);
                    }
                    refreshData();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <Snowflake className="w-4 h-4" />
                  Unload All Hot
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelManagerPanel;
