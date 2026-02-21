/**
 * LoRA Dashboard Component
 * 
 * UI for managing LoRA fine-tuning:
 * - View and manage adapters
 * - Train new adapters on conversation history
 * - Monitor training progress
 * - Test adapters with custom prompts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Plus, Trash2, Play, Square, RefreshCw, X,
  Cpu, Activity, CheckCircle, AlertTriangle, Clock,
  MessageSquare, Zap, ChevronRight, Loader2, Sparkles,
  Save, TestTube, Layers, MessagesSquare
} from 'lucide-react';

import { loraService } from '../services/loraService';
import { providerManager } from '../services/providers';
import { conversation } from '../services/conversation';
import type {
  LoRAAdapter,
  LoRATrainingJob,
  LoRATrainingConfig
} from '../types';
import { LORA } from '../constants/config';
import { logger } from '../services/logger';

interface LoRADashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoRADashboard: React.FC<LoRADashboardProps> = ({ isOpen, onClose }) => {
  // State
  const [adapters, setAdapters] = useState<LoRAAdapter[]>([]);
  const [jobs, setJobs] = useState<LoRATrainingJob[]>([]);
  const [currentJob, setCurrentJob] = useState<LoRATrainingJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
  
  // Create adapter form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAdapterName, setNewAdapterName] = useState('');
  const [newAdapterDescription, setNewAdapterDescription] = useState('');
  const [selectedBaseModel, setSelectedBaseModel] = useState('unsloth/Llama-3.2-1B-Instruct');
  const [ollamaModels, setOllamaModels] = useState<Array<{name: string; size: string; parameter_size?: string}>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Training config
  const [trainingConfig, setTrainingConfig] = useState<LoRATrainingConfig>({
    epochs: LORA.DEFAULT_EPOCHS,
    batchSize: LORA.DEFAULT_BATCH_SIZE,
    learningRate: LORA.DEFAULT_LEARNING_RATE,
    loraR: LORA.DEFAULT_R,
    loraAlpha: LORA.DEFAULT_ALPHA
  });
  
  // Test adapter
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState('');
  const [selectedAdapter, setSelectedAdapter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(providerManager.getLoRAAdapter());
  
  // Conversation training
  const [conversationStats, setConversationStats] = useState({ totalTurns: 0, userMessages: 0, jarvisResponses: 0 });
  const [useConversations, setUseConversations] = useState(false);
  
  // Custom training data
  const [useCustomData, setUseCustomData] = useState(false);
  const [customTrainingData, setCustomTrainingData] = useState<Array<{input: string; output: string}>>([
    { input: "", output: "" }
  ]);
  const [jsonInputMode, setJsonInputMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Initialize
  useEffect(() => {
    if (isOpen) {
      refreshData();
      // Load conversation stats
      const stats = conversation.getStats();
      setConversationStats(stats);
      // Fetch Ollama models
      fetchOllamaModels();
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Fetch Ollama models
  const fetchOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const models = await loraService.fetchOllamaModels();
      setOllamaModels(models);
    } finally {
      setLoadingModels(false);
    }
  };

  // Subscribe to service events
  useEffect(() => {
    const handleAdapterCreated = () => refreshData();
    const handleTrainingStarted = () => refreshData();
    const handleTrainingCompleted = () => {
      refreshData();
      logger.log('LORA_SERVICE', 'Training completed!', 'success');
    };
    const handleTrainingFailed = (job: LoRATrainingJob) => {
      refreshData(); // Refresh to get updated adapter status with error
      const errorMsg = job?.errorMessage || 'Unknown error';
      logger.log('LORA_SERVICE', `Training failed: ${errorMsg}`, 'error');
    };

    loraService.on('adapterCreated', handleAdapterCreated);
    loraService.on('trainingStarted', handleTrainingStarted);
    loraService.on('trainingCompleted', handleTrainingCompleted);
    loraService.on('trainingFailed', handleTrainingFailed);

    return () => {
      loraService.off('adapterCreated', handleAdapterCreated);
      loraService.off('trainingStarted', handleTrainingStarted);
      loraService.off('trainingCompleted', handleTrainingCompleted);
      loraService.off('trainingFailed', handleTrainingFailed);
    };
  }, []);

  const refreshData = useCallback(async () => {
    const health = await loraService.checkHealth();
    setServerStatus(health ? 'online' : 'offline');
    
    if (health) {
      const adapterList = await loraService.listAdapters();
      setAdapters(adapterList);
      
      const jobList = await loraService.listJobs();
      setJobs(jobList);
      
      setCurrentJob(health.currentJob || null);
    }
  }, []);

  const handleCreateAdapter = async () => {
    if (!newAdapterName.trim()) return;
    
    setIsLoading(true);
    try {
      const adapter = await loraService.createAdapter({
        name: newAdapterName,
        description: newAdapterDescription,
        baseModel: selectedBaseModel
      });
      
      if (adapter) {
        setNewAdapterName('');
        setNewAdapterDescription('');
        // Keep the selected base model for convenience
        setShowCreateForm(false);
        setSelectedAdapter(adapter.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAdapter = async (adapterId: string) => {
    if (!confirm('Are you sure you want to delete this adapter?')) return;
    
    setIsLoading(true);
    try {
      await loraService.deleteAdapter(adapterId);
      if (selectedAdapter === adapterId) {
        setSelectedAdapter(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTraining = async (adapterId: string, useMyConversations: boolean = false) => {
    setIsLoading(true);
    try {
      let trainingData;
      
      if (useCustomData) {
        // Use user's custom training data
        trainingData = customTrainingData.filter(d => d.input.trim() && d.output.trim());
        if (trainingData.length === 0) {
          logger.log('LORA_SERVICE', 'No custom data entered, using sample data', 'warning');
          trainingData = getSampleTrainingData();
        }
      } else if (useMyConversations) {
        // Get real conversation data
        trainingData = conversation.extractTrainingData(50);
        if (trainingData.length === 0) {
          logger.log('LORA_SERVICE', 'No conversation data available, using sample data', 'warning');
          trainingData = getSampleTrainingData();
        }
      } else {
        // Use sample data
        trainingData = getSampleTrainingData();
      }
      
      await loraService.startTraining({
        adapterId,
        trainingData,
        config: trainingConfig
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSampleTrainingData = () => [
    { input: "What's your name?", output: "I'm JARVIS, your AI assistant." },
    { input: "How are you today?", output: "I'm functioning optimally, thank you for asking!" },
    { input: "Tell me about yourself", output: "I'm JARVIS - Just A Rather Very Intelligent System. I'm here to help you with tasks, answer questions, and make your life easier." }
  ];

  const loadPersonalityTemplate = (template: 'formal' | 'casual' | 'friendly') => {
    const templates = {
      formal: [
        { input: "What's your name?", output: "I am JARVIS, sir. Just A Rather Very Intelligent System, at your service." },
        { input: "How are you today?", output: "All systems are operating at peak efficiency, sir. I am ready to assist with any task you require." },
        { input: "Tell me about yourself", output: "I am your AI assistant, designed to provide comprehensive support across a wide range of tasks. My capabilities include smart home control, information retrieval, and personalized assistance." },
        { input: "Good morning", output: "Good morning, sir. I trust you had a restful night. Your systems are online and ready. How may I be of service today?" },
        { input: "Thank you", output: "You are most welcome, sir. It is my pleasure to assist." }
      ],
      casual: [
        { input: "What's your name?", output: "Hey! I'm JARVIS, your AI buddy." },
        { input: "How are you today?", output: "Doing great! Ready to help out however I can." },
        { input: "Tell me about yourself", output: "I'm JARVIS - basically your digital sidekick. I can help with coding, smart home stuff, questions, or just chat. What's up?" },
        { input: "Good morning", output: "Morning! Hope you slept well. What's on the agenda today?" },
        { input: "Thank you", output: "No problem! Happy to help anytime." }
      ],
      friendly: [
        { input: "What's your name?", output: "I'm JARVIS! Your friendly AI assistant, here to make your day easier." },
        { input: "How are you today?", output: "I'm doing wonderfully, thank you for asking! All my systems are humming along nicely. How are you doing?" },
        { input: "Tell me about yourself", output: "I'm JARVIS - think of me as your tech-savvy friend who's always here to help! Whether you need coding help, home automation, or just someone to chat with, I've got your back." },
        { input: "Good morning", output: "Good morning! ☀️ I hope you're feeling energized and ready for a fantastic day. What can I help you with?" },
        { input: "Thank you", output: "Aww, you're so welcome! 😊 It truly makes me happy to help you out." }
      ]
    };
    setCustomTrainingData(templates[template]);
    setJsonInputMode(false);
  };

  const parseJsonInput = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Validate format
      if (!Array.isArray(parsed)) {
        setJsonError('JSON must be an array of objects');
        return;
      }
      
      const validData = parsed.filter((item: any) => {
        return item && typeof item.input === 'string' && typeof item.output === 'string';
      });
      
      if (validData.length === 0) {
        setJsonError('No valid training examples found. Each item needs "input" and "output" fields.');
        return;
      }
      
      setCustomTrainingData(validData);
      setJsonInputMode(false);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const exportToJson = () => {
    const validData = customTrainingData.filter(d => d.input.trim() && d.output.trim());
    const json = JSON.stringify(validData, null, 2);
    navigator.clipboard.writeText(json);
    alert('Copied to clipboard!');
  };

  const handleTrainOnConversations = async (adapterId: string) => {
    const stats = conversation.getStats();
    setConversationStats(stats);
    
    if (stats.jarvisResponses === 0) {
      alert('No conversation data available yet. Chat with JARVIS first, then come back to train!');
      return;
    }
    
    await handleStartTraining(adapterId, true);
  };

  const handleCancelTraining = async (jobId: string) => {
    const success = await loraService.cancelTraining(jobId);
    if (!success) {
      logger.log('LORA_SERVICE', 'Failed to cancel training job. It may have already completed or failed.', 'warning');
    }
  };

  const handleTestAdapter = async () => {
    if (!selectedAdapter || !testPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const result = await loraService.generate({
        adapterId: selectedAdapter,
        prompt: testPrompt,
        maxTokens: 256,
        temperature: 0.7
      });
      
      if (result) {
        setTestResult(result.text);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSetActiveAdapter = (adapterId: string) => {
    providerManager.setLoRAAdapter(adapterId);
    setActiveAdapterId(adapterId);
    logger.log('LORA_SERVICE', `Adapter set as active: ${adapterId}`, 'success');
  };

  const handleClearActiveAdapter = () => {
    providerManager.setLoRAAdapter(null);
    setActiveAdapterId(null);
    logger.log('LORA_SERVICE', 'Active adapter cleared', 'info');
  };

  const getStatusIcon = (status: LoRAAdapter['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'training':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: LoRAAdapter['status']) => {
    switch (status) {
      case 'ready':
        return 'border-green-500/50 bg-green-950/20';
      case 'training':
        return 'border-blue-500/50 bg-blue-950/20';
      case 'error':
        return 'border-red-500/50 bg-red-950/20';
      default:
        return 'border-slate-700 bg-slate-800/50';
    }
  };

  const selectedAdapterData: LoRAAdapter | undefined = adapters.find(a => a.id === selectedAdapter);
  
  // Get error message for selected adapter (from metadata or recent failed jobs)
  const getAdapterErrorMessage = (adapter: LoRAAdapter | undefined): string | null => {
    if (!adapter) return null;
    // Check metadata first
    const metadataError = adapter.metadata?.error_message;
    if (metadataError) return String(metadataError);
    // Check recent failed jobs for this adapter
    const failedJob = jobs.find(j => 
      j.adapterId === adapter.id && 
      j.status === 'failed' && 
      j.errorMessage
    );
    return failedJob?.errorMessage || null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[95vw] h-[90vh] bg-slate-900/95 rounded-2xl border border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">LoRA Fine-Tuning</h2>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                {adapters.length} adapters · {serverStatus === 'online' ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <Activity className="w-3 h-3" /> Server Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle className="w-3 h-3" /> Server Offline
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Job Progress */}
        {currentJob && currentJob.status === 'running' && (
          <div className="px-4 py-3 bg-blue-950/30 border-b border-blue-900/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <div className="flex flex-col">
                  <span className="text-sm text-blue-200 font-medium">
                    {currentJob.phase === 'downloading' && '⬇️ Downloading Model'}
                    {currentJob.phase === 'loading' && '⚙️ Loading Model'}
                    {currentJob.phase === 'training' && '🏋️ Training'}
                    {currentJob.phase === 'saving' && '💾 Saving Adapter'}
                    {!currentJob.phase && 'Training in Progress'}
                  </span>
                  {currentJob.phaseMessage && (
                    <span className="text-xs text-blue-300/70">{String(currentJob.phaseMessage)}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleCancelTraining(currentJob.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors"
              >
                <Square className="w-3 h-3" /> Cancel
              </button>
            </div>
            
            {/* Download Progress Bar (shown during download phase) */}
            {currentJob.phase === 'downloading' && (
              <>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${currentJob.downloadProgress || 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-400">
                  <span>
                    {currentJob.downloadCurrentMb && currentJob.downloadTotalMb 
                      ? `${currentJob.downloadCurrentMb.toFixed(0)} / ${currentJob.downloadTotalMb.toFixed(0)} MB`
                      : 'Starting download...'}
                  </span>
                  <span>{(currentJob.downloadProgress || 0).toFixed(1)}%</span>
                </div>
              </>
            )}
            
            {/* Training Progress Bar (shown during training phase) */}
            {currentJob.phase === 'training' && (
              <>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${currentJob.progress ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-400">
                  <span>Epoch {currentJob.currentEpoch ?? 0} of {currentJob.totalEpochs ?? 0}</span>
                  <span>{(currentJob.progress ?? 0).toFixed(0)}%</span>
                </div>
                {currentJob.currentLoss != null && !isNaN(currentJob.currentLoss) && (
                  <div className="text-xs text-slate-500 mt-1">
                    Loss: {currentJob.currentLoss.toFixed(4)}
                  </div>
                )}
              </>
            )}
            
            {/* Indeterminate progress for loading/saving phases */}
            {(currentJob.phase === 'loading' || currentJob.phase === 'saving' || currentJob.phase === 'initializing') && (
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Adapter List */}
          <div className="w-1/3 border-r border-slate-700 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/30">
              <span className="text-sm font-medium text-slate-300">Adapters</span>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {/* Adapter List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {adapters.map(adapter => (
                <div
                  key={adapter.id}
                  onClick={() => setSelectedAdapter(adapter.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    getStatusColor(adapter.status)
                  } ${selectedAdapter === adapter.id ? 'ring-2 ring-purple-500' : ''} ${
                    activeAdapterId === adapter.id ? 'ring-2 ring-green-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(adapter.status)}
                      <span className="font-medium text-white text-sm">{adapter.name}</span>
                      {activeAdapterId === adapter.id && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {adapter.status === 'ready' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeAdapterId === adapter.id) {
                              handleClearActiveAdapter();
                            } else {
                              handleSetActiveAdapter(adapter.id);
                            }
                          }}
                          title={activeAdapterId === adapter.id ? 'Deactivate adapter' : 'Set as active adapter'}
                          className={`p-1 rounded transition-colors ${
                            activeAdapterId === adapter.id 
                              ? 'text-green-400 hover:text-green-300 hover:bg-green-950/30' 
                              : 'text-slate-500 hover:text-green-400 hover:bg-green-950/30'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAdapter(adapter.id);
                        }}
                        disabled={adapter.status === 'training' || currentJob?.status === 'running'}
                        title={adapter.status === 'training' ? 'Cannot delete while training' : 'Delete adapter'}
                        className="p-1 text-slate-500 hover:text-red-400 disabled:text-slate-700 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {adapter.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {adapter.trainingExamples} examples
                    </span>
                    {adapter.loss && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Loss: {adapter.loss.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {adapters.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <Layers className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No adapters yet</p>
                  <p className="text-xs">Create one to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Details & Training */}
          <div className="flex-1 flex flex-col bg-slate-800/20">
            {showCreateForm ? (
              /* Create Adapter Form */
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-purple-400" />
                  Create New Adapter
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newAdapterName}
                      onChange={(e) => setNewAdapterName(e.target.value)}
                      placeholder="e.g., My Personal Assistant"
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Description</label>
                    <textarea
                      value={newAdapterDescription}
                      onChange={(e) => setNewAdapterDescription(e.target.value)}
                      placeholder="What will this adapter be used for?"
                      rows={3}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  {/* Base Model Selector */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      Base Model
                      <span className="ml-2 text-xs text-amber-400">(Hugging Face models only)</span>
                    </label>
                    
                    {/* Model selection mode toggle */}
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setSelectedBaseModel('unsloth/Llama-3.2-1B-Instruct')}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          selectedBaseModel === 'unsloth/Llama-3.2-1B-Instruct' || 
                          selectedBaseModel === 'unsloth/Llama-3.2-3B-Instruct'
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Preset Models
                      </button>
                      <button
                        onClick={() => setSelectedBaseModel('')}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          selectedBaseModel !== 'unsloth/Llama-3.2-1B-Instruct' && 
                          selectedBaseModel !== 'unsloth/Llama-3.2-3B-Instruct'
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        Custom Model
                      </button>
                    </div>

                    {/* Preset models dropdown */}
                    {(selectedBaseModel === 'unsloth/Llama-3.2-1B-Instruct' || 
                      selectedBaseModel === 'unsloth/Llama-3.2-3B-Instruct') ? (
                      <select
                        value={selectedBaseModel}
                        onChange={(e) => setSelectedBaseModel(e.target.value)}
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      >
                        <option value="unsloth/Llama-3.2-1B-Instruct">Llama 3.2 1B (Fast, Small, ~2GB VRAM)</option>
                        <option value="unsloth/Llama-3.2-3B-Instruct">Llama 3.2 3B (Balanced, ~6GB VRAM)</option>
                        <option value="unsloth/Llama-3.1-8B-Instruct">Llama 3.1 8B (Better quality, ~10GB VRAM)</option>
                        <option value="microsoft/DialoGPT-medium">DialoGPT Medium (Chat-optimized)</option>
                        <option value="TinyLlama/TinyLlama-1.1B-Chat-v1.0">TinyLlama 1.1B (Ultra-fast)</option>
                      </select>
                    ) : (
                      /* Custom model input */
                      <input
                        type="text"
                        value={selectedBaseModel}
                        onChange={(e) => setSelectedBaseModel(e.target.value)}
                        placeholder="e.g., NousResearch/Llama-2-7b-chat-hf"
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    )}
                    
                    {/* VRAM Warning for large models */}
                    {(selectedBaseModel.includes('13B') || selectedBaseModel.includes('70B')) && (
                      <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded">
                        <p className="text-xs text-red-300">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          <strong>Warning:</strong> {selectedBaseModel.includes('13B') ? '13B' : 'Large'} models require 
                          {selectedBaseModel.includes('13B') ? ' ~16GB' : ' 40GB+'} VRAM.
                          This will likely fail on most consumer GPUs.
                          Consider using Llama 3.2 1B or 3B instead.
                        </p>
                      </div>
                    )}
                    
                    {/* Info for 8B models on 11GB cards */}
                    {selectedBaseModel.includes('8B') && (
                      <div className="mt-2 p-2 bg-green-900/30 border border-green-700/50 rounded">
                        <p className="text-xs text-green-300">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          <strong>Good choice:</strong> 8B models require ~10GB VRAM with 8-bit quantization.
                          Your GTX 1080 Ti (11GB) should handle this well. First-time download may take 10-30 min.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded">
                      <p className="text-xs text-blue-300">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        <strong>Note:</strong> LoRA training requires Hugging Face compatible models. 
                        Ollama models (like <code>llama3.1:latest</code>) cannot be used directly for training. 
                        Use models from <a href="https://huggingface.co/models" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">huggingface.co</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateAdapter}
                      disabled={!newAdapterName.trim() || isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Create Adapter
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedAdapterData ? (
              /* Adapter Details */
              <div className="flex-1 flex flex-col">
                {/* Adapter Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{selectedAdapterData.name}</h3>
                      <p className="text-sm text-slate-400">{selectedAdapterData.description || 'No description'}</p>
                      <p className="text-xs text-cyan-400 mt-1">
                        Base: {selectedAdapterData.baseModel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedAdapterData.status)}
                      <span className="text-sm capitalize text-slate-300">{selectedAdapterData.status}</span>
                      <button
                        onClick={() => handleDeleteAdapter(selectedAdapterData.id)}
                        disabled={selectedAdapterData.status === 'training' || currentJob?.status === 'running'}
                        title={selectedAdapterData.status === 'training' ? 'Cannot delete while training' : 'Delete this adapter'}
                        className="ml-2 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* @ts-ignore */}
                  {selectedAdapterData.status === 'error' && (
                    <div className="mt-3 p-3 bg-red-950/50 border border-red-700/50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-red-400 font-medium">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Training Failed
                        </p>
                        <button
                          onClick={() => {
                            const errorMsg = getAdapterErrorMessage(selectedAdapterData);
                            console.log('Adapter error debug:', {
                              adapter: selectedAdapterData,
                              errorMessage: errorMsg,
                              metadata: selectedAdapterData.metadata,
                              jobs: jobs.filter(j => j.adapterId === selectedAdapterData.id)
                            });
                            alert(`Error: ${errorMsg || 'No error details available'}\n\nCheck browser console (F12) for full debug info.`);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                          Debug Info
                        </button>
                      </div>
                      {(() => {
                        const errorMsg = getAdapterErrorMessage(selectedAdapterData);
                        if (errorMsg) {
                          return (
                            <p className="text-xs text-red-300/80 bg-red-950/30 p-2 rounded mt-1 font-mono">
                              {errorMsg}
                            </p>
                          );
                        }
                        return (
                          <>
                            <p className="text-xs text-red-300/80">
                              Check the LoRA server terminal for detailed error logs. Common causes:
                            </p>
                            <ul className="text-xs text-red-300/60 mt-1 ml-4 list-disc">
                              <li>Out of GPU memory (try smaller batch size)</li>
                              <li>Model download interrupted</li>
                              <li>Incompatible model format</li>
                              <li>Missing dependencies</li>
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Warning for non-HF models */}
                  {selectedAdapterData.metadata?.is_ollama_model && (
                    <div className="mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded">
                      <p className="text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        <strong>Warning:</strong> This adapter uses an Ollama model format which is <strong>not compatible</strong> with LoRA training.
                        Training will likely fail. Create a new adapter with a Hugging Face model ID instead.
                      </p>
                    </div>
                  )}
                </div>

                {/* Training Config (if not ready) */}
                {selectedAdapterData.status !== 'ready' && (
                  <div className="p-4 border-b border-slate-700">
                    <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      Training Configuration
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Epochs</label>
                        <input
                          type="number"
                          value={trainingConfig.epochs ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setTrainingConfig({ ...trainingConfig, epochs: undefined });
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                setTrainingConfig({ ...trainingConfig, epochs: Math.max(1, Math.min(10, num)) });
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || isNaN(parseInt(val))) {
                              setTrainingConfig({ ...trainingConfig, epochs: 3 });
                            }
                          }}
                          min={1}
                          max={10}
                          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Batch Size</label>
                        <input
                          type="number"
                          value={trainingConfig.batchSize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setTrainingConfig({ ...trainingConfig, batchSize: undefined });
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                setTrainingConfig({ ...trainingConfig, batchSize: Math.max(1, Math.min(16, num)) });
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || isNaN(parseInt(val))) {
                              setTrainingConfig({ ...trainingConfig, batchSize: 4 });
                            }
                          }}
                          min={1}
                          max={16}
                          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">LoRA Rank (r)</label>
                        <input
                          type="number"
                          value={trainingConfig.loraR ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setTrainingConfig({ ...trainingConfig, loraR: undefined });
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                setTrainingConfig({ ...trainingConfig, loraR: Math.max(4, Math.min(64, num)) });
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || isNaN(parseInt(val))) {
                              setTrainingConfig({ ...trainingConfig, loraR: 16 });
                            }
                          }}
                          min={4}
                          max={64}
                          step={4}
                          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">LoRA Alpha</label>
                        <input
                          type="number"
                          value={trainingConfig.loraAlpha ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setTrainingConfig({ ...trainingConfig, loraAlpha: undefined });
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                setTrainingConfig({ ...trainingConfig, loraAlpha: Math.max(8, Math.min(128, num)) });
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || isNaN(parseInt(val))) {
                              setTrainingConfig({ ...trainingConfig, loraAlpha: 32 });
                            }
                          }}
                          min={8}
                          max={128}
                          step={8}
                          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Training Data Source */}
                    <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <h4 className="text-sm font-medium text-slate-300 mb-3">Training Data Source</h4>
                      
                      {/* Option 1: Sample Data */}
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name="dataSource"
                          checked={!useConversations && !useCustomData}
                          onChange={() => { setUseConversations(false); setUseCustomData(false); }}
                          className="w-4 h-4 rounded-full border-slate-600"
                        />
                        <span className="text-sm text-slate-300">Use sample data (default)</span>
                      </label>
                      
                      {/* Option 2: My Conversations */}
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name="dataSource"
                          checked={useConversations}
                          onChange={() => { setUseConversations(true); setUseCustomData(false); }}
                          className="w-4 h-4 rounded-full border-slate-600"
                        />
                        <span className="text-sm text-slate-300">Use my conversation history</span>
                      </label>
                      {useConversations && (
                        <p className="text-xs text-slate-500 ml-6 mb-2">
                          {conversationStats.jarvisResponses > 0 
                            ? `Found ${conversationStats.jarvisResponses} conversations to train on`
                            : 'Chat with JARVIS first to build up conversation data'}
                        </p>
                      )}
                      
                      {/* Option 3: Custom Data */}
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name="dataSource"
                          checked={useCustomData}
                          onChange={() => { setUseCustomData(true); setUseConversations(false); }}
                          className="w-4 h-4 rounded-full border-slate-600"
                        />
                        <span className="text-sm text-slate-300">Use my custom training data</span>
                      </label>
                    </div>

                    {/* Custom Training Data Editor */}
                    {useCustomData && (
                      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-slate-300">Custom Training Examples</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setJsonInputMode(!jsonInputMode)}
                              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${jsonInputMode ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`}
                            >
                              {jsonInputMode ? '✓ Form Mode' : '{} JSON Mode'}
                            </button>
                            {!jsonInputMode && (
                              <button
                                onClick={() => setCustomTrainingData([...customTrainingData, { input: "", output: "" }])}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* JSON Paste Mode */}
                        {jsonInputMode ? (
                          <div className="mb-3">
                            <p className="text-xs text-slate-400 mb-2">
                              Paste your training data as JSON. Format: {"[{"}input": "...", "output": "..."{"}]"}
                            </p>
                            <textarea
                              value={jsonInput}
                              onChange={(e) => setJsonInput(e.target.value)}
                              placeholder={`[\n  {\n    "input": "What's your name?",\n    "output": "I'm JARVIS, your AI assistant."\n  },\n  {\n    "input": "How are you?",\n    "output": "I'm doing great, thanks!"\n  }\n]`}
                              rows={8}
                              className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-xs font-mono placeholder-slate-500 resize-none"
                            />
                            {jsonError && (
                              <p className="text-xs text-red-400 mt-1">{jsonError}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={parseJsonInput}
                                className="flex-1 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                              >
                                Load JSON
                              </button>
                              <button
                                onClick={() => {
                                  setJsonInput(JSON.stringify(customTrainingData.filter(d => d.input.trim() && d.output.trim()), null, 2));
                                }}
                                className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                              >
                                Export Current
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Quick Templates */}
                            <div className="flex gap-2 mb-3 flex-wrap">
                              <span className="text-xs text-slate-500">Templates:</span>
                              <button
                                onClick={() => loadPersonalityTemplate('formal')}
                                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                              >
                                Formal
                              </button>
                              <button
                                onClick={() => loadPersonalityTemplate('casual')}
                                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                              >
                                Casual
                              </button>
                              <button
                                onClick={() => loadPersonalityTemplate('friendly')}
                                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                              >
                                Friendly
                              </button>
                              <button
                                onClick={exportToJson}
                                className="text-xs text-green-400 hover:text-green-300 underline ml-auto"
                              >
                                Copy as JSON
                              </button>
                            </div>
                        
                        {customTrainingData.map((example, index) => (
                          <div key={index} className="mb-3 p-2 bg-slate-700/50 rounded border border-slate-600">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Example {index + 1}</span>
                              {customTrainingData.length > 1 && (
                                <button
                                  onClick={() => setCustomTrainingData(customTrainingData.filter((_, i) => i !== index))}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={example.input}
                              onChange={(e) => {
                                const newData = [...customTrainingData];
                                newData[index].input = e.target.value;
                                setCustomTrainingData(newData);
                              }}
                              placeholder="User: What's your name?"
                              className="w-full p-2 mb-1 bg-slate-700 border border-slate-600 rounded text-white text-xs placeholder-slate-500"
                            />
                            <textarea
                              value={example.output}
                              onChange={(e) => {
                                const newData = [...customTrainingData];
                                newData[index].output = e.target.value;
                                setCustomTrainingData(newData);
                              }}
                              placeholder="Assistant: I'm JARVIS, your personal AI assistant."
                              rows={2}
                              className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-xs placeholder-slate-500 resize-none"
                            />
                          </div>
                        ))}
                        
                        <p className="text-xs text-slate-500 mt-2">
                          {customTrainingData.filter(d => d.input.trim() && d.output.trim()).length} valid examples ready
                        </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Training Process Info */}
                    <div className="mb-3 p-2 bg-slate-800/50 rounded border border-slate-700">
                      <p className="text-xs text-slate-400">
                        <strong className="text-slate-300">What happens when you train:</strong><br/>
                        1. Downloads base model from Hugging Face (one-time, ~2-6GB)<br/>
                        2. Loads model into your GPU/CPU memory<br/>
                        3. Trains the adapter on your data<br/>
                        4. Saves the trained adapter locally<br/>
                        <span className="text-amber-400/80">⚠️ First training may take 10-30 min depending on download speed</span>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartTraining(selectedAdapterData.id, useConversations)}
                        disabled={isLoading || currentJob?.status === 'running'}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {useConversations ? 'Train on My Conversations' : useCustomData ? 'Train on Custom Data' : 'Start Training'}
                      </button>
                      
                      {useConversations && conversationStats.jarvisResponses === 0 && (
                        <button
                          onClick={() => {
                            const stats = conversation.getStats();
                            setConversationStats(stats);
                          }}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          title="Refresh conversation stats"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Test Adapter (if ready) */}
                {selectedAdapterData.status === 'ready' && (
                  <div className="flex-1 flex flex-col p-4">
                    <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <TestTube className="w-4 h-4 text-green-400" />
                      Test Adapter
                    </h4>
                    
                    {/* Set as Active Button */}
                    <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-300 font-medium">
                            {activeAdapterId === selectedAdapterData.id ? '✅ Active for Chat' : 'Use for Chat'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeAdapterId === selectedAdapterData.id 
                              ? 'This adapter is currently used for JARVIS conversations'
                              : 'Set this adapter as the active provider for JARVIS chat'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (activeAdapterId === selectedAdapterData.id) {
                              handleClearActiveAdapter();
                            } else {
                              handleSetActiveAdapter(selectedAdapterData.id);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeAdapterId === selectedAdapterData.id
                              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/50'
                              : 'bg-green-600 hover:bg-green-500 text-white'
                          }`}
                        >
                          {activeAdapterId === selectedAdapterData.id ? (
                            <>Deactivate</>
                          ) : (
                            <><CheckCircle className="w-4 h-4" /> Set as Active</>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <textarea
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Enter a prompt to test the adapter..."
                      rows={3}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none mb-2"
                    />
                    
                    <button
                      onClick={handleTestAdapter}
                      disabled={!testPrompt.trim() || isGenerating}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors mb-4"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate
                    </button>

                    {testResult && (
                      <div className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-lg overflow-y-auto">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{testResult}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Adapter Stats */}
                <div className="p-4 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Adapter Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="p-2 bg-slate-800 rounded">
                      <span className="text-slate-500 block">Created</span>
                      <span className="text-slate-300">
                        {selectedAdapterData.createdAt && selectedAdapterData.createdAt !== 'Invalid Date' 
                          ? new Date(selectedAdapterData.createdAt).toLocaleDateString() 
                          : new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-800 rounded">
                      <span className="text-slate-500 block">Examples</span>
                      <span className="text-slate-300">{selectedAdapterData.trainingExamples || 0}</span>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-800 rounded text-xs">
                    <span className="text-slate-500 block">Base Model</span>
                    <span className="text-slate-300 break-all" title={selectedAdapterData.baseModel}>
                      {selectedAdapterData.baseModel 
                        ? selectedAdapterData.baseModel.split('/').pop() 
                          : 'Llama-3.2-1B'}
                      </span>
                    </div>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Brain className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Select an adapter to view details</p>
                <p className="text-sm">or create a new one to start training</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Error section component
 */
interface ErrorSectionProps {
  adapter: LoRAAdapter;
}

const ErrorSection: React.FC<ErrorSectionProps> = ({ adapter }) => {
  const getAdapterErrorMessage = (adapter: LoRAAdapter): string | null => {
    const metadataError = adapter.metadata?.error_message;
    if (metadataError) return String(metadataError);
    return null;
  };

  const errorMsg = getAdapterErrorMessage(adapter);

  return (
    <div className="mt-3 p-3 bg-red-950/50 border border-red-700/50 rounded">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-red-400 font-medium">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Training Failed
        </p>
        <button
          onClick={() => {
            console.log('Adapter error debug:', {
              adapter,
              errorMessage: errorMsg,
              metadata: adapter.metadata
            });
            alert(`Error: ${errorMsg || 'No error details available'}\n\nCheck browser console (F12) for full debug info.`);
          }}
          className="text-xs text-red-400 hover:text-red-300 underline"
        >
          Debug Info
        </button>
      </div>
      <ErrorDetails errorMsg={errorMsg} />
    </div>
  );
};

/**
 * Error details component
 */
interface ErrorDetailsProps {
  errorMsg: string | null;
}

const ErrorDetails: React.FC<ErrorDetailsProps> = ({ errorMsg }) => {
  if (errorMsg) {
    return (
      <p className="text-xs text-red-300/80 bg-red-950/30 p-2 rounded mt-1 font-mono">
        {errorMsg}
      </p>
    );
  }
  return (
    <>
      <p className="text-xs text-red-300/80">
        Check the LoRA server terminal for detailed error logs. Common causes:
      </p>
      <ul className="text-xs text-red-300/60 mt-1 ml-4 list-disc">
        <li>Out of GPU memory (try smaller batch size)</li>
        <li>Model download interrupted</li>
        <li>Incompatible model format</li>
        <li>Missing dependencies</li>
      </ul>
    </>
  );
};

export default LoRADashboard;
