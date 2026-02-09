# Bug Fixes for v1.5.1 Implementation

## Summary

Found and fixed **4 bugs** in the CUDA Embedding Server and GPU Monitor implementation.

---

## Bug 1: Missing Port 5003 in Shutdown (Critical)

**File:** `JARVIS_RUN.bat`  
**Line:** 92  
**Severity:** High

### Problem
Port 5003 (GPU Monitor) was added to the startup/cleanup section (line 14) but missing from the shutdown section (line 92). This means the GPU Monitor process would keep running after closing JARVIS, leaking processes and consuming VRAM.

### Fix
```batch
# Before:
for %%p in (3000 3100 3101 5000 5002) do (

# After:
for %%p in (3000 3100 3101 5000 5002 5003) do (
```

---

## Bug 2: Unicode Box Characters in Start-GPU-Monitor.bat

**File:** `Start-GPU-Monitor.bat`  
**Lines:** 6-8  
**Severity:** Medium

### Problem
The batch file used Unicode box drawing characters (╔ ═ ╗ ║ ╚ ╝) which can cause encoding errors on Windows systems that don't support UTF-8 in batch files.

### Fix
```batch
# Before:
echo ╔══════════════════════════════════════════════════════════╗
echo ║              JARVIS GPU Monitor Server                   ║
echo ╚══════════════════════════════════════════════════════════╝

# After:
echo +============================================================+
echo ^|              JARVIS GPU Monitor Server                     ^|
echo +============================================================+
```

---

## Bug 3: Unicode Box Characters in Start-Embedding-Server.bat

**File:** `Start-Embedding-Server.bat`  
**Lines:** 6-8  
**Severity:** Medium

### Problem
Same as Bug 2 - Unicode box drawing characters can cause encoding errors.

### Fix
```batch
# Before:
echo ╔══════════════════════════════════════════════════════════╗
echo ║           JARVIS CUDA Embedding Server                   ║
echo ╚══════════════════════════════════════════════════════════╝

# After:
echo +============================================================+
echo ^|            JARVIS CUDA Embedding Server                    ^|
echo +============================================================+
```

---

## Bug 4: Unicode Emoji in test_embedding_server.py

**File:** `test_embedding_server.py`  
**Multiple lines**  
**Severity:** Low

### Problem
The test script used Unicode emoji characters (✅ ❌ ⚠️ 📊 🎮 💽 🚀 ⏱️ ⚡ 📈) which may not display correctly on all terminals and could cause encoding issues.

### Fix
Replaced all emoji with ASCII equivalents:
- ✅ → [OK]
- ❌ → [FAIL]
- ⚠️ → [WARN]
- 📊 → [STAT]
- 🎮 → [GPU]
- 💽 → [VRAM]
- 🚀 → [SPEED]
- ⏱️ → [TIME]
- ⚡ → [FAST]
- 📈 → [CHART]

---

## Previously Fixed (from earlier)

These were fixed in a previous commit:

### Bug 5: Cache Indexing Error (embedding_server.py)
- Wrong embeddings being cached due to incorrect array indexing
- Fixed by using enumerate properly

### Bug 6: Race Condition on Startup (vectorDB.ts)
- Only tried connecting to embedding server once
- Added 3 retry attempts with 1-second delays

### Bug 7: Dead Code (vectorDB.ts)
- getEmbeddingBackend() had unused async fetch
- Split into two proper methods

### Bug 8: Dependency Check (Start-Embedding-Server.bat)
- Would reinstall all packages if any one was missing
- Now checks each package individually

---

## Verification

After fixes, verify by running:

```bash
# Test embedding server
python test_embedding_server.py

# Test GPU monitor
python gpu_monitor.py

# Full integration test
JARVIS_RUN.bat
```

All tests should pass without encoding errors.
