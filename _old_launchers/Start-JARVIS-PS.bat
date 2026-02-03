@echo off
REM ============================================
REM  JARVIS PowerShell Launcher Wrapper
REM  Runs the PowerShell version which is more reliable
REM ============================================

cd /d "%~dp0"

echo Starting JARVIS via PowerShell...
echo.

PowerShell -ExecutionPolicy Bypass -File "%~dp0JARVIS_Launcher.ps1"

if ERRORLEVEL 1 (
    echo.
    echo PowerShell launcher failed!
    pause
)
