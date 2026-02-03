@echo off
TITLE JARVIS CLEANUP
COLOR 0C

echo ========================================
echo  JARVIS CLEANUP UTILITY
echo ========================================
echo.

echo [INFO] Stopping all JARVIS-related processes...
echo.

REM Kill any JARVIS titled windows
taskkill /F /FI "WINDOWTITLE eq JARVIS*" 2>nul
if ERRORLEVEL 1 (
    echo [INFO] No JARVIS windows found
) else (
    echo [OK] Killed JARVIS windows
)

REM Kill all node.exe processes
taskkill /F /IM node.exe 2>nul
if ERRORLEVEL 1 (
    echo [INFO] No Node.js processes found
) else (
    echo [OK] Killed Node.js processes
)

REM Kill Python processes (Piper TTS)
taskkill /F /IM python.exe 2>nul
if ERRORLEVEL 1 (
    echo [INFO] No Python processes found
) else (
    echo [OK] Killed Python processes
)

REM Kill Piper.exe if running
taskkill /F /IM piper.exe 2>nul
if ERRORLEVEL 1 (
    echo [INFO] No Piper processes found
) else (
    echo [OK] Killed Piper processes
)

echo.
echo [DONE] Cleanup complete!
echo.
echo You can now run JARVIS_Launcher.bat
echo.
pause
