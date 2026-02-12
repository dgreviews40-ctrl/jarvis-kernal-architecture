# J.A.R.V.I.S. - Just A Rather Very Intelligent System

## Project Overview

J.A.R.V.I.S. is an advanced AI kernel architecture that integrates multiple AI providers (Gemini, Ollama), smart home systems (Home Assistant), and various sensors to create an intelligent assistant system with voice recognition, computer vision, and a plugin-based architecture.

### Key Features
- **Multi-AI provider support** (Gemini, Ollama)
- **Home Assistant integration** for smart home control
- **Smart Context Routing** - AI automatically routes personal queries to memory and device queries to Home Assistant
- **Voice recognition and synthesis** with wake word detection and Piper TTS
- **Computer vision** with webcam and Home Assistant camera support
- **Hardware monitoring** and system diagnostics (core.os)
- **Humanization & Natural Conversation** - Proactive engagement, emotional intelligence, natural speech flow
- **Plugin architecture v2** with sandboxing and lifecycle management
- **Memory storage** and semantic recall system with Vector DB
- **State management** with Zustand stores
- **Code splitting** for optimal performance
- **Comprehensive error handling** with recovery mechanisms

---

## Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend** | React 19 | UI framework |
| **Language** | TypeScript 5.8 | Type-safe development |
| **Build Tool** | Vite 6.4 | Development and production builds |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS |
| **State** | Zustand 5.0 | State management |
| **Testing** | Vitest 4.0 | Unit and integration tests |
| **Icons** | Lucide React | Icon library |
| **Charts** | Recharts | Data visualization |
| **3D Graphics** | Three.js | Neural network visualization |
| **AI/ML** | @google/genai, @xenova/transformers | AI provider integration, embeddings |

### Node.js Backend Services
- **Express** - Proxy server for Home Assistant CORS handling
- **http-proxy-middleware** - API request proxying
- **cors** - Cross-origin resource sharing

### Python Services
- **whisper_server.py** - Speech-to-text transcription server

---

## Project Structure

```
jarvis-kernel-architect/
├── components/          # React components (48 components)
│   ├── MainDashboard.tsx
│   ├── Terminal.tsx
│   ├── MemoryBank.tsx
│   ├── VoiceHUD.tsx
│   └── ...
├── services/            # Core services (95+ services)
│   ├── intelligence/    # AI/ML services (consolidated)
│   ├── kernelProcessor.ts
│   ├── voice.ts
│   ├── vision.ts
│   ├── memory.ts
│   ├── coreOs.ts       # System monitoring
│   └── ...
├── stores/              # Zustand stores
│   ├── uiStore.ts      # UI state (views, tabs, modals)
│   ├── kernelStore.ts  # Kernel state
│   ├── memoryStore.ts  # Memory state
│   ├── logsStore.ts    # Log entries
│   └── pluginStore.ts  # Plugin registry state
├── plugins/             # Plugin system v2
│   ├── types.ts        # Plugin type definitions
│   ├── registry.ts     # Plugin lifecycle management
│   ├── loader.ts       # Plugin loading
│   └── marketplace.ts  # Built-in plugin manifests
├── constants/           # Configuration constants
│   ├── config.ts       # TIMING, LIMITS, THRESHOLDS, etc.
│   └── typography.ts   # Text styling constants
├── workers/             # Web Workers
│   ├── canvasWorker.ts
│   └── memoryWorker.ts
├── server/              # Backend services
│   ├── proxy.js        # Home Assistant proxy
│   └── hardware-monitor.cjs
├── tests/               # Test suites
│   ├── unit/           # Unit tests (381 tests)
│   ├── performance/    # Performance tests (21 tests)
│   └── setup.ts        # Test configuration
├── docs/                # Documentation
│   ├── ARCHITECTURE.md # Architecture decision records
│   ├── TESTING.md      # Testing guide
│   ├── STORES.md       # State management docs
│   └── ...
├── types.ts             # TypeScript type definitions
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
└── vite.config.ts       # Vite configuration
```

---

## Build and Development Commands

### Development
```bash
# Start development server
npm run dev

# Start with fast refresh config
npm run dev:fast

# Start all services (hardware monitor + proxy + dev server)
npm run start
```

### Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/cache.test.ts
```

### Auxiliary Services
```bash
# Start hardware monitor
npm run hardware

# Start Home Assistant proxy
npm run proxy
```

---

## Architecture Overview

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        APP LAYER                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Dashboard  │ │   Terminal  │ │   Plugin Manager    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                     STATE LAYER (Zustand)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ UI Store │ │KernelStore│ │MemoryStore│ │  Logs Store  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Kernel  │ │  Voice   │ │  Vision  │ │   Hardware   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────────────┐   │
│  │  Memory  │ │   HA     │ │  Intelligence (Consolidated)│   │
│  └──────────┘ └──────────┘ └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Code Splitting Strategy

The project uses aggressive code splitting to optimize bundle size:

| Chunk | Size (gzipped) | Description |
|-------|----------------|-------------|
| index | 92 KB | Main application |
| feature-voice | 62 KB | Voice services |
| feature-intelligence | 2 KB | AI/ML (consolidated) |
| feature-vision | ~10 KB | Vision services |
| vendor-icons | 10 KB | Icons |
| vendor-react | 1.5 KB | React |
| vendor-zustand | 0.4 KB | Zustand |

**Total initial load:** ~92 KB (down from 214 KB before optimizations)

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Google Gemini API key (must be prefixed with VITE_) | No |
| `VITE_OPENAI_API_KEY` | OpenAI API key for DALL-E image generation | No |
| `HA_URL` | Home Assistant URL | No |
| `HA_TOKEN` | Home Assistant long-lived access token | No |
| `OLLAMA_URL` | Ollama server URL (default: http://localhost:11434) | No |
| `OLLAMA_MODEL` | Ollama model name (default: llama3) | No |

### Centralized Constants

All configuration constants are in `constants/config.ts`:

- **TIMING** - Debounce delays, timeouts, intervals
- **LIMITS** - Maximum values (memory nodes, context turns, etc.)
- **RATE_LIMITS** - API rate limiting (Gemini: 1400/day, 14/min)
- **THRESHOLDS** - Trigger values for various features
- **SCORING** - Algorithm scoring constants
- **FEATURES** - Feature flags (enable/disable features)
- **AUDIO** - Voice/wake word configuration
- **AI_MODELS** - Model names and defaults
- **STORAGE_KEYS** - localStorage key names
- **UI** - Animation durations and UI constants
- **VECTOR_DB** - Vector database configuration
- **CONTEXT_WINDOW** - Token limits for AI context
- **AGENT** - Autonomous agent configuration

---

## Code Style Guidelines

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `MainDashboard.tsx` |
| Services | camelCase | `kernelProcessor.ts` |
| Types/Interfaces | PascalCase | `KernelRequest`, `AIProvider` |
| Enums | PascalCase + UPPER_SNAKE values | `ProcessorState.IDLE` |
| Constants | UPPER_SNAKE | `TIMING.DEBOUNCE_MS` |
| Stores | camelCase + "Store" suffix | `useUIStore`, `uiStore.ts` |
| Files | PascalCase for components, camelCase for services | |

### Import Patterns

```typescript
// 1. External dependencies
import React, { useState, useCallback } from 'react';
import { create } from 'zustand';

// 2. Internal types
import type { KernelRequest, AIProvider } from '../types';
import { ProcessorState, IntentType } from '../types';

// 3. Constants
import { TIMING, LIMITS, FEATURES } from '../constants/config';

// 4. Services
import { logger } from './logger';
import { cacheService } from './cacheService';

// 5. Relative imports
import { useUIStore } from '../stores';
```

### TypeScript Configuration

- **Target:** ES2022
- **Module:** ESNext
- **Strict mode:** Enabled
- **JSX:** react-jsx
- **Path alias:** `@/*` maps to `./*`

### State Management Pattern (Zustand)

```typescript
// Store definition
interface UIState {
  mainView: MainView;
  setMainView: (view: MainView) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      mainView: 'DASHBOARD',
      setMainView: (view) => set({ mainView: view }),
    }),
    {
      name: 'jarvis-ui-store',
      partialize: (state) => ({ mainView: state.mainView }),
    }
  )
);

// Usage in components
const { mainView, setMainView } = useUIStore();
const mainView = useUIStore((s) => s.mainView); // Selective subscription
```

---

## Testing Strategy

### Test Organization

```
tests/
├── unit/                    # Unit tests (381 tests)
│   ├── cache.test.ts
│   ├── secureStorage.test.ts
│   ├── eventBus.test.ts
│   ├── notificationService.test.ts
│   ├── logger.test.ts
│   ├── settings.test.ts
│   └── providers.test.ts
├── performance/             # Performance tests (21 tests)
│   └── services.performance.test.ts
└── setup.ts                 # Test configuration and mocks
```

### Test Framework: Vitest

- **Environment:** jsdom
- **Globals:** Enabled
- **Setup file:** `tests/setup.ts`

### Mock Setup (tests/setup.ts)

The setup file provides mocks for:
- `File.prototype.text()` and `Blob.prototype.text()` polyfills
- `crypto.subtle` for secureStorage tests
- localStorage cleanup between tests

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService } from '../services/cacheService';

describe('CacheService', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  it('should set and get a value', () => {
    cacheService.set('key1', 'value1', 60000);
    expect(cacheService.get('key1')).toBe('value1');
  });

  it('should return null for expired entries', async () => {
    cacheService.set('key1', 'value1', 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 20));
    expect(cacheService.get('key1')).toBeNull();
  });
});
```

### Performance Thresholds

| Operation | Threshold | Environment |
|-----------|-----------|-------------|
| 1000 subscribers | <500ms | jsdom |
| 1000 events | <1000ms | jsdom |
| 100 cache ops | <500ms | jsdom |
| Memory growth | <50MB | jsdom |

---

## Plugin System v2

### Plugin Manifest

```typescript
const manifest: PluginManifestV2 = {
  id: "my.plugin",
  name: "My Plugin",
  version: "1.0.0",
  engineVersion: "^1.0.0",
  description: "Does something useful",
  author: "Author Name",
  license: "MIT",
  
  dependencies: [
    { pluginId: "core.weather", versionRange: "^1.0.0", optional: false }
  ],
  
  permissions: [
    "memory:read",
    "memory:write",
    "network:fetch",
    "system:notification"
  ],
  
  provides: [
    { name: "myCapability", version: "1.0.0" }
  ],
  
  entry: {
    background: "./background.ts",
    ui: "./ui.tsx"
  },
  
  tags: ["utility", "automation"]
};
```

### Available Permissions

| Permission | Description |
|------------|-------------|
| `memory:read` / `memory:write` / `memory:delete` | Memory access |
| `network:fetch` / `network:websocket` | Network access |
| `hardware:cpu` / `hardware:gpu` / `hardware:storage` | Hardware monitoring |
| `audio:input` / `audio:output` | Audio access |
| `vision:camera` / `vision:analyze` | Vision access |
| `system:notification` / `system:clipboard` | System features |
| `system:file:read` / `system:file:write` | File access |
| `ui:overlay` / `ui:panel` / `ui:statusbar` | UI injection |
| `display:render` / `model:selection` | AI features |
| `plugin:capability` | Inter-plugin communication |

### Plugin Lifecycle

```
installed → loading → loaded → starting → active
    ↑         ↓         ↓         ↓         ↓
    └─────────┴─────────┴─────────┴─────────┘
              (error state possible at any point)

Active plugin can transition:
  active → pausing → paused → resuming → active
  active → stopping → stopped → unloading → uninstalled
```

### Rate Limiting

Each plugin has rate limiting:
- **Burst limit:** 10 requests/second
- **Sustained limit:** 60 requests/minute
- **Token refill:** 2 tokens/second
- **Cooldown:** 5 seconds after hitting limit

---

## Security Considerations

### API Key Management

1. **Never commit API keys** - Use `.env.local` (gitignored)
2. **Vite prefix requirement** - Browser-exposed keys must use `VITE_` prefix
3. **Proxy-based storage** - API keys saved via proxy server to `.env.local`

### Input Validation

All user inputs pass through `inputValidator.ts`:
- Maximum length checks (5000 chars)
- Newline limit enforcement (50 max)
- Character repetition detection
- XSS pattern detection

### Plugin Sandboxing

- Permission-based API access
- Rate limiting per plugin
- No direct DOM access from plugins
- Capability-based inter-plugin communication

### XSS Protection

- SVG content sanitization in DisplayArea
- Dangerous pattern detection for plugin code
- Validation for user-generated content

---

## Development Workflow

### Adding a New Service

1. Create service file in `services/` directory
2. Export singleton instance (preferred) or class
3. Add tests in `tests/unit/`
4. Document in `docs/SERVICES_OVERVIEW.md`

### Adding a New Component

1. Create component file in `components/` directory
2. Use TypeScript interfaces for props
3. Import from `lucide-react` for icons
4. Use Tailwind classes for styling
5. Add to lazy load list if it's a dashboard view

### Adding a New Store

1. Create store file in `stores/` directory
2. Export using Zustand's `create()`
3. Use `persist` middleware for localStorage persistence
4. Use `partialize` to control what gets persisted
5. Export from `stores/index.ts`

### Database Schema Changes

The project uses:
- **localStorage** for simple persistence
- **IndexedDB** for vector database storage
- **Pinecone** for cloud vector storage (optional)

When changing storage structures:
1. Update storage version constants
2. Add migration logic if needed
3. Update `checkStorageVersion()` in stores

---

## Common Issues and Solutions

### Voice Features Not Working

1. Run `Install-JARVIS-Voice.bat` to download Piper TTS and voice model
2. The `jarvis.onnx` voice model (~115MB) is not included in GitHub repo
3. Start Piper server with `Piper/start-jarvis-server.bat`

### Home Assistant Connection Failed

1. Start proxy server: `npm run proxy`
2. Configure URL and token in Settings interface
3. Proxy runs on port 3101 by default

### Build Warnings

Bundle size warnings are expected for feature chunks. The `chunkSizeWarningLimit` is set to 500KB in vite.config.ts.

---

## Social Response Handler (v2.1)

The Social Response Handler (`services/socialResponseHandler.ts`) enables JARVIS to engage in natural conversational reciprocity:

### What It Does

| Interaction Type | Example Input | Response Pattern |
|-----------------|---------------|------------------|
| **Reciprocal Greeting** | "Good morning, how you doing?" | Answers about JARVIS's state before asking how to help |
| **Shared Experience** | "I've been working on your code" | Expresses gratitude, acknowledges collaborative effort |
| **Personal Update** | "I've been working hard on..." | Responds with interest, stores as memory |
| **Emotional Check-in** | "I'm feeling tired/stressed/excited" | Responds with appropriate empathy |

### Intent Detection

The handler uses regex patterns to detect social intents before routing to AI:

```typescript
// Greeting with reciprocation expected
/\b(how\s+are\s+you|how\s+you\s+doing|how's\s+it\s+going)\b/i

// Shared experience (working on JARVIS together)
/\b(working|coding|programming)\s+on\s+(you|your\s+code|jarvis)\b/i

// Personal updates
/\b(I've been|I have been)\s+(working|coding|programming)\s+on\b/i
```

### Response Examples

**Before:**
- User: "Good morning how you doing"
- JARVIS: "Good morning! How can I assist you today?"
- ❌ Doesn't answer "how you doing"

**After:**
- User: "Good morning how you doing"
- JARVIS: "Good morning! I'm doing quite well, thank you for asking. All my systems are running smoothly. How can I assist you today?"
- ✅ Reciprocates the greeting

**Before:**
- User: "I've been working hard on your code"
- JARVIS: "Yes, I have access to your Home Assistant. I can control 1065 smart home devices."
- ❌ Completely ignores the personal/collaborative aspect

**After:**
- User: "I've been working hard on your code"
- JARVIS: "I really appreciate you investing your time in me. It means a lot that you're working to make me better. Is there anything I can help you with on the technical side?"
- ✅ Acknowledges and thanks the user

### Technical Integration

1. **Local Intent Classifier** (`localIntent.ts`): New `SOCIAL` intent type for high-confidence matches
2. **Kernel Processor** (`kernelProcessor.ts`): Dedicated `handleSocial()` method
3. **Types** (`types.ts`): Added `SOCIAL` to `IntentType` enum

---

## Additional Resources

| Document | Description |
|----------|-------------|
| `JARVIS_HUMANIZATION_ROADMAP.md` | Humanization roadmap and completed work (9/9 tasks done) |
| `JARVIS_HUMANIZATION_TECHNICAL_GUIDE.md` | Technical implementation details |
| `docs/ARCHITECTURE.md` | Architecture Decision Records (ADRs) |
| `docs/TESTING.md` | Comprehensive testing guide |
| `docs/STORES.md` | State management documentation |
| `docs/ERROR_HANDLING.md` | Error handling patterns |
| `docs/SERVICES_OVERVIEW.md` | Complete service index (91 services) |
| `docs/VOICE.md` | Voice setup and configuration |
| `docs/CIRCUIT_BREAKER.md` | Circuit breaker pattern |
| `docs/ENHANCED_TTS.md` | Enhanced TTS with natural speech |
| `docs/NATURAL_SPEECH_FLOW.md` | Speech flow optimization guide |
| `docs/PIPER_VOICE_GUIDE.md` | Piper voice selection (British vs American) |
| `docs/PIPER_VOICE_SELECTION.md` | Voice detection and selection UI |
| `docs/AGENT_ORCHESTRATOR.md` | Autonomous task execution |
| `docs/SEARCH_SERVICE.md` | Web search integration |
