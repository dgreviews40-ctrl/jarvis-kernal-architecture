@echo off
chcp 65001 >nul
title JARVIS Vision Server (CLIP)

cls
echo +============================================================+
echo ^|              JARVIS Vision Server                          ^|
echo ^|                 CLIP + Captioning                          ^|
echo +============================================================+
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found!
    echo [ERROR] Please install Python 3.10+ from Microsoft Store or python.org
    pause
    exit /b 1
)

echo [OK] Python found

REM Check for required packages
echo.
echo Checking dependencies...

python -c "import torch" 2>nul
if errorlevel 1 (
    echo [MISSING] PyTorch not found. Installing...
    pip install torch --index-url https://download.pytorch.org/whl/cu118
    if errorlevel 1 (
        echo [ERROR] Failed to install PyTorch!
        pause
        exit /b 1
    )
)
echo [OK] PyTorch

python -c "import transformers" 2>nul
if errorlevel 1 (
    echo [MISSING] transformers not found. Installing...
    pip install transformers
    if errorlevel 1 (
        echo [ERROR] Failed to install transformers!
        pause
        exit /b 1
    )
)
echo [OK] transformers

python -c "from PIL import Image" 2>nul
if errorlevel 1 (
    echo [MISSING] Pillow not found. Installing...
    pip install Pillow
    if errorlevel 1 (
        echo [ERROR] Failed to install Pillow!
        pause
        exit /b 1
    )
)
echo [OK] Pillow

python -c "import flask" 2>nul
if errorlevel 1 (
    echo [MISSING] flask not found. Installing...
    pip install flask flask-cors
    if errorlevel 1 (
        echo [ERROR] Failed to install flask!
        pause
        exit /b 1
    )
)
echo [OK] Flask

echo.
echo +============================================================+
echo Starting Vision Server on port 5004...
echo.
echo Features:
echo   - CLIP image embeddings (GPU accelerated)
echo   - Auto-caption generation
echo   - Tag detection
echo   - Image-text similarity
echo.
echo GPU: Detecting...
echo +============================================================+
echo.

python vision_server.py

if errorlevel 1 (
    echo.
    echo [ERROR] Vision server crashed!
    echo.
    echo Troubleshooting:
    echo 1. Check that you have an NVIDIA GPU with CUDA support
    echo 2. Verify CUDA drivers are installed
    echo 3. Try reinstalling: pip install torch --index-url https://download.pytorch.org/whl/cu118
    echo.
    pause
)

exit /b
