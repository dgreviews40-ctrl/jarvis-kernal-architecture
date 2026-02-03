@echo off
REM ============================================
REM  Create JARVIS Desktop Shortcut
REM ============================================

echo.
echo Creating JARVIS desktop shortcut...
echo.

set SCRIPT_DIR=%~dp0
set DESKTOP=%USERPROFILE%\Desktop
set SHORTCUT=%DESKTOP%\JARVIS.lnk

PowerShell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%SHORTCUT%'); $SC.TargetPath = '%SCRIPT_DIR%JARVIS.bat'; $SC.WorkingDirectory = '%SCRIPT_DIR%'; $SC.IconLocation = '%SCRIPT_DIR%public\favicon.svg'; $SC.Description = 'J.A.R.V.I.S. Kernel System v2.0'; $SC.Save()"

if exist "%SHORTCUT%" (
    echo [SUCCESS] Shortcut created on desktop!
    echo.
    echo You can now double-click "JARVIS" on your desktop to launch.
) else (
    echo [ERROR] Failed to create shortcut
)

echo.
pause
