import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css'; // Import Tailwind CSS
import App from './App';
import { JARVISErrorBoundary } from './components/ErrorBoundary';
import { checkStorageVersion } from './stores';

// Force clear old plugin registry cache on startup
// This ensures stale mock plugins are removed when registry definition changes
const CURRENT_REGISTRY_VERSION = 10;
const storedVersion = localStorage.getItem('jarvis_plugin_registry_version');
if (!storedVersion || parseInt(storedVersion) < CURRENT_REGISTRY_VERSION) {
  console.log('[JARVIS] Clearing stale plugin registry cache...');
  localStorage.removeItem('jarvis_plugin_registry');
  localStorage.setItem('jarvis_plugin_registry_version', CURRENT_REGISTRY_VERSION.toString());
}

// Check storage version and migrate if needed
checkStorageVersion();

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