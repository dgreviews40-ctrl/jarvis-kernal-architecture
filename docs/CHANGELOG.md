# Changelog

All notable changes to the JARVIS Kernel project.

## [1.5.3] - 2026-02-11

### Overview
Added Home Assistant WebSocket support, CI/CD pipeline, thinking sounds, and shopping list integration.

### Added
- **Home Assistant Shopping List Integration** - Voice-controlled shopping lists
  - `services/haShoppingList.ts` - HA shopping list & todo service
  - Add items via voice: "Add milk to my shopping list"
  - Query list: "What's on my shopping list?"
  - Mark items complete: "Check off milk"
  - Clear completed items
  - Supports multiple todo lists
  - Integrates with HA companion app

- **Thinking Sounds** - Subtle audio cues during AI processing
  - `services/thinkingSounds.ts` - Web Audio API sound synthesis
  - Breathing sounds during normal processing (every 4s)
  - "Hmm" vocalization for complex queries (>10 words)
  - Click acknowledgment for simple commands
  - Processing tones for long operations
  - Configurable volume and enable/disable
  - Auto-integrates with kernel processor

- **CI/CD Pipeline** - GitHub Actions workflow
  - `.github/workflows/ci.yml` - Automated testing and building
  - Multi-version Node.js testing (20.x, 22.x)
  - Security audit and TypeScript checking
  - Build artifact upload
  - Status badge in README

- **Home Assistant WebSocket Integration** - Real-time entity state updates
  - `home_assistant_ws.ts` - WebSocket client for HA real-time API
  - Automatic reconnection with exponential backoff (max 30s)
  - Push-based state updates instead of polling
  - Connection status indicators in dashboard (HTTP + WS Live badges)
  - Ping/pong keepalive for connection health
  - Network online/offline detection

### Technical
- 483 tests passing (100%)
- TypeScript compilation: 0 errors
- Build successful

---

## [1.5.2] - 2026-02-10

### Overview
Major humanization update transforming JARVIS into a more natural, conversational AI companion. All 9 humanization tasks completed across 4 phases.

### Added
- **Proactive Engagement System** - Event-driven notifications and suggestions
  - `proactiveEventHandler.ts` - Bridges events to notifications/TTS
  - `ProactiveSuggestions.tsx` - Floating suggestion panel UI
  - Milestone alerts, achievement notifications, concern follow-ups
  
- **Natural Speech Flow** - Smart TTS with sentence boundary detection
  - Sentence-level buffering instead of time-based chunks
  - Natural pause insertion at clause boundaries
  - Smoother voice streaming integration
  
- **Semantic Memory Context** - Memory injection into AI prompts
  - `semanticMemory.ts` - Context-aware memory retrieval
  - Automatic categorization (facts, preferences, episodes)
  - Natural formatting for AI consumption
  
- **Knowledge Graph Context** - Entity relationships in prompts
  - `knowledgeGraph.ts` - Relationship extraction
  - Context injection for more informed responses
  
- **Unified Sentiment Analysis** - Consolidated emotion system
  - `unifiedSentiment.ts` - Merges moodDetection, advancedSentiment, emotionalMemory
  - Single interface with caching and history tracking
  - Response guidance based on emotional state
  
- **Conversation Flow Strategy** - Strategic response generation
  - `conversationFlow.ts` - Stage management and response strategy
  - Dynamic tone adjustment based on engagement
  - Conversation continuation prompts
  
- **Personality Unification** - Dynamic personality injection
  - Merged `personalityEngine` into `jarvisPersonality.ts`
  - Trait adaptation based on context
  - Natural language generation templates

### Enhanced
- **Conversation Service** - Template-based natural response generation
- **Streaming Service** - Integrated voiceStreaming for smart TTS
- **Intelligence Orchestrator** - Semantic memory and KG context injection

### Technical
- 471 tests passing (100%)
- TypeScript compilation: 0 errors (in project code)
- Build successful with all optimizations

---

## [1.5.1] - 2026-02-14

### Overview
Maintenance release focusing on critical bug fixes, security improvements, and Python service hardening.

### Fixed
- **Duplicate Key Bug** - Fixed duplicate `negativePatterns` key in `localIntent.ts` that caused pattern matching issues
- **Missing Interface Method** - Added `refreshVectorDBStats` to `KernelState` interface in `kernelStore.ts`
- **Duplicate Window Interface** - Removed duplicate global Window interface declaration in `types.ts`
- **Circular Import** - Fixed `coreOs` import pattern in `kernelProcessor.ts` (now static only)
- **Version Synchronization** - Updated all version references from v1.5.0 to v1.5.1 across codebase

### Security (Python Services)
- **Dependency Verification** - All Python servers now check dependencies at startup with helpful error messages
- **Input Validation** - Added comprehensive input validation to all Python endpoints:
  - File size limits (50MB audio, 10MB images, 50MB LoRA requests)
  - File type validation (extensions and MIME types)
  - Content-Type header validation
  - Parameter sanitization (language, model names, adapter names)
  - JSON payload validation
- **LoRA Service** - Added validation for training examples, epochs (1-20), and adapter limits (max 10)

### Added
- `@types/react` and `@types/react-dom` dev dependencies
- Python service input validation and security hardening

### Test Results
- 506 tests passing (99.8%)
- 0 TypeScript errors
- Build successful

---

## [1.5.0] - 2026-02-08

### Overview
Kernel v1.5.0 with consolidated architecture and optimized performance.

### Key Features
- **Consolidated Architecture**: Unified service layer
- **Optimized Performance**: Reduced bundle size, faster startup
- **Enhanced Voice System**: Streaming TTS with token-level sync
- **Improved Memory Management**: Vector DB with semantic search
- **Plugin Architecture v2**: Sandboxed plugins with lifecycle management

---

## [1.4.2] - 2026-02-04

### Added
- **Agent Orchestrator Service** - Autonomous multi-step task execution
  - Task decomposition with AI-powered planning
  - Automatic tool selection and parallel execution
  - Self-correction with exponential backoff
  - Progress tracking and real-time updates
- **Agent Dashboard** - Visual interface for monitoring goals
- **Automatic Agent Detection** - Complex requests trigger agent mode
- **Built-in Tools**: web_search, store_memory, recall_memory, home_assistant, set_timer

### Usage
```
"Plan a dinner party for 6 people"  → Agent mode activates automatically
"agent: Research electric vehicles"  → Explicit agent mode
```

---

## [1.4.1] - 2026-02-04

### Added
- **Memory Consolidation Service** - Intelligent memory management
  - Automatic merging of similar memories (85% similarity threshold)
  - Deduplication of near-exact matches (95% threshold)
  - Memory decay for old, unaccessed memories
  - Cross-session persistence with session summaries
- **Memory Consolidation Dashboard** - Visual management interface

### Performance
- Memory redundancy reduced by 83% (~30% → ~5%)
- Search speed: O(n) → O(log n) with HNSW index
- Storage efficiency improved by 30%

---

## [1.4.0] - 2026-02-04

### Added
- **Local Vector Database** - Browser-based semantic memory
  - Local embeddings using `@xenova/transformers`
  - HNSW index for fast approximate nearest neighbor search
  - IndexedDB persistence across sessions
  - Fallback to hash-based embeddings
- **Context Window Management** - Intelligent token management
  - Token estimation for all providers
  - Smart pruning with priority-based removal
  - Automatic summarization for long conversations
  - Provider-specific limits (Gemini: 1M, Ollama: 8K)

### Performance
- Memory search latency: ~200ms → ~50ms (75% faster)
- Token efficiency: 60% → 85% (42% better)
- Full offline capability

---

## [1.3.x] - Previous Releases

### v1.3.0
- Core OS Integration
- Hardware monitoring (CPU, memory, battery, network)
- Predictive analytics
- System alerts
- Process management

---

## [1.2.x] - Core OS Era

### v1.2.0
- System Core Service (core.os)
- Real-time system metrics
- Battery status monitoring
- Network connection info
- Storage quota tracking
- Performance metrics
- Predictive analysis
- Automated system alerts

---

## [1.1.x] - Voice System

### v1.1.0
- Advanced voice recognition
- Streaming TTS with token-level synchronization
- Wake word detection ("JARVIS")
- Voice performance monitoring
- Piper TTS integration
- Whisper STT server

---

## Version Compatibility

| Version | Compatible With | Migration Notes |
|---------|-----------------|-----------------|
| 1.5.0 | All 1.4.x | Automatic upgrade |
| 1.4.2 | 1.4.0+ | No breaking changes |
| 1.4.1 | 1.4.0+ | No breaking changes |
| 1.4.0 | 1.3.x+ | Automatic initialization |
| 1.3.x | 1.2.x+ | Config updates required |
| 1.2.x | 1.1.x+ | Service changes |
| 1.1.x | 1.0.x+ | Voice setup required |

---

## Migration Guides

### From 1.4.x to 1.5.0
No breaking changes. Automatic upgrade on restart.

### From 1.3.x to 1.4.x
- New dependencies auto-installed
- Vector DB initializes automatically
- Context window management is automatic

### From 1.2.x to 1.3.x
- Update configuration for new services
- Hardware monitor requires separate start

---

## Deprecated Features

| Feature | Deprecated In | Replacement | Removal Date |
|---------|---------------|-------------|--------------|
| Legacy memory service | 1.4.0 | Vector DB | 1.6.0 |
| Old voice API | 1.1.0 | Streaming voice | 1.5.0 |
| Plugin v1 API | 1.3.0 | Plugin v2 API | 1.5.0 |

---

**Note**: This changelog consolidates release notes from previous versions. For detailed information about specific features, see individual documentation files.
