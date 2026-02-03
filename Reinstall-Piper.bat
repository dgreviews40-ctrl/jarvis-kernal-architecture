@echo off
echo ========================================
echo   Reinstalling Piper with espeak-ng data
echo ========================================
echo.

cd /d "%~dp0"

set PIPER_DIR=%CD%\Piper

echo Creating Piper directory...
mkdir "%PIPER_DIR%" 2>nul
cd /d "%PIPER_DIR%"

echo.
echo Downloading Piper...
curl -L -o piper.zip "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"

if errorlevel 1 (
    echo ERROR: Failed to download Piper
    pause
    exit /b 1
)

echo Extracting...
tar -xzf piper.zip

if errorlevel 1 (
    echo ERROR: Failed to extract
    pause
    exit /b 1
)

del piper.zip

echo.
echo Moving files from subdirectory...
for /d %%D in (*) do (
    if exist "%%D\piper.exe" (
        echo Found piper in: %%D
        move "%%D\*" . >nul 2>&1
        rmdir "%%D" 2>nul
    )
)

echo.
echo Creating voices directory...
mkdir voices 2>nul

echo.
echo ========================================
echo   Piper reinstalled successfully!
echo ========================================
echo.
echo Now run Install-JARVIS-Voice.bat to download the voice.
echo.
pause
