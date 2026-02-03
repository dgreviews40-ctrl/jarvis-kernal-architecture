@echo off
TITLE JARVIS KERNEL SYSTEM
COLOR 0B

REM ============================================
REM  J.A.R.V.I.S. KERNEL LAUNCHER v1.3
REM  Fixed: Added proper error handling
REM  Fixed: Opens in app mode automatically
REM ============================================

REM CRITICAL: Change to the script's directory first
cd /d "%~dp0"

REM Set all variables AFTER changing directory
SET "JARVIS_DIR=%CD%"
SET "JARVIS_URL=http://localhost:3000"
SET "HARDWARE_URL=http://localhost:3100"
SET "PIPER_DIR=%JARVIS_DIR%\Piper"

echo.
echo  ========================================
echo   J.A.R.V.I.S. KERNEL v1.3 INITIALIZING...
echo  ========================================
echo.

REM Verify we're in the right directory
IF NOT EXIST "package.json" (
    echo [ERROR] Cannot find package.json
    echo [ERROR] Script must be in jarvis-kernel-architect folder
    echo [ERROR] Current directory: %CD%
    echo.
    pause
    exit /b 1
)

REM Check node_modules
IF NOT EXIST "node_modules" (
    echo [ERROR] node_modules not found
    echo [ERROR] Please run: npm install
    echo.
    pause
    exit /b 1
)

REM Verify Node.js
node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo [ERROR] Install from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [CHECK] Node.js version: 
node --version

REM Kill existing processes
echo [CLEANUP] Terminating previous instances...
taskkill /F /FI "WINDOWTITLE eq JARVIS*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start Piper if available
IF EXIST "%PIPER_DIR%\piper.exe" (
    echo [BOOT] Starting JARVIS Voice Server...
    start "JARVIS_VOICE_SERVER" /MIN cmd /c "cd /d "%PIPER_DIR%" && piper.exe --port 5000"
    timeout /t 2 /nobreak >nul
) ELSE (
    echo [INFO] Piper not installed - voice features disabled
)

REM Start Hardware Monitor
IF EXIST "server\hardware-monitor.cjs" (
    echo [BOOT] Starting Hardware Monitor...
    start "JARVIS_HARDWARE_MONITOR" /MIN cmd /c "node server\hardware-monitor.cjs"
    timeout /t 1 /nobreak >nul
)

REM Start Home Assistant Proxy
IF EXIST "server\proxy.js" (
    echo [BOOT] Starting Home Assistant Proxy...
    start "JARVIS_PROXY_SERVER" /MIN cmd /c "node server\proxy.js"
    timeout /t 1 /nobreak >nul
)

REM Start Vite Dev Server
echo [BOOT] Starting Vite Development Server...
start "JARVIS_VITE_SERVER" /MIN cmd /c "npm run dev"

REM Wait for Vite server
echo [BOOT] Waiting for servers to initialize...
SET "RETRY_COUNT=0"

:WAIT_FOR_SERVER
timeout /t 1 /nobreak >nul
SET /A RETRY_COUNT+=1

IF %RETRY_COUNT% GTR 30 (
    echo.
    echo [ERROR] Server failed to start after 30 seconds
    echo.
    netstat -ano | findstr :3000 >nul 2>&1
    IF NOT ERRORLEVEL 1 (
        echo [ERROR] Port 3000 is in use by another process
        echo [FIX] Run JARVIS_Cleanup.bat and try again
    ) ELSE (
        echo [ERROR] Check JARVIS_VITE_SERVER window for errors
    )
    echo.
    pause
    exit /b 1
)

curl.exe -s "%JARVIS_URL%" >nul 2>&1
IF ERRORLEVEL 1 (
    echo [BOOT] Waiting for Vite server... (%RETRY_COUNT%/30)
    GOTO WAIT_FOR_SERVER
)

echo.
echo [ONLINE] All systems operational
echo [ONLINE] Hardware Monitor: %HARDWARE_URL%
echo [ONLINE] JARVIS Interface: %JARVIS_URL%
echo.

REM Launch in Chrome App Mode (borderless window)
echo [LAUNCH] Opening JARVIS interface...

SET "CHROME_PATH="
IF EXIST "C:\Program Files\Google\Chrome\Application\chrome.exe" SET "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
IF EXIST "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" SET "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
IF EXIST "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" SET "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

IF NOT "%CHROME_PATH%"=="" (
    echo [ACTIVE] JARVIS running in Chrome app mode
    start /WAIT "" "%CHROME_PATH%" --app="%JARVIS_URL%" --window-size=1920,1080 --disable-features=TranslateUI
) ELSE (
    echo [ACTIVE] JARVIS running in Edge app mode
    start /WAIT "" msedge --app="%JARVIS_URL%" --window-size=1920,1080
)

REM Browser closed - shutdown
echo.
echo [SHUTDOWN] Browser closed - terminating services...
taskkill /F /FI "WINDOWTITLE eq JARVIS*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo [OFFLINE] All services terminated
echo.
echo  ========================================
echo   J.A.R.V.I.S. SHUTDOWN COMPLETE
echo  ========================================
echo.
timeout /t 3 /nobreak >nul
