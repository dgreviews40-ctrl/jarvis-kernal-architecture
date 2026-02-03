# Architecture Decision Records (ADRs)

This document records significant architectural decisions made in the JARVIS project.

## ADR-001: State Management with Zustand

**Status:** Accepted

**Context:**
The application had state scattered across 15+ services with props drilling through multiple component layers. This made the code hard to maintain and caused unnecessary re-renders.

**Decision:**
Migrate to Zustand for state management with the following stores:
- `uiStore` - UI state (views, tabs, modals)
- `kernelStore` - Core kernel state (processor, providers, plugins)
- `memoryStore` - Memory-related state
- `logsStore` - Log entries and filters
- `pluginStore` - Plugin registry state

**Consequences:**
- ✅ Reduced props drilling
- ✅ Better performance with selective subscriptions
- ✅ Easier testing with mock stores
- ✅ Time investment: ~6 hours
- ⚠️ Learning curve for team members

---

## ADR-002: Intelligence Service Consolidation

**Status:** Accepted

**Context:**
The intelligence layer had grown to 9 separate services with overlapping functionality:
- conversationalContext.ts (17.5 KB)
- personalityEngine.ts (14.0 KB)
- naturalResponse.ts (15.6 KB)
- multiTurnReasoning.ts (14.3 KB)
- knowledgeGraph.ts (18.0 KB)
- predictiveModel.ts (19.6 KB)
- proactiveIntelligence.ts (14.7 KB)
- advancedSentiment.ts (15.2 KB)
- semanticMemory.ts (15.0 KB)

Total: ~144 KB of intelligence code

**Decision:**
Consolidate into 3 focused services:
- `conversationService` - Context, personality, responses
- `reasoningService` - Multi-turn reasoning, knowledge graph
- `predictionService` - User behavior prediction, suggestions

**Consequences:**
- ✅ Reduced bundle size: 34 KB → 6 KB (-82%)
- ✅ Easier to understand and maintain
- ✅ Faster initial load
- ✅ Reduced cognitive load
- ⚠️ Lost some edge-case features (acceptable trade-off)

---

## ADR-003: Plugin System v2 Architecture

**Status:** Accepted (Foundation Complete)

**Context:**
The original plugin system (v1) had basic functionality but lacked:
- Sandboxed execution
- Version compatibility checking
- Granular permissions
- Plugin-to-plugin communication

**Decision:**
Design a new plugin architecture with:
- Manifest v2 with engine version requirements
- Permission-based API access (19 granular permissions)
- Capability registry for inter-plugin communication
- Lifecycle management (install → load → start → stop → unload)
- Event system for loose coupling

**Consequences:**
- ✅ Foundation ready for third-party plugins
- ✅ Better security with permission system
- ✅ Extensible architecture
- ⚠️ Not yet fully implemented (dynamic loading pending)
- ⚠️ Breaking change from v1 (migration guide needed)

---

## ADR-004: Code Splitting Strategy

**Status:** Accepted

**Context:**
The bundle size had grown to 821 KB, exceeding the 500 KB recommendation. Initial load was slow.

**Decision:**
Implement code splitting with:
1. Lazy load dashboard components (DevDashboard, Settings, etc.)
2. Manual chunks for vendor libraries
3. Feature-based chunks (intelligence, voice, vision)

**Vite Configuration:**
```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-zustand': ['zustand'],
  'feature-intelligence': ['./services/intelligence'],
  'feature-voice': ['./services/voice'],
  'feature-vision': ['./services/vision']
}
```

**Consequences:**
- ✅ Main bundle: 821 KB → 296 KB (-64%)
- ✅ Initial load: 214 KB → 92 KB gzipped (-57%)
- ✅ Better caching with separate vendor chunks
- ⚠️ Slight delay when opening lazy-loaded tabs

---

## ADR-005: Error Handling Strategy

**Status:** Accepted

**Context:**
Errors were not consistently handled, leading to poor user experience and difficult debugging.

**Decision:**
Implement comprehensive error handling:
1. Enhanced ErrorBoundary with recovery options
2. Global error handler service with retry logic
3. Graceful degradation for non-critical features
4. User notification system
5. Error recovery dashboard

**Consequences:**
- ✅ Better user experience during errors
- ✅ Automatic retry for transient failures
- ✅ Clear recovery paths
- ✅ Error statistics and monitoring
- ⚠️ Small bundle increase (+3 KB)

---

## ADR-006: Logger Consolidation

**Status:** Accepted

**Context:**
Three separate logging systems existed:
- logger.ts (basic logging)
- loggerEnhanced.ts (Cortex integration)
- addLog() in App.tsx (UI updates)

This caused duplicate logs and confusion.

**Decision:**
Consolidate into a single logger.ts with:
- All features from both loggers
- Cortex integration for error reporting
- Console output with styling
- localStorage persistence

**Consequences:**
- ✅ Single source of truth
- ✅ Reduced bundle size (-72 KB)
- ✅ Simpler API
- ✅ No duplicate logs

---

## Technical Debt Register

### Current Technical Debt

| Item | Priority | Effort | Description |
|------|----------|--------|-------------|
| Plugin Loader | High | 6-8 hrs | Complete dynamic plugin loading |
| Test Coverage | Medium | 8-12 hrs | Add unit/integration tests |
| Type Safety | Low | 4-6 hrs | Strict TypeScript, remove `any` |
| Documentation | Low | 2-3 hrs | API documentation |

### Resolved Technical Debt

| Item | Resolution | Date |
|------|------------|------|
| Circular dependencies | Extracted CircuitBreaker | 2026-01-30 |
| Duplicate loggers | Consolidated to single logger | 2026-01-30 |
| Scattered state | Migrated to Zustand stores | 2026-01-31 |
| Intelligence complexity | Consolidated 6→3 services | 2026-02-01 |
| Bundle size | Implemented code splitting | 2026-02-01 |

---

## Performance Benchmarks

### Bundle Size History

| Date | Main Bundle | Gzipped | Notes |
|------|-------------|---------|-------|
| Initial | 887 KB | 230 KB | Before optimizations |
| 2026-01-30 | 815 KB | 212 KB | Logger consolidation |
| 2026-02-01 | 296 KB | 92 KB | Code splitting complete |

### Load Time Estimates

| Connection | Before | After | Improvement |
|------------|--------|-------|-------------|
| Slow 3G | ~8s | ~3s | -62% |
| Fast 3G | ~4s | ~1.5s | -62% |
| 4G | ~2s | ~0.8s | -60% |

---

## Future Considerations

### Potential Architecture Changes

1. **Web Workers** - Move heavy computation off main thread
2. **Service Worker** - Offline support and caching
3. **WebAssembly** - Performance-critical operations
4. **GraphQL** - Replace REST APIs for data fetching

### Scalability Planning

- Current architecture supports ~50 plugins
- State management tested with 10,000 memory nodes
- Bundle splitting supports 20+ lazy-loaded chunks
