import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css'; // Import Tailwind CSS
import App from './App';
import { JARVISErrorBoundary } from './components/ErrorBoundary';
import { checkStorageVersion } from './stores';
import { healthMonitor } from './services/healthMonitor';
import { isLocalStorageAvailable } from './services/safeUtils';

// Suppress Chrome extension message channel errors (these are from browser extensions, not our code)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Filter out Chrome extension message channel errors
  if (message.includes('message channel closed') || 
      message.includes('A listener indicated an asynchronous response') ||
      message.includes('Unchecked runtime.lastError')) {
    return; // Silently ignore
  }
  originalConsoleError.apply(console, args);
};

// Also suppress unhandled promise rejections from extensions
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.toString() || '';
  if (message.includes('message channel closed') ||
      message.includes('A listener indicated an asynchronous response')) {
    event.preventDefault(); // Prevent console error
  }
});

// Force clear old plugin registry cache on startup
// This ensures stale mock plugins are removed when registry definition changes
if (isLocalStorageAvailable()) {
  try {
    const CURRENT_REGISTRY_VERSION = 13;
    const storedVersion = localStorage.getItem('jarvis_plugin_registry_version');
    if (!storedVersion || parseInt(storedVersion) < CURRENT_REGISTRY_VERSION) {
      console.log('[JARVIS] Clearing stale plugin registry cache...');
      localStorage.removeItem('jarvis_plugin_registry');
      localStorage.setItem('jarvis_plugin_registry_version', CURRENT_REGISTRY_VERSION.toString());
    }

    // Check storage version and migrate if needed
    checkStorageVersion();
  } catch (e) {
    console.warn('[JARVIS] localStorage operation failed:', e);
  }
}

// Initialize health monitoring
healthMonitor.start();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <JARVISErrorBoundary>
      <App />
    </JARVISErrorBoundary>
  </React.StrictMode>
);