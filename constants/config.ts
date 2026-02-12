/**
 * JARVIS Configuration Constants
 * 
 * Centralized configuration for timing, limits, thresholds, and feature flags.
 * All magic numbers from across the codebase should be defined here.
 */

// ==================== TIMING ====================

export const TIMING = {
  /** Minimum time between requests (debounce) */
  DEBOUNCE_MS: 500,
  
  /** API request timeout */
  REQUEST_TIMEOUT_MS: 30000,
  
  /** Circuit breaker reset timeout */
  CIRCUIT_RESET_TIMEOUT_MS: 5000,
  
  /** Extended circuit timeout for critical failures */
  CIRCUIT_PENALTY_TIMEOUT_MS: 30000,
  
  /** VAD silence detection timeout */
  VAD_SILENCE_TIMEOUT: 1500,
  
  /** Maximum speech duration before auto-stop */
  VAD_SPEECH_TIMEOUT: 10000,
  
  /** Voice recognition restart delay after error */
  VOICE_RESTART_DELAY_MS: 100,
  
  /** Extended delay after consecutive errors */
  VOICE_ERROR_BACKOFF_MS: 5000,
  
  /** Maximum backoff for voice errors */
  VOICE_MAX_BACKOFF_MS: 10000,
  
  /** Delay before auto-idle in voice mode */
  VOICE_IDLE_TIMEOUT_MS: 15000,
  
  /** Short session threshold for voice */
  VOICE_SHORT_SESSION_MS: 500,
  
  /** Consecutive short sessions before backoff */
  VOICE_SHORT_SESSION_THRESHOLD: 5,
  
  /** Home Assistant initialization delay */
  HA_INIT_DELAY_MS: 3000,
  
  /** Proxy configuration timeout */
  PROXY_CONFIG_TIMEOUT_MS: 10000,
  
  /** WebSocket reconnection delay (base) */
  HA_WS_RECONNECT_DELAY_MS: 2000,
  
  /** WebSocket maximum reconnection delay */
  HA_WS_MAX_RECONNECT_DELAY_MS: 30000,
  
  /** WebSocket ping interval */
  HA_WS_PING_INTERVAL_MS: 30000,
  
  /** WebSocket pong timeout */
  HA_WS_PONG_TIMEOUT_MS: 10000,
  
  /** WebSocket connection timeout */
  HA_WS_CONNECTION_TIMEOUT_MS: 10000,
  
  /** Memory persistence debounce */
  MEMORY_PERSIST_DEBOUNCE_MS: 500,
  
  /** Memory auto-backup batch delay */
  MEMORY_BACKUP_BATCH_MS: 5000,
  
  /** Intent cache TTL */
  INTENT_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  
  /** Local intent pattern cache TTL */
  LOCAL_INTENT_CACHE_TTL_MS: 60000, // 1 minute
  
  /** Performance metrics retention */
  METRICS_RETENTION_COUNT: 100,
  
  /** Boot sequence minimum display time */
  BOOT_MIN_DISPLAY_MS: 2000,
  
  /** Camera initialization delay */
  CAMERA_INIT_DELAY_MS: 300,
  
  /** Capture state reset delay */
  CAPTURE_RESET_DELAY_MS: 300,
} as const;

// ==================== LIMITS ====================

export const LIMITS = {
  /** Maximum conversation context turns */
  MAX_CONTEXT_TURNS: 6,
  
  /** Maximum context character length */
  MAX_CONTEXT_CHARS: 2000,
  
  /** Maximum memory nodes */
  MAX_MEMORY_NODES: 10000,
  
  /** Maximum memory search results */
  MAX_MEMORY_RESULTS: 5,
  
  /** Maximum intent cache entries */
  INTENT_CACHE_SIZE: 50,
  
  /** Maximum local intent pattern cache */
  LOCAL_INTENT_CACHE_SIZE: 100,
  
  /** Maximum log entries to retain */
  MAX_LOG_ENTRIES: 100,
  
  /** Maximum recent logs for display */
  MAX_DISPLAY_LOGS: 100,
  
  /** Maximum stored corrections */
  MAX_CORRECTIONS: 50,
  
  /** Maximum Cortex event log */
  MAX_CORTEX_EVENTS: 500,
  
  /** Maximum audio context pool size */
  MAX_AUDIO_CONTEXTS: 2,
  
  /** Maximum TTS chunk length */
  MAX_TTS_CHUNK_LENGTH: 200,
  
  /** Maximum audio queue size */
  MAX_AUDIO_QUEUE_SIZE: 10,
  
  /** Maximum speech recognition alternatives */
  MAX_SPEECH_ALTERNATIVES: 1,
  
  /** Maximum consecutive voice errors */
  MAX_VOICE_ERRORS: 5,
  
  /** Maximum input length for validation */
  MAX_INPUT_LENGTH: 5000,
  
  /** Maximum API response length */
  MAX_API_RESPONSE_LENGTH: 10000,
  
  /** Maximum newlines in input */
  MAX_INPUT_NEWLINES: 50,
  
  /** Maximum character repetition */
  MAX_CHAR_REPETITION: 50,
  
  /** Maximum Home Assistant entities to fetch */
  MAX_HA_ENTITIES: 1000,
  
  /** Maximum HA entity search results */
  MAX_HA_SEARCH_RESULTS: 5,
  
  /** Maximum backup files to retain */
  MAX_BACKUPS: 10,
  
  /** Maximum auto-backup interval (minutes) */
  MAX_BACKUP_INTERVAL_MINUTES: 1440, // 24 hours
  
  /** Maximum plugin dependencies */
  MAX_PLUGIN_DEPENDENCIES: 10,
  
  /** Maximum proactive suggestions */
  MAX_PROACTIVE_SUGGESTIONS: 3,
  
  /** Maximum conversation turns per session */
  MAX_SESSION_TURNS: 100,
} as const;

// ==================== RATE LIMITING ====================

export const RATE_LIMITS = {
  GEMINI: {
    /** Daily request limit (conservative for free tier) */
    DAILY_REQUEST_LIMIT: 1400,
    
    /** Actual free tier limit */
    DAILY_REQUEST_HARD_LIMIT: 1500,
    
    /** Daily token limit */
    DAILY_TOKEN_LIMIT: 900000,
    
    /** Per-minute request limit */
    PER_MINUTE_REQUEST_LIMIT: 14,
    
    /** Per-minute token limit */
    PER_MINUTE_TOKEN_LIMIT: 90000,
    
    /** Token cost for text requests */
    TEXT_TOKEN_COST: 500,
    
    /** Token cost for vision requests */
    VISION_TOKEN_COST: 2000,
    
    /** Token cost for TTS requests */
    TTS_TOKEN_COST: 1000,
    
    /** Default cooldown after rate limit (seconds) */
    DEFAULT_COOLDOWN_SECONDS: 60,
  },
  
  /** Maximum retries for failed requests */
  MAX_RETRIES: 3,
  
  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY_MS: 1000,
  
  /** Maximum retry delay (ms) */
  RETRY_MAX_DELAY_MS: 10000,
} as const;

// ==================== THRESHOLDS ====================

export const THRESHOLDS = {
  /** High latency threshold (ms) */
  HIGH_LATENCY_MS: 1000,
  
  /** Circuit breaker failure threshold */
  CIRCUIT_FAILURE_THRESHOLD: 3,
  
  /** Circuit breaker success threshold for recovery */
  CIRCUIT_SUCCESS_THRESHOLD: 2,
  
  /** Cortex critical health threshold */
  CORTEX_CRITICAL_HEALTH: 40,
  
  /** Cortex degraded health threshold */
  CORTEX_DEGRADED_HEALTH: 70,
  
  /** Cortex stable health threshold */
  CORTEX_STABLE_HEALTH: 90,
  
  /** Local intent classifier high confidence */
  INTENT_HIGH_CONFIDENCE: 0.85,
  
  /** Local intent classifier medium confidence */
  INTENT_MEDIUM_CONFIDENCE: 0.75,
  
  /** Minimum confidence for entity matching */
  ENTITY_MATCH_MIN_SCORE: 5,
  
  /** Memory relevance score boost per access */
  MEMORY_RELEVANCE_BOOST: 0.1,
  
  /** Memory recency decay (days) */
  MEMORY_RECENCY_DECAY_DAYS: 30,
  
  /** VAD volume threshold (0-1) */
  VAD_VOLUME_THRESHOLD: 0.01,
  
  /** VAD smoothing factor */
  VAD_SMOOTHING: 0.8,
  
  /** Audio buffer size */
  AUDIO_BUFFER_SIZE: 4096,
  
  /** Audio sample rate */
  AUDIO_SAMPLE_RATE: 24000,
  
  /** Interrupt detection threshold (consecutive) */
  INTERRUPT_THRESHOLD: 3,
} as const;

// ==================== SCORING ====================

export const SCORING = {
  /** Exact match bonus for memory search */
  MEMORY_EXACT_MATCH_BONUS: 2.0,
  
  /** Word match score for memory search */
  MEMORY_WORD_MATCH_SCORE: 0.5,
  
  /** Tag match score for memory search */
  MEMORY_TAG_MATCH_SCORE: 0.7,
  
  /** Recency boost for memory search */
  MEMORY_RECENCY_BOOST: 0.2,
  
  /** Relevance score multiplier */
  MEMORY_RELEVANCE_MULTIPLIER: 0.1,
  
  /** Pattern match base score for intent */
  INTENT_PATTERN_MATCH_SCORE: 0.4,
  
  /** Keyword match score for intent */
  INTENT_KEYWORD_MATCH_SCORE: 0.15,
  
  /** Negative pattern penalty for intent */
  INTENT_NEGATIVE_PENALTY: 0.3,
  
  /** Multiple match bonus for intent */
  INTENT_MULTIPLE_MATCH_BONUS: 0.1,
  
  /** Short input penalty threshold */
  INTENT_SHORT_INPUT_THRESHOLD: 10,
  
  /** Short input penalty multiplier */
  INTENT_SHORT_INPUT_PENALTY: 0.9,
  
  /** HA entity name match score */
  HA_NAME_MATCH_SCORE: 5,
  
  /** HA entity ID match score */
  HA_ID_MATCH_SCORE: 3,
  
  /** HA domain match score */
  HA_DOMAIN_MATCH_SCORE: 5,
  
  /** HA exact phrase match bonus */
  HA_EXACT_MATCH_BONUS: 20,
} as const;

// ==================== FEATURE FLAGS ====================

export const FEATURES = {
  /** Enable voice activity detection */
  ENABLE_VAD: true,
  
  /** Enable neural TTS (Gemini) */
  ENABLE_NEURAL_TTS: true,
  
  /** Enable Piper TTS */
  ENABLE_PIPER_TTS: true,
  
  /** Enable proactive suggestions */
  ENABLE_PROACTIVE_SUGGESTIONS: true,
  
  /** Enable conversation learning */
  ENABLE_LEARNING: true,
  
  /** Enable sentiment analysis */
  ENABLE_SENTIMENT: true,
  
  /** Enable multi-turn reasoning */
  ENABLE_REASONING: true,
  
  /** Enable knowledge graph */
  ENABLE_KNOWLEDGE_GRAPH: true,
  
  /** Enable memory auto-backup */
  ENABLE_AUTO_BACKUP: false, // Disabled by default
  
  /** Enable WebSocket for Home Assistant */
  ENABLE_HA_WEBSOCKET: false, // Beta
  
  /** Enable vision analysis */
  ENABLE_VISION: true,
  
  /** Enable strict input validation */
  ENABLE_STRICT_VALIDATION: false,
  
  /** Enable performance monitoring */
  ENABLE_PERFORMANCE_MONITORING: true,
  
  /** Enable analytics */
  ENABLE_ANALYTICS: false,
  
  /** Enable thinking sounds during processing */
  ENABLE_THINKING_SOUNDS: true,
  
  /** Enable debug mode */
  ENABLE_DEBUG: import.meta.env?.DEV || false,
} as const;

// ==================== AUDIO ====================

export const AUDIO = {
  /** Default wake word */
  DEFAULT_WAKE_WORD: 'jarvis',
  
  /** Default voice type */
  DEFAULT_VOICE_TYPE: 'SYSTEM' as const,
  
  /** Default voice name */
  DEFAULT_VOICE_NAME: 'Kore',
  
  /** Default speech rate */
  DEFAULT_SPEECH_RATE: 1.0,
  
  /** Default speech pitch */
  DEFAULT_SPEECH_PITCH: 1.0,
  
  /** Supported voice types */
  VOICE_TYPES: ['SYSTEM', 'NEURAL', 'PIPER'] as const,
  
  /** Supported wake words */
  WAKE_WORDS: ['jarvis', 'jarvis', 'computer', 'assistant'] as const,
  
  /** Interrupt phrases */
  INTERRUPT_PHRASES: [
    'stop',
    'cancel',
    'shut up',
    'be quiet',
    'enough',
    'okay stop',
    'jarvis stop'
  ] as const,
  
  /** Context indicators for conversation */
  CONTEXT_INDICATORS: [
    'that', 'this', 'it', 'they', 'them', 'those', 'these',
    'earlier', 'before', 'previous', 'again', 'also',
    'what i said', 'what you said', 'like i mentioned',
    'as i said', 'remember when', 'you told me',
    'we talked about', 'you mentioned', 'i asked'
  ] as const,
} as const;

// ==================== AI MODELS ====================

export const AI_MODELS = {
  GEMINI: {
    /** Default text model */
    DEFAULT: 'gemini-2.0-flash' as const,
    
    /** Available models */
    AVAILABLE: [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ] as const,
    
    /** Vision model */
    VISION: 'gemini-2.5-flash-image' as const,
    
    /** TTS model */
    TTS: 'gemini-2.5-flash-preview-tts' as const,
    
    /** Default temperature */
    DEFAULT_TEMPERATURE: 0.7,
    
    /** Intent analysis temperature (lower for consistency) */
    INTENT_TEMPERATURE: 0.1,
  },
  
  OLLAMA: {
    /** Default model */
    DEFAULT: 'llama3' as const,
    
    /** Vision-capable models */
    VISION_MODELS: ['llava', 'bakllava', 'moondream', 'cogvlm', 'fuyu'] as const,
    
    /** Default URL */
    DEFAULT_URL: 'http://localhost:11434',
    
    /** Default temperature */
    DEFAULT_TEMPERATURE: 0.7,
  },
} as const;

// ==================== STORAGE KEYS ====================

export const STORAGE_KEYS = {
  /** Memory banks */
  MEMORY: 'jarvis_memory_banks_v2',
  
  /** Memory backups */
  MEMORY_BACKUPS: 'jarvis_memory_backups',
  
  /** Memory backup config */
  MEMORY_BACKUP_CONFIG: 'jarvis_memory_backup_config',
  
  /** AI configuration */
  AI_CONFIG: 'jarvis_ai_config',
  
  /** Ollama configuration */
  OLLAMA_CONFIG: 'jarvis_ollama_config',
  
  /** Voice configuration */
  VOICE_CONFIG: 'jarvis_voice_config',
  
  /** Rate limit stats */
  RATE_LIMIT: 'jarvis_gemini_rate_limit',
  
  /** Corrections/learned facts */
  CORRECTIONS: 'jarvis_corrections',
  
  /** Safe mode flag */
  SAFE_MODE: 'JARVIS_SAFE_MODE',
  
  /** API key prefix */
  API_KEY_PREFIX: 'JARVIS_API_KEY_',
  
  /** Legacy Gemini key (for migration) */
  LEGACY_GEMINI_KEY: 'GEMINI_API_KEY',
} as const;

// ==================== UI ====================

export const UI = {
  /** Animation duration (ms) */
  ANIMATION_DURATION_MS: 300,
  
  /** Toast display duration (ms) */
  TOAST_DURATION_MS: 5000,
  
  /** Modal transition duration (ms) */
  MODAL_TRANSITION_MS: 200,
  
  /** Debounce for search inputs (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  
  /** Virtual list item height */
  VIRTUAL_LIST_ITEM_HEIGHT: 50,
  
  /** Virtual list overscan */
  VIRTUAL_LIST_OVERSCAN: 5,
} as const;

// ==================== VECTOR DB (v1.4.0) ====================

export const VECTOR_DB = {
  /** Embedding dimension (384 for all-MiniLM-L6-v2) */
  EMBEDDING_DIMENSION: 384,
  
  /** Maximum vectors in memory cache */
  MAX_CACHE_SIZE: 1000,
  
  /** Similarity threshold for semantic search */
  SIMILARITY_THRESHOLD: 0.7,
  
  /** HNSW index parameters */
  HNSW: {
    M: 16,              // Number of bi-directional links
    efConstruction: 200, // Size of dynamic candidate list
    efSearch: 100,      // Size of search candidate list
  },
  
  /** Memory compression age (days) */
  COMPRESSION_AGE_DAYS: 30,
  
  /** Archive age (days) */
  ARCHIVE_AGE_DAYS: 365,
  
  /** IndexedDB database name */
  DB_NAME: 'jarvis_vector_db_v1',
  
  /** IndexedDB store name */
  STORE_NAME: 'vectors',
  
  /** IndexedDB version */
  DB_VERSION: 1,
  
  /** Batch size for bulk operations */
  BATCH_SIZE: 100,
  
  /** Sync interval (ms) */
  SYNC_INTERVAL_MS: 30000,
} as const;

// ==================== CONTEXT WINDOW (v1.4.0) ====================

export const CONTEXT_WINDOW = {
  /** Gemini 2.0 Flash context limit */
  GEMINI_FLASH_LIMIT: 1_000_000,
  
  /** Gemini 2.5 Flash context limit */
  GEMINI_25_FLASH_LIMIT: 1_000_000,
  
  /** Ollama default context limit */
  OLLAMA_DEFAULT_LIMIT: 8192,
  
  /** Reserved tokens for system prompt */
  SYSTEM_PROMPT_RESERVE: 1000,
  
  /** Reserved tokens for response */
  RESPONSE_RESERVE: 2000,
  
  /** Token estimation ratio (chars per token) */
  CHARS_PER_TOKEN: 4,
  
  /** Summary trigger threshold (0-1) */
  SUMMARY_THRESHOLD: 0.8,
  
  /** Max summary length (tokens) */
  MAX_SUMMARY_TOKENS: 500,
  
  /** Conversation turn priority decay */
  TURN_DECAY_FACTOR: 0.9,
  
  /** Minimum turns to keep */
  MIN_TURNS: 2,
  
  /** Maximum turns before forced summary */
  MAX_TURNS_BEFORE_SUMMARY: 20,
  
  /** Reserved tokens (calculated as system + response reserve) */
  RESERVED: 3000, // SYSTEM_PROMPT_RESERVE + RESPONSE_RESERVE
} as const;

// ==================== AGENT SYSTEM (v1.4.2) ====================

export const AGENT = {
  /** Maximum concurrent tasks */
  MAX_CONCURRENT_TASKS: 3,
  
  /** Default max retries per task */
  DEFAULT_MAX_RETRIES: 3,
  
  /** Base retry delay (ms) */
  RETRY_DELAY_MS: 1000,
  
  /** Maximum retry delay (ms) */
  MAX_RETRY_DELAY_MS: 30000,
  
  /** Enable parallel task execution */
  ENABLE_PARALLEL_EXECUTION: true,
  
  /** Progress update interval (ms) */
  PROGRESS_UPDATE_INTERVAL_MS: 2000,
  
  /** Require confirmation for high/critical priority */
  REQUIRE_CONFIRMATION_FOR: ['high', 'critical'] as const,
  
  /** Maximum goal execution time (ms) */
  MAX_GOAL_EXECUTION_TIME_MS: 5 * 60 * 1000, // 5 minutes
  
  /** Task decomposition max tasks */
  MAX_DECOMPOSED_TASKS: 10,
  
  /** Task decomposition min tasks */
  MIN_DECOMPOSED_TASKS: 1,
  
  /** Enable agent for complex queries */
  ENABLE_AUTO_AGENT_DETECTION: true,
  
  /** Complexity threshold for auto-agent */
  COMPLEXITY_THRESHOLD: 0.7,
} as const;

// ==================== EXPORT ALL ====================

export const CONFIG = {
  TIMING,
  LIMITS,
  RATE_LIMITS,
  THRESHOLDS,
  SCORING,
  FEATURES,
  AUDIO,
  AI_MODELS,
  STORAGE_KEYS,
  UI,
} as const;

export default CONFIG;
