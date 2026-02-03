# JARVIS Piper Voice Setup Script for Windows
# This script automatically downloads and configures Piper with the JARVIS voice

param(
    [string]$InstallDir = "$env:USERPROFILE\Piper",
    [switch]$StartServer,
    [switch]$Silent
)

if (!$Silent) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  JARVIS Piper Voice Setup for Windows" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

# Create installation directory
if (!(Test-Path $InstallDir)) {
    if (!$Silent) { Write-Host "Creating installation directory: $InstallDir" -ForegroundColor Yellow }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Set-Location $InstallDir

# Step 1: Download Piper
if (!$Silent) { Write-Host "`n[1/4] Checking Piper installation..." -ForegroundColor Green }

$piperExe = "$InstallDir\piper.exe"
if (!(Test-Path $piperExe)) {
    if (!$Silent) { Write-Host "Piper not found. Downloading..." -ForegroundColor Yellow }
    
    $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "x86" }
    $piperUrl = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_$arch.zip"
    
    if (!$Silent) { Write-Host "Downloading from: $piperUrl" -ForegroundColor Gray }
    
    try {
        Invoke-WebRequest -Uri $piperUrl -OutFile "piper.zip" -UseBasicParsing
        if (!$Silent) { Write-Host "Extracting Piper..." -ForegroundColor Gray }
        
        # Extract to temp folder first to check structure
        $tempExtract = "$InstallDir\_temp_piper"
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
        New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
        
        Expand-Archive -Path "piper.zip" -DestinationPath $tempExtract -Force
        
        # Check if files are in a subdirectory
        $subdirs = Get-ChildItem $tempExtract -Directory
        if ($subdirs.Count -eq 1 -and (Test-Path "$($subdirs[0].FullName)\piper.exe")) {
            # Files are in a subdirectory, move them up
            Get-ChildItem $subdirs[0].FullName | Move-Item -Destination $InstallDir -Force
        } else {
            # Files are at root level
            Get-ChildItem $tempExtract | Move-Item -Destination $InstallDir -Force
        }
        
        Remove-Item $tempExtract -Recurse -Force
        Remove-Item "piper.zip"
        
        if (!$Silent) { Write-Host "SUCCESS: Piper installed!" -ForegroundColor Green }
    } catch {
        Write-Host "ERROR: Failed to download Piper: $_" -ForegroundColor Red
        Write-Host "Please download manually from: https://github.com/rhasspy/piper/releases" -ForegroundColor Yellow
        exit 1
    }
} else {
    if (!$Silent) { Write-Host "SUCCESS: Piper already installed" -ForegroundColor Green }
}

# Step 1b: Download espeak-ng data (required for Piper to work)
$espeakDataDir = "$InstallDir\espeak-ng-data"
if (!(Test-Path $espeakDataDir)) {
    if (!$Silent) { Write-Host "Downloading espeak-ng data (required for voice synthesis)..." -ForegroundColor Gray }
    
    try {
        # Download espeak-ng data from piper-phonemize release
        $espeakUrl = "https://github.com/rhasspy/piper-phonemize/releases/download/v1.2.0/espeak-ng-data.tar.gz"
        Invoke-WebRequest -Uri $espeakUrl -OutFile "$InstallDir\espeak-ng-data.tar.gz" -UseBasicParsing
        
        # Extract using tar (built into Windows 10+)
        tar -xzf "$InstallDir\espeak-ng-data.tar.gz" -C $InstallDir
        Remove-Item "$InstallDir\espeak-ng-data.tar.gz"
        
        if (!$Silent) { Write-Host "SUCCESS: espeak-ng data installed!" -ForegroundColor Green }
    } catch {
        if (!$Silent) { Write-Host "WARNING: Could not download espeak-ng data automatically." -ForegroundColor Yellow }
        if (!$Silent) { Write-Host "         Piper may not work correctly." -ForegroundColor Yellow }
    }
}

# Step 2: Download Voice Model (Using Ryan - American male, high quality)
if (!$Silent) { Write-Host "`n[2/4] Checking voice model..." -ForegroundColor Green }

$voicesDir = "$InstallDir\voices"
if (!(Test-Path $voicesDir)) {
    New-Item -ItemType Directory -Path $voicesDir -Force | Out-Null
}

# Using 'ryan' - American male voice, high quality, good for JARVIS-like assistant
$voiceModel = "$voicesDir\jarvis.onnx"
$voiceConfig = "$voicesDir\jarvis.onnx.json"

if (!(Test-Path $voiceModel) -or !(Test-Path $voiceConfig)) {
    if (!$Silent) { Write-Host "Voice model not found. Downloading ryan (American male, high quality)..." -ForegroundColor Yellow }
    
    # HuggingFace URLs (official Piper voices repository)
    # Using 'ryan' - American male, high quality (~120MB)
    $modelUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx"
    $configUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json"
    
    try {
        if (!$Silent) { Write-Host "Downloading voice model (~120MB, this may take a few minutes)..." -ForegroundColor Gray }
        Invoke-WebRequest -Uri $modelUrl -OutFile $voiceModel -UseBasicParsing -TimeoutSec 300
        
        if (!$Silent) { Write-Host "Downloading voice config..." -ForegroundColor Gray }
        Invoke-WebRequest -Uri $configUrl -OutFile $voiceConfig -UseBasicParsing -TimeoutSec 30
        
        if (!$Silent) { Write-Host "SUCCESS: Voice model downloaded!" -ForegroundColor Green }
    } catch {
        Write-Host "ERROR: Failed to download voice: $_" -ForegroundColor Red
        Write-Host "" -ForegroundColor Yellow
        Write-Host "MANUAL INSTALLATION:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ryan/high" -ForegroundColor White
        Write-Host "2. Download: en_US-ryan-high.onnx" -ForegroundColor White
        Write-Host "3. Download: en_US-ryan-high.onnx.json" -ForegroundColor White
        Write-Host "4. Rename them to: jarvis.onnx and jarvis.onnx.json" -ForegroundColor White
        Write-Host "5. Place in: $voicesDir" -ForegroundColor White
        exit 1
    }
} else {
    if (!$Silent) { Write-Host "SUCCESS: Voice model already exists" -ForegroundColor Green }
}

# Step 3: Create launcher scripts
if (!$Silent) { Write-Host "`n[3/4] Creating launcher scripts..." -ForegroundColor Green }

# Start server script (use jarvis as the model name for compatibility)
$startScript = '@echo off' + "`n"
$startScript += 'echo Starting JARVIS Piper Server...' + "`n"
$startScript += 'echo.' + "`n"
$startScript += "cd /d `"$InstallDir`"" + "`n"
$startScript += ".\piper.exe --http-server --model voices\jarvis.onnx --port 5000" + "`n"
$startScript += 'echo.' + "`n"
$startScript += 'echo Server stopped.' + "`n"
$startScript += 'pause' + "`n"

$startScript | Out-File -FilePath "$InstallDir\start-jarvis-server.bat" -Encoding ASCII

# Quick test script
$testScript = '@echo off' + "`n"
$testScript += 'echo Testing JARVIS voice...' + "`n"
$testScript += "cd /d `"$InstallDir`"" + "`n"
$testScript += 'echo "Hello, I am JARVIS. Your personal AI assistant." | .\piper.exe --model voices\jarvis.onnx --output_file test.wav' + "`n"
$testScript += 'if exist test.wav (' + "`n"
$testScript += '    echo Playing test audio...' + "`n"
$testScript += '    start test.wav' + "`n"
$testScript += '    timeout /t 3' + "`n"
$testScript += '    del test.wav' + "`n"
$testScript += ') else (' + "`n"
$testScript += '    echo Test failed.' + "`n"
$testScript += ')' + "`n"

$testScript | Out-File -FilePath "$InstallDir\test-jarvis-voice.bat" -Encoding ASCII

if (!$Silent) { Write-Host "SUCCESS: Launcher scripts created" -ForegroundColor Green }

# Step 4: Create README
if (!$Silent) { Write-Host "`n[4/4] Creating documentation..." -ForegroundColor Green }

$readmeLines = @(
    "JARVIS Piper Voice - Installation Complete"
    "==========================================="
    ""
    "Location: $InstallDir"
    ""
    "QUICK START:"
    "1. Start the server: Double-click 'start-jarvis-server.bat'"
    "2. In JARVIS: Settings - Voice - Select Piper Local"
    "3. Test the voice!"
    ""
    "FILES:"
    "- piper.exe           : The TTS engine"
    "- voices/jarvis.onnx  : Voice model (ryan - high quality)"
    "- start-jarvis-server.bat : Start the HTTP server"
    "- test-jarvis-voice.bat   : Quick voice test"
    ""
    "TROUBLESHOOTING:"
    "- If port 5000 is in use, edit start-jarvis-server.bat and change --port"
    "- Make sure Windows Defender isn't blocking piper.exe"
    "- Voice model must be in the 'voices' folder"
    ""
    "VOICE INFO:"
    "- Voice: ryan (American male)"
    "- Quality: High"
    "- Style: Professional, clear - good for JARVIS assistant"
    "- Source: https://huggingface.co/rhasspy/piper-voices"
    ""
    "For more voices, visit: https://huggingface.co/rhasspy/piper-voices"
)

$readmeLines | Out-File -FilePath "$InstallDir\README.txt" -Encoding ASCII

if (!$Silent) {
    Write-Host "SUCCESS: Configuration complete!" -ForegroundColor Green

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Setup Complete!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Installation Directory: $InstallDir" -ForegroundColor White
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Start the server by running:" -ForegroundColor White
    Write-Host "   $InstallDir\start-jarvis-server.bat" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. In JARVIS, go to Settings - Voice" -ForegroundColor White
    Write-Host "3. Select 'Piper Local' as the voice type" -ForegroundColor White
    Write-Host "4. Test the voice!" -ForegroundColor White
    Write-Host ""

    if ($StartServer) {
        Write-Host "Starting JARVIS server now..." -ForegroundColor Green
        Start-Process "$InstallDir\start-jarvis-server.bat"
    }

    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
