@echo off
chcp 65001 >nul
title JARVIS - Download Test Model
color 0A

set "COMFYUI_MODEL_DIR=C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints"

echo ====================================================
echo   JARVIS - Download Test Model for ComfyUI
echo ====================================================
echo.
echo This will download a small, reliable SD 1.5 model
echo that works great on GTX 1080 Ti (11GB VRAM).
echo.
echo Model: dreamshaper_8.safetensors (3.84 GB)
echo - Excellent quality, very reliable VAE
echo - Works at 512x512, 768x768, or 1024x1024
echo - Fast generation on 11GB VRAM
echo.
echo Press Ctrl+C to cancel, or
echo.
pause

echo.
echo Creating directory structure...
if not exist "%COMFYUI_MODEL_DIR%" mkdir "%COMFYUI_MODEL_DIR%"

echo.
echo Downloading model from Hugging Face...
echo This will take 5-10 minutes depending on your connection.
echo.

:: Download from Hugging Face (reliable, no auth required)
echo Downloading dreamshaper_8.safetensors (3.84 GB)...
powershell -Command "& {$ProgressPreference='SilentlyContinue'; $url='https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors'; $out='%COMFYUI_MODEL_DIR%\dreamshaper_8.safetensors'; Write-Host 'Downloading...'; Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing; Write-Host 'Done!'}"

if exist "%COMFYUI_MODEL_DIR%\dreamshaper_8.safetensors" (
    echo.
    echo ====================================================
    echo [OK] Model downloaded successfully!
    echo ====================================================
    echo Location: %COMFYUI_MODEL_DIR%\dreamshaper_8.safetensors
    echo.
    echo You can now generate images with prompts like:
    echo   "Generate an image of a sunset over mountains"
    echo.
    echo Or specify the model explicitly:
    echo   "Generate an image using dreamshaper_8.safetensors"
    echo.
) else (
    echo.
    echo [ERROR] Download failed.
    echo.
    echo Please manually download from one of these options:
    echo.
    echo OPTION 1 - DreamShaper 8 (Recommended):
    echo   URL: https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors
    echo   Save to: %COMFYUI_MODEL_DIR%\dreamshaper_8.safetensors
    echo.
    echo OPTION 2 - Realistic Vision V5.1:
    echo   URL: https://civitai.com/models/4201/realistic-vision-v51
    echo   Save to: %COMFYUI_MODEL_DIR%\realisticVisionV51_v51VAE.safetensors
    echo.
    echo OPTION 3 - Standard SD 1.5:
    echo   URL: https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors
    echo   Save to: %COMFYUI_MODEL_DIR%\v1-5-pruned-emaonly.safetensors
    echo.
)

pause
