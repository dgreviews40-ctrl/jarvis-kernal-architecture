@echo off
:: Emergency shutdown for all JARVIS services

cd /d "%~dp0"
title JARVIS Emergency Shutdown

echo ========================================
echo    JARVIS EMERGENCY SHUTDOWN
echo ========================================
echo.

:: Kill all JARVIS-related windows
echo [1/4] Stopping JARVIS windows...
taskkill /F /FI "WINDOWTITLE eq JARVIS-*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq JARVIS Master Controller" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Administrator: JARVIS-*" /T >nul 2>&1
echo [OK] Windows closed

:: Kill Node.js processes for JARVIS
echo [2/4] Stopping Node.js services...
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH 2^>nul') do (
    taskkill /F /PID %%~a >nul 2>&1
)

:: Kill Python processes for JARVIS
echo [3/4] Stopping Python services...
for /f "tokens=2 delims=," %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO CSV /NH 2^>nul') do (
    taskkill /F /PID %%~a >nul 2>&1
)

:: Kill by ports (clean up any stragglers)
echo [4/4] Cleaning up ports...
for %%p in (3000 3100 3101 5000 5001 5002 5003 5004) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING 2^>nul') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo ========================================
echo    ALL JARVIS SERVICES STOPPED
echo ========================================
pause
