@echo off
setlocal EnableDelayedExpansion
TITLE JARVIS Minimal Launcher
cd /d "%~dp0"

echo.
echo ========================================
echo  JARVIS MINIMAL (Core Services Only)
echo ========================================
echo.

REM Cleanup
echo [INIT] Cleaning up ports...
for %%p in (3000 3100 3101) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul
echo [OK] Cleanup done
echo.

REM Start core services only
echo [START] Starting core services...
start /MIN "JARVIS-HW" cmd /c "node server/hardware-monitor.cjs"
start /MIN "JARVIS-PROXY" cmd /c "node server/proxy.js"
start /MIN "JARVIS-VITE" cmd /c "npx vite --config vite.config.fast.ts"

echo [WAIT] Waiting for Vite...
set /a count=0
:wait
timeout /t 1 /nobreak >nul
set /a count+=1
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    if !count! lss 60 goto wait
    echo [WARN] Timeout waiting for Vite
) else (
    echo [OK] Ready in !count! seconds
)

echo [LAUNCH] Opening browser...
set "chrome="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "chrome=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "chrome=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "chrome=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if defined chrome (
    start "" /B "%chrome%" --app=http://localhost:3000 --window-size=1920,1080
) else (
    start msedge --app=http://localhost:3000 --window-size=1920,1080
)

echo.
echo ========================================
echo  JARVIS RUNNING (Core Only)
echo ========================================
echo.
echo Features disabled:
echo   - Embedding Server (Start-Embedding-Server.bat)
echo   - GPU Monitor (Start-GPU-Monitor.bat)
echo   - Vision Server (Start-Vision-Server.bat)
echo   - Piper TTS (Install-JARVIS-Voice.bat)
echo.
echo CLOSE BROWSER to stop
echo.

:monitor
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "chrome.exe" >nul
if not errorlevel 1 goto monitor
tasklist /FI "IMAGENAME eq msedge.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "msedge.exe" >nul
if not errorlevel 1 goto monitor

:shutdown
echo.
echo [SHUTDOWN] Stopping...
for %%p in (3000 3100 3101) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)
taskkill /F /FI "WINDOWTITLE eq JARVIS-*" >nul 2>&1
echo [DONE]
