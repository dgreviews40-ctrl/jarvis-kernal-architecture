# SDK Timer Plugin Example

A working example of a JARVIS plugin built with the SDK.

## Voice Commands

| Command | Description |
|---------|-------------|
| "set timer 5 minutes" | Creates a 5-minute timer |
| "set timer 10 pizza" | Creates a 10-minute timer named "pizza" |
| "timer status" | Lists all active timers |
| "cancel timer pizza" | Cancels timer named "pizza" |
| "cancel all timers" | Cancels all timers |

## Features

- ✅ Multiple concurrent timers
- ✅ Voice notifications
- ✅ Visual notifications
- ✅ Memory logging
- ✅ Configurable defaults
- ✅ Full lifecycle support

## Installation

### Option 1: Dev Server

```bash
cd examples/sdk-timer-plugin
npm install  # if SDK is published
# OR link local SDK:
npm link ../../sdk/packages/jarvis-sdk

npm run dev
```

Then in JARVIS, install from `http://localhost:3456`

### Option 2: Direct Load

Copy to `plugins/timer-sdk/` and load in JARVIS.

## Configuration

Edit `manifest.json` configSchema:

```json
{
  "defaultDuration": 10,  // Default timer length
  "soundEnabled": false   // Disable voice notifications
}
```

## SDK Features Used

- `definePlugin()` - Plugin definition
- `useLogger()` - Structured logging
- `useConfig()` - Configuration access
- `useScheduler()` - Timer scheduling
- `useCommands()` - Voice command registration
- `useMemory()` - Memory storage

## Code Comparison

### Without SDK (~80 lines):
```typescript
export class TimerPlugin implements Plugin {
  manifest = { ... };
  private timers = new Map();
  
  async initialize(context) {
    context.registerCommand('set timer', ...);
    // ... lots of boilerplate
  }
  
  async executeAction(action, params) {
    switch(action) { ... }
  }
  
  async destroy() {
    this.timers.forEach(t => clearTimeout(t));
  }
}
```

### With SDK (~40 lines):
```typescript
export default definePlugin({ ... }, (context) => {
  const scheduler = useScheduler(context);
  const commands = useCommands(context);
  
  commands.register('set timer', ...);
  
  return {
    onStart: () => { ... },
    onStop: () => scheduler.clearAll(),
  };
});
```

## Next Steps

1. Add more timer types (pomodoro, interval)
2. Add UI panel for visual timer management
3. Add recurring timers
4. Integrate with calendar
