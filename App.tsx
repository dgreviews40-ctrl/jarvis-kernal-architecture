import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { Terminal } from './components/Terminal';
import { CircuitDashboard } from './components/CircuitDashboard';
import { PluginManager } from './components/PluginManager';
import { MemoryBank } from './components/MemoryBank';
import { NetworkControl } from './components/NetworkControl';
import { VoiceHUD } from './components/VoiceHUD';
import { SystemMonitor } from './components/SystemMonitor';
import { BootSequence } from './components/BootSequence';
import { MainDashboard } from './components/MainDashboard';
import { NotificationSystem } from './components/NotificationSystem';
import { Settings as SettingsIcon, LayoutDashboard, Bug, Terminal as TerminalIcon, Zap, Activity, Sparkles, Bell } from 'lucide-react';
import { logger } from './services/logger';
import { TIMING, LIMITS } from './constants/config';

// Lazy loaded components - these will be split into separate chunks
const ArchitectureDiagram = lazy(() => import('./components/ArchitectureDiagram'));
const VisionWindow = lazy(() => import('./components/VisionWindow'));
const SettingsInterface = lazy(() => import('./components/SettingsInterface'));
const HealthDashboard = lazy(() => import('./components/HealthDashboard'));
const DevDashboard = lazy(() => import('./components/DevDashboard'));
const DependencyGraph = lazy(() => import('./components/DependencyGraph'));
const LogsDashboard = lazy(() => import('./components/LogsDashboard'));
const IntegrationsDashboard = lazy(() => import('./components/IntegrationsDashboard'));
const HomeAssistantDashboard = lazy(() => import('./components/HomeAssistantDashboard'));
const PerformanceDashboard = lazy(() => import('./components/PerformanceDashboard'));
const PluginMarketplace = lazy(() => import('./components/PluginMarketplace'));
const WeatherDashboard = lazy(() => import('./components/WeatherDashboard'));

import { 
  ProcessorState, 
  AIProvider, 
  BreakerStatus, 
  RuntimePlugin, 
  MemoryNode, 
  VoiceState, 
  VisionState,
  IntentType
} from './types';
import { engine } from './services/execution';
import { registry } from './services/registry';
import { memory } from './services/memory';
import { providerManager } from './services/providers';
import { voice } from './services/voice';
import { vision } from './services/vision';
import { hardware } from './services/hardware';
import { graphService } from './services/graph';
import { haService } from './services/home_assistant';
import { conversationFlow, intelligence } from './services/intelligence';
import { inputValidator } from './services/inputValidator';
import { conversation } from './services/conversation';
import { learningService } from './services/learning';
import { analyzeIntent } from './services/gemini';
import { isHomeAssistantQuery, searchEntities, generateEntityResponse } from './services/haEntitySearch';

// Zustand Stores
import { useUIStore, useKernelStore, useMemoryStore } from './stores';
import { performanceMonitor } from './services/performanceMonitor';
import { initializeBuiltInPlugins } from './plugins/registry';
import { BUILTIN_PLUGIN_MANIFESTS } from './plugins/marketplace';
import { ToastNotifications } from './components/ToastNotifications';
import { NotificationCenter } from './components/NotificationCenter';
import { notificationService } from './services/notificationService';

// Test Suite
import { systemTests } from './tests/systemTest';



// Hook to track component mount status
const useIsMounted = () => {
  const isMountedRef = React.useRef(true);
  const getterRef = React.useRef(() => isMountedRef.current);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return getterRef.current;
};

// Notification Bell Component
const NotificationBell: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCenter, setShowCenter] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setUnreadCount(notificationService.getUnreadCount());
    };
    
    updateCount();
    const unsubscribe = notificationService.subscribe(updateCount);
    return unsubscribe;
  }, []);

  return (
    <>
      <button
        onClick={() => setShowCenter(true)}
        className="relative p-2 text-gray-400 border border-cyan-900/20 rounded bg-black hover:bg-gray-900 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationCenter isOpen={showCenter} onClose={() => setShowCenter(false)} />
    </>
  );
};

const App: React.FC = () => {
  // Zustand Stores
  const { 
    mainView: view, 
    setMainView: setView, 
    activeTab, 
    setActiveTab,
    isSystemReady, 
    setSystemReady 
  } = useUIStore();
  
  const {
    processorState: state,
    setProcessorState: setState,
    activeModule,
    setActiveModule,
    provider,
    setProvider,
    forcedMode,
    setForcedMode,
    breakerStatuses,
    setBreakerStatuses,
    plugins,
    setPlugins,
    voiceState,
    setVoiceState,
    visionState,
    setVisionState,
  } = useKernelStore();
  
  const {
    nodes: memories,
    setNodes: setMemories,
  } = useMemoryStore();

  // Local state (not yet migrated)

  // Debouncing refs for request processing
  const lastRequestTime = useRef<number>(0);
  const lastRequestText = useRef<string>('');
  const isProcessing = useRef<boolean>(false);
  const DEBOUNCE_MS = TIMING.DEBOUNCE_MS; // Use centralized config
  
  // Track last logged voice state to prevent duplicate logs
  const lastLoggedVoiceState = useRef<VoiceState | null>(null);

  const refreshSystemState = useCallback(async () => {
    setBreakerStatuses(engine.getAllStatus());
    setPlugins(registry.getAll());
    const memories = await memory.getAll();
    setMemories(memories);
    setVoiceState(voice.getState());
    setVisionState(vision.getState());
    hardware.setProcessorState(state);
  }, [state, setBreakerStatuses, setPlugins, setMemories, setVoiceState, setVisionState]);

  // Initial system setup - runs once when system becomes ready
  useEffect(() => {
    if (!isSystemReady) return;

    // Initialize performance monitoring
    performanceMonitor.init();

    // Initialize built-in plugins in the v2 plugin registry
    // This ensures the marketplace shows them as installed
    initializeBuiltInPlugins(BUILTIN_PLUGIN_MANIFESTS);

    providerManager.setForcedMode(forcedMode);
    graphService.rebuild();

    // Initial state refresh
    const initState = async () => {
      setBreakerStatuses(engine.getAllStatus());
      setPlugins(registry.getAll());
      const memories = await memory.getAll();
      setMemories(memories);
      setVoiceState(voice.getState());
      setVisionState(vision.getState());
    };
    initState();

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
        // Get current state from store for comparison
        const currentState = useKernelStore.getState().voiceState;

        // Prevent duplicate logs for the same state transition
        const shouldLog = lastLoggedVoiceState.current !== newState;

        if (newState === VoiceState.LISTENING && shouldLog) {
            lastLoggedVoiceState.current = newState;
            addLog('VOICE', 'Wake Word detected. Listening...', 'info');

            // Handle interruption if JARVIS was speaking
            if (currentState === VoiceState.SPEAKING) {
              const interruptResult = conversationFlow.handleInterruption();
              const naturalAck = intelligence.handleInterruption();
              addLog('INTELLIGENCE', 'Voice interruption handled gracefully', 'info');

              // Store context for potential resume
              voice.setContext('interrupted_response', interruptResult.resumePoint);
            }
        } else if (newState === VoiceState.IDLE && currentState === VoiceState.INTERRUPTED) {
          // Check if we should resume after interruption
          const resume = conversationFlow.resumeAfterInterruption();
          if (resume.shouldResume && resume.context) {
            addLog('INTELLIGENCE', 'Resuming after interruption', 'info');
            voice.speak(`${resume.resumeMessage} ${resume.context}`);
          }
        }

        // Update the store with new state
        setVoiceState(newState);
    });

    const unsubscribeVision = vision.subscribe((newState) => {
        setVisionState(newState);
        if (newState === VisionState.ACTIVE) {
            addLog('VISION', 'Optical sensors online.', 'success');
        }
    });

    addLog('SYSTEM', 'Kernel Boot Sequence Complete.', 'success');

    // Expose test runner globally
    (window as any).runJarvisTests = () => systemTests.runAll();

    // Run quick health check after boot
    setTimeout(() => {
      systemTests.runAll().then(results => {
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        addLog('SYSTEM', `Health check complete: ${passed}/${total} tests passed`, passed === total ? 'success' : 'warning');
      });
    }, 2000);

    return () => {
        clearInterval(interval);
        unsubscribeRegistry();
        unsubscribeVoice();
        unsubscribeVision();

        // Clean up voice service resources
        try {
          // Since cleanup is private, we'll just ensure the service is properly shut down
          voice.setPower(false); // Turn off voice service
        } catch (e) {
          console.warn('Error cleaning up voice service:', e);
        }
    };
  }, [isSystemReady, forcedMode]); // Added forcedMode to dependency array

  // Initialize Home Assistant once when component mounts
  useEffect(() => {
    let initTimeout: NodeJS.Timeout;

    const initializeHomeAssistant = async () => {
      const haUrl = localStorage.getItem('HA_URL');
      const haToken = localStorage.getItem('HA_TOKEN');

      if (haUrl && haToken && !haService.initialized) { // Only initialize if not already initialized
        try {
          // Check proxy server health first
          try {
            const healthResponse = await fetch('http://localhost:3101/health', {
              method: 'GET',
              signal: AbortSignal.timeout(2000) // 2 second timeout
            });

            if (!healthResponse.ok) {
              throw new Error('Proxy server is not responding');
            }

            addLog('HOME_ASSISTANT', 'Proxy server health check passed', 'success');
          } catch (healthError) {
            addLog('HOME_ASSISTANT', `Proxy server health check failed: ${healthError.message}`, 'error');
            return; // Don't proceed if proxy isn't healthy
          }

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
          }, 2000); // Reduced delay since we already verified proxy health
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
  }, []); // Empty dependency array - initTimeout is local, not from closure
  
  // Sync hardware state separately when processor state changes
  useEffect(() => {
    if (isSystemReady) {
      hardware.setProcessorState(state);
    }
  }, [state, isSystemReady]);

  const addLog = (source: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', details?: Record<string, unknown>) => {
    logger.log(source as any, message, type, details);
  };

  const handleNetworkToggle = () => {
    const newMode = forcedMode === AIProvider.GEMINI ? AIProvider.OLLAMA : AIProvider.GEMINI;
    setForcedMode(newMode);
    providerManager.setForcedMode(newMode);
    addLog('SYSTEM', `Provider manually locked to: ${newMode === AIProvider.GEMINI ? 'CORE ENGINE (GEMINI)' : 'LOCAL OLLAMA'}`, 'warning');
  };

  const processKernelRequest = useCallback(async (input: string, origin: 'USER_TEXT' | 'USER_VOICE' = 'USER_TEXT') => {
    // === INPUT VALIDATION ===
    if (!input || typeof input !== 'string') {
      addLog('KERNEL', 'Invalid input received', 'error');
      return;
    }

    // Sanitize and validate input
    const validation = inputValidator.validate(input, {
      maxLength: LIMITS.MAX_INPUT_LENGTH,
      strictMode: false,
      context: 'user_input'
    });

    if (!validation.valid) {
      addLog('KERNEL', `Input validation failed: ${validation.error}`, 'error');
      
      // Provide user feedback
      const errorResponse = validation.error?.includes('injection') 
        ? "I've detected potentially harmful content in your request. Please rephrase."
        : "Your input couldn't be processed. Please try again with different wording.";
      
      if (voice.getState() !== VoiceState.MUTED) {
        voice.speak(errorResponse);
      }
      
      return;
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      addLog('KERNEL', `Input warnings: ${validation.warnings.join(', ')}`, 'warning');
    }

    // Use sanitized input
    const sanitizedInput = validation.sanitized;
    const now = Date.now();
    const trimmedInput = sanitizedInput.trim().toLowerCase();
    
    // Debounce: Block duplicate/rapid requests
    if (isProcessing.current) {
      addLog('KERNEL', 'Request blocked - already processing', 'warning');
      return;
    }
    
    // Block identical requests within debounce window
    if (trimmedInput === lastRequestText.current && (now - lastRequestTime.current) < DEBOUNCE_MS) {
      addLog('KERNEL', 'Duplicate request ignored', 'warning');
      return;
    }
    
    // Update debounce tracking
    lastRequestTime.current = now;
    lastRequestText.current = trimmedInput;
    isProcessing.current = true;

    setState(ProcessorState.ANALYZING);
    setActiveModule('PARSER');
    addLog(origin === 'USER_VOICE' ? 'VOICE' : 'USER', input, 'info');

    // === INTELLIGENCE SYSTEM: Process through enhanced context ===
    let intelligenceResult;
    try {
      const session = conversation.getSession();
      intelligenceResult = await intelligence.process({
        userInput: input,
        conversationHistory: session?.turns || [],
        userId: 'current_user',
        timestamp: now,
        metadata: { origin, voiceState: voice.getState() }
      });
      
      addLog('INTELLIGENCE', `Context enriched: ${intelligenceResult.responseModifiers.tone} tone, ${intelligenceResult.proactiveSuggestions.length} proactive suggestions`, 'info');
    } catch (e) {
      addLog('INTELLIGENCE', `Context processing failed: ${e.message}, falling back to basic mode`, 'warning');
      intelligenceResult = null;
    }

    // Check if this is a correction of previous response
    if (learningService.isCorrection(input)) {
      addLog('KERNEL', 'Correction detected - learning from feedback', 'info');
      const learnedFact = await learningService.processCorrection(input);
      if (learnedFact) {
        addLog('MEMORY', `Learned: ${learnedFact}`, 'success');
      }
    }

    // Check for implicit preferences in input
    const learnedPreference = await learningService.detectAndLearnPreference(input);
    if (learnedPreference) {
      addLog('MEMORY', `Noted preference: ${learnedPreference.content}`, 'info');
    }

    // Check if similar query was corrected before
    const relevantCorrection = learningService.findRelevantCorrection(input);

    // Analyze intent immediately - no artificial delay
    addLog('KERNEL', `Analyzing intent with ${forcedMode === AIProvider.GEMINI ? 'Core Engine' : 'Local Ollama'}...`, 'info');
    const analysis = await analyzeIntent(input);

    addLog('KERNEL', `Intent Identified: ${analysis.type}`, 'success', {
      entities: analysis.entities,
      provider: analysis.suggestedProvider
    });

    setActiveModule('SECURITY');
    setState(ProcessorState.ROUTING);
    setActiveModule('ROUTER');

    // Respect Forced Mode
    let selectedProvider = forcedMode || (analysis.suggestedProvider === 'OLLAMA' ? AIProvider.OLLAMA : AIProvider.GEMINI);
    setProvider(selectedProvider);

    setState(ProcessorState.EXECUTING);
    let outputText = "";
    
    // If we have a relevant correction, include it in context
    let correctionContext = '';
    if (relevantCorrection) {
      correctionContext = `\n\nIMPORTANT: A similar query was previously corrected. The user indicated: "${relevantCorrection.correctionText}". Please take this into account.`;
    }
    
    try {
        if (analysis.type === IntentType.VISION_ANALYSIS) {
          setActiveModule('EXECUTION');
          setActiveTab('VISION'); 
          addLog('KERNEL', 'Initiating Visual Analysis Protocol...', 'info');

          if (vision.getState() !== VisionState.ACTIVE) {
              await vision.startCamera();
              // Brief delay for camera to initialize - only when camera wasn't already active
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
          
          // Check if this is actually a Home Assistant sensor query misclassified as memory
          const lowerInput = input.toLowerCase();
          if ((lowerInput.includes('solar') || lowerInput.includes('energy') || lowerInput.includes('power') || 
               lowerInput.includes('temperature') || lowerInput.includes('humidity') || lowerInput.includes('weather')) && 
               haService.initialized) {
            // Redirect to Home Assistant sensor query with smart filtering
            try {
              await haService.fetchEntities();
              const sensors = Array.from((haService as any).entities.values())
                .map((e: any) => {
                  const name = (e.attributes?.friendly_name || e.entity_id).toLowerCase();
                  const entityId = e.entity_id.toLowerCase();
                  let score = 0;
                  
                  // STRICT: Check if forecast - exclude if user wants actual
                  const isForecast = name.includes('forecast') || entityId.includes('forecast') ||
                                     name.includes('prediction') || entityId.includes('prediction') ||
                                     name.includes('estimated') || entityId.includes('estimated');
                  
                  if ((lowerInput.includes('actual') || lowerInput.includes('real')) && isForecast) {
                    return null;
                  }
                  
                  // Score based on query type
                  if (lowerInput.includes('solar') && (name.includes('solar') || entityId.includes('solar'))) score += 10;
                  if (lowerInput.includes('energy') && (name.includes('energy') || entityId.includes('energy'))) score += 8;
                  if (lowerInput.includes('power') && (name.includes('power') || entityId.includes('power'))) score += 5;
                  if (lowerInput.includes('temperature') && (name.includes('temp') || entityId.includes('temp'))) score += 10;
                  if (lowerInput.includes('humidity') && (name.includes('humid') || entityId.includes('humid'))) score += 10;
                  if (lowerInput.includes('weather') && (name.includes('weather') || entityId.includes('weather'))) score += 10;
                  
                  // Boost actual, penalize forecast
                  if (name.includes('actual') || name.includes('real') || name.includes('meter') || name.includes('monitor')) score += 5;
                  if (isForecast) score -= 10;
                  if (name.includes('tomorrow') || name.includes('next')) score -= 8;
                  
                  // Penalize individual devices
                  const deviceNames = ['server', 'printer', 'lamp', 'light', 'fan', 'pc', 'computer', 'monitor'];
                  if (deviceNames.some(d => name.includes(d) || entityId.includes(d))) score -= 5;
                  
                  return score > 0 ? { ...e, score } : null;
                })
                .filter(Boolean)
                .sort((a: any, b: any) => b.score - a.score)
                .slice(0, 5);
              
              if (sensors.length > 0) {
                const sensorInfo = sensors.map((s: any) => {
                  const name = s.attributes?.friendly_name || s.entity_id;
                  const value = s.state;
                  const unit = s.attributes?.unit_of_measurement || '';
                  return `${name}: ${value} ${unit}`;
                }).join('\n');
                outputText = `Current sensor data:\n${sensorInfo}`;
              } else {
                outputText = `I couldn't find any matching sensors in Home Assistant for "${input}".`;
              }
              addLog('HOME_ASSISTANT', outputText, 'success');
            } catch (error: any) {
              outputText = `Error fetching sensor data: ${error.message}`;
              addLog('HOME_ASSISTANT', outputText, 'error');
            }
          } else {
            // Normal memory recall
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
          } else if (isHomeAssistantQuery(lowerInput)) {
            // Handle ANY Home Assistant sensor query using semantic search
            if (haService.initialized) {
              try {
                addLog('HOME_ASSISTANT', `Searching entities for: "${input}"`, 'info');
                
                const searchResult = await searchEntities(input, {
                  maxResults: 5,
                  minScore: 5,
                  fetchFresh: true
                });
                
                outputText = generateEntityResponse(input, searchResult);
                
                addLog('HOME_ASSISTANT', `Found ${searchResult.matches.length} matches in ${searchResult.searchTimeMs.toFixed(0)}ms`, 'success');
              } catch (error: any) {
                outputText = `Error searching Home Assistant: ${error?.message || 'Unknown error'}`;
                addLog('HOME_ASSISTANT', outputText, 'error');
              }
            } else {
              outputText = "Home Assistant is not connected. Please configure it in Settings to access your smart home data.";
              addLog('HOME_ASSISTANT', outputText, 'warning');
            }
          } else {
            // General Query - Use intelligence-enhanced context
            let prompt = input + correctionContext;
            let systemInstruction = intelligenceResult?.systemPrompt || "You are JARVIS, an advanced AI assistant. Be concise and helpful.";
            
            // Use intelligence-enhanced user prompt if available
            if (intelligenceResult?.userPrompt && intelligenceResult.userPrompt !== input) {
              prompt = intelligenceResult.userPrompt + correctionContext;
              addLog('INTELLIGENCE', 'Using enriched reasoning context', 'info');
            } else if (conversation.detectsContextReference(input)) {
              // Fallback to basic context detection
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
            
            // Post-process with intelligence system for naturalness
            if (intelligenceResult) {
              outputText = intelligence.postProcessResponse(response.text, intelligenceResult.responseModifiers);
              addLog('INTELLIGENCE', `Response naturalized: ${intelligenceResult.responseModifiers.tone} tone`, 'info');
            } else {
              outputText = response.text;
            }
            addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
          }
        } else if (analysis.type === IntentType.COMMAND) {
          setActiveModule('EXECUTION');
          setActiveTab('ARCH');

          // Check if this is a Home Assistant command
          const lower = input.toLowerCase();
          
          // Check if this is actually a query for sensor data (not a command to change state)
          // Patterns like "tell me the temperature", "what is the temperature", "how hot is it" are QUERIES
          const isSensorQuery = /\b(tell me|what('s| is)|how (hot|cold|warm)|current|what's the)\b.*\b(temperature|humidity|weather)\b/i.test(input) ||
                                /\b(temperature|humidity|weather)\s+(is it|outside|inside|outdoor|indoor)\b/i.test(input);
          
          // If it's a sensor query, treat it as a QUERY intent instead
          if (isSensorQuery && haService.initialized) {
            // Route to Home Assistant entity search for sensor data
            try {
              const result = await searchEntities(input);
              if (result.matches.length > 0) {
                const response = generateEntityResponse(input, result);
                outputText = response;
                addLog('HOME_ASSISTANT', response, 'success');
              } else {
                outputText = "I couldn't find any relevant sensors for that query.";
                addLog('HOME_ASSISTANT', outputText, 'warning');
              }
            } catch (error: any) {
              const errorMessage = `Home Assistant query failed: ${error?.message || 'Unknown error'}`;
              outputText = errorMessage;
              addLog('HOME_ASSISTANT', errorMessage, 'error');
            }
          } else {
            // This is an actual command (not a sensor query)
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
          }
        } else if (analysis.type === IntentType.TIMER_REMINDER) {
          setActiveModule('EXECUTION');
          
          // Parse timer/reminder request
          const lowerInput = input.toLowerCase();
          let durationMs = 0;
          let reminderText = '';
          
          // Extract duration
          const durationMatch = lowerInput.match(/(\d+)\s+(second|seconds|minute|minutes|hour|hours)/);
          if (durationMatch) {
            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            if (unit.startsWith('second')) durationMs = amount * 1000;
            else if (unit.startsWith('minute')) durationMs = amount * 60 * 1000;
            else if (unit.startsWith('hour')) durationMs = amount * 60 * 60 * 1000;
          }
          
          // Extract reminder text (everything after "for" or "to")
          const textMatch = input.match(/(?:remind me|reminder|timer)\s+(?:to\s+|for\s+|about\s+)?(.+?)(?:\s+in\s+\d+|\s+for\s+\d+|$)/i);
          reminderText = textMatch ? textMatch[1].trim() : 'Timer complete';
          
          if (durationMs > 0) {
            // Create the task/reminder
            const task = taskAutomation.createTask({
              title: reminderText,
              description: `Timer set for ${input}`,
              status: 'pending',
              priority: 'medium',
              dueDate: new Date(Date.now() + durationMs),
              tags: ['timer', 'reminder']
            });
            
            // Set up the actual timer
            setTimeout(() => {
              taskAutomation.completeTask(task.id);
              voice.speak(`Timer complete: ${reminderText}`);
              addLog('TIMER', `Timer completed: ${reminderText}`, 'success');
            }, durationMs);
            
            const durationText = durationMs < 60000 ? `${durationMs / 1000} seconds` : 
                                durationMs < 3600000 ? `${Math.round(durationMs / 60000)} minutes` :
                                `${Math.round(durationMs / 3600000)} hours`;
            
            outputText = `Timer set for ${durationText}: ${reminderText}`;
            addLog('TIMER', `Created timer "${reminderText}" for ${durationText} (Task ID: ${task.id})`, 'success');
          } else {
            // No duration found - create a task without timer
            const task = taskAutomation.createTask({
              title: reminderText,
              description: `Reminder: ${input}`,
              status: 'pending',
              priority: 'medium',
              tags: ['reminder']
            });
            
            outputText = `Reminder created: ${reminderText}`;
            addLog('TIMER', `Created reminder "${reminderText}" (Task ID: ${task.id})`, 'success');
          }
        } else {
          // General Query - Use intelligence system
          const response = await providerManager.route({
              prompt: intelligenceResult?.userPrompt || input,
              systemInstruction: intelligenceResult?.systemPrompt || "You are JARVIS. Be concise and helpful."
          }, selectedProvider);
          
          // Post-process for naturalness
          if (intelligenceResult) {
            outputText = intelligence.postProcessResponse(response.text, intelligenceResult.responseModifiers);
          } else {
            outputText = response.text;
          }
          addLog(response.provider === AIProvider.GEMINI ? 'GEMINI' : 'OLLAMA', outputText, 'success');
        }
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        outputText = `ERROR: ${errorMessage}`;
        addLog('KERNEL', outputText, 'error');
    } finally {
        // Always reset processing flag
        isProcessing.current = false;
    }

    // Track conversation turns for context
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
    await refreshSystemState();
  };

  if (!isSystemReady) {
    return <BootSequence onComplete={() => setSystemReady(true)} />;
  }

  if (view === 'DEV') return <div className="h-screen w-screen"><Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}><DevDashboard onClose={() => setView('DASHBOARD')} /></Suspense></div>;
  if (view === 'SETTINGS') return <div className="h-screen w-screen"><Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}><SettingsInterface onClose={() => setView('DASHBOARD')} /></Suspense></div>;
  if (view === 'INTEGRATIONS') return <div className="h-screen w-screen"><Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}><IntegrationsDashboard onClose={() => setView('DASHBOARD')} /></Suspense></div>;
  if (view === 'PERFORMANCE') return <div className="h-screen w-screen"><Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}><PerformanceDashboard /></Suspense></div>;
  if (view === 'MARKETPLACE') return <div className="h-screen w-screen"><Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}><PluginMarketplace onClose={() => setView('DASHBOARD')} /></Suspense></div>;

  const isMainDashboard = activeTab === 'DASHBOARD';

  return (
    <>
      <ToastNotifications />
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
              <button onClick={() => setActiveTab('LOGS')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'LOGS' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-600'}`}>LOGS</button>
              <button onClick={() => setActiveTab('HOME_ASSISTANT')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'HOME_ASSISTANT' ? 'bg-green-900/40 text-green-400' : 'text-gray-600'}`}>HA</button>
              <button onClick={() => setActiveTab('WEATHER')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'WEATHER' ? 'bg-sky-900/40 text-sky-400' : 'text-gray-600'}`}>WEATHER</button>
           </div>
           
           <div className="flex gap-2">
             <NotificationBell />
             <button onClick={() => setView('INTEGRATIONS')} className="p-2 text-cyan-500 border border-cyan-900/20 rounded bg-black hover:bg-cyan-900/10" title="Integrations"><Zap size={18} /></button>
             <button onClick={() => setView('DEV')} className="p-2 text-yellow-500 border border-cyan-900/20 rounded bg-black hover:bg-yellow-900/10"><Bug size={18} /></button>
             <button onClick={() => setView('SETTINGS')} className="p-2 text-gray-500 border border-cyan-900/20 rounded bg-black hover:bg-gray-900"><SettingsIcon size={18} /></button>
           </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden h-full">
           <div className="shrink-0"><VoiceHUD onToggle={() => voice.toggleMute()} /></div>
           <div className="flex-1 min-h-0"><Terminal onCommand={(cmd) => processKernelRequest(cmd)} isProcessing={state !== ProcessorState.IDLE} /></div>
        </div>

        <div className="col-span-9 h-full min-h-0 overflow-hidden">
             {isMainDashboard ? (
                 <MainDashboard onCommand={(cmd) => processKernelRequest(cmd)} onNavigate={setActiveTab} />
             ) : (
                <div className="grid grid-cols-12 gap-4 h-full">
                    <div className="col-span-8 h-full flex flex-col">
                        <Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}>
                            {activeTab === 'ARCH' && <ArchitectureDiagram state={state} activeModule={activeModule} provider={provider} />}
                            {activeTab === 'VISION' && <VisionWindow />}
                            {activeTab === 'HEALTH' && <HealthDashboard />}
                            {activeTab === 'GRAPH' && <DependencyGraph />}
                            {activeTab === 'HOME_ASSISTANT' && <HomeAssistantDashboard />}
                            {activeTab === 'LOGS' && <LogsDashboard />}
                            {activeTab === 'WEATHER' && <WeatherDashboard />}
                        </Suspense>
                        {activeTab === 'MEMORY' && <div className="flex-1 min-h-0"><MemoryBank nodes={memories} onForget={handleForget} onManualSearch={(q) => memory.recall(q)} onMemoryUpdate={refreshSystemState} /></div>}
                    </div>
                    <div className="col-span-4 flex flex-col gap-4">
                        <div className="flex-1 min-h-0"><PluginManager plugins={plugins} onToggle={(id) => registry.togglePlugin(id)} /></div>
                        <div className="flex-1 min-h-0"><CircuitDashboard statuses={breakerStatuses} onTrip={(id) => engine.simulateFailure(id)} /></div>
                    </div>
                </div>
             )}
        </div>
      </main>
      
      {/* Global Notification System */}
      <NotificationSystem />
    </div>
    </>
  );
};

export default App;