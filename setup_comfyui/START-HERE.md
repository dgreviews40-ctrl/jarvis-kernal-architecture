# 🚀 GET STARTED - ComfyUI for JARVIS (GTX 1080 Ti)

## Choose Your Path:

### ⭐ OPTION 1: SIMPLE MODE (RECOMMENDED)
**Double-click: `INSTALL-Simple.bat`**

This guided installer will:
- Open download pages in your browser
- Guide you through extraction
- Set up optimized settings
- Create desktop shortcut

**Time:** 15-30 minutes (depending on internet)

**No 7-Zip required initially** - but you'll need it to extract files.

---

### 🔧 OPTION 2: MANUAL HELPER
**Double-click: `Manual-Download-Helper.bat`**

Interactive wizard that:
- Opens specific download links
- Shows exact folder paths
- Step-by-step guidance

---

### ✅ OPTION 3: VERIFY (After install)
**Double-click: `Verify-Installation.bat`**

Checks:
- ✓ ComfyUI is installed
- ✓ AI models are present
- ✓ GPU is detected
- ✓ Settings are correct

### 🚨 OPTION 4: FIX CUDA ERRORS
**Double-click: `QUICK-FIX-CUDA.bat`**

If you see errors like:
- `CUDA not available on this system`
- `cudaErrorNotSupported`
- `c10.dll error`

This will fix:
- Missing Visual C++ Redistributables (most common)
- Outdated NVIDIA drivers

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | GTX 1080 Ti (11GB) | GTX 1080 Ti (11GB) |
| RAM | 16GB | 32GB |
| Storage | 15GB free | 20GB free (SSD) |
| OS | Windows 10 | Windows 11 |
| Internet | For download | For download |

---

## What Gets Installed

**Location:** `C:\ComfyUI`

```
C:\ComfyUI\ComfyUI_windows_portable\
├── run_nvidia_gpu.bat              (original)
├── run_nvidia_gpu_11gb.bat         (YOUR optimized launcher)
├── python_embeded\                 (Python runtime)
└── ComfyUI\
    ├── main.py                     (main app)
    └── models\checkpoints\
        └── sd3.5_medium.safetensors (AI model - 7GB)
```

---

## After Installation

### 1. Start ComfyUI
Double-click desktop shortcut **"ComfyUI (11GB VRAM)"**

Or run:
```
C:\ComfyUI\ComfyUI_windows_portable\run_nvidia_gpu_11gb.bat
```

Wait for: `"To see the GUI go to: http://127.0.0.1:8188"`

### 2. Test with JARVIS
With ComfyUI running, start JARVIS and try:
- `"Generate an image of a workshop"`
- `"Create a floor plan diagram"`
- `"Envision this space"`

### 3. Expected Performance
| Model | Resolution | Time |
|-------|------------|------|
| SD 3.5 Medium | 1024x1024 | ~25-35 sec |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "7-Zip not found" | Install 7-Zip from www.7-zip.org |
| Download fails | Use Manual-Download-Helper.bat |
| Out of memory | Close browser tabs, use optimized launcher |
| Black images | Add `--no-half-vae` to launcher |
| Slow generation | Normal for 1080 Ti (no tensor cores) |

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `INSTALL.bat` | **MAIN INSTALLER** - Run this first |
| `Setup-ComfyUI-11GB.ps1` | PowerShell script (called by INSTALL.bat) |
| `Manual-Download-Helper.bat` | Manual download wizard |
| `Verify-Installation.bat` | Check if install is correct |
| `README.md` | Full documentation |
| `START-HERE.md` | This file |

---

## Quick Reference

**Models for 11GB VRAM:**
- ✅ SD 3.5 Medium (7GB) - **BEST**
- ✅ RealVisXL (7GB) - Portraits
- ✅ SDXL Base (7GB) - General
- ✅ SD 1.5 (4GB) - Fast
- ❌ FLUX.1 (23GB) - Won't fit
- ❌ SD 3.5 Large (16GB) - Won't fit

**Launch Flags for 11GB:**
```
--normalvram --fp16-vae --dont-upcast-attention
```

---

## Need Help?

1. Check `README.md` for detailed instructions
2. Check `GTX_1080_Ti_SETUP.md` in main folder
3. Check `docs/LOCAL_IMAGE_GENERATION.md` in main folder

---

**Ready? Double-click `INSTALL.bat` and let's get started!** 🎉
