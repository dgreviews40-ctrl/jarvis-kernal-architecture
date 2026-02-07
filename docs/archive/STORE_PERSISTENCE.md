# Store Persistence Implementation

## Overview

All Zustand stores now persist their state to localStorage, ensuring user preferences survive page refreshes.

## Persisted Stores

| Store | Persisted Keys | Storage Key |
|-------|---------------|-------------|
| `uiStore` | `mainView`, `activeTab` | `jarvis-ui-store` |
| `kernelStore` | `forcedMode` (AI provider) | `jarvis-kernel-store` |
| `logsStore` | `config`, `filter` | `jarvis-logs-store` |
| `pluginStore` | `selectedPluginId` | `jarvis-plugin-store` |
| `memoryStore` | *Not persisted* (data from service) | - |

## Features

### 1. Automatic Version Migration
- Storage version tracked in `jarvis-store-version`
- When version changes, old data is automatically cleared
- Current version: `1`

### 2. Selective Persistence
Only user preferences are persisted, not runtime state:
- ✅ View states, selected tabs
- ✅ AI provider preferences
- ✅ Log configuration
- ❌ Runtime data (logs, memory nodes, processor state)

### 3. Storage Utilities

```typescript
// Check and migrate storage version
import { checkStorageVersion } from './stores';
checkStorageVersion();

// Get storage statistics
import { getStorageStats } from './stores';
const stats = getStorageStats();
// Returns: [{ store: 'jarvis-ui-store', size: '1.2 KB', keys: 2 }]

// Clear all persisted stores
import { clearAllStores } from './stores';
clearAllStores();
```

## Testing

### Automated Tests
- Location: `tests/unit/persistence.test.ts`
- Tests: Storage version, store persistence, migration, clearing

### Manual Tests
See `tests/MANUAL_TEST_CHECKLIST.md` section 5:
- UI State Persistence
- AI Provider Preference
- Logs Configuration
- Storage Version Migration

## Implementation Details

### Store Configuration Example
```typescript
export const useKernelStore = create<KernelState>()(
  persist(
    subscribeWithSelector((set) => ({ ... })),
    {
      name: 'jarvis-kernel-store',
      partialize: (state) => ({
        forcedMode: state.forcedMode,
      }),
    }
  )
);
```

### Initialization
Storage version check runs on app startup in `index.tsx`:
```typescript
import { checkStorageVersion } from './stores';
checkStorageVersion();
```

## Browser DevTools

View persisted data in:
1. Open DevTools (F12)
2. Go to Application tab
3. Select Local Storage > Origin
4. Look for keys prefixed with `jarvis-`

## Security Notes

- No sensitive data (API keys, passwords) is persisted in stores
- API keys use separate encrypted storage via `apiKeyManager`
- Store data is not encrypted (contains only UI preferences)
