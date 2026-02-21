@echo off
REM Open all download pages needed for ComfyUI setup

title Download Required Files for ComfyUI
color 0B
cls

echo.
echo  ==============================================================
echo    Download Required Files for ComfyUI
echo    GTX 1080 Ti (11GB VRAM)
echo  ==============================================================
echo.
echo  This will open all download pages in your browser.
echo  Download each file and save to the correct location.
echo.
pause
cls

:MENU
cls
echo.
echo  ==============================================================
echo    What do you need to download?
echo  ==============================================================
echo.
echo  REQUIRED (Fixes CUDA errors):
echo   [1] Visual C++ Redistributables (REQUIRED - fixes most errors!)
echo   [2] Latest NVIDIA Drivers for GTX 1080 Ti
echo.
echo  COMFYUI FILES:
echo   [3] ComfyUI Portable (AI software)
echo   [4] SD 3.5 Medium Model (7GB - best for 11GB VRAM)
echo.
echo  UTILITIES:
echo   [5] 7-Zip (to extract .7z files)
echo.
echo   [6] Open ALL download pages at once
echo   [7] Exit
echo.
set /p choice="Select option (1-7): "

if "%choice%"=="1" goto VCREDIST
if "%choice%"=="2" goto NVIDIA
if "%choice%"=="3" goto COMFYUI
if "%choice%"=="4" goto MODEL
if "%choice%"=="5" goto SEVENZIP
if "%choice%"=="6" goto ALL
if "%choice%"=="7" goto EXIT
goto MENU

:VCREDIST
echo.
echo  Opening Visual C++ Redistributables...
echo  Download: vc_redist.x64.exe
echo  Install it, then RESTART your computer!
start https://aka.ms/vc14/vc_redist.x64.exe
echo.
pause
goto MENU

:NVIDIA
echo.
echo  Opening NVIDIA driver download...
echo  Select: GeForce ^> 10 Series ^> GTX 1080 Ti ^> Windows 10/11 64-bit
echo  Download Game Ready Driver (GRD)
start https://www.nvidia.com/Download/index.aspx?lang=en-us
echo.
pause
goto MENU

:COMFYUI
echo.
echo  Opening ComfyUI download page...
echo  Download: ComfyUI_windows_portable_nvidia.7z
echo  Extract to: C:\ComfyUI
start https://github.com/comfyanonymous/ComfyUI/releases
echo.
pause
goto MENU

:MODEL
echo.
echo  Opening SD 3.5 Medium model download...
echo  File: sd3.5_medium.safetensors (~7GB)
echo  Save to: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
start https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors
echo.
pause
goto MENU

:SEVENZIP
echo.
echo  Opening 7-Zip download...
echo  Download and install 7-Zip to extract .7z files
start https://www.7-zip.org/download.html
echo.
pause
goto MENU

:ALL
echo.
echo  Opening ALL download pages...
echo.
echo  1. Visual C++ Redistributables (REQUIRED!)
start https://aka.ms/vc14/vc_redist.x64.exe
timeout /t 2 /nobreak >nul

echo  2. NVIDIA Drivers
start https://www.nvidia.com/Download/index.aspx?lang=en-us
timeout /t 2 /nobreak >nul

echo  3. ComfyUI
timeout /t 2 /nobreak >nul
start https://github.com/comfyanonymous/ComfyUI/releases

echo  4. SD 3.5 Medium Model
timeout /t 2 /nobreak >nul
start https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors

echo  5. 7-Zip
timeout /t 2 /nobreak >nul
start https://www.7-zip.org/download.html

echo.
echo  All pages opened!
echo.
echo  Installation order:
echo  1. Install Visual C++ Redistributables
echo  2. Update NVIDIA drivers
echo  3. RESTART computer
echo  4. Install 7-Zip
echo  5. Download ComfyUI and extract to C:\ComfyUI
echo  6. Download SD 3.5 model to models\checkpoints\
echo.
pause
goto MENU

:EXIT
echo.
echo  Remember:
echo  - Visual C++ Redistributables FIXES the CUDA error!
echo  - You MUST restart after installing VC Redist!
echo.
pause
exit /b 0
