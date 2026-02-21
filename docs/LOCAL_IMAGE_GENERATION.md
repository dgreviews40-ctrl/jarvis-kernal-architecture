# Local Image Generation Setup Guide (11GB VRAM Optimized)

**JARVIS supports purely local image generation - NO cloud APIs required.**

This guide is optimized for **GTX 1080 Ti (11GB VRAM)** and similar cards.

---

## ⚠️ GTX 1080 Ti (11GB VRAM) - What Works

### ✅ Models That Fit (Recommended)

| Model | Size | VRAM Used | Quality | Speed |
|-------|------|-----------|---------|-------|
| **SD 1.5** | 4GB | ~6GB | ⭐⭐⭐ Good | Fast |
| **SDXL Base** | 7GB | ~9-10GB | ⭐⭐⭐⭐ Very Good | Medium |
| **SD 3.5 Medium** | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ Excellent | Medium |
| **RealVisXL** | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ Photorealistic | Medium |
| **Juggernaut XL** | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ All-purpose | Medium |

### ❌ Models That DON'T Fit (11GB Limit)

| Model | Size | Why It Fails |
|-------|------|--------------|
| **FLUX.1 [dev]** | 23GB | Way too big |
| **FLUX.1 [schnell]** | 34GB | Way too big |
| **SD 3.5 Large** | 16GB | Needs 16GB+ VRAM |
| **SD 3.5 Large Turbo** | 16GB | Needs 16GB+ VRAM |

### ⚡ Quantized Options (Advanced)

For adventurous users with 11GB cards:
- **FLUX GGUF (Q4)** - ~12GB, might work with extreme optimization
- **SD 3.5 fp8** - Reduced precision, may fit in 11GB

**Not recommended for beginners** - stick to the ✅ list above.

---

## Option 1: ComfyUI (Recommended)

### Step 1: Install ComfyUI

1. Download ComfyUI portable from: https://github.com/comfyanonymous/ComfyUI/releases
2. Extract to `C:\ComfyUI`
3. **IMPORTANT for 11GB VRAM:** Edit `run_nvidia_gpu.bat`:
   ```batch
   python main.py --normalvram --fp16-vae --dont-upcast-attention
   ```

### Step 2: Download Models (11GB VRAM Compatible)

Place in `ComfyUI\models\checkpoints\`:

**BEST for 11GB VRAM:**

1. **SD 3.5 Medium** (Top Pick)
   - Download: https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
   - Size: ~7GB
   - Quality: Excellent photorealism
   - VRAM: Fits comfortably in 11GB

2. **RealVisXL V5.0** (Best for portraits)
   - Download: https://civitai.com/models/139562/realvisxl-v50
   - Size: ~7GB
   - Quality: Hyper-realistic portraits
   - VRAM: ~9GB at 1024x1024

3. **Juggernaut XL v9** (Best all-rounder)
   - Download: https://civitai.com/models/133005/juggernaut-xl
   - Size: ~7GB
   - Quality: Great for everything
   - VRAM: ~9GB at 1024x1024

4. **SDXL Base 1.0** (Reliable fallback)
   - Download: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
   - Size: ~7GB
   - Quality: Very good
   - VRAM: ~9GB at 1024x1024

5. **SD 1.5** (Fastest option)
   - Download: https://huggingface.co/runwayml/stable-diffusion-v1-5
   - Size: ~4GB
   - Quality: Good
   - VRAM: ~6GB (leaves lots of headroom)

### Step 3: Optimize for 11GB VRAM

Create `C:\ComfyUI\run_11gb_vram.bat`:
```batch
@echo off
set PYTHON="C:\ComfyUI\python\python.exe"
set CUDA_VISIBLE_DEVICES=0
%PYTHON% main.py ^
  --normalvram ^
  --fp16-vae ^
  --fp8_e4m3fn-text-enc ^
  --dont-upcast-attention ^
  --preview-method auto
```

**Launch Arguments Explained:**
- `--normalvram` - Optimized for 8-12GB cards
- `--fp16-vae` - Use half precision VAE (saves VRAM)
- `--fp8_e4m3fn-text-enc` - 8-bit text encoder (saves ~1GB)
- `--dont-upcast-attention` - Saves VRAM on attention layers

### Step 4: ComfyUI Workflow for 11GB

For SDXL/SD 3.5 on 11GB, use these settings:
- **Resolution:** 1024x1024 (max for 11GB)
- **Steps:** 20-30
- **Sampler:** DPM++ 2M Karras or Euler a
- **CFG Scale:** 7-8
- **Batch Size:** 1 (don't try to generate multiple at once)

---

## Option 2: AUTOMATIC1111 (Easier)

### Step 1: Install

Download from: https://github.com/AUTOMATIC1111/stable-diffusion-webui

### Step 2: Configure for 11GB VRAM

Edit `webui-user.bat`:
```batch
set COMMANDLINE_ARGS=--xformers --medvram --opt-split-attention --no-half-vae
```

**Arguments for 11GB:**
- `--xformers` - Memory efficient attention (install first: `pip install xformers`)
- `--medvram` - Medium VRAM mode (for 8-12GB)
- `--opt-split-attention` - Split attention across layers
- `--no-half-vae` - Prevents black images with SDXL

### Step 3: Download Models

Same models as ComfyUI section above.

Place in `models\Stable-diffusion\`.

### Step 4: Run with API

```batch
webui-user.bat --api
```

---

## Performance Expectations (GTX 1080 Ti)

| Model | Resolution | Steps | Time per Image |
|-------|------------|-------|----------------|
| SD 1.5 | 512x512 | 20 | ~5-8 seconds |
| SD 1.5 | 768x768 | 25 | ~10-15 seconds |
| SDXL | 1024x1024 | 20 | ~20-30 seconds |
| SDXL | 1024x1024 | 30 | ~30-45 seconds |
| SD 3.5 Medium | 1024x1024 | 20 | ~25-35 seconds |
| SD 3.5 Medium | 1024x1024 | 30 | ~40-55 seconds |

**Note:** GTX 1080 Ti has no tensor cores (unlike RTX cards), so it's slower than RTX series for the same generation.

---

## Troubleshooting 11GB VRAM Issues

### "CUDA Out of Memory" Error

**Solutions:**
1. **Restart ComfyUI/A1111** - VRAM can get stuck allocated
2. **Reduce resolution** - Try 768x768 instead of 1024x1024
3. **Close browser tabs** - Each tab uses GPU memory
4. **Use --lowvram flag** (slower but works):
   ```batch
   python main.py --lowvram
   ```

### Black Images (SDXL)

**Fix:** Add to launch args:
```batch
--no-half-vae
```

### Slow Generation

**Normal for GTX 1080 Ti.** Ways to speed up:
1. Use SD 1.5 instead of SDXL (2-3x faster)
2. Reduce steps to 20
3. Use Euler a sampler (fastest)
4. Generate at 768x768 then upscale

### System Freezes

**Causes:** Windows TDR timeout

**Fix:** Increase TDR delay in registry:
```powershell
# Run as Administrator
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrDelay /t REG_DWORD /d 60 /f
```

---

## Model Recommendations by Use Case

### Best for Workshop/Garage Photos
**SD 3.5 Medium** - Understands spatial relationships well

### Best for Portraits
**RealVisXL V5.0** - Extremely realistic faces

### Best for Technical Diagrams
**SDXL Base + ControlNet** (install ControlNet extension)

### Best for Speed
**SD 1.5** - Fastest generation, good quality

---

## Quick Start Checklist

- [ ] Download ComfyUI portable
- [ ] Download **SD 3.5 Medium** or **RealVisXL**
- [ ] Place model in `ComfyUI\models\checkpoints\`
- [ ] Edit `run_nvidia_gpu.bat` with 11GB args
- [ ] Run ComfyUI
- [ ] Test with JARVIS: "Generate an image of a workshop"

---

## Summary for GTX 1080 Ti Owners

✅ **What Works Great:**
- SD 1.5 (4GB) - Fast, good quality
- SDXL (7GB) - Very good quality, slower
- SD 3.5 Medium (7GB) - Excellent quality

❌ **Don't Even Try:**
- FLUX models (23GB+) - Won't fit
- SD 3.5 Large (16GB) - Won't fit

⚡ **Pro Tips:**
- Use `--normalvram` flag always
- Generate at 1024x1024 max
- SD 3.5 Medium gives best quality for VRAM used
- SD 1.5 is fastest for quick iterations
