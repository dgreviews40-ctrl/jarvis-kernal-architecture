/**
 * Global Error Boundary for JARVIS
 * 
 * Catches JavaScript errors anywhere in the component tree,
 * logs them to the health monitoring system, and displays
 * a graceful fallback UI instead of crashing the app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Power, Activity } from 'lucide-react';
import { logger } from '../services/logger';
import { cortex } from '../services/cortex';
import { HealthEventType, ImpactLevel } from '../types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number | null;
}

interface RecoveryAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  action: () => void;
  severity: 'low' | 'medium' | 'high';
}

export class JARVISErrorBoundary extends Component<Props, State> {
  private readonly MAX_ERRORS = 5;
  private readonly ERROR_WINDOW = 60000; // 1 minute

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const now = Date.now();
    
    // Update error count with time window
    this.setState(prev => {
      const isWithinWindow = prev.lastErrorTime && 
        (now - prev.lastErrorTime) < this.ERROR_WINDOW;
      
      return {
        errorInfo,
        errorCount: isWithinWindow ? prev.errorCount + 1 : 1,
        lastErrorTime: now
      };
    });

    // Log to structured logger
    logger.log('ERROR', `Component error: ${error.message}`, 'error', {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: now
    });

    // Report to Cortex health monitoring
    cortex.reportEvent({
      sourceId: 'ui.error_boundary',
      type: HealthEventType.CRASH,
      impact: ImpactLevel.HIGH,
      latencyMs: 0,
      context: {
        errorMessage: `${error.name}: ${error.message}`,
        componentStack: errorInfo.componentStack?.substring(0, 500)
      }
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);

    // Log to console for debugging
    console.error('[JARVIS Error Boundary] Caught error:', error);
    console.error('[JARVIS Error Boundary] Component stack:', errorInfo.componentStack);
  }

  /**
   * Attempt to recover from error
   */
  handleRetry = () => {
    logger.log('ERROR', 'User initiated recovery retry', 'info');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  /**
   * Hard reset - clear all state and reload
   */
  handleReset = () => {
    logger.log('ERROR', 'User initiated hard reset', 'warning');
    
    // Clear caches and storage
    localStorage.removeItem('jarvis_memory_banks_v2');
    sessionStorage.clear();
    
    // Reload the page
    window.location.reload();
  };

  /**
   * Safe mode - disable advanced features
   */
  handleSafeMode = () => {
    logger.log('ERROR', 'User initiated safe mode', 'warning');
    
    // Set safe mode flag
    localStorage.setItem('JARVIS_SAFE_MODE', 'true');
    
    // Disable voice, vision, and advanced features
    this.setState({ hasError: false }, () => {
      // Force a re-render with safe mode
      window.location.href = window.location.pathname + '?safe_mode=true';
    });
  };

  /**
   * Export error details for debugging
   */
  handleExportError = () => {
    const { error, errorInfo } = this.state;
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      componentStack: errorInfo?.componentStack,
      localStorage: this.getSafeStorageSnapshot()
    };

    const blob = new Blob([JSON.stringify(errorReport, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private getSafeStorageSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    
    // Only capture non-sensitive keys
    const safeKeys = [
      'jarvis_ai_config',
      'jarvis_ollama_config',
      'jarvis_voice_config'
    ];
    
    for (const key of safeKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          snapshot[key] = JSON.parse(value);
        }
      } catch {
        // Skip if can't parse
      }
    }
    
    return snapshot;
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return <ErrorRecoveryScreen 
        error={this.state.error}
        errorCount={this.state.errorCount}
        onRetry={this.handleRetry}
        onReset={this.handleReset}
        onSafeMode={this.handleSafeMode}
        onExport={this.handleExportError}
      />;
    }

    return this.props.children;
  }
}

/**
 * Error Recovery Screen Component
 */
interface ErrorRecoveryScreenProps {
  error: Error | null;
  errorCount: number;
  onRetry: () => void;
  onReset: () => void;
  onSafeMode: () => void;
  onExport: () => void;
}

const ErrorRecoveryScreen: React.FC<ErrorRecoveryScreenProps> = ({
  error,
  errorCount,
  onRetry,
  onReset,
  onSafeMode,
  onExport
}) => {
  const isCritical = errorCount >= 3;

  const recoveryActions: RecoveryAction[] = [
    {
      id: 'retry',
      label: 'Try Again',
      icon: <RefreshCw size={20} />,
      description: 'Attempt to recover and continue',
      action: onRetry,
      severity: 'low'
    },
    {
      id: 'safe',
      label: 'Safe Mode',
      icon: <Activity size={20} />,
      description: 'Disable advanced features and reload',
      action: onSafeMode,
      severity: 'medium'
    },
    {
      id: 'reset',
      label: 'Full Reset',
      icon: <Power size={20} />,
      description: 'Clear all data and restart (destructive)',
      action: onReset,
      severity: 'high'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/30 border border-red-500/50 mb-4">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-red-400 mb-2">
            System Error Detected
          </h1>
          <p className="text-gray-400">
            JARVIS has encountered a critical error and needs your attention.
          </p>
        </div>

        {/* Error Details */}
        <div className="bg-black/50 border border-red-900/30 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
            Error Details
          </h2>
          <div className="font-mono text-sm text-gray-300 space-y-2">
            <p><span className="text-gray-500">Type:</span> {error?.name || 'Unknown Error'}</p>
            <p><span className="text-gray-500">Message:</span> {error?.message || 'No message available'}</p>
            <p><span className="text-gray-500">Occurrences:</span> {errorCount}</p>
          </div>
          
          {isCritical && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
              <p className="text-red-400 text-sm">
                <strong>Warning:</strong> Multiple errors detected in quick succession. 
                A full reset may be required.
              </p>
            </div>
          )}
        </div>

        {/* Recovery Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {recoveryActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className={`
                flex flex-col items-center p-4 rounded-lg border transition-all
                ${action.severity === 'high' 
                  ? 'bg-red-900/20 border-red-500/50 hover:bg-red-900/30' 
                  : action.severity === 'medium'
                  ? 'bg-yellow-900/20 border-yellow-500/50 hover:bg-yellow-900/30'
                  : 'bg-cyan-900/20 border-cyan-500/50 hover:bg-cyan-900/30'
                }
              `}
            >
              <div className={`
                mb-2
                ${action.severity === 'high' ? 'text-red-400' : 
                  action.severity === 'medium' ? 'text-yellow-400' : 'text-cyan-400'}
              `}>
                {action.icon}
              </div>
              <span className="font-bold mb-1">{action.label}</span>
              <span className="text-xs text-gray-400 text-center">
                {action.description}
              </span>
            </button>
          ))}
        </div>

        {/* Debug Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={onExport}
            className="text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Export Error Report
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => window.open('https://github.com/your-repo/issues', '_blank')}
            className="text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Report Issue
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <p>J.A.R.V.I.S. Kernel v1.5.0 • Error Recovery Mode</p>
          <p className="mt-1">
            Error ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to trigger error boundary from functional components
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);
  
  if (error) {
    throw error;
  }
  
  return {
    triggerError: (err: Error) => setError(err)
  };
}

/**
 * Async error wrapper for handling errors in async functions
 */
export function withErrorBoundary<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: Error) => void
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler?.(error as Error);
      throw error;
    }
  }) as T;
}

export default JARVISErrorBoundary;
