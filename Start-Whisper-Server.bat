@echo off
echo ========================================
echo JARVIS Whisper STT Server
echo ========================================
echo.
echo This will start the local Whisper speech
echo recognition server on port 5001.
echo.
echo Requirements:
echo - Python 3.8+ installed
echo - whisper: pip install openai-whisper
echo - For GPU: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
echo.
echo Press any key to start...
pause >nul

cd /d "%~dp0"

python whisper_server.py

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start Whisper server.
    echo Make sure Python is installed and whisper is available:
    echo   pip install openai-whisper flask flask-cors
    echo.
    pause
)
