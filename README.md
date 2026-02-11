# J.A.R.V.I.S. - Just A Rather Very Intelligent System

J.A.R.V.I.S. is an advanced AI kernel architecture that integrates multiple AI providers, smart home systems, and various sensors to create an intelligent assistant system.

## Features

- **Multi-AI provider support** (Gemini, Ollama)
- **Home Assistant integration** for smart home control
- **Voice recognition and synthesis** with wake word detection
- **Computer vision** with webcam and Home Assistant camera support
- **Hardware monitoring** and system diagnostics (core.os v1.2.0)
  - Real-time memory metrics (heap, RSS, external)
  - CPU usage and load average monitoring
  - Battery status monitoring (via Battery API)
  - Network connection info (type, downlink, latency)
  - Storage quota and usage tracking
  - Performance metrics (memory pressure, latency)
  - Predictive analytics (trends, health score, recommendations)
  - Automated system alerts
  - Plugin health tracking
  - ASCII-formatted diagnostic reports
- **Humanization & Natural Conversation** (NEW)
  - Proactive engagement with milestone alerts and follow-ups
  - Natural speech flow with sentence-level TTS streaming
  - Emotional intelligence with unified sentiment analysis
  - Semantic memory context injection for personalized responses
  - Knowledge graph relationships for informed conversations
  - Dynamic personality adaptation
- **Plugin architecture v2** with sandboxing and lifecycle management
- **Memory storage** and semantic recall system
- **Vision Memory** - Persistent visual memory with CLIP embeddings for image search and recall
- **Smart Model Manager** - Intelligent model preloading, quick switching, and VRAM-aware recommendations
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

### Real Implementation

For the actual architecture (how browser UI talks to Ollama/Whisper/Piper on your hardware):

📄 **[docs/ARCHITECTURE_REAL.md](docs/ARCHITECTURE_REAL.md)** - Real system design  
📄 **[docs/HARDWARE_GUIDE.md](docs/HARDWARE_GUIDE.md)** - Optimize for your GPU  
📄 **[docs/SERVICES_OVERVIEW.md](docs/SERVICES_OVERVIEW.md)** - All services explained

### System Core (core.os v1.2.0)

The System Core plugin provides low-level system monitoring, predictive analytics, and automated alerting:

| Capability | Command | Description |
|------------|---------|-------------|
| **System Diagnostics** | `diagnostic`, `scan`, `full` | Full ASCII-formatted diagnostic report |
| **Memory Metrics** | `metrics`, `stats` | Real-time memory usage (heap, RSS, external) |
| **CPU Monitoring** | included in metrics | CPU usage %, load average |
| **Network Info** | `network`, `probe` | Connection type, downlink, latency, online status |
| **Battery Status** | `battery`, `power` | Battery level, charging state, time estimates |
| **Storage Info** | `storage`, `disk` | Storage quota, usage, available space |
| **Performance** | `performance`, `perf` | Memory pressure, latency, health indicators |
| **Predictive Analysis** | `predict`, `analysis` | Health score, trends, recommendations |
| **System Alerts** | `alerts`, `warnings` | Active system alerts and warnings |
| **Auto-Monitoring** | `monitor`, `watch` | Toggle background system monitoring |
| **Plugin Health** | `health`, `plugins` | Active/disabled/error plugin counts |
| **System Control** | `circuit`, `reset`, `memory`, `optimize` | Circuit breaker and memory management |

**Usage Example:**
```typescript
import { coreOs } from './services/coreOs';

// Get real-time metrics (now includes CPU)
const metrics = coreOs.getSystemMetrics();
console.log(`Heap: ${coreOs.formatBytes(metrics.memory.heapUsed)}`);
console.log(`CPU: ${metrics.cpu.usagePercent}%`);

// Get battery info (async)
const battery = await coreOs.getBatteryInfo();
console.log(`Battery: ${battery.level}%`);

// Get storage info (async)
const storage = await coreOs.getStorageInfo();
console.log(`Storage: ${storage.percentUsed}% used`);

// Get predictive analysis (async)
const analysis = await coreOs.getPredictiveAnalysis();
console.log(`Health Score: ${analysis.healthScore}/100`);
console.log(`Recommendation: ${analysis.recommendedAction}`);

// Start auto-monitoring
coreOs.startMonitoring(5000); // Check every 5 seconds

// Check for alerts
const alerts = coreOs.getActiveAlerts();
alerts.forEach(alert => console.log(`[${alert.type}] ${alert.message}`));

// Run full diagnostics
const report = await coreOs.runDiagnostics();
console.log(report); // ASCII-formatted report with all sections
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

Previously 9 separate services, now consolidated into 3:

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
| index | 363 KB | Main application |
| feature-voice | 93 KB | Voice services |
| feature-intelligence | 13 KB | AI/ML (consolidated) |
| feature-vision | 5 KB | Vision services |
| vendor-icons | 17 KB | Icons |
| vendor-react | 3 KB | React |
| vendor-zustand | 0.4 KB | Zustand |

**Total initial load:** ~363 KB (main chunk)
> Note: Bundle sizes are approximate and may vary with build configuration.

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

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes, including:
- core.os v1.1.0 upgrade with real-time system metrics
- Feature additions and bug fixes
- Plugin version history
- Future roadmap

## Architecture Decisions

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture decision records (ADRs):

- ADR-001: State Management with Zustand
- ADR-002: Intelligence Service Consolidation
- ADR-003: Plugin System v2 Architecture
- ADR-004: Code Splitting Strategy

## Documentation

| Document | Description |
|----------|-------------|
| [JARVIS_HUMANIZATION_ROADMAP.md](./JARVIS_HUMANIZATION_ROADMAP.md) | Humanization roadmap and completed work |
| [JARVIS_HUMANIZATION_TECHNICAL_GUIDE.md](./JARVIS_HUMANIZATION_TECHNICAL_GUIDE.md) | Technical implementation details |
| [docs/STORES.md](./docs/STORES.md) | State management with Zustand |
| [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md) | Error handling and retry strategies |
| [docs/CIRCUIT_BREAKER.md](./docs/CIRCUIT_BREAKER.md) | Circuit breaker pattern |
| [docs/ENHANCED_TTS.md](./docs/ENHANCED_TTS.md) | Enhanced TTS with natural speech |
| [docs/NATURAL_SPEECH_FLOW.md](./docs/NATURAL_SPEECH_FLOW.md) | Natural speech flow configuration |
| [docs/AGENT_ORCHESTRATOR.md](./docs/AGENT_ORCHESTRATOR.md) | Autonomous task execution |
| [docs/TESTING.md](./docs/TESTING.md) | Testing guide (unit, integration, performance) |
| [docs/SEARCH_SERVICE.md](./docs/SEARCH_SERVICE.md) | Web search integration |
| [docs/SERVICES_OVERVIEW.md](./docs/SERVICES_OVERVIEW.md) | Complete service index (91 services) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture decision records |
| [docs/VOICE.md](./docs/VOICE.md) | Voice setup and configuration |

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Recent Fixes

### Audio Feedback Loop Prevention
- Implemented a mechanism to prevent JARVIS from processing its own speech as input commands
- Added `isCurrentlySpeaking` flag that temporarily disables voice recognition when JARVIS is speaking
- The flag is set when `voice.speak()` is called and cleared when speaking completes
- Applies to both browser-based and Whisper STT systems

### Memory Leaks in Voice Service
- Fixed audio context memory leaks in the voice service
- Improved cleanup of audio contexts in all error scenarios
- Added proper cleanup of Web Workers and VAD intervals
- Enhanced state management to prevent resource accumulation

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

### Memory Recall Enhancement for User Identity
- Added special handling for user identity queries like "what's my name"
- Implemented boosted scoring for identity-related memories
- Added dedicated methods for storing and retrieving user identity
- Enhanced memory recall algorithm to better recognize identity queries
- Improved application logic to detect and store identity information properly
- Added specific handling for identity-related storage and retrieval in the main application flow

### Plugin Integration Enhancement for Weather Queries
- Added direct routing for weather-related queries to the Weather Station plugin
- Implemented proper handling for "what's the weather" and similar queries
- Enhanced application logic to use weather plugin data when available
- Added specific response formatting for different types of weather queries
- Improved integration between main application and plugin marketplace services

### Enhanced TTS for Natural Speech
- Added enhanced TTS service with natural speech patterns
- Implemented emotional tone and intonation variations
- Added prosody controls for more fluid speech delivery
- Integrated enhanced speech processing with all TTS providers (system, Piper, Neural)
- Added text preprocessing for natural pauses and emphasis
- Improved speech rhythm and stress patterns for more human-like delivery

### Improved Error Handling and Resource Management
- Enhanced error handling in AI providers (Gemini and Ollama)
- Added validation for image data in vision requests
- Improved cleanup in kernel processor's finalizeResponse
- Fixed potential race conditions in voice service state management
- Added proper async handling for voice service operations
- Enhanced circuit breaker patterns with better error reporting
- Improved resource cleanup in application lifecycle

### Security Vulnerability Fixes
- Fixed XSS vulnerability in DisplayArea component by sanitizing SVG content
- Added dangerous pattern detection for plugin code execution
- Improved validation for user-generated content rendering
- Added security checks for dynamic code evaluation
