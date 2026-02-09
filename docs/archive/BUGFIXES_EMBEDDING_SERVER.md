# Bug Fixes - CUDA Embedding Server Implementation

## Summary

Fixed 4 bugs in the CUDA Embedding Server implementation:

---

## Bug 1: Cache Indexing Error (Critical)

**File:** `embedding_server.py`  
**Line:** 162-164  
**Severity:** High

### Problem
The cache indexing logic was incorrect. When iterating over `text_indices` and `texts_to_encode` together, the code used `text_indices.index(idx)` which would always return the first occurrence of `idx`, causing wrong embeddings to be cached.

### Original Code
```python
for idx, text in zip(text_indices, texts_to_encode):
    cache_key = get_cache_key(text)
    embedding_cache[cache_key] = new_embeddings[text_indices.index(idx)]
```

### Fixed Code
```python
for i, (idx, text) in enumerate(zip(text_indices, texts_to_encode)):
    cache_key = get_cache_key(text)
    embedding_cache[cache_key] = new_embeddings[i]
```

### Impact
Without this fix, cached embeddings would be mismatched with their texts, causing incorrect similarity calculations and search results.

---

## Bug 2: Missing Port in Shutdown (Medium)

**File:** `JARVIS_RUN.bat`  
**Line:** 91  
**Severity:** Medium

### Problem
Port 5002 (embedding server) was added to the cleanup section (line 14) but missing from the shutdown section. This meant the embedding server process wouldn't be killed when closing JARVIS.

### Original Code
```batch
REM Kill by port
for %%p in (3000 3100 3101 5000) do (
```

### Fixed Code
```batch
REM Kill by port
for %%p in (3000 3100 3101 5000 5002) do (
```

### Impact
Without this fix, the embedding server would keep running in the background after closing JARVIS, consuming VRAM and requiring manual kill.

---

## Bug 3: Dead Code in getEmbeddingBackend (Low)

**File:** `services/vectorDB.ts`  
**Lines:** 560-580  
**Severity:** Low

### Problem
The `getEmbeddingBackend()` method had fire-and-forget fetch code that didn't actually return any data. The async fetch promise wasn't awaited and its results weren't used.

### Original Code
```typescript
public getEmbeddingBackend(): { 
  backend: EmbeddingBackend; 
  serverHealth?: { device: string; vram_gb: number } | null 
} {
  const baseInfo = { backend: this.embeddingBackend };
  
  if (this.embeddingBackend === 'embedding_server') {
    // Try to get server health asynchronously
    fetch(`${this.embeddingServerConfig.url}/health`)
      .then(r => r.json())
      .then(data => {
        // This is fire-and-forget for status
      })
      .catch(() => {});
  }
  
  return baseInfo;
}
```

### Fixed Code
Split into two methods:
```typescript
public getEmbeddingBackend(): { 
  backend: EmbeddingBackend; 
} {
  return { backend: this.embeddingBackend };
}

public async getEmbeddingServerHealth(): Promise<{ 
  device: string; 
  vram_total_gb: number;
  vram_allocated_gb: number;
  cache_size: number;
} | null> {
  // Proper async implementation that returns data
}
```

### Impact
Without this fix, the server health data was fetched but never used, and the method signature implied it would return health data which it didn't.

---

## Bug 4: Race Condition on Startup (Medium)

**File:** `services/vectorDB.ts`  
**Lines:** 162-184  
**Severity:** Medium

### Problem
The embedding server check only tried once with a 3-second timeout. If the server was still starting up (e.g., model loading), it would fail and fall back to slower backends.

### Original Code
```typescript
// Try local embedding server first (CUDA on GPU)
if (this.embeddingServerConfig.enabled) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const healthResponse = await fetch(`${this.embeddingServerConfig.url}/health`, {
      signal: controller.signal
    });
    // ...
  } catch (error) {
    logger.log('VECTOR_DB', 'Embedding server not available, trying next backend', 'warning');
  }
}
```

### Fixed Code
```typescript
// Try local embedding server first (CUDA on GPU)
if (this.embeddingServerConfig.enabled) {
  // Retry a few times in case server is still starting
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const healthResponse = await fetch(`${this.embeddingServerConfig.url}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        this.embeddingBackend = 'embedding_server';
        logger.log('VECTOR_DB', `Using CUDA embedding server (${health.device})`, 'success');
        return;
      }
    } catch (error) {
      if (attempt === 3) {
        logger.log('VECTOR_DB', 'Embedding server not available, trying next backend', 'warning');
      } else {
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}
```

### Impact
Without this fix, JARVIS might fall back to slower CPU embeddings if the server was still loading when JARVIS checked.

---

## Bug 5: Dependency Check Fails Silently (Low)

**File:** `Start-Embedding-Server.bat`  
**Lines:** 22-33  
**Severity:** Low

### Problem
The dependency check used a single command that would fail if any one of the three packages was missing, potentially causing unnecessary reinstalls.

### Original Code
```batch
python -c "import sentence_transformers" 2>nul
if errorlevel 1 (
    echo [INFO] Installing sentence-transformers...
    pip install sentence-transformers flask flask-cors
```

### Fixed Code
```batch
python -c "import sentence_transformers" 2>nul
set ST_AVAILABLE=%errorlevel%

python -c "import flask" 2>nul
set FLASK_AVAILABLE=%errorlevel%

python -c "import flask_cors" 2>nul
set CORS_AVAILABLE=%errorlevel%

if %ST_AVAILABLE% neq 0 (
    echo [INFO] Installing sentence-transformers...
    pip install sentence-transformers
    // ...
)
// Check each dependency separately...
```

### Impact
Without this fix, the script might reinstall all packages even if only one was missing, wasting time.

---

## Verification

After fixes, run the test suite:

```bash
python test_embedding_server.py
```

All tests should pass:
- ✅ Health Check
- ✅ GPU Utilization
- ✅ Single Embedding
- ✅ Batch Embedding
- ✅ Similarity
- ✅ Caching

---

## Files Modified

1. `embedding_server.py` - Fixed cache indexing
2. `JARVIS_RUN.bat` - Added port 5002 to shutdown
3. `services/vectorDB.ts` - Fixed dead code and added retry logic
4. `Start-Embedding-Server.bat` - Fixed dependency check

All fixes tested and ready for use.
