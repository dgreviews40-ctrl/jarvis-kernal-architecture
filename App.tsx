import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { Terminal } from './components/Terminal';
import { CircuitDashboard } from './components/CircuitDashboard';
import { PluginManager } from './components/PluginManager';
import { MemoryBank } from './components/MemoryBank';
import { NetworkControl } from './components/NetworkControl';
import { VoiceHUD } from './components/VoiceHUD';
import { ProactiveSuggestions } from './components/ProactiveSuggestions';
import { SystemMonitor } from './components/SystemMonitor';
import { BootSequence } from './components/BootSequence';
import { BootSequenceFast } from './components/BootSequenceFast';
import { MainDashboard } from './components/MainDashboard';
import { NotificationSystem } from './components/NotificationSystem';
import { Settings as SettingsIcon, LayoutDashboard, Bug, Terminal as TerminalIcon, Zap, Activity, Sparkles, Bell, Database, Power, Image, Cpu } from 'lucide-react';
import { textStyle, textColor, fontFamily, tracking } from './constants/typography';
import { logger } from './services/logger';
import { TIMING, LIMITS } from './constants/config';

// Non-lazy components (avoid dynamic import issues)
import VisionMemoryPanel from './components/VisionMemoryPanel';
import ModelManagerPanel from './components/ModelManagerPanel';

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
const AgentDashboard = lazy(() => import('./components/AgentDashboard'));
const VectorDBDashboard = lazy(() => import('./components/VectorDBDashboard'));
const RealtimeDashboard = lazy(() => import('./components/RealtimeDashboard'));

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
import { weatherService } from './services/weather';
import { taskAutomation } from './services/integrations/taskAutomation';
import { kernelProcessor } from './services/kernelProcessor';
import { webSocketService } from './services/webSocketService';
import { pluginHotReloader } from './services/pluginHotReloader';
import { cacheService } from './services/cacheService';
import { securityService } from './services/securityService';
import { resilienceService } from './services/resilienceService';
import { predictiveService } from './services/predictiveService';
import { performanceMonitoringService } from './services/performanceMonitoringService';
import { testingFramework } from './services/testingFramework';
import { localVectorDB } from './services/localVectorDB';
import { contextWindowService } from './services/contextWindowService';
import { JARVISErrorBoundary } from './components/ErrorBoundary';

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

// Wrapper for lazy-loaded views with error boundary - defined outside component to prevent re-renders
const LazyViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <JARVISErrorBoundary>
    <Suspense fallback={<div className="h-full flex items-center justify-center text-cyan-500/50 text-sm font-mono">Loading...</div>}>
      {children}
    </Suspense>
  </JARVISErrorBoundary>
);

// Hook to track component mount status
const useIsMounted = () => {
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return () => isMountedRef.current;
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
      <ProactiveSuggestions />
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
  const recentVoiceCommands = useRef<Array<{text: string, timestamp: number}>>([]);
  const processingRequests = useRef<Set<string>>(new Set());
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

    // Initialize new v1.3 services
    webSocketService.connectToServer().catch(err => {
      logger.log('SYSTEM', `WebSocket service not available: ${err.message}`, 'info');
    });

    pluginHotReloader.watchAllActivePlugins().catch(err => {
      logger.log('PLUGIN', `Hot reload service not available: ${err.message}`, 'info');
    });

    // Initialize additional v1.3 services
    try {
      // Cache service is initialized automatically
      logger.log('SYSTEM', 'Cache service initialized', 'info');

      // Security service is initialized automatically
      logger.log('SYSTEM', 'Security service initialized', 'info');

      // Resilience service is initialized automatically
      logger.log('SYSTEM', 'Resilience service initialized', 'info');

      // Advanced memory service is initialized automatically
      logger.log('MEMORY', 'Advanced memory service initialized', 'info');

      // Predictive service is initialized automatically
      logger.log('SYSTEM', 'Predictive service initialized', 'info');

      // Performance monitoring service is initialized automatically
      logger.log('SYSTEM', 'Performance monitoring service initialized', 'info');

      // Testing framework is initialized automatically
      logger.log('SYSTEM', 'Testing framework initialized', 'info');
    } catch (error) {
      logger.log('SYSTEM', `Error initializing v1.3 services: ${(error as Error).message}`, 'error');
    }

    // Initialize v1.5.0 services
    import('./services/kernelInitializer').then(({ initializeKernelV140 }) => {
      initializeKernelV140().then(status => {
        if (status.vectorDB && status.contextWindow) {
          logger.log('KERNEL', 'JARVIS Kernel v1.5.0 services initialized', 'success');
        } else {
          logger.log('KERNEL', `Kernel v1.5.0 partial init: VectorDB=${status.vectorDB}, ContextWindow=${status.contextWindow}`, 'warning');
        }
      });
    });

    providerManager.setForcedMode(forcedMode);
    graphService.rebuild();
    
    // SECURITY: Internal services are no longer exposed globally.
    // Plugins should use the secure plugin API instead.
    console.log('[App] Internal services secured - using secure plugin API');

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

              // Store context for potential resume (voice service doesn't support setContext)
              // voice.setContext('interrupted_response', interruptResult.resumePoint);
            }
        } else if (newState === VoiceState.IDLE && currentState === VoiceState.INTERRUPTED) {
          // Check if we should resume after interruption
          const resume = conversationFlow.resumeAfterInterruption();
          if (resume.shouldResume && resume.context) {
            addLog('INTELLIGENCE', 'Resuming after interruption', 'info');

            // Prevent duplicate resume messages by checking if this exact text was recently spoken
            const resumeText = `${resume.resumeMessage} ${resume.context}`;
            const now = Date.now();

            // Check if this resume text was recently spoken (within 5 seconds)
            const recentResume = recentVoiceCommands.current.some(
              cmd => cmd.text === resumeText && (now - cmd.timestamp) < 5000
            );

            if (!recentResume) {
              // Track this resume command to prevent duplicates
              recentVoiceCommands.current.push({ text: resumeText, timestamp: now });
              // Clean up old commands (older than 5 seconds)
              recentVoiceCommands.current = recentVoiceCommands.current.filter(
                cmd => (now - cmd.timestamp) < 5000
              );

              voice.speak(resumeText);
            } else {
              addLog('INTELLIGENCE', 'Resume message ignored (duplicate prevention)', 'warning');
            }
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

    // Subscribe to memory changes for auto-refresh
    const unsubscribeMemory = memory.subscribe(async () => {
        const memories = await memory.getAll();
        setMemories(memories);
    });

    // Set the speak function for task automation
    taskAutomation.setSpeakFunction((text: string) => {
      if (voice.getState() !== VoiceState.MUTED) {
        voice.speak(text);
      }
    });

    addLog('SYSTEM', 'Kernel Boot Sequence Complete.', 'success');

    // SECURITY FIX: Removed global window pollution
    // Previously exposed: engine, pluginLoader, registry, imageGenerator
    // 
    // Plugins now access functionality through the secure plugin API which:
    // - Enforces permission checks via securityService
    // - Logs all actions for audit
    // - Enforces resource quotas
    // - Does not expose internal service internals
    //
    // For debugging in development, use: window.__JARVIS_DEV__.runTests()
    
    // Register internal services for the secure plugin API
    import('./services/securePluginApi').then(({ registerInternalServices, createDevAPI }) => {
      registerInternalServices({ engine, registry });
      
      // Minimal dev API for debugging (not for production use)
      if (import.meta.env?.DEV) {
        (window as any).__JARVIS_DEV__ = createDevAPI();
      }
    });
    
    console.log('[App] Secure plugin API registered');

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
        unsubscribeMemory();

        // Clean up v1.3 services
        webSocketService.close();
        pluginHotReloader.unwatchAllPlugins().catch(err => {
          logger.log('PLUGIN', `Error stopping plugin watchers: ${err.message}`, 'warning');
        });


        // Clear predictive service data
        predictiveService.clearAllData();

        // Clear performance monitoring data
        performanceMonitoringService.clearAllData();

        // Clean up voice service resources
        try {
          // Properly shut down the voice service
          voice.setPower(false); // Turn off voice service
        } catch (e) {
          console.warn('Error cleaning up voice service:', e);
        }

        // Clean up task automation service
        try {
          taskAutomation.cleanup(); // Clear all automation timers on shutdown
        } catch (e) {
          console.warn('Error cleaning up task automation service:', e);
        }

        // Clean up global window object references to prevent memory leaks
        // SECURITY: Only __JARVIS_DEV__ is exposed (and only in DEV mode)
        if (import.meta.env?.DEV) {
          delete (window as any).__JARVIS_DEV__;
        }
    };
  }, [isSystemReady, forcedMode]); // Added forcedMode to dependency array

  // Initialize Home Assistant once when component mounts
  useEffect(() => {
    let isCancelled = false;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    const initializeHomeAssistant = async () => {
      const haUrl = localStorage.getItem('HA_URL');
      const haToken = localStorage.getItem('HA_TOKEN');

      if (!haUrl || !haToken) {
        addLog('HOME_ASSISTANT', 'Not configured - skipping initialization', 'info');
        return;
      }

      if (haService.initialized) {
        addLog('HOME_ASSISTANT', 'Already connected', 'info');
        return;
      }

      // Wait for proxy to be ready with retries
      const waitForProxy = async (): Promise<boolean> => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (isCancelled) return false;
          
          try {
            const healthResponse = await fetch('http://localhost:3101/health', {
              method: 'GET',
              signal: AbortSignal.timeout(3000)
            });

            if (healthResponse.ok) {
              addLog('HOME_ASSISTANT', `Proxy server ready (attempt ${attempt}/${MAX_RETRIES})`, 'success');
              return true;
            }
          } catch (error) {
            addLog('HOME_ASSISTANT', `Proxy not ready (attempt ${attempt}/${MAX_RETRIES})`, 'warning');
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
          }
        }
        return false;
      };

      try {
        // Wait for proxy to be ready
        const proxyReady = await waitForProxy();
        if (!proxyReady || isCancelled) {
          addLog('HOME_ASSISTANT', 'Proxy server not available after retries. Start the proxy with: npm run proxy', 'error');
          return;
        }

        // Configure the HA service
        haService.configure(haUrl, haToken);
        addLog('HOME_ASSISTANT', 'Configuring proxy server...', 'info');

        // Configure the proxy server
        const configResponse = await fetch('http://localhost:3101/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: haUrl, token: haToken })
        });

        if (!configResponse.ok) {
          const errorText = await configResponse.text().catch(() => 'Unknown error');
          throw new Error(`Proxy config failed: ${configResponse.status} - ${errorText}`);
        }

        addLog('HOME_ASSISTANT', 'Proxy configured. Connecting to Home Assistant...', 'success');

        // Wait a moment for config to propagate
        await new Promise(r => setTimeout(r, 500));

        if (isCancelled) return;

        // Initialize the connection
        await haService.initialize();
        addLog('HOME_ASSISTANT', 'Connected successfully!', 'success');
        
        // Fetch and log entity count
        const status = await haService.getStatus();
        if (status.connected) {
          addLog('HOME_ASSISTANT', `Found ${status.entitiesCount} entities`, 'info');
        }
      } catch (error) {
        if (!isCancelled) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          addLog('HOME_ASSISTANT', `Connection failed: ${errorMsg}`, 'error');
          console.error('[HOME_ASSISTANT] Initialization error:', error);
        }
      }
    };

    // Delay initial check to allow system to settle
    const initTimeout = setTimeout(() => {
      initializeHomeAssistant();
    }, 1000);

    return () => {
      isCancelled = true;
      clearTimeout(initTimeout);
    };
  }, []); // Empty dependency array - runs once on mount
  
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
    // Prepare context for the kernel processor
    const context = {
      forcedMode,
      setState,
      setActiveModule,
      setProvider,
      origin,
      recentVoiceCommands: recentVoiceCommands.current,
      isProcessing,
      processingRequests: processingRequests.current,
      lastRequestTime,
      lastRequestText
    };

    // Delegate to the refactored kernel processor
    await kernelProcessor.processRequest(input, context);
  }, [forcedMode]);

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
    // Use fast boot by default, can toggle with localStorage flag
    const useFastBoot = localStorage.getItem('jarvis_fast_boot') !== 'false';
    const BootComponent = useFastBoot ? BootSequenceFast : BootSequence;
    return <BootComponent onComplete={() => setSystemReady(true)} />;
  }

  if (view === 'DEV') return <div className="h-screen w-screen"><LazyViewWrapper><DevDashboard onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
  if (view === 'SETTINGS') return <div className="h-screen w-screen"><LazyViewWrapper><SettingsInterface onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
  if (view === 'INTEGRATIONS') return <div className="h-screen w-screen"><LazyViewWrapper><IntegrationsDashboard onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
  if (view === 'PERFORMANCE') return <div className="h-screen w-screen"><LazyViewWrapper><PerformanceDashboard /></LazyViewWrapper></div>;
  if (view === 'MARKETPLACE') return <div className="h-screen w-screen"><LazyViewWrapper><PluginMarketplace onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
  if (view === 'VECTOR_DB') return <div className="h-screen w-screen"><LazyViewWrapper><VectorDBDashboard isOpen={true} onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
  if (view === 'REALTIME') return <div className="h-screen w-screen"><LazyViewWrapper><RealtimeDashboard onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
if (view === 'VISION_MEMORY') return <div className="h-screen w-screen"><LazyViewWrapper><VisionMemoryPanel isOpen={true} onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;
if (view === 'MODEL_MANAGER') return <div className="h-screen w-screen"><LazyViewWrapper><ModelManagerPanel isOpen={true} onClose={() => setView('DASHBOARD')} /></LazyViewWrapper></div>;

  const isMainDashboard = activeTab === 'DASHBOARD';

  // Shutdown JARVIS - calls dedicated shutdown server
  const handleExit = async () => {
    if (confirm('Shutdown JARVIS? This will close all services and the browser.')) {
      try {
        console.log('[SHUTDOWN] Sending shutdown request to port 9999...');
        
        // Call the dedicated shutdown server (port 9999)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('http://localhost:9999/api/shutdown', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
          console.log('[SHUTDOWN] Shutdown command accepted by server');
        } else {
          console.warn('[SHUTDOWN] Server returned error:', response.status);
        }
      } catch (e) {
        console.log('[SHUTDOWN] Server request failed (may already be shutting down or server not running):', e);
      } finally {
        // Show feedback to user
        alert('JARVIS shutdown initiated. All services will stop momentarily.');
        
        // Try to close the window (may not work for manually opened windows)
        setTimeout(() => {
          window.close();
        }, 500);
      }
    }
  };

  return (
    <JARVISErrorBoundary>
      <ToastNotifications />
      <div className="jarvis-container bg-[#050505] text-white animate-fadeIn">
      <header className="jarvis-header">
        <div className="jarvis-branding">
           <h1 className={`text-xl md:text-2xl font-bold ${fontFamily.mono} tracking-tighter text-cyan-500`}>J.A.R.V.I.S.</h1>
           <p className={`${textStyle.label} text-cyan-900 hidden sm:block`}>Kernel v1.5.0 • Full Autonomous Agents</p>
        </div>

        <SystemMonitor />

        <div className="jarvis-controls">
           <NetworkControl forcedMode={forcedMode} onToggle={handleNetworkToggle} />
           
           <div className="jarvis-tabs">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`jarvis-tab ${activeTab === 'DASHBOARD' ? 'active-orange' : ''}`} title="Dashboard"><LayoutDashboard size={14} /></button>
              <button onClick={() => setActiveTab('ARCH')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'ARCH' ? 'active-cyan' : ''}`}>KERNEL</button>
              <button onClick={() => setActiveTab('MEMORY')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'MEMORY' ? 'active-purple' : ''}`}>MEM</button>
              <button onClick={() => setActiveTab('VISION')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'VISION' ? 'active-red' : ''}`}>VIS</button>
              <button onClick={() => setActiveTab('HEALTH')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'HEALTH' ? 'active-pink' : ''}`}>HLT</button>
              <button onClick={() => setActiveTab('LOGS')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'LOGS' ? 'active-cyan' : ''}`}>LOGS</button>
              <button onClick={() => setActiveTab('HOME_ASSISTANT')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'HOME_ASSISTANT' ? 'active-green' : ''}`}>HA</button>
              <button onClick={() => setActiveTab('WEATHER')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'WEATHER' ? 'active-sky' : ''}`}>WTH</button>
              <button onClick={() => setActiveTab('AGENT')} className={`jarvis-tab ${textStyle.buttonSmall} ${activeTab === 'AGENT' ? 'active-cyan' : ''}`}>AGT</button>
           </div>
           
           <div className="jarvis-actions">
             <NotificationBell />
             <button onClick={() => setView('INTEGRATIONS')} className="jarvis-btn-icon text-cyan-500" title="Integrations"><Zap size={18} /></button>
             <button onClick={() => setView('VECTOR_DB')} className="jarvis-btn-icon text-purple-500" title="Vector DB"><Database size={18} /></button>
             <button onClick={() => setView('REALTIME')} className="jarvis-btn-icon text-red-500" title="Real-Time Dashboard"><Activity size={18} /></button>
             <button onClick={() => setView('VISION_MEMORY')} className="jarvis-btn-icon text-pink-500" title="Vision Memory"><Image size={18} /></button>
             <button onClick={() => setView('MODEL_MANAGER')} className="jarvis-btn-icon text-cyan-500" title="Model Manager"><Cpu size={18} /></button>
             <button onClick={() => setView('DEV')} className="jarvis-btn-icon text-yellow-500" title="Dev Tools"><Bug size={18} /></button>
             <button onClick={() => setView('SETTINGS')} className="jarvis-btn-icon text-gray-500" title="Settings"><SettingsIcon size={18} /></button>
             <button onClick={handleExit} className="jarvis-btn-icon text-red-600 hover:text-red-400" title="Exit JARVIS"><Power size={18} /></button>
           </div>
        </div>
      </header>

      <main className="jarvis-main">
        <div className="jarvis-sidebar">
           <div className="shrink-0"><VoiceHUD onToggle={() => voice.toggleMute()} /></div>
           <div className="flex-1 min-h-0 overflow-hidden"><Terminal onCommand={(cmd) => processKernelRequest(cmd)} isProcessing={state !== ProcessorState.IDLE} /></div>
        </div>

        <div className="jarvis-content">
             {isMainDashboard ? (
                 <MainDashboard onCommand={(cmd) => processKernelRequest(cmd)} onNavigate={setActiveTab} />
             ) : (
                <div className="jarvis-tab-content">
                    <div className="jarvis-primary-panel">
                        <JARVISErrorBoundary>
                          <Suspense fallback={<div className={`h-full flex items-center justify-center text-cyan-500/50 ${textStyle.dataSecondary}`}>Loading...</div>}>
                              {activeTab === 'ARCH' && <ArchitectureDiagram state={state} activeModule={activeModule} provider={provider} />}
                              {activeTab === 'VISION' && <VisionWindow />}
                              {activeTab === 'HEALTH' && <HealthDashboard />}
                              {activeTab === 'GRAPH' && <DependencyGraph />}
                              {activeTab === 'HOME_ASSISTANT' && <HomeAssistantDashboard />}
                              {activeTab === 'LOGS' && <div className="h-full min-h-0 overflow-hidden"><LogsDashboard /></div>}
                              {activeTab === 'WEATHER' && <WeatherDashboard />}
                              {activeTab === 'AGENT' && <AgentDashboard />}
                          </Suspense>
                        </JARVISErrorBoundary>
                        {activeTab === 'MEMORY' && <div className="flex-1 min-h-0 overflow-auto"><MemoryBank nodes={memories} onForget={handleForget} onManualSearch={(q) => memory.recall(q)} onMemoryUpdate={refreshSystemState} /></div>}
                    </div>
                    <div className="jarvis-secondary-panel">
                        <div className="flex-1 min-h-0 overflow-hidden"><PluginManager plugins={plugins} onToggle={(id) => registry.togglePlugin(id)} /></div>
                        <div className="flex-1 min-h-0 overflow-hidden"><CircuitDashboard statuses={breakerStatuses} onTrip={(id) => engine.simulateFailure(id)} /></div>
                    </div>
                </div>
             )}
        </div>
      </main>
      
      {/* Global Notification System */}
      <NotificationSystem />
    </div>
    </JARVISErrorBoundary>
  );
};

export default App;