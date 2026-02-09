@echo off
chcp 65001 >nul
title JARVIS GPU Monitor
cls

echo +============================================================+
echo ^|              JARVIS GPU Monitor Server                     ^|
echo +============================================================+
echo.

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

echo [OK] Python found
echo.

:: Check if required packages are installed
echo Checking dependencies...

python -c "import pynvml" 2>nul
set NVML_AVAILABLE=%errorlevel%

python -c "import websockets" 2>nul
set WS_AVAILABLE=%errorlevel%

python -c "import psutil" 2>nul
set PSUTIL_AVAILABLE=%errorlevel%

if %NVML_AVAILABLE% neq 0 (
    echo [INFO] Installing nvidia-ml-py...
    pip install nvidia-ml-py
    if errorlevel 1 (
        echo [ERROR] Failed to install nvidia-ml-py
        echo        GPU monitoring will run in MOCK mode
        timeout /t 3 >nul
    )
)

if %WS_AVAILABLE% neq 0 (
    echo [INFO] Installing websockets...
    pip install websockets
    if errorlevel 1 (
        echo [ERROR] Failed to install websockets
        pause
        exit /b 1
    )
)

if %PSUTIL_AVAILABLE% neq 0 (
    echo [INFO] Installing psutil...
    pip install psutil
    if errorlevel 1 (
        echo [WARNING] Failed to install psutil
        echo          Process names may not be available
        timeout /t 2 >nul
    )
)

echo [OK] Dependencies ready
echo.

:: Check for NVIDIA GPU
echo Checking for NVIDIA GPU...
python -c "import pynvml; pynvml.nvmlInit(); print('GPU:', pynvml.nvmlDeviceGetName(pynvml.nvmlDeviceGetHandleByIndex(0)))" 2>nul
if errorlevel 1 (
    echo [WARNING] No NVIDIA GPU detected or NVML not available
    echo           Running in MOCK mode for testing
)
echo.

:: Start the server
echo Starting GPU Monitor on port 5003...
echo WebSocket: ws://localhost:5003
echo Press Ctrl+C to stop
echo.

python gpu_monitor.py

if errorlevel 1 (
    echo.
    echo [ERROR] GPU Monitor crashed or failed to start
    pause
)
