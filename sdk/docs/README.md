# JARVIS Plugin SDK

Official SDK for building JARVIS plugins with TypeScript.

## Quick Start

```bash
# Create a new plugin
npx create-jarvis-plugin my-plugin

# Navigate and install
cd my-plugin
npm install

# Start dev server
npm run dev
```

## Plugin Types

### Command Plugin
Voice command handlers that respond to natural language.

```bash
npx create-jarvis-plugin my-command --template command
```

### Service Plugin
Background services that run periodic tasks.

```bash
npx create-jarvis-plugin my-service --template service
```

### UI Plugin
React-based panels that appear in JARVIS.

```bash
npx create-jarvis-plugin my-panel --template ui
```

## SDK API

### Core Functions

#### `definePlugin(definition, factory)`
Defines a plugin with metadata and lifecycle hooks.

```typescript
import { definePlugin, useLogger, useMemory } from '@jarvis/sdk';

export default definePlugin(
  {
    id: 'my.plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Does something useful',
    author: 'Me',
    permissions: ['memory:read', 'system:notification'],
  },
  async (context) => {
    const log = useLogger(context);
    const memory = useMemory(context);
    
    return {
      onStart: () => {
        log.info('Plugin started!');
      },
    };
  }
);
```

### Hooks

#### `useLogger(context)`
Structured logging with levels.

```typescript
const log = useLogger(context);
log.info('Something happened');
log.error('Something failed', { error: err });
```

#### `useMemory(context)`
Store and retrieve memories.

```typescript
const memory = useMemory(context);
await memory.store('Important note', ['tag1', 'tag2']);
const results = await memory.recall('important', 5);
```

#### `useNetwork(context)`
HTTP requests and WebSockets.

```typescript
const network = useNetwork(context);
const response = await network.fetch('https://api.example.com');
```

#### `useSystem(context)`
System features and notifications.

```typescript
const system = useSystem(context);
system.notify('Title', 'Message');
await system.clipboard.write('Copied text');
```

#### `useVoice(context)`
Text-to-speech and voice commands.

```typescript
const voice = useVoice(context);
await voice.speak('Hello!');
voice.onWakeWord('jarvis', () => { /* ... */ });
```

#### `useEvents(context)`
Event subscription and emission.

```typescript
const events = useEvents(context);
events.on('custom:event', (data) => { /* ... */ });
events.emit('custom:event', { foo: 'bar' });
```

#### `useCommands(context)`
Voice command registration.

```typescript
const commands = useCommands(context);
commands.register('do something', (params) => {
  // Handle command
});
```

#### `useScheduler(context)`
Scheduled tasks and intervals.

```typescript
const scheduler = useScheduler(context);
scheduler.every(60000, () => { /* Every minute */ });
scheduler.after(5000, () => { /* After 5 seconds */ });
```

### React Hooks (UI Plugins)

```typescript
import { 
  usePluginMemory, 
  usePluginConfig,
  useNotification 
} from '@jarvis/sdk/react';

function MyComponent() {
  const { recall, store } = usePluginMemory();
  const [theme, setTheme] = usePluginConfig('theme', 'dark');
  const notify = useNotification();
  
  // ...
}
```

## CLI Commands

### `jarvis-plugin dev`
Start development server with hot reload.

```bash
npm run dev
# or
jarvis-plugin dev --port 3456
```

### `jarvis-plugin validate`
Validate plugin manifest and code.

```bash
npm run validate
```

### `jarvis-plugin build`
Build plugin for distribution.

```bash
npm run build
```

## Manifest Reference

```json
{
  "id": "my.plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description",
  "author": "Author",
  "license": "MIT",
  "engineVersion": "1.0.0",
  "permissions": ["memory:read"],
  "capabilities": [{
    "name": "my_capability",
    "version": "1.0.0"
  }],
  "entry": {
    "background": "plugin.ts",
    "ui": "Panel.tsx"
  },
  "tags": ["utility"],
  "configSchema": {
    "setting": {
      "type": "string",
      "label": "Setting Name",
      "default": "value"
    }
  }
}
```

### Permissions

| Permission | Description |
|------------|-------------|
| `memory:read` / `memory:write` / `memory:delete` | Memory access |
| `network:fetch` / `network:websocket` | Network access |
| `audio:input` / `audio:output` | Audio access |
| `vision:camera` / `vision:analyze` | Vision access |
| `system:notification` / `system:clipboard` | System features |
| `ui:overlay` / `ui:panel` / `ui:statusbar` | UI injection |
| `plugin:capability` | Inter-plugin communication |

## Examples

### Timer Plugin

```typescript
import { definePlugin, useScheduler, useSystem } from '@jarvis/sdk';

export default definePlugin(
  {
    id: 'timer.basic',
    name: 'Basic Timer',
    permissions: ['system:notification', 'audio:output'],
  },
  (context) => {
    const scheduler = useScheduler(context);
    const system = useSystem(context);
    
    return {
      onStart: () => {
        scheduler.after(60000, () => {
          system.notify('Timer', '1 minute passed!');
        });
      },
    };
  }
);
```

### Weather Plugin

```typescript
import { definePlugin, useNetwork, useMemory, useCommands } from '@jarvis/sdk';

export default definePlugin(
  {
    id: 'weather.simple',
    name: 'Simple Weather',
    permissions: ['network:fetch', 'memory:write'],
  },
  async (context) => {
    const network = useNetwork(context);
    const memory = useMemory(context);
    const commands = useCommands(context);
    
    commands.register('weather', async () => {
      const res = await network.fetch('https://api.weather.com/v1/current');
      const data = await res.json();
      await memory.store(`Weather: ${data.temperature}°F`, ['weather']);
      context.voice.speak(`It's ${data.temperature} degrees`);
    });
    
    return {};
  }
);
```

## Development Tips

1. **Use the dev server** - Hot reload makes iteration fast
2. **Validate before testing** - Catch errors early with `npm run validate`
3. **Check permissions** - Add required permissions to manifest
4. **Use TypeScript** - Full type safety with the SDK
5. **Log liberally** - Use `useLogger()` for debugging

## License

MIT
