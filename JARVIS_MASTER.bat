@echo off
setlocal EnableDelayedExpansion
:: JARVIS Master Launcher
:: Starts ALL services (Node + Python) and ensures clean shutdown
:: Handles crashes, restarts, and automatic cleanup

cd /d "%~dp0"
title JARVIS Master Controller

:: Configuration
set NODE_PORTS=3000,3100,3101
set PYTHON_PORTS=5000,5001,5002,5003,5004
set ALL_PORTS=%NODE_PORTS%,%PYTHON_PORTS%

:: Kill any existing JARVIS processes first
echo [JARVIS] Cleaning up existing processes...
call :KillExistingProcesses
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo    JARVIS MASTER LAUNCHER
echo ========================================
echo.

:: Check Python availability
echo [CHECK] Checking Python...
python --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] Python found
    set PYTHON_AVAILABLE=1
) else (
    echo [WARN] Python not found - will run in NODE-ONLY mode
    set PYTHON_AVAILABLE=0
)

:: Check Node.js
echo [CHECK] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Create temp directory for PIDs
if not exist "temp" mkdir temp

:: Start services in order
echo.
echo [START] Launching JARVIS services...
echo.

:: 1. Hardware Monitor (Node)
echo [1/7] Starting Hardware Monitor (Node)...
start "JARVIS-HW[Node]" /MIN cmd /c "node server/hardware-monitor.cjs 2^>^&1 ^| findstr /V /C:^"experimental:^" /C:^"(node:^" ^> temp/hardware.log ^& echo !ERRORLEVEL! ^> temp\hw.pid"
timeout /t 2 /nobreak >nul
call :CheckPort 3100 HW

:: 2. HA Proxy (Node)
echo [2/7] Starting HA Proxy (Node)...
start "JARVIS-PROXY[Node]" /MIN cmd /c "node server/proxy.js 2^>^&1 ^| findstr /V /C:^"experimental:^" /C:^"(node:^" ^> temp/proxy.log"
timeout /t 2 /nobreak >nul
call :CheckPort 3101 PROXY

:: 3. Piper TTS (Python) - Optional but attempted
echo [3/7] Starting Piper TTS (Python)...
if %PYTHON_AVAILABLE% == 1 (
    start "JARVIS-PIPER[Python]" /MIN cmd /c "python whisper_server.py ^> temp/piper.log 2^>^&1"
    timeout /t 3 /nobreak >nul
    call :CheckPortSilent 5000 PIPER
echo [7/8] Starting Whisper STT (Python)...
if %PYTHON_AVAILABLE% == 1 (
    start "JARVIS-WHISPER[Python]" /MIN cmd /c "python whisper_server.py ^> temp/whisper.log 2^>^&1"
    timeout /t 3 /nobreak >nul
    call :CheckPortSilent 5001 WHISPER
) else (
    echo [SKIP] Python not available
)
) else (
    echo [SKIP] Python not available
)

:: 4. Embedding Server (Python) - Optional
echo [4/7] Starting Embedding Server (Python)...
if %PYTHON_AVAILABLE% == 1 (
    start "JARVIS-EMBED[Python]" /MIN cmd /c "python embedding_server.py ^> temp/embedding.log 2^>^&1"
    timeout /t 3 /nobreak >nul
    call :CheckPortSilent 5002 EMBEDDING
) else (
    echo [SKIP] Python not available
)

:: 5. GPU Monitor (Python) - Optional
echo [5/7] Starting GPU Monitor (Python)...
if %PYTHON_AVAILABLE% == 1 (
    start "JARVIS-GPU[Python]" /MIN cmd /c "python gpu_monitor.py ^> temp/gpu.log 2^>^&1"
    timeout /t 3 /nobreak >nul
    call :CheckPortSilent 5003 GPU
) else (
    echo [SKIP] Python not available
)

:: 6. Vision Server (Python) - Optional
echo [6/7] Starting Vision Server (Python)...
if %PYTHON_AVAILABLE% == 1 (
    start "JARVIS-VISION[Python]" /MIN cmd /c "python vision_server.py ^> temp/vision.log 2^>^&1"
    timeout /t 3 /nobreak >nul
    call :CheckPortSilent 5004 VISION
) else (
    echo [SKIP] Python not available
)

:: 7. Vite Dev Server (Node) - MAIN PROCESS
echo [7/7] Starting Vite (Node) - MAIN...
echo.
echo ========================================
echo    WAITING FOR VITE TO BE READY...
echo ========================================
echo.

:: Start Vite in the main window so when user closes it, everything shuts down
:: Use a wrapper to ensure cleanup happens
node launcher.cjs

:: When launcher exits, clean up everything
echo.
echo [JARVIS] Shutting down all services...
call :KillExistingProcesses

:: Cleanup temp files
del /q temp\*.log 2>nul
del /q temp\*.pid 2>nul

echo [JARVIS] All services stopped. Goodbye!
timeout /t 2 /nobreak >nul
exit /b 0

:: ========================================
:: FUNCTIONS
:: ========================================

:KillExistingProcesses
    echo [CLEANUP] Stopping any running JARVIS services...
    taskkill /F /FI "WINDOWTITLE eq JARVIS-*" /T >nul 2>&1
    taskkill /F /IM node.exe /FI "WINDOWTITLE eq JARVIS-*" >nul 2>&1
    :: Kill by port
    for %%p in (%ALL_PORTS%) do (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
    exit /b 0

:CheckPort
    set PORT=%1
    set NAME=%2
    netstat -an | findstr ":%PORT% " | findstr LISTENING >nul
    if %ERRORLEVEL% == 0 (
        echo [OK] %NAME% running on port %PORT%
    ) else (
        echo [WARN] %NAME% not responding on port %PORT% (may still be starting)
    )
    exit /b 0

:CheckPortSilent
    set PORT=%1
    set NAME=%2
    netstat -an | findstr ":%PORT% " | findstr LISTENING >nul
    if %ERRORLEVEL% == 0 (
        echo [OK] %NAME% running on port %PORT%
    ) else (
        echo [INFO] %NAME% starting... (optional service)
    )
    exit /b 0
