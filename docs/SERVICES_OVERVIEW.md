# Services Overview

Complete index of all 91 services in the JARVIS architecture.

## Core Services (8)

Foundational services used throughout the application.

| Service | File | Purpose |
|---------|------|---------|
| **EventBus** | `eventBus.ts` | Centralized pub/sub system |
| **CacheService** | `cacheService.ts` | Advanced caching with TTL |
| **Logger** | `logger.ts` | Unified logging with persistence |
| **NotificationService** | `notificationService.ts` | Toast notifications |
| **SecureStorage** | `secureStorage.ts` | Encrypted local storage |
| **Registry** | `registry.ts` | Plugin registry |
| **CircuitBreaker** | `CircuitBreaker.ts` | Resilience pattern |
| **SettingsManager** | `settingsManager.ts` | Settings import/export |

### EventBus

```typescript
import { eventBus, EventChannels } from './services/eventBus';

// Subscribe
const unsub = eventBus.subscribe('channel', handler, { priority: 'high' });

// Publish
await eventBus.publish('channel', payload);

// Request/Response
const result = await eventBus.request('channel', request);
```

### CacheService

```typescript
import { cacheService, CACHE_KEYS } from './services/cacheService';

cacheService.set('key', value, 300000);
const value = cacheService.get('key');
const result = await cacheService.getOrSet('key', fetchFn);
```

## System Services (12)

Operating system and hardware integration.

| Service | File | Purpose |
|---------|------|---------|
| **coreOs** | `coreOs.ts` | System metrics, process management (v1.2.1) |
| **coreOsIntegration** | `coreOsIntegration.ts` | Voice/Display/Cortex integration |
| **Hardware** | `hardware.ts` | Hardware monitoring |
| **Performance** | `performance.ts` | Performance utilities |
| **PerformanceMonitor** | `performanceMonitor.ts` | Real-time monitoring |
| **RealtimeMetrics** | `realtimeMetrics.ts` | Event-driven metrics |
| **Battery** | `battery.ts` | Battery status |
| **Storage** | `storage.ts` | Storage management |
| **Process** | `process.ts` | Process management |
| **Network** | `network.ts` | Network utilities |
| **Security** | `securityService.ts` | Security utilities |
| **Crypto** | `crypto.ts` | Encryption helpers |

### coreOs

```typescript
import { 
  getSystemMetrics, 
  getBatteryInfo, 
  getPredictiveAnalysis 
} from './services/coreOs';

const metrics = getSystemMetrics();
const battery = await getBatteryInfo();
const analysis = await getPredictiveAnalysis();
```

## AI/ML Services (15)

Artificial intelligence and machine learning capabilities.

| Service | File | Purpose |
|---------|------|---------|
| **KernelProcessor** | `kernelProcessor.ts` | Main AI processing |
| **EnhancedKernelProcessor** | `enhancedKernelProcessor.ts` | Enhanced processing |
| **Providers** | `providers.ts` | AI provider management |
| **Gemini** | `gemini.ts` | Google Gemini integration |
| **Conversation** | `conversation.ts` | Basic conversation |
| **Intelligence** | `intelligence/` | Consolidated AI services |
| **LocalIntent** | `localIntent.ts` | Local intent recognition |
| **PredictiveService** | `predictiveService.ts` | Predictive analytics |
| **Streaming** | `streaming.ts` | Response streaming |
| **StreamProcessor** | `streamProcessor.ts` | Stream handling |
| **ContextWindow** | `contextWindowService.ts` | Context management |
| **VectorDB** | `vectorDB.ts` | Vector database |
| **LocalVectorDB** | `localVectorDB.ts` | Local vector storage |
| **Learning** | `learning.ts` | Learning system |
| **QueryEngine** | `queryEngine.ts` | Query processing |

### Intelligence Services

Located in `services/intelligence/`:

```typescript
import { 
  conversationService,
  reasoningService,
  predictionService,
  intelligence
} from './services/intelligence';

// Use consolidated orchestrator
const result = await intelligence.process({
  userInput: 'Hello',
  conversationHistory: [],
  userId: 'user_123'
});
```

## Voice Services (10)

Speech recognition and synthesis.

| Service | File | Purpose |
|---------|------|---------|
| **Voice** | `voice.ts` | Main voice service |
| **VoiceStreaming** | `voiceStreaming.ts` | Streaming audio |
| **VoicePerformance** | `voicePerformance.ts` | Performance optimization |
| **PiperTTS** | `piperTTS.ts` | Piper TTS integration |
| **EnhancedTTS** | `enhancedTTS.ts` | Natural speech |
| **WhisperSTT** | `whisperSTT.ts` | Whisper transcription |
| **AudioAnalyzer** | `audioAnalyzer.ts` | Audio analysis |
| **PiperLauncher** | `piperLauncher.ts` | Piper process management |
| **InputValidator** | `inputValidator.ts` | Input validation |
| **ResourceLoader** | `resourceLoader.ts` | Resource loading |

### Voice Usage

```typescript
import { voice } from './services/voice';

// Start listening
voice.startListening();

// Speak
voice.speak('Hello, I am JARVIS');

// Stop
voice.stopListening();
```

## Vision Services (4)

Computer vision and image processing.

| Service | File | Purpose |
|---------|------|---------|
| **Vision** | `vision.ts` | Main vision service |
| **VisionHACamera** | `vision_ha_camera.ts` | Home Assistant cameras |
| **ImagePool** | `imagePool.ts` | Image buffer management |
| **ImageGenerator** | `imageGenerator.ts` | Image generation |

## Memory Services (10)

Memory storage and recall systems.

| Service | File | Purpose |
|---------|------|---------|
| **Memory** | `memory.ts` | Core memory service |
| **AdvancedMemory** | `advancedMemoryService.ts` | Enhanced memory |
| **VectorMemory** | `vectorMemoryService.ts` | Vector-based memory |
| **SemanticMemory** | `intelligence/semanticMemory.ts` | Semantic storage |
| **MemoryCompression** | `memoryCompression.ts` | Data compression |
| **MemoryConsolidation** | `memoryConsolidationService.ts` | Memory cleanup |
| **CompressedStorage** | `compressedStorage.ts` | Compressed storage |
| **Graph** | `graph.ts` | Knowledge graph |
| **VectorDBSync** | `vectorDBSyncService.ts` | Vector DB synchronization |
| **Deduplicator** | `deduplicator.ts` | Deduplication |

### Memory Usage

```typescript
import { memory } from './services/memory';

// Store
await memory.store('content', ['tag1', 'tag2']);

// Recall
const results = await memory.recall('query', 5);
```

## Plugin Services (8)

Plugin system architecture.

| Service | File | Purpose |
|---------|------|---------|
| **PluginLoader** | `pluginLoader.ts` | Dynamic loading |
| **PluginStore** | `pluginStore.ts` | Plugin state |
| **PluginHotReloader** | `pluginHotReloader.ts` | Hot reload |
| **SecurePluginAPI** | `securePluginApi.ts` | Secure API |
| **Execution** | `execution.ts` | Plugin execution |
| **CapabilityRegistry** | `registry.ts` | Capability registry |
| **Marketplace** | `../plugins/marketplace.ts` | Plugin marketplace |
| **Types** | `../plugins/types.ts` | Type definitions |

## Agent Services (3)

Autonomous agent capabilities.

| Service | File | Purpose |
|---------|------|---------|
| **AgentOrchestrator** | `agentOrchestrator.ts` | Task execution |
| **AgentPersistence** | `conversationPersistence.ts` | State persistence |
| **StateMachine** | `stateMachine.ts` | State management |

### Agent Orchestrator

```typescript
import { agentOrchestrator } from './services/agentOrchestrator';

const goal = await agentOrchestrator.createGoal(
  'Research AI trends',
  { priority: 'medium' }
);

// Subscribe to events
agentOrchestrator.onEvent((event) => {
  console.log(event.type, event.goalId);
});
```

## Integration Services (6)

External system integrations.

| Service | File | Purpose |
|---------|------|---------|
| **HomeAssistant** | `home_assistant.ts` | HA integration |
| **HABatched** | `haBatched.ts` | Batched requests |
| **HAEntitySearch** | `haEntitySearch.ts` | Entity search |
| **HAEntityWhitelist** | `haEntityWhitelist.ts` | Entity filtering |
| **Weather** | `weather.ts` | Weather data |
| **Search** | `search.ts` | Web search |

### Home Assistant

```typescript
import { homeAssistant } from './services/home_assistant';

// Connect
await homeAssistant.connect(url, token);

// Control device
await homeAssistant.callService('light.living_room', 'turn_on');
```

## Utility Services (15)

Helper utilities and cross-cutting concerns.

| Service | File | Purpose |
|---------|------|---------|
| **ErrorHandler** | `errorHandler.ts` | Error handling |
| **ErrorTypes** | `errorTypes.ts` | Error definitions |
| **RateLimiter** | `rateLimiter.ts` | Rate limiting |
| **AdaptiveRateLimiter** | `adaptiveRateLimiter.ts` | Adaptive limiting |
| **RequestDeduplication** | `requestDeduplication.ts` | Deduplication |
| **Resilience** | `resilienceService.ts` | Resilience patterns |
| **ConnectionPool** | `connectionPool.ts` | Connection management |
| **Backoff** | `rateLimiter.ts` | Exponential backoff |
| **InputValidator** | `inputValidator.ts` | Validation |
| **Tools** | `tools.ts` | Tool definitions |
| **Suggestions** | `suggestions.ts` | Suggestion engine |
| **Prefetch** | `prefetch.ts` | Data prefetching |
| **IncrementalCompute** | `incrementalCompute.ts` | Incremental updates |
| **Boot/BootFast** | `boot.ts`, `bootFast.ts` | Boot sequences |
| **TestingFramework** | `testingFramework.ts` | Test utilities |

## Service Configuration

### Configuration Manager

```typescript
import { ServiceConfigurationManager } from './services/ServiceConfigurationManager';

const config = new ServiceConfigurationManager();
config.set('service.key', value);
const value = config.get('service.key');
```

## Service Dependencies

```
KernelProcessor
├── Providers (Gemini, Ollama)
├── Intelligence
│   ├── ConversationService
│   ├── ReasoningService
│   └── PredictionService
├── Memory
└── EventBus

Voice
├── PiperTTS / WhisperSTT
├── EnhancedTTS
└── AudioAnalyzer

coreOs
├── Hardware
├── PerformanceMonitor
└── coreOsIntegration
    ├── Voice
    ├── Display
    └── Cortex
```

## Service Statistics

| Category | Count | Documented |
|----------|-------|------------|
| Core | 8 | ✅ 8 |
| System | 12 | ✅ 2 |
| AI/ML | 15 | ✅ 3 |
| Voice | 10 | ✅ 3 |
| Vision | 4 | ✅ 1 |
| Memory | 10 | ✅ 3 |
| Plugin | 8 | ✅ 2 |
| Agent | 3 | ✅ 1 |
| Integration | 6 | ✅ 3 |
| Utility | 15 | ✅ 2 |
| **Total** | **91** | **28** |

## Quick Reference

### Most Used Services

```typescript
// Core
import { eventBus } from './services/eventBus';
import { cacheService } from './services/cacheService';
import { logger } from './services/logger';
import { notificationService } from './services/notificationService';

// AI
import { kernelProcessor } from './services/kernelProcessor';
import { intelligence } from './services/intelligence';

// Voice
import { voice } from './services/voice';

// System
import { coreOs, getSystemMetrics } from './services/coreOs';
```

### Service Initialization Order

1. **Logger** - Must be first for logging
2. **EventBus** - Core communication
3. **SecureStorage** - Encrypted storage
4. **CacheService** - Caching layer
5. **coreOs** - System monitoring
6. **Registry** - Plugin registry
7. **Memory** - Memory system
8. **KernelProcessor** - AI processing
9. **Voice** - Voice interface
10. **AgentOrchestrator** - Autonomous tasks

## Documentation Status

| Priority | Services | Status |
|----------|----------|--------|
| P0 (Core) | 8 | ✅ 100% |
| P1 (Essential) | 20 | ⚠️ 50% |
| P2 (Important) | 30 | ⚠️ 20% |
| P3 (Advanced) | 33 | ⚠️ 10% |

**Next Documentation Priorities:**
1. Complete AI/ML service docs
2. Voice service deep dives
3. Memory system architecture
4. Plugin development guide
