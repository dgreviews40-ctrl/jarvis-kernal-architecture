/**
 * Lazy-loaded Components for Performance
 * Heavy components are loaded on-demand
 */

import React, { Suspense, lazy, ComponentType } from 'react';

// Loading fallback component
const LoadingFallback: React.FC<{ height?: string }> = ({ height = '400px' }) => (
  <div 
    className="flex items-center justify-center bg-[#0a0a0a] border border-cyan-900/30 rounded"
    style={{ height }}
  >
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-cyan-700 uppercase tracking-wider">Loading...</span>
    </div>
  </div>
);

// Lazy load heavy components
export const LazyArchitectureDiagram = lazy(() => 
  import('./ArchitectureDiagram').then(m => ({ default: m.ArchitectureDiagram }))
);

export const LazyDependencyGraph = lazy(() => 
  import('./DependencyGraph').then(m => ({ default: m.DependencyGraph }))
);

export const LazyHealthDashboard = lazy(() => 
  import('./HealthDashboard').then(m => ({ default: m.HealthDashboard }))
);

export const LazyHomeAssistantDashboard = lazy(() => 
  import('./HomeAssistantDashboard').then(m => ({ default: m.HomeAssistantDashboard }))
);

export const LazyDevDashboard = lazy(() => 
  import('./DevDashboard').then(m => ({ default: m.DevDashboard }))
);

// Wrapper with suspense
export function withLazyLoad<P extends object>(
  Component: ComponentType<P>,
  fallbackHeight?: string
): React.FC<P> {
  return (props: P) => (
    <Suspense fallback={<LoadingFallback height={fallbackHeight} />}>
      <Component {...props} />
    </Suspense>
  );
}

// Preload function for eager loading when needed
export function preloadComponent(
  loader: () => Promise<{ default: ComponentType<any> }>
): void {
  loader();
}

// Preload all heavy components (call when idle)
export function preloadAllHeavyComponents(): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import('./ArchitectureDiagram');
      import('./DependencyGraph');
      import('./HealthDashboard');
      import('./HomeAssistantDashboard');
    }, { timeout: 5000 });
  }
}
