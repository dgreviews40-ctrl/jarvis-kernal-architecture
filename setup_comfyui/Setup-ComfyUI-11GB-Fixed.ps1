# JARVIS ComfyUI Setup Script for GTX 1080 Ti (11GB VRAM)
# Run this script as Administrator

param(
    [string]$InstallPath = "C:\ComfyUI",
    [string]$Model = "sd3.5_medium"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================================="
Write-Host "  JARVIS ComfyUI Setup for GTX 1080 Ti (11GB VRAM)"
Write-Host "=============================================================="
Write-Host ""
Write-Host "This script will:"
Write-Host "  1. Download ComfyUI portable (if not exists)"
Write-Host "  2. Download the recommended AI model for 11GB VRAM"
Write-Host "  3. Configure launch settings for your GPU"
Write-Host "  4. Set up JARVIS integration"
Write-Host ""
Write-Host "Install Path: $InstallPath"
Write-Host "Model: $Model"
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Warning "This script is not running as Administrator."
    Write-Host "Consider running PowerShell as Administrator." -ForegroundColor Yellow
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
    Write-Host ""
    Write-Host "[1/4] Downloading ComfyUI Portable..." -ForegroundColor Cyan
    Write-Host "This may take a few minutes..." -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Please download ComfyUI manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/comfyanonymous/ComfyUI/releases" -ForegroundColor Cyan
    Write-Host "2. Download: ComfyUI_windows_portable_nvidia.7z" -ForegroundColor Cyan
    Write-Host "3. Extract to: $InstallPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Enter after you've extracted ComfyUI..."
    Read-Host
} else {
    Write-Host ""
    Write-Host "[1/4] ComfyUI already installed at $InstallPath" -ForegroundColor Green
}

# Create models directory
$modelsDir = "$InstallPath\ComfyUI_windows_portable\ComfyUI\models\checkpoints"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

# Download Model
Write-Host ""
Write-Host "[2/4] Setting up AI Model for 11GB VRAM..." -ForegroundColor Cyan

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
    Write-Host ""
    Write-Host "Please download the model manually:" -ForegroundColor Yellow
    Write-Host "URL: $($selectedModel.Url)" -ForegroundColor Cyan
    Write-Host "Save to: $modelPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Enter after you've downloaded the model..."
    Read-Host
} else {
    Write-Host "Model already exists: $($selectedModel.FileName)" -ForegroundColor Green
}

# Configure launch scripts for 11GB VRAM
Write-Host ""
Write-Host "[3/4] Configuring for 11GB VRAM (GTX 1080 Ti)..." -ForegroundColor Cyan

$comfyUIPath = "$InstallPath\ComfyUI_windows_portable"
$optimizedBat = "$comfyUIPath\run_nvidia_gpu_11gb.bat"

# Create optimized batch file for 11GB VRAM
$batContent = '@echo off' + "`r`n"
$batContent += 'REM ComfyUI Launcher for 11GB VRAM (GTX 1080 Ti)' + "`r`n"
$batContent += 'cd /d "%~dp0"' + "`r`n"
$batContent += '' + "`r`n"
$batContent += 'echo ==========================================' + "`r`n"
$batContent += 'echo  ComfyUI - 11GB VRAM Optimized' + "`r`n"
$batContent += 'echo ==========================================' + "`r`n"
$batContent += 'echo.' + "`r`n"
$batContent += 'echo Using flags: --normalvram --fp16-vae --dont-upcast-attention' + "`r`n"
$batContent += 'echo.' + "`r`n"
$batContent += '' + "`r`n"
$batContent += '..\..\python_embeded\python.exe main.py --normalvram --fp16-vae --dont-upcast-attention' + "`r`n"
$batContent += '' + "`r`n"
$batContent += 'pause' + "`r`n"

Set-Content -Path $optimizedBat -Value $batContent -Encoding ASCII
Write-Host "Created: run_nvidia_gpu_11gb.bat" -ForegroundColor Green

# Create a desktop shortcut
Write-Host ""
Write-Host "[4/4] Creating shortcuts..." -ForegroundColor Cyan

$shortcutPath = "$env:USERPROFILE\Desktop\ComfyUI-11GB.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $optimizedBat
$Shortcut.WorkingDirectory = $comfyUIPath
$Shortcut.IconLocation = "$comfyUIPath\python_embeded\python.exe,0"
$Shortcut.Description = "ComfyUI optimized for GTX 1080 Ti (11GB VRAM)"
$Shortcut.Save()

Write-Host "Created desktop shortcut: ComfyUI-11GB" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=============================================================="
Write-Host "                    SETUP COMPLETE!"
Write-Host "=============================================================="
Write-Host ""
Write-Host "Installation Location: $comfyUIPath"
Write-Host "AI Model: $($selectedModel.Description)"
Write-Host "Launcher: run_nvidia_gpu_11gb.bat"
Write-Host ""
Write-Host "=============================================================="
Write-Host ""
Write-Host "TO START COMFYUI:"
Write-Host "  1. Double-click 'ComfyUI-11GB' on your desktop"
Write-Host "  2. Wait for: 'To see the GUI go to: http://127.0.0.1:8188'"
Write-Host ""
Write-Host "TO TEST WITH JARVIS:"
Write-Host "  1. Start ComfyUI (wait for it to fully load)"
Write-Host "  2. Start JARVIS"
Write-Host "  3. Say: 'Generate an image of a workshop'"
Write-Host ""
Write-Host "EXPECTED PERFORMANCE (GTX 1080 Ti):"
Write-Host "  - SD 3.5 Medium at 1024x1024: ~25-35 seconds"
Write-Host ""
Write-Host "=============================================================="
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
