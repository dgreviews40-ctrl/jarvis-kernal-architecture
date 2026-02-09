/**
 * JARVIS Error Type System
 * 
 * Structured error hierarchy with:
 * - Error classification (retryable vs fatal)
 * - Retry strategies per error type
 * - HTTP status code mapping
 * - Error code enumeration for programmatic handling
 */

import { logger } from './logger';

/** Error severity levels */
export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

/** Error codes for programmatic handling */
export enum ErrorCode {
  // Network errors (1xxx)
  NETWORK_ERROR = 'NET_001',
  CONNECTION_TIMEOUT = 'NET_002',
  CONNECTION_REFUSED = 'NET_003',
  DNS_LOOKUP_FAILED = 'NET_004',
  SSL_CERTIFICATE_ERROR = 'NET_005',
  
  // HTTP errors (2xxx)
  HTTP_BAD_REQUEST = 'HTTP_400',
  HTTP_UNAUTHORIZED = 'HTTP_401',
  HTTP_FORBIDDEN = 'HTTP_403',
  HTTP_NOT_FOUND = 'HTTP_404',
  HTTP_RATE_LIMIT = 'HTTP_429',
  HTTP_SERVER_ERROR = 'HTTP_500',
  HTTP_SERVICE_UNAVAILABLE = 'HTTP_503',
  HTTP_GATEWAY_TIMEOUT = 'HTTP_504',
  
  // API errors (3xxx)
  API_KEY_INVALID = 'API_001',
  API_KEY_EXPIRED = 'API_002',
  API_QUOTA_EXCEEDED = 'API_003',
  API_INVALID_REQUEST = 'API_004',
  API_MODEL_NOT_FOUND = 'API_005',
  API_CONTENT_FILTERED = 'API_006',
  
  // Validation errors (4xxx)
  VALIDATION_ERROR = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  MISSING_REQUIRED_FIELD = 'VAL_003',
  INVALID_FORMAT = 'VAL_004',
  SCHEMA_MISMATCH = 'VAL_005',
  
  // Resource errors (5xxx)
  RESOURCE_NOT_FOUND = 'RES_001',
  RESOURCE_ALREADY_EXISTS = 'RES_002',
  RESOURCE_LOCKED = 'RES_003',
  RESOURCE_EXHAUSTED = 'RES_004',
  
  // Runtime errors (6xxx)
  RUNTIME_ERROR = 'RUN_001',
  NULL_POINTER = 'RUN_002',
  TYPE_ERROR = 'RUN_003',
  INDEX_OUT_OF_BOUNDS = 'RUN_004',
  
  // Plugin errors (7xxx)
  PLUGIN_LOAD_ERROR = 'PLG_001',
  PLUGIN_EXECUTION_ERROR = 'PLG_002',
  PLUGIN_SANDBOX_ERROR = 'PLG_003',
  PLUGIN_TIMEOUT = 'PLG_004',
  PLUGIN_PERMISSION_DENIED = 'PLG_005',
  
  // Security errors (8xxx)
  SECURITY_ERROR = 'SEC_001',
  PERMISSION_DENIED = 'SEC_002',
  ENCRYPTION_ERROR = 'SEC_003',
  DECRYPTION_ERROR = 'SEC_004',
  TOKEN_INVALID = 'SEC_005',
  
  // Unknown
  UNKNOWN_ERROR = 'UNK_000'
}

/** Retry strategy configuration */
export interface RetryStrategy {
  /** Whether this error type is retryable */
  retryable: boolean;
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (1 = linear, 2 = exponential) */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd */
  useJitter: boolean;
  /** Optional: fixed retry-after duration (for rate limits) */
  fixedRetryAfterMs?: number;
}

/** Fatal retry strategy - no retries */
const FATAL_STRATEGY: RetryStrategy = {
  retryable: false,
  maxAttempts: 0,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  useJitter: false
};

/** Default retry strategy for transient errors */
const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  retryable: true,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true
};

/** Network error retry strategy with more attempts */
const NETWORK_RETRY_STRATEGY: RetryStrategy = {
  retryable: true,
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  useJitter: true
};

/** Rate limit retry strategy */
const RATE_LIMIT_STRATEGY: RetryStrategy = {
  retryable: true,
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 1, // Linear backoff for rate limits
  useJitter: true,
  fixedRetryAfterMs: 5000
};

/** Error code to retry strategy mapping */
export const ERROR_RETRY_STRATEGIES: Record<ErrorCode, RetryStrategy> = {
  // Network errors - highly retryable
  [ErrorCode.NETWORK_ERROR]: NETWORK_RETRY_STRATEGY,
  [ErrorCode.CONNECTION_TIMEOUT]: { ...NETWORK_RETRY_STRATEGY, maxAttempts: 3 },
  [ErrorCode.CONNECTION_REFUSED]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 2 },
  [ErrorCode.DNS_LOOKUP_FAILED]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 3 },
  [ErrorCode.SSL_CERTIFICATE_ERROR]: FATAL_STRATEGY,
  
  // HTTP errors - selective retry
  [ErrorCode.HTTP_BAD_REQUEST]: FATAL_STRATEGY,
  [ErrorCode.HTTP_UNAUTHORIZED]: FATAL_STRATEGY,
  [ErrorCode.HTTP_FORBIDDEN]: FATAL_STRATEGY,
  [ErrorCode.HTTP_NOT_FOUND]: FATAL_STRATEGY,
  [ErrorCode.HTTP_RATE_LIMIT]: RATE_LIMIT_STRATEGY,
  [ErrorCode.HTTP_SERVER_ERROR]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 3 },
  [ErrorCode.HTTP_SERVICE_UNAVAILABLE]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 5 },
  [ErrorCode.HTTP_GATEWAY_TIMEOUT]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 3 },
  
  // API errors - mostly fatal
  [ErrorCode.API_KEY_INVALID]: FATAL_STRATEGY,
  [ErrorCode.API_KEY_EXPIRED]: FATAL_STRATEGY,
  [ErrorCode.API_QUOTA_EXCEEDED]: { ...RATE_LIMIT_STRATEGY, maxAttempts: 2 },
  [ErrorCode.API_INVALID_REQUEST]: FATAL_STRATEGY,
  [ErrorCode.API_MODEL_NOT_FOUND]: FATAL_STRATEGY,
  [ErrorCode.API_CONTENT_FILTERED]: FATAL_STRATEGY,
  
  // Validation errors - never retry
  [ErrorCode.VALIDATION_ERROR]: FATAL_STRATEGY,
  [ErrorCode.INVALID_INPUT]: FATAL_STRATEGY,
  [ErrorCode.MISSING_REQUIRED_FIELD]: FATAL_STRATEGY,
  [ErrorCode.INVALID_FORMAT]: FATAL_STRATEGY,
  [ErrorCode.SCHEMA_MISMATCH]: FATAL_STRATEGY,
  
  // Resource errors - sometimes retryable
  [ErrorCode.RESOURCE_NOT_FOUND]: FATAL_STRATEGY,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: FATAL_STRATEGY,
  [ErrorCode.RESOURCE_LOCKED]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 3 },
  [ErrorCode.RESOURCE_EXHAUSTED]: { ...RATE_LIMIT_STRATEGY, maxAttempts: 2 },
  
  // Runtime errors - depends on context
  [ErrorCode.RUNTIME_ERROR]: FATAL_STRATEGY,
  [ErrorCode.NULL_POINTER]: FATAL_STRATEGY,
  [ErrorCode.TYPE_ERROR]: FATAL_STRATEGY,
  [ErrorCode.INDEX_OUT_OF_BOUNDS]: FATAL_STRATEGY,
  
  // Plugin errors - some retryable
  [ErrorCode.PLUGIN_LOAD_ERROR]: FATAL_STRATEGY,
  [ErrorCode.PLUGIN_EXECUTION_ERROR]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 1 },
  [ErrorCode.PLUGIN_SANDBOX_ERROR]: FATAL_STRATEGY,
  [ErrorCode.PLUGIN_TIMEOUT]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 2 },
  [ErrorCode.PLUGIN_PERMISSION_DENIED]: FATAL_STRATEGY,
  
  // Security errors - never retry
  [ErrorCode.SECURITY_ERROR]: FATAL_STRATEGY,
  [ErrorCode.PERMISSION_DENIED]: FATAL_STRATEGY,
  [ErrorCode.ENCRYPTION_ERROR]: FATAL_STRATEGY,
  [ErrorCode.DECRYPTION_ERROR]: FATAL_STRATEGY,
  [ErrorCode.TOKEN_INVALID]: FATAL_STRATEGY,
  
  // Unknown - conservative retry
  [ErrorCode.UNKNOWN_ERROR]: { ...DEFAULT_RETRY_STRATEGY, maxAttempts: 1 }
};

/** HTTP status to error code mapping */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400: return ErrorCode.HTTP_BAD_REQUEST;
    case 401: return ErrorCode.HTTP_UNAUTHORIZED;
    case 403: return ErrorCode.HTTP_FORBIDDEN;
    case 404: return ErrorCode.HTTP_NOT_FOUND;
    case 429: return ErrorCode.HTTP_RATE_LIMIT;
    case 500: return ErrorCode.HTTP_SERVER_ERROR;
    case 503: return ErrorCode.HTTP_SERVICE_UNAVAILABLE;
    case 504: return ErrorCode.HTTP_GATEWAY_TIMEOUT;
    default:
      if (status >= 400 && status < 500) return ErrorCode.HTTP_BAD_REQUEST;
      if (status >= 500) return ErrorCode.HTTP_SERVER_ERROR;
      return ErrorCode.UNKNOWN_ERROR;
  }
}

/** Base JARVIS Error class */
export class JARVISError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;
  protected _retryStrategy: RetryStrategy;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'JARVISError';
    this.code = code;
    this.severity = severity;
    this._retryStrategy = ERROR_RETRY_STRATEGIES[code];
    this.timestamp = Date.now();
    this.context = context;
    this.cause = cause;
    
    // Ensure proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Get retry strategy for this error */
  get retryStrategy(): RetryStrategy {
    return this._retryStrategy;
  }

  /** Check if this error is retryable */
  get isRetryable(): boolean {
    return this.retryStrategy.retryable;
  }

  /** Get formatted error for logging */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack
    };
  }
}

/** Network-related errors */
export class NetworkError extends JARVISError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.ERROR, context, cause);
    this.name = 'NetworkError';
  }
}

/** Timeout errors */
export class TimeoutError extends JARVISError {
  public readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    code: ErrorCode = ErrorCode.CONNECTION_TIMEOUT,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.WARNING, context, cause);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Authentication errors */
export class AuthError extends JARVISError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.HTTP_UNAUTHORIZED,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.ERROR, context, cause);
    this.name = 'AuthError';
  }
}

/** Rate limit / quota errors */
export class QuotaError extends JARVISError {
  public readonly retryAfterMs?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.API_QUOTA_EXCEEDED,
    retryAfterMs?: number,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.WARNING, context, cause);
    this.name = 'QuotaError';
    this.retryAfterMs = retryAfterMs;
    
    // Update retry strategy with specific retry-after if provided
    if (retryAfterMs) {
      this._retryStrategy = {
        ...this._retryStrategy,
        fixedRetryAfterMs: retryAfterMs
      };
    }
  }
}

/** Validation errors */
export class ValidationError extends JARVISError {
  public readonly field?: string;

  constructor(
    message: string,
    field?: string,
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.WARNING, context, cause);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** Plugin errors */
export class PluginError extends JARVISError {
  public readonly pluginId?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PLUGIN_EXECUTION_ERROR,
    pluginId?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.ERROR, context, cause);
    this.name = 'PluginError';
    this.pluginId = pluginId;
  }
}

/** Security errors */
export class SecurityError extends JARVISError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SECURITY_ERROR,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, ErrorSeverity.FATAL, context, cause);
    this.name = 'SecurityError';
  }
}

/** Classify a generic error into a JARVISError */
export function classifyError(
  error: unknown,
  context?: Record<string, unknown>
): JARVISError {
  // Already a JARVISError
  if (error instanceof JARVISError) {
    return error;
  }

  // Extract error message
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  const originalError = error instanceof Error ? error : undefined;

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enetunreach')
  ) {
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
      return new TimeoutError(message, 30000, ErrorCode.CONNECTION_TIMEOUT, context, originalError);
    }
    if (lowerMessage.includes('refused')) {
      return new NetworkError(message, ErrorCode.CONNECTION_REFUSED, context, originalError);
    }
    return new NetworkError(message, ErrorCode.NETWORK_ERROR, context, originalError);
  }

  // Timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('abort')
  ) {
    return new TimeoutError(message, 30000, ErrorCode.CONNECTION_TIMEOUT, context, originalError);
  }

  // HTTP status code errors (from message)
  const statusMatch = message.match(/\b(\d{3})\b/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    const code = httpStatusToErrorCode(status);
    
    if (status === 401 || status === 403) {
      return new AuthError(message, code, context, originalError);
    }
    if (status === 429) {
      // Extract retry-after if present
      const retryMatch = message.match(/retry[_-]?after[:\s]*(\d+)/i);
      const retryAfterMs = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : undefined;
      return new QuotaError(message, code, retryAfterMs, context, originalError);
    }
    
    return new JARVISError(message, code, ErrorSeverity.ERROR, context, originalError);
  }

  // Auth errors
  if (
    lowerMessage.includes('auth') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('token') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('invalid_key')
  ) {
    return new AuthError(message, ErrorCode.API_KEY_INVALID, context, originalError);
  }

  // Rate limit / quota errors
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('too many requests')
  ) {
    return new QuotaError(message, ErrorCode.API_QUOTA_EXCEEDED, undefined, context, originalError);
  }

  // Validation errors
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('schema')
  ) {
    return new ValidationError(message, undefined, ErrorCode.VALIDATION_ERROR, context, originalError);
  }

  // Not found errors
  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('404') ||
    lowerMessage.includes('does not exist')
  ) {
    return new JARVISError(message, ErrorCode.RESOURCE_NOT_FOUND, ErrorSeverity.WARNING, context, originalError);
  }

  // Plugin errors
  if (
    lowerMessage.includes('plugin') ||
    lowerMessage.includes('sandbox')
  ) {
    return new PluginError(message, ErrorCode.PLUGIN_EXECUTION_ERROR, undefined, context, originalError);
  }

  // Security errors
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('access denied') ||
    lowerMessage.includes('security')
  ) {
    return new SecurityError(message, ErrorCode.PERMISSION_DENIED, context, originalError);
  }

  // Default: unknown error
  return new JARVISError(message, ErrorCode.UNKNOWN_ERROR, ErrorSeverity.ERROR, context, originalError);
}

/** Calculate delay for a specific retry attempt based on error type */
export function calculateRetryDelay(
  error: JARVISError,
  attempt: number
): number {
  const strategy = error.retryStrategy;
  
  if (!strategy.retryable || attempt > strategy.maxAttempts) {
    return -1; // Signal to not retry
  }

  // Use fixed retry-after for rate limits if specified
  if (error instanceof QuotaError && error.retryAfterMs) {
    return error.retryAfterMs;
  }
  if (strategy.fixedRetryAfterMs) {
    return strategy.fixedRetryAfterMs;
  }

  // Calculate exponential backoff
  let delay = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attempt - 1);
  delay = Math.min(delay, strategy.maxDelayMs);

  // Add jitter to prevent thundering herd
  if (strategy.useJitter) {
    delay += Math.random() * 1000;
  }

  return Math.round(delay);
}

/** Check if an error is retryable */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof JARVISError) {
    return error.isRetryable;
  }
  // For unknown errors, be conservative
  return false;
}

/** Get retry strategy for an error */
export function getRetryStrategy(error: unknown): RetryStrategy {
  if (error instanceof JARVISError) {
    return error.retryStrategy;
  }
  return ERROR_RETRY_STRATEGIES[ErrorCode.UNKNOWN_ERROR];
}

/** Valid log sources from LogEntry */
type LogSource = 'KERNEL' | 'GEMINI' | 'PLUGIN' | 'USER' | 'SYSTEM' | 'CIRCUIT_BREAKER' | 'REGISTRY' | 'MEMORY' | 'OLLAMA' | 'VOICE' | 'VISION' | 'CORTEX' | 'DEV_HOST' | 'GRAPH' | 'CONVERSATION' | 'HOME_ASSISTANT' | 'AGENT' | 'WEBSOCKET' | 'CACHE' | 'SECURITY' | 'RESILIENCE' | 'PREDICTIVE' | 'PERFORMANCE' | 'TESTING' | 'SETTINGS' | 'MARKETPLACE' | 'ERROR' | 'BACKUP' | 'FILE_GENERATOR' | 'VECTOR_DB' | 'CONTEXT_WINDOW' | 'INTELLIGENCE' | 'DISPLAY' | 'WEATHER' | 'PIPER' | 'TIMER' | 'ERROR_HANDLER' | 'NOTIFICATION' | 'GLOBAL' | 'PLUGIN_LOADER' | 'VECTOR_MEMORY' | 'STREAMING' | 'CORE_OS' | 'BOOT' | 'IMAGE_GENERATOR' | 'SUGGESTION' | 'PREDICTION' | 'ANALYTICS' | 'MIGRATION' | 'LEARNING' | 'SEARCH' | 'QUERY';

/** Log error with appropriate severity */
export function logError(error: unknown, context?: string): void {
  const jarvisError = error instanceof JARVISError 
    ? error 
    : classifyError(error, context ? { context } : undefined);

  const logData = {
    code: jarvisError.code,
    isRetryable: jarvisError.isRetryable,
    context: jarvisError.context,
    cause: jarvisError.cause?.message
  };

  // Use ERROR_HANDLER as source, include context in logData if provided
  const source: LogSource = 'ERROR_HANDLER';
  const details = context ? { ...logData, originalContext: context } : logData;

  switch (jarvisError.severity) {
    case ErrorSeverity.DEBUG:
      logger.debug(source, jarvisError.message, details);
      break;
    case ErrorSeverity.INFO:
      logger.info(source, jarvisError.message, details);
      break;
    case ErrorSeverity.WARNING:
      logger.warning(source, jarvisError.message, details);
      break;
    case ErrorSeverity.ERROR:
      logger.error(source, jarvisError.message, details);
      break;
    case ErrorSeverity.FATAL:
      logger.error(source, jarvisError.message, { ...details, fatal: true });
      break;
  }
}
