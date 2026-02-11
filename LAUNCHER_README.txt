================================================================================
                    J.A.R.V.I.S. UNIFIED LAUNCHER v2.0
================================================================================

Welcome to J.A.R.V.I.S. - Just A Rather Very Intelligent System

================================================================================
QUICK START
================================================================================

1.  DOUBLE-CLICK:  JARVIS.bat
    
    This single file will:
    - Start ALL required services (Hardware Monitor, HA Proxy)
    - Start ALL optional AI services if Python is available:
      * Piper TTS (Text-to-Speech)
      * Whisper STT (Speech-to-Text) 
      * Embedding Server (Vector DB)
      * GPU Monitor
      * Vision Server
    - Open the loading animation screen
    - Launch your browser with the dashboard
    
2.  CREATE DESKTOP SHORTCUT:  Create-Desktop-Shortcut.bat
    
    Run this to create a professional desktop shortcut with icon.

================================================================================
WHAT'S NEW IN v2.0
================================================================================

* ONE file to launch everything - no more confusion!
* Professional loading screen with boot animation
* Parallel service startup - faster load times
* Automatic dependency checking
* Clean shutdown handling
* Desktop shortcut with custom icon support
* Archived old batch files to reduce clutter

================================================================================
REQUIREMENTS
================================================================================

REQUIRED:
  - Node.js (v18 or higher) - https://nodejs.org/
  - npm packages (run: npm install)

OPTIONAL (for full AI capabilities):
  - Python 3.8+ - https://python.org/
  - Piper voice model (run: Install-JARVIS-Voice.bat)

================================================================================
SERVICE PORTS
================================================================================

Port 3000  - Vite Dev Server (Main Dashboard)
Port 3100  - Hardware Monitor
Port 3101  - Home Assistant Proxy
Port 5000  - Piper TTS Server (Python)
Port 5001  - Whisper STT Server (Python)
Port 5002  - Embedding Server (Python)
Port 5003  - GPU Monitor (Python)
Port 5004  - Vision Server (Python)

================================================================================
TROUBLESHOOTING
================================================================================

Problem:  "Node.js not found"
Fix:      Install Node.js from https://nodejs.org/

Problem:  "Port already in use"
Fix:      Run JARVIS.bat - it will clean up existing processes automatically

Problem:  Python services not starting
Fix:      Python is optional. Install Python 3.8+ for full AI features.

Problem:  Want to shutdown JARVIS
Fix:      Close the JARVIS.bat window or press Ctrl+C

================================================================================
ADVANCED USAGE
================================================================================

Manual Service Control (if needed):
  npm run dev          - Start only Vite dev server
  npm run proxy        - Start only HA Proxy
  npm run hardware     - Start only Hardware Monitor

Python Services (manual):
  python whisper_server.py
  python embedding_server.py
  python gpu_monitor.py
  python vision_server.py
  python Piper/piper_server.py

================================================================================
FILE STRUCTURE
================================================================================

JARVIS.bat                    <-- START HERE - Main launcher
Create-Desktop-Shortcut.bat   <-- Create desktop shortcut with icon
Create-Shortcut.ps1           <-- PowerShell script for shortcut creation
loading.html                  <-- Boot animation screen

installer/
  old-batch-files/            <-- Old batch files archived here
  Install-JARVIS-Voice.bat    <-- Install Piper TTS voice
  Install-Python-Deps.bat     <-- Install Python dependencies

================================================================================
SUPPORT
================================================================================

For issues and documentation:
- See README.md for full documentation
- Check AGENTS.md for development info

================================================================================
                        Stark Industries (c) 2024
================================================================================
