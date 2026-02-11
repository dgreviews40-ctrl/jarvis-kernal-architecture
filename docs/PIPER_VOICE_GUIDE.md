# Piper Voice Guide for JARVIS

## The "JARVIS" Voice Problem

The voice model named `jarvis.onnx` that you may have downloaded from HuggingFace is **NOT** the British JARVIS from Iron Man movies. Here's why:

### What's Wrong With the "jarvis" Voice?

| Issue | Details |
|-------|---------|
| **Accent** | American (en-US), NOT British |
| **Voice base** | Trained on "Ryan" dataset - an American male speaker |
| **Quality** | High quality, but sounds nothing like Paul Bettany |
| **Language code** | `en_US` in the config |

If you were expecting the sophisticated British butler voice from the movies, you'll be disappointed - this sounds like a generic American AI assistant.

## Better Voice Options

### For British/UK Accent (Movie JARVIS Vibe)

| Voice | Accent | Gender | Quality | Best For |
|-------|--------|--------|---------|----------|
| **alan** | Scottish | Male | Medium | Most JARVIS-like - authoritative, professional |
| **joe** | Northern England | Male | Medium | Casual British |
| **amy** | Southern England | Female | Medium | Polite, refined |

### For American Accent

| Voice | Description | Quality |
|-------|-------------|---------|
| **libritts_rmedium** | Natural male | Medium |
| **lessac** | Natural female | High |
| **jarvis** | Professional male | High |

## How to Download and Switch Voices

### Step 1: Download a British Voice

**Option 1: Alan (Scottish - most JARVIS-like)**
```bash
# Download these two files to your Piper/voices/ folder:
# https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx
# https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json

# Then rename them to:
# alan.onnx
# alan.onnx.json
```

**Option 2: Joe (Northern England)**
```bash
# Download:
# https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx
# https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx.json
```

### Step 2: Update Your Start Script

Edit `Piper/start-jarvis-server.bat`:

```batch
@echo off
cd /d "%~dp0"

:: For British voice (alan):
piper.exe --http-server --model voices/alan.onnx

:: For American voice (jarvis):
:: piper.exe --http-server --model voices/jarvis.onnx
```

### Step 3: Update JARVIS Settings

In JARVIS, go to Settings → Voice:

1. Set **Voice Type** to "Piper Local"
2. Set **Voice Name** to match your file (e.g., `alan`)
3. Set **Speed** to `0.85` for natural flow
4. Click **Test Voice**

### Step 4: Switch at Runtime (Optional)

You can also switch voices without restarting:

```typescript
// Switch to British voice
await piperTTS.switchVoice('alan');

// Check current voice
const voiceInfo = piperTTS.getCurrentVoiceInfo();
console.log(voiceInfo);
// { name: 'alan', isBritish: true, language: 'Scottish' }
```

## Quick Comparison

### Before (jarvis voice - American):
> "Good morning. The weather today will be sunny with a high of 75 degrees."
> 
> Sounds like: Generic American GPS voice

### After (alan voice - Scottish):
> "Good morning. The weather today will be sunny with a high of 75 degrees."
> 
> Sounds like: Professional British AI assistant (much closer to movie JARVIS)

## Technical Details

### Why Can't We Get the Real Movie Voice?

The real JARVIS voice (Paul Bettany) is:
1. **Copyrighted** - Disney/Marvel owns the rights
2. **Not open source** - No official voice model exists
3. **Actor's voice** - Would require permission and licensing

The community "jarvis" model was likely trained on someone named Ryan who gave permission for their voice to be used, but it's not the movie character.

### Creating a Custom JARVIS Voice

To get closer to the movie voice, you could:

1. **Use ElevenLabs** (cloud service) - Has better voice cloning but requires API key
2. **Use Coqui TTS** - Another open-source TTS with voice cloning
3. **Train your own Piper voice** - Requires ~1 hour of audio samples of a British speaker

## Voice Download URLs

### British Voices

| Voice | ONNX | JSON |
|-------|------|------|
| alan | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json) |
| joe | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/joe/medium/en_GB-joe-medium.onnx.json) |
| amy | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/amy/medium/en_GB-amy-medium.onnx.json) |

### American Voices

| Voice | ONNX | JSON |
|-------|------|------|
| jarvis | [Download](https://huggingface.co/jgkawell/jarvis/resolve/main/jarvis.onnx) | [Download](https://huggingface.co/jgkawell/jarvis/resolve/main/jarvis.onnx.json) |
| libritts_rmedium | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx) | [Download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_rmedium/medium/en_US-libritts_r-medium.onnx.json) |

## Troubleshooting

### "Voice still sounds American"
- Make sure you restarted the Piper server with the new voice
- Check the voice name matches the .onnx file name exactly
- Verify the config shows `en_GB` not `en_US`

### "Voice is too fast/slow"
```typescript
piperTTS.setConfig({ lengthScale: 0.9 }); // Slower
piperTTS.setConfig({ lengthScale: 0.8 }); // Faster
```

### "Voice sounds robotic"
- Try the `alan` voice - it's higher quality than some alternatives
- Adjust `noise_scale` (default 0.667) for more variation
- Make sure you're using the `-medium` or `-high` quality variants

## Summary

| Goal | Recommended Voice |
|------|-------------------|
| Closest to movie JARVIS | `alan` (Scottish) |
| Professional British | `amy` (Southern England) |
| Casual British | `joe` (Northern England) |
| American professional | `jarvis` or `libritts_rmedium` |
