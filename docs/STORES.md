# JARVIS State Management (Zustand Stores)

Centralized state management using Zustand with persistence, selectors, and safe access patterns.

## Store Overview

| Store | Purpose | Persistence | File |
|-------|---------|-------------|------|
| `useUIStore` | UI state (views, tabs, modals) | Partial (`mainView`, `activeTab`) | `stores/uiStore.ts` |
| `useKernelStore` | Core kernel state | Minimal (`forcedMode`, `version`) | `stores/kernelStore.ts` |
| `useMemoryStore` | Memory nodes, stats, backups | No | `stores/memoryStore.ts` |
| `useLogsStore` | Log entries, filters | No | `stores/logsStore.ts` |
| `usePluginStore` | Plugin registry, marketplace | No | `stores/pluginStore.ts` |

## Quick Start

```typescript
import { useUIStore, useKernelStore } from './stores';

// UI Store
const { mainView, setMainView } = useUIStore();

// Kernel Store with selector
const voiceState = useKernelStore((s) => s.voiceState);
```

## UI Store (`useUIStore`)

### Types

```typescript
type MainView = 'DASHBOARD' | 'SETTINGS' | 'DEV' | 'INTEGRATIONS' | 
                'PERFORMANCE' | 'MARKETPLACE' | 'VECTOR_DB' | 'REALTIME';

type TabView = 'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 
               'GRAPH' | 'LOGS' | 'HOME_ASSISTANT' | 'WEATHER' | 'AGENT';
```

### State

| Property | Type | Description |
|----------|------|-------------|
| `mainView` | `MainView` | Current main view |
| `activeTab` | `TabView` | Current active tab |
| `isSystemReady` | `boolean` | System initialization status |
| `showBootSequence` | `boolean` | Show boot animation |
| `activeModal` | `string \| null` | Currently open modal |
| `modalData` | `unknown` | Data passed to modal |

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setMainView` | `(view: MainView) => void` | Change main view |
| `setActiveTab` | `(tab: TabView) => void` | Change active tab |
| `setSystemReady` | `(ready: boolean) => void` | Set system ready state |
| `openModal` | `(modal: string, data?: unknown) => void` | Open modal with data |
| `closeModal` | `() => void` | Close active modal |
| `resetUI` | `() => void` | Reset to initial state |

## Kernel Store (`useKernelStore`)

### Version

```typescript
const KERNEL_VERSION = {
  major: 1,
  minor: 5,
  patch: 0,
  build: 'v1.5.0-stable'
};
```

### State Categories

#### Core State
- `processorState` - Current processor state (IDLE, LISTENING, etc.)
- `activeModule` - Currently active module
- `provider` - Selected AI provider
- `forcedMode` - Force specific AI provider

#### Component States
- `voiceState` - Voice system state
- `visionState` - Vision system state
- `breakerStatuses` - Circuit breaker statuses
- `plugins` - Runtime plugins

#### Display State
- `displayMode` - Display area mode (NEURAL, SCHEMATIC, IMAGE, WEB)
- `displayContent` - Content to display

#### v1.2 Stats
- `workerStats` - Worker pool statistics
- `resourceStats` - Resource monitoring stats
- `eventBusStats` - Event bus metrics
- `health` - Kernel health status

#### v1.4+ Stats
- `vectorDBStats` - Vector database statistics
- `contextWindowStats` - Context window usage
- `memoryConsolidationStats` - Memory consolidation metrics
- `agentStats` - Agent orchestrator statistics

#### Streaming
- `streamingText` - Current streaming text
- `isStreaming` - Streaming active flag

### Selector Hooks

```typescript
// Core
const processorState = useProcessorState();
const activeModule = useActiveModule();
const provider = useProvider();

// Components
const voiceState = useVoiceState();
const visionState = useVisionState();
const plugins = usePlugins();

// Display
const displayMode = useDisplayMode();
const displayContent = useDisplayContent();

// Stats
const workerStats = useWorkerStats();
const health = useKernelHealth();
const version = useKernelVersion();

// Computed
const uptime = useFormattedUptime();
const versionString = useVersionString();
```

## Persistence Layer (`stores/persistence.ts`)

### Features

- **Storage Versioning**: Automatic migration on breaking changes
- **Namespaced Storage**: Prefix keys to avoid collisions
- **Quota Handling**: Automatic cleanup on storage full
- **Session Storage**: Alternative adapter for temporary state

### API

```typescript
// Check and handle version migration
checkStorageVersion();

// Create namespaced storage
const storage = createNamespacedStorage('my-plugin-');

// Storage adapters
const storage = defaultStorage;        // localStorage
const tempStorage = sessionStorageAdapter; // sessionStorage

// Create persist options
const persistOptions = createPersistOptions('my-store', ['key1', 'key2']);

// Utilities
rehydrateStores();
clearAllStores();
const stats = getStorageStats();
```

### Storage Version

```typescript
const STORAGE_VERSION = 1;
```

Increment this when making breaking changes to store structure. Automatically clears outdated storage.

## Safe Store Access (`stores/storeAccess.ts`)

Defensive wrappers for accessing stores from services (outside React components).

```typescript
import { 
  getKernelStoreState, 
  updateKernelHealth,
  setKernelStreaming 
} from './stores';

// Safe access - returns null if store unavailable
const state = getKernelStoreState();

// Safe updates - no-op if store unavailable
updateKernelHealth({ status: 'healthy' });
setKernelStreaming(true, 'Hello...');
```

### Available Utilities

| Function | Purpose |
|----------|---------|
| `getKernelStoreState()` | Safely get kernel state |
| `getUIStoreState()` | Safely get UI state |
| `getMemoryStoreState()` | Safely get memory state |
| `updateKernelHealth()` | Update health status |
| `setKernelStreaming()` | Set streaming state |
| `setKernelProcessorState()` | Update processor state |
| `setKernelDisplay()` | Update display |
| `setKernelActiveModule()` | Set active module |
| `setKernelProvider()` | Set AI provider |
| `isKernelStoreReady()` | Check if store ready |

## Best Practices

### 1. Use Selectors for Performance

```typescript
// ✅ Good - only re-renders when voiceState changes
const voiceState = useKernelStore((s) => s.voiceState);

// ❌ Bad - re-renders on any store change
const { voiceState } = useKernelStore();
```

### 2. Use Safe Access from Services

```typescript
// ✅ Good - defensive
import { updateKernelHealth } from './stores';
updateKernelHealth({ status: 'degraded' });

// ❌ Bad - will crash if store not initialized
import { useKernelStore } from './stores/kernelStore';
useKernelStore.getState().setHealth({ status: 'degraded' });
```

### 3. Persist Minimal State

```typescript
// ✅ Good - only persist user preferences
partialize: (state) => ({ 
  forcedMode: state.forcedMode 
})

// ❌ Bad - persisting runtime state causes issues
partialize: (state) => state  // Don't do this
```

### 4. Handle Storage Errors

```typescript
// Persistence layer handles quota errors automatically
// Logs warnings to console when cleanup occurs
```

## Store Index (`stores/index.ts`)

Barrel file exporting all stores and utilities:

```typescript
// Stores
export { useUIStore } from './uiStore';
export { useKernelStore, KERNEL_VERSION } from './kernelStore';
export { useMemoryStore } from './memoryStore';
export { useLogsStore } from './logsStore';
export { usePluginStore } from './pluginStore';

// Persistence
export { checkStorageVersion, clearAllStores } from './persistence';

// Safe Access
export { getKernelStoreState, updateKernelHealth } from './storeAccess';

// Plugin exports
export { fetchManifest, installFromMarketplace } from '../plugins/loader';
export { registerPlugin, startPlugin } from '../plugins/registry';
```
