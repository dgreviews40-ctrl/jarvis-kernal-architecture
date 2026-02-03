/**
 * Ultra-Optimized App Component
 * Combines all performance optimizations for maximum efficiency
 */

import React, { 
  useState, useCallback, useEffect, useRef, 
  Suspense, lazy, memo, useMemo 
} from 'react';
import { Terminal } from './components/Terminal';
import { VirtualLogList } from './components/VirtualList';
import { BootSequence } from './components/BootSequence';
import { SystemMonitor } from './components/SystemMonitor';
import { NetworkControl } from './components/NetworkControl';
import { VoiceHUD } from './components/VoiceHUD';
import { PluginManager } from './components/PluginManager';
import { CircuitDashboard } from './components/CircuitDashboard';
import { 
  ProcessorState, LogEntry, AIProvider, IntentType, 
  KernelAction, BreakerStatus, RuntimePlugin, MemoryNode, 
  VoiceState, VisionState 
} from './types';
import { logger } from './services/logger';
import { analyzeIntent } from './services/gemini';
import { engine } from './services/execution';
import { registry } from './services/registry';
import { memoryOptimized as memory } from './services/memoryOptimized';
import { providerManager } from './services/providers';
import { voiceOptimized as voice } from './services/voiceOptimized';
import { vision } from './services/vision';
import { hardware } from './services/hardware';
import { graphService } from './services/graph';
import { haService } from './services/home_assistant';
import { conversation } from './services/conversation';
import { learningService } from './services/learning';
import { searchEntities, generateEntityResponse, isHomeAssistantQuery } from './services/haEntitySearch';
import { requestDeduplication } from './services/requestDeduplication';
import { prefetchService } from './services/prefetch';
import { resourceLoader } from './services/resourceLoader';
import { batchedHA } from './services/haBatched';
import { connectionPool } from './services/connectionPool';

// Lazy load heavy components
const ArchitectureDiagram = lazy(() => import('./components/ArchitectureDiagram'));
const MemoryBank = lazy(() => import('./components/MemoryBank'));
const VisionWindow = lazy(() => import('./components/VisionWindow'));
const HealthDashboard = lazy(() => import('./components/HealthDashboard'));
const DevDashboard = lazy(() => import('./components/DevDashboard'));
const DependencyGraph = lazy(() => import('./components/DependencyGraph'));
const MainDashboard = lazy(() => import('./components/MainDashboard'));
const LogsDashboard = lazy(() => import('./components/LogsDashboard'));
const HomeAssistantDashboard = lazy(() => import('./components/HomeAssistantDashboard'));
const SettingsInterface = lazy(() => import('./components/SettingsInterface'));

// Optimized lazy loading with prefetch
const lazyWithPrefetch = (importFn: () => Promise<any>, prefetchId: string) => {
  const LazyComponent = lazy(importFn);
  
  // Register for prefetching
  prefetchService.recordAction(prefetchId);
  
  return LazyComponent;
};

// Memoized sub-components to prevent unnecessary re-renders
const MemoizedTerminal = memo(Terminal);
const MemoizedSystemMonitor = memo(SystemMonitor);
const MemoizedNetworkControl = memo(NetworkControl);
const MemoizedVoiceHUD = memo(VoiceHUD);
const MemoizedPluginManager = memo(PluginManager);
const MemoizedCircuitDashboard = memo(CircuitDashboard);

// Loading fallback
const ComponentLoader = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-cyan-500 animate-pulse">Loading...</div>
  </div>
);

const AppUltraOptimized: React.FC = () => {
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [view, setView] = useState<'DASHBOARD' | 'SETTINGS' | 'DEV'>('DASHBOARD');
  const [state, setState] = useState<ProcessorState>(ProcessorState.IDLE);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(logger.getRecent(100));
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'LOGS' | 'HOME_ASSISTANT'>('DASHBOARD');
  
  const [breakerStatuses, setBreakerStatuses] = useState<BreakerStatus[]>([]);
  const [plugins, setPlugins] = useState<RuntimePlugin[]>([]);
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  
  const [forcedMode, setForcedMode] = useState<AIProvider | null>(AIProvider.GEMINI);
  const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.MUTED);
  const [visionState, setVisionState] = useState<VisionState>(VisionState.OFF);

  // Debouncing refs
  const lastRequestTime = useRef<number>(0);
  const lastRequestText = useRef<string>('');
  const isProcessing = useRef<boolean>(false);
  const DEBOUNCE_MS = 500;
  
  // Log update batching
  const logUpdateTimeout = useRef<number | null>(null);
  const pendingLogs = useRef<LogEntry[]>([]);

  // Optimized state refresh with memoization
  const refreshSystemState = useCallback(() => {
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    setMemories(memory.getAll());
    setVoiceState(voice.getState());
    setVisionState(vision.getState());
    hardware.setProcessorState(state);
  }, [state]);

  // Batched log updates
  const batchLogUpdate = useCallback((newLogs: LogEntry[]) => {
    pendingLogs.current = newLogs;
    
    if (logUpdateTimeout.current) {
      clearTimeout(logUpdateTimeout.current);
    }
    
    logUpdateTimeout.current = window.setTimeout(() => {
      setLogs(pendingLogs.current);
      pendingLogs.current = [];
    }, 50); // 50ms batching window
  }, []);

  // Optimized addLog with batching
  const addLog = useCallback((
    source: LogEntry['source'], 
    message: string, 
    type: LogEntry['type'] = 'info', 
    details?: Record<string, unknown>
  ) => {
    logger.log(source, message, type, details);
    batchLogUpdate(logger.getRecent(100));
  }, [batchLogUpdate]);

  // System initialization
  useEffect(() => {
    if (!isSystemReady) return;

    providerManager.setForcedMode(forcedMode);
    graphService.rebuild();

    // Initial state
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    setMemories(memory.getAll());
    setVoiceState(voice.getState());
    setVisionState(vision.getState());

    // Optimized interval - use 2s instead of 1s for breaker status
    const interval = setInterval(() => {
      setBreakerStatuses(engine.getAllStatus());
    }, 2000);

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
        addLog('VOICE', 'Wake Word detected. Listening...', 'info');
      }
    });

    const unsubscribeVision = vision.subscribe((newState) => {
      setVisionState(newState);
      if (newState === VisionState.ACTIVE) {
        addLog('VISION', 'Optical sensors online.', 'success');
      }
    });

    addLog('SYSTEM', 'Ultra-Optimized Kernel Boot Complete.', 'success');

    // Prefetch likely next components
    prefetchService.recordAction('boot_complete');

    return () => {
      clearInterval(interval);
      unsubscribeRegistry();
      unsubscribeVoice();
      unsubscribeVision();
      if (logUpdateTimeout.current) {
        clearTimeout(logUpdateTimeout.current);
      }
    };
  }, [isSystemReady, forcedMode, addLog]);

  // Optimized HA initialization with deduplication
  useEffect(() => {
    const initKey = 'ha_init';
    
    requestDeduplication.execute(initKey, async () => {
      const haUrl = localStorage.getItem('HA_URL');
      const haToken = localStorage.getItem('HA_TOKEN');

      if (haUrl && haToken && !haService.initialized) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        batchedHA.configure(haToken);
        
        try {
          await fetch('http://localhost:3101/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: haUrl, token: haToken })
          });
          
          await haService.initialize();
          addLog('HOME_ASSISTANT', 'Connected successfully!', 'success');
        } catch (error: any) {
          addLog('HOME_ASSISTANT', `Connection failed: ${error.message}`, 'error');
        }
      }
    });
  }, [addLog]);

  const handleNetworkToggle = useCallback(() => {
    const newMode = forcedMode === AIProvider.GEMINI ? AIProvider.OLLAMA : AIProvider.GEMINI;
    setForcedMode(newMode);
    providerManager.setForcedMode(newMode);
    addLog('SYSTEM', `Provider locked to: ${newMode === AIProvider.GEMINI ? 'CORE ENGINE' : 'LOCAL OLLAMA'}`, 'warning');
  }, [forcedMode, addLog]);

  // Ultra-optimized request processor with full deduplication
  const processKernelRequest = useCallback(async (
    input: string, 
    origin: 'USER_TEXT' | 'USER_VOICE' = 'USER_TEXT'
  ) => {
    if (!input || typeof input !== 'string') {
      addLog('KERNEL', 'Invalid input', 'error');
      return;
    }

    const now = Date.now();
    const trimmedInput = input.trim().toLowerCase();
    const requestKey = `req_${trimmedInput}`;
    
    // Check processing lock
    if (isProcessing.current) {
      addLog('KERNEL', 'Request blocked - already processing', 'warning');
      return;
    }
    
    // Deduplication check
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

    try {
      // Use deduplication for intent analysis
      const analysis = await requestDeduplication.execute(
        `intent_${trimmedInput}`,
        () => analyzeIntent(input),
        { ttl: 30000 } // Cache for 30 seconds
      );

      addLog('KERNEL', `Intent: ${analysis.type}`, 'success', {
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

      // Handle different intent types with optimized paths
      switch (analysis.type) {
        case IntentType.VISION_ANALYSIS: {
          setActiveModule('EXECUTION');
          setActiveTab('VISION');
          
          if (vision.getState() !== VisionState.ACTIVE) {
            await vision.startCamera();
            await new Promise(r => setTimeout(r, 300));
          }

          const imageBase64 = vision.captureFrame();
          if (imageBase64) {
            const response = await providerManager.route({
              prompt: input,
              images: [imageBase64],
              systemInstruction: "You are JARVIS. Analyze the visual input concisely.",
            }, selectedProvider);
            outputText = response.text;
            addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          } else {
            outputText = "Optical sensors failed to capture frame.";
          }
          break;
        }

        case IntentType.MEMORY_READ: {
          setActiveModule('MEMORY');
          const results = await memory.recall(input);
          
          if (results.length > 0) {
            const topResult = results[0];
            const synthesis = await providerManager.route({
              prompt: `Use ONLY this context: ${topResult.node.content}\n\nQuestion: ${input}\n\nAnswer:`,
            }, selectedProvider);
            outputText = synthesis.text;
            addLog(synthesis.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          } else {
            outputText = "No relevant memories found.";
          }
          setActiveTab('MEMORY');
          break;
        }

        case IntentType.MEMORY_WRITE: {
          setActiveModule('MEMORY');
          const contentToSave = analysis.entities.join(' ') || input;
          await memory.store(contentToSave, 'FACT', ['user_input']);
          outputText = "Stored in Long-Term Memory.";
          setActiveTab('MEMORY');
          break;
        }

        case IntentType.COMMAND: {
          setActiveModule('EXECUTION');
          setActiveTab('ARCH');

          // Check for HA command
          const lower = input.toLowerCase();
          const haKeywords = ['light', 'switch', 'lock', 'thermostat', 'fan'];
          
          if (haKeywords.some(k => lower.includes(k)) && haService.initialized) {
            try {
              const result = await batchedHA.callService(
                analysis.entities[0] || 'light.living_room',
                lower.includes('on') ? 'turn_on' : 'turn_off'
              );
              outputText = `Command executed: ${result}`;
            } catch (error: any) {
              outputText = `Command failed: ${error.message}`;
            }
          } else {
            outputText = `Command received: ${input}`;
          }
          break;
        }

        default: {
          // General query with context awareness
          const useContext = conversation.detectsContextReference(input);
          let prompt = input;
          
          if (useContext) {
            const recentContext = conversation.getRecentContext();
            if (recentContext) {
              prompt = `Context:\n${recentContext}\n\nQuery: ${input}`;
            }
          }
          
          const response = await providerManager.route({
            prompt,
            systemInstruction: "You are JARVIS. Be concise and helpful."
          }, selectedProvider);
          
          outputText = response.text;
          addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
        }
      }

      // Track conversation
      conversation.addTurn('USER', input);
      if (outputText) {
        conversation.addTurn('JARVIS', outputText);
      }

      // Speak response
      if (voice.getState() !== VoiceState.MUTED) {
        voice.speak(outputText);
      }

    } catch (error: any) {
      addLog('KERNEL', `ERROR: ${error.message}`, 'error');
    } finally {
      isProcessing.current = false;
      setState(ProcessorState.IDLE);
      setActiveModule(null);
      setProvider(null);
    }
  }, [addLog, forcedMode]);

  // Voice command handler
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

  // Memoized tab content to prevent re-renders
  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'ARCH':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <ArchitectureDiagram state={state} activeModule={activeModule} provider={provider} />
          </Suspense>
        );
      case 'MEMORY':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <MemoryBank 
              nodes={memories} 
              onForget={handleForget} 
              onManualSearch={(q) => memory.recall(q)} 
              onMemoryUpdate={refreshSystemState} 
            />
          </Suspense>
        );
      case 'VISION':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <VisionWindow state={visionState} />
          </Suspense>
        );
      case 'HEALTH':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <HealthDashboard />
          </Suspense>
        );
      case 'GRAPH':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <DependencyGraph />
          </Suspense>
        );
      case 'HOME_ASSISTANT':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <HomeAssistantDashboard />
          </Suspense>
        );
      case 'LOGS':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <LogsDashboard />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<ComponentLoader />}>
            <MainDashboard 
              processorState={state} 
              logs={logs} 
              onCommand={processKernelRequest} 
              onClearLogs={() => setLogs([])} 
              onNavigate={setActiveTab} 
            />
          </Suspense>
        );
    }
  }, [activeTab, state, activeModule, provider, memories, visionState, logs, handleForget, refreshSystemState, processKernelRequest]);

  if (!isSystemReady) {
    return <BootSequence onComplete={() => setIsSystemReady(true)} />;
  }

  if (view === 'DEV') {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <div className="h-screen w-screen">
          <DevDashboard onClose={() => setView('DASHBOARD')} />
        </div>
      </Suspense>
    );
  }

  if (view === 'SETTINGS') {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <div className="h-screen w-screen">
          <SettingsInterface onClose={() => setView('DASHBOARD')} />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#050505] text-white p-4 md:p-6 flex flex-col gap-4 animate-fadeIn overflow-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-cyan-900/20 pb-4 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tighter text-cyan-500">J.A.R.V.I.S.</h1>
          <p className="text-[10px] text-cyan-900 uppercase tracking-[0.3em] font-bold">Ultra-Optimized Kernel v2.0</p>
        </div>

        <MemoizedSystemMonitor />

        <div className="flex items-center gap-4">
          <MemoizedNetworkControl forcedMode={forcedMode} onToggle={handleNetworkToggle} />
          
          <div className="flex gap-2 bg-black p-1 rounded border border-cyan-900/30">
            {(['DASHBOARD', 'ARCH', 'MEMORY', 'VISION', 'HEALTH', 'LOGS', 'HOME_ASSISTANT'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                  activeTab === tab ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {tab === 'HOME_ASSISTANT' ? 'HA' : tab}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setView('DEV')} 
              className="p-2 text-yellow-500 border border-cyan-900/20 rounded bg-black hover:bg-yellow-900/10"
            >
              DEV
            </button>
            <button 
              onClick={() => setView('SETTINGS')} 
              className="p-2 text-gray-500 border border-cyan-900/20 rounded bg-black hover:bg-gray-900"
            >
              SETTINGS
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
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

        {/* Main Panel */}
        <div className="col-span-9 h-full min-h-0 overflow-hidden">
          {activeTab === 'DASHBOARD' ? (
            tabContent
          ) : (
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-8 h-full">
                {tabContent}
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

export default AppUltraOptimized;
