@echo off
cd /d "%~dp0"

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ========================================
echo  JARVIS LAUNCHER
echo ========================================
echo.
echo Starting JARVIS...
echo Press Ctrl+C to stop
echo Or use the Exit button in the UI
echo.

node launcher.cjs

if errorlevel 1 (
    echo.
    echo [ERROR] JARVIS encountered an error
    pause
)
