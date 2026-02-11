@echo off
:: J.A.R.V.I.S. Desktop Shortcut Creator

cd /d "%~dp0"
title J.A.R.V.I.S. Shortcut Creator

cls
echo.
echo ============================================================
echo           J.A.R.V.I.S. Desktop Shortcut Creator
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "Create-Shortcut.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to create shortcut.
    pause
    exit /b 1
)

echo.
pause
exit /b 0
