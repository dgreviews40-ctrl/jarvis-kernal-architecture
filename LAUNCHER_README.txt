JARVIS MASTER LAUNCHER SYSTEM
=============================

QUICK START
-----------
1. Double-click: JARVIS_RUN.bat
2. Wait for services to start (~15-30 seconds)
3. Chrome will open automatically
4. Use JARVIS!

TO EXIT
-------
- Close the Chrome window, OR
- Press Ctrl+C in the launcher window

All services will be automatically cleaned up.

FILES
-----
JARVIS_RUN.bat          - Main launcher (start here!)
launcher.cjs            - Node.js service manager (handles everything)
JARVIS_SHUTDOWN.bat     - Emergency shutdown
JARVIS_STATUS.bat       - Check what's running
Install-Python-Deps.bat - Install Python packages
Create-Desktop-Shortcut.bat - Create desktop icon
LAUNCHER_README.txt     - This file

SERVICES
--------
Node.js (Required - JARVIS won't work without these):
  - Vite (3000)           - Main web app
  - Hardware Monitor (3100) - System stats
  - HA Proxy (3101)       - API gateway

Python (Optional - enhances features):
  - Piper TTS (5000)      - Text-to-speech
  - Embedding (5002)      - AI embeddings
  - GPU Monitor (5003)    - GPU stats
  - Vision Server (5004)  - Image analysis

REQUIREMENTS
------------
1. Node.js installed (run: node --version)
2. npm packages installed (run: npm install)

OPTIONAL: For Python features:
1. Python installed (run: python --version)  
2. Python deps (run: Install-Python-Deps.bat)

TROUBLESHOOTING
---------------
Q: "node_modules not found" error
A: Run: npm install

Q: Vite fails to start
A: Make sure node_modules exists: dir node_modules\.bin\vite.cmd

Q: Python services fail
A: They're optional - run Install-Python-Deps.bat to enable them

Q: Port already in use
A: Run JARVIS_SHUTDOWN.bat to clean up, then try again

Q: Chrome doesn't open
A: JARVIS is still running - open http://localhost:3000 manually

FEATURES
--------
+ Auto-detects best way to run Vite
+ Handles crashes gracefully
+ Automatic shutdown on exit
+ Process monitoring
+ Port conflict resolution
+ Works with or without Python
