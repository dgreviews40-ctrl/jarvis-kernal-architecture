# core.os v1.2.0 Integration Guide

This document describes how core.os v1.2.0 integrates with Voice, Display, and Cortex systems.

## Overview

core.os v1.2.0 provides comprehensive system monitoring capabilities that are integrated across the JARVIS ecosystem:

- **Voice Integration**: Spoken system status, alerts, and voice commands
- **Display Integration**: Real-time dashboard with metrics and visualizations
- **Cortex Integration**: Health reporting, reliability tracking, and adaptive policies

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        core.os v1.2.0                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Metrics   │  │   Alerts    │  │   Predictive Analysis   │ │
│  │  Collection │  │   System    │  │       & Trends          │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                            │
│              (services/coreOsIntegration.ts)                    │
└─────────────────────────────────────────────────────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────┐    ┌─────────────┐      ┌─────────────────┐
│    Voice    │    │   Display   │      │     Cortex      │
│  Service    │    │  Dashboard  │      │    Engine       │
└─────────────┘    └─────────────┘      └─────────────────┘
```

## Voice Integration

### Features

- **Spoken Status Reports**: System health, battery, memory spoken aloud
- **Alert Announcements**: Critical alerts announced via TTS
- **Voice Commands**: Natural language system queries

### Voice Commands

| Command | Response |
|---------|----------|
| "System status" | Full spoken status report |
| "How are you" | Health score and key metrics |
| "Battery status" | Battery level and time remaining |
| "Memory usage" | Current memory consumption |
| "Run diagnostics" | Diagnostic summary spoken |

### Usage

```typescript
import { coreOsIntegration } from './services/coreOsIntegration';

// Initialize with voice announcements enabled
await coreOsIntegration.initialize();

// Speak current status
await coreOsIntegration.speakStatus();

// Handle voice command
await coreOsIntegration.handleVoiceCommand('battery status');
```

### Configuration

```typescript
const config = {
  voiceAnnouncements: true,  // Enable spoken alerts
  alertThresholds: {
    memoryWarning: 0.75,     // 75% memory triggers warning
    batteryWarning: 20,      // 20% battery triggers warning
    healthScoreWarning: 50   // Health < 50 triggers warning
  }
};
```

## Display Integration

### Features

- **Real-time Dashboard**: Live metrics with 2-second refresh
- **Visual Health Score**: Color-coded health indicator
- **Progress Bars**: Memory, CPU, battery, storage visualization
- **Alert Panel**: Active alerts with acknowledgment
- **Diagnostic Report**: ASCII-formatted report display

### Dashboard Components

```typescript
import { CoreOsDashboard } from './components/CoreOsDashboard';

// Use in React component
function App() {
  return <CoreOsDashboard />;
}
```

### Dashboard Sections

1. **Health Score Card**: Overall system health (0-100)
2. **Memory Card**: Heap usage, RSS, external memory
3. **CPU Card**: Usage percentage, load average
4. **Battery Card**: Level, charging status, time remaining
5. **Network Card**: Connection type, speed, latency
6. **Storage Card**: Usage, available space
7. **Performance Card**: Memory pressure, latency
8. **Plugins Card**: Active/disabled/error counts
9. **Alerts Section**: Active alerts with acknowledge buttons

### Custom Events

The dashboard listens for system events:

```typescript
// Alert event
window.addEventListener('coreos-alert', (e) => {
  console.log('New alert:', e.detail);
});
```

## Cortex Integration

### Features

- **Health Reporting**: System health reported as reliability score
- **Event Logging**: All alerts and status changes logged
- **Adaptive Policies**: System stress triggers protective policies
- **Trend Analysis**: Historical data for predictive decisions

### Cortex Events

| Event Type | Trigger | Impact |
|------------|---------|--------|
| `CRASH` | Critical alert | HIGH |
| `HIGH_LATENCY` | Health score < 50 | MEDIUM |
| `SUCCESS` | Health score > 80 | NONE |

### Usage

```typescript
// Get system reliability from Cortex
const reliability = coreOsIntegration.getReliability();
console.log(reliability.currentHealth); // 0-100 score
```

### Automatic Reporting

The integration automatically reports to Cortex:
- Health score changes
- Memory threshold breaches
- Battery warnings
- Plugin errors

## Auto-Monitoring

### Features

- **Background Monitoring**: Continuous system checks
- **Configurable Interval**: Default 10 seconds
- **Automatic Alerts**: Threshold-based alert generation
- **Smart Throttling**: Prevents alert spam

### Usage

```typescript
// Start monitoring (called automatically on init)
coreOs.startMonitoring(5000); // 5 second interval

// Check if monitoring
const isActive = coreOs.isMonitoring();

// Stop monitoring
coreOs.stopMonitoring();
```

### Alert Throttling

Voice announcements are throttled to prevent spam:
- Memory warnings: Max 1 per minute
- Battery warnings: Max 1 per 2 minutes
- Health warnings: Max 1 per 5 minutes

## Complete Integration Example

```typescript
import { coreOsIntegration } from './services/coreOsIntegration';
import { CoreOsDashboard } from './components/CoreOsDashboard';

// 1. Initialize integration
await coreOsIntegration.initialize();

// 2. Dashboard automatically shows real-time data
<CoreOsDashboard />

// 3. Voice commands work automatically
// "System status" → Speaks full report
// "Battery status" → Speaks battery info

// 4. Cortex receives automatic reports
// Health changes → Logged to Cortex
// Critical alerts → HIGH impact event

// 5. Get display data for custom UI
const data = await coreOsIntegration.getDisplayData();
console.log(data.metrics, data.alerts, data.analysis);
```

## API Reference

### CoreOsIntegration Class

```typescript
class CoreOsIntegration {
  // Initialization
  initialize(): Promise<void>
  shutdown(): void

  // Voice
  speakStatus(): Promise<void>
  speakDiagnostics(): Promise<void>
  handleVoiceCommand(command: string): Promise<string>

  // Display Data
  getDisplayData(): Promise<DashboardData>

  // Cortex
  getReliability(): ReliabilityScore | undefined
}
```

### DashboardData Interface

```typescript
interface DashboardData {
  metrics: SystemMetrics;
  battery: BatteryInfo;
  network: NetworkInfo;
  storage: StorageInfo;
  performance: PerformanceMetrics;
  analysis: PredictiveAnalysis;
  health: PluginHealth;
  alerts: SystemAlert[];
  isMonitoring: boolean;
}
```

## Troubleshooting

### Voice Not Working
- Check if `voiceAnnouncements` is enabled in config
- Verify voice service is initialized
- Check browser TTS support

### Dashboard Not Updating
- Verify `isMonitoring` is true
- Check for JavaScript errors in console
- Ensure component is mounted

### Cortex Not Receiving Events
- Verify Cortex is initialized
- Check `cortexReporting` config option
- Review event log in Cortex dashboard

## Migration from v1.1.0

### New Features
- Auto-monitoring with configurable intervals
- Voice command handling
- Display dashboard component
- Cortex integration
- Alert acknowledgment system

### Breaking Changes
None - v1.2.0 is fully backward compatible with v1.1.0

### Recommended Updates
1. Replace manual monitoring with `coreOsIntegration.initialize()`
2. Add `<CoreOsDashboard />` component for system visibility
3. Enable voice announcements for critical alerts
4. Configure alert thresholds for your use case
