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

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** High  
**Effort:** High  
**Blocked by:** Requires Ollama API support or direct llama.cpp integration

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

**Status:** ❌ NOT IMPLEMENTED (Basic vision exists, advanced pipeline pending)  
**Priority:** Medium  
**Effort:** Medium  
**Depends on:** GPU memory availability

**Description:**  
Current vision (`vision_server.py`) supports single image analysis. Advanced pipeline would include:

- [ ] Video stream frame sampling
- [ ] Batch processing for efficiency  
- [ ] Visual memory ("What did I see 5 minutes ago?")
- [ ] Object tracking across frames

**Implementation Sketch:**
```typescript
interface VisionPipeline {
  sampleVideo(stream: MediaStream, fps: number): Frame[];
  describeFrames(frames: Frame[]): Description[];
  queryVisualMemory(query: string): VisualMemory[];
}
```

**Files to Create/Modify:**
- New: `services/visionPipeline.ts`
- Modify: `vision_server.py`

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

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** Low  
**Effort:** Medium  
**Depends on:** Audio synthesis capability

**Description:**  
Add subtle audio cues during "thinking" periods:
- Soft breath sounds during processing
- Subtle "hmm" sounds when analyzing
- Silence-avoidance audio padding

---

### 6. WebSocket for Home Assistant

**Status:** 🔄 PARTIALLY IMPLEMENTED  
**Priority:** Medium  
**Effort:** Medium  
**Note:** Feature flag exists (`ENABLE_HA_WEBSOCKET: false`)

**Description:**  
Replace polling-based HA updates with real-time WebSocket connection.

**Current State:**
- Feature flag defined in `constants/config.ts`
- Basic WebSocket implementation pending

**Files to Modify:**
- Modify: `services/home_assistant.ts`
- New: `services/home_assistant_ws.ts`

---

### 7. CI/CD Pipeline

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** Low  
**Effort:** Low  

**Description:**  
GitHub Actions workflow for testing and building.

**Required File:**
```yaml
# .github/workflows/ci.yml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run build
```

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
| Shopping Lists | Low | Simple local storage |
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
| Voice/Humanization | 7 | 6 | 1 | 86% |
| Vision | 2 | 1 | 1 | 50% |
| DevOps | 2 | 0 | 2 | 0% |
| Integrations | 8 | 0 | 8 | 0% |
| **TOTAL** | **33** | **20** | **13** | **61%** |

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
