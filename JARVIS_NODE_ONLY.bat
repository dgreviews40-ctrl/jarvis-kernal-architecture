@echo off
setlocal EnableDelayedExpansion
TITLE JARVIS Launcher (Node.js Only)
cd /d "%~dp0"

echo.
echo ========================================
echo  JARVIS LAUNCHER (Node.js Services Only)
echo ========================================
echo.
echo NOTE: Python services disabled (Embedding, GPU, Vision)
echo Run their .bat files separately if needed.
echo.

REM Cleanup ports
echo [INIT] Stopping any existing processes...
for %%p in (3000 3100 3101 5000) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo [OK] Cleanup complete
echo.

REM Start ONLY Node.js services
echo [START] Starting Node.js services...
start /MIN "JARVIS-HW" cmd /c "node server/hardware-monitor.cjs"
start /MIN "JARVIS-PROXY" cmd /c "node server/proxy.js"
start /MIN "JARVIS-PIPER" cmd /c "cd Piper && python piper_server.py"
start /MIN "JARVIS-VITE" cmd /c "npx vite --config vite.config.fast.ts"

echo.
echo [WAIT] Waiting for Vite (max 60s)...
set /a count=0
:wait
timeout /t 1 /nobreak >nul
set /a count+=1
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    if !count! lss 60 goto wait
    echo [WARN] Timeout waiting for Vite
) else (
    echo [OK] Vite ready in !count! seconds
)

echo.
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
echo  JARVIS is Running (Node.js Only)
echo ========================================
echo.
echo Python features disabled (missing dependencies):
echo   - Embedding Server: Start-Embedding-Server.bat
echo   - GPU Monitor: Start-GPU-Monitor.bat  
echo   - Vision Server: Start-Vision-Server.bat
echo.
echo CLOSE THE BROWSER to stop all services
echo.

REM Monitor browser
:monitor
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "chrome.exe" >nul
if not errorlevel 1 goto monitor
tasklist /FI "IMAGENAME eq msedge.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "msedge.exe" >nul
if not errorlevel 1 goto monitor
timeout /t 1 /nobreak >nul
tasklist /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "chrome.exe" >nul
if not errorlevel 1 goto monitor
tasklist /FI "IMAGENAME eq msedge.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "msedge.exe" >nul
if not errorlevel 1 goto monitor

REM Shutdown
:shutdown
echo.
echo [SHUTDOWN] Stopping services...
for %%p in (3000 3100 3101 5000 5002 5003 5004) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)
taskkill /F /FI "WINDOWTITLE eq JARVIS-*" >nul 2>&1
echo [DONE] JARVIS stopped
timeout /t 2 >nul
