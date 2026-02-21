========================================
JARVIS LAUNCHER INSTRUCTIONS
========================================

HOW TO START JARVIS:
--------------------

Method 1 - Visible Console (Recommended for debugging):
  Double-click: JARVIS.bat
  - Shows console window with status messages
  - Shows "JARVIS is Running!" when ready
  - Press Ctrl+C in the console to stop

Method 2 - Silent Start (Clean look):
  Double-click: JARVIS.vbs
  - No console window appears
  - Shows "JARVIS is starting..." popup
  - Browser opens automatically when ready

HOW TO STOP JARVIS:
-------------------

Method 1 - Exit Button (Recommended):
  Click the POWER icon (Exit button) in the top-right of the JARVIS UI
  - Shows confirmation dialog
  - Shuts down all services and closes browser
  - Clean shutdown of everything

Method 2 - Close Console:
  If using JARVIS.bat, press Ctrl+C in the console window
  OR close the console window

Method 3 - Close Browser:
  Closing the browser window will also trigger shutdown
  (but use the Exit button for cleanest shutdown)

WHAT GETS STARTED:
------------------
The launcher starts these 4 services:
  1. Hardware Monitor (port 3100)
  2. HA Proxy (port 3101)
  3. Piper TTS Server (port 5000)
  4. Vite Dev Server (port 3000)

And opens Chrome/Edge browser pointing to http://localhost:3000

TROUBLESHOOTING:
----------------
- If startup is slow (40+ seconds): This is Vite building the cache.
  The next start will be much faster (5-10 seconds).

- If ports are already in use: The launcher will try to kill existing
  processes on those ports before starting.

- If browser doesn't open: Check that Chrome or Edge is installed.

- To create a Desktop shortcut: Right-click JARVIS.vbs -> Send to -> Desktop
