@echo off
TITLE Vite Test
cd /d "%~dp0"

echo ========================================
echo  TESTING VITE DIRECTLY
echo ========================================
echo.

echo [1] Checking Node.js...
node --version
echo.

echo [2] Checking npm...
npm --version
echo.

echo [3] Checking if node_modules exists...
if exist "node_modules" (
    echo [OK] node_modules exists
) else (
    echo [FAIL] node_modules MISSING - run: npm install
    pause
    exit /b 1
)
echo.

echo [4] Killing any existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Port 3000 cleared
echo.

echo [5] Testing Vite startup...
echo Running: npx vite --config vite.config.fast.ts
echo.
echo (This window will show Vite output. Look for errors!)
echo Press Ctrl+C to stop when done testing.
echo.

npx vite --config vite.config.fast.ts

echo.
echo Vite exited. Press any key to close.
pause >nul
