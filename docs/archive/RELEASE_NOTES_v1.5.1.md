# JARVIS Kernel v1.5.1 Release Notes

**Release Date:** 2026-02-09  
**Codename:** "Iron Legion"  
**Status:** Stable

---

## 🎯 Overview

JARVIS Kernel v1.5.1 is a maintenance release focusing on stability, bug fixes, and test reliability. This release addresses critical race conditions and memory leaks identified in v1.5.0.

> **Post-Release Update (2026-02-10):** The Humanization Enhancement has been completed, adding 9 major features across 4 phases to transform JARVIS into a more natural, conversational AI companion.

---

## 🐛 Bug Fixes

### Critical

| Issue | Description | File |
|-------|-------------|------|
| **EventBus Race Condition** | `publish()` in `request()` method was not awaited, causing potential missed events | `services/eventBus.ts` |
| **Notification Memory Leak** | Auto-dismiss timeouts not cleared on manual dismiss, accumulating over time | `services/notificationService.ts` |
| **TypeScript Errors** | Missing `@types/react` caused 50+ TypeScript compilation errors | `package.json` |

### Test Reliability

| Issue | Description |
|-------|-------------|
| **Flaky Performance Test** | Cache performance test threshold too aggressive for jsdom environment |

---

## 🧪 Test Results

```
Test Files: 19 passed (19)
     Tests: 421 passed (421)
  Duration: ~12s
```

- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ All performance tests passing
- ✅ TypeScript compilation: 0 errors
- ✅ Security audit: 0 vulnerabilities

---

## 📦 Dependencies

### Added
- `@types/react@^19.0.0` - React type definitions
- `@types/react-dom@^19.0.0` - React DOM type definitions

### Updated
- Refreshed all dependencies to latest compatible versions

---

## 🔧 Technical Details

### EventBus Fix
```typescript
// Before
this.publish(channel, payload, { correlationId, priority: 'high' });

// After  
this.publish(channel, payload, { correlationId, priority: 'high' }).catch(err => {
  clearTimeout(timeout);
  if (unsubscribeFn) unsubscribeFn();
  reject(err);
});
```

### NotificationService Fix
```typescript
// Added timeout tracking
private timeouts = new Map<string, NodeJS.Timeout>();

// Clear on dismiss
dismiss(id: string): void {
  const timeout = this.timeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    this.timeouts.delete(id);
  }
  // ...
}
```

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Bundle Size (gzipped) | ~790 KB |
| Build Time | ~90s |
| Test Suite | ~12s |
| Initial Load | ~92 KB |

---

## 🚀 Upgrade Instructions

### From v1.5.0
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Run tests to verify
npm test

# Build for production
npm run build
```

### Fresh Install
```bash
git clone <repository>
cd jarvis-kernel-architect
npm install
npm test
npm run build
```

---

## 🎉 Post-Release: Humanization Enhancement (2026-02-10)

After the v1.5.1 release, a comprehensive humanization enhancement was completed:

### New Features Added

| Feature | Description | File |
|---------|-------------|------|
| **Proactive Engagement** | Event-driven notifications, milestone alerts | `services/proactiveEventHandler.ts` |
| **Natural Speech Flow** | Sentence-level TTS streaming | `services/streaming.ts` |
| **Semantic Memory** | Context injection for AI prompts | `services/intelligence/semanticMemory.ts` |
| **Knowledge Graph Context** | Entity relationships in prompts | `services/intelligence/knowledgeGraph.ts` |
| **Unified Sentiment** | Consolidated emotion analysis | `services/intelligence/unifiedSentiment.ts` |
| **Conversation Flow** | Strategic response generation | `services/intelligence/conversationFlow.ts` |
| **Personality Unification** | Dynamic trait injection | `services/jarvisPersonality.ts` |
| **Proactive Suggestions UI** | Floating suggestion panel | `components/ProactiveSuggestions.tsx` |

### Test Results After Humanization
- 471 tests passing (100%)
- TypeScript compilation: 0 errors
- Build successful

See [JARVIS_HUMANIZATION_ROADMAP.md](./JARVIS_HUMANIZATION_ROADMAP.md) for complete details.

---

## 📝 Known Limitations

1. **Voice Setup** - Piper TTS voice model (~115MB) must be downloaded separately via `Install-JARVIS-Voice.bat`
2. **Home Assistant** - Requires proxy server running (`npm run proxy`)
3. **GPU Monitor** - NVIDIA GPUs only for hardware monitoring

---

## 🙏 Credits

- Core development team
- Contributors and testers
- Open source community

---

## 📄 Documentation

- [README.md](README.md) - Getting started guide
- [AGENTS.md](AGENTS.md) - Architecture and development
- [JARVIS_HUMANIZATION_ROADMAP.md](JARVIS_HUMANIZATION_ROADMAP.md) - Humanization work completed
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Detailed architecture
- [docs/TESTING.md](docs/TESTING.md) - Testing guide

---

**Full Changelog:** See [docs/CHANGELOG.md](docs/CHANGELOG.md)

**Download:** [GitHub Releases](https://github.com/yourusername/jarvis-kernel/releases/tag/v1.5.1)
