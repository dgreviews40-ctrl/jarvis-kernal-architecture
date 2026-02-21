@echo off
setlocal EnableDelayedExpansion
:: ============================================================================
:: J.A.R.V.I.S. Launcher with LoRA Support
:: Starts JARVIS and ensures LoRA server is running
:: ============================================================================

cd /d "%~dp0"

:: Check for Python
echo [CHECK] Checking Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found! Please install Python first.
    pause
    exit /b 1
)
echo [OK] Python found
echo.

:: Check for peft
echo [CHECK] Checking LoRA dependencies...
python -c "import peft" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INSTALL] Installing LoRA dependencies...
    pip install peft
)
echo [OK] Dependencies ready
echo.

:: Start LoRA Server in visible window
echo [START] Starting LoRA Training Server...
echo         Window: JARVIS-LORA
echo.
start "JARVIS-LORA" cmd /c "python lora_server.py"

:: Wait for LoRA to be ready
echo [WAIT] Waiting for LoRA server...
:WaitForLoRA
    netstat -an | findstr ":5005 " | findstr LISTENING >nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] LoRA server is ready!
        goto :LoRAReady
    )
    timeout /t 1 /nobreak >nul
    goto :WaitForLoRA
:LoRAReady
echo.

:: Now start JARVIS
echo [START] Starting JARVIS main system...
echo.

:: Run the normal JARVIS.bat (minimized)
start /MIN "JARVIS-MAIN" JARVIS.bat

echo =========================================
echo JARVIS is starting with LoRA support!
echo =========================================
echo.
echo LoRA Server: http://localhost:5005
echo Dashboard:   http://localhost:3000
echo.
echo Make sure to click the brain icon (🧠) 
echo in JARVIS to open the LoRA Dashboard
echo.
pause
