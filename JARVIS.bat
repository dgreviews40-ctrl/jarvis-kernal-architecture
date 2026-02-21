@echo off
setlocal EnableDelayedExpansion
:: ============================================================================
:: J.A.R.V.I.S. - Just A Rather Very Intelligent System
:: Professional Unified Launcher v2.0
:: ============================================================================
:: This single batch file starts ALL required services and opens the dashboard
:: with a professional loading animation.
:: ============================================================================

:: Minimize this window immediately
if not DEFINED IS_MINIMIZED (
    set IS_MINIMIZED=1
    start /min cmd /c "%~dpnx0" %*
    exit
)

cd /d "%~dp0"

:: Set window properties
title J.A.R.V.I.S. Initializing...
mode con: cols=100 lines=30

:: ============================================================================
:: CONFIGURATION
:: ============================================================================
set "JARVIS_VERSION=2.0.1"
set "JARVIS_NAME=J.A.R.V.I.S."

:: Service Ports
set "PORT_VITE=3000"
set "PORT_HARDWARE=3100"
set "PORT_PROXY=3101"
set "PORT_PIPER=5000"
set "PORT_WHISPER=5001"
set "PORT_EMBEDDING=5002"
set "PORT_GPUMON=5003"
set "PORT_VISION=5004"
set "PORT_LORA=5005"
set "PORT_COMFYUI=8188"

:: Create temp directory
if not exist "temp" mkdir "temp" 2>nul

:: ============================================================================
:: FIND GOOGLE CHROME BROWSER (Required) - DO THIS FIRST
:: ============================================================================
call :ShowBanner

set "CHROME_PATH="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if not defined CHROME_PATH (
    echo [ERROR] Google Chrome not found! Please install Chrome for the best experience.
    echo [ERROR] The JARVIS boot animation requires Google Chrome specifically.
    pause
    exit /b 1
)

echo [OK] Google Chrome found: %CHROME_PATH%

:: ============================================================================
:: SHOW BOOT ANIMATION IMMEDIATELY (in Chrome)
:: ============================================================================

:: Open the loading screen RIGHT NOW in Chrome only
echo [START] Initializing J.A.R.V.I.S. Interface...
echo.
set "LOADING_URL=file:///%CD:\=/%/loading.html"
start "" "%CHROME_PATH%" "--app=%LOADING_URL%" --window-size=1400,900 --window-position=center

:: Give loading screen time to open
timeout /t 3 /nobreak >nul

:: ============================================================================
:: ENVIRONMENT CHECKS
:: ============================================================================
echo.
echo [CHECK] Checking Environment...
echo.

:: Check Node.js
call :CheckCommand node
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Node.js not found! Please install from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1" %%a in ('node --version') do set "NODE_VERSION=%%a"
echo [OK] Node.js !NODE_VERSION!

:: Check Python (optional but recommended)
call :CheckCommand python
set "PYTHON_CHECK=!ERRORLEVEL!"
if !PYTHON_CHECK! EQU 0 (
    for /f "tokens=2" %%a in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%a"
    echo [OK] Python !PYTHON_VERSION! - AI Services Available
    set "PYTHON_AVAILABLE=1"
) else (
    echo [WARN] Python not found - AI services disabled
    set "PYTHON_AVAILABLE=0"
)

:: Check npm packages
if not exist "node_modules" (
    echo [WARN] Node modules not found. Running npm install...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

:: ============================================================================
:: CLEANUP EXISTING PROCESSES
:: ============================================================================
echo.
echo [CLEANUP] Cleaning up existing processes...
call :CleanupProcesses >nul 2>&1
echo [OK] Cleanup complete

:: ============================================================================
:: START ALL SERVICES IN PARALLEL
:: ============================================================================

echo [START] Starting Core Services...
echo.

:: Start Shutdown Server (Node) - Required for clean shutdown
echo [1/9] Shutdown Server       - Port 9999
start /MIN "JARVIS-SHUTDOWN" cmd /c "node server/shutdown-server.cjs"
timeout /t 1 /nobreak >nul

:: Start Hardware Monitor (Node) - Required
echo [2/9] Hardware Monitor      - Port %PORT_HARDWARE%
start /MIN "JARVIS-HW" cmd /c "node server/hardware-monitor.cjs > temp/hardware.log 2>&1"
call :WaitForPort %PORT_HARDWARE% 15

:: Start HA Proxy (Node) - Required  
echo [3/9] Home Assistant Proxy  - Port %PORT_PROXY%
start /MIN "JARVIS-PROXY" cmd /c "node server/proxy.js > temp/proxy.log 2>&1"
call :WaitForPort %PORT_PROXY% 15

:: Start Piper TTS (Python) - Optional
echo [4/9] Piper TTS Server      - Port %PORT_PIPER%
if %PYTHON_AVAILABLE%==1 (
    :: Check for ANY .onnx voice file (not just jarvis)
    set "VOICE_FOUND=0"
    for %%f in ("Piper\voices\*.onnx") do (
        set "VOICE_FOUND=1"
        set "VOICE_FILE=%%~nxf"
    )
    
    if !VOICE_FOUND!==1 (
        cd /d "%~dp0"
        echo           [OK] Found voice: !VOICE_FILE!
        start /MIN "JARVIS-PIPER" cmd /c "python Piper\piper_server.py > temp\piper.log 2>&1"
        call :WaitForPortSilent %PORT_PIPER% 10
    ) else (
        echo           [WARN] No voice models found in Piper\voices\
        echo                 Run Install-JARVIS-Voice.bat or download voices manually
        echo                 You can select voices in Settings once available
    )
) else (
    echo           (Skipped - Python not available)
)

:: Start Whisper STT (Python) - Optional
echo [5/9] Whisper STT Server    - Port %PORT_WHISPER%
if %PYTHON_AVAILABLE%==1 (
    cd /d "%~dp0"
    start /MIN "JARVIS-WHISPER" cmd /c "python whisper_server.py > temp\whisper.log 2>&1"
    call :WaitForPortSilent %PORT_WHISPER% 10
) else (
    echo           (Skipped - Python not available)
)

:: Start Embedding Server (Python) - Optional
echo [6/9] Embedding Server      - Port %PORT_EMBEDDING%
if %PYTHON_AVAILABLE%==1 (
    cd /d "%~dp0"
    start /MIN "JARVIS-EMBEDDING" cmd /c "python embedding_server.py > temp\embedding.log 2>&1"
    call :WaitForPortSilent %PORT_EMBEDDING% 10
) else (
    echo           (Skipped - Python not available)
)

:: Start GPU Monitor (Python) - Optional
echo [7/9] GPU Monitor           - Port %PORT_GPUMON%
if %PYTHON_AVAILABLE%==1 (
    cd /d "%~dp0"
    start /MIN "JARVIS-GPU" cmd /c "python gpu_monitor.py > temp\gpu.log 2>&1"
    call :WaitForPortSilent %PORT_GPUMON% 10
) else (
    echo           (Skipped - Python not available)
)

:: Start Vision Server (Python) - Optional
echo [8/9] Vision Server         - Port %PORT_VISION%
if %PYTHON_AVAILABLE%==1 (
    cd /d "%~dp0"
    start /MIN "JARVIS-VISION" cmd /c "python vision_server.py > temp\vision.log 2>&1"
    call :WaitForPortSilent %PORT_VISION% 10
) else (
    echo           (Skipped - Python not available)
)

:: Start LoRA Server (Python) - Optional
echo [9/10] LoRA Training Server  - Port %PORT_LORA%
if %PYTHON_AVAILABLE%==1 (
    :: Check if peft is installed first
    python -c "import peft" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        cd /d "%~dp0"
        start /MIN "JARVIS-LORA" cmd /c "python lora_server.py > temp\lora.log 2>&1"
        call :WaitForPortSilent %PORT_LORA% 10
    ) else (
        echo           [WARN] peft module not installed
        echo                Run: pip install peft
        echo                LoRA server will not start automatically
    )
) else (
    echo           (Skipped - Python not available)
)

:: Start ComfyUI (Python) - Optional but recommended for image generation
echo [10/11] ComfyUI Image Gen   - Port %PORT_COMFYUI%
if %PYTHON_AVAILABLE%==1 (
    :: Check if ComfyUI is installed
    if exist "C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\main.py" (
        echo           [OK] ComfyUI found at C:\ComfyUI
        start /MIN "JARVIS-COMFYUI" cmd /c "cd /d C:\ComfyUI\ComfyUI_windows_portable && .\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --normalvram --dont-upcast-attention --enable-cors-header > %CD%\temp\comfyui.log 2>&1"
        call :WaitForPort %PORT_COMFYUI% 30
    ) else (
        echo           [INFO] ComfyUI not found at C:\ComfyUI
        echo                Install ComfyUI for AI image generation
        echo                See: docs/LOCAL_IMAGE_GENERATION.md
    )
) else (
    echo           (Skipped - Python not available)
)

:: ============================================================================
:: START MAIN VITE SERVER (loading.html already opened above)
:: ============================================================================
echo.
echo [START] Starting J.A.R.V.I.S. Dashboard...
echo.
echo [11/11] Vite Dev Server       - Port %PORT_VITE% (MAIN)
echo.

:: Start Vite in the background
echo [START] Launching Vite dev server...
start /MIN "JARVIS-VITE" cmd /c "npx vite --config vite.config.fast.ts --port %PORT_VITE%"

:: Check LoRA server status
timeout /t 2 /nobreak >nul
netstat -an | findstr ":%PORT_LORA% " | findstr LISTENING >nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTE] LoRA Training Server (port %PORT_LORA%) is not running
    echo        To start it manually, run: Start-LoRA-Visible.bat
    echo.
)

:: Check ComfyUI status
netstat -an | findstr ":%PORT_COMFYUI% " | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] ComfyUI Image Generation (port %PORT_COMFYUI%) is running
    echo        AI image generation is available!
    echo.
) else (
    echo.
    echo [NOTE] ComfyUI (port %PORT_COMFYUI%) is not running
    echo        AI image generation will use SVG fallback
    echo.
)

:: Display ready message
echo ============================================================
echo           J.A.R.V.I.S. IS NOW ONLINE
echo ============================================================
echo.
echo Dashboard: http://localhost:%PORT_VITE%
echo Close this window or press Ctrl+C to shutdown
echo.
echo ============================================================
echo.

:: The loading.html page will automatically redirect to dashboard when ready
:: NO separate window needed - single tab experience!

:: Keep this window open - monitor for Ctrl+C
:MonitorLoop
timeout /t 5 /nobreak >nul
goto :MonitorLoop

:: ============================================================================
:: SHUTDOWN SEQUENCE
:: ============================================================================
:Shutdown
echo.
echo.
echo [SHUTDOWN] Shutting down J.A.R.V.I.S....
echo.

call :CleanupProcesses

:: Cleanup temp files
del /q temp\*.log 2>nul

echo.
echo [OK] All services stopped. Goodbye, sir.
echo.
timeout /t 2 /nobreak >nul
exit /b 0

:: ============================================================================
:: FUNCTIONS
:: ============================================================================

:ShowBanner
cls
echo.
echo     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗
echo     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝
echo     ██║███████║██████╔╝██║   ██║██║███████╗
echo     ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║
echo     ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████║
echo     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝
echo.
echo         Just A Rather Very Intelligent System
echo                      Version %JARVIS_VERSION%
echo.
exit /b 0

:CheckCommand
where %~1 >nul 2>&1
exit /b %ERRORLEVEL%

:WaitForPort
set "port=%~1"
set "timeout_sec=%~2"
set /a "count=0"
:WaitLoop
    netstat -an | findstr ":%~1 " | findstr LISTENING >nul
    if !ERRORLEVEL! EQU 0 (
        echo           [OK] Ready
        exit /b 0
    )
    set /a "count+=1"
    if !count! GEQ %~2 (
        echo           [WARN] Timeout - may still be starting
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
goto :WaitLoop

:WaitForPortSilent
set "port=%~1"
set "timeout_sec=%~2"
set /a "count=0"
:WaitLoopSilent
    netstat -an | findstr ":%~1 " | findstr LISTENING >nul
    if !ERRORLEVEL! EQU 0 (
        echo           [OK] Ready
        exit /b 0
    )
    set /a "count+=1"
    if !count! GEQ %~2 (
        echo           [INFO] Starting in background
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
goto :WaitLoopSilent

:CleanupProcesses
echo [ ] Stopping services...
:: Kill JARVIS service windows
taskkill /F /FI "WINDOWTITLE eq JARVIS-*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-SHUTDOWN" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-HW" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-PROXY" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-PIPER" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-WHISPER" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-EMBEDDING" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-GPU" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-VISION" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-LORA" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-COMFYUI" /T >nul 2>&1

:: Kill ComfyUI python process on port 8188
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8188 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill the Chrome app window running loading.html
taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq loading.html" >nul 2>&1
:: Kill by port
for %%p in (3000 3100 3101 5000 5001 5002 5003 5004 5005 8188 9999) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
exit /b 0

:: Handle Ctrl+C
goto :Shutdown
