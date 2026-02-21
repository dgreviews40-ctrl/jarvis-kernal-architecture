@echo off
:: Install Python dependencies for JARVIS optional features

cd /d "%~dp0"
title JARVIS Python Dependencies Installer

echo ========================================
echo    JARVIS Python Dependencies
echo ========================================
echo.
echo This will install Python packages for:
echo   - Piper TTS (voice)
echo   - Embedding Server (AI search)
echo   - GPU Monitor (graphics stats)
echo   - Vision Server (image analysis)
echo.
echo Press any key to continue...
pause >nul

echo.
echo [1/2] Upgrading pip...
python -m pip install --upgrade pip

echo.
echo [2/2] Installing packages...
echo This may take several minutes...
echo.

python -m pip install flask flask-cors sentence-transformers nvidia-ml-py websockets psutil transformers torch Pillow

if %ERRORLEVEL% == 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All packages installed!
    echo ========================================
    echo.
    echo You can now use JARVIS with full Python features.
) else (
    echo.
    echo ========================================
    echo [ERROR] Installation failed!
    echo ========================================
    echo.
    echo Common fixes:
    echo 1. Make sure Python is installed: python --version
    echo 2. Try: python -m pip install --upgrade pip
    echo 3. Install Visual C++ Build Tools
)

echo.
pause
