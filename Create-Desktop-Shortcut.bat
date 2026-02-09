@echo off
:: Create Desktop Shortcut for JARVIS

cd /d "%~dp0"

set SCRIPT="%TEMP%\CreateShortcut.vbs"
set TARGET=%CD%\JARVIS_RUN.bat
set ICON=%CD%\public\favicon.ico
set WORKING_DIR=%CD%

echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\JARVIS.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%TARGET%" >> %SCRIPT%
echo oLink.WorkingDirectory = "%WORKING_DIR%" >> %SCRIPT%
if exist "%ICON%" (
    echo oLink.IconLocation = "%ICON%" >> %SCRIPT%
)
echo oLink.Description = "JARVIS AI Assistant" >> %SCRIPT%
echo oLink.WindowStyle = "1" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo ========================================
echo Desktop shortcut created!
echo.
echo You can now launch JARVIS from your desktop.
echo.
echo NOTE: First launch may take a minute as services start up.
echo ========================================
pause
