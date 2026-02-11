# Natural Speech Flow Configuration

This document explains how JARVIS achieves natural-sounding speech without the "word... pause... word" staccato effect.

## The Problem

When using text-to-speech (TTS), breaking text into small chunks and speaking them separately creates unnatural pauses between words. This results in a robotic, staccato delivery.

## The Solution

JARVIS uses several strategies to create smooth, natural-sounding speech:

### 1. **Smart Text Chunking** (`voice.ts`, `piperTTS.ts`)

Instead of fixed 150-character chunks, JARVIS now:
- **Respects sentence boundaries** - Never splits mid-sentence
- **Uses natural pause points** - Splits on commas, semicolons, and conjunctions
- **Merges small chunks** - Combines tiny fragments to avoid choppy delivery
- **Larger chunk sizes** (250-300 chars) - Fewer breaks = smoother flow

```typescript
// Configuration in voice.ts
naturalSpeechConfig = {
  maxChunkSize: 250,   // Larger = fewer pauses
  minChunkSize: 40,    // Avoid tiny fragments
  sentenceBreakMs: 350,
  commaBreakMs: 150
};
```

### 2. **Single Utterance for System Voice** (`voice.ts`)

Instead of speaking each chunk separately (which causes gaps), JARVIS now:
- Combines all chunks into ONE continuous utterance
- Adds commas between chunks for natural pauses
- Lets the TTS engine handle the flow

### 3. **Piper TTS Optimizations** (`piperTTS.ts`)

For local Piper TTS:
- **Larger chunks** (300 chars vs 150)
- **Faster speech rate** (length_scale: 0.85 vs 0.90)
- **Streaming with overlap** - Next chunk generates while current plays

### 4. **Configurable Settings**

You can adjust speech flow at runtime:

```typescript
// Make speech faster and smoother
voiceService.setNaturalSpeechConfig({
  maxChunkSize: 300,   // Larger chunks
  minChunkSize: 50     // Avoid tiny fragments
});

// For Piper TTS
piperTTS.setConfig({
  lengthScale: 0.8,    // Faster (lower = faster)
  chunkSize: 350       // Larger chunks
});
```

## Quick Fixes

### If JARVIS sounds choppy:

1. **Increase chunk sizes** in Settings → Voice
2. **Use Piper TTS** (local) instead of System voice for best results
3. **Adjust speed** - Slightly faster can sound more natural (0.8-0.9)

### If JARVIS speaks too fast:

```typescript
// Slow down slightly
piperTTS.setConfig({ lengthScale: 1.0 });
// or for System voice, the rate is capped at 0.9 in speakWithSystemVoice()
```

## Technical Details

### Chunking Algorithm

```
Input: "The quick brown fox jumps over the lazy dog. It was a beautiful day."

Old (150 chars):
  - "The quick brown fox jumps over the lazy " [pause]
  - "dog. It was a beautiful day." [pause]

New (250 chars, sentence-aware):
  - "The quick brown fox jumps over the lazy dog." [natural pause]
  - "It was a beautiful day."
```

### Text Preprocessing

The `enhancedTTS.ts` service also adds:
- **Natural pauses** after commas and conjunctions
- **Unit conversion** (metric → imperial for consistency)
- **Markdown removal** (so symbols aren't read aloud)

## Voice Types Comparison

| Voice Type | Natural Flow | Setup | Best For |
|------------|-------------|-------|----------|
| **Piper** | ⭐⭐⭐ Excellent | Download voice model | Daily use |
| **System** | ⭐⭐ Good | Built-in | Fallback |
| **Gemini** | ⭐⭐⭐ Excellent | API key | High quality |

## Troubleshooting

### "Still hearing word-by-word pauses"

1. Check you're using the latest code (run `npm run build`)
2. Clear browser cache (voice settings are cached)
3. Try Piper TTS - it has better flow control than System voice
4. Check chunk sizes aren't too small

### "Speech is too fast/too slow"

- **Piper**: Adjust `lengthScale` (0.7 = fast, 1.0 = normal, 1.2 = slow)
- **System**: Rate is auto-capped at 0.9 for clarity
- **Gemini**: Uses Google's natural speech models

## Future Improvements

- [x] Sentence-level buffering (implemented in voiceStreaming)
- [x] Natural pause insertion (implemented at clause boundaries)
- [x] Emotional tone mapping (integrated with unifiedSentiment)
- [ ] SSML support for fine-grained prosody control
- [ ] Dynamic speed adjustment based on content complexity
- [ ] Crossfade between chunks for seamless transitions
- [ ] Breathing sound simulation
