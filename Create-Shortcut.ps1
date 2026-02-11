# J.A.R.V.I.S. Desktop Shortcut Creator
# Creates a professional desktop shortcut

param(
    [switch]$Admin = $false
)

$ErrorActionPreference = "Stop"

# Get paths
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$JarvisBat = Join-Path $ScriptPath "JARVIS.bat"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "J.A.R.V.I.S..lnk"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           J.A.R.V.I.S. Desktop Shortcut Creator            " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verify JARVIS.bat exists
if (-not (Test-Path $JarvisBat)) {
    Write-Host "[ERROR] JARVIS.bat not found in: $ScriptPath" -ForegroundColor Red
    Write-Host "Please ensure this script is in the JARVIS directory." -ForegroundColor Red
    exit 1
}

Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    
    $Shortcut.TargetPath = $JarvisBat
    $Shortcut.WorkingDirectory = $ScriptPath
    $Shortcut.Description = "J.A.R.V.I.S. - Just A Rather Very Intelligent System"
    $Shortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll, 13"
    $Shortcut.WindowStyle = 1
    
    if ($Admin) {
        $Shortcut.Save()
        $bytes = [System.IO.File]::ReadAllBytes($ShortcutPath)
        $bytes[0x15] = $bytes[0x15] -bor 0x20
        [System.IO.File]::WriteAllBytes($ShortcutPath, $bytes)
        Write-Host "[OK] Shortcut configured to run as Administrator" -ForegroundColor Green
    } else {
        $Shortcut.Save()
    }
    
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "              SHORTCUT CREATED SUCCESSFULLY!                " -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Location: $ShortcutPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now launch J.A.R.V.I.S. from your desktop!" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "[ERROR] Failed to create shortcut: $_" -ForegroundColor Red
    exit 1
}

# Optional: Create Start Menu shortcut
$CreateStartMenu = Read-Host "Create Start Menu shortcut too? (Y/n)"
if ($CreateStartMenu -eq '' -or $CreateStartMenu -match '^[Yy]') {
    $StartMenuPath = [Environment]::GetFolderPath("StartMenu")
    $JarvisFolder = Join-Path $StartMenuPath "Programs\J.A.R.V.I.S."
    
    if (-not (Test-Path $JarvisFolder)) {
        New-Item -ItemType Directory -Path $JarvisFolder -Force | Out-Null
    }
    
    $StartShortcutPath = Join-Path $JarvisFolder "J.A.R.V.I.S..lnk"
    
    $StartShortcut = $WshShell.CreateShortcut($StartShortcutPath)
    $StartShortcut.TargetPath = $JarvisBat
    $StartShortcut.WorkingDirectory = $ScriptPath
    $StartShortcut.Description = "J.A.R.V.I.S. - Just A Rather Very Intelligent System"
    $StartShortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll, 13"
    $StartShortcut.Save()
    
    $UninstallPath = Join-Path $JarvisFolder "Shutdown J.A.R.V.I.S..lnk"
    $UninstallShortcut = $WshShell.CreateShortcut($UninstallPath)
    $UninstallShortcut.TargetPath = "taskkill"
    $UninstallShortcut.Arguments = '/F /FI "WINDOWTITLE eq JARVIS*" /T'
    $UninstallShortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll, 28"
    $UninstallShortcut.Save()
    
    Write-Host "[OK] Start Menu shortcuts created" -ForegroundColor Green
}

Write-Host ""
