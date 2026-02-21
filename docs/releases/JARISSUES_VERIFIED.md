# JARVIS Issues - Verified Findings

**Verification Date:** 2026-02-13  
**Status:** Deep-dive verification of previous analysis claims

---

## Summary of Corrections

After deeper investigation, here are the CORRECTED findings:

| Issue | Original Claim | Verified Status | Correction |
|-------|---------------|-----------------|------------|
| Duplicate import in kernelProcessor.ts | CONFIRMED | ✅ **REAL** | Lines 38 and 66 both import `memoryConsolidationService` |
| localStorage quota handling | Missing everywhere | ⚠️ **PARTIAL** | `safeUtils.ts` and `persistence.ts` HAVE quota handling, but `memory.ts` does NOT use them |
| Rate limiter persistence | Not persisted | ❌ **WRONG** | Rate limiter DOES persist to localStorage with `STORAGE_KEY = 'jarvis_gemini_rate_limit'` |
| AudioContext memory leak | Pool grows unbounded | ⚠️ **MOSTLY FIXED** | Code has `releaseAudioContext()` and cleanup - but edge cases may exist |
| API key exposure | Exposed via VITE_ prefix | ✅ **REAL** | `VITE_GEMINI_API_KEY` is bundled into client JS |
| EventBus memory leak | History unbounded | ⚠️ **INCORRECT** | History IS capped at 1000 events via `maxHistorySize` |

---

## Verified Critical Issues (REAL)

### 1. Duplicate Import (CONFIRMED REAL)

**File:** `services/kernelProcessor.ts`

**Lines 38 and 66:**
```typescript
// Line 38
import { memoryConsolidationService } from './memoryConsolidationService';

// Line 66 (DUPLICATE)
import { memoryConsolidationService } from './memoryConsolidationService';
```

**Impact:** None (JavaScript modules handle duplicates gracefully), but indicates code quality issue.

**Fix:** Remove line 66.

---

### 2. memory.ts Does NOT Use Safe Storage (CONFIRMED REAL)

**File:** `services/memory.ts` lines 242-249

**Current Code:**
```typescript
private persist(): void {
  try {
    const nodesArray = Array.from(this.nodes.values());
    localStorage.setItem(this.storageKey, JSON.stringify(nodesArray));
  } catch (e) {
    console.error('[MEMORY] Failed to persist:', e);
  }
}
```

**Problem:** 
- Uses raw `localStorage.setItem()` 
- Does NOT check for `QuotaExceededError`
- Does NOT attempt recovery like `persistence.ts` does
- Does NOT use the existing `safeLocalStorageSet` from `safeUtils.ts`

**Evidence safeUtils exists but isn't used:**
- `safeUtils.ts` has `safeLocalStorageSet()` with quota handling (lines 78-104)
- `persistence.ts` has quota handling in `createNamespacedStorage()` (lines 62-94)
- `memory.ts` imports neither of these

**Fix:** Import and use `safeLocalStorageSet` from `safeUtils.ts`:
```typescript
import { safeLocalStorageSet, estimateLocalStorageUsage } from './safeUtils';

private persist(): void {
  const nodesArray = Array.from(this.nodes.values());
  const result = safeLocalStorageSet(this.storageKey, nodesArray);
  
  if (!result.success && result.quotaExceeded) {
    // Handle quota exceeded - remove oldest memories
    this.handleStorageQuotaExceeded();
  }
}
```

---

### 3. API Key Exposure (CONFIRMED REAL)

**Files:** 
- `vite.config.ts` line 30
- `services/gemini.ts` lines 113-137
- Multiple other services

**Evidence:**
```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    }
  };
});

// services/gemini.ts
apiKey = (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined) || 
         (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : null) || null;
```

**Impact:** API key is bundled into client-side JavaScript and visible in browser dev tools.

**Note:** This is documented as intentional in AGENTS.md (line 211), but is a security risk.

---

## Issues That Were INCORRECT or OVERSTATED

### 1. Rate Limiter Persistence (MY CLAIM WAS WRONG)

**File:** `services/rateLimiter.ts`

**Evidence it IS persisted:**
```typescript
const STORAGE_KEY = 'jarvis_gemini_rate_limit';

constructor(config: Partial<RateLimitConfig> = {}) {
  this.config = { ...DEFAULT_CONFIG, ...config };
  this.stats = this.loadStats();  // <-- Loads from localStorage!
}

private loadStats(): UsageStats {
  if (typeof localStorage === 'undefined') {
    return this.getFreshStats();
  }
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      
      // Check if it's a new day
      if (now - parsed.dayStartTime > 24 * 60 * 60 * 1000) {
        return this.getFreshStats();
      }
      // ... more logic
    }
  }
}

private saveStats() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
}
```

**Correction:** Rate limiter properly persists and loads state from localStorage.

---

### 2. EventBus History Memory Leak (MY CLAIM WAS WRONG)

**File:** `services/eventBus.ts`

**Evidence it's capped:**
```typescript
class EventBus {
  private maxHistorySize = 1000;  // <-- Cap exists!
  
  async publish<T>(...) {
    // Store in history
    this.history.unshift(event);
    if (this.history.length > this.maxHistorySize) {  // <-- Enforcement
      this.history.pop();
    }
  }
}
```

**Correction:** History IS bounded at 1000 events. Not a memory leak.

---

### 3. AudioContext Memory Leak (OVERSTATED)

**File:** `services/voice.ts`

**Evidence of proper cleanup:**
```typescript
// releaseAudioContext method exists (line 391)
private releaseAudioContext(ctx: AudioContext): void {
  if (!ctx) return;
  this.activeAudioContexts.delete(ctx);
  if (ctx.state === 'running') {
    ctx.suspend().catch(() => {});
  }
  this.startIdleTimer(ctx);
}

// Called in multiple places:
- stopVAD() line 537
- cleanup() line 786
- interrupt() line 922
- speakWithNeural() line 1346 (in finally block)
```

**However, potential edge case found:**
```typescript
// Line 465-468
private initVAD(): void {
  if (!this.audioContext) {
    this.audioContext = this.getAudioContext();
  }
  if (!this.audioContext) return;  // Returns without cleanup if null
```

**Correction:** Most cleanup is properly implemented. Minor edge cases may exist but the main concern was overstated.

---

## Additional Issues Found During Verification

### 1. Memory Service Not Using Safe Utilities (NEW FINDING)

While `safeUtils.ts` has comprehensive safe storage functions, `memory.ts` doesn't use them. This is a code consistency issue.

**Recommendation:** Refactor `memory.ts` to use `safeLocalStorageSet`/`safeLocalStorageGet`.

---

### 2. Inconsistent Error Handling Patterns (NEW FINDING)

Different services handle localStorage errors differently:
- `safeUtils.ts`: Comprehensive with quota detection
- `persistence.ts`: Has cleanup logic on quota exceeded
- `memory.ts`: Basic console.error only
- `rateLimiter.ts`: Silent fail if localStorage unavailable

**Recommendation:** Standardize on `safeUtils.ts` functions across all services.

---

## Corrected Priority List

### ACTUAL Critical Issues:

1. **Duplicate import** in `kernelProcessor.ts` (line 66) - Code quality
2. **memory.ts lacks quota handling** - Will crash when storage full
3. **API key exposure** - Security risk (but documented as known)

### NOT Actually Issues:

1. ~~Rate limiter persistence~~ - Actually works correctly
2. ~~EventBus memory leak~~ - History is capped at 1000
3. ~~Major AudioContext leaks~~ - Cleanup is mostly implemented

---

## Recommended Actions

### Immediate (This Week):

1. Remove duplicate import from `kernelProcessor.ts` line 66
2. Refactor `memory.ts` to use `safeLocalStorageSet` from `safeUtils.ts`

### Short Term (Next Sprint):

3. Audit all services to use standardized safe storage functions
4. Consider moving API calls to proxy server (requires architecture change)

---

**End of Verified Findings**
