# J.A.R.V.I.S. - Just A Rather Very Intelligent System

J.A.R.V.I.S. is an advanced AI kernel architecture that integrates multiple AI providers, smart home systems, and various sensors to create an intelligent assistant system.

## Features

- **Multi-AI provider support** (Gemini, Ollama)
- **Home Assistant integration** for smart home control
- **Voice recognition and synthesis** with wake word detection
- **Computer vision** with webcam and Home Assistant camera support
- **Hardware monitoring** and system diagnostics
- **Plugin architecture v2** with sandboxing and lifecycle management
- **Memory storage** and semantic recall system
- **State management** with Zustand stores
- **Code splitting** for optimal performance
- **Comprehensive error handling** with recovery mechanisms

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Home Assistant instance (optional, for smart home features)
- Google Gemini API key (optional, for cloud AI features)

## Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd jarvis-kernel-architect

# Install dependencies
npm install

# IMPORTANT: Download Piper TTS and JARVIS Voice
# Run this batch file to download the required voice files
Install-JARVIS-Voice.bat

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development
npm run dev
```

> **⚠️ IMPORTANT:** The JARVIS voice model (`jarvis.onnx`) is **NOT included** in the GitHub repository due to file size limits (115MB > 100MB GitHub limit). You **MUST** run `Install-JARVIS-Voice.bat` to download Piper and the JARVIS voice before using voice features.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run hardware` | Start hardware monitor |
| `npm run proxy` | Start Home Assistant proxy |
| `npm run start` | Start all services |

## Architecture

### Core Components

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

### State Management

The application uses **Zustand** for state management with the following stores:

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useUIStore` | Views, tabs, modals | Partial (views) |
| `useKernelStore` | Processor state, providers, plugins | No |
| `useMemoryStore` | Memory nodes, stats, backups | No |
| `useLogsStore` | Log entries, filters | No |
| `usePluginStore` | Plugin registry | No |

**Usage Example:**
```typescript
import { useUIStore, useKernelStore } from './stores';

// UI Store
const { mainView, setMainView } = useUIStore();

// Kernel Store
const voiceState = useKernelStore((s) => s.voiceState);
const setVoiceState = useKernelStore((s) => s.setVoiceState);
```

### Intelligence System (Consolidated)

Previously 6 separate services, now consolidated into 3:

| New Service | Consolidated From | Responsibility |
|-------------|-------------------|----------------|
| `conversationService` | conversationalContext + personalityEngine + naturalResponse | Context, personality, responses |
| `reasoningService` | multiTurnReasoning + knowledgeGraph | Reasoning chains, entities |
| `predictionService` | predictiveModel + proactiveIntelligence | Predictions, suggestions |

### Plugin System v2

The new plugin architecture provides:

- **Sandboxed execution** with permission-based API access
- **Lifecycle management** (install → load → start → stop → unload)
- **Capability registry** for plugin-to-plugin communication
- **Version compatibility** checking
- **Hot reload** support (coming soon)

**Plugin Manifest Example:**
```typescript
const manifest: PluginManifestV2 = {
  id: "my.plugin",
  name: "My Plugin",
  version: "1.0.0",
  engineVersion: "^1.0.0",
  permissions: ["memory:read", "network:fetch"],
  provides: [{ name: "myCapability", version: "1.0.0" }]
};
```

### Error Handling

Comprehensive error handling with:

- **Error Boundary** - Catches React component errors
- **Retry Logic** - Exponential backoff for transient failures
- **Graceful Degradation** - Falls back to safe mode
- **Notifications** - User-friendly toast messages
- **Recovery Dashboard** - Monitor and manage errors

**Usage:**
```typescript
import { withRetry, withDegradation } from './services/errorHandler';

// Auto-retry on failure
const result = await withRetry(
  () => fetchData(),
  { operation: 'fetchData', component: 'MyComponent' }
);

// Graceful degradation
const result = await withDegradation(
  () => heavyComputation(),
  fallbackValue,
  { operation: 'compute', component: 'MyComponent' },
  'featureName'
);
```

## Project Structure

```
jarvis-kernel-architect/
├── components/          # React components
│   ├── MainDashboard.tsx
│   ├── Terminal.tsx
│   ├── MemoryBank.tsx
│   └── ...
├── services/            # Core services
│   ├── intelligence/    # AI/ML services (consolidated)
│   ├── voice.ts
│   ├── vision.ts
│   ├── memory.ts
│   └── ...
├── stores/              # Zustand stores
│   ├── uiStore.ts
│   ├── kernelStore.ts
│   ├── memoryStore.ts
│   └── ...
├── plugins/             # Plugin system v2
│   ├── types.ts
│   └── registry.ts
├── types.ts             # TypeScript types
└── docs/                # Documentation
```

## Bundle Size

| Chunk | Size (gzipped) | Description |
|-------|----------------|-------------|
| index | 92 KB | Main application |
| feature-voice | 62 KB | Voice services |
| feature-intelligence | 2 KB | AI/ML (consolidated) |
| vendor-icons | 10 KB | Icons |
| vendor-react | 1.5 KB | React |
| vendor-zustand | 0.4 KB | Zustand |

**Total initial load:** ~92 KB (down from 214 KB)

## Voice Setup (Piper TTS)

To use the JARVIS voice feature, you need to download the voice model separately:

### Option 1: Automatic Installation (Recommended)
```bash
# Run the installer batch file
Install-JARVIS-Voice.bat
```
This will download and set up:
- Piper TTS engine
- JARVIS voice model (jarvis.onnx)
- All required dependencies

### Option 2: Manual Installation
1. Download Piper from [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)
2. Download the JARVIS voice model (`jarvis.onnx`)
3. Place files in the `Piper/` directory
4. Run `start-jarvis-server.bat` to start the Piper server

### Starting the Voice Server
```bash
# Start Piper TTS server
Piper/start-jarvis-server.bat

# Or use the simple launcher
JARVIS_SIMPLE.bat
```

> **Note:** The `jarvis.onnx` voice model (~115MB) is excluded from GitHub due to size limits. It will be downloaded automatically when you run `Install-JARVIS-Voice.bat`.

## Home Assistant Integration

1. Ensure your Home Assistant instance is accessible
2. Generate a long-lived access token in Home Assistant
3. Configure the URL and token in the Settings interface
4. The system connects through a local proxy to handle CORS

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | No |
| `VITE_GEMINI_API_KEY` | Vite-exposed Gemini key | No |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Architecture Decisions

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture decision records (ADRs):

- ADR-001: State Management with Zustand
- ADR-002: Intelligence Service Consolidation
- ADR-003: Plugin System v2 Architecture
- ADR-004: Code Splitting Strategy

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Recent Fixes

### Audio Feedback Loop Prevention
- Implemented a mechanism to prevent JARVIS from processing its own speech as input commands
- Added `isCurrentlySpeaking` flag that temporarily disables voice recognition when JARVIS is speaking
- The flag is set when `voice.speak()` is called and cleared when speaking completes
- Applies to both browser-based and Whisper STT systems

### Whisper Transcription Service 500 Error Fixes
- Improved error handling in whisper_server.py with better error messages
- Added proper temporary file cleanup to prevent resource leaks
- Enhanced debugging information for transcription failures
- Added better audio format compatibility
- Created whisper_server_fixed.py with additional error handling and validation

### Running the Fixed Whisper Server
```bash
python whisper_server_fixed.py
```

### Piper TTS Audio Context Issues
- Fixed "Could not create audio context" error in Piper TTS service
- Improved audio context pooling and management
- Added proper error handling for browser autoplay policies
- Enhanced fallback mechanism to system voice when Piper fails
- Added comprehensive debugging to diagnose audio issues
