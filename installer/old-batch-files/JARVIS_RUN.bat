@echo off
:: JARVIS Complete Launcher
:: Starts all services (Node + Python) and manages shutdown

cd /d "%~dp0"

:: Check for node_modules
if not exist "node_modules" (
    echo ============================================
    echo    JARVIS ERROR
    echo ============================================
    echo.
    echo node_modules folder not found!
    echo.
    echo Please run: npm install
    echo.
    echo This will install all required Node.js packages.
    echo.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)

:: Check for admin rights (not required but helpful)
net session >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [JARVIS] Running with administrator privileges
) else (
    echo [JARVIS] Running without administrator privileges
)

echo.
echo ============================================
echo    JARVIS AI ASSISTANT
echo ============================================
echo.
echo This will start ALL JARVIS services:
echo   - Hardware Monitor (Node)
echo   - HA Proxy (Node)
echo   - Vite Dev Server (Node)
echo   - Piper TTS (Python) [Optional]
echo   - Embedding Server (Python) [Optional]
echo   - GPU Monitor (Python) [Optional]
echo   - Vision Server (Python) [Optional]
echo.
echo Python services are optional and can be installed later:
echo   Install-Python-Deps.bat
echo.
echo Press any key to start...
pause >nul

:: Run the master launcher
node launcher.cjs

:: When it exits, clean up any leftovers
echo.
echo [JARVIS] Cleaning up...
taskkill /F /FI "WINDOWTITLE eq JARVIS-*" /T >nul 2>&1
for %%p in (3000 3100 3101 5000 5001 5002 5003 5004) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING 2^>nul') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo JARVIS has been shut down.
pause
