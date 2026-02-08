# JARVIS Hardware Guide

> How to maximize performance on your specific hardware

---

## Your Setup: GTX 1080 Ti + 32GB RAM + Ryzen 5 5500X

This is a **great local AI setup**. Here's how to use it properly.

---

## GTX 1080 Ti 11GB - What It Can Actually Do

### VRAM Reality Check

You have **11GB VRAM**. Here's what fits:

| Model Size | Q4 Quantized | VRAM Used | Speed | Fits? |
|------------|--------------|-----------|-------|-------|
| 3B | ~2 GB | ~3 GB | 50+ tok/s | ✅ Easy |
| 7B | ~4 GB | ~5 GB | 30 tok/s | ✅ Yes |
| 8B | ~5 GB | ~6 GB | 25 tok/s | ✅ Yes |
| 13B | ~8 GB | ~9 GB | 18 tok/s | ✅ Yes |
| 34B | ~20 GB | ~22 GB | - | ❌ No |
| 70B | ~40 GB | ~42 GB | - | ❌ No |

**Q4 = 4-bit quantization** (reduces precision to save VRAM)

### Best Models for Your 1080 Ti

Pull these with Ollama:

```bash
# General chat (recommended)
ollama pull llama3.1:8b

# Coding
ollama pull codellama:13b

# Vision (can see images)
ollama pull llava:13b

# Fast responses
ollama pull phi3:medium

# Uncensored
ollama pull dolphin-mistral:7b
```

### Running Multiple Models

You CAN run multiple models if they fit:

```
llama3.1:8b (~6GB) + whisper (~1GB) = ~7GB used
Leaves ~4GB free for another small model
```

But you'll get **GPU memory errors** if you exceed 11GB.

---

## 32GB System RAM - How It's Used

### Current Usage

| Service | RAM Used |
|---------|----------|
| Ollama (models in VRAM, not RAM) | ~500MB |
| Whisper server | ~500MB |
| Piper TTS | ~200MB |
| Browser (JARVIS UI) | ~2-4GB |
| Vector DB (depends) | ~100MB - 2GB |
| **Total** | **~4-8 GB** |

### What's Left Over

**~24GB available** for:
- Large vector databases (RAG)
- Caching models in RAM (faster switching)
- Running other applications

### Optimizing RAM Usage

**For Vector DB (RAG):**
```typescript
// You can store millions of documents in 24GB RAM
// HNSW index is memory-efficient
```

**For Model Caching:**
```bash
# Ollama keeps models in VRAM
# But can unload to RAM if needed (slower)
```

---

## Ryzen 5 5500X - CPU Tasks

Your CPU handles:

| Task | Why CPU? |
|------|----------|
| **Piper TTS** | ONNX models, fast enough |
| **Vector Embeddings** | Transformers.js (no GPU support in browser) |
| **Whisper (fallback)** | If CUDA fails |
| **Ollama overhead** | HTTP handling, tokenization |

### CPU vs GPU for Different Tasks

| Task | Best Hardware | Current Implementation |
|------|---------------|------------------------|
| LLM inference | GPU ✅ | Ollama on CUDA |
| Speech recognition | GPU ✅ | Whisper on CUDA |
| Text-to-speech | CPU ✅ | Piper on CPU (fast enough) |
| Embeddings | GPU would be better | Transformers.js on CPU |
| Vector search | RAM speed | HNSW in RAM |

---

## Optimizing for Your Hardware

### 1. Maximize GPU Utilization

**Check current GPU usage:**
```bash
# Windows (in separate terminal)
nvidia-smi -l 1

# Shows:
# - GPU utilization %
# - VRAM usage
# - Temperature
# - Power draw
```

**Expected GPU usage:**
- Idle: 0% (models unloaded)
- Generating text: 80-100%
- Temperature: 70-80°C under load

### 2. Optimize Ollama for 11GB

Create `~/.ollama/config.json`:
```json
{
  "gpu": true,
  "gpu_layers": -1,  // Use all layers on GPU
  "num_thread": 6    // Match your Ryzen 5 cores
}
```

### 3. Optimize Whisper

In `whisper_server.py`:
```python
# You already have this, but verify:
MODEL_SIZE = "small"  # Don't use "large" - too slow
DEVICE = "cuda"       # Should auto-detect your 1080 Ti
```

### 4. Monitor System

Use JARVIS built-in monitoring:
```
Type in JARVIS: "show system diagnostics"
```

Or check manually:
```bash
# GPU
nvidia-smi

# CPU/RAM
wmic cpu get loadpercentage
wmic memorychip get capacity, speed

# Network
ping localhost
```

---

## Performance Expectations

### Realistic Speeds on Your Hardware

| Model | Quantization | Context | Speed |
|-------|--------------|---------|-------|
| llama3.1:8b | Q4_K_M | 4K | 25-30 tok/s |
| llama3.1:8b | Q4_K_M | 32K | 15-20 tok/s |
| codellama:13b | Q4_K_S | 16K | 18-22 tok/s |
| llava:7b | Q4 | 4K | 12-15 tok/s |
| phi3:medium | Q4 | 4K | 35-40 tok/s |

**Tokens/second = roughly words/second**

### What This Means

- **llama3.1:8b @ 25 tok/s**: 3-4 sentences per second
- **codellama:13b @ 20 tok/s**: Good for coding, slight delay
- **phi3:medium @ 40 tok/s**: Very responsive for simple tasks

---

## Common Issues & Fixes

### "CUDA out of memory"

**Cause:** Model too big for 11GB VRAM

**Fix:**
```bash
# Check what's loaded
ollama ps

# Kill Ollama
ollama stop <model>

# Use smaller model
ollama pull llama3.1:8b  # instead of 70b
```

### Slow embedding generation

**Cause:** Transformers.js runs on CPU

**Fix:** Nothing (browser limitation). But with 32GB RAM, you can:
- Pre-compute embeddings for documents
- Cache embeddings in IndexedDB
- Use larger batches

### Whisper not using GPU

**Check:**
```bash
python whisper_server.py
# Look for: "CUDA device: NVIDIA GeForce GTX 1080 Ti"
```

**If it says "CPU":**
```bash
# Reinstall PyTorch with CUDA
pip uninstall torch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

---

## Upgrade Path (If You Want More)

### Current Bottleneck: VRAM

Your **1080 Ti 11GB** is the limiting factor for model size.

**To run bigger models:**

| Upgrade | Cost | Gain |
|---------|------|------|
| RTX 3090 24GB | ~$800 used | 2x VRAM = 34B models |
| RTX 4090 24GB | ~$1600 | Same VRAM, faster |
| Dual GPU setup | Expensive | Split models across GPUs |

**To run 70B models:**
- Need ~40GB VRAM (A100, or multiple GPUs)
- OR use CPU offloading (very slow)

### Current Strength: RAM

Your **32GB RAM** is great for:
- Large vector databases
- Running multiple services
- Future-proofing

---

## Summary

Your setup is **excellent** for:
- ✅ Running 7B-13B models locally
- ✅ Real-time voice commands
- ✅ Code assistance
- ✅ Vision tasks (with llava)
- ✅ Large document databases (RAG)

You're **limited** by:
- ❌ Can't run 34B+ models
- ❌ One large model at a time
- ❌ Browser can't use GPU directly (needs Ollama bridge)

**Bottom line:** You have a solid local AI setup that outperforms most users. The 1080 Ti 11GB is still very capable for 8B-13B models.
