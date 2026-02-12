# JARVIS Unified Roadmap

> **Last Updated:** 2026-02-10  
> **Version:** v1.5.1+  
> **Status:** Consolidated from all roadmap documents - contains ONLY pending/incomplete items

---

## ✅ Completed (For Reference)

The following major features have been **implemented and verified** through code inspection:

| Feature | Status | Location |
|---------|--------|----------|
| Model Manager (hot models, prediction, switching) | ✅ Complete | `services/modelManager.ts` |
| CUDA Embedding Server | ✅ Complete | `embedding_server.py` |
| GPU Monitor / Hardware Dashboard | ✅ Complete | `services/gpuMonitor.ts` |
| Error Boundaries | ✅ Complete | `components/ErrorBoundary.tsx` |
| Configuration Constants | ✅ Complete | `constants/config.ts` |
| Zustand State Management | ✅ Complete | `stores/*.ts` |
| Interruption Handling | ✅ Complete | `services/intelligence/conversationFlow.ts` |
| Proactive Engagement | ✅ Complete | `services/proactiveEventHandler.ts` |
| Natural Speech Flow | ✅ Complete | `services/streaming.ts` |
| SSML/Prosody Framework | ✅ Complete | `services/enhancedTTS.ts` |
| Clarification System | ✅ Complete | `services/intelligence/multiTurnReasoning.ts` |
| E2E Tests (Playwright) | ✅ Complete | `tests/e2e/*.ts` |
| Code Splitting | ✅ Complete | `vite.config.ts` |
| Voice Humanization | ✅ Complete | `JARVIS_HUMANIZATION_ROADMAP.md` |

---

## 🚧 Pending Features (Incomplete)

### 1. KV-Cache Persistence for LLM Inference

**Status:** ✅ **IMPLEMENTED** (2026-02-10)  
**Location:** `services/kvCache.ts`, `services/providers.ts`, `hooks/useKVCache.ts`  
**Component:** `components/KVCacheMonitor.tsx`

**Implementation Details:**
- Session-based conversation context caching
- Ollama context ID tracking for multi-turn conversations
- LRU eviction policy (max 5 contexts, 5-minute TTL)
- ~20% estimated latency improvement for cached contexts
- React hook `useKVCache()` for monitoring
- UI component `KVCacheMonitor` for real-time stats

**How It Works:**
1. Each user session gets a unique session ID
2. System prompts are cached per session
3. Conversation history is maintained in memory
4. Ollama's context ID is preserved across requests
5. Auto-cleanup after 5 minutes of inactivity

**Description:**  
Cache attention keys/values for system prompts to avoid reprocessing "You are JARVIS..." on every request.

**Expected Benefit:** ~20% faster responses for repeated contexts

**Implementation Sketch:**
```typescript
interface KVCache {
  systemKV: GPUBuffer;  // Cached system prompt processing
  appendUserMessage(kv: GPUBuffer, message: string): GPUBuffer;
}
```

**Files to Modify:**
- New: `services/kvCache.ts`
- Modify: `services/providers.ts` (Ollama integration)

---

### 2. Advanced Vision Pipeline

**Status:** ✅ **IMPLEMENTED** (2026-02-11)  
**Location:** `services/visionPipeline.ts`, `vision_server.py`, `hooks/useVisionPipeline.ts`  
**Component:** `components/VisionPipelineMonitor.tsx`

**Implementation Details:**
- **Video Stream Sampling** - Configurable FPS (default 1, max 5)
- **Batch Processing** - Process up to 8 frames at once for GPU efficiency
- **Visual Memory** - 10-minute retention with semantic search
- **Activity Summary** - Top tags, unique objects, source tracking

**Features:**
- Query visual memory with natural language ("What did I see 5 minutes ago?")
- Real-time GPU memory monitoring (pauses if >80%)
- Automatic batch queue management with timeout
- CLIP-based semantic search for visual memory

**API Endpoints Added:**
- `POST /batch/analyze` - Batch image analysis (up to 16 images)

---

### 3. LoRA Fine-Tuning Support

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** Low  
**Effort:** High  
**Blocked by:** Training infrastructure, data pipeline

**Description:**  
Small-scale local fine-tuning on 1080 Ti using LoRA adapters (MBs, not GBs) for personalization.

**Use Cases:**
- Teach JARVIS user preferences
- Personalize on conversation history
- Train on user documents

**Implementation Sketch:**
```python
# lora_trainer.py
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
```

---

### 4. SSML Prosody Control with Piper

**Status:** 🔄 PARTIALLY IMPLEMENTED  
**Priority:** Low  
**Effort:** Medium  
**Blocked by:** Piper TTS engine limitations

**Description:**  
Framework exists in `services/enhancedTTS.ts` but **disabled** (`ssmlSupported: false`) because Piper reads SSML tags literally rather than processing them.

**Options:**
1. Switch to TTS engine with full SSML support (Azure, AWS Polly)
2. Pre-process audio with prosody adjustments
3. Wait for Piper SSML support

---

### 5. Breathing/Thinking Sounds

**Status:** ✅ **IMPLEMENTED** (2026-02-11)  
**Priority:** Low  
**Effort:** Medium  
**Location:** `services/thinkingSounds.ts`

**Description:**  
Subtle audio cues during AI processing to avoid awkward silence.

**Features:**
- **Breathing sounds** - Soft breath during normal processing (plays every 4s)
- **"Hmm" sounds** - Vocal acknowledgment when analyzing complex queries (>10 words)
- **Click sounds** - Quick acknowledgment for simple commands
- **Processing sounds** - Subtle electronic tone for long operations

**Sound Types:**
| Type | Trigger | Description |
|------|---------|-------------|
| `breathing` | All processing | Soft noise-filtered breath |
| `hmm` | Complex queries | Vocal thinking sound (oscillator) |
| `click` | Simple commands | Subtle acknowledgment |
| `processing` | Long operations | Electronic activity tone |

**Integration:**
- Auto-starts when kernel begins processing
- Auto-stops when response is ready
- Volume configurable (default: 15%)
- Can be disabled via `FEATURES.ENABLE_THINKING_SOUNDS`

**Configuration:**
```typescript
// In constants/config.ts
ENABLE_THINKING_SOUNDS: true

// Runtime control
thinkingSounds.setVolume(0.2); // 20% volume
thinkingSounds.disable(); // Turn off
```

---

### 6. WebSocket for Home Assistant

**Status:** ✅ **IMPLEMENTED** (2026-02-10)  
**Priority:** Medium  
**Effort:** Medium  
**Location:** `services/home_assistant_ws.ts`, `services/home_assistant.ts`, `components/HomeAssistantDashboard.tsx`

**Implementation Details:**
- Real-time entity state updates via WebSocket API
- Automatic reconnection with exponential backoff
- Connection state monitoring in dashboard
- Subscribes to `state_changed` events
- HTTP polling fallback when WebSocket unavailable

**Features:**
- Push-based state updates (no polling needed when connected)
- Connection status indicator in HA dashboard (HTTP + WS Live)
- Reconnection with backoff (max 30s delay)
- Ping/pong keepalive (30s interval)
- Network online/offline detection

**Usage:**
```typescript
// Enable in constants/config.ts
ENABLE_HA_WEBSOCKET: true

// Dashboard shows:
// - "HTTP" badge: REST API connection
// - "WS Live" badge: Real-time WebSocket active
```

---

### 7. CI/CD Pipeline

**Status:** ✅ **IMPLEMENTED** (2026-02-11)  
**Priority:** Low  
**Effort:** Low  
**Location:** `.github/workflows/ci.yml`

**Description:**  
GitHub Actions workflow for testing and building.

**Features:**
- Multi-version Node.js testing (20.x, 22.x)
- Automated testing with `npm test`
- Build verification with `npm run build`
- Security audit with `npm audit`
- TypeScript type checking
- Artifact upload for build outputs

**Workflow triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main`

**Status badge added to README**
      - run: npm run build
```

---

### 8. Home Assistant Shopping List & Todo Integration

**Status:** ✅ **IMPLEMENTED** (2026-02-11)  
**Priority:** Medium  
**Effort:** Medium  
**Location:** `services/haShoppingList.ts`, `services/kernelProcessor.ts`

**Description:**  
Voice-controlled shopping list and todo management using Home Assistant's native entities.

**Features:**
- Add items to HA shopping list via voice
- Mark items as complete/incomplete
- Query shopping list contents
- Clear completed items
- Support for multiple todo lists

**Voice Commands:**
| Command | Action |
|---------|--------|
| "Add milk to my shopping list" | Adds milk to shopping list |
| "Put eggs on the shopping list" | Adds eggs to shopping list |
| "I need to buy bread" | Adds bread to shopping list |
| "What's on my shopping list?" | Lists pending items |
| "Check off milk" | Marks item as complete |
| "Clear completed items" | Removes completed items |

**Integration:**
- Uses Home Assistant `shopping_list` services
- Supports `todo` entities for multiple lists
- Works with HA companion app shopping list
- Syncs across all HA-connected devices

---

## 📋 Integration Wishlist (Future)

From `docs/archive/CAPABILITIES.md` - potential future integrations:

| Integration | Priority | Notes |
|-------------|----------|-------|
| Email (Gmail, Outlook) | Low | Requires OAuth setup |
| Spotify/Music Control | Low | Smart home integration |
| Navigation/Maps | Low | Google Maps API |
| Translation Services | Low | Google Translate API |
| Stock/Crypto Tracking | Low | Financial APIs |
| Fitness/Health Data | Low | Wearable integration |
| ~~Shopping Lists~~ | ✅ Complete | HA integration complete |
| Note-taking (Notion) | Low | API integration |

---

## 🎯 Recommended Priority Order

### Phase 1: Performance (High Impact)
1. **KV-Cache Persistence** - Biggest perf gain (~20% faster)
2. **WebSocket for Home Assistant** - Real-time updates

### Phase 2: Features (Medium Impact)
3. **Advanced Vision Pipeline** - Better video capabilities

### Phase 3: Polish (Low Impact)
5. **SSML Prosody with Piper** (or switch TTS)
6. **Breathing/Thinking Sounds** - Audio polish
7. **CI/CD Pipeline** - Development workflow

### Phase 4: Advanced (Future)
8. **LoRA Fine-Tuning** - Personalization
9. **Integration Wishlist** - Based on user needs

---

## 📊 Implementation Status Summary

| Category | Total | Complete | Pending | Progress |
|----------|-------|----------|---------|----------|
| Core Architecture | 8 | 8 | 0 | 100% |
| AI/ML Features | 6 | 5 | 1 | 83% |
| Voice/Humanization | 7 | 7 | 0 | 100% |
| Vision | 2 | 1 | 1 | 50% |
| DevOps | 2 | 1 | 1 | 50% |
| Integrations | 8 | 2 | 6 | 25% |
| **TOTAL** | **34** | **25** | **9** | **74%** |

---

## 🔍 Verification Notes

This roadmap was generated through deep code inspection:

1. **Searched for:** All roadmap documents, TODO comments, feature flags
2. **Verified:** Implementation status by grepping source code
3. **Confirmed:** File existence and functionality
4. **Excluded:** Items found to be already implemented

**Sources Consolidated:**
- `JARVIS_HUMANIZATION_ROADMAP.md` → All items complete
- `docs/roadmaps/v1.5.1-realistic-improvements.md` → Partially complete
- `docs/archive/IMPROVEMENTS.md` → Mostly complete
- `docs/archive/CAPABILITIES.md` → Wishlist items

---

*This document contains ONLY pending items. For completed features, see individual implementation files and AGENTS.md.*
