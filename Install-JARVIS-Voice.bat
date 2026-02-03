@echo off
setlocal EnableDelayedExpansion
title JARVIS Voice Setup
echo.
echo ========================================
echo   JARVIS Piper Voice Setup
echo ========================================
echo.
echo This will install Piper TTS with the JARVIS voice.
echo Installation directory: %USERPROFILE%\Piper
echo.
pause

:: Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

echo.
echo Script location: %SCRIPT_DIR%
echo.

:: Check if PowerShell is available
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: PowerShell not found. Please install PowerShell.
    pause
    exit /b 1
)

:: Check if the PowerShell script exists
set "PS_SCRIPT=%SCRIPT_DIR%\installer\setup-piper-jarvis.ps1"
if not exist "%PS_SCRIPT%" (
    echo ERROR: Could not find setup script at:
    echo %PS_SCRIPT%
    echo.
    echo Please make sure you're running this from the correct folder.
    pause
    exit /b 1
)

:: Run the setup script
echo.
echo Starting installation...
echo.

powershell -ExecutionPolicy Bypass -Command "& '%PS_SCRIPT%'"

if %errorlevel% neq 0 (
    echo.
    echo Installation failed. Check the error messages above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Would you like to start the JARVIS voice server now?
echo.
choice /C YN /M "Start server"

if %errorlevel% == 1 (
    echo.
    echo Starting JARVIS voice server...
    start "" "%USERPROFILE%\Piper\start-jarvis-server.bat"
    echo.
    echo Server starting in a new window.
    echo Keep that window open while using JARVIS.
)

echo.
echo ========================================
echo   NEXT STEPS:
echo ========================================
echo.
echo 1. If you didn't start the server, run:
echo    %USERPROFILE%\Piper\start-jarvis-server.bat
echo.
echo 2. Open JARVIS and go to Settings - Voice
echo.
echo 3. Select "Piper Local" as the voice type
echo.
echo 4. Test the voice!
echo.
pause
