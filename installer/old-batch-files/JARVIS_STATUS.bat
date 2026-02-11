@echo off
:: JARVIS Service Status Checker

cd /d "%~dp0"
title JARVIS Service Status
cls

echo ========================================
echo    JARVIS SERVICE STATUS
echo ========================================
echo.
echo Checking all JARVIS services...
echo.

set NODE_RUNNING=0
set PYTHON_RUNNING=0

echo [NODE SERVICES]
echo ---------------

netstat -an | findstr ":3000 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Vite (3000) - RUNNING
    set /a NODE_RUNNING+=1
) else (
    echo [  ] Vite (3000) - STOPPED
)

netstat -an | findstr ":3100 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Hardware Monitor (3100) - RUNNING
    set /a NODE_RUNNING+=1
) else (
    echo [  ] Hardware Monitor (3100) - STOPPED
)

netstat -an | findstr ":3101 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] HA Proxy (3101) - RUNNING
    set /a NODE_RUNNING+=1
) else (
    echo [  ] HA Proxy (3101) - STOPPED
)

echo.
echo [PYTHON SERVICES]
echo -----------------

netstat -an | findstr ":5000 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Piper TTS (5000) - RUNNING
    set /a PYTHON_RUNNING+=1
) else (
    echo [  ] Piper TTS (5000) - STOPPED
)

netstat -an | findstr ":5001 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Whisper STT (5001) - RUNNING
    set /a PYTHON_RUNNING+=1
) else (
    echo [  ] Whisper STT (5001) - STOPPED
)

netstat -an | findstr ":5002 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Embedding Server (5002) - RUNNING
    set /a PYTHON_RUNNING+=1
) else (
    echo [  ] Embedding Server (5002) - STOPPED
)

netstat -an | findstr ":5003 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] GPU Monitor (5003) - RUNNING
    set /a PYTHON_RUNNING+=1
) else (
    echo [  ] GPU Monitor (5003) - STOPPED
)

netstat -an | findstr ":5004 " | findstr LISTENING >nul
if %ERRORLEVEL% == 0 (
    echo [OK] Vision Server (5004) - RUNNING
    set /a PYTHON_RUNNING+=1
) else (
    echo [  ] Vision Server (5004) - STOPPED
)

echo.
echo ========================================
echo SUMMARY: %NODE_RUNNING% Node services, %PYTHON_RUNNING% Python services running
echo ========================================

if %NODE_RUNNING% == 3 (
    if %PYTHON_RUNNING% == 4 (
        echo [EXCELLENT] All services running!
    ) else (
        echo [GOOD] Core services running, Python optional
    )
) else (
    if %NODE_RUNNING% GTR 0 (
        echo [WARNING] Some Node services not running
    ) else (
        echo [CRITICAL] JARVIS is not running
    )
)

echo.
pause
