# Local Image Generation - GTX 1080 Ti (11GB VRAM) Setup

## ✅ What's Been Done

JARVIS is now wired for **purely local image generation** with 11GB VRAM optimization.

---

## 🎯 Your GTX 1080 Ti (11GB VRAM) - Compatible Models

### ✅ DOWNLOAD THESE (They Fit!)

| Model | Size | VRAM Used | Quality | Best For |
|-------|------|-----------|---------|----------|
| **SD 3.5 Medium** ⭐ | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ Excellent | Everything |
| **RealVisXL V5.0** | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ Photorealistic | Portraits |
| **Juggernaut XL v9** | 7GB | ~9-10GB | ⭐⭐⭐⭐⭐ All-purpose | General use |
| **SDXL Base 1.0** | 7GB | ~9-10GB | ⭐⭐⭐⭐ Very Good | Reliable |
| **SD 1.5** | 4GB | ~6GB | ⭐⭐⭐ Good | Speed |

### ❌ DON'T DOWNLOAD (Won't Fit!)

| Model | Size | Why |
|-------|------|-----|
| **FLUX.1 [dev]** | 23GB | Needs 24GB+ VRAM |
| **FLUX.1 [schnell]** | 34GB | Needs 40GB+ VRAM |
| **SD 3.5 Large** | 16GB | Needs 16GB+ VRAM |

---

## 🚀 Quick Setup (ComfyUI)

### Step 1: Download

1. **ComfyUI Portable**: https://github.com/comfyanonymous/ComfyUI/releases
2. **Extract** to `C:\ComfyUI`

### Step 2: Download ONE Model (Start Here)

**For best quality on 11GB:**
- **SD 3.5 Medium**: https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
- Download the `.safetensors` file
- Place in: `C:\ComfyUI\models\checkpoints\`

### Step 3: Configure for 11GB VRAM

**Edit `C:\ComfyUI\run_nvidia_gpu.bat`:**
```batch
@echo off
..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention
pause
```

### Step 4: Start & Test

1. Run `run_nvidia_gpu.bat`
2. Wait for "To see the GUI go to: http://127.0.0.1:8188"
3. Test with JARVIS: "Generate an image of a workshop"

---

## ⚙️ Performance Expectations (GTX 1080 Ti)

| Model | Resolution | Time | Quality |
|-------|------------|------|---------|
| SD 1.5 | 512x512 | 5-8 sec | Good |
| SDXL | 1024x1024 | 20-30 sec | Very Good |
| SD 3.5 Medium | 1024x1024 | 25-35 sec | Excellent |

**Note:** 1080 Ti has no tensor cores (unlike RTX), so it's 2-3x slower than RTX 3060.

---

## 🧪 Testing Your Setup

### Test 1: Basic Image Generation
```
You: "Generate an image of a futuristic workshop"
Expected: JARVIS detects ComfyUI, generates image in 20-30 seconds
```

### Test 2: ENVISION Feature
```
You: "Jarvis, envision this garage as a woodworking shop"
Expected: Captures camera + generates layout diagram
```

### Test 3: Check Logs
Look for:
```
[IMAGE_GENERATOR] ComfyUI detected at http://127.0.0.1:8188
[IMAGE_GENERATOR] SD 3.5 Medium model available
[IMAGE_GENERATOR] Image generated in 28473ms
```

---

## 🐛 Troubleshooting 11GB Issues

### "CUDA Out of Memory"

**Fix:**
```batch
# Use lower VRAM mode
python main.py --lowvram

# Or reduce resolution in ComfyUI to 768x768
```

### Black Images

**Fix:** Add `--no-half-vae` to launch args

### System Freezes During Generation

**Fix:** Increase Windows TDR timeout:
```powershell
# Run as Administrator
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrDelay /t REG_DWORD /d 60 /f
```

### Slow Generation (Over 1 Minute)

**Normal for 1080 Ti on large models.** Solutions:
- Use SD 1.5 instead (3x faster)
- Reduce steps to 20
- Use Euler a sampler

---

## 📁 Files Updated

| File | What Changed |
|------|-------------|
| `services/localImageGenerator.ts` | New 11GB-optimized local image service |
| `services/imageGenerator.ts` | Uses local generator, no OpenAI |
| `docs/LOCAL_IMAGE_GENERATION.md` | Full 11GB VRAM guide |
| `.env.local` | Removed OpenAI requirement |
| `AGENTS.md` | Updated documentation |

---

## 💡 Pro Tips for 11GB VRAM

1. **Close browser tabs** before generating - Chrome eats VRAM
2. **Generate at 1024x1024 max** - Higher will OOM
3. **SD 3.5 Medium** gives best quality per GB of VRAM
4. **Use batch size = 1** always
5. **Enable xformers** in A1111 if you use it

---

## 🎨 Model Recommendations by Task

| Task | Best Model | Why |
|------|------------|-----|
| Workshop photos | SD 3.5 Medium | Great spatial understanding |
| Portraits | RealVisXL V5.0 | Hyper-realistic faces |
| Technical diagrams | SDXL + ControlNet | Precise structure |
| Quick drafts | SD 1.5 | Fast iteration |

---

## ⚡ Next Steps

1. **Download ComfyUI Portable**
2. **Download SD 3.5 Medium** (one 7GB file)
3. **Edit run_nvidia_gpu.bat** with 11GB args
4. **Start ComfyUI**
5. **Test with JARVIS**

**No API keys. No cloud. Completely private. Works on your 1080 Ti!**
