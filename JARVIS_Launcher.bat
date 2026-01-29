@echo off
TITLE JARVIS KERNEL SYSTEM
COLOR 0B

REM ============================================
REM  J.A.R.V.I.S. KERNEL LAUNCHER
REM  Starts all services and manages lifecycle
REM ============================================

SET JARVIS_DIR=%~dp0
SET JARVIS_URL=http://localhost:3000
SET HARDWARE_URL=http://localhost:3100

ECHO.
ECHO  ========================================
ECHO   J.A.R.V.I.S. KERNEL INITIALIZING...
ECHO  ========================================
ECHO.

REM Kill any existing JARVIS processes
ECHO [CLEANUP] Terminating previous instances...
taskkill /F /FI "WINDOWTITLE eq JARVIS_HARDWARE_MONITOR" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS_PROXY_SERVER" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS_VITE_SERVER" >nul 2>&1

REM Small delay after cleanup
timeout /t 1 /nobreak >nul

REM Start Hardware Monitor in background
ECHO [BOOT] Starting Hardware Monitor...
start "JARVIS_HARDWARE_MONITOR" /MIN cmd /c "cd /d %JARVIS_DIR% & node server/hardware-monitor.cjs"

REM Wait for hardware monitor to initialize
timeout /t 1 /nobreak >nul

REM Start Home Assistant Proxy in background
ECHO [BOOT] Starting Home Assistant Proxy...
start "JARVIS_PROXY_SERVER" /MIN cmd /c "cd /d %JARVIS_DIR% & node server/proxy.js"

REM Wait for proxy to initialize
timeout /t 1 /nobreak >nul

REM Start Vite Dev Server in background
ECHO [BOOT] Starting Vite Server...
start "JARVIS_VITE_SERVER" /MIN cmd /c "cd /d %JARVIS_DIR% & npm run dev"

REM Wait for Vite server to be ready
ECHO [BOOT] Waiting for servers to initialize...
:WAIT_FOR_SERVER
timeout /t 1 /nobreak >nul
curl -s %JARVIS_URL% >nul 2>&1
IF ERRORLEVEL 1 (
    ECHO [BOOT] Waiting for Vite server...
    GOTO WAIT_FOR_SERVER
)

ECHO.
ECHO [ONLINE] All systems operational
ECHO [ONLINE] Hardware Monitor: %HARDWARE_URL%
ECHO [ONLINE] JARVIS Interface: %JARVIS_URL%
ECHO.

REM Launch JARVIS in Chrome App Mode (or Edge fallback)
ECHO [LAUNCH] Opening JARVIS interface...

SET CHROME_PATH=
IF EXIST "C:\Program Files\Google\Chrome\Application\chrome.exe" SET CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
IF EXIST "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" SET CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
IF EXIST "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" SET CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe

IF NOT "%CHROME_PATH%"=="" (
    REM Launch Chrome and wait for it to close
    ECHO [ACTIVE] JARVIS is now running in Chrome
    ECHO [INFO] Close the browser window to shut down all services
    ECHO.
    start /WAIT "" "%CHROME_PATH%" --app="%JARVIS_URL%" --window-size=1920,1080
) ELSE (
    REM Fallback to Edge and wait for it to close
    ECHO [ACTIVE] JARVIS is now running in Edge
    ECHO [INFO] Close the browser window to shut down all services
    ECHO.
    start /WAIT "" msedge --app="%JARVIS_URL%" --window-size=1920,1080
)

REM Browser was closed - shutdown all services
ECHO.
ECHO [SHUTDOWN] Browser closed - terminating services...

REM Kill the background processes by window title
taskkill /F /FI "WINDOWTITLE eq JARVIS_HARDWARE_MONITOR" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS_PROXY_SERVER" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS_VITE_SERVER" >nul 2>&1

REM Also kill any node processes running our scripts (backup)
FOR /F "tokens=2" %%i IN ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID:"') DO (
    wmic process where "ProcessId=%%i" get CommandLine 2>nul | findstr /C:"hardware-monitor\|proxy" >nul && taskkill /F /PID %%i >nul 2>&1
)

ECHO [OFFLINE] All JARVIS services terminated
ECHO.
ECHO  ========================================
ECHO   J.A.R.V.I.S. SHUTDOWN COMPLETE
ECHO  ========================================
ECHO.
timeout /t 3 /nobreak >nul
exit
