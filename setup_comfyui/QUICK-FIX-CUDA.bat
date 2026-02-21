@echo off
REM Quick Fix for ComfyUI CUDA Issues (GTX 1080 Ti)
REM Run this if you get "CUDA not available" errors

title Quick CUDA Fix for ComfyUI
color 0A
cls

echo.
echo  ==============================================================
echo    Quick Fix: ComfyUI CUDA Not Available
echo    GTX 1080 Ti (11GB VRAM)
echo  ==============================================================
echo.
echo  Your error: "CUDA not available on this system"
echo.
echo  This usually means ONE of these is missing:
echo   1. Visual C++ Redistributables (MOST COMMON)
echo   2. Outdated NVIDIA drivers
echo.
echo  ==============================================================
echo.

:STEP1
echo  STEP 1: Install Visual C++ Redistributables
echo  ==============================================================
echo.
echo  This is REQUIRED for PyTorch/CUDA to work!
echo.
echo  Download: https://aka.ms/vc14/vc_redist.x64.exe
echo.
choice /C YN /M "Open download page now"
if %errorlevel%==1 start https://aka.ms/vc14/vc_redist.x64.exe
echo.
echo  Instructions:
echo  1. Download vc_redist.x64.exe from the link above
echo  2. Run it and click "Install"
echo  3. Wait for installation to complete
echo  4. RESTART your computer
echo.
echo  Have you installed VC Redist and restarted? (Required to continue)
choice /C YN /M "Continue"
if %errorlevel%==2 goto CHECK_DRIVER_ANYWAY

:STEP2
echo.
echo  STEP 2: Update NVIDIA Drivers (if needed)
echo  ==============================================================
echo.
echo  Let's check your current driver version...
echo.
nvidia-smi >nul 2>&1
if %errorlevel%==0 (
    echo  ✓ NVIDIA drivers found!
    echo.
    nvidia-smi | findstr "Driver Version"
    echo.
    echo  For GTX 1080 Ti, you should have driver 527.41 or later.
    echo.
    choice /C YN /M "Do you want to update to latest drivers anyway"
    if %errorlevel%==1 (
        start https://www.nvidia.com/Download/index.aspx?lang=en-us
        echo.
        echo  Download and install the latest Game Ready Driver for GTX 1080 Ti
        echo  Then RESTART your computer.
    )
) else (
    echo  ✗ NVIDIA drivers NOT found!
    echo.
    echo  You MUST install NVIDIA drivers for your GTX 1080 Ti.
    echo.
    choice /C YN /M "Open NVIDIA driver download page"
    if %errorlevel%==1 (
        start https://www.nvidia.com/Download/index.aspx?lang=en-us
        echo.
        echo  Select:
        echo   Product Type: GeForce
        echo   Product Series: GeForce 10 Series
        echo   Product: GeForce GTX 1080 Ti
        echo   Operating System: Windows 10 64-bit (or Windows 11)
        echo.
        echo  Download and install the Game Ready Driver.
        echo  Then RESTART your computer.
    )
)

:STEP3
echo.
echo  STEP 3: Test ComfyUI
echo  ==============================================================
echo.
echo  After installing VC Redist (and optionally updating drivers):
echo  1. RESTART your computer
echo  2. Try running ComfyUI again
echo.
echo  To test, run: run_nvidia_gpu_11gb.bat
echo.

:TEST_NOW
choice /C YNT /M "Test ComfyUI now (T to test without restarting)"
if %errorlevel%==3 goto TEST_COMFYUI
if %errorlevel%==2 goto END
if %errorlevel%==1 (
    echo.
    echo  Please restart your computer first, then run ComfyUI.
    echo.
    goto END
)

:TEST_COMFYUI
echo.
echo  Testing ComfyUI...
echo.
cd /d "C:\ComfyUI\ComfyUI_windows_portable" 2>nul
if %errorlevel% neq 0 (
    echo  ✗ ComfyUI folder not found at C:\ComfyUI
    echo    Please install ComfyUI first.
    pause
    goto END
)

echo  Running Python CUDA check...
python_embeded\python.exe -c "import torch; print('CUDA Available:', torch.cuda.is_available())"
if %errorlevel%==0 (
    echo.
    echo  If it shows "CUDA Available: True", you're good to go!
    echo  If it shows "CUDA Available: False", you need to install VC Redist.
) else (
    echo.
    echo  Error running test. Make sure ComfyUI is installed.
)
echo.

:END
echo  ==============================================================
echo  Summary
echo  ==============================================================
echo.
echo  To fix your CUDA issue:
echo.
echo  1. Download and install:
echo     https://aka.ms/vc14/vc_redist.x64.exe
echo.
echo  2. (Optional but recommended) Update NVIDIA drivers:
echo     https://www.nvidia.com/Download/index.aspx
echo.
echo  3. RESTART your computer
echo.
echo  4. Run ComfyUI: run_nvidia_gpu_11gb.bat
echo.
echo  ==============================================================
echo.
pause
