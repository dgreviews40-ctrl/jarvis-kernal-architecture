@echo off
setlocal EnableDelayedExpansion
TITLE JARVIS Launcher
cd /d "%~dp0"

echo.
echo ========================================
echo  JARVIS LAUNCHER
echo ========================================
echo.

REM Cleanup existing
echo [INIT] Stopping any existing JARVIS processes...
for %%p in (3000 3100 3101 5000) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo [OK] Cleanup complete
echo.

REM Start services minimized
echo [START] Starting JARVIS services...
start /MIN "JARVIS-HW" cmd /c "node server/hardware-monitor.cjs"
start /MIN "JARVIS-PROXY" cmd /c "node server/proxy.js"  
start /MIN "JARVIS-PIPER" cmd /c "cd Piper && python piper_server.py"
start /MIN "JARVIS-VITE" cmd /c "npx vite --config vite.config.fast.ts"

echo.
echo [WAIT] Waiting for Vite server...
set /a count=0
:wait
timeout /t 1 /nobreak >nul
set /a count+=1
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    if !count! lss 90 goto wait
    echo [WARN] Timeout waiting for Vite, continuing...
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
echo  JARVIS is Running!
echo ========================================
echo.
echo  CLOSE THE BROWSER to stop all services
echo.

REM Monitor browser - when localhost:3000 window closes, shut down
:monitor
    timeout /t 2 /nobreak >nul
    
    REM Check if any chrome/msedge window with localhost:3000 exists
    tasklist /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "chrome.exe" >nul
    if not errorlevel 1 goto monitor
    
    tasklist /FI "IMAGENAME eq msedge.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "msedge.exe" >nul  
    if not errorlevel 1 goto monitor
    
    REM Check again after short delay (browser might just be loading)
    timeout /t 1 /nobreak >nul
    tasklist /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "chrome.exe" >nul
    if not errorlevel 1 goto monitor
    
    tasklist /FI "IMAGENAME eq msedge.exe" /FI "WINDOWTITLE eq localhost:3000*" 2>nul | findstr "msedge.exe" >nul
    if not errorlevel 1 goto monitor
    
    REM Browser is really closed
    goto shutdown

:shutdown
echo.
echo [SHUTDOWN] Browser closed - stopping JARVIS services...

REM Kill by port
for %%p in (3000 3100 3101 5000) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)

REM Close CMD windows
taskkill /F /FI "WINDOWTITLE eq JARVIS-HW*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-PROXY*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-PIPER*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS-VITE*" >nul 2>&1

echo [DONE] JARVIS stopped
timeout /t 2 >nul
