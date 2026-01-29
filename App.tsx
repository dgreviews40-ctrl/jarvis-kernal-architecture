import React, { useState, useCallback, useEffect } from 'react';
import { Terminal } from './components/Terminal';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { CircuitDashboard } from './components/CircuitDashboard';
import { PluginManager } from './components/PluginManager';
import { MemoryBank } from './components/MemoryBank';
import { NetworkControl } from './components/NetworkControl';
import { VoiceHUD } from './components/VoiceHUD';
import { VisionWindow } from './components/VisionWindow';
import { SystemMonitor } from './components/SystemMonitor';
import { SettingsInterface } from './components/SettingsInterface';
import { BootSequence } from './components/BootSequence';
import { HealthDashboard } from './components/HealthDashboard';
import { DevDashboard } from './components/DevDashboard';
import { DependencyGraph } from './components/DependencyGraph';
import { MainDashboard } from './components/MainDashboard';
import { Settings as SettingsIcon, LayoutDashboard, Bug } from 'lucide-react';

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
import { memory } from './services/memory';
import { providerManager } from './services/providers';
import { voice } from './services/voice';
import { vision } from './services/vision';
import { hardware } from './services/hardware';
import { cortex } from './services/cortex';
import { graphService } from './services/graph';
import { haService } from './services/home_assistant';
import HomeAssistantDashboard from './components/HomeAssistantDashboard';

const generateId = () => Math.random().toString(36).substring(2, 11);

const App: React.FC = () => {
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [view, setView] = useState<'DASHBOARD' | 'SETTINGS' | 'DEV'>('DASHBOARD');
  const [state, setState] = useState<ProcessorState>(ProcessorState.IDLE);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH'>('DASHBOARD');
  
  const [breakerStatuses, setBreakerStatuses] = useState<BreakerStatus[]>([]);
  const [plugins, setPlugins] = useState<RuntimePlugin[]>([]);
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  
  // Default to GEMINI (Core Engine) as preference
  const [forcedMode, setForcedMode] = useState<AIProvider | null>(AIProvider.GEMINI);
  
  const [voiceState, setVoiceState] = useState<VoiceState>(VoiceState.MUTED);
  const [visionState, setVisionState] = useState<VisionState>(VisionState.OFF);

  const refreshSystemState = useCallback(() => {
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    setMemories(memory.getAll());
    setVoiceState(voice.getState());
    setVisionState(vision.getState());
    hardware.setProcessorState(state);
  }, [state]);

  // Initial system setup - runs once when system becomes ready
  useEffect(() => {
    if (!isSystemReady) return;

    providerManager.setForcedMode(forcedMode);
    graphService.rebuild();
    
    // Initial state refresh
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    setMemories(memory.getAll());
    setVoiceState(voice.getState());
    setVisionState(vision.getState());
    
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
            addLog('VOICE', 'Wake Word detected. Listening...', 'info');
        }
    });

    const unsubscribeVision = vision.subscribe((newState) => {
        setVisionState(newState);
        if (newState === VisionState.ACTIVE) {
            addLog('VISION', 'Optical sensors online.', 'success');
        }
    });

    addLog('SYSTEM', 'Kernel Boot Sequence Complete.', 'success');

    return () => {
        clearInterval(interval);
        unsubscribeRegistry();
        unsubscribeVoice();
        unsubscribeVision();
    };
  }, [isSystemReady]); // Removed refreshSystemState dependency to prevent re-running on state changes

  // Initialize Home Assistant once when component mounts
  useEffect(() => {
    let initTimeout: NodeJS.Timeout;

    const initializeHomeAssistant = async () => {
      const haUrl = localStorage.getItem('HA_URL');
      const haToken = localStorage.getItem('HA_TOKEN');

      if (haUrl && haToken && !haService.initialized) { // Only initialize if not already initialized
        try {
          // Add a delay to ensure proxy server is running
          initTimeout = setTimeout(async () => {
            haService.configure(haUrl, haToken);
            addLog('HOME_ASSISTANT', 'Configuration loaded. Initializing connection...', 'info');

            // First update the proxy server configuration
            try {
              const configResponse = await fetch('http://localhost:3101/config', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: haUrl, token: haToken })
              });

              if (!configResponse.ok) {
                throw new Error(`Failed to configure proxy: ${configResponse.status} ${configResponse.statusText}`);
              }

              addLog('HOME_ASSISTANT', 'Proxy server configured successfully', 'success');
            } catch (configError) {
              addLog('HOME_ASSISTANT', `Failed to configure proxy server: ${configError.message}`, 'error');
              return; // Don't proceed if proxy isn't configured
            }

            // Attempt to initialize the connection
            await haService.initialize();
            addLog('HOME_ASSISTANT', 'Connected to Home Assistant successfully!', 'success');
          }, 3000); // 3 second delay to ensure proxy is running
        } catch (error) {
          addLog('HOME_ASSISTANT', `Failed to configure Home Assistant: ${error.message}`, 'error');
        }
      } else if (haUrl && haToken && haService.initialized) {
        // Already initialized, just log the status
        addLog('HOME_ASSISTANT', 'Home Assistant already connected', 'info');
      }
    };

    initializeHomeAssistant();

    // Cleanup function to clear timeout if component unmounts
    return () => {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
    };
  }, []); // Empty dependency array means this runs once when component mounts
  
  // Sync hardware state separately when processor state changes
  useEffect(() => {
    if (isSystemReady) {
      hardware.setProcessorState(state);
    }
  }, [state, isSystemReady]);

  const addLog = (source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info', details?: any) => {
    setLogs(prev => [...prev, {
      id: generateId(),
      timestamp: new Date(),
      source,
      message,
      type,
      details
    }]);
  };

  const handleNetworkToggle = () => {
    const newMode = forcedMode === AIProvider.GEMINI ? AIProvider.OLLAMA : AIProvider.GEMINI;
    setForcedMode(newMode);
    providerManager.setForcedMode(newMode);
    addLog('SYSTEM', `Provider manually locked to: ${newMode === AIProvider.GEMINI ? 'CORE ENGINE (GEMINI)' : 'LOCAL OLLAMA'}`, 'warning');
  };

  const processKernelRequest = useCallback(async (input: string, origin: 'USER_TEXT' | 'USER_VOICE' = 'USER_TEXT') => {
    // Check if input is valid
    if (!input || typeof input !== 'string') {
      addLog('KERNEL', 'Invalid input received', 'error');
      return;
    }

    setState(ProcessorState.ANALYZING);
    setActiveModule('PARSER');
    addLog(origin === 'USER_VOICE' ? 'VOICE' : 'USER', input, 'info');
    
    await new Promise(r => setTimeout(r, 600));

    // Force analysis to use the current provider mode
    addLog('KERNEL', `Analyzing intent with ${forcedMode === AIProvider.GEMINI ? 'Core Engine' : 'Local Ollama'}...`, 'info');
    const analysis = await analyzeIntent(input);
    
    addLog('KERNEL', `Intent Identified: ${analysis.type}`, 'success', {
      entities: analysis.entities,
      provider: analysis.suggestedProvider
    });

    setActiveModule('SECURITY');
    await new Promise(r => setTimeout(r, 400));
    
    setState(ProcessorState.ROUTING);
    setActiveModule('ROUTER');
    
    // Respect Forced Mode
    let selectedProvider = forcedMode || (analysis.suggestedProvider === 'OLLAMA' ? AIProvider.OLLAMA : AIProvider.GEMINI);
    setProvider(selectedProvider);
    
    await new Promise(r => setTimeout(r, 400));

    setState(ProcessorState.EXECUTING);
    let outputText = "";
    
    try {
        if (analysis.type === IntentType.VISION_ANALYSIS) {
          setActiveModule('EXECUTION');
          setActiveTab('VISION'); 
          addLog('KERNEL', 'Initiating Visual Analysis Protocol...', 'info');

          if (vision.getState() !== VisionState.ACTIVE) {
              await vision.startCamera();
              await new Promise(r => setTimeout(r, 1000));
          }

          const imageBase64 = vision.captureFrame();
          if (imageBase64) {
              addLog('VISION', 'Frame captured. Transmitting...', 'success');
              const response = await providerManager.route({
                  prompt: input,
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
          // Extract keywords from the input for better memory recall
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
          // Normalize entities to ensure they are strings before joining
          const normalizedEntities = analysis.entities.map(entity =>
            typeof entity === 'string' ? entity
            : typeof entity === 'object' && entity.text ? entity.text
            : String(entity)
          );
          const contentToSave = normalizedEntities.join(' ') || input;
          await memory.store(contentToSave, 'FACT', ['user_input', 'auto_save']);
          outputText = "Sequence stored in Long-Term Memory.";
          setActiveTab('MEMORY');

        } else if (analysis.type === IntentType.QUERY) {
          // Check if this is actually a memory query despite being classified as a general query
          const lowerInput = input.toLowerCase();
          if (lowerInput.includes('location') || lowerInput.includes('where am i') || lowerInput.includes('my location') ||
              lowerInput.includes('current location') || lowerInput.includes('where are we')) {
            // Treat as memory read
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
              outputText = "Memory banks returned no relevant records about your location.";
            }
            setActiveTab('MEMORY');
          } else if (lowerInput.includes('home assistant') || lowerInput.includes('smart home') || lowerInput.includes('connected') || lowerInput.includes('integration')) {
            // Handle queries about Home Assistant integration
            if (haService.initialized) {
              const status = await haService.getStatus();
              outputText = `Yes, I have access to your Home Assistant. I can control ${status.entitiesCount} smart home devices.`;
              addLog('HOME_ASSISTANT', outputText, 'success');
            } else {
              outputText = "I have the Home Assistant integration available, but it's not currently connected. Please check your settings to configure the connection.";
              addLog('HOME_ASSISTANT', outputText, 'warning');
            }
          } else {
            // General Query
            const response = await providerManager.route({
                prompt: input,
                systemInstruction: "You are JARVIS. Be concise and helpful."
            }, selectedProvider);
            outputText = response.text;
            addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          }
        } else if (analysis.type === IntentType.COMMAND) {
          setActiveModule('EXECUTION');
          setActiveTab('ARCH');

          // Check if this is a Home Assistant command
          const lower = input.toLowerCase();
          const homeAssistantKeywords = ['light', 'lights', 'lamp', 'switch', 'lock', 'door', 'thermostat', 'temperature', 'climate', 'ac', 'heat', 'fan', 'cover', 'shade', 'garage', 'home assistant', 'smart', 'printer', '3d', 'outlet', 'plug', 'socket', 'power', 'turn on', 'turn off', 'toggle'];

          const isHomeAssistantCommand = homeAssistantKeywords.some(keyword =>
            lower.includes(keyword)
          );

          if (isHomeAssistantCommand && haService.initialized) {
            // Route to Home Assistant service
            try {
              // Normalize entities to ensure they are strings
              const paramsEntities = analysis.entities.length > 0
                ? analysis.entities.map(entity =>
                    typeof entity === 'string' ? entity
                    : typeof entity === 'object' && entity.text ? entity.text
                    : String(entity)
                  )
                : input.split(' ');

              const result = await haService.executeSmartCommand(paramsEntities);
              outputText = result;
              addLog('HOME_ASSISTANT', result, 'success');
            } catch (error) {
              const errorMessage = `Home Assistant command failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
              outputText = errorMessage;
              addLog('HOME_ASSISTANT', errorMessage, 'error');
            }
          } else {
            let requiredCapability = 'light_control';
            if (lower.includes('spotify') || lower.includes('play')) requiredCapability = 'music_playback';
            else if (lower.includes('lock') || lower.includes('door')) requiredCapability = 'lock_control';
            else if (lower.includes('thermostat') || lower.includes('temp')) requiredCapability = 'climate_control';
            else requiredCapability = 'system_diagnostics';

            const pluginId = registry.findProviderForCapability(requiredCapability);

            if (!pluginId) {
              outputText = `No active plugin handles capability: ${requiredCapability}`;
            } else {
              // Normalize entities to ensure they are strings
              const paramsEntities = analysis.entities.length > 0
                ? analysis.entities.map(entity =>
                    typeof entity === 'string' ? entity
                    : typeof entity === 'object' && entity.text ? entity.text
                    : String(entity)
                  )
                : input.split(' ');
              const result = await engine.executeAction({
                pluginId,
                method: 'EXECUTE_INTENT',
                params: { entities: paramsEntities }
              });
              outputText = result;
              addLog('PLUGIN', result, 'success');
            }
          }
          
        } else {
          // General Query
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
    }

    setState(ProcessorState.IDLE);
    setActiveModule(null);
    setProvider(null);

    if (voice.getState() !== VoiceState.MUTED) {
       voice.speak(outputText);
    }

  }, [refreshSystemState, forcedMode]);

  useEffect(() => {
    voice.setCommandCallback((text) => {
        // Ensure text is valid before processing
        if (text && typeof text === 'string' && text.trim().length > 0) {
            processKernelRequest(text, 'USER_VOICE');
        }
    });
  }, [processKernelRequest]);

  const handleForget = async (id: string) => {
    await memory.forget(id);
    refreshSystemState();
  };

  if (!isSystemReady) {
    return <BootSequence onComplete={() => setIsSystemReady(true)} />;
  }

  if (view === 'DEV') return <div className="h-screen w-screen"><DevDashboard /></div>;
  if (view === 'SETTINGS') return <div className="h-screen w-screen"><SettingsInterface onClose={() => setView('DASHBOARD')} /></div>;

  const isMainDashboard = activeTab === 'DASHBOARD';

  return (
    <div className="h-screen w-screen bg-[#050505] text-white p-4 md:p-6 flex flex-col gap-4 animate-fadeIn overflow-hidden">
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-cyan-900/20 pb-4 gap-4 shrink-0">
        <div>
           <h1 className="text-2xl font-bold font-mono tracking-tighter text-cyan-500">J.A.R.V.I.S.</h1>
           <p className="text-[10px] text-cyan-900 uppercase tracking-[0.3em] font-bold">Kernel v1.3 • Secure Environment</p>
        </div>

        <SystemMonitor />

        <div className="flex items-center gap-4">
           <NetworkControl forcedMode={forcedMode} onToggle={handleNetworkToggle} />
           
           <div className="flex gap-2 bg-black p-1 rounded border border-cyan-900/30">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'DASHBOARD' ? 'bg-orange-900/40 text-orange-400' : 'text-gray-600'}`}><LayoutDashboard size={14} /></button>
              <button onClick={() => setActiveTab('ARCH')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'ARCH' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-600'}`}>KERNEL</button>
              <button onClick={() => setActiveTab('MEMORY')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'MEMORY' ? 'bg-purple-900/40 text-purple-400' : 'text-gray-600'}`}>MEMORY</button>
              <button onClick={() => setActiveTab('VISION')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'VISION' ? 'bg-red-900/40 text-red-400' : 'text-gray-600'}`}>VISION</button>
              <button onClick={() => setActiveTab('HEALTH')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'HEALTH' ? 'bg-pink-900/40 text-pink-400' : 'text-gray-600'}`}>HEALTH</button>
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
           <div className="shrink-0"><VoiceHUD state={voiceState} onToggle={() => voice.toggleMute()} /></div>
           <div className="flex-1 min-h-0"><Terminal logs={logs} onCommand={(cmd) => processKernelRequest(cmd)} isProcessing={state !== ProcessorState.IDLE} /></div>
        </div>

        <div className="col-span-9 h-full min-h-0 overflow-hidden">
             {isMainDashboard ? (
                 <MainDashboard processorState={state} logs={logs} onCommand={(cmd) => processKernelRequest(cmd)} onClearLogs={() => setLogs([])} onNavigate={setActiveTab} />
             ) : (
                <div className="grid grid-cols-12 gap-4 h-full">
                    <div className="col-span-8 h-full">
                        {activeTab === 'ARCH' && <ArchitectureDiagram state={state} activeModule={activeModule} provider={provider} />}
                        {activeTab === 'MEMORY' && <MemoryBank nodes={memories} onForget={handleForget} onManualSearch={(q) => memory.recall(q)} />}
                        {activeTab === 'VISION' && <VisionWindow state={visionState} />}
                        {activeTab === 'HEALTH' && <HealthDashboard />}
                        {activeTab === 'GRAPH' && <DependencyGraph />}
                        {activeTab === 'HOME_ASSISTANT' && <HomeAssistantDashboard />}
                    </div>
                    <div className="col-span-4 flex flex-col gap-4">
                        <div className="flex-1 min-h-0"><PluginManager plugins={plugins} onToggle={(id) => registry.togglePlugin(id)} /></div>
                        <div className="flex-1 min-h-0"><CircuitDashboard statuses={breakerStatuses} onTrip={(id) => engine.simulateFailure(id)} /></div>
                    </div>
                </div>
             )}
        </div>
      </main>
    </div>
  );
};

export default App;