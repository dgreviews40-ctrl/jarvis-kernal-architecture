/**
 * Kernel State Store - Kernel v1.3
 *
 * Manages core kernel state with v1.3 features:
 * - Enhanced processor states
 * - Worker pool stats
 * - Resource monitoring
 * - Plugin lifecycle
 * - Event bus stats
 * - Refactored kernel processing
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import {
  ProcessorState,
  AIProvider,
  BreakerStatus,
  RuntimePlugin,
  VoiceState,
  VisionState,
  DisplayMode,
  DisplayContent
} from '../types';

// v1.2 New Types
export interface WorkerPoolStats {
  activeWorkers: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
}

export interface ResourceStats {
  monitoredSources: number;
  totalActiveTasks: number;
  totalMemoryMB: number;
  averageCpuPercent: number;
  throttledSources: string[];
}

export interface EventBusStats {
  totalEvents: number;
  eventsPerSecond: number;
  activeSubscriptions: number;
  channelCounts: Record<string, number>;
}

// v1.4.0 New Types
export interface VectorDBStats {
  totalVectors: number;
  indexSize: number;
  cacheSize: number;
  averageVectorSize: number;
  isInitialized: boolean;
}

export interface ContextWindowStats {
  totalTurns: number;
  compressedTurns: number;
  summaryTokens: number;
  lastSummaryAt: number;
  utilization: number;
}

// v1.4.1 New Types
export interface MemoryConsolidationStats {
  totalMemories: number;
  mergedThisSession: number;
  decayedThisSession: number;
  duplicatesRemoved: number;
  isInitialized: boolean;
}

// v1.4.2 New Types
export interface AgentStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  failedGoals: number;
  totalTasks: number;
  isInitialized: boolean;
}

export interface KernelHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  lastCheck: number;
  issues: string[];
}

export interface KernelVersion {
  major: number;
  minor: number;
  patch: number;
  build: string;
}

export const KERNEL_VERSION: KernelVersion = {
  major: 1,
  minor: 5,
  patch: 0,
  build: 'v1.5.0-stable'
};

interface KernelState {
  // Version
  version: KernelVersion;
  
  // Processor state
  processorState: ProcessorState;
  activeModule: string | null;
  
  // AI Provider
  provider: AIProvider | null;
  forcedMode: AIProvider | null;
  
  // System components
  breakerStatuses: BreakerStatus[];
  plugins: RuntimePlugin[];
  voiceState: VoiceState;
  visionState: VisionState;

  // Display Area state
  displayMode: DisplayMode;
  displayContent: DisplayContent | null;

  // v1.2 New State
  workerStats: WorkerPoolStats;
  resourceStats: ResourceStats;
  eventBusStats: EventBusStats;
  health: KernelHealth;
  bootTime: number;

  // v1.4.0 New State
  vectorDBStats: VectorDBStats;
  contextWindowStats: ContextWindowStats;

  // v1.4.1 New State
  memoryConsolidationStats: MemoryConsolidationStats;
  
  // v1.4.2 New State
  agentStats: AgentStats;
  
  // Actions
  setProcessorState: (state: ProcessorState) => void;
  setActiveModule: (module: string | null) => void;
  setProvider: (provider: AIProvider | null) => void;
  setForcedMode: (mode: AIProvider | null) => void;
  setBreakerStatuses: (statuses: BreakerStatus[]) => void;
  setPlugins: (plugins: RuntimePlugin[]) => void;
  setVoiceState: (state: VoiceState) => void;
  setVisionState: (state: VisionState) => void;

  // Display Area actions
  setDisplayMode: (mode: DisplayMode) => void;
  setDisplayContent: (content: DisplayContent | null) => void;
  showSchematic: (imageUrl: string, title?: string, description?: string) => void;
  showImage: (src: string, title?: string, alt?: string) => void;
  showWebContent: (url: string, title?: string) => void;
  clearDisplay: () => void;

  // v1.2 Actions
  setWorkerStats: (stats: WorkerPoolStats) => void;
  setResourceStats: (stats: ResourceStats) => void;
  setEventBusStats: (stats: EventBusStats) => void;
  setHealth: (health: Partial<KernelHealth>) => void;
  addHealthIssue: (issue: string) => void;
  clearHealthIssues: () => void;

  // v1.4.0 Actions
  setVectorDBStats: (stats: VectorDBStats) => void;
  setContextWindowStats: (stats: ContextWindowStats) => void;

  // v1.4.1 Actions
  setMemoryConsolidationStats: (stats: MemoryConsolidationStats) => void;
  
  // v1.4.2 Actions
  setAgentStats: (stats: AgentStats) => void;
  
  // Batch updates
  refreshSystemState: (state: {
    breakerStatuses?: BreakerStatus[];
    plugins?: RuntimePlugin[];
    voiceState?: VoiceState;
    visionState?: VisionState;
    workerStats?: WorkerPoolStats;
    resourceStats?: ResourceStats;
    eventBusStats?: EventBusStats;
    health?: Partial<KernelHealth>;
  }) => void;
  
  // Utility
  getUptime: () => number;
  isHealthy: () => boolean;
}

export const useKernelStore = create<KernelState>()(
  persist(
    subscribeWithSelector(
      (set, get) => ({
        // Version
        version: KERNEL_VERSION,
        
        // Initial state
        processorState: ProcessorState.IDLE,
        activeModule: null,
        provider: null,
        forcedMode: AIProvider.GEMINI,
        breakerStatuses: [],
        plugins: [],
        voiceState: VoiceState.MUTED,
        visionState: VisionState.OFF,

        // Display Area initial state
        displayMode: 'NEURAL' as DisplayMode,
        displayContent: null,

        // v1.2 Initial State
        workerStats: {
          activeWorkers: 0,
          pendingTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          averageExecutionTime: 0
        },
        resourceStats: {
          monitoredSources: 0,
          totalActiveTasks: 0,
          totalMemoryMB: 0,
          averageCpuPercent: 0,
          throttledSources: []
        },
        eventBusStats: {
          totalEvents: 0,
          eventsPerSecond: 0,
          activeSubscriptions: 0,
          channelCounts: {}
        },
        health: {
          status: 'healthy',
          uptime: 0,
          lastCheck: Date.now(),
          issues: []
        },
        bootTime: Date.now(),

        // v1.4.0 Initial State
        vectorDBStats: {
          totalVectors: 0,
          indexSize: 0,
          cacheSize: 0,
          averageVectorSize: 0,
          isInitialized: false
        },
        contextWindowStats: {
          totalTurns: 0,
          compressedTurns: 0,
          summaryTokens: 0,
          lastSummaryAt: 0,
          utilization: 0
        },

        // v1.4.1 Initial State
        memoryConsolidationStats: {
          totalMemories: 0,
          mergedThisSession: 0,
          decayedThisSession: 0,
          duplicatesRemoved: 0,
          isInitialized: false
        },
        
        // v1.4.2 Initial State
        agentStats: {
          totalGoals: 0,
          activeGoals: 0,
          completedGoals: 0,
          failedGoals: 0,
          totalTasks: 0,
          isInitialized: false
        },
        
        // Actions
        setProcessorState: (processorState) => set({ processorState }),
        
        setActiveModule: (activeModule) => set({ activeModule }),
        
        setProvider: (provider) => set({ provider }),
        
        setForcedMode: (forcedMode) => set({ forcedMode }),
        
        setBreakerStatuses: (breakerStatuses) => set({ breakerStatuses }),
        
        setPlugins: (plugins) => set({ plugins }),
        
        setVoiceState: (voiceState) => set({ voiceState }),
        
        setVisionState: (visionState) => set({ visionState }),

        // Display Area actions
        setDisplayMode: (displayMode) => set({ displayMode }),

        setDisplayContent: (displayContent) => set({ displayContent }),

        showSchematic: (imageUrl, title, description) => set({
          displayMode: 'SCHEMATIC' as DisplayMode,
          displayContent: {
            type: 'SCHEMATIC',
            title,
            description,
            schematic: { imageUrl, title, description }
          }
        }),

        showImage: (src, title, alt) => set({
          displayMode: 'IMAGE' as DisplayMode,
          displayContent: {
            type: 'IMAGE',
            title,
            image: { src, title, alt }
          }
        }),

        showWebContent: (url, title) => set({
          displayMode: 'WEB' as DisplayMode,
          displayContent: {
            type: 'WEB',
            title,
            web: { url, title }
          }
        }),

        clearDisplay: () => set({
          displayMode: 'NEURAL' as DisplayMode,
          displayContent: null
        }),

        // v1.2 Actions
        setWorkerStats: (workerStats) => set({ workerStats }),
        
        setResourceStats: (resourceStats) => set({ resourceStats }),
        
        setEventBusStats: (eventBusStats) => set({ eventBusStats }),
        
        setHealth: (healthUpdate) => set((state) => ({
          health: { ...state.health, ...healthUpdate, lastCheck: Date.now() }
        })),
        
        addHealthIssue: (issue) => set((state) => ({
          health: {
            ...state.health,
            issues: [...state.health.issues, issue],
            status: state.health.issues.length > 2 ? 'critical' : 'degraded'
          }
        })),
        
        clearHealthIssues: () => set((state) => ({
          health: {
            ...state.health,
            issues: [],
            status: 'healthy'
          }
        })),

        // v1.4.0 Actions
        setVectorDBStats: (vectorDBStats) => set({ vectorDBStats }),
        
        setContextWindowStats: (contextWindowStats) => set({ contextWindowStats }),

        // v1.4.1 Actions
        setMemoryConsolidationStats: (memoryConsolidationStats) => set({ memoryConsolidationStats }),
        
        // v1.4.2 Actions
        setAgentStats: (agentStats) => set({ agentStats }),
        
        refreshSystemState: (updates) => set((state) => ({
          ...state,
          ...updates
        })),

        // v1.4.0 Refresh stats
        refreshVectorDBStats: async () => {
          const { localVectorDB } = await import('../services/localVectorDB');
          const stats = await localVectorDB.getStats();
          set({
            vectorDBStats: {
              ...stats,
              isInitialized: true
            }
          });
        },
        
        getUptime: () => Date.now() - get().bootTime,
        
        isHealthy: () => get().health.status === 'healthy'
      })
    ),
    {
      name: 'jarvis-kernel-store-v1.4',
      partialize: (state) => ({
        // Only persist user preferences, not runtime state
        forcedMode: state.forcedMode,
        version: state.version
      }),
    }
  )
);

// Selector hooks for performance
export const useProcessorState = () => useKernelStore((state) => state.processorState);
export const useActiveModule = () => useKernelStore((state) => state.activeModule);
export const useProvider = () => useKernelStore((state) => state.provider);
export const useForcedMode = () => useKernelStore((state) => state.forcedMode);
export const useBreakerStatuses = () => useKernelStore((state) => state.breakerStatuses);
export const usePlugins = () => useKernelStore((state) => state.plugins);
export const useVoiceState = () => useKernelStore((state) => state.voiceState);
export const useVisionState = () => useKernelStore((state) => state.visionState);

// Display Area selectors
export const useDisplayMode = () => useKernelStore((state) => state.displayMode);
export const useDisplayContent = () => useKernelStore((state) => state.displayContent);

// v1.2 Selectors
export const useKernelVersion = () => useKernelStore((state) => state.version);
export const useWorkerStats = () => useKernelStore((state) => state.workerStats);
export const useResourceStats = () => useKernelStore((state) => state.resourceStats);
export const useEventBusStats = () => useKernelStore((state) => state.eventBusStats);
export const useKernelHealth = () => useKernelStore((state) => state.health);
export const useKernelUptime = () => useKernelStore((state) => state.getUptime());

// v1.4.0 Selectors
export const useVectorDBStats = () => useKernelStore((state) => state.vectorDBStats);
export const useContextWindowStats = () => useKernelStore((state) => state.contextWindowStats);

// v1.4.1 Selectors
export const useMemoryConsolidationStats = () => useKernelStore((state) => state.memoryConsolidationStats);

// v1.4.2 Selectors
export const useAgentStats = () => useKernelStore((state) => state.agentStats);

// v1.2 Computed selectors
export const useFormattedUptime = () => {
  const uptime = useKernelUptime();
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const useVersionString = () => {
  const version = useKernelVersion();
  return `v${version.major}.${version.minor}.${version.patch}`;
};
