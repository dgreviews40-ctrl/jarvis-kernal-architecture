# Voice System Documentation

Complete guide for JARVIS voice features including setup, configuration, and troubleshooting.

## Overview

JARVIS supports three voice engines:

| Engine | Quality | Cost | Offline | Best For |
|--------|---------|------|---------|----------|
| **Browser/System** | ⭐⭐ | Free | ✅ | Quick setup, basic use |
| **Gemini Neural** | ⭐⭐⭐⭐⭐ | Free (1500/day) | ❌ | High quality, natural speech |
| **Piper Local** | ⭐⭐⭐⭐ | **100% FREE** | ✅ | JARVIS-like voice, unlimited |

---

## Quick Setup

### 1. Browser/System TTS (Default)
No setup required. Works immediately in supported browsers.

### 2. Gemini Neural TTS
No setup required. Uses Google's Gemini API (requires API key).

### 3. Piper Local TTS (Recommended)

```bash
# Run the installer
Install-JARVIS-Voice.bat

# Start the voice server
%USERPROFILE%\Piper\start-jarvis-server.bat

# In JARVIS: Settings → Voice → Select "Piper Local"
```

---

## Piper Local Setup (Detailed)

### Automatic Installation

1. **Run the installer:**
   ```bash
   Install-JARVIS-Voice.bat
   ```

2. **Start the server:**
   ```bash
   %USERPROFILE%\Piper\start-jarvis-server.bat
   ```

3. **Configure JARVIS:**
   - Open Settings → Voice
   - Select "Piper Local"
   - Click "Check Piper Status"
   - Test voice and Save

### Manual Installation

If automatic setup fails:

1. **Download Piper:**
   - https://github.com/rhasspy/piper/releases
   - Download `piper_windows_amd64.zip`
   - Extract to `%USERPROFILE%\Piper`

2. **Download Voice Model:**
   - Voice files auto-downloaded during install
   - Located in `%USERPROFILE%\Piper\voices\`

3. **Start Server:**
   ```bash
   cd %USERPROFILE%\Piper
   piper.exe --http-server --model voices\jarvis.onnx --port 5000
   ```

### Auto-Start with Windows

1. Press `Win + R`, type: `shell:startup`
2. Create shortcut to `start-jarvis-server.bat`
3. Server starts automatically on boot

---

## Streaming TTS (v1.1+)

Token-level TTS synchronization for real-time speech.

### How It Works

```
Before (v1.0): AI generates full response → TTS speaks → Done (3-5s wait)
After (v1.1):  AI generates "Hello!" → TTS speaks "Hello!" (overlapping)
```

### Usage

```typescript
import { voice } from './services/voice';

// Start streaming
voice.startStreamingTTS('PIPER');

// Feed tokens as AI generates
voice.streamToken('Hello ');
voice.streamToken('world!');

// End streaming
voice.endStreamingTTS();
```

### Configuration

```typescript
voice.setStreamingConfig({
  minBufferSize: 80,      // Start speaking after N chars
  maxBufferSize: 300,     // Force flush at N chars
  sentenceDelimiters: ['.', '!', '?', '\n'],
  chunkDelayMs: 50        // Delay between chunks
});
```

### Performance

| Metric | v1.0 | v1.1 | Improvement |
|--------|------|------|-------------|
| Time to First Speech | 3-5s | 0.5-1s | 70% faster |
| Perceived Latency | Full generation | First sentence | 60-70% faster |

---

## Voice Customization

### Piper Voice Settings

Edit `start-jarvis-server.bat`:

```bash
# Speech speed (0.5 = fast, 1.5 = slow)
--length-scale 0.8

# Voice variability (0.0 = robotic, 1.0 = natural)
--noise-scale 0.667
```

### Alternative Voices

Download from [HuggingFace](https://huggingface.co/rhasspy/piper-voices):

| Voice | Style | Files |
|-------|-------|-------|
| ryan | American male, professional | `en_US-ryan-high.onnx` |
| joe | American male, clear | `en_US-joe-medium.onnx` |
| kristin | American female | `en_US-kristin-medium.onnx` |
| lessac | American female, clear | `en_US-lessac-medium.onnx` |

Rename to `jarvis.onnx` and `jarvis.onnx.json` in the voices folder.

---

## Troubleshooting

### Piper Connection Issues

| Problem | Solution |
|---------|----------|
| "Piper Offline" | Ensure server is running (black window open) |
| "Connection refused" | Check firewall isn't blocking port 5000 |
| Installation fails | Run PowerShell as Administrator |

### Voice Quality Issues

| Problem | Solution |
|---------|----------|
| Choppy audio | Close other programs (Piper needs CPU) |
| Too robotic | Increase `--noise-scale` to 0.8 |
| Too fast/slow | Adjust `--length-scale` (0.8-1.2) |
| Sentences cut off | Add more delimiters in config |

### Streaming TTS Issues

| Problem | Solution |
|---------|----------|
| Starts too late | Reduce `minBufferSize` to 40 |
| Too choppy | Increase `minBufferSize` to 120 |
| Sentences cut off | Add delimiters: `['.', '!', '?', ';']` |

---

## API Reference

### Voice Service

```typescript
// Speak text (traditional)
voice.speak(text: string, options?: TTSOptions): Promise<void>

// Streaming TTS
voice.startStreamingTTS(voiceType?: VoiceType): string
voice.streamToken(token: string): boolean
voice.endStreamingTTS(): void
voice.abortStreamingTTS(): void

// Configuration
voice.setStreamingConfig(config: StreamingTTSConfig): void
voice.getMetrics(): VoiceMetrics
```

### React Hook

```typescript
const {
  startStreaming,
  onToken,
  endStreaming,
  isSpeaking,
  currentBuffer,
  getMetrics
} = useStreamingVoice();
```

---

## File Locations

```
%USERPROFILE%\Piper\
├── piper.exe                  # TTS engine
├── voices\
│   ├── jarvis.onnx           # Voice model
│   └── jarvis.onnx.json      # Voice config
└── start-jarvis-server.bat   # Launcher
```

---

## Resources

- [Piper GitHub](https://github.com/rhasspy/piper)
- [Piper Voices](https://huggingface.co/rhasspy/piper-voices)
- Main README: [../README.md](../README.md)
