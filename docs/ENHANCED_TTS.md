# Enhanced TTS Service

Natural speech synthesis with emotional tone, prosody controls, and unit conversion.

## Overview

The Enhanced TTS Service adds human-like speech patterns to text-to-speech output:

- **Natural pauses** - Proper breathing breaks
- **Emotional tone** - Joy, curiosity, confidence markers
- **Unit conversion** - Automatic metric to imperial
- **Text cleaning** - Remove markdown, format for speech
- **Prosody controls** - Intonation, stress, rhythm variations

## Configuration

```typescript
interface EnhancedTTSConfig {
  // Basic settings
  rate: number;              // 0.5-2.0 (default: 1.0)
  pitch: number;             // 0.5-2.0 (default: 1.0)
  volume: number;            // 0.0-1.0 (default: 1.0)

  // Prosody
  intonationVariation: number;  // 0.0-1.0 (default: 0.3)
  stressLevel: number;          // 0.0-1.0 (default: 0.4)
  rhythmVariation: number;      // 0.0-1.0 (default: 0.2)

  // Emotional tone
  baseTone: 'neutral' | 'friendly' | 'professional' | 'enthusiastic' | 'calm';
  emotionalRange: number;       // 0.0-1.0 (default: 0.5)

  // Natural speech
  pauseDuration: 'short' | 'medium' | 'long';
  emphasisStyle: 'subtle' | 'moderate' | 'strong';

  // SSML support
  ssmlSupported: boolean;       // default: false
}
```

### Default Configuration

```typescript
const DEFAULT_ENHANCED_CONFIG: EnhancedTTSConfig = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  intonationVariation: 0.3,
  stressLevel: 0.4,
  rhythmVariation: 0.2,
  baseTone: 'professional',
  emotionalRange: 0.5,
  pauseDuration: 'medium',
  emphasisStyle: 'moderate',
  ssmlSupported: false
};
```

## Usage

```typescript
import EnhancedTTSService from './services/enhancedTTS';

const tts = new EnhancedTTSService({
  baseTone: 'friendly',
  emotionalRange: 0.6,
  rate: 0.95  // Slightly slower for clarity
});

// Preprocess text for natural speech
const rawText = "The temperature is 25°C with 50% humidity.";
const processedText = tts.preprocessText(rawText);
// Result: "The temperature is 77.0 degrees Fahrenheit with 50% humidity."

// Speak with enhanced TTS
voice.speak(processedText);
```

## Features

### 1. Text Cleaning

Removes markdown and formatting:

| Input | Output |
|-------|--------|
| `**bold**` | `bold` |
| `*italic*` | `italic` |
| `[link](url)` | `link` |
| `# Header` | `Header` |
| `- list item` | `list item` |

### 2. Unit Conversion

Automatic metric to imperial conversion:

| Metric | Imperial |
|--------|----------|
| `25°C` | `77.0 degrees Fahrenheit` |
| `100m` | `328 feet 1 inches` |
| `5km` | `3.1 miles` |
| `70kg` | `154 pounds` |
| `2L` | `2.1 quarts` |
| `30cm` | `11.8 inches` |

**Note**: Conversion is skipped if imperial units already present in text.

### 3. Natural Pauses

Adds pauses at appropriate places:

- After sentences
- Before conjunctions (and, but, or)
- After commas (configurable)
- Before emphasis words

### 4. Emotional Markers

Analyzes text for emotional content:

```typescript
interface EmotionalMarker {
  text: string;
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 
           'surprise' | 'neutral' | 'curiosity' | 'confidence';
  intensity: number;  // 0.0-1.0
  startIndex: number;
}
```

Emotion detection keywords:

| Emotion | Keywords |
|---------|----------|
| Joy | great, awesome, excellent, happy, love |
| Curiosity | interesting, curious, wonder, how, why |
| Confidence | sure, definitely, absolutely, certain |
| Surprise | wow, amazing, incredible, unexpected |

### 5. Emphasis

Adds stress to important words:

- Capitalized words
- Numbers
- Superlatives (best, most, greatest)
- Emotional markers

## Integration with Voice Service

```typescript
// In voice.ts
import EnhancedTTSService from './services/enhancedTTS';

class VoiceCoreOptimized {
  private enhancedTTS = new EnhancedTTSService({
    baseTone: 'professional',
    emotionalRange: 0.5
  });

  speak(text: string) {
    // Preprocess through enhanced TTS
    const processedText = this.enhancedTTS.preprocessText(text);
    
    // Then speak through selected TTS provider
    this.speakWithProvider(processedText);
  }
}
```

## Tone Profiles

Pre-configured profiles for different contexts:

```typescript
// Professional assistant
const professional = new EnhancedTTSService({
  baseTone: 'professional',
  emotionalRange: 0.3,
  rate: 1.0,
  pauseDuration: 'medium'
});

// Friendly companion
const friendly = new EnhancedTTSService({
  baseTone: 'friendly',
  emotionalRange: 0.7,
  rate: 0.95,
  pauseDuration: 'short'
});

// Excited announcer
const enthusiastic = new EnhancedTTSService({
  baseTone: 'enthusiastic',
  emotionalRange: 0.8,
  intonationVariation: 0.6,
  stressLevel: 0.6
});

// Calm helper
const calm = new EnhancedTTSService({
  baseTone: 'calm',
  emotionalRange: 0.2,
  rate: 0.9,
  pitch: 0.95
});
```

## Best Practices

### 1. Match Tone to Context

```typescript
// ✅ Good - professional for system status
systemTTS.speak('System diagnostic complete. All systems nominal.');

// ✅ Good - friendly for casual conversation
casualTTS.speak('Hey! Great to hear from you today!');

// ❌ Bad - mismatched tone
enthusiasticTTS.speak('Error: Database connection failed.');
```

### 2. Preprocess Before Caching

```typescript
// ✅ Good - cache processed text
const processed = tts.preprocessText(rawText);
cache.set(key, processed);

// ❌ Bad - caching raw text means reprocessing
const raw = fetchText();
cache.set(key, raw);  // Process every time
```

### 3. Adjust for Content Type

```typescript
// Technical content - slower, clear
tts.updateConfig({ rate: 0.9, pauseDuration: 'long' });

// Casual content - natural pace
tts.updateConfig({ rate: 1.0, pauseDuration: 'medium' });

// Urgent content - slightly faster
tts.updateConfig({ rate: 1.05, pauseDuration: 'short' });
```

### 4. Handle SSML Properly

```typescript
// Check if engine supports SSML
if (tts.getConfig().ssmlSupported) {
  // Use SSML for fine control
  speakWithSSML(text);
} else {
  // Use enhanced preprocessing
  const processed = tts.preprocessText(text);
  speak(processed);
}
```

## Performance

Processing overhead is minimal:

- Text cleaning: ~0.1ms per 100 chars
- Unit conversion: ~0.2ms per conversion
- Emotion analysis: ~0.5ms per sentence
- Total: ~1-2ms for typical response

**Recommendation**: Always preprocess, overhead is negligible compared to TTS generation time.

## Limitations

1. **No real SSML support** - Most TTS engines don't fully support SSML
2. **Basic emotion detection** - Keyword-based, not semantic analysis
3. **Fixed conversion rules** - No context-aware unit selection
4. **English-focused** - Best results with English text

## Completed Enhancements

- [x] Natural speech flow with sentence boundary detection
- [x] Integration with voiceStreaming service
- [x] Emotional tone mapping via unifiedSentiment
- [x] Context-aware response generation

## Future Enhancements

- [ ] Neural emotion detection (transformer-based)
- [ ] Context-aware unit selection
- [ ] Multi-language support
- [ ] Voice cloning integration
- [ ] Real-time prosody adjustment
- [ ] Breathing and thinking sound synthesis
