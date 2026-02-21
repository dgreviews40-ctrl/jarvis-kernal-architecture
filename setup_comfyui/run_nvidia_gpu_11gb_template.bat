@echo off
REM ComfyUI Launcher for 11GB VRAM (GTX 1080 Ti, RTX 3060, etc.)
REM This file is copied to C:\ComfyUI\ComfyUI_windows_portable\ during installation
REM Optimized flags to prevent OOM errors on 11GB cards

cd /d "%~dp0"

echo ==========================================
echo  ComfyUI - 11GB VRAM Optimized
echo ==========================================
echo.
echo Using optimization flags:
echo   --normalvram        : Optimized memory management for 8-12GB
echo   --fp16-vae          : Half precision VAE (saves ~1GB VRAM)
echo   --dont-upcast-attention : Saves attention layer memory
echo.
echo GPU: GTX 1080 Ti (11GB)
echo Model: SD 3.5 Medium (7GB)
echo Expected: 1024x1024 in ~25-35 seconds
echo.
echo Starting ComfyUI...
echo ==========================================
echo.

..\..\python_embeded\python.exe main.py^
  --normalvram^
  --fp16-vae^
  --dont-upcast-attention^
  --preview-method auto^
  %*

echo.
echo ==========================================
echo  ComfyUI has stopped
echo ==========================================
pause
