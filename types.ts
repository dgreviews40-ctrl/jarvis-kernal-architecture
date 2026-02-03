
/**
 * STEP 1: JARVIS KERNEL ARCHITECTURE DEFINITIONS
 */

export enum ProcessorState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  ROUTING = 'ROUTING',
  EXECUTING = 'EXECUTING',
  WAITING = 'WAITING',
  ERROR = 'ERROR'
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  OLLAMA = 'OLLAMA', 
  SYSTEM = 'SYSTEM'  
}

export enum IntentType {
  QUERY = 'QUERY',           
  COMMAND = 'COMMAND',       
  MEMORY_READ = 'MEMORY_READ', 
  MEMORY_WRITE = 'MEMORY_WRITE', 
  VISION_ANALYSIS = 'VISION_ANALYSIS',
  TIMER_REMINDER = 'TIMER_REMINDER',
  UNKNOWN = 'UNKNOWN'
}

export enum BootState {
  OFFLINE = 'OFFLINE',
  BOOTSTRAP = 'BOOTSTRAP',
  PHASE_BOOT = 'PHASE_BOOT',
  RUNNING = 'RUNNING',
  DEGRADED = 'DEGRADED',
  FATAL = 'FATAL'
}

export interface BootPhase {
  id: number;
  name: string;
  criticality: 'HIGH' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  logs: string[];
}

export interface KernelRequest {
  id: string;
  timestamp: number;
  input: string;
  context: Record<string, any>;
  origin: 'USER_VOICE' | 'USER_TEXT' | 'SYSTEM_EVENT';
}

export interface KernelResponse {
  requestId: string;
  success: boolean;
  providerUsed: AIProvider;
  output: string;
  actionsTaken?: KernelAction[];
  error?: string;
}

export interface KernelAction {
  pluginId: string; 
  method: string;
  params: Record<string, any>;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  source: 'KERNEL' | 'GEMINI' | 'PLUGIN' | 'USER' | 'SYSTEM' | 'CIRCUIT_BREAKER' | 'REGISTRY' | 'MEMORY' | 'OLLAMA' | 'VOICE' | 'VISION' | 'CORTEX' | 'DEV_HOST' | 'GRAPH' | 'CONVERSATION' | 'HOME_ASSISTANT';
  message: string;
  details?: Record<string, unknown> | string | number | boolean | object;
  type: 'info' | 'success' | 'warning' | 'error';
}

export enum CircuitState {
  CLOSED = 'CLOSED',       
  OPEN = 'OPEN',           
  HALF_OPEN = 'HALF_OPEN'  
}

export interface CircuitConfig {
  failureThreshold: number; 
  resetTimeoutMs: number;   
  executionTimeoutMs: number; 
}

export interface BreakerStatus {
  pluginId: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastError?: string;
  nextAttempt?: number;
}

export type Permission = 'READ_MEMORY' | 'WRITE_MEMORY' | 'NETWORK' | 'HARDWARE_CONTROL' | 'AUDIO_OUTPUT' | 'CAMERA_ACCESS' | 'AUDIO_INPUT';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: Permission[];
  provides: string[]; 
  requires: string[]; 
  priority: number;   
  capabilities: string[]; 
}

export interface RuntimePlugin {
  manifest: PluginManifest;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR' | 'PAUSED_DEPENDENCY';
  loadedAt: number;
  error?: string;
}

export interface GraphNode {
  pluginId: string;
  layer: number; 
  dependencies: string[]; 
  dependents: string[];   
}

export interface GraphEdge {
  from: string; 
  to: string;   
  capability: string; 
}

export type MemoryType = 'FACT' | 'PREFERENCE' | 'EPISODE' | 'SUMMARY';

export interface MemoryNode {
  id: string;
  content: string;
  type: MemoryType;
  tags: string[];
  created: number;
  lastAccessed?: number;
  relevanceScore?: number; 
}

export interface MemorySearchResult {
  node: MemoryNode;
  score: number; 
}

export interface AIRequest {
  prompt: string;
  images?: string[]; 
  systemInstruction?: string;
  temperature?: number;
  stopSequences?: string[];
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  costEstimate?: number;
}

export interface IAIProvider {
  id: AIProvider;
  name: string;
  isAvailable(): Promise<boolean>;
  generate(request: AIRequest): Promise<AIResponse>;
}

export enum VoiceState {
  MUTED = 'MUTED',           
  IDLE = 'IDLE',             
  LISTENING = 'LISTENING',   
  PROCESSING = 'PROCESSING', 
  SPEAKING = 'SPEAKING',     
  INTERRUPTED = 'INTERRUPTED', 
  ERROR = 'ERROR'
}

export type VoiceType = 'SYSTEM' | 'NEURAL' | 'PIPER';

export type STTProvider = 'WHISPER' | 'BROWSER' | 'AUTO';

export interface VoiceConfig {
  wakeWord: string;
  voiceType: VoiceType;
  voiceName: string; // Browser voice name OR Gemini prebuilt voice name
  rate: number;     
  pitch: number;
  sttProvider: STTProvider; // Speech-to-text provider preference
}

export interface ConversationTurn {
  id: string;
  timestamp: number;
  speaker: 'USER' | 'JARVIS';
  text: string;
  interrupted?: boolean;
}

export interface Session {
  id: string;
  startTime: number;
  turns: ConversationTurn[];
  interruptCount: number;
  learningUpdates: string[]; 
}

export enum VisionState {
  OFF = 'OFF',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  CAPTURING = 'CAPTURING',
  ERROR = 'ERROR'
}

export interface SystemMetrics {
  cpuLoad: number; 
  memoryUsage: number; 
  gpuLoad: number; 
  temperature: number; 
  uptime: number; 
}

export interface AIConfig {
  model: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-1.5-flash';
  temperature: number;
}

export interface OllamaConfig {
  url: string;
  model: string;
  temperature: number;
}

export interface SystemConfig {
  allowCamera: boolean;
  allowMicrophone: boolean;
  alwaysListen: boolean;
  selectedCameraId: string | null;
  selectedMicrophoneId: string | null;
  ai: AIConfig;
  ollama: OllamaConfig;
}

export enum HealthEventType {
  SUCCESS = 'SUCCESS',
  TIMEOUT = 'TIMEOUT',
  CRASH = 'CRASH',
  API_ERROR = 'API_ERROR',
  HIGH_LATENCY = 'HIGH_LATENCY',
  RESOURCE_SPIKE = 'RESOURCE_SPIKE',
  INTERRUPT = 'INTERRUPT' 
}

export enum ImpactLevel {
  NONE = 0,
  LOW = 1,      
  MEDIUM = 5,   
  HIGH = 20,    
  CRITICAL = 100 
}

export interface OperationalEvent {
  id: string;
  timestamp: number;
  sourceId: string; 
  type: HealthEventType;
  impact: ImpactLevel;
  latencyMs: number;
  context: {
    endpoint?: string;
    params?: string; 
    errorMessage?: string;
  };
}

export interface ReliabilityScore {
  sourceId: string;
  currentHealth: number; 
  totalFailures: number;
  lastFailureAt: number | null;
  trend: 'STABLE' | 'DEGRADING' | 'RECOVERING' | 'CRITICAL';
}

export interface AdaptivePolicy {
  policyId: string;
  targetSourceId: string;
  parameterKey: string;
  overrideValue: unknown;
  reason: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface DevContext {
  pluginId: string;
  isSandboxed: boolean;
  mockTime: number;
  mockHardware: SystemMetrics;
  mockMemory: MemoryNode[];
}

export interface IPCMessage {
  id: string;
  timestamp: number;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: string;
  payload: unknown;
  status: 'OK' | 'BLOCKED' | 'ERROR';
}

// Extend global window interface for speech recognition and audio context
declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
    AudioContext: {
      new(options?: AudioContextOptions): AudioContext;
    };
    webkitAudioContext: {
      new(options?: AudioContextOptions): AudioContext;
    };
  }
}
