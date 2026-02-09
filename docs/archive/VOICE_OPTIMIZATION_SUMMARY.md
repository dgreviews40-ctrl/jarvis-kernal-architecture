# JARVIS Voice Pipeline Optimization Summary

## Changes Made to Reduce Latency

### 1. Whisper STT Optimizations (`services/whisperSTT.ts`)

**Before:**
- 3-second audio chunks
- No overlapping windows
- No partial results

**After:**
- **1.5-second audio chunks** (50% faster response time)
- **Overlapping windows** (300ms overlap) to catch words at chunk boundaries
- **Partial result detection** - processes transcripts as they arrive
- **Configurable chunk duration** via settings
- **Lower audio bitrate** (16kbps) for faster transmission
- **Shorter timeouts** (5s instead of default)

**Key Changes:**
```typescript
chunkDuration: 1500,  // Was 3000ms
enableOverlap: true,  // NEW
overlapDuration: 300, // ms
```

### 2. Piper TTS Optimizations (`services/piperTTS.ts`)

**Before:**
- Single-shot generation for entire text
- No streaming
- Audio context created on each play
- length_scale: 0.85

**After:**
- **Streaming mode** - splits long text into chunks and plays while generating next chunk
- **Audio context pooling** - pre-warmed contexts for instant playback
- **Faster speech rate** - length_scale: 0.75 (was 0.85)
- **Smart text chunking** - respects sentence boundaries
- **Preloading support** - can preload anticipated responses

**Key Changes:**
```typescript
lengthScale: 0.75,      // Was 0.85 (faster speech)
enableStreaming: true,  // NEW
chunkSize: 150,         // Characters per chunk
```

### 3. Voice Service Optimizations (`services/voice.ts`)

**Before:**
- VAD silence timeout: 1500ms
- Audio buffer size: 4096
- Wake word grace period: 5000ms

**After:**
- **VAD silence timeout: 800ms** (47% faster end-of-speech detection)
- **Audio buffer size: 2048** (faster processing)
- **Wake word grace period: 8000ms** (more comfortable for user)
- **Response preloading** support

### 4. Whisper Server Optimizations (`whisper_server.py`)

**Before:**
- Basic transcription parameters
- No model compilation
- No GPU warmup

**After:**
- **PyTorch 2.0+ compilation** support (significant speedup on GPU)
- **GPU warmup** on startup (eliminates first-request delay)
- **Optimized decoding** - greedy decoding on GPU (beam_size=1)
- **Temperature=0** for more deterministic, faster inference
- **Processing time tracking** in responses

**Key Optimizations:**
```python
# Model compilation for PyTorch 2.0+
if hasattr(torch, 'compile') and DEVICE == "cuda":
    model = torch.compile(model)

# GPU warmup
dummy_audio = torch.randn(16000).cuda()
_ = model.transcribe(dummy_audio, language='en', fp16=True)

# Faster decoding
beam_size=1 if DEVICE == "cuda" else None
```

### 5. Piper Server Optimizations (`Piper/piper_server.py`)

**Before:**
- Single-threaded server
- No caching
- Default length_scale

**After:**
- **Threaded server** for concurrent requests
- **Audio caching** for repeated phrases (50-entry LRU cache, 5min TTL)
- **Faster subprocess handling** (CREATE_NO_WINDOW on Windows)
- **Content-Length headers** for better client handling

## Performance Improvements Expected

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| STT Response Time | ~3-4s | ~1.5-2s | **50% faster** |
| TTS Start Time | ~1-2s | ~0.5-1s | **50% faster** |
| End-of-Speech Detection | 1.5s | 0.8s | **47% faster** |
| First Audio Playback | ~2-3s | ~1-2s | **40% faster** |
| Total Round-trip | ~5-8s | ~2-4s | **50-60% faster** |

## How to Use the Optimizations

### 1. Restart the Servers

**Whisper Server:**
```bash
# Stop any running whisper_server.py, then:
python whisper_server.py
```

**Piper Server:**
```bash
# Stop any running piper_server.py, then:
cd Piper
python piper_server.py
```

Or use the batch file:
```bash
Piper\start-jarvis-server.bat
```

### 2. Configure Voice Settings in JARVIS

The optimizations are automatic, but you can tune them:

```typescript
// In browser console or settings:
import { whisperSTT } from './services/whisperSTT';
import { piperTTS } from './services/piperTTS';

// Adjust chunk duration (lower = faster, but less accurate)
whisperSTT.setConfig({ chunkDuration: 1200 }); // 1.2 seconds

// Adjust TTS speed (lower = faster speech)
piperTTS.setConfig({ lengthScale: 0.7 }); // Even faster

// Disable streaming if you prefer
piperTTS.setConfig({ enableStreaming: false });
```

### 3. Monitor Performance

Check the browser console for performance logs:
```
[PERF] Voice Pipeline Metrics:
  stt: 1450.23ms
  tts: 890.45ms
  total: 2340.68ms
```

## Troubleshooting

### If STT is too sensitive (false positives):
```typescript
// Increase chunk duration for more context
whisperSTT.setConfig({ chunkDuration: 2000 });
```

### If TTS sounds too fast:
```typescript
// Slow down speech
piperTTS.setConfig({ lengthScale: 0.85 }); // or 1.0 for normal
```

### If you get "server not available" errors:
1. Check that both servers are running:
   - Whisper: http://localhost:5001/health
   - Piper: http://localhost:5000/
2. Restart the servers with the new optimized versions

## Model Recommendations for Your GTX 1080 Ti

| Model | VRAM | Speed | Accuracy | Recommendation |
|-------|------|-------|----------|----------------|
| tiny | ~1GB | Fastest | Low | Testing only |
| base | ~1GB | Fast | Good | **Best for speed** |
| small | ~2GB | Medium | Better | **Best balance** |
| medium | ~5GB | Slower | High | Best quality |

Edit `whisper_server.py`:
```python
MODEL_SIZE = "base"  # Change to "small" for better accuracy
```

## Additional Tips

1. **Use GPU for Whisper**: Ensure CUDA is properly installed
2. **Close unnecessary apps**: Free up GPU memory
3. **Use wired connection**: Reduces network latency
4. **Speak clearly**: Reduces need for re-transcription
5. **Use wake word**: "Jarvis" detection is faster than continuous listening

## Files Modified

- `services/whisperSTT.ts` - Optimized STT service
- `services/piperTTS.ts` - Optimized TTS service  
- `services/voice.ts` - Optimized voice coordination
- `whisper_server.py` - Optimized Whisper server
- `Piper/piper_server.py` - Optimized Piper server
- `services/voicePerformance.ts` - NEW: Performance monitoring

## Next Steps (Future Optimizations)

1. **WebSocket streaming** - True real-time audio streaming
2. **ONNX Runtime** - Even faster inference for Whisper
3. **Quantized models** - Smaller, faster models with minimal accuracy loss
4. **Predictive preloading** - Pre-synthesize anticipated responses
5. **Edge TPU support** - Hardware acceleration for supported devices
