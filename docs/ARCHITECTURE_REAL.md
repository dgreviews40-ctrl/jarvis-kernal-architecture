# JARVIS Kernel Architecture - Actual Implementation

> **Version:** v1.5.0  
> **Last Updated:** 2025-02-07  
> **Hardware Target:** GTX 1080 Ti 11GB, 32GB RAM, Ryzen 5 5500X

---

## Overview

JARVIS is a **hybrid AI assistant** that combines:
- **Browser-based UI** (React/TypeScript) for the interface
- **Local AI services** (Ollama, Whisper, Piper) running on your GPU/CPU
- **Cloud AI fallback** (Google Gemini) when local models aren't available

The browser doesn't run AI models directly - it orchestrates local services that do.

---

## Real Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (React App) - The Control Panel                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Chat UI     │  │  Dashboard   │  │  Settings                │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                         │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Kernel Services (TypeScript)                               │   │
│  │  • providers.ts - Routes to Ollama/Gemini                   │   │
│  │  • whisperSTT.ts - Talks to Whisper server                  │   │
│  │  • piperTTS.ts - Talks to Piper server                      │   │
│  │  • vectorDB.ts - Local embeddings + HNSW search             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTP/WebSocket
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LOCAL AI SERVICES (Your Hardware)                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  OLLAMA (Port 11434)                                        │   │
│  │  • Uses your GTX 1080 Ti via CUDA                           │   │
│  │  • Loads models into VRAM (up to ~10GB)                     │   │
│  │  • Currently supported: llama3, mistral, codellama, etc.    │   │
│  │  • Max model size: ~13B parameters (Q4 = ~8GB VRAM)         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  WHISPER STT SERVER (Port 5001) - Python                    │   │
│  │  • PyTorch with CUDA support                                │   │
│  │  • Model: "small" (466MB)                                   │   │
│  │  • Runs on your 1080 Ti when available                      │   │
│  │  • Fallback to CPU (Ryzen 5)                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PIPER TTS SERVER (Port 5000)                               │   │
│  │  • ONNX Runtime                                             │   │
│  │  • JARVIS voice model (~115MB)                              │   │
│  │  • Runs on CPU (fast enough)                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Ollama Integration (`services/providers.ts`)

**What it does:** Routes AI requests to your local Ollama instance

**Configuration:**
```typescript
const DEFAULT_OLLAMA_CONFIG = {
  url: "http://localhost:11434",  // Ollama runs here
  model: "llama3",                // Default model
  temperature: 0.7
};
```

**How it uses your hardware:**
- Ollama loads models into your **GTX 1080 Ti 11GB VRAM**
- Models are quantized (Q4) to fit in VRAM
- Inference happens entirely on GPU via CUDA

**Model Size Limits (Reality):**

| Model Size | Q4 Quantized | VRAM Needed | Fits 11GB? |
|------------|--------------|-------------|------------|
| 7B (llama3) | ~4 GB | ~5 GB | ✅ Yes |
| 8B (llama3.1) | ~5 GB | ~6 GB | ✅ Yes |
| 13B | ~8 GB | ~9 GB | ✅ Yes |
| 34B | ~20 GB | ~22 GB | ❌ No |
| 70B | ~40 GB | ~42 GB | ❌ No |

**Files:**
- `services/providers.ts` - OllamaProvider class
- `services/kernelProcessor.ts` - Routes to Ollama

---

### 2. Whisper STT (`services/whisperSTT.ts` + `whisper_server.py`)

**What it does:** Local speech-to-text using OpenAI Whisper

**Architecture:**
- Python Flask server (`whisper_server.py`)
- Browser sends audio chunks via HTTP POST
- Server transcribes using Whisper model

**Hardware Usage:**
```python
# whisper_server.py
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("small").to(DEVICE)

# If CUDA available, uses your 1080 Ti
# If not, uses CPU (Ryzen 5)
```

**Configuration:**
```typescript
// services/whisperSTT.ts
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:5001',
  model: 'small',      // Options: tiny, base, small, medium, large
  device: 'cuda',      // 'cuda' or 'cpu'
  chunkDuration: 2000, // ms
};
```

**Files:**
- `whisper_server.py` - Python server
- `services/whisperSTT.ts` - Browser client
- `Start-Whisper-Server.bat` - Launcher script

---

### 3. Piper TTS (`services/piperTTS.ts`)

**What it does:** Neural text-to-speech with JARVIS voice

**Architecture:**
- Piper HTTP server running locally
- Browser sends text, receives audio
- ONNX model runs inference

**Hardware Usage:**
- Runs on **CPU** (fast enough for TTS)
- JARVIS voice model: `jarvis.onnx` (~115MB)

**Configuration:**
```typescript
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:5000',
  defaultVoice: 'jarvis',
  lengthScale: 0.90,  // Speech speed
};
```

**Files:**
- `services/piperTTS.ts`
- `Piper/` directory with voice models
- `Install-JARVIS-Voice.bat` - Downloads voice

---

### 4. Vector Database (`services/vectorDB.ts`)

**What it does:** Semantic memory and document search

**Architecture:**
- **Embeddings:** Transformers.js (local) or API
- **Index:** HNSW (Hierarchical Navigable Small World) in memory
- **Storage:** IndexedDB (browser) for persistence

**Hardware Usage:**
- Embeddings generated on **CPU** (Transformers.js)
- HNSW search in **RAM** (32GB available)
- No GPU acceleration for embeddings (browser limitation)

**Configuration:**
```typescript
// constants/config.ts
VECTOR_DB: {
  EMBEDDING_DIMENSION: 384,  // all-MiniLM output size
  HNSW: {
    M: 16,                   // Connections per node
    efConstruction: 200,
    efSearch: 50
  }
}
```

**Backends (in order of preference):**
1. `transformers` - Transformers.js (local, CPU)
2. `api` - OpenAI-compatible API
3. `hash` - Simple hash fallback (no semantics)

**Files:**
- `services/vectorDB.ts` - Main implementation
- `services/localVectorDB.ts` - Compatibility layer
- `services/vectorMemoryService.ts` - Memory integration

---

### 5. Vision (`services/vision.ts` + `services/vision_ha_camera.ts`)

**What it does:** Image analysis using vision-capable models

**Architecture:**
- Captures webcam/screenshot
- Sends to Ollama vision model (e.g., llava)
- Returns description

**Hardware Usage:**
- Vision models run on your **1080 Ti via Ollama**
- Example: LLaVA models (~6-8GB VRAM)

**Files:**
- `services/vision.ts`
- `services/vision_ha_camera.ts`

---

## Hardware Utilization Summary

### What's Actually Using Your GTX 1080 Ti:

| Service | Port | VRAM Usage | CUDA? |
|---------|------|------------|-------|
| Ollama | 11434 | 4-9 GB (model dependent) | ✅ Yes |
| Whisper | 5001 | ~1 GB (when active) | ✅ Yes |
| **Total** | - | **5-10 GB** | - |

### What's Using Your Ryzen 5 5500X:

| Service | Usage |
|---------|-------|
| Piper TTS | ONNX inference |
| Vector DB | Embedding generation |
| Browser tabs | React/JavaScript |
| Python servers | Flask HTTP handling |

### What's Using Your 32GB RAM:

| Service | RAM Usage |
|---------|-----------|
| Ollama | Minimal (models in VRAM) |
| Vector DB HNSW | ~100MB - 1GB (depends on documents) |
| Whisper | ~500MB |
| Browser | 2-4 GB |
| **Available for caching** | **~25 GB** |

---

## Data Flow Examples

### Voice Command Flow

```
1. You: "Hey JARVIS, what's the weather?"
   ↓
2. Browser: Captures audio via Web Audio API
   ↓
3. whisperSTT.ts: Sends audio to localhost:5001
   ↓
4. whisper_server.py (on 1080 Ti): Transcribes → "what's the weather"
   ↓
5. kernelProcessor.ts: Routes text to Ollama
   ↓
6. providers.ts: POST to localhost:11434/api/generate
   ↓
7. Ollama (on 1080 Ti): Generates response → "It's 72°F and sunny"
   ↓
8. piperTTS.ts: Sends text to localhost:5000
   ↓
9. Piper (on CPU): Generates audio
   ↓
10. Browser: Plays audio response
```

### Document Search Flow

```
1. You: "Find my notes about neural networks"
   ↓
2. vectorDB.ts: Generates embedding (Transformers.js on CPU)
   ↓
3. HNSW index: Finds similar vectors (in RAM)
   ↓
4. Returns: Top 10 matching documents
   ↓
5. Optionally: Send to Ollama for summarization (on 1080 Ti)
```

---

## Configuration Files

### Environment Variables (`.env.local`)

```bash
# Required for cloud features
VITE_GEMINI_API_KEY=your_key_here

# Optional: Ollama URL (if not localhost)
# VITE_OLLAMA_URL=http://localhost:11434
```

### Local Storage Settings

JARVIS saves configuration to browser localStorage:

| Key | Description |
|-----|-------------|
| `jarvis_ollama_config` | Ollama URL, model, temperature |
| `jarvis_whisper_config` | Whisper model, device, chunk size |
| `jarvis_piper_config` | Piper URL, voice settings |
| `jarvis_api_key_encrypted` | Encrypted Gemini API key |

---

## Startup Sequence

When you run `npm run start`:

```
1. Hardware monitor starts (Node.js)
2. Home Assistant proxy starts (if configured)
3. Vite dev server starts (browser app)
4. User opens browser to localhost:5173
5. JARVIS checks for:
   - Ollama at :11434 (shows warning if missing)
   - Whisper at :5001 (optional)
   - Piper at :5000 (optional)
6. Initializes Vector DB (async)
7. Ready for commands
```

**Manual service startup:**
```bash
# Terminal 1: Start Whisper (if using voice)
python whisper_server.py

# Terminal 2: Start Piper (if using TTS)
piper --http-server --model jarvis.onnx

# Terminal 3: Start JARVIS
npm run dev
```

Or use the batch files:
- `JARVIS_RUN.bat` - Start everything
- `Start-Whisper-Server.bat` - Start Whisper only

---

## Limitations & Reality Checks

### What You CAN Run (11GB VRAM):

| Model | Use Case | Speed |
|-------|----------|-------|
| llama3.1:8b | General chat | ~20-30 tok/s |
| codellama:7b | Code | ~25 tok/s |
| mistral:7b | Reasoning | ~25 tok/s |
| llava:7b | Vision | ~15 tok/s |
| phi3:medium | Fast responses | ~40 tok/s |

### What You CANNOT Run (would need more VRAM):

- 70B models (need ~40GB VRAM)
- 34B models (need ~20GB VRAM)
- Multiple large models simultaneously
- Full-precision (FP16) models

### Browser Limitations:

- **No direct CUDA access** - Must go through external services
- **No vision model loading** - Must use Ollama
- **Embedding speed** - Transformers.js is slower than PyTorch CUDA
- **Storage** - IndexedDB limited to ~50% of available disk

---

## Troubleshooting

### Check if Ollama is using GPU:
```bash
ollama ps
# Shows loaded models and GPU usage

nvidia-smi
# Shows GPU memory usage
```

### Check if Whisper is using GPU:
```bash
# Look at whisper_server.py startup logs
CUDA available: True
CUDA device: NVIDIA GeForce GTX 1080 Ti
```

### Restart everything:
```bash
# Kill all services
taskkill /f /im python.exe
taskkill /f /im node.exe

# Restart
npm run start
```

---

## Related Documentation

- `docs/SERVICES_OVERVIEW.md` - All services list
- `docs/VOICE.md` - Voice system details
- `docs/TESTING.md` - Test suite
- `README.md` - Quick start guide

---

*This document describes the ACTUAL running system, not future plans.*
