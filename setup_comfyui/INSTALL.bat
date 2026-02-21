@echo off
REM JARVIS ComfyUI Installer for GTX 1080 Ti (11GB VRAM)
REM This script will guide you through installing ComfyUI

title JARVIS ComfyUI Setup
color 0B

echo.
echo  ==============================================================
echo.
echo    JARVIS ComfyUI Setup for GTX 1080 Ti (11GB VRAM)
echo.
echo  ==============================================================
echo.
echo  Choose installation method:
echo.
echo  [1] Simple Mode - Guided manual download (RECOMMENDED)
echo  [2] Fixed PowerShell Script - If you want to try automation
echo.
choice /C 12 /M "Select option"

if %errorlevel%==1 goto SIMPLE
if %errorlevel%==2 goto POWERSHELL

:SIMPLE
call "%~dp0INSTALL-Simple.bat"
goto END

:POWERSHELL
echo.
echo  Running PowerShell setup script...
echo  (This may have issues - use Simple Mode if it fails)
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Setup-ComfyUI-11GB-Fixed.ps1" -Model sd3.5_medium
goto END

:END
echo.
echo  Setup process completed!
echo.
pause
