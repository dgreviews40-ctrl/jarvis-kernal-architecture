@echo off
echo ==========================================
echo  JARVIS Piper Server (AMERICAN VOICE)
echo ==========================================
echo.
echo Starting with default voice (jarvis)...
echo.
echo For a BRITISH voice (closer to movie JARVIS):
echo   Run: start-british-server.bat
echo.
echo Available voices in voices\ folder:
cd /d "%~dp0"
dir /b voices\*.onnx 2>nul | findstr /i ".onnx" >nul
if errorlevel 1 (
    echo   (No voices found - please add voice files)
) else (
    for %%f in (voices\*.onnx) do (
        echo   - %%~nf
    )
)
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Start the HTTP server wrapper
python piper_server.py

echo.
echo Server stopped.
pause
