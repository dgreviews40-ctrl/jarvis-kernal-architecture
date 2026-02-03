/**
 * Optimized App Component
 * Features: Code splitting, lazy loading, and performance optimizations
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Terminal } from './components/Terminal';
import { CircuitDashboard } from './components/CircuitDashboard';
import { PluginManager } from './components/PluginManager';
import { MemoryBank } from './components/MemoryBank';
import { NetworkControl } from './components/NetworkControl';
import { VoiceHUD } from './components/VoiceHUD';
import { VisionWindow } from './components/VisionWindow';
import { SystemMonitor } from './components/SystemMonitor';
import { SettingsInterface } from './components/SettingsInterface';
import { BootSequence } from './components/BootSequence';
import { MainDashboard } from './components/MainDashboard';
import { LogsDashboard } from './components/LogsDashboard';
import { Settings as SettingsIcon, LayoutDashboard, Bug, Terminal as TerminalIcon } from 'lucide-react';
import { logger } from './services/logger';
import { optimizer } from './services/performance';

import { 
  ProcessorState, 
  LogEntry, 
  AIProvider, 
  IntentType, 
  KernelAction, 
  BreakerStatus, 
  RuntimePlugin, 
  MemoryNode, 
  VoiceState, 
  VisionState 
} from './types';
import { analyzeIntent } from './services/gemini';
import { engine } from './services/execution';
import { registry } from './services/registry';
import { memoryOptimized as memory } from './services/memoryOptimized';
import { providerManager } from './services/providers';
import { voiceOptimized as voice } from './services/voiceOptimized';
import { vision } from './services/vision';
import { hardware } from './services/hardware';
import { cortex } from './services/cortex';
import { graphService } from './services/graph';
import { haService } from './services/home_assistant';
import { conversation } from './services/conversation';
import { learningService } from './services/learning';
import { searchEntities, generateEntityResponse, isHomeAssistantQuery } from './services/haEntitySearch';

// Lazy load heavy components
import { 
  LazyArchitectureDiagram, 
  LazyDependencyGraph, 
  LazyHealthDashboard,
  LazyHomeAssistantDashboard,
  LazyDevDashboard,
  preloadAllHeavyComponents
} from './components/LazyComponents';
import { withLazyLoad } from './components/LazyComponents';

// Memoized sub-components to prevent unnecessary re-renders
const MemoizedMainDashboard = memo(MainDashboard);
const MemoizedTerminal = memo(Terminal);
const MemoizedVoiceHUD = memo(VoiceHUD);
const MemoizedSystemMonitor = memo(SystemMonitor);
const MemoizedNetworkControl = memo(NetworkControl);
const MemoizedPluginManager = memo(PluginManager);
const MemoizedCircuitDashboard = memo(CircuitDashboard);
const MemoizedMemoryBank = memo(MemoryBank);
const MemoizedVisionWindow = memo(VisionWindow);
const MemoizedLogsDashboard = memo(LogsDashboard);

// Lazy wrapped components
const ArchitectureDiagram = withLazyLoad(LazyArchitectureDiagram, '500px');
const DependencyGraph = withLazyLoad(LazyDependencyGraph, '500px');
const HealthDashboard = withLazyLoad(LazyHealthDashboard, '500px');
const HomeAssistantDashboard = withLazyLoad(LazyHomeAssistantDashboard, '500px');
const DevDashboard = withLazyLoad(LazyDevDashboard, '100vh');

const generateId = () => Math.random().toString(36).substring(2, 11);

// Hook to track component mount status
const useIsMounted = () => {
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return React.useRef(() => isMountedRef.current).current;
};

const AppOptimized: React.FC = () => {
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [view, setView] = useState<'DASHBOARD' | 'SETTINGS' | 'DEV'>('DASHBOARD');
  const [state, setState] = useState<ProcessorState>(ProcessorState.IDLE);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'LOGS' | 'HOME_ASSISTANT'>('DASHBOARD');
  
  const [breakerStatuses, setBreakerStatuses] = useState<BreakerStatus[]>([]);
  const [plugins, setPlugins] = useState<RuntimePlugin[]>([]);
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  
  const [forcedMode, setForcedMode] = useState<AIProvider | null>(AIProvider.GEMINI);
  const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.MUTED);
  const [visionState, setVisionState] = useState<VisionState>(VisionState.OFF);

  // Debouncing refs for request processing
  const lastRequestTime = useRef<number>(0);
  const lastRequestText = useRef<string>('');
  const isProcessing = useRef<boolean>(false);
  const DEBOUNCE_MS = 500;
  const logsUpdateTimeout = useRef<number | null>(null);

  const isMounted = useIsMounted();

  // Optimized log update with debouncing
  const updateLogs = useCallback(() => {
    if (logsUpdateTimeout.current) {
      clearTimeout(logsUpdateTimeout.current);
    }
    
    logsUpdateTimeout.current = window.setTimeout(() => {
      if (isMounted()) {
        setLogs(logger.getRecent(100));
      }
    }, 100);
  }, [isMounted]);

  const refreshSystemState = useCallback(() => {
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    
    // Async memory fetch
    memory.getAll().then(nodes => {
      if (isMounted()) {
        setMemories(nodes);
      }
    });
    
    setVoiceState(voice.getState());
    setVisionState(vision.getState());
    hardware.setProcessorState(state);
  }, [state, isMounted]);

  // Initial system setup
  useEffect(() => {
    if (!isSystemReady) return;

    providerManager.setForcedMode(forcedMode);
    graphService.rebuild();

    refreshSystemState();
    updateLogs();

    // Preload heavy components when idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => preloadAllHeavyComponents(), { timeout: 5000 });
    }

    const interval = setInterval(() => {
      setBreakerStatuses(engine.getAllStatus());
    }, 1000);

    const unsubscribeRegistry = registry.subscribe(() => {
      setPlugins(registry.getAll());
      const allPlugins = registry.getAll();
      allPlugins.forEach(p => {
        if (p.status === 'DISABLED' || p.status === 'ERROR') {
          graphService.propagateFailure(p.manifest.id);
        } else if (p.status === 'ACTIVE') {
          graphService.propagateRecovery(p.manifest.id);
        }
      });
    });

    const unsubscribeVoice = voice.subscribe((newState) => {
      setVoiceState(newState);
      if (newState === VoiceState.LISTENING) {
        logger.log('VOICE', 'Wake Word detected. Listening...', 'info');
        updateLogs();
      }
    });

    const unsubscribeVision = vision.subscribe((newState) => {
      setVisionState(newState);
      if (newState === VisionState.ACTIVE) {
        logger.log('VISION', 'Optical sensors online.', 'success');
        updateLogs();
      }
    });

    logger.log('SYSTEM', 'Kernel Boot Sequence Complete.', 'success');
    updateLogs();

    return () => {
      clearInterval(interval);
      unsubscribeRegistry();
      unsubscribeVoice();
      unsubscribeVision();
      if (logsUpdateTimeout.current) {
        clearTimeout(logsUpdateTimeout.current);
      }
    };
  }, [isSystemReady, forcedMode, refreshSystemState, updateLogs]);

  // Sync hardware state
  useEffect(() => {
    if (isSystemReady) {
      hardware.setProcessorState(state);
    }
  }, [state, isSystemReady]);

  const addLog = useCallback((source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info', details?: Record<string, unknown>) => {
    logger.log(source, message, type, details);
    updateLogs();
  }, [updateLogs]);

  const handleNetworkToggle = useCallback(() => {
    const newMode = forcedMode === AIProvider.GEMINI ? AIProvider.OLLAMA : AIProvider.GEMINI;
    setForcedMode(newMode);
    providerManager.setForcedMode(newMode);
    addLog('SYSTEM', `Provider manually locked to: ${newMode === AIProvider.GEMINI ? 'CORE ENGINE (GEMINI)' : 'LOCAL OLLAMA'}`, 'warning');
  }, [forcedMode, addLog]);

  // Optimized request processing with memoization
  const processKernelRequest = useCallback(optimizer.memoize(
    async (input: string, origin: 'USER_TEXT' | 'USER_VOICE' = 'USER_TEXT') => {
      if (!input || typeof input !== 'string') {
        addLog('KERNEL', 'Invalid input received', 'error');
        return;
      }

      const now = Date.now();
      const trimmedInput = input.trim().toLowerCase();
      
      if (isProcessing.current) {
        addLog('KERNEL', 'Request blocked - already processing', 'warning');
        return;
      }
      
      if (trimmedInput === lastRequestText.current && (now - lastRequestTime.current) < DEBOUNCE_MS) {
        addLog('KERNEL', 'Duplicate request ignored', 'warning');
        return;
      }
      
      lastRequestTime.current = now;
      lastRequestText.current = trimmedInput;
      isProcessing.current = true;

      setState(ProcessorState.ANALYZING);
      setActiveModule('PARSER');
      addLog(origin === 'USER_VOICE' ? 'VOICE' : 'USER', input, 'info');

      // Check for corrections and preferences
      if (learningService.isCorrection(input)) {
        addLog('KERNEL', 'Correction detected - learning from feedback', 'info');
        const learnedFact = await learningService.processCorrection(input);
        if (learnedFact) {
          addLog('MEMORY', `Learned: ${learnedFact}`, 'success');
        }
      }

      const learnedPreference = await learningService.detectAndLearnPreference(input);
      if (learnedPreference) {
        addLog('MEMORY', `Noted preference: ${learnedPreference.content}`, 'info');
      }

      const relevantCorrection = learningService.findRelevantCorrection(input);

      // Analyze intent
      addLog('KERNEL', `Analyzing intent with ${forcedMode === AIProvider.GEMINI ? 'Core Engine' : 'Local Ollama'}...`, 'info');
      
      let analysis;
      try {
        analysis = await analyzeIntent(input);
      } catch (e) {
        addLog('KERNEL', 'Intent analysis failed, using fallback', 'warning');
        analysis = {
          type: IntentType.QUERY,
          confidence: 0.5,
          complexity: 0.5,
          suggestedProvider: 'OLLAMA',
          entities: [],
          reasoning: 'Fallback due to analysis error'
        };
      }

      addLog('KERNEL', `Intent Identified: ${analysis.type}`, 'success', {
        entities: analysis.entities,
        provider: analysis.suggestedProvider
      });

      setActiveModule('SECURITY');
      setState(ProcessorState.ROUTING);
      setActiveModule('ROUTER');

      const selectedProvider = forcedMode || (analysis.suggestedProvider === 'OLLAMA' ? AIProvider.OLLAMA : AIProvider.GEMINI);
      setProvider(selectedProvider);

      setState(ProcessorState.EXECUTING);
      let outputText = "";
      
      const correctionContext = relevantCorrection 
        ? `\n\nIMPORTANT: A similar query was previously corrected. The user indicated: "${relevantCorrection.correctionText}". Please take this into account.`
        : '';

      try {
        // Handle different intent types
        if (analysis.type === IntentType.VISION_ANALYSIS) {
          setActiveModule('EXECUTION');
          setActiveTab('VISION');
          addLog('KERNEL', 'Initiating Visual Analysis Protocol...', 'info');

          if (vision.getState() !== VisionState.ACTIVE) {
            await vision.startCamera();
            await new Promise(r => setTimeout(r, 300));
          }

          const imageBase64 = vision.captureFrame();
          if (imageBase64) {
            addLog('VISION', 'Frame captured. Transmitting...', 'success');
            const response = await providerManager.route({
              prompt: input + correctionContext,
              images: [imageBase64],
              systemInstruction: "You are JARVIS. Analyze the visual input concisely.",
            }, selectedProvider);
            outputText = response.text;
            addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          } else {
            outputText = "Optical sensors failed to return frame buffer.";
          }
        } else if (analysis.type === IntentType.MEMORY_READ) {
          setActiveModule('MEMORY');
          const results = await memory.recall(input);
          if (results.length > 0) {
            const topResult = results[0];
            const synthesis = await providerManager.route({
              prompt: `IMPORTANT: Use ONLY the following context to answer the user's question. Do not make up information.\n\nContext: ${topResult.node.content}\n\nUser Question: ${input}\n\nAnswer:`
            }, selectedProvider);
            outputText = synthesis.text;
            addLog(synthesis.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          } else {
            outputText = "Memory banks returned no relevant records.";
          }
          setActiveTab('MEMORY');
        } else if (analysis.type === IntentType.MEMORY_WRITE) {
          setActiveModule('MEMORY');
          const normalizedEntities = analysis.entities.map(entity =>
            typeof entity === 'string' ? entity
            : typeof entity === 'object' && entity.text ? entity.text
            : String(entity)
          );
          const contentToSave = normalizedEntities.join(' ') || input;
          await memory.store(contentToSave, 'FACT', ['user_input', 'auto_save']);
          outputText = "Sequence stored in Long-Term Memory.";
          setActiveTab('MEMORY');
        } else if (analysis.type === IntentType.QUERY || analysis.type === IntentType.COMMAND) {
          setActiveModule('EXECUTION');
          
          const useContext = conversation.detectsContextReference(input);
          let prompt = input + correctionContext;
          let systemInstruction = "You are JARVIS, an advanced AI assistant. Be concise and helpful.";
          
          if (useContext) {
            const recentContext = conversation.getRecentContext();
            if (recentContext) {
              prompt = `CONVERSATION HISTORY:\n${recentContext}\n\nCURRENT QUERY: ${input}${correctionContext}\n\nRespond to the current query, using the conversation history for context if relevant.`;
              addLog('KERNEL', 'Context-aware response enabled', 'info');
            }
          }
          
          const response = await providerManager.route({
            prompt,
            systemInstruction
          }, selectedProvider);
          outputText = response.text;
          addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
        } else {
          const response = await providerManager.route({
            prompt: input,
            systemInstruction: "You are JARVIS. Be concise and helpful."
          }, selectedProvider);
          outputText = response.text;
          addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
        }
      } catch (e: any) {
        outputText = `ERROR: ${e.message}`;
        addLog('KERNEL', outputText, 'error');
      } finally {
        isProcessing.current = false;
      }

      conversation.addTurn('USER', input);
      if (outputText) {
        conversation.addTurn('JARVIS', outputText);
      }

      setState(ProcessorState.IDLE);
      setActiveModule(null);
      setProvider(null);

      if (voice.getState() !== VoiceState.MUTED) {
        voice.speak(outputText);
      }

      return outputText;
    },
    (input, origin) => `${input}_${origin}`,
    50 // Cache last 50 requests
  ), [forcedMode, addLog]);

  // Set up voice command callback
  useEffect(() => {
    voice.setCommandCallback((text) => {
      if (text && typeof text === 'string' && text.trim().length > 0) {
        processKernelRequest(text, 'USER_VOICE');
      }
    });
  }, [processKernelRequest]);

  const handleForget = useCallback(async (id: string) => {
    await memory.forget(id);
    refreshSystemState();
  }, [refreshSystemState]);

  const handleClearLogs = useCallback(() => {
    logger.clear();
    updateLogs();
  }, [updateLogs]);

  const handleNavigate = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
  }, []);

  if (!isSystemReady) {
    return <BootSequence onComplete={() => setIsSystemReady(true)} />;
  }

  if (view === 'DEV') return <DevDashboard onClose={() => setView('DASHBOARD')} />;
  if (view === 'SETTINGS') return <SettingsInterface onClose={() => setView('DASHBOARD')} />;

  const isMainDashboard = activeTab === 'DASHBOARD';

  return (
    <div className="h-screen w-screen bg-[#050505] text-white p-4 md:p-6 flex flex-col gap-4 animate-fadeIn overflow-hidden">
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-cyan-900/20 pb-4 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter text-cyan-500">J.A.R.V.I.S.</h1>
          <p className="text-[10px] text-cyan-900 uppercase tracking-[0.3em] font-bold">Kernel v1.4 • Optimized</p>
        </div>

        <MemoizedSystemMonitor />

        <div className="flex items-center gap-4">
          <MemoizedNetworkControl forcedMode={forcedMode} onToggle={handleNetworkToggle} />
          
          <div className="flex gap-2 bg-black p-1 rounded border border-cyan-900/30">
            <button onClick={() => setActiveTab('DASHBOARD')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'DASHBOARD' ? 'bg-orange-900/40 text-orange-400' : 'text-gray-600'}`}><LayoutDashboard size={14} /></button>
            <button onClick={() => setActiveTab('ARCH')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'ARCH' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-600'}`}>KERNEL</button>
            <button onClick={() => setActiveTab('MEMORY')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'MEMORY' ? 'bg-purple-900/40 text-purple-400' : 'text-gray-600'}`}>MEMORY</button>
            <button onClick={() => setActiveTab('VISION')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'VISION' ? 'bg-red-900/40 text-red-400' : 'text-gray-600'}`}>VISION</button>
            <button onClick={() => setActiveTab('HEALTH')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'HEALTH' ? 'bg-pink-900/40 text-pink-400' : 'text-gray-600'}`}>HEALTH</button>
            <button onClick={() => setActiveTab('LOGS')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'LOGS' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-600'}`}>LOGS</button>
            <button onClick={() => setActiveTab('HOME_ASSISTANT')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'HOME_ASSISTANT' ? 'bg-green-900/40 text-green-400' : 'text-gray-600'}`}>HA</button>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setView('DEV')} className="p-2 text-yellow-500 border border-cyan-900/20 rounded bg-black hover:bg-yellow-900/10"><Bug size={18} /></button>
            <button onClick={() => setView('SETTINGS')} className="p-2 text-gray-500 border border-cyan-900/20 rounded bg-black hover:bg-gray-900"><SettingsIcon size={18} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden h-full">
          <div className="shrink-0">
            <MemoizedVoiceHUD state={voiceState} onToggle={() => voice.toggleMute()} />
          </div>
          <div className="flex-1 min-h-0">
            <MemoizedTerminal 
              logs={logs} 
              onCommand={(cmd) => processKernelRequest(cmd)} 
              isProcessing={state !== ProcessorState.IDLE} 
            />
          </div>
        </div>

        <div className="col-span-9 h-full min-h-0 overflow-hidden">
          {isMainDashboard ? (
            <MemoizedMainDashboard 
              processorState={state} 
              logs={logs} 
              onCommand={(cmd) => processKernelRequest(cmd)} 
              onClearLogs={handleClearLogs}
              onNavigate={handleNavigate}
            />
          ) : (
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-8 h-full">
                {activeTab === 'ARCH' && <ArchitectureDiagram state={state} activeModule={activeModule} provider={provider} />}
                {activeTab === 'MEMORY' && <MemoizedMemoryBank nodes={memories} onForget={handleForget} onManualSearch={(q) => memory.recall(q)} onMemoryUpdate={refreshSystemState} />}
                {activeTab === 'VISION' && <MemoizedVisionWindow state={visionState} />}
                {activeTab === 'HEALTH' && <HealthDashboard />}
                {activeTab === 'GRAPH' && <DependencyGraph />}
                {activeTab === 'HOME_ASSISTANT' && <HomeAssistantDashboard />}
                {activeTab === 'LOGS' && <MemoizedLogsDashboard />}
              </div>
              <div className="col-span-4 flex flex-col gap-4">
                <div className="flex-1 min-h-0">
                  <MemoizedPluginManager plugins={plugins} onToggle={(id) => registry.togglePlugin(id)} />
                </div>
                <div className="flex-1 min-h-0">
                  <MemoizedCircuitDashboard statuses={breakerStatuses} onTrip={(id) => engine.simulateFailure(id)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AppOptimized;
