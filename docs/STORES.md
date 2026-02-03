# State Management Guide

This document describes the Zustand stores used in JARVIS and their usage patterns.

## Store Overview

| Store | File | Purpose | Persisted |
|-------|------|---------|-----------|
| UI Store | `stores/uiStore.ts` | Views, tabs, modals | Partial |
| Kernel Store | `stores/kernelStore.ts` | Core system state | No |
| Memory Store | `stores/memoryStore.ts` | Memory nodes, stats | No |
| Logs Store | `stores/logsStore.ts` | Log entries, filters | No |
| Plugin Store | `stores/pluginStore.ts` | Plugin registry | No |

---

## UI Store

**Purpose:** Manage UI-related state like views, tabs, and modal visibility.

### State

```typescript
interface UIState {
  mainView: 'DASHBOARD' | 'SETTINGS' | 'DEV' | 'INTEGRATIONS';
  activeTab: 'DASHBOARD' | 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'LOGS';
  isSystemReady: boolean;
  showBootSequence: boolean;
  activeModal: string | null;
  modalData: unknown;
}
```

### Usage

```typescript
import { useUIStore } from './stores';

// Get entire store (not recommended, causes re-renders)
const ui = useUIStore();

// Get specific state (recommended)
const mainView = useUIStore((s) => s.mainView);
const isSystemReady = useUIStore((s) => s.isSystemReady);

// Use actions
const setMainView = useUIStore((s) => s.setMainView);
const setActiveTab = useUIStore((s) => s.setActiveTab);

// Example: Switch to settings view
setMainView('SETTINGS');

// Example: Mark system ready
setSystemReady(true);
```

### Persistence

Only `mainView` and `activeTab` are persisted to localStorage.

---

## Kernel Store

**Purpose:** Manage core kernel state including processor state, AI providers, and system components.

### State

```typescript
interface KernelState {
  processorState: ProcessorState;
  activeModule: string | null;
  provider: AIProvider | null;
  forcedMode: AIProvider | null;
  breakerStatuses: BreakerStatus[];
  plugins: RuntimePlugin[];
  voiceState: VoiceState;
  visionState: VisionState;
}
```

### Usage

```typescript
import { useKernelStore, useVoiceState, useVisionState } from './stores';

// Using selector hooks (optimized)
const voiceState = useVoiceState();
const visionState = useVisionState();
const plugins = useKernelStore((s) => s.plugins);

// Using actions
const setVoiceState = useKernelStore((s) => s.setVoiceState);
const refreshSystemState = useKernelStore((s) => s.refreshSystemState);

// Example: Check if voice is active
const isVoiceActive = voiceState === VoiceState.LISTENING;

// Example: Update voice state
setVoiceState(VoiceState.IDLE);
```

### Selector Hooks

For better performance, use the pre-defined selector hooks:

```typescript
const processorState = useProcessorState();
const provider = useProvider();
const breakerStatuses = useBreakerStatuses();
const plugins = usePlugins();
```

---

## Memory Store

**Purpose:** Manage memory-related state including nodes, stats, and search.

### State

```typescript
interface MemoryState {
  nodes: MemoryNode[];
  stats: MemoryStats;
  backups: MemoryBackup[];
  searchResults: MemorySearchResult[] | null;
  searchQuery: string;
  isLoading: boolean;
}
```

### Usage

```typescript
import { useMemoryStore, useMemoryNodes, useMemoryStats } from './stores';

// Using selector hooks
const nodes = useMemoryNodes();
const stats = useMemoryStats();

// Using actions
const refreshStats = useMemoryStore((s) => s.refreshStats);
const search = useMemoryStore((s) => s.search);

// Example: Search memories
await search('home automation');

// Example: Refresh statistics
await refreshStats();
```

### Async Actions

The memory store includes async actions that handle API calls:

```typescript
// All async
await refreshStats();  // Fetches from memory service
await refreshNodes();  // Updates nodes from service
await search(query);   // Performs search
```

---

## Logs Store

**Purpose:** Manage log entries, filtering, and search.

### State

```typescript
interface LogsState {
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  filter: LogFilter;
  stats: LogStats;
  selectedLog: LogEntry | null;
  searchQuery: string;
}
```

### Usage

```typescript
import { useLogsStore, useFilteredLogs, useLogStats } from './stores';

// Get logs
const logs = useFilteredLogs();
const stats = useLogStats();

// Filter actions
const updateFilter = useLogsStore((s) => s.updateFilter);
const clearFilter = useLogsStore((s) => s.clearFilter);
const setLevelFilter = useLogsStore((s) => s.setLevelFilter);

// Example: Filter by level
setLevelFilter('error');

// Example: Search logs
const setSearchQuery = useLogsStore((s) => s.setSearchQuery);
setSearchQuery('network');
```

---

## Plugin Store

**Purpose:** Manage plugin registry and lifecycle.

### State

```typescript
interface PluginStore {
  plugins: RuntimePluginV2[];
  isLoading: boolean;
  error: string | null;
  selectedPluginId: string | null;
}
```

### Usage

```typescript
import { usePluginStore, usePlugins, useSelectedPlugin } from './stores';

// Get plugins
const plugins = usePlugins();
const selectedPlugin = useSelectedPlugin();

// Actions
const installPlugin = usePluginStore((s) => s.installPlugin);
const startPlugin = usePluginStore((s) => s.startPlugin);
const stopPlugin = usePluginStore((s) => s.stopPlugin);

// Example: Install a plugin
const manifest: PluginManifestV2 = { /* ... */ };
await installPlugin(manifest);

// Example: Start a plugin
await startPlugin('my.plugin');
```

---

## Best Practices

### 1. Use Selectors for Performance

```typescript
// ❌ Bad - causes re-render on any state change
const store = useKernelStore();
const voiceState = store.voiceState;

// ✅ Good - only re-renders when voiceState changes
const voiceState = useKernelStore((s) => s.voiceState);

// ✅ Better - use pre-defined selector hook
const voiceState = useVoiceState();
```

### 2. Batch Updates

```typescript
// ❌ Bad - multiple re-renders
const setA = useStore((s) => s.setA);
const setB = useStore((s) => s.setB);
setA(1);
setB(2);

// ✅ Good - single re-render
const store = useStore();
store.setA(1);
store.setB(2);
```

### 3. Don't Mutate State

```typescript
// ❌ Bad - mutating state
const nodes = useMemoryStore((s) => s.nodes);
nodes.push(newNode); // Don't do this!

// ✅ Good - use actions
const setNodes = useMemoryStore((s) => s.setNodes);
setNodes([...nodes, newNode]);
```

### 4. Handle Async Actions

```typescript
// ✅ Good - handle loading states
const refreshStats = useMemoryStore((s) => s.refreshStats);
const isLoading = useMemoryStore((s) => s.isLoading);

const handleRefresh = async () => {
  await refreshStats();
};
```

### 5. Subscribe to Changes

```typescript
import { useEffect } from 'react';
import { useKernelStore } from './stores';

useEffect(() => {
  const unsubscribe = useKernelStore.subscribe(
    (state) => state.voiceState,
    (voiceState) => {
      console.log('Voice state changed:', voiceState);
    }
  );
  
  return unsubscribe;
}, []);
```

---

## Migration from useState

### Before

```typescript
const [view, setView] = useState('DASHBOARD');
const [activeTab, setActiveTab] = useState('DASHBOARD');
```

### After

```typescript
const { mainView, setMainView, activeTab, setActiveTab } = useUIStore();
```

### Before

```typescript
const [voiceState, setVoiceState] = useState(VoiceState.MUTED);
const [plugins, setPlugins] = useState([]);

useEffect(() => {
  setPlugins(registry.getAll());
}, []);
```

### After

```typescript
const voiceState = useVoiceState();
const plugins = usePlugins();
```

---

## Testing with Stores

### Mock Store for Testing

```typescript
import { act } from '@testing-library/react';
import { useUIStore } from './stores';

// Reset store before each test
beforeEach(() => {
  act(() => {
    useUIStore.setState({
      mainView: 'DASHBOARD',
      activeTab: 'DASHBOARD',
      isSystemReady: false
    });
  });
});

// Test component with store
it('should change view', () => {
  const Component = () => {
    const { mainView, setMainView } = useUIStore();
    return (
      <button onClick={() => setMainView('SETTINGS')}>
        Current: {mainView}
      </button>
    );
  };
  
  // Test implementation...
});
```
