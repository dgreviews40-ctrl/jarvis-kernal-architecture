@echo off
echo ==========================================
echo  JARVIS Piper Server (BRITISH VOICE)
echo ==========================================
echo.
echo Starting with British voice (alan)...
echo For that classic JARVIS feel from the movies
echo.
echo Alternative voices:
echo   - alan: Scottish male (most JARVIS-like)
echo   - joe: Northern England male
echo   - amy: Southern England female
echo.
cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if alan voice exists, warn if not
if not exist "voices\alan.onnx" (
    echo WARNING: British voice 'alan' not found!
    echo.
    echo Please download the British voice:
    echo 1. Download: https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx
    echo 2. Download: https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json
    echo 3. Rename files to: alan.onnx and alan.onnx.json
    echo 4. Place both files in: Piper\voices\
    echo.
    echo Falling back to jarvis voice (American)...
    echo.
    timeout /t 5
)

REM Start with British voice
set PIPER_VOICE=alan
python piper_server.py

echo.
echo Server stopped.
pause
