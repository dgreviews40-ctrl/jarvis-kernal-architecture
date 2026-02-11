# SDK Conversion Analysis

## What You Already Have

Your existing plugin system is **extremely comprehensive** and more powerful than the SDK:

| Feature | Existing System | SDK |
|---------|----------------|-----|
| Type definitions | ✅ `PluginManifestV2` (211 lines) | ✅ Simplified |
| Secure API | ✅ `securePluginApi.ts` (324 lines) | ✅ Hooks-based |
| Sandbox | ✅ Web Worker + iframe | ❌ Relies on existing |
| Rate limiting | ✅ Token bucket (10/sec, 60/min) | ❌ Uses existing |
| Lifecycle | ✅ Full 7-state machine | ✅ Simplified |
| Marketplace | ✅ 5 built-in plugins | ❌ N/A |
| Hot reload | ❌ | ✅ Dev server |
| Templates | ❌ | ✅ 3 templates |

## What the SDK Adds

The SDK is a **developer experience layer**, not a replacement:

```typescript
// EXISTING: Verbose but powerful
class DisplayPlugin implements Plugin {
  manifest = { ... };
  async initialize(context: PluginContext) { ... }
  async executeAction(action: string, params: any) { ... }
  async destroy() { ... }
}

// SDK: Concise, hooks-based
export default definePlugin(
  { id: 'my.plugin', name: 'My Plugin', ... },
  async (context) => {
    const log = useLogger(context);
    const memory = useMemory(context);
    
    return {
      onStart: () => log.info('Started!'),
    };
  }
);
```

## Conversion Candidates

### High Priority (Would Benefit)

#### 1. **Small Utility Services**
Services that could become simple plugins:

```typescript
// services/timerService.ts
export const timerService = {
  setTimer(minutes: number, callback: () => void) { ... }
};

// Could become:
// plugins/timer/plugin.ts (using SDK)
export default definePlugin(
  { id: 'timer.basic', permissions: ['system:notification'] },
  (ctx) => {
    const scheduler = useScheduler(ctx);
    return { onStart: () => { ... } };
  }
);
```

#### 2. **Command Handlers**
Voice command logic scattered in services could become focused plugins.

### Low Priority (Keep As-Is)

#### 1. **Display Plugin** (`plugins/display/`)
- 18 files, complex class-based architecture
- Deep integration with kernel store
- **Verdict**: Keep existing, it's well-architected

#### 2. **Core Services**
- `kernelProcessor.ts`, `memory.ts`, `voice.ts`
- These are foundational, not plugins
- **Verdict**: Keep as services

#### 3. **Registry, Loader, Marketplace**
- Core infrastructure, can't be plugins
- **Verdict**: Keep as-is

## Conversion Example

### Before: Timer Service Pattern

```typescript
// services/reminderService.ts
import { notificationService } from './notificationService';

class ReminderService {
  private timers = new Map<string, NodeJS.Timeout>();
  
  setReminder(id: string, minutes: number, message: string) {
    const timeout = setTimeout(() => {
      notificationService.info(message);
      this.timers.delete(id);
    }, minutes * 60 * 1000);
    
    this.timers.set(id, timeout);
  }
  
  cancelReminder(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

export const reminderService = new ReminderService();
```

### After: SDK Plugin Pattern

```typescript
// plugins/reminder/plugin.ts
import { definePlugin, useScheduler, useLogger } from '@jarvis/sdk';

export default definePlugin(
  {
    id: 'reminder.advanced',
    name: 'Advanced Reminders',
    version: '1.0.0',
    description: 'Set and manage reminders',
    author: 'JARVIS',
    permissions: ['system:notification'],
  },
  async (context) => {
    const log = useLogger(context);
    const scheduler = useScheduler(context);
    
    // In-memory storage for active reminders
    const activeReminders = new Map<string, () => void>();
    
    // Capability: Set a reminder
    const setReminder = (id: string, minutes: number, message: string) => {
      // Cancel existing
      if (activeReminders.has(id)) {
        activeReminders.get(id)!();
      }
      
      // Schedule new
      const cancel = scheduler.after(minutes * 60 * 1000, () => {
        context.system.notify('Reminder', message);
        activeReminders.delete(id);
        log.info(`Reminder triggered: ${id}`);
      });
      
      activeReminders.set(id, cancel);
      log.info(`Reminder set: ${id} in ${minutes} minutes`);
    };
    
    return {
      onStart: () => {
        log.info('Reminder plugin started');
      },
      
      onStop: () => {
        // Cancel all reminders
        activeReminders.forEach(cancel => cancel());
        activeReminders.clear();
        log.info('Reminder plugin stopped, all reminders cancelled');
      },
    };
  }
);
```

## Benefits of Conversion

| Aspect | Service Pattern | SDK Plugin Pattern |
|--------|-----------------|-------------------|
| **Installation** | Built-in | Optional, marketplace |
| **Configuration** | Hardcoded | Config schema in manifest |
| **Lifecycle** | Manual init/cleanup | Automatic onStart/onStop |
| **Permissions** | Full access | Declared, enforced |
| **Updates** | App update | Independent updates |
| **Testing** | Requires full app | Dev server, hot reload |
| **Sharing** | Copy code | Install from URL |

## Recommendation

### Keep Existing (Don't Convert)

1. **`plugins/display/`** - Complex, working well
2. **`services/` core** - Memory, voice, vision, kernel
3. **`plugins/` infrastructure** - Registry, loader, marketplace

### Good Conversion Candidates

1. **New utility features** - Use SDK for new plugins
2. **Experimental features** - Easy to iterate with dev server
3. **User-specific customizations** - Configurable plugins

### Hybrid Approach (Recommended)

```
plugins/
├── display/              # Keep existing (complex core plugin)
├── timer/                # New: SDK-based plugin
├── weather/              # New: SDK-based plugin
├── reminder/             # New: SDK-based plugin
├── registry.ts           # Keep existing
├── loader.ts             # Keep existing
└── marketplace.ts        # Keep existing
```

## Implementation Path

### Phase 1: SDK Setup (Done ✅)
- [x] Create SDK package structure
- [x] Build CLI tool
- [x] Create templates
- [x] Write documentation

### Phase 2: Bridge (Optional)
Create an adapter to let SDK plugins work with existing system:

```typescript
// plugins/sdkAdapter.ts
import { definePlugin } from '@jarvis/sdk';
import { registerPlugin, createPluginAPI } from './registry';

export function loadSdkPlugin(sdkPlugin: ReturnType<typeof definePlugin>) {
  // Convert SDK format to registry format
  // ...
}
```

### Phase 3: New Plugins (Recommended)
Use SDK for all new plugins going forward.

## Summary

| Question | Answer |
|----------|--------|
| Should I convert existing plugins? | No, keep them |
| Should I use SDK for new plugins? | Yes, much easier |
| Is the SDK less powerful? | No, uses same system underneath |
| Will this break anything? | No, it's additive |

The SDK is a **productivity tool** for new development, not a migration requirement.
