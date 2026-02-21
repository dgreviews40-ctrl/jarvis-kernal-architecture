@echo off
REM Fix CUDA Issues for ComfyUI on GTX 1080 Ti
REM This script diagnoses and helps fix CUDA/PyTorch issues

title ComfyUI CUDA Fix
color 0E
cls

echo.
echo  ==============================================================
echo    ComfyUI CUDA Troubleshooter
echo    GTX 1080 Ti (11GB VRAM)
echo  ==============================================================
echo.
echo  Detected issue: CUDA not available
echo.
echo  Common causes:
echo   1. Outdated NVIDIA drivers
echo   2. Missing Visual C++ Redistributables
echo   3. PyTorch/CUDA version mismatch
echo.
pause
cls

:MENU
cls
echo.
echo  ==============================================================
echo    CUDA Troubleshooting Menu
echo  ==============================================================
echo.
echo  [1] Check NVIDIA Driver Version
echo  [2] Download Latest NVIDIA Drivers (GTX 1080 Ti)
echo  [3] Download Visual C++ Redistributables
echo  [4] Check CUDA Installation
echo  [5] Test Python/CUDA in ComfyUI
echo  [6] Show All System Info
echo  [7] Exit
echo.
echo  ==============================================================
echo.
set /p choice="Select option (1-7): "

if "%choice%"=="1" goto CHECK_DRIVER
if "%choice%"=="2" goto DOWNLOAD_DRIVER
if "%choice%"=="3" goto DOWNLOAD_VCREDIST
if "%choice%"=="4" goto CHECK_CUDA
if "%choice%"=="5" goto TEST_PYTHON
if "%choice%"=="6" goto SYSTEM_INFO
if "%choice%"=="7" goto EXIT
goto MENU

:CHECK_DRIVER
cls
echo.
echo  ==============================================================
echo    Checking NVIDIA Driver Version
echo  ==============================================================
echo.
nvidia-smi >nul 2>&1
if %errorlevel%==0 (
    echo  ✓ NVIDIA Driver found!
    echo.
    nvidia-smi
    echo.
    echo  Look at the top right for driver version.
    echo  For GTX 1080 Ti, you need driver version 527.41 or later.
    echo.
) else (
    echo  ✗ NVIDIA Driver NOT found or not working!
    echo.
    echo  This means either:
    echo   - NVIDIA drivers are not installed
    echo   - Wrong drivers installed
    echo   - Driver installation is corrupted
    echo.
    echo  You need to install NVIDIA drivers for your GTX 1080 Ti.
    echo.
)
pause
goto MENU

:DOWNLOAD_DRIVER
cls
echo.
echo  ==============================================================
echo    Download NVIDIA Drivers for GTX 1080 Ti
echo  ==============================================================
echo.
echo  Opening NVIDIA driver download page...
echo.
echo  Product Type: GeForce
echo  Product Series: GeForce 10 Series
echo  Product: GeForce GTX 1080 Ti
echo  Operating System: Windows 10 64-bit (or Windows 11)
echo.
echo  Download the Game Ready Driver (GRD) - NOT Studio Driver
echo.
choice /C YN /M "Open NVIDIA driver download page"
if %errorlevel%==1 start https://www.nvidia.com/Download/index.aspx?lang=en-us
echo.
echo  After installing drivers, RESTART your computer!
echo.
pause
goto MENU

:DOWNLOAD_VCREDIST
cls
echo.
echo  ==============================================================
echo    Download Visual C++ Redistributables
echo  ==============================================================
echo.
echo  ComfyUI needs Visual C++ Redistributables to work.
echo.
echo  Download URL:
echo  https://aka.ms/vc14/vc_redist.x64.exe
echo.
choice /C YN /M "Open download page"
if %errorlevel%==1 start https://aka.ms/vc14/vc_redist.x64.exe
echo.
echo  Instructions:
echo  1. Download vc_redist.x64.exe
echo  2. Run it and install
echo  3. Restart your computer
echo  4. Try ComfyUI again
echo.
pause
goto MENU

:CHECK_CUDA
echo.
echo  ==============================================================
echo    Checking CUDA Installation
echo  ==============================================================
echo.
echo  Checking if CUDA toolkit is installed...
echo.
where nvcc >nul 2>&1
if %errorlevel%==0 (
    echo  ✓ CUDA toolkit found!
    nvcc --version
) else (
    echo  ℹ CUDA toolkit not found in PATH
    echo    (This is OK - ComfyUI uses its own CUDA through PyTorch)
    echo.
    echo  Checking PyTorch CUDA availability...
    cd /d "C:\ComfyUI\ComfyUI_windows_portable"
    if exist "python_embeded\python.exe" (
        python_embeded\python.exe -c "import torch; print('PyTorch version:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda if torch.cuda.is_available() else 'N/A')"
    ) else (
        echo  ✗ Python not found in ComfyUI folder
    )
)
echo.
pause
goto MENU

:TEST_PYTHON
cls
echo.
echo  ==============================================================
echo    Testing Python/CUDA in ComfyUI
echo  ==============================================================
echo.
cd /d "C:\ComfyUI\ComfyUI_windows_portable" 2>nul
if %errorlevel% neq 0 (
    echo  ✗ ComfyUI folder not found at C:\ComfyUI
    echo    Please install ComfyUI first
    pause
    goto MENU
)

echo  Running Python CUDA test...
echo.
python_embeded\python.exe -c "
import torch
print('='*50)
print('PyTorch Version:', torch.__version__)
print('CUDA Available:', torch.cuda.is_available())
if torch.cuda.is_available():
    print('CUDA Version:', torch.version.cuda)
    print('GPU Count:', torch.cuda.device_count())
    for i in range(torch.cuda.device_count()):
        print('GPU', i, ':', torch.cuda.get_device_name(i))
else:
    print('='*50)
    print('ERROR: CUDA is not available!')
    print('='*50)
    print()
    print('Possible fixes:')
    print('1. Update NVIDIA drivers')
    print('2. Install Visual C++ Redistributables')
    print('3. Reinstall ComfyUI (portable version includes CUDA)')
print('='*50)
"
echo.
pause
goto MENU

:SYSTEM_INFO
cls
echo.
echo  ==============================================================
echo    Complete System Information
echo  ==============================================================
echo.
echo  --- GPU Information ---
nvidia-smi 2>nul || echo  ✗ nvidia-smi not found (drivers not installed?)
echo.
echo  --- Windows Version ---
ver
echo.
echo  --- CPU Information ---
wmic cpu get name /value 2>nul | find "="
echo.
echo  --- Memory Information ---
wmic computersystem get TotalPhysicalMemory /value 2>nul | find "="
echo.
echo  --- ComfyUI Path Check ---
if exist "C:\ComfyUI\ComfyUI_windows_portable\main.py" (
    echo  ✓ ComfyUI found
    dir "C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\*.safetensors" 2>nul | find ".safetensors" && echo  ✓ Models found || echo  ✗ No models found
) else (
    echo  ✗ ComfyUI not found
)
echo.
pause
goto MENU

:EXIT
echo.
echo  ==============================================================
echo  Quick Fix Summary:
echo  ==============================================================
echo.
echo  Most common fix for your error:
echo.
echo  1. Install Visual C++ Redistributables:
echo     https://aka.ms/vc14/vc_redist.x64.exe
echo.
echo  2. Update NVIDIA Drivers for GTX 1080 Ti:
echo     https://www.nvidia.com/Download/index.aspx
echo.
echo  3. RESTART your computer after installing both
echo.
echo  4. Try ComfyUI again
echo.
echo  ==============================================================
echo.
pause
exit /b 0
