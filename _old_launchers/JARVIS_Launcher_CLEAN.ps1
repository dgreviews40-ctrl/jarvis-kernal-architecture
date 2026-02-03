<#
.SYNOPSIS
    J.A.R.V.I.S. Kernel System Launcher v2.0
    
.DESCRIPTION
    Professional launcher for the JARVIS AI Assistant system.
    Manages all required services, monitors system health, and provides
    graceful startup/shutdown with comprehensive error handling.
    
.NOTES
    Author:  Dan
    Version: 2.0.0
    Date:    2025-02-01
    
.FUNCTIONALITY
    - Pre-flight system checks
    - Automated service orchestration
    - Health monitoring and diagnostics
    - Graceful shutdown on browser close
    - Comprehensive error logging
#>

#Requires -Version 5.1

# ============================================
# CONFIGURATION
# ============================================

$script:Config = @{
    Version = "2.0.0"
    JarvisUrl = "http://localhost:3000"
    HardwareMonitorUrl = "http://localhost:3100"
    ProxyUrl = "http://localhost:3101"
    PiperUrl = "http://localhost:5000"
    StartupTimeout = 45  # seconds
    CheckInterval = 1    # seconds
}

$script:Services = @{
    Vite = $null
    Hardware = $null
    Proxy = $null
    Piper = $null
}

# ============================================
# UTILITY FUNCTIONS
# ============================================

function Write-JarvisLog {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
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
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Cyan
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘        J.A.R.V.I.S. KERNEL SYSTEM v$($Config.Version)       â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘        Just A Rather Very Intelligent System       â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Cyan
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Cyan
    Write-Host ""
}

function Test-ServiceHealth {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Url,
        
        [Parameter(Mandatory=$false)]
        [int]$TimeoutSeconds = 2
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Stop-JarvisServices {
    Write-JarvisLog "Initiating service shutdown..." -Level SYSTEM
    
    # Stop all Node processes
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-JarvisLog "Terminated $($nodeProcesses.Count) Node.js process(es)" -Level SUCCESS
    }
    
    # Stop Python (Piper) processes
    $pythonProcesses = Get-Process -Name python -ErrorAction SilentlyContinue
    if ($pythonProcesses) {
        $pythonProcesses | Stop-Process -Force
        Write-JarvisLog "Terminated $($pythonProcesses.Count) Python process(es)" -Level SUCCESS
    }
    
    Start-Sleep -Seconds 1
}

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

function Test-Prerequisites {
    Write-JarvisLog "Running pre-flight system diagnostics..." -Level SYSTEM
    
    # Get script directory
    $script:ScriptDir = Split-Path -Parent $MyInvocation.ScriptName
    Set-Location $ScriptDir
    Write-JarvisLog "Working directory: $ScriptDir" -Level INFO
    
    # Check package.json
    if (-not (Test-Path "package.json")) {
        Write-JarvisLog "package.json not found in current directory" -Level ERROR
        Write-JarvisLog "Expected: $ScriptDir\package.json" -Level ERROR
        return $false
    }
    Write-JarvisLog "package.json verified" -Level SUCCESS
    
    # Check node_modules
    if (-not (Test-Path "node_modules")) {
        Write-JarvisLog "node_modules directory not found" -Level ERROR
        Write-JarvisLog "Please run: npm install" -Level WARNING
        return $false
    }
    Write-JarvisLog "node_modules verified" -Level SUCCESS
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw }
        Write-JarvisLog "Node.js $nodeVersion detected" -Level SUCCESS
    } catch {
        Write-JarvisLog "Node.js not found or not in PATH" -Level ERROR
        Write-JarvisLog "Install from: https://nodejs.org/" -Level WARNING
        return $false
    }
    
    # Check npm
    try {
        $npmVersion = npm --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw }
        Write-JarvisLog "npm $npmVersion detected" -Level SUCCESS
    } catch {
        Write-JarvisLog "npm not found or not in PATH" -Level ERROR
        return $false
    }
    
    return $true
}

# ============================================
# SERVICE MANAGEMENT
# ============================================

function Start-ViteServer {
    Write-JarvisLog "Initializing Vite Development Server..." -Level SYSTEM
    
    try {
        $process = Start-Process -FilePath "cmd.exe" `
                                           -ArgumentList "/k", "npm run dev" `
                                           -PassThru `
                                           -WindowStyle Minimized
        
        $script:Services.Vite = $process
        Write-JarvisLog "Vite server process started (PID: $($process.Id))" -Level SUCCESS
        return $true
    } catch {
        Write-JarvisLog "Failed to start Vite server: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Start-HardwareMonitor {
    if (-not (Test-Path "server\hardware-monitor.cjs")) {
        Write-JarvisLog "Hardware monitor not found - skipping" -Level WARNING
        return $true
    }
    
    Write-JarvisLog "Starting Hardware Monitor service..." -Level SYSTEM
    
    try {
        $process = Start-Process -FilePath "cmd.exe" `
                                   -ArgumentList "/k", "node server\hardware-monitor.cjs" `
                                   -PassThru `
                                   -WindowStyle Minimized
        
        $script:Services.Hardware = $process
        Write-JarvisLog "Hardware monitor started (PID: $($process.Id))" -Level SUCCESS
        return $true
    } catch {
        Write-JarvisLog "Failed to start hardware monitor: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Start-ProxyServer {
    if (-not (Test-Path "server\proxy.js")) {
        Write-JarvisLog "Proxy server not found - skipping" -Level WARNING
        return $true
    }
    
    Write-JarvisLog "Starting Home Assistant Proxy..." -Level SYSTEM
    
    try {
        $process = Start-Process -FilePath "cmd.exe" `
                                   -ArgumentList "/k", "node server\proxy.js" `
                                   -PassThru `
                                   -WindowStyle Minimized
        
        $script:Services.Proxy = $process
        Write-JarvisLog "Proxy server started (PID: $($process.Id))" -Level SUCCESS
        return $true
    } catch {
        Write-JarvisLog "Failed to start proxy server: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Start-PiperTTS {
    $piperPath = "Piper\piper.exe"
    
    if (-not (Test-Path $piperPath)) {
        Write-JarvisLog "Piper TTS not installed - voice features disabled" -Level WARNING
        return $true
    }
    
    Write-JarvisLog "Starting Piper TTS Voice Server..." -Level SYSTEM
    
    try {
        $process = Start-Process -FilePath "cmd.exe" `
                                   -ArgumentList "/k cd Piper & piper.exe --port 5000" `
                                   -PassThru `
                                   -WindowStyle Minimized
        
        $script:Services.Piper = $process
        Write-JarvisLog "Piper TTS started (PID: $($process.Id))" -Level SUCCESS
        return $true
    } catch {
        Write-JarvisLog "Failed to start Piper TTS: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Wait-ForViteServer {
    Write-JarvisLog "Waiting for Vite server to become ready..." -Level SYSTEM
    
    $attempts = 0
    $maxAttempts = $Config.StartupTimeout
    
    while ($attempts -lt $maxAttempts) {
        $attempts++
        Start-Sleep -Seconds $Config.CheckInterval
        
        if (Test-ServiceHealth -Url $Config.JarvisUrl) {
            Write-JarvisLog "Vite server is online and responding" -Level SUCCESS
            return $true
        }
        
        if ($attempts % 5 -eq 0) {
            Write-JarvisLog "Still waiting... ($attempts of $maxAttempts seconds)" -Level INFO
        }
    }
    
    Write-JarvisLog "Vite server failed to respond after $maxAttempts seconds" -Level ERROR
    Write-JarvisLog "Check the Vite server window for error messages" -Level WARNING
    return $false
}

# ============================================
# BROWSER MANAGEMENT
# ============================================

function Start-JarvisBrowser {
    Write-JarvisLog "Launching JARVIS interface..." -Level SYSTEM
    
    # Find Chrome installation
    $chromePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    
    $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    try {
        if ($chromePath) {
            Write-JarvisLog "Opening in Chrome (app mode)" -Level SUCCESS
            $browser = Start-Process -FilePath $chromePath `
                                      -ArgumentList "--app=$($Config.JarvisUrl)", `
                                                    "--window-size=1920,1080", `
                                                    "--disable-features=TranslateUI" `
                                      -PassThru `
                                      -Wait
        } else {
            Write-JarvisLog "Chrome not found - opening in Microsoft Edge (app mode)" -Level WARNING
            $browser = Start-Process -FilePath "msedge" `
                                      -ArgumentList "--app=$($Config.JarvisUrl)", `
                                                    "--window-size=1920,1080" `
                                      -PassThru `
                                      -Wait
        }
        
        return $true
    } catch {
        Write-JarvisLog "Failed to launch browser: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

function Start-JarvisSystem {
    Show-JarvisHeader
    
    # Pre-flight checks
    if (-not (Test-Prerequisites)) {
        Write-JarvisLog "Pre-flight checks failed - cannot continue" -Level ERROR
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-JarvisLog "All pre-flight checks passed" -Level SUCCESS
    Write-Host ""
    
    # Cleanup old processes
    Write-JarvisLog "Cleaning up previous instances..." -Level SYSTEM
    Stop-JarvisServices
    Write-Host ""
    
    # Start all services
    Write-JarvisLog "Initializing JARVIS kernel services..." -Level SYSTEM
    Write-Host ""
    
    if (-not (Start-PiperTTS)) {
        Write-JarvisLog "Warning: Voice service unavailable" -Level WARNING
    }
    
    Start-Sleep -Seconds 1
    
    if (-not (Start-HardwareMonitor)) {
        Write-JarvisLog "Warning: Hardware monitoring unavailable" -Level WARNING
    }
    
    Start-Sleep -Seconds 1
    
    if (-not (Start-ProxyServer)) {
        Write-JarvisLog "Warning: Home Assistant proxy unavailable" -Level WARNING
    }
    
    Start-Sleep -Seconds 1
    
    if (-not (Start-ViteServer)) {
        Write-JarvisLog "Critical: Failed to start main web server" -Level ERROR
        Stop-JarvisServices
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    
    Write-Host ""
    
    # Wait for server
    if (-not (Wait-ForViteServer)) {
        Write-JarvisLog "Server startup timeout - check error messages above" -Level ERROR
        Stop-JarvisServices
        Read-Host "`nPress Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Green
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Green
    Write-Host "  â•‘           ALL SYSTEMS OPERATIONAL                  â•‘" -ForegroundColor Green
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Green
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Green
    Write-Host ""
    
    Write-JarvisLog "JARVIS Interface: $($Config.JarvisUrl)" -Level INFO
    if ($Services.Hardware) {
        Write-JarvisLog "Hardware Monitor: $($Config.HardwareMonitorUrl)" -Level INFO
    }
    if ($Services.Proxy) {
        Write-JarvisLog "HA Proxy: $($Config.ProxyUrl)" -Level INFO
    }
    if ($Services.Piper) {
        Write-JarvisLog "Voice Server: $($Config.PiperUrl)" -Level INFO
    }
    
    Write-Host ""
    
    # Launch browser
    Start-JarvisBrowser
    
    # Browser closed - cleanup
    Write-Host ""
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Yellow
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Yellow
    Write-Host "  â•‘              INITIATING SHUTDOWN                   â•‘" -ForegroundColor Yellow
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Yellow
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Yellow
    Write-Host ""
    
    Stop-JarvisServices
    
    Write-Host ""
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Cyan
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘           SHUTDOWN COMPLETE - GOODBYE              â•‘" -ForegroundColor Cyan
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Cyan
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Cyan
    Write-Host ""
    
    Start-Sleep -Seconds 2
}

# ============================================
# ENTRY POINT
# ============================================

try {
    Start-JarvisSystem
} catch {
    Write-Host ""
    Write-Host "  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—" -ForegroundColor Red
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Red
    Write-Host "  â•‘           CRITICAL ERROR OCCURRED                  â•‘" -ForegroundColor Red
    Write-Host "  â•‘                                                    â•‘" -ForegroundColor Red
    Write-Host "  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Yellow
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    Write-Host ""
    
    Stop-JarvisServices
    
    Read-Host "Press Enter to exit"
    exit 1
}

