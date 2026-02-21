@echo off
REM Manual Download Helper for ComfyUI and Models
REM Use this if the automated installer fails

title JARVIS ComfyUI - Manual Download Helper
color 0E
cls

echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║           Manual Download Helper for ComfyUI                    ║
echo  ║              (GTX 1080 Ti - 11GB VRAM)                          ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  This script will help you download files manually.
echo.
pause
cls

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║                        DOWNLOAD MENU                             ║
echo  ╠══════════════════════════════════════════════════════════════════╣
echo  ║                                                                  ║
echo  ║   [1] Open ComfyUI Download Page (GitHub)                       ║
echo  ║   [2] Download SD 3.5 Medium Model (BEST for 11GB)              ║
echo  ║   [3] Download RealVisXL Model (Best for portraits)             ║
echo  ║   [4] Download SDXL Base Model (Reliable)                       ║
echo  ║   [5] Download SD 1.5 Model (Fastest)                           ║
echo  ║   [6] Open Models Folder                                        ║
echo  ║   [7] Show Installation Instructions                            ║
echo  ║   [8] Exit                                                      ║
echo  ║                                                                  ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto COMFYUI
if "%choice%"=="2" goto SD35MEDIUM
if "%choice%"=="3" goto REALVISXL
if "%choice%"=="4" goto SDXLBASE
if "%choice%"=="5" goto SD15
if "%choice%"=="6" goto OPENFOLDER
if "%choice%"=="7" goto INSTRUCTIONS
if "%choice%"=="8" goto EXIT
goto MENU

:COMFYUI
echo.
echo  Opening ComfyUI download page...
echo  Download: ComfyUI_windows_portable_nvidia.7z
start https://github.com/comfyanonymous/ComfyUI/releases
echo.
echo  Instructions:
echo  1. Download ComfyUI_windows_portable_nvidia.7z
echo  2. Extract to C:\ComfyUI
echo.
pause
goto MENU

:SD35MEDIUM
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║              SD 3.5 Medium (RECOMMENDED for 11GB)               ║
echo  ╠══════════════════════════════════════════════════════════════════╣
echo  ║  Size: ~7GB                                                      ║
echo  ║  VRAM: Fits in 11GB comfortably                                  ║
echo  ║  Quality: Excellent                                              ║
echo  ║  Speed: ~30 seconds per image (1024x1024)                        ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  Opening download link...
start https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors
echo.
echo  Save to: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
pause
goto MENU

:REALVISXL
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║              RealVisXL V5.0 (Best for Portraits)                ║
echo  ╠══════════════════════════════════════════════════════════════════╣
echo  ║  Size: ~7GB                                                      ║
echo  ║  VRAM: Fits in 11GB comfortably                                  ║
echo  ║  Quality: Hyper-realistic portraits                              ║
echo  ║  Speed: ~30 seconds per image (1024x1024)                        ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  Opening download page...
start https://civitai.com/models/139562/realvisxl-v50
echo.
echo  Note: You may need to create a free CivitAI account
echo.
echo  Save to: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
pause
goto MENU

:SDXLBASE
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║              SDXL Base 1.0 (Reliable Alternative)               ║
echo  ╠══════════════════════════════════════════════════════════════════╣
echo  ║  Size: ~7GB                                                      ║
echo  ║  VRAM: Fits in 11GB comfortably                                  ║
echo  ║  Quality: Very Good                                              ║
echo  ║  Speed: ~25 seconds per image (1024x1024)                        ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  Opening download link...
start https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors
echo.
echo  Save to: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
pause
goto MENU

:SD15
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║              SD 1.5 (Fastest Option)                            ║
echo  ╠══════════════════════════════════════════════════════════════════╣
echo  ║  Size: ~4GB                                                      ║
echo  ║  VRAM: Uses only ~6GB                                            ║
echo  ║  Quality: Good                                                   ║
echo  ║  Speed: ~6 seconds per image (512x512)                           ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  Opening download link...
start https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors
echo.
echo  Save to: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
pause
goto MENU

:OPENFOLDER
echo.
echo  Opening models folder...
if not exist "C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints" (
    echo  Creating folder structure...
    mkdir "C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints" 2>nul
)
start explorer "C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints"
echo.
echo  Place your downloaded .safetensors files here.
echo.
pause
goto MENU

:INSTRUCTIONS
cls
echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║              MANUAL INSTALLATION INSTRUCTIONS                    ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.
echo  STEP 1: Download ComfyUI
echo  ------------------------
echo  1. Go to: https://github.com/comfyanonymous/ComfyUI/releases
echo  2. Download: ComfyUI_windows_portable_nvidia.7z
echo  3. Extract to: C:\ComfyUI
echo.
echo  STEP 2: Download AI Model
echo  -------------------------
echo  Recommended: SD 3.5 Medium (7GB)
echo  URL: https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
echo.
echo  Download: sd3.5_medium.safetensors
echo  Place in: C:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
echo.
echo  STEP 3: Configure for 11GB VRAM
echo  -------------------------------
echo  Create file: run_nvidia_gpu_11gb.bat
echo  Location: C:\ComfyUI\ComfyUI_windows_portable\
echo.
echo  Content:
echo  @echo off
echo  cd /d "%%~dp0"
echo  ..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention
echo  pause
echo.
echo  STEP 4: Start ComfyUI
echo  --------------------
echo  Double-click: run_nvidia_gpu_11gb.bat
echo  Wait for: "To see the GUI go to: http://127.0.0.1:8188"
echo.
echo  STEP 5: Test with JARVIS
echo  ------------------------
echo  1. Make sure ComfyUI is running
echo  2. Start JARVIS
echo  3. Say: "Generate an image of a workshop"
echo.
pause
goto MENU

:EXIT
echo.
echo  Goodbye!
echo.
timeout /t 2 /nobreak >nul
exit /b 0
