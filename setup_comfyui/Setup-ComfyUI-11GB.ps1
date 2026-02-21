# JARVIS ComfyUI Setup Script for GTX 1080 Ti (11GB VRAM)
# Run this script as Administrator

param(
    [string]$InstallPath = "C:\ComfyUI",
    [string]$Model = "sd3.5_medium"  # Options: sd3.5_medium, realvisxl, sdxl_base, sd15
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔══════════════════════════════════════════════════════════════════╗
║     JARVIS ComfyUI Setup for GTX 1080 Ti (11GB VRAM)            ║
╚══════════════════════════════════════════════════════════════════╝

This script will:
1. Download ComfyUI portable (if not exists)
2. Download the recommended AI model for 11GB VRAM
3. Configure launch settings for your GPU
4. Set up JARVIS integration

Install Path: $InstallPath
Model: $Model

"@ -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Warning "This script is not running as Administrator. Some features may not work properly."
    Write-Host "Consider running PowerShell as Administrator for best results." -ForegroundColor Yellow
    Write-Host ""
}

# Create install directory
if (-not (Test-Path $InstallPath)) {
    Write-Host "Creating directory: $InstallPath" -ForegroundColor Green
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Check if ComfyUI already exists
$comfyUIExists = Test-Path "$InstallPath\main.py"

if (-not $comfyUIExists) {
    Write-Host "`n[1/4] Downloading ComfyUI Portable..." -ForegroundColor Cyan
    Write-Host "This may take a few minutes depending on your connection..." -ForegroundColor Gray
    
    $comfyUIUrl = "https://github.com/comfyanonymous/ComfyUI/releases/download/latest/ComfyUI_windows_portable_nvidia.7z"
    $downloadPath = "$env:TEMP\ComfyUI_windows_portable_nvidia.7z"
    
    try {
        # Download using BITS for reliability
        Start-BitsTransfer -Source $comfyUIUrl -Destination $downloadPath -DisplayName "Downloading ComfyUI"
        Write-Host "✓ Download complete" -ForegroundColor Green
        
        # Extract using 7-Zip (check if available)
        $sevenZip = Get-Command 7z -ErrorAction SilentlyContinue
        if (-not $sevenZip) {
            Write-Host "7-Zip not found. Please install 7-Zip or extract manually to: $InstallPath" -ForegroundColor Red
            Write-Host "Download location: $downloadPath" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Extracting ComfyUI..." -ForegroundColor Gray
        & 7z x $downloadPath -o"$InstallPath" -y | Out-Null
        Write-Host "✓ Extraction complete" -ForegroundColor Green
        
        # Clean up
        Remove-Item $downloadPath -Force
        
    } catch {
        Write-Error "Failed to download/extract ComfyUI: $_"
        exit 1
    }
} else {
    Write-Host "`n[1/4] ComfyUI already installed at $InstallPath" -ForegroundColor Green
}

# Create models directory
$modelsDir = "$InstallPath\ComfyUI_windows_portable\ComfyUI\models\checkpoints"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

# Download Model
Write-Host "`n[2/4] Setting up AI Model for 11GB VRAM..." -ForegroundColor Cyan

$modelUrls = @{
    "sd3.5_medium" = @{
        Url = "https://huggingface.co/stabilityai/stable-diffusion-3.5-medium/resolve/main/sd3.5_medium.safetensors"
        FileName = "sd3.5_medium.safetensors"
        Size = "~7GB"
        Description = "SD 3.5 Medium - Best for 11GB VRAM"
    }
    "realvisxl" = @{
        Url = "https://civitai.com/api/download/models/126598"
        FileName = "RealVisXL_V5.0.safetensors"
        Size = "~7GB"
        Description = "RealVisXL V5.0 - Best for portraits"
    }
    "sdxl_base" = @{
        Url = "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
        FileName = "sd_xl_base_1.0.safetensors"
        Size = "~7GB"
        Description = "SDXL Base 1.0 - Reliable fallback"
    }
    "sd15" = @{
        Url = "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"
        FileName = "v1-5-pruned-emaonly.safetensors"
        Size = "~4GB"
        Description = "SD 1.5 - Fastest option"
    }
}

$selectedModel = $modelUrls[$Model]
$modelPath = "$modelsDir\$($selectedModel.FileName)"

if (-not (Test-Path $modelPath)) {
    Write-Host "Model: $($selectedModel.Description)" -ForegroundColor White
    Write-Host "Size: $($selectedModel.Size)" -ForegroundColor Gray
    Write-Host "Downloading to: $modelPath" -ForegroundColor Gray
    Write-Host "`nThis will take 10-30 minutes depending on your connection..." -ForegroundColor Yellow
    
    try {
        # Use Invoke-WebRequest with progress
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $selectedModel.Url -OutFile $modelPath -UseBasicParsing
        Write-Host "✓ Model download complete" -ForegroundColor Green
    } catch {
        Write-Error "Failed to download model: $_"
        Write-Host "`nYou can manually download from:" -ForegroundColor Yellow
        Write-Host $selectedModel.Url -ForegroundColor Cyan
        exit 1
    }
} else {
    Write-Host "✓ Model already exists: $($selectedModel.FileName)" -ForegroundColor Green
}

# Configure launch scripts for 11GB VRAM
Write-Host "`n[3/4] Configuring for 11GB VRAM (GTX 1080 Ti)..." -ForegroundColor Cyan

$comfyUIPath = "$InstallPath\ComfyUI_windows_portable"
$originalBat = "$comfyUIPath\run_nvidia_gpu.bat"
$optimizedBat = "$comfyUIPath\run_nvidia_gpu_11gb.bat"

# Create optimized batch file for 11GB VRAM
$batContent = @"
@echo off
REM ComfyUI Launcher for 11GB VRAM (GTX 1080 Ti, RTX 3060, etc.)
REM Optimized flags to prevent OOM errors

cd /d "%~dp0"

echo ==========================================
echo  ComfyUI - 11GB VRAM Optimized
echo ==========================================
echo.
echo Using flags: --normalvram --fp16-vae --dont-upcast-attention
echo.

..\..\python_embeded\python.exe main.py^
  --normalvram^
  --fp16-vae^
  --dont-upcast-attention^
  --preview-method auto^
  %*

pause
"@

Set-Content -Path $optimizedBat -Value $batContent -Encoding ASCII
Write-Host "✓ Created: run_nvidia_gpu_11gb.bat" -ForegroundColor Green

# Create a desktop shortcut
Write-Host "`n[4/4] Creating shortcuts..." -ForegroundColor Cyan

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\ComfyUI (11GB VRAM).lnk")
$Shortcut.TargetPath = $optimizedBat
$Shortcut.WorkingDirectory = $comfyUIPath
$Shortcut.IconLocation = "$comfyUIPath\python_embeded\python.exe,0"
$Shortcut.Description = "ComfyUI optimized for GTX 1080 Ti (11GB VRAM)"
$Shortcut.Save()

Write-Host "✓ Created desktop shortcut" -ForegroundColor Green

# Create JARVIS integration config
$jarvisConfig = @"
# ComfyUI Configuration for JARVIS
# Auto-generated for 11GB VRAM (GTX 1080 Ti)

COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_MODEL_PATH=$modelsDir
COMFYUI_LAUNCHER=$optimizedBat

# Recommended models for 11GB VRAM:
# - sd3.5_medium.safetensors (7GB) - BEST
# - RealVisXL_V5.0.safetensors (7GB) - Portraits
# - sd_xl_base_1.0.safetensors (7GB) - General
# - v1-5-pruned-emaonly.safetensors (4GB) - Fast

# Launch flags for 11GB:
# --normalvram - Optimized memory management
# --fp16-vae - Half precision VAE (saves VRAM)
# --dont-upcast-attention - Saves attention layer memory
"@

$jarvisConfigPath = "$comfyUIPath\jarvis_config.txt"
Set-Content -Path $jarvisConfigPath -Value $jarvisConfig -Encoding ASCII

# Summary
Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                    SETUP COMPLETE!                               ║
╚══════════════════════════════════════════════════════════════════╝

📁 Installation Location: $comfyUIPath
🤖 AI Model: $($selectedModel.Description)
💾 Model Location: $modelPath
🚀 Launcher: run_nvidia_gpu_11gb.bat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 TO START COMFYUI:

   1. Double-click "ComfyUI (11GB VRAM)" on your desktop
   OR
   2. Run: $optimizedBat

   Wait for: "To see the GUI go to: http://127.0.0.1:8188"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 TO TEST WITH JARVIS:

   1. Start ComfyUI (wait for it to fully load)
   2. Start JARVIS
   3. Say: "Generate an image of a workshop"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  PERFORMANCE EXPECTATIONS (GTX 1080 Ti):

   - SD 3.5 Medium @ 1024x1024: ~25-35 seconds
   - SDXL @ 1024x1024: ~20-30 seconds
   - SD 1.5 @ 512x512: ~5-8 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 DOCUMENTATION:

   - Full guide: docs/LOCAL_IMAGE_GENERATION.md
   - 11GB guide: GTX_1080_Ti_SETUP.md
   - Troubleshooting: See docs/LOCAL_IMAGE_GENERATION.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green

Write-Host "✅ Setup complete! You're ready to generate images locally!" -ForegroundColor Green -BackgroundColor Black
Write-Host ""
Read-Host "Press Enter to exit"
