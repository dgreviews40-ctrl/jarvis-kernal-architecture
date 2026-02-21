# JARVIS ComfyUI Setup for GTX 1080 Ti (11GB VRAM)

This folder contains automated setup scripts for ComfyUI, configured specifically for your GTX 1080 Ti with 11GB VRAM.

## Quick Start (Automated)

### Option 1: Run the Installer

1. **Double-click `INSTALL.bat`**
2. Wait for downloads to complete (15-30 minutes depending on internet speed)
3. A desktop shortcut "ComfyUI (11GB VRAM)" will be created
4. **Double-click the desktop shortcut** to start ComfyUI
5. Wait for "To see the GUI go to: http://127.0.0.1:8188"
6. Start JARVIS and test: "Generate an image of a workshop"

### What Gets Installed

- **ComfyUI Portable** - AI image generation software (~2GB)
- **SD 3.5 Medium** - AI model optimized for 11GB VRAM (~7GB)
- **Optimized launcher** - Configured with flags for 11GB VRAM
- **Desktop shortcut** - Easy one-click start

## Manual Setup (If Automated Fails)

If the automated installer fails, follow these steps:

### Step 1: Download ComfyUI

1. Go to: https://github.com/comfyanonymous/ComfyUI/releases
2. Download: `ComfyUI_windows_portable_nvidia.7z`
3. Extract to: `C:\ComfyUI`

### Step 2: Download AI Model

Download ONE of these models (all fit in 11GB VRAM):

**Recommended: SD 3.5 Medium (BEST for 11GB)**
- Download: https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors
- Size: ~7GB
- Place in: `C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\`

**Alternative: RealVisXL (Best for portraits)**
- Download: https://civitai.com/models/139562/realvisxl-v50
- Size: ~7GB
- Place in: Same folder as above

### Step 3: Configure for 11GB VRAM

Create file: `C:\ComfyUI\ComfyUI_windows_portable\run_nvidia_gpu_11gb.bat`

Paste this content:
```batch
@echo off
cd /d "%~dp0"
..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention
pause
```

### Step 4: Start ComfyUI

Double-click `run_nvidia_gpu_11gb.bat`

Wait for: "To see the GUI go to: http://127.0.0.1:8188"

## Testing with JARVIS

Once ComfyUI is running:

1. Start JARVIS
2. Try these commands:
   - `"Generate an image of a futuristic workshop"`
   - `"Create a diagram of a woodworking shop layout"`
   - `"Envision this garage as a workspace"` (uses camera + AI)

## Troubleshooting

### "7-Zip not found"
Install 7-Zip from https://www.7-zip.org/ then re-run the installer.

### "Download failed"
Your internet connection may be unstable. Try the manual setup instead.

### "CUDA Out of Memory"
- Close browser tabs before generating images
- Make sure you're using `run_nvidia_gpu_11gb.bat` (not the default one)
- Reduce resolution in ComfyUI to 768x768

### "Black images"
Add `--no-half-vae` to the launch arguments in the batch file.

### Slow generation (1+ minutes)
This is normal for GTX 1080 Ti:
- No tensor cores (unlike RTX series)
- SD 3.5 Medium @ 1024x1024 takes ~25-35 seconds
- Use SD 1.5 for faster generation (~5-8 seconds)

## System Requirements

- **GPU:** GTX 1080 Ti (11GB VRAM) or similar
- **RAM:** 16GB recommended
- **Storage:** 15GB free space
- **OS:** Windows 10/11
- **Software:** 7-Zip (for extraction)

## File Structure After Install

```
C:\ComfyUI\
└── ComfyUI_windows_portable\
    ├── run_nvidia_gpu.bat          (original)
    ├── run_nvidia_gpu_11gb.bat     (optimized for you)
    ├── python_embeded\             (Python runtime)
    └── ComfyUI\
        ├── main.py                  (main application)
        └── models\
            └── checkpoints\
                └── sd3.5_medium.safetensors   (AI model)
```

## Support

- Full documentation: `docs/LOCAL_IMAGE_GENERATION.md`
- 11GB specific guide: `GTX_1080_Ti_SETUP.md`
- JARVIS docs: `AGENTS.md` (Local Image Generation section)

## What Works with 11GB VRAM

✅ **Models that fit:**
- SD 3.5 Medium (7GB) - BEST choice
- RealVisXL (7GB) - Great portraits
- SDXL Base (7GB) - Good all-rounder
- SD 1.5 (4GB) - Fastest option

❌ **Models that DON'T fit:**
- FLUX.1 (23GB+) - Requires 24GB VRAM
- SD 3.5 Large (16GB) - Requires 16GB VRAM

## Performance Expectations

| Model | Resolution | Time (GTX 1080 Ti) |
|-------|------------|-------------------|
| SD 1.5 | 512x512 | ~6 seconds |
| SDXL | 1024x1024 | ~25 seconds |
| SD 3.5 Medium | 1024x1024 | ~30 seconds |

**Note:** 1080 Ti has no tensor cores, so it's slower than RTX cards.

---

**Ready to generate AI images locally with your GTX 1080 Ti!**
