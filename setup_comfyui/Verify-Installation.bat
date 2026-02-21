@echo off
REM Verification script for ComfyUI installation
REM Checks if everything is set up correctly

title JARVIS ComfyUI - Installation Verification
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║          ComfyUI Installation Verification                       ║
echo  ║              (GTX 1080 Ti - 11GB VRAM)                          ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  Checking your installation...
echo.

set "INSTALL_PATH=C:\ComfyUI\ComfyUI_windows_portable"
set "ALL_GOOD=1"

REM Check 1: ComfyUI directory exists
echo  [1/6] Checking ComfyUI installation...
if exist "%INSTALL_PATH%\main.py" (
    echo       ✓ ComfyUI found at %INSTALL_PATH%
) else (
    echo       ✗ ComfyUI NOT found!
    echo         Expected: %INSTALL_PATH%\main.py
    set "ALL_GOOD=0"
)

REM Check 2: Python embedded exists
echo  [2/6] Checking Python runtime...
if exist "%INSTALL_PATH%\python_embeded\python.exe" (
    echo       ✓ Python runtime found
) else (
    echo       ✗ Python runtime NOT found!
    set "ALL_GOOD=0"
)

REM Check 3: Check for models
echo  [3/6] Checking AI models...
set "MODELS_PATH=%INSTALL_PATH%\ComfyUI\models\checkpoints"
set "MODEL_FOUND=0"

if exist "%MODELS_PATH%\sd3.5_medium.safetensors" (
    echo       ✓ SD 3.5 Medium found (BEST for 11GB)
    set "MODEL_FOUND=1"
)
if exist "%MODELS_PATH%\*RealVisXL*.safetensors" (
    echo       ✓ RealVisXL found
    set "MODEL_FOUND=1"
)
if exist "%MODELS_PATH%\sd_xl_base_1.0.safetensors" (
    echo       ✓ SDXL Base found
    set "MODEL_FOUND=1"
)
if exist "%MODELS_PATH%\*v1-5*.safetensors" (
    echo       ✓ SD 1.5 found
    set "MODEL_FOUND=1"
)

if %MODEL_FOUND%==0 (
    echo       ✗ No AI models found!
    echo         Place .safetensors files in: %MODELS_PATH%
    set "ALL_GOOD=0"
)

REM Check 4: Optimized launcher exists
echo  [4/6] Checking 11GB VRAM configuration...
if exist "%INSTALL_PATH%\run_nvidia_gpu_11gb.bat" (
    echo       ✓ Optimized launcher found
    echo         (run_nvidia_gpu_11gb.bat)
) else (
    echo       ⚠ Optimized launcher NOT found
    echo         Using default launcher (may cause OOM)
)

REM Check 5: Disk space
echo  [5/6] Checking disk space...
for /f "tokens=3" %%a in ('dir C:\ /-c ^| find "bytes free"') do set "FREE_SPACE=%%a"
set "FREE_SPACE_GB=%FREE_SPACE:~0,-9%"
if not defined FREE_SPACE_GB set "FREE_SPACE_GB=0"

REM Simple check - just show the space
echo       ℹ Free space on C: ~%FREE_SPACE_GB% GB

REM Check 6: GPU info
echo  [6/6] Checking GPU...
nvidia-smi >nul 2>&1
if %errorlevel%==0 (
    echo       ✓ NVIDIA GPU detected:
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>nul | findstr /C:"1080" >nul && (
        echo         GTX 1080 Ti detected! (11GB VRAM)
    ) || (
        for /f "tokens=*" %%a in ('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2^>nul') do (
            echo         %%a
        )
    )
) else (
    echo       ⚠ NVIDIA GPU not detected or drivers not installed
    echo         You may need to use CPU mode (slow)
)

echo.
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

if %ALL_GOOD%==1 (
    echo  ✅ Installation looks GOOD!
    echo.
    echo  To start ComfyUI:
    echo    1. Double-click "ComfyUI (11GB VRAM)" on your desktop
    echo    2. OR run: %INSTALL_PATH%\run_nvidia_gpu_11gb.bat
    echo.
    echo  To test with JARVIS:
    echo    1. Start ComfyUI first (wait for it to fully load)
    echo    2. Start JARVIS
    echo    3. Say: "Generate an image of a workshop"
    echo.
    echo  Expected performance (GTX 1080 Ti):
    echo    - SD 3.5 Medium @ 1024x1024: ~25-35 seconds
    echo.
) else (
    echo  ❌ Installation incomplete!
    echo.
    echo  Run the installer: INSTALL.bat
    echo  Or use manual helper: Manual-Download-Helper.bat
    echo.
)

echo.
pause
