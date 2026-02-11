# Piper Voice Selection Guide

## Overview

JARVIS now automatically detects and lists all available Piper voices in the Settings → AI Core Engine → Voice Configuration page.

**Note:** The JARVIS launcher (`JARVIS.bat` and `JARVIS_MASTER.bat`) now detects **ANY** `.onnx` voice file in the `Piper/voices/` folder - you're no longer limited to just the "jarvis" voice. Simply place any voice files in the folder and they will be automatically detected on startup.

## Features

### 1. **Automatic Voice Detection**
When the Piper server is running, JARVIS will:
- Scan the `Piper/voices/` folder for all installed `.onnx` voice files
- Display them in a dropdown menu with flags indicating language (🇬🇧 British / 🇺🇸 American)
- Show quality indicators (⭐ for high quality)

### 2. **Voice Selection Dropdown**

The voice selection UI shows:
- **Voice name** (e.g., "alan", "jarvis", "amy")
- **Language/Accent** (British or American)
- **Quality rating** (⭐ for high quality)
- **Active indicator** for the currently selected voice

### 3. **Voice Details Panel**

When you select a voice, you'll see:
- Flag indicator (🇬🇧 for British, 🇺🇸 for American)
- Quality badge
- Special notes:
  - For `alan`: "✓ Closest to movie JARVIS - Scottish, professional"
  - For `jarvis`: "⚠️ Note: This is an American voice, not the British JARVIS from the movies."

### 4. **Refresh Button**

Click the "Refresh" button to:
- Re-scan the voices folder
- Update the list if you added new voices
- Sync with the Piper server

## How to Add New Voices

### Method 1: Manual Download

1. Visit [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)
2. Find a voice you like (e.g., `alan`, `amy`, `joe`)
3. Download both files:
   - `{voice_name}.onnx`
   - `{voice_name}.onnx.json`
4. Place both files in `Piper/voices/` folder
5. Click "Refresh" in the JARVIS settings

### Method 2: Direct Links

**British Voices (Recommended for JARVIS feel):**

| Voice | ONNX | JSON |
|-------|------|------|
| **alan** | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json) |
| **joe** | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx.json) |
| **amy** | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx.json) |

**American Voices:**

| Voice | ONNX | JSON |
|-------|------|------|
| **jarvis** | [Download](https://huggingface.co/jgkawell/jarvis/resolve/main/jarvis.onnx) | [Download](https://huggingface.co/jgkawell/jarvis/resolve/main/jarvis.onnx.json) |
| **libritts_rmedium** | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx.json) |

## Troubleshooting

### "No voices detected"

**Cause:** Piper server not running or voices folder empty

**Solution:**
1. Make sure you've run `JARVIS.bat` or `Piper/start-jarvis-server.bat`
2. Check that `.onnx` files exist in `Piper/voices/`
3. Click "Check Status" button to verify Piper is running
4. Click "Refresh" to rescan voices

### "Voice changed but still speaking with old voice"

**Cause:** Voice config not synced properly

**Solution:**
1. Click "Save Settings" after changing the voice
2. The voice change takes effect immediately for the next speech
3. If still not working, restart Piper server with the new voice

### "Can't see my newly downloaded voice"

**Cause:** Voice list not refreshed

**Solution:**
1. Click the "Refresh" button next to the voice dropdown
2. If still not showing, check that both `.onnx` AND `.onnx.json` files are present
3. Verify the files are in the correct folder: `Piper/voices/`

### Launcher says "No voice models found"

**Cause:** The launcher checks for `.onnx` files in `Piper/voices/` on startup

**Solution:**
1. Download any voice model from the [Piper Voices repository](https://huggingface.co/rhasspy/piper-voices/tree/main)
2. Place both `.onnx` and `.onnx.json` files in `Piper/voices/`
3. Restart JARVIS - the voice will be detected automatically
4. The launcher now accepts **ANY** voice file, not just `jarvis.onnx`
5. Select your preferred voice in Settings → AI Core Engine → Voice Configuration

## Changing Voice at Runtime

You can also change voices programmatically:

```typescript
// Change voice in settings
setVoiceConfig({...voiceConfig, voiceName: 'alan'});
piperTTS.setConfig({ defaultVoice: 'alan' });

// Or use the helper method
await piperTTS.switchVoice('alan');

// Get current voice info
const voiceInfo = piperTTS.getCurrentVoiceInfo();
console.log(voiceInfo);
// { name: 'alan', isBritish: true, language: 'Scottish' }

// List all available voices
const voices = await piperTTS.getVoices();
console.log(voices);
// [{ name: 'alan', language: 'en_GB', quality: 'medium' }, ...]
```

## Voice Recommendations

| Use Case | Recommended Voice | Reason |
|----------|------------------|--------|
| **Movie JARVIS feel** | `alan` | Scottish, professional, authoritative |
| **British butler** | `amy` | Southern English, refined |
| **Casual British** | `joe` | Northern English, relaxed |
| **American professional** | `jarvis` | Clear, American accent |
| **Most natural** | `libritts_rmedium` | Very natural sounding |

## Technical Details

### Voice File Format

Each voice requires TWO files:
1. `{voice_name}.onnx` - The neural network model (large file, ~50-100MB)
2. `{voice_name}.onnx.json` - Configuration file (small, ~1KB)

### Voice Detection Process

1. Settings page checks Piper server status
2. When server is RUNNING, sends request to `/voices` endpoint
3. Server scans `Piper/voices/` folder for `.onnx` files
4. Returns list of voices with metadata
5. UI displays voices in dropdown with language indicators

### Fallback Behavior

If the server is not available, the system falls back to a predefined list of common voices. These may not match what's actually installed, so always ensure the server is running for accurate voice detection.
