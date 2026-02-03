# J.A.R.V.I.S. Kernel System v2.0 - Professional Launcher

## Overview

Professional-grade PowerShell launcher for the JARVIS AI Assistant system with comprehensive error handling, service orchestration, and system health monitoring.

## Features

✨ **Professional Interface**
- JARVIS-themed console output with color-coded messages
- Structured logging system (INFO, SUCCESS, WARNING, ERROR, SYSTEM)
- Beautiful ASCII art headers and status displays
- Timestamped log entries

🔧 **Robust Service Management**
- Automated startup/shutdown of all required services
- Health monitoring and diagnostics
- Graceful error handling with detailed stack traces
- Automatic cleanup of orphaned processes

🚀 **Services Managed**
- **Vite Development Server** - Main web interface (Port 3000)
- **Hardware Monitor** - Real-time system metrics (Port 3100)
- **Home Assistant Proxy** - Smart home integration (Port 3101)
- **Piper TTS** - Voice synthesis server (Port 5000)

## Quick Start

### Option 1: Double-Click Launch (Recommended)
Simply double-click **`JARVIS.bat`** to start all services.

### Option 2: PowerShell Direct
Right-click **`JARVIS_Launcher.ps1`** → "Run with PowerShell"

### Option 3: Command Line
```powershell
cd C:\Users\dman\Desktop\jarvis-kernel-architect
.\JARVIS.bat
```

## What Happens on Launch

1. **Pre-Flight Checks**
   - ✅ Verifies `package.json` exists
   - ✅ Checks `node_modules` directory
   - ✅ Validates Node.js installation
   - ✅ Validates npm installation

2. **Cleanup Phase**
   - 🧹 Terminates any existing Node.js processes
   - 🧹 Terminates any existing Python processes (Piper)
   - 🧹 Ensures clean startup state

3. **Service Initialization**
   - 🎤 Starts Piper TTS Voice Server (if installed)
   - 📊 Starts Hardware Monitor service
   - 🔌 Starts Home Assistant Proxy
   - 🌐 Starts Vite Development Server

4. **Health Check**
   - ⏱️ Waits up to 45 seconds for services to become ready
   - 🔍 Polls Vite server for HTTP 200 response
   - 📝 Logs progress every 5 seconds

5. **Browser Launch**
   - 🌟 Opens JARVIS in Chrome app mode (borderless window)
   - 🌟 Falls back to Edge if Chrome not found
   - 📐 Window size: 1920x1080

6. **Graceful Shutdown**
   - 🛑 Waits for browser window to close
   - 🧹 Automatically terminates all services
   - 👋 Clean exit with confirmation message

## Troubleshooting

### "package.json not found"
**Problem:** Launcher is in wrong directory
**Solution:** Move `JARVIS.bat` and `JARVIS_Launcher.ps1` to the `jarvis-kernel-architect` folder

### "node_modules not found"
**Problem:** Dependencies not installed
**Solution:** Run `npm install` in the project directory

### "Server failed to start after 45 seconds"
**Problem:** Vite server not responding
**Solutions:**
1. Check the minimized CMD window for Vite error messages
2. Run `JARVIS_Cleanup.bat` to clear port conflicts
3. Manually test: `npm run dev`
4. Check Windows Firewall isn't blocking Node.js

### "Port 3000 is already in use"
**Problem:** Previous instance still running
**Solution:** 
1. Run `JARVIS_Cleanup.bat`
2. Or manually: `taskkill /F /IM node.exe`

### PowerShell Execution Policy Error
**Problem:** Windows blocking PowerShell scripts
**Solution:** Run PowerShell as Admin and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Configuration

Edit the configuration section in `JARVIS_Launcher.ps1`:

```powershell
$script:Config = @{
    Version = "2.0.0"
    JarvisUrl = "http://localhost:3000"          # Main interface
    HardwareMonitorUrl = "http://localhost:3100" # Hardware metrics
    ProxyUrl = "http://localhost:3101"           # HA proxy
    PiperUrl = "http://localhost:5000"           # Voice server
    StartupTimeout = 45  # Max seconds to wait for startup
    CheckInterval = 1    # Seconds between health checks
}
```

## Log Message Types

| Level | Color | Purpose |
|-------|-------|---------|
| **INFO** | Cyan | General information |
| **SUCCESS** | Green | Successful operations |
| **WARNING** | Yellow | Non-critical issues |
| **ERROR** | Red | Critical failures |
| **SYSTEM** | Magenta | System-level operations |

## Files

- **`JARVIS.bat`** - Windows batch wrapper (double-click this)
- **`JARVIS_Launcher.ps1`** - PowerShell launcher engine
- **`JARVIS_Cleanup.bat`** - Emergency process cleanup utility
- **`LAUNCHER_README.md`** - This documentation

## Advanced Usage

### Manual Service Control

Start individual services for debugging:

```powershell
# Vite only
npm run dev

# Hardware monitor only
node server\hardware-monitor.cjs

# Proxy only
node server\proxy.js

# Piper TTS only
cd Piper
python piper_server.py
```

### Debug Mode

To see all service windows (not minimized):
1. Edit `JARVIS_Launcher.ps1`
2. Change `-WindowStyle Minimized` to `-WindowStyle Normal`
3. Watch each service window for detailed output

## System Requirements

- ✅ Windows 10/11
- ✅ Node.js v18+ 
- ✅ npm v9+
- ✅ PowerShell 5.1+
- ✅ Chrome or Edge browser

## Version History

**v2.0.0** (2025-02-01)
- Complete rewrite in PowerShell
- Professional logging system
- JARVIS-themed interface
- Comprehensive error handling
- Multi-service orchestration
- Automatic health monitoring

---

**Made with ❤️ for JARVIS**
