@echo off
echo Starting JARVIS Piper Server...
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

REM Start the HTTP server wrapper
python piper_server.py

echo.
echo Server stopped.
pause
