# Voice Selection Feature - Implementation Summary

## Problem
Users couldn't see or select from available Piper voices in the AI Core Engine settings. The UI only showed a hardcoded "jarvis" voice.

## Solution
Implemented automatic voice detection from the Piper server with a dropdown UI for voice selection.

## Files Modified

### 1. `components/SettingsInterface.tsx`
**Changes:**
- Added state for `availablePiperVoices` and `isLoadingPiperVoices`
- Added `fetchPiperVoices()` function to query the Piper server
- Added `useEffect` to auto-fetch voices when Piper status becomes RUNNING
- Replaced hardcoded voice display with dynamic dropdown
- Added voice details panel showing language flags (🇬🇧/🇺🇸) and quality
- Added "Refresh" button to re-scan voices
- Added warning for American "jarvis" voice vs British movie JARVIS
- Added recommendation list for British voices (alan, joe, amy)
- Imported `RefreshCw` icon from lucide-react

**Key UI Elements:**
```typescript
// Voice dropdown with language indicators
<select value={voiceConfig.voiceName} onChange={...}>
  {availablePiperVoices.map((v) => (
    <option key={v.name} value={v.name}>
      {v.name} {v.language === 'en_GB' ? '(British)' : '(American)'} {v.quality === 'high' ? '⭐' : ''}
    </option>
  ))}
</select>

// Voice details with special notes
{voiceInfo.name === 'alan' && (
  <div className="text-green-500">✓ Closest to movie JARVIS - Scottish, professional</div>
)}
{voiceInfo.name === 'jarvis' && voiceInfo.language === 'en_US' && (
  <div className="text-yellow-500">⚠️ This is an American voice, not the British JARVIS from the movies.</div>
)}
```

### 2. `services/piperTTS.ts`
**Changes:**
- Added `detectLocalVoices()` fallback method for when server is unavailable
- Enhanced `getVoices()` to use fallback if server request fails
- Added `switchVoice()` method for runtime voice switching
- Added `getCurrentVoiceInfo()` method to get voice metadata
- Updated `RECOMMENDED_PIPER_VOICES` with accurate descriptions
- Added `BRITISH_PIPER_VOICES` array with download URLs
- Added `getVoiceDownloadUrl()` helper function
- Updated `PIPER_SETUP_INSTRUCTIONS` with British voice options

**New Interface:**
```typescript
interface PiperVoice {
  name: string;
  language: string;
  quality: 'low' | 'medium' | 'high';
  description?: string;
}
```

### 3. `services/voice.ts`
**Changes:**
- Added voice sync in `speakWithPiper()` to ensure piperTTS uses the same voice
- Logs voice selection for debugging

```typescript
// Ensure Piper TTS is using the same voice as our config
const piperConfig = piperTTS.getConfig();
if (piperConfig.defaultVoice !== this.config.voiceName) {
  console.log(`[VOICE] Syncing Piper voice: ${piperConfig.defaultVoice} -> ${this.config.voiceName}`);
  piperTTS.setConfig({ defaultVoice: this.config.voiceName });
}
```

### 4. `Piper/piper_server.py`
**Changes:**
- Added `VOICE_NAME` environment variable support
- Enhanced `/voices` endpoint to scan `voices/` folder dynamically
- Returns all installed voices with metadata (name, language, quality)
- Auto-detects British voices (alan, joe, amy) vs American
- Shows voice info on startup

```python
# Scan for available voices
voices_dir = os.path.join(PIPER_DIR, "voices")
if os.path.exists(voices_dir):
    for file in os.listdir(voices_dir):
        if file.endswith('.onnx') and not file.endswith('.json'):
            voice_name = file.replace('.onnx', '')
            voice_info = {
                'name': voice_name,
                'language': 'en_GB' if voice_name in ['alan', 'joe', 'amy'] else 'en_US',
                'quality': 'high',
                'description': f'{voice_name} voice model'
            }
            voices.append(voice_info)
```

### 5. `Piper/start-british-server.bat` (NEW)
- Created dedicated startup script for British voice
- Checks if `alan.onnx` exists, warns if missing
- Sets `PIPER_VOICE=alan` environment variable
- Provides download instructions if voice not found

### 6. `Piper/start-jarvis-server.bat`
- Updated to show available voices in folder
- Displays list of installed voices on startup
- Mentions British voice option

## Documentation Created

### `docs/PIPER_VOICE_SELECTION.md`
- Complete guide for voice selection feature
- How to add new voices
- Troubleshooting steps
- Voice recommendations table
- Direct download links
- Runtime voice switching API

### `docs/VOICE_SELECTION_CHANGES.md` (this file)
- Implementation summary
- All file changes documented
- Code snippets for key changes

## How It Works

1. **Startup**: Piper server scans `Piper/voices/` folder
2. **Settings Open**: UI requests voice list from `/voices` endpoint
3. **Dropdown Populated**: All detected voices shown with flags
4. **User Selection**: Voice change saved to both voice config and piperTTS config
5. **Speech**: Voice service syncs piperTTS config before speaking

## User Workflow

1. Open Settings → AI Core Engine → Voice Configuration
2. Select "Piper Local" voice type
3. Click "Check Status" to ensure Piper is running
4. Voice dropdown appears with all installed voices
5. Select desired voice (e.g., "alan (British) ⭐")
6. Click "Test Voice" to hear sample
7. Click "Save Settings" to persist

## Testing Checklist

- [ ] Piper server running shows voice dropdown
- [ ] Multiple voices appear if installed
- [ ] British voices show 🇬🇧 flag
- [ ] American voices show 🇺🇸 flag
- [ ] Jarvis voice shows warning about American accent
- [ ] Alan voice shows "Closest to movie JARVIS" note
- [ ] Refresh button re-scans voices
- [ ] Voice change takes effect immediately
- [ ] Voice persists after restart
- [ ] Fallback works when server offline

## Known Limitations

1. **Browser Security**: Cannot scan local filesystem directly - requires server
2. **Fallback List**: When server offline, shows common voices that may not be installed
3. **Manual Download**: Users must manually download voice files
4. **No Preview**: Cannot preview voice without testing

## Future Improvements

- [ ] Voice preview (play sample without full speech)
- [ ] Auto-download voices from HuggingFace
- [ ] Voice favorites/starred
- [ ] Custom voice upload
- [ ] Voice quality indicators (bitrate, training data)
- [ ] Search/filter voices
