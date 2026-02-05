/**
 * Unified Logging Service for JARVIS
 * 
 * Consolidated from:
 * - logger.ts: Persistence, filtering, search
 * - loggerEnhanced.ts: Cortex integration, structured logging
 * 
 * This is the single source of truth for all logging.
 */

import { LogEntry } from "../types";
import { cortex } from "./cortex";
import { HealthEventType, ImpactLevel } from "../types";

export type LogLevel = 'all' | 'info' | 'success' | 'warning' | 'error';
export type LogSource = 'all' | LogEntry['source'];

export interface LogFilter {
  level?: LogLevel;
  source?: LogSource;
  searchQuery?: string;
  startTime?: number;
  endTime?: number;
}

export interface LogStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  oldestLog: number;
  newestLog: number;
}

export interface LoggerConfig {
  maxLogs: number;
  autoCleanup: boolean;
  cleanupDays: number;
  persistLogs: boolean;
  enableConsole: boolean;
  enableCortex: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxLogs: 1000,
  autoCleanup: true,
  cleanupDays: 7,
  persistLogs: true,
  enableConsole: true,
  enableCortex: true
};

const STORAGE_KEY = 'jarvis_logs';
const CONFIG_KEY = 'jarvis_logger_config';

class LoggerService {
  private logs: LogEntry[] = [];
  private config: LoggerConfig = { ...DEFAULT_CONFIG };
  private observers: ((logs: LogEntry[]) => void)[] = [];
  private filterObservers: ((filteredLogs: LogEntry[]) => void)[] = [];
  private currentFilter: LogFilter = {};

  constructor() {
    this.loadConfig();
    this.loadLogs();
    this.cleanupOldLogs();
  }

  // ==================== CONFIGURATION ====================

  private loadConfig(): void {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        this.config = { ...DEFAULT_CONFIG };
      }
    }
  }

  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  public setConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    
    if (updates.maxLogs && this.logs.length > updates.maxLogs) {
      this.trimLogs();
    }
  }

  // ==================== PERSISTENCE ====================

  private loadLogs(): void {
    if (!this.config.persistLogs) {
      this.logs = [];
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Restore Date objects from strings
        this.logs = parsed.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      } catch {
        this.logs = [];
      }
    }
  }

  private persistLogs(): void {
    if (!this.config.persistLogs) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // localStorage might be full, trim logs
      this.trimLogs();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
      } catch {
        console.error('[LOGGER] Failed to persist logs - storage full');
      }
    }
  }

  private trimLogs(): void {
    if (this.logs.length > this.config.maxLogs) {
      // Keep only the most recent logs to prevent memory bloat
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
  }

  private cleanupOldLogs(): void {
    if (!this.config.autoCleanup) return;

    const cutoffTime = Date.now() - (this.config.cleanupDays * 24 * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp.getTime() > cutoffTime);
    
    if (this.logs.length < initialCount) {
      this.persistLogs();
    }
  }

  // ==================== LOGGING ====================

  public log(
    source: LogEntry['source'],
    message: string,
    type: LogEntry['type'] = 'info',
    details?: Record<string, unknown> | string | number | boolean | object
  ): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      source,
      message,
      type,
      details
    };

    this.logs.push(entry);
    
    // Trim if needed
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Cortex integration for errors
    if (this.config.enableCortex && (type === 'error')) {
      this.reportToCortex(entry);
    }

    this.persistLogs();
    this.notifyObservers();
    
    return entry;
  }

  public info(source: LogEntry['source'], message: string, details?: any): LogEntry {
    return this.log(source, message, 'info', details);
  }

  public success(source: LogEntry['source'], message: string, details?: any): LogEntry {
    return this.log(source, message, 'success', details);
  }

  public warning(source: LogEntry['source'], message: string, details?: any): LogEntry {
    return this.log(source, message, 'warning', details);
  }

  public error(source: LogEntry['source'], message: string, details?: any): LogEntry {
    return this.log(source, message, 'error', details);
  }

  public debug(source: LogEntry['source'], message: string, details?: any): LogEntry {
    // Debug messages are only logged to console, not stored
    if (this.config.enableConsole) {
      console.debug(`[DEBUG] [${source}] ${message}`, details || '');
    }
    return this.log(source, message, 'info', details);
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.type.toUpperCase()}] [${entry.source}]`;
    
    const consoleMethod: Record<string, Function> = {
      'info': console.info,
      'success': console.log,
      'warning': console.warn,
      'error': console.error
    };

    const method = consoleMethod[entry.type] || console.log;
    
    if (entry.details) {
      method(prefix, entry.message, entry.details);
    } else {
      method(prefix, entry.message);
    }
  }

  private reportToCortex(entry: LogEntry): void {
    cortex.reportEvent({
      sourceId: entry.source,
      type: HealthEventType.ERROR,
      impact: ImpactLevel.MEDIUM,
      latencyMs: 0,
      context: { 
        message: entry.message,
        details: entry.details
      }
    });
  }

  private generateId(): string {
    return 'log_' + Math.random().toString(36).substring(2, 11);
  }

  // ==================== QUERY & FILTER ====================

  public getAll(): LogEntry[] {
    return [...this.logs];
  }

  public getRecent(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  public setFilter(filter: LogFilter): void {
    this.currentFilter = filter;
    this.notifyFilterObservers();
  }

  public getCurrentFilter(): LogFilter {
    return { ...this.currentFilter };
  }

  public getFilteredLogs(filter: LogFilter = this.currentFilter): LogEntry[] {
    return this.logs.filter(log => this.matchesFilter(log, filter));
  }

  private matchesFilter(log: LogEntry, filter: LogFilter): boolean {
    // Level filter
    if (filter.level && filter.level !== 'all' && log.type !== filter.level) {
      return false;
    }

    // Source filter
    if (filter.source && filter.source !== 'all' && log.source !== filter.source) {
      return false;
    }

    // Time range filter
    if (filter.startTime && log.timestamp.getTime() < filter.startTime) {
      return false;
    }
    if (filter.endTime && log.timestamp.getTime() > filter.endTime) {
      return false;
    }

    // Search query filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const matchesMessage = log.message.toLowerCase().includes(query);
      const matchesSource = log.source.toLowerCase().includes(query);
      const matchesDetails = log.details ? 
        JSON.stringify(log.details).toLowerCase().includes(query) : false;
      
      if (!matchesMessage && !matchesSource && !matchesDetails) {
        return false;
      }
    }

    return true;
  }

  public search(query: string): LogEntry[] {
    return this.getFilteredLogs({ ...this.currentFilter, searchQuery: query });
  }

  // ==================== STATS ====================

  public getStats(): LogStats {
    const byLevel: Record<string, number> = { info: 0, success: 0, warning: 0, error: 0 };
    const bySource: Record<string, number> = {};
    
    let oldest = Date.now();
    let newest = 0;

    for (const log of this.logs) {
      // Count by level
      byLevel[log.type] = (byLevel[log.type] || 0) + 1;
      
      // Count by source
      bySource[log.source] = (bySource[log.source] || 0) + 1;
      
      // Track time range
      const time = log.timestamp.getTime();
      if (time < oldest) oldest = time;
      if (time > newest) newest = time;
    }

    return {
      totalLogs: this.logs.length,
      byLevel,
      bySource,
      oldestLog: this.logs.length > 0 ? oldest : 0,
      newestLog: this.logs.length > 0 ? newest : 0
    };
  }

  // ==================== EXPORT/IMPORT ====================

  public exportToFile(filter?: LogFilter): void {
    const logsToExport = filter ? this.getFilteredLogs(filter) : this.logs;
    
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      logCount: logsToExport.length,
      logs: logsToExport
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public exportToCSV(filter?: LogFilter): void {
    const logsToExport = filter ? this.getFilteredLogs(filter) : this.logs;
    
    const headers = ['Timestamp', 'Level', 'Source', 'Message', 'Details'];
    const rows = logsToExport.map(log => [
      log.timestamp.toISOString(),
      log.type,
      log.source,
      `"${log.message.replace(/"/g, '""')}"`,
      log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public importFromFile(file: File): Promise<{ success: boolean; imported: number; errors: string[] }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const errors: string[] = [];
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          if (!data.logs || !Array.isArray(data.logs)) {
            errors.push('Invalid file format: missing logs array');
            resolve({ success: false, imported: 0, errors });
            return;
          }

          let imported = 0;
          for (const log of data.logs) {
            if (this.validateLogEntry(log)) {
              // Restore Date object
              log.timestamp = new Date(log.timestamp);
              log.id = this.generateId(); // New ID to avoid conflicts
              this.logs.push(log);
              imported++;
            } else {
              errors.push(`Invalid log entry skipped`);
            }
          }

          this.trimLogs();
          this.persistLogs();
          this.notifyObservers();
          
          resolve({ success: imported > 0, imported, errors });
        } catch (err) {
          errors.push(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          resolve({ success: false, imported: 0, errors });
        }
      };

      reader.onerror = () => {
        errors.push('Failed to read file');
        resolve({ success: false, imported: 0, errors });
      };

      reader.readAsText(file);
    });
  }

  private validateLogEntry(log: any): boolean {
    return log &&
      typeof log.message === 'string' &&
      typeof log.source === 'string' &&
      ['info', 'success', 'warning', 'error'].includes(log.type) &&
      log.timestamp;
  }

  // ==================== MANAGEMENT ====================

  public clear(): void {
    this.logs = [];
    this.persistLogs();
    this.notifyObservers();
  }

  public clearByFilter(filter: LogFilter): number {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => !this.matchesFilter(log, filter));
    const removed = initialCount - this.logs.length;
    
    if (removed > 0) {
      this.persistLogs();
      this.notifyObservers();
    }
    
    return removed;
  }

  public deleteLog(id: string): boolean {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.id !== id);
    
    if (this.logs.length < initialCount) {
      this.persistLogs();
      this.notifyObservers();
      return true;
    }
    return false;
  }

  // ==================== OBSERVERS ====================

  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.observers.push(callback);
    callback(this.getFilteredLogs()); // Initial call
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  public subscribeToFilter(callback: (filteredLogs: LogEntry[]) => void): () => void {
    this.filterObservers.push(callback);
    callback(this.getFilteredLogs()); // Initial call
    return () => {
      this.filterObservers = this.filterObservers.filter(cb => cb !== callback);
    };
  }

  private notifyObservers(): void {
    const filtered = this.getFilteredLogs();
    this.observers.forEach(cb => cb(filtered));
    this.filterObservers.forEach(cb => cb(filtered));
  }

  private notifyFilterObservers(): void {
    const filtered = this.getFilteredLogs();
    this.filterObservers.forEach(cb => cb(filtered));
  }
}

// Export singleton
export const logger = new LoggerService();

// Backward compatibility - also export as 'logs' for existing code
export const logs = logger;
