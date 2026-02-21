@echo off
cd /d "C:\Users\dman\Desktop\jarvis-kernel-architect"
title JARVIS LoRA Server - Debug Mode

echo =========================================
echo JARVIS LoRA Training Server
echo =========================================
echo.

:: Check Python
echo [CHECK] Looking for Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH!
    echo.
    echo Trying python3...
    python3 --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] python3 also not found!
        echo.
        echo Please install Python from https://python.org
        echo Make sure to check "Add Python to PATH" during install
        pause
        exit /b 1
    ) else (
        set PYTHON_CMD=python3
    )
) else (
    set PYTHON_CMD=python
)

echo [OK] Found Python:
%PYTHON_CMD% --version
echo.

:: Check dependencies
echo [CHECK] Checking required packages...
%PYTHON_CMD% -c "import torch, transformers, peft, flask" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Missing dependencies!
    echo Installing: torch transformers peft flask flask-cors...
    %PYTHON_CMD% -m pip install torch transformers peft flask flask-cors
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo [OK] All dependencies found
)
echo.

:: Create adapters directory
if not exist "adapters" mkdir adapters

:: Start the server
echo [START] Starting LoRA Server on port 5005...
echo.
echo Press Ctrl+C to stop
echo.

%PYTHON_CMD% lora_server.py

:: If we get here, server stopped
echo.
echo Server stopped.
pause
