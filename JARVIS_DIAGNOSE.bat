@echo off
setlocal EnableDelayedExpansion
TITLE JARVIS Diagnostics
cd /d "%~dp0"

echo.
echo ========================================
echo  JARVIS DIAGNOSTICS
echo ========================================
echo.

echo [CHECK] Node.js...
node --version 2>nul
if errorlevel 1 (
    echo [FAIL] Node.js not found!
    pause
    exit /b 1
)
echo [OK] Node.js found
echo.

echo [CHECK] Python...
python --version 2>nul
if errorlevel 1 (
    echo [WARN] Python not found - Python services won't work
) else (
    echo [OK] Python found
)
echo.

echo [CHECK] Node_modules...
if not exist "node_modules" (
    echo [FAIL] node_modules missing! Run: npm install
    pause
    exit /b 1
)
echo [OK] node_modules found
echo.

echo [CHECK] Vite config...
if not exist "vite.config.fast.ts" (
    echo [FAIL] vite.config.fast.ts missing!
    pause
    exit /b 1
)
echo [OK] Vite config found
echo.

echo [CHECK] TypeScript compilation...
npx tsc --noEmit 2>&1 | findstr "error TS" > nul
if not errorlevel 1 (
    echo [WARN] TypeScript errors found - check below:
    npx tsc --noEmit 2>&1 | findstr "error TS" | head -10
    echo.
    echo Continue anyway? (Y/N)
    choice /c YN /n
    if errorlevel 2 exit /b 1
) else (
    echo [OK] No TypeScript errors
)
echo.

echo [CHECK] Cleanup ports...
for %%p in (3000 3100 3101 5000 5002 5003 5004) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do (
        echo [KILL] Port %%p - PID %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul
echo [OK] Ports cleared
echo.

echo ========================================
echo  STARTING SERVICES (one by one)
echo ========================================
echo.

echo [1/7] Starting Hardware Monitor...
start /MIN "JARVIS-HW" cmd /c "node server/hardware-monitor.cjs"
timeout /t 1 >nul
echo [OK] Hardware Monitor started
echo.

echo [2/7] Starting Proxy...
start /MIN "JARVIS-PROXY" cmd /c "node server/proxy.js"
timeout /t 1 >nul
echo [OK] Proxy started
echo.

echo [3/7] Starting Piper TTS (if installed)...
if exist "Piper\piper_server.py" (
    start /MIN "JARVIS-PIPER" cmd /c "cd Piper && python piper_server.py"
    echo [OK] Piper started
) else (
    echo [SKIP] Piper not installed
)
echo.

echo [4/7] Skipping Embedding Server (optional)...
echo [SKIP] Run Start-Embedding-Server.bat manually if needed
echo.

echo [5/7] Skipping GPU Monitor (optional)...
echo [SKIP] Run Start-GPU-Monitor.bat manually if needed
echo.

echo [6/7] Skipping Vision Server (optional)...
echo [SKIP] Run Start-Vision-Server.bat manually if needed
echo.

echo [7/7] Starting Vite Dev Server...
start /MIN "JARVIS-VITE" cmd /c "npx vite --config vite.config.fast.ts"
echo [OK] Vite starting...
echo.

echo [WAIT] Waiting for Vite (30 sec max)...
set /a count=0
:wait
timeout /t 1 /nobreak >nul
set /a count+=1
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    if !count! lss 30 goto wait
    echo [FAIL] Vite failed to start!
    echo.
    echo Check the JARVIS-VITE window for errors
    pause
    exit /b 1
)
echo [OK] Vite ready in !count! seconds
echo.

echo ========================================
echo  OPENING BROWSER
echo ========================================
echo.

set "chrome="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "chrome=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "chrome=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "chrome=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if defined chrome (
    start "" /B "%chrome%" --app=http://localhost:3000 --window-size=1920,1080
    echo [OK] Chrome opened
) else (
    start msedge --app=http://localhost:3000 --window-size=1920,1080
    echo [OK] Edge opened
)

echo.
echo ========================================
echo  JARVIS IS RUNNING!
echo ========================================
echo.
echo To start optional services:
echo   - Embedding Server: Start-Embedding-Server.bat
echo   - GPU Monitor: Start-GPU-Monitor.bat
echo   - Vision Server: Start-Vision-Server.bat
echo.
echo Press any key to stop all services...
pause >nul

:shutdown
echo.
echo [SHUTDOWN] Stopping services...

for %%p in (3000 3100 3101 5000 5002 5003 5004) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p') do taskkill /F /PID %%a >nul 2>&1
)

taskkill /F /FI "WINDOWTITLE eq JARVIS-*" >nul 2>&1

echo [DONE] JARVIS stopped
pause
