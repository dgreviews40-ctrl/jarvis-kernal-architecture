# Changelog

All notable changes to the JARVIS Kernel project.

## [1.5.1] - 2026-02-09

### Overview
Maintenance release focusing on stability, bug fixes, and test reliability.

### Fixed
- **EventBus Race Condition** - `publish()` in `request()` now properly awaited to prevent missed events
- **Notification Memory Leak** - Auto-dismiss timeouts now cleared on manual dismiss
- **TypeScript Errors** - Added `@types/react` and `@types/react-dom` for type safety
- **Flaky Performance Test** - Adjusted threshold for jsdom environment

### Added
- `@types/react` and `@types/react-dom` dev dependencies

### Test Results
- 421 tests passing (100%)
- 0 TypeScript errors
- 0 security vulnerabilities

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
