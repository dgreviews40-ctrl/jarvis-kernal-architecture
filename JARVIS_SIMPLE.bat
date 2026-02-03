@echo off
TITLE JARVIS Launcher
COLOR 0B
cd /d "%~dp0"

echo.
echo ========================================
echo  JARVIS LAUNCHER
echo ========================================
echo.

REM Check if in correct directory
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo [ERROR] Make sure this file is in jarvis-kernel-architect folder
    echo.
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo [ERROR] Install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Found package.json
echo [OK] Node.js detected
echo.

REM Kill any existing node/python processes to avoid port conflicts
echo [INFO] Stopping any existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  Starting JARVIS Servers
echo ========================================
echo.

REM Start Hardware Monitor Server (Port 3100)
echo [START] Starting Hardware Monitor Server (Port 3100)...
start "HARDWARE-MONITOR" /MIN cmd /k "npm run hardware"
timeout /t 3 /nobreak >nul

REM Start Home Assistant Proxy Server (Port 3101)
echo [START] Starting Home Assistant Proxy (Port 3101)...
start "HA-PROXY" /MIN cmd /k "npm run proxy"
timeout /t 3 /nobreak >nul

REM Start Piper TTS Server (Port 5000)
echo [START] Starting Piper TTS Server (Port 5000)...
start "PIPER-TTS" /MIN cmd /k "cd Piper && python piper_server.py"
timeout /t 3 /nobreak >nul

REM Start Vite Dev Server (Port 3000)
echo [START] Starting Vite Dev Server (Port 3000)...
start "VITE" /MIN cmd /k "npm run dev"

echo.
echo [WAIT] Waiting for servers to initialize...
timeout /t 8 /nobreak >nul

REM Check if servers are responding
echo.
echo ========================================
echo  Checking Server Status
echo ========================================
echo.

REM Check Hardware Monitor
curl -s http://localhost:3100/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Hardware Monitor (Port 3100) may not be ready yet
) else (
    echo [OK] Hardware Monitor running on Port 3100
)

REM Check Home Assistant Proxy
curl -s http://localhost:3101/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Home Assistant Proxy (Port 3101) may not be ready yet
) else (
    echo [OK] Home Assistant Proxy running on Port 3101
)

REM Check Vite Server
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Vite Server (Port 3000) may not be ready yet
) else (
    echo [OK] Vite Server running on Port 3000
)

echo.

REM Find and launch Chrome
echo [INFO] Launching browser...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1920,1080
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1920,1080
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1920,1080
) else (
    start msedge --app=http://localhost:3000 --window-size=1920,1080
)

echo.
echo ========================================
echo  JARVIS is Running!
echo ========================================
echo.
echo Servers:
echo   - Frontend (Vite):     http://localhost:3000
echo   - Hardware Monitor:    http://localhost:3100
echo   - Home Assistant Proxy: http://localhost:3101
echo   - Piper TTS:           http://localhost:5000
echo.
echo Close browser and press any key to shutdown.
echo.
pause

echo.
echo ========================================
echo  Shutting Down JARVIS
echo ========================================
echo.
echo [SHUTDOWN] Stopping all services...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
echo [DONE] All services stopped
echo.
timeout /t 2 /nobreak >nul
