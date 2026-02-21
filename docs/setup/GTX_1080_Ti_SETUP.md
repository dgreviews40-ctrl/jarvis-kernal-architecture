# JARVIS Image Generation - GTX 1080 Ti (11GB VRAM) Setup

## Your GPU: GTX 1080 Ti (11GB VRAM)

The GTX 1080 Ti is a powerful card but lacks tensor cores (unlike RTX series). With 11GB VRAM, you can run high-quality image generation locally!

---

## ✅ What Fits in 11GB VRAM

### Download These Models (They Work!)

| Model | Size | VRAM Used | Time/Image | Quality |
|-------|------|-----------|------------|---------|
| **SD 3.5 Medium** ⭐ | 7GB | ~9-10GB | 25-35s | ⭐⭐⭐⭐⭐ Excellent |
| **RealVisXL V5.0** | 7GB | ~9-10GB | 25-35s | ⭐⭐⭐⭐⭐ Photorealistic |
| **Juggernaut XL v9** | 7GB | ~9-10GB | 25-35s | ⭐⭐⭐⭐⭐ All-purpose |
| **SDXL Base 1.0** | 7GB | ~9-10GB | 20-30s | ⭐⭐⭐⭐ Very Good |
| **SD 1.5** | 4GB | ~6GB | 5-8s | ⭐⭐⭐ Good |

### Don't Download (Won't Fit)

- **FLUX.1 [dev]** - 23GB (needs 24GB VRAM)
- **FLUX.1 [schnell]** - 34GB (needs 40GB VRAM)
- **SD 3.5 Large** - 16GB (needs 16GB+ VRAM)

---

## 🚀 Quick Setup

### Step 1: Download ComfyUI

```powershell
# Download from: https://github.com/comfyanonymous/ComfyUI/releases
# Extract to: C:\ComfyUI
```

### Step 2: Download ONE Recommended Model

**Best Choice: SD 3.5 Medium**
- Link: https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
- File: `sd3.5_medium.safetensors` (~7GB)
- Place in: `C:\ComfyUI\models\checkpoints\`

**Alternative: RealVisXL (for portraits)**
- Link: https://civitai.com/models/139562/realvisxl-v50
- File: `realvisxlV50_v50Bakedvae.safetensors` (~7GB)

### Step 3: Configure for 11GB VRAM

**Edit `C:\ComfyUI\run_nvidia_gpu.bat`:**
```batch
@echo off
..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention
pause
```

### Step 4: Start & Test

1. Double-click `run_nvidia_gpu.bat`
2. Wait for: "To see the GUI go to: http://127.0.0.1:8188"
3. Test with JARVIS:
   ```
   You: "Generate an image of a workshop"
   ```

---

## ⚙️ Optimized Settings for GTX 1080 Ti

### Resolution
- **1024x1024** - Maximum for 11GB (SDXL/SD 3.5)
- **768x768** - Faster, still great quality
- **512x512** - Fastest (SD 1.5)

### Steps
- **20 steps** - Good quality, faster
- **30 steps** - Better quality, slower
- Don't go above 50 - diminishing returns

### Sampler
- **DPM++ 2M Karras** - Good balance
- **Euler a** - Fastest option

---

## 🐛 Troubleshooting

### "CUDA Out of Memory"

**Fix:** Lower resolution or use `--lowvram` flag
```batch
python main.py --lowvram
```

### Black Images

**Fix:** Add `--no-half-vae` to launch args

### Slow Generation (1+ minute)

**Normal for GTX 1080 Ti** (no tensor cores). Tips:
- Use SD 1.5 instead of SDXL (3x faster)
- Reduce to 20 steps
- Use Euler a sampler

### System Freezes

**Fix:** Increase Windows TDR timeout:
```powershell
# Run as Administrator
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrDelay /t REG_DWORD /d 60 /f
```

---

## 📊 Expected Performance

| Model | Resolution | Steps | Time | VRAM |
|-------|------------|-------|------|------|
| SD 1.5 | 512x512 | 20 | ~6 sec | ~6GB |
| SDXL | 1024x1024 | 20 | ~25 sec | ~9GB |
| SD 3.5 Medium | 1024x1024 | 20 | ~30 sec | ~9GB |
| SD 3.5 Medium | 1024x1024 | 30 | ~45 sec | ~10GB |

---

## 🎨 Best Models by Use Case

| Task | Best Model | Why |
|------|------------|-----|
| Workshop/Garage | SD 3.5 Medium | Great spatial understanding |
| Portraits | RealVisXL V5.0 | Hyper-realistic faces |
| General photos | Juggernaut XL | Works for everything |
| Quick drafts | SD 1.5 | Fastest generation |
| Technical diagrams | SDXL + ControlNet | Precise structure |

---

## 🔄 ENVISION Feature with 11GB VRAM

The ENVISION feature works great on 11GB!

```
You: "Jarvis, envision this garage as a woodworking shop"
JARVIS: 
1. Captures camera image
2. Generates layout diagram using SD 3.5 Medium
3. Shows technical floor plan in ~30 seconds
```

**Optimized workflow:**
- Uses 1024x768 resolution (safer for 11GB)
- 20 steps for speed
- SVG fallback if ComfyUI not running

---

## 📝 Summary

Your GTX 1080 Ti with 11GB VRAM can run:
- ✅ SD 3.5 Medium (7GB) - BEST choice
- ✅ SDXL (7GB) - Good alternative  
- ✅ SD 1.5 (4GB) - Fastest option
- ❌ FLUX.1 (23GB+) - Won't fit
- ❌ SD 3.5 Large (16GB) - Won't fit

**Recommended:** Download **SD 3.5 Medium**, set `--normalvram` flag, generate at 1024x1024.

No cloud APIs needed. Everything runs locally on your 1080 Ti!
