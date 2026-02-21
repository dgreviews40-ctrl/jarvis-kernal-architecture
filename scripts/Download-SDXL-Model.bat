@echo off
echo ============================================
echo   Download SDXL Model for JARVIS
echo ============================================
echo.
echo This will download SDXL Base 1.0 (7GB)
echo which works out-of-the-box with ComfyUI.
echo.
echo SD 3.5 Medium requires additional CLIP models,
echo but SDXL works immediately!
echo.
pause

set "COMFYUI_DIR=C:\ComfyUI\ComfyUI_windows_portable"
set "MODELS_DIR=%COMFYUI_DIR%\ComfyUI\models\checkpoints"

if not exist "%COMFYUI_DIR%" (
    echo [ERROR] ComfyUI not found at %COMFYUI_DIR%
    echo Please install ComfyUI first.
    pause
    exit /b 1
)

echo.
echo [DOWNLOAD] SDXL Base 1.0 from HuggingFace...
echo This is a 7GB file and may take 10-30 minutes depending on your internet.
echo.

:: Download SDXL Base 1.0
cd /d "%MODELS_DIR%"
curl -L -o "sd_xl_base_1.0.safetensors" "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors" --progress-bar

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Download failed!
    echo.
    echo Alternative: Download manually from:
    echo https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
    echo.
    echo Place the file in: %MODELS_DIR%
    pause
    exit /b 1
)

echo.
echo [SUCCESS] SDXL Base 1.0 downloaded successfully!
echo.
echo Location: %MODELS_DIR%\sd_xl_base_1.0.safetensors
echo.
echo You can now generate images with JARVIS!
echo Try: "Generate a photo of a cat"
echo.
pause
