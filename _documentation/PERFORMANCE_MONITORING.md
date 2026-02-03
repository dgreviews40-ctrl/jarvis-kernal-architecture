# Performance Monitoring

## Overview

Comprehensive performance monitoring system for JARVIS that tracks:
- Bundle sizes during build
- Memory usage at runtime
- Operation timings
- Performance regressions

## Features

### 1. Build-Time Bundle Analysis

The bundle analyzer plugin runs during Vite builds and:
- Measures each chunk's size (raw and gzipped)
- Generates `dist/bundle-report.json`
- Logs warnings for chunks >500KB (warning) or >1MB (critical)
- Shows detailed build summary

```
📊 Bundle Analysis Summary
======================================================================
  Total Chunks:     18
  Total Size:       885.09 KB
  Total (gzipped):  241.38 KB
  Build Time:       35.16s

  ✅ Bundle size is healthy
======================================================================
```

### 2. Runtime Performance Monitor

The `performanceMonitor` service tracks:

#### Memory Usage
- Records JS heap usage every 30 seconds
- Alerts when usage exceeds 100MB (warning) or 200MB (critical)
- Shows average, current, and limit

#### Operation Timings
Measure any operation:
```typescript
// Automatic measurement
const result = performanceMonitor.measureTiming('my-operation', () => {
  // Your code here
  return result;
});

// Manual timing
const endTiming = performanceMonitor.startTiming('my-operation');
// ... do work ...
const duration = endTiming();
```

#### Bundle Size Tracking
Record bundle sizes at runtime:
```typescript
performanceMonitor.recordBundleSize('chunk.js', 10000, 5000);
```

### 3. Baseline Comparison

Set a baseline to track performance changes:
```typescript
performanceMonitor.setBaseline();
```

Later, compare current performance:
```typescript
const comparison = performanceMonitor.compareToBaseline();
// Returns: { regressions: [], improvements: [], unchanged: [] }
```

### 4. Performance Dashboard

Access via the green Activity icon in the top toolbar.

Features:
- **Metrics Cards**: Memory usage, bundle size, page load time
- **Baseline Comparison**: Visual indicators for regressions/improvements
- **Operation Timings**: Bar charts showing recent timing history
- **Bundle Sizes**: Visual breakdown of all chunks
- **Export**: JSON data or Markdown report

## API Reference

### PerformanceMonitor

```typescript
// Initialize
performanceMonitor.init();

// Record metrics
performanceMonitor.recordBundleSize(name, size, gzipSize);
performanceMonitor.recordMemorySnapshot();

// Measure timing
performanceMonitor.measureTiming(name, fn);
const end = performanceMonitor.startTiming(name);

// Get stats
const stats = performanceMonitor.getStats();

// Baseline
performanceMonitor.setBaseline();
const comparison = performanceMonitor.compareToBaseline();

// Reports
const report = performanceMonitor.generateReport();
const data = performanceMonitor.exportData();

// Cleanup
performanceMonitor.clearData();
performanceMonitor.destroy();
```

### React Hook

```typescript
import { useRenderTime } from './services/performanceMonitor';

function MyComponent() {
  useRenderTime('MyComponent'); // Logs if render >16ms
  // ...
}
```

## Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Bundle Size | 500KB | 1MB |
| Memory Usage | 100MB | 200MB |
| Operation Time | 100ms | 500ms |

## Storage

Performance data is stored in localStorage:
- Key: `jarvis-performance-metrics`
- Includes: bundleSizes, memorySnapshots, timings
- Automatically pruned to prevent excessive storage

## Build Output

After each build, check:
- Console output for bundle analysis
- `dist/bundle-report.json` for detailed metrics
- Chunk warnings for optimization opportunities
