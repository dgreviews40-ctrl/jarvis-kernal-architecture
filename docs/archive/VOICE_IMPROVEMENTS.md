# JARVIS Voice Recognition Improvements

## Summary of Changes

I've made several improvements to help Whisper detect your voice and the "Jarvis" wake word more reliably:

### 1. Upgraded Whisper Model (`whisper_server.py`)
- **Changed from `base` to `small` model**
- The `small` model provides significantly better accuracy for wake word detection
- Your GTX 1080 Ti has plenty of VRAM to handle this (small uses ~2GB)

### 2. Improved Audio Quality (`services/whisperSTT.ts`)
- **Increased audio bitrate** from 16kbps to 32kbps for better transcription quality
- **Increased chunk duration** from 1.5s to 2s for more context
- **Lowered noise gate threshold** from 0.02 to 0.015 to catch quieter speech
- **Reduced minimum speech duration** from 200ms to 150ms to catch short utterances like "Jarvis"

### 3. Better Wake Word Detection (`services/voice.ts`)
- **Added fuzzy matching** for wake word variations:
  - Detects: "jarvis", "jarves", "jarvice", "jarviz", "jarvus", "jervis", "garvis", etc.
  - Uses phonetic similarity (Levenshtein distance) for close matches
- **Lowered VAD threshold** from 0.015 to 0.012 to catch quieter speech
- **Increased silence timeout** from 800ms to 1200ms for more time to detect wake words
- **Extended grace period** from 8s to 10s after wake word detection

### 4. Enhanced Transcription Parameters (`whisper_server.py`)
- **Better beam search**: Increased from 1 to 3 for more accurate results
- **Added patience parameter**: 1.5 for better beam search results
- **Lower no-speech threshold**: 0.3 to catch quiet speech
- **Improved initial prompt**: Mentions "Jarvis" wake word for context

## How to Apply These Changes

### Step 1: Restart the Whisper Server

1. Stop any running `whisper_server.py` (Ctrl+C in the terminal)
2. The server will automatically download the `small` model on first run (takes a few minutes)
3. Start the server:
   ```bash
   python whisper_server.py
   ```

### Step 2: Refresh Your Browser

The TypeScript changes are automatically applied when you refresh the JARVIS web interface.

### Step 3: Test with the Diagnostics Tool

Open `voice_diagnostics.html` in your browser to test:
- Microphone audio levels
- Wake word detection
- Live transcription quality

## Tips for Best Results

1. **Speak clearly** - Don't whisper or mumble
2. **Consistent volume** - Speak at a normal conversational level
3. **Reduce background noise** - Close windows, turn off fans
4. **Mic position** - Keep microphone 6-12 inches from your mouth
5. **Say "Jarvis" clearly** - Pronounce it as "JAR-vis"

## If You Still Have Issues

### Option A: Try the `medium` Model (Best Quality)
Edit `whisper_server.py`:
```python
MODEL_SIZE = "medium"  # Uses ~5GB VRAM, best accuracy
```

### Option B: Adjust Sensitivity
In browser console (F12):
```javascript
// Lower VAD threshold = more sensitive
voice['VAD_THRESHOLD'] = 0.01;

// Longer chunks = more context
import { whisperSTT } from './services/whisperSTT';
whisperSTT.setConfig({ chunkDuration: 2500 });
```

### Option C: Check Your Microphone
Run the diagnostics tool and check:
- Audio meter responds when you speak
- No red "error" messages in the log
- Transcription shows what you actually said

## Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Model | base | small | Better accuracy |
| VRAM Usage | ~1GB | ~2GB | +1GB |
| Chunk Size | 1.5s | 2s | +0.5s latency |
| Audio Quality | 16kbps | 32kbps | 2x better |
| Wake Word Detection | Exact only | Fuzzy matching | Much better |

The trade-off is slightly higher latency (~0.5s) for significantly better accuracy.
