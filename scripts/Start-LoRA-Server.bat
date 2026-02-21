@echo off
:: ============================================================================
:: J.A.R.V.I.S. LoRA Training Server Launcher
:: ============================================================================

title JARVIS LoRA Server

cd /d "%~dp0"

echo.
echo Starting LoRA Training Server...
echo Port: 5005
echo.

:: Check for Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

:: Check for required packages
echo [CHECK] Checking dependencies...
python -c "import torch, transformers, peft, flask" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Missing dependencies. Installing...
    pip install torch transformers peft flask flask-cors
)

:: Create adapters directory if it doesn't exist
if not exist "adapters" mkdir adapters

:: Start the server
echo [START] Starting LoRA Server...
echo.
python lora_server.py

echo.
echo Server stopped.
pause
