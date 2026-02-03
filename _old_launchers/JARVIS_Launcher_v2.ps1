#Requires -Version 5.1

# J.A.R.V.I.S. Kernel System Launcher v2.0
# Professional PowerShell launcher with comprehensive error handling

# Configuration
$Config = @{
    Version = "2.0.0"
    JarvisUrl = "http://localhost:3000"
    HardwareMonitorUrl = "http://localhost:3100"
    ProxyUrl = "http://localhost:3101"
    PiperUrl = "http://localhost:5000"
    StartupTimeout = 45
    CheckInterval = 1
}

$Services = @{
    Vite = $null
    Hardware = $null
    Proxy = $null
    Piper = $null
}

# Utility Functions
function Write-JarvisLog {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'SYSTEM')]
        [string]$Level = 'INFO'
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $colors = @{
        'INFO'    = 'Cyan'
        'SUCCESS' = 'Green'
        'WARNING' = 'Yellow'
        'ERROR'   = 'Red'
        'SYSTEM'  = 'Magenta'
    }
    
    $prefix = "[$timestamp] [$Level]"
    Write-Host $prefix -ForegroundColor $colors[$Level] -NoNewline
    Write-Host " $Message"
}

function Show-JarvisHeader {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                    ║" -ForegroundColor Cyan
    Write-Host "  ║        J.A.R.V.I.S. KERNEL SYSTEM v$($Config.Version)       ║" -ForegroundColor Cyan
    Write-Host "  ║                                                    ║" -ForegroundColor Cyan
    Write-Host "  ║        Just A Rather Very Intelligent System       ║" -ForegroundColor Cyan
    Write-Host "  ║                                                    ║" -ForegroundColor Cyan
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-ServiceHealth {
    param([string]$Url, [int]$TimeoutSeconds = 2)
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Stop-JarvisServices {
    Write-JarvisLog "Initiating service shutdown..." -Level SYSTEM
    
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name python -ErrorAction SilentlyContinue | Stop-Process -Force
    
    Start-Sleep -Seconds 1
    Write-JarvisLog "All services stopped" -Level SUCCESS
}

# Main Execution
try {
    Show-JarvisHeader
    
    # Get script directory
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $ScriptDir
    Write-JarvisLog "Working directory: $ScriptDir" -Level INFO
    Write-Host ""
    
    # Pre-flight checks
    Write-JarvisLog "Running pre-flight diagnostics..." -Level SYSTEM
    
    if (-not (Test-Path "package.json")) {
        Write-JarvisLog "package.json not found!" -Level ERROR
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-JarvisLog "package.json verified" -Level SUCCESS
    
    if (-not (Test-Path "node_modules")) {
        Write-JarvisLog "node_modules not found! Run: npm install" -Level ERROR
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-JarvisLog "node_modules verified" -Level SUCCESS
    
    try {
        $nodeVer = node --version 2>&1
        Write-JarvisLog "Node.js $nodeVer detected" -Level SUCCESS
    } catch {
        Write-JarvisLog "Node.js not found!" -Level ERROR
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-JarvisLog "All pre-flight checks passed" -Level SUCCESS
    Write-Host ""
    
    # Cleanup
    Write-JarvisLog "Cleaning up old processes..." -Level SYSTEM
    Stop-JarvisServices
    Write-Host ""
    
    # Start services
    Write-JarvisLog "Starting JARVIS services..." -Level SYSTEM
    Write-Host ""
    
    # Start Vite (main server)
    Write-JarvisLog "Initializing Vite Development Server..." -Level SYSTEM
    $Services.Vite = Start-Process -FilePath "cmd.exe" `
                                       -ArgumentList "/k npm run dev" `
                                       -PassThru -WindowStyle Minimized
    Write-JarvisLog "Vite server started (PID: $($Services.Vite.Id))" -Level SUCCESS
    
    # Start Hardware Monitor (if exists)
    if (Test-Path "server\hardware-monitor.cjs") {
        $Services.Hardware = Start-Process -FilePath "cmd.exe" `
                                            -ArgumentList "/k node server\hardware-monitor.cjs" `
                                            -PassThru -WindowStyle Minimized
        Write-JarvisLog "Hardware Monitor started (PID: $($Services.Hardware.Id))" -Level SUCCESS
    }
    
    # Start Proxy (if exists)
    if (Test-Path "server\proxy.js") {
        $Services.Proxy = Start-Process -FilePath "cmd.exe" `
                                         -ArgumentList "/k node server\proxy.js" `
                                         -PassThru -WindowStyle Minimized
        Write-JarvisLog "Proxy Server started (PID: $($Services.Proxy.Id))" -Level SUCCESS
    }
    
    # Start Piper TTS Server (if exists)
    if (Test-Path "Piper\piper_server.py") {
        $Services.Piper = Start-Process -FilePath "cmd.exe" `
                                         -ArgumentList "/k cd Piper && python piper_server.py" `
                                         -PassThru -WindowStyle Minimized
        Write-JarvisLog "Piper TTS Server started (PID: $($Services.Piper.Id))" -Level SUCCESS
    }
    
    Write-Host ""
    Write-JarvisLog "Waiting for Vite server..." -Level SYSTEM
    
    # Wait for server
    $attempts = 0
    $maxAttempts = $Config.StartupTimeout
    $serverReady = $false
    
    while ($attempts -lt $maxAttempts) {
        $attempts++
        Start-Sleep -Seconds 1
        
        if (Test-ServiceHealth -Url $Config.JarvisUrl) {
            $serverReady = $true
            break
        }
        
        if (($attempts % 5) -eq 0) {
            Write-JarvisLog "Still waiting... ($attempts seconds)" -Level INFO
        }
    }
    
    if (-not $serverReady) {
        Write-JarvisLog "Server failed to start after $maxAttempts seconds!" -Level ERROR
        Write-JarvisLog "Check the Vite server window for errors" -Level WARNING
        Stop-JarvisServices
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                    ║" -ForegroundColor Green
    Write-Host "  ║           ALL SYSTEMS OPERATIONAL                  ║" -ForegroundColor Green
    Write-Host "  ║                                                    ║" -ForegroundColor Green
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-JarvisLog "JARVIS Interface: $($Config.JarvisUrl)" -Level INFO
    Write-Host ""
    
    # Launch browser
    Write-JarvisLog "Opening JARVIS interface..." -Level SYSTEM
    
    $chromePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    
    $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($chromePath) {
        Write-JarvisLog "Opening in Chrome (app mode)" -Level SUCCESS
        Start-Process -FilePath $chromePath `
                      -ArgumentList "--app=$($Config.JarvisUrl)","--window-size=1920,1080" `
                      -Wait
    } else {
        Write-JarvisLog "Opening in Edge (app mode)" -Level SUCCESS
        Start-Process -FilePath "msedge" `
                      -ArgumentList "--app=$($Config.JarvisUrl)","--window-size=1920,1080" `
                      -Wait
    }
    
    # Browser closed - cleanup
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "  ║                                                    ║" -ForegroundColor Yellow
    Write-Host "  ║              INITIATING SHUTDOWN                   ║" -ForegroundColor Yellow
    Write-Host "  ║                                                    ║" -ForegroundColor Yellow
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""
    
    Stop-JarvisServices
    
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                    ║" -ForegroundColor Cyan
    Write-Host "  ║           SHUTDOWN COMPLETE - GOODBYE              ║" -ForegroundColor Cyan
    Write-Host "  ║                                                    ║" -ForegroundColor Cyan
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    Start-Sleep -Seconds 2

} catch {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "  ║                                                    ║" -ForegroundColor Red
    Write-Host "  ║           CRITICAL ERROR OCCURRED                  ║" -ForegroundColor Red
    Write-Host "  ║                                                    ║" -ForegroundColor Red
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    Stop-JarvisServices
    
    Read-Host "Press Enter to exit"
    exit 1
}
