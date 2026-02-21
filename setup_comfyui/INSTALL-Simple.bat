@echo off
REM Simple Installer for ComfyUI (GTX 1080 Ti - 11GB VRAM)
REM This version uses manual steps to avoid PowerShell issues

title JARVIS ComfyUI Setup - Simple Mode
color 0B
cls

echo.
echo  ==============================================================
echo.
echo    JARVIS ComfyUI Setup for GTX 1080 Ti (11GB VRAM)
echo.
echo  ==============================================================
echo.
echo  This simple installer will guide you through:
echo.
echo    1. Downloading ComfyUI Portable
echo    2. Downloading SD 3.5 Medium (7GB - best for 11GB VRAM)
echo    3. Setting up optimized launch settings
echo.
echo  Installation location: C:\ComfyUI
echo  Required free space: ~10 GB
echo.
pause
cls

:STEP1
echo.
echo  ==============================================================
echo  STEP 1: Download ComfyUI Portable
echo  ==============================================================
echo.
echo  Please download ComfyUI manually:
echo.
echo  1. Open your browser
echo  2. Go to: https://github.com/comfyanonymous/ComfyUI/releases
echo  3. Download: ComfyUI_windows_portable_nvidia.7z
echo.
echo  Note: The file is about 2GB
echo.
choice /C YN /M "Open download page now"
if %errorlevel%==1 start https://github.com/comfyanonymous/ComfyUI/releases
echo.
echo  After downloading:
echo  1. Install 7-Zip from https://www.7-zip.org/ (if not installed)
echo  2. Right-click the .7z file -^> 7-Zip -^> Extract to C:\ComfyUI
echo.
pause

:STEP2
echo.
echo  ==============================================================
echo  STEP 2: Download AI Model (SD 3.5 Medium)
echo  ==============================================================
echo.
echo  This is the BEST model for 11GB VRAM!
echo.
echo  Model: SD 3.5 Medium
echo  Size: ~7GB
echo  Quality: Excellent
echo  VRAM Usage: ~9-10GB (fits in 11GB!)
echo.
echo  Download URL:
echo  https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors
echo.
choice /C YN /M "Open model download page now"
if %errorlevel%==1 start https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors
echo.
echo  Save the file to:
echo  C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
pause

:STEP3
echo.
echo  ==============================================================
echo  STEP 3: Create Optimized Launcher
echo  ==============================================================
echo.
echo  We need to create a special launcher for 11GB VRAM.
echo.
echo  Creating: C:\ComfyUI\ComfyUI_windows_portable\run_nvidia_gpu_11gb.bat
echo.

set "COMFY_PATH=C:\ComfyUI\ComfyUI_windows_portable"
set "BAT_FILE=%COMFY_PATH%\run_nvidia_gpu_11gb.bat"

if not exist "%COMFY_PATH%" (
    echo  ERROR: ComfyUI folder not found!
    echo  Please make sure you extracted ComfyUI to C:\ComfyUI
    pause
    goto STEP1
)

(
echo @echo off
echo REM ComfyUI Launcher for 11GB VRAM (GTX 1080 Ti)
echo cd /d "%%~dp0"
echo echo ==========================================
echo echo  ComfyUI - 11GB VRAM Optimized
echo echo ==========================================
echo echo.
echo echo Using flags: --normalvram --fp16-vae --dont-upcast-attention
echo echo.
echo ..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention --preview-method auto
echo pause
) > "%BAT_FILE%"

echo  Done! Created: %BAT_FILE%
echo.

:STEP4
echo.
echo  ==============================================================
echo  STEP 4: Create Desktop Shortcut
echo  ==============================================================
echo.
echo  Creating desktop shortcut...
echo.

set "SHORTCUT=%USERPROFILE%\Desktop\ComfyUI-11GB.lnk"
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT%'); $Shortcut.TargetPath = '%BAT_FILE%'; $Shortcut.WorkingDirectory = '%COMFY_PATH%'; $Shortcut.Description = 'ComfyUI for GTX 1080 Ti (11GB)'; $Shortcut.Save()"

echo  Created: %SHORTCUT%
echo.

:COMPLETE
echo.
echo  ==============================================================
echo                         SETUP COMPLETE!
echo  ==============================================================
echo.
echo  NEXT STEPS:
echo.
echo  1. Double-click 'ComfyUI-11GB' on your desktop
echo  2. Wait for: 'To see the GUI go to: http://127.0.0.1:8188'
echo  3. Start JARVIS
echo  4. Say: 'Generate an image of a workshop'
echo.
echo  EXPECTED PERFORMANCE (GTX 1080 Ti):
echo    - 1024x1024 images: ~25-35 seconds each
echo    - VRAM usage: ~9-10GB (fits in your 11GB!)
echo.
echo  ==============================================================
echo.
echo  If you have issues, check:
echo    - docs/LOCAL_IMAGE_GENERATION.md
echo    - GTX_1080_Ti_SETUP.md
echo.
pause
