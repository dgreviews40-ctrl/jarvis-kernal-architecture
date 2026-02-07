# JARVIS Piper Voice Setup Guide

## Option 2: Piper Local with JARVIS Voice (100% FREE & OFFLINE)

This guide sets up a local neural text-to-speech engine with the actual JARVIS voice from Iron Man.

---

## Quick Setup (Automated)

### Step 1: Run the Setup Script

1. Open **PowerShell as Administrator**
2. Run this command:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/YOUR_REPO/main/installer/setup-piper-jarvis.ps1" -OutFile "$env:TEMP\setup-piper.ps1"
& "$env:TEMP\setup-piper.ps1"
```

Or manually download and run: `installer/setup-piper-jarvis.ps1`

### Step 2: Start the Server

After setup completes, run:
```
%USERPROFILE%\Piper\start-jarvis-server.bat
```

A black command window will open showing:
```
Starting JARVIS Piper Server...
```

**Keep this window open!** This is your voice server running.

### Step 3: Configure JARVIS

1. Open JARVIS
2. Go to **Settings** → **Voice**
3. Change **Engine Mode** to **"Piper Local"**
4. Click **Save**
5. Test the voice!

---

## Manual Setup (If Automated Fails)

### 1. Download Piper

Go to: https://github.com/rhasspy/piper/releases

Download: `piper_windows_amd64.zip` (or `x86` for 32-bit)

Extract to: `C:\Users\YOURNAME\Piper`

### 2. Download Voice Model

The installer automatically downloads a high-quality voice from the official Piper repository.

Voice details:
- **Name**: ryan (high quality)
- **Language**: American English (en_US)
- **Quality**: High quality, professional sound
- **Size**: ~120MB

The voice is saved as "jarvis" for compatibility.

### 3. Start the Server

Open Command Prompt and run:
```cmd
cd %USERPROFILE%\Piper
piper.exe --http-server --model voices\jarvis.onnx --port 5000
```

You should see:
```
INFO:piper.http_server:Ready
```

### 4. Configure JARVIS

Same as Step 3 above.

---

## Making JARVIS Start Automatically

### Option A: Windows Startup Folder

1. Press `Win + R`
2. Type: `shell:startup`
3. Create a shortcut to `start-jarvis-server.bat`
4. JARVIS voice will start with Windows

### Option B: Windows Service (Advanced)

Create a Windows service that runs Piper in the background:

```powershell
# Download NSSM (Non-Sucking Service Manager)
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile nssm.zip
Expand-Archive nssm.zip

# Create service
.\nssm-2.24\win64\nssm.exe install JARVIS-Voice
# In the GUI that opens:
# Path: C:\Users\YOURNAME\Piper\piper.exe
# Arguments: --http-server --model voices\jarvis.onnx --port 5000
# Startup directory: C:\Users\YOURNAME\Piper

# Start the service
Start-Service JARVIS-Voice
```

---

## Troubleshooting

### "Connection refused" or "Cannot connect to Piper"

1. Check if server is running (black command window open)
2. Try different port: `--port 5001` in the batch file
3. Check Windows Firewall isn't blocking port 5000

### Voice sounds robotic/choppy

- Piper needs CPU power. Close other applications
- Try a lower quality voice model if available

### "Voice not found" error

- Ensure `jarvis.onnx` and `jarvis.onnx.json` are in the `voices` folder
- File names must match exactly

### Server starts but JARVIS can't connect

1. Check antivirus isn't blocking the connection
2. Try accessing http://localhost:5000 in your browser
3. You should see a JSON response if it's working

---

## Voice Customization

### Adjust Speech Speed

Edit `start-jarvis-server.bat` and add:
```
--length-scale 0.8
```
- Lower = faster (0.5-0.9)
- Higher = slower (1.1-1.5)

### Adjust Voice Variability

```
--noise-scale 0.667
```
- 0.0 = robotic, consistent
- 1.0 = more natural variation

---

## Other Free Voices for Piper

The default voice is **ryan** (American male, high quality). If you want alternatives, download from [HuggingFace](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US):

| Voice | Style | Files to Download |
|-------|-------|-------------------|
| ryan | **American male, professional** (Default) | `en_US-ryan-high.onnx` + `.json` |
| joe | American male, clear | `en_US-joe-medium.onnx` + `.json` |
| kristin | American female, professional | `en_US-kristin-medium.onnx` + `.json` |
| lessac | American female, clear | `en_US-lessac-medium.onnx` + `.json` |

Download the `.onnx` and `.onnx.json` files, rename to `jarvis.onnx` and `jarvis.onnx.json`, and place in the `voices` folder.

---

## Comparison: Why Piper?

| Feature | Browser TTS | Gemini Neural | Piper Local |
|---------|-------------|---------------|-------------|
| **Cost** | Free | Free (1500/day) | **100% Free** |
| **Offline** | ✅ | ❌ | **✅** |
| **JARVIS Voice** | ❌ | ⚠️ Similar | **✅ Exact** |
| **Speed** | Fast | Network delay | **Fast** |
| **Privacy** | ✅ | ❌ Cloud | **✅ Local** |

---

## Support

- Piper GitHub: https://github.com/rhasspy/piper
- JARVIS Voice: https://huggingface.co/jgkawell/jarvis
- JARVIS Issues: Open an issue in this repository
