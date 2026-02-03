/**
 * Enhanced Structured Logging Service
 * 
 * Provides comprehensive logging with:
 * - Structured log entries with metadata
 * - Multiple log levels
 * - In-memory buffering
 * - Export capabilities
 * - Integration with Cortex health monitoring
 */

import { cortex } from './cortex';
import { HealthEventType, ImpactLevel } from '../types';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL'
};

export interface LogContext {
  component?: string;
  service?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  source: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata: {
    url: string;
    userAgent: string;
    sessionDuration?: number;
  };
}

export interface LoggerConfig {
  minLevel: LogLevel;
  maxBufferSize: number;
  enableConsole: boolean;
  enableCortex: boolean;
  enablePersistence: boolean;
  persistenceKey: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
  maxBufferSize: 1000,
  enableConsole: true,
  enableCortex: true,
  enablePersistence: false, // Disabled by default for performance
  persistenceKey: 'jarvis_logs'
};

class EnhancedLogger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private sessionStartTime: number = Date.now();
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateId();
    
    // Load persisted logs if enabled
    if (this.config.enablePersistence) {
      this.loadPersistedLogs();
    }
  }

  // ==================== PUBLIC API ====================

  /**
   * Log a debug message
   */
  debug(source: string, message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, source, message, context);
  }

  /**
   * Log an info message
   */
  info(source: string, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, source, message, context);
  }

  /**
   * Log a warning message
   */
  warn(source: string, message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, source, message, context, error);
  }

  /**
   * Log an error message
   */
  error(source: string, message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, source, message, context, error);
  }

  /**
   * Log a fatal error
   */
  fatal(source: string, message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.FATAL, source, message, context, error);
  }

  /**
   * Main logging method
   */
  log(
    level: LogLevel,
    source: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    // Check minimum level
    if (level < this.config.minLevel) {
      return;
    }

    const entry = this.createEntry(level, source, message, context, error);
    
    // Add to buffer
    this.buffer.push(entry);
    
    // Maintain buffer size
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Cortex integration for errors
    if (this.config.enableCortex && level >= LogLevel.ERROR) {
      this.reportToCortex(entry);
    }

    // Persistence
    if (this.config.enablePersistence) {
      this.persistLogs();
    }
  }

  /**
   * Get recent logs
   */
  getRecent(count: number = 100, minLevel?: LogLevel): LogEntry[] {
    let logs = [...this.buffer];
    
    if (minLevel !== undefined) {
      logs = logs.filter(l => l.level >= minLevel);
    }
    
    return logs.slice(-count);
  }

  /**
   * Get logs by source
   */
  getBySource(source: string, count: number = 100): LogEntry[] {
    return this.buffer
      .filter(l => l.source === source)
      .slice(-count);
  }

  /**
   * Get logs by level
   */
  getByLevel(level: LogLevel, count: number = 100): LogEntry[] {
    return this.buffer
      .filter(l => l.level === level)
      .slice(-count);
  }

  /**
   * Search logs
   */
  search(query: string, count: number = 100): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.buffer
      .filter(l => 
        l.message.toLowerCase().includes(lowerQuery) ||
        l.source.toLowerCase().includes(lowerQuery)
      )
      .slice(-count);
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    bySource: Record<string, number>;
    timeRange: { start: Date; end: Date } | null;
  } {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0
    };
    
    const bySource: Record<string, number> = {};
    
    for (const entry of this.buffer) {
      byLevel[entry.level]++;
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    }
    
    const timeRange = this.buffer.length > 0 ? {
      start: this.buffer[0].timestamp,
      end: this.buffer[this.buffer.length - 1].timestamp
    } : null;
    
    return {
      total: this.buffer.length,
      byLevel,
      bySource,
      timeRange
    };
  }

  /**
   * Export logs to JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStartTime,
      config: this.config,
      logs: this.buffer
    }, null, 2);
  }

  /**
   * Export logs to file
   */
  exportToFile(): void {
    const json = this.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.buffer = [];
    if (this.config.enablePersistence) {
      localStorage.removeItem(this.config.persistenceKey);
    }
  }

  /**
   * Update logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a scoped logger for a specific component/service
   */
  scope(source: string, defaultContext?: LogContext) {
    return {
      debug: (message: string, context?: LogContext) => 
        this.debug(source, message, { ...defaultContext, ...context }),
      info: (message: string, context?: LogContext) => 
        this.info(source, message, { ...defaultContext, ...context }),
      warn: (message: string, context?: LogContext, error?: Error) => 
        this.warn(source, message, { ...defaultContext, ...context }, error),
      error: (message: string, context?: LogContext, error?: Error) => 
        this.error(source, message, { ...defaultContext, ...context }, error),
      fatal: (message: string, context?: LogContext, error?: Error) => 
        this.fatal(source, message, { ...defaultContext, ...context }, error)
    };
  }

  // ==================== PRIVATE METHODS ====================

  private createEntry(
    level: LogLevel,
    source: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      levelName: LogLevelNames[level],
      source,
      message,
      context: {
        ...context,
        sessionId: this.sessionId
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionDuration: Date.now() - this.sessionStartTime
      }
    };
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] ${entry.levelName} [${entry.source}]`;
    
    const styles: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: 'color: #6b7280',
      [LogLevel.INFO]: 'color: #3b82f6',
      [LogLevel.WARN]: 'color: #f59e0b',
      [LogLevel.ERROR]: 'color: #ef4444; font-weight: bold',
      [LogLevel.FATAL]: 'color: #dc2626; font-weight: bold; background: #fee2e2'
    };

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`%c${prefix}`, styles[entry.level], entry.message, entry.context || '');
        break;
      case LogLevel.INFO:
        console.info(`%c${prefix}`, styles[entry.level], entry.message, entry.context || '');
        break;
      case LogLevel.WARN:
        console.warn(`%c${prefix}`, styles[entry.level], entry.message, entry.context || '', entry.error || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`%c${prefix}`, styles[entry.level], entry.message, entry.context || '', entry.error || '');
        break;
    }
  }

  private reportToCortex(entry: LogEntry): void {
    const eventType = entry.level === LogLevel.FATAL 
      ? HealthEventType.CRASH 
      : entry.level === LogLevel.ERROR 
      ? HealthEventType.API_ERROR 
      : HealthEventType.RESOURCE_SPIKE;
    
    const impact = entry.level === LogLevel.FATAL 
      ? ImpactLevel.CRITICAL 
      : entry.level === LogLevel.ERROR 
      ? ImpactLevel.HIGH 
      : ImpactLevel.MEDIUM;

    cortex.reportEvent({
      sourceId: `logger.${entry.source}`,
      type: eventType,
      impact,
      latencyMs: 0,
      context: {
        message: entry.message,
        errorMessage: entry.error?.message
      }
    });
  }

  private persistLogs(): void {
    try {
      const data = JSON.stringify(this.buffer);
      localStorage.setItem(this.config.persistenceKey, data);
    } catch (e) {
      // If storage is full, clear and try again with smaller buffer
      console.warn('[Logger] Failed to persist logs, clearing buffer');
      this.buffer = this.buffer.slice(-this.config.maxBufferSize / 2);
    }
  }

  private loadPersistedLogs(): void {
    try {
      const data = localStorage.getItem(this.config.persistenceKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.buffer = parsed.slice(-this.config.maxBufferSize);
        }
      }
    } catch (e) {
      console.warn('[Logger] Failed to load persisted logs');
    }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export singleton instance
export const loggerEnhanced = new EnhancedLogger();

// Backward compatibility with existing logger
export const logger = {
  log: (source: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', details?: any) => {
    const levelMap: Record<string, LogLevel> = {
      'info': LogLevel.INFO,
      'success': LogLevel.INFO,
      'warning': LogLevel.WARN,
      'error': LogLevel.ERROR
    };
    
    loggerEnhanced.log(levelMap[type] || LogLevel.INFO, source, message, { details });
  },
  getRecent: (count: number) => loggerEnhanced.getRecent(count)
};

// React hook for component logging
export function useLogger(source: string, defaultContext?: LogContext) {
  return loggerEnhanced.scope(source, defaultContext);
}

export default loggerEnhanced;
