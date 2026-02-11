# Voice Service API

Speech recognition and text-to-speech for hands-free interaction.

## Quick Start

```typescript
import { voice } from './services/voice';

// Start listening
voice.startListening();

// Speak text
await voice.speak("Hello, I'm JARVIS");

// Stop everything
voice.stop();
```

---

## Speech Recognition

### `startListening(options?)`

Start listening for voice input.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `continuous` | `boolean` | false | Keep listening after result |
| `interimResults` | `boolean` | true | Show results while speaking |
| `language` | `string` | 'en-US' | Recognition language |

**Events:**

```typescript
// Listen for results
voice.onResult = (text, isFinal) => {
  if (isFinal) {
    console.log('Heard:', text);
  }
};

// Listen for errors
voice.onError = (error) => {
  console.error('Voice error:', error);
};

// Start listening
voice.startListening({ continuous: true });
```

---

### `stopListening()`

Stop speech recognition.

```typescript
voice.stopListening();
```

---

### `isListening()`

Check if currently listening.

```typescript
if (voice.isListening()) {
  console.log('Currently listening...');
}
```

---

## Text-to-Speech

### `speak(text, options?)`

Convert text to speech.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | `string` | - | Text to speak |
| `options.rate` | `number` | 1.0 | Speech rate (0.5-2.0) |
| `options.pitch` | `number` | 1.0 | Voice pitch (0.5-2.0) |
| `options.volume` | `number` | 1.0 | Volume (0-1) |
| `options.voice` | `string` | - | Voice ID |

**Returns:** `Promise<void>`

```typescript
// Basic usage
await voice.speak("Hello there");

// With options
await voice.speak("Hello there", {
  rate: 1.2,
  pitch: 0.9,
  volume: 0.8
});
```

---

### `stopSpeaking()`

Stop current speech.

```typescript
voice.stopSpeaking();
```

---

### `isSpeaking()`

Check if currently speaking.

```typescript
if (voice.isSpeaking()) {
  console.log('Currently speaking...');
}
```

---

## Wake Word Detection

### `enableWakeWord(word?)`

Enable wake word detection (default: "JARVIS").

```typescript
// Enable with default wake word
voice.enableWakeWord();

// Custom wake word
voice.enableWakeWord("Computer");

// Handle wake detection
voice.onWakeWord = () => {
  console.log('Wake word detected!');
  voice.speak("Yes?");
};
```

---

### `disableWakeWord()`

Disable wake word detection.

```typescript
voice.disableWakeWord();
```

---

## Piper TTS Integration

For high-quality local TTS:

```typescript
import { piperTTS } from './services/piperTTS';

// Check if available
if (piperTTS.isAvailable()) {
  // Use Piper for speech
  await piperTTS.speak("High quality local speech");
}
```

---

## Voice Streaming

Real-time token-by-token speech:

```typescript
import { voiceStreaming } from './services/voiceStreaming';

// Start streaming session
voiceStreaming.start();

// Add tokens as they arrive
voiceStreaming.addToken("Hello");
voiceStreaming.addToken("world");
voiceStreaming.addToken("!");

// End session
voiceStreaming.end();
```

---

## State Management

```typescript
// Get current state
type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';
const state = voice.getState();

// Subscribe to state changes
voice.onStateChange = (newState) => {
  console.log('Voice state:', newState);
};
```

---

## Configuration

```typescript
// Set default voice
voice.setDefaultVoice('en-US-Wavenet-D');

// Set default language
voice.setLanguage('en-US');

// Configure recognition
voice.setRecognitionConfig({
  maxAlternatives: 3,
  continuous: false
});
```

---

## Events

```typescript
// All voice events
voice.on('start', () => console.log('Started listening'));
voice.on('end', () => console.log('Stopped listening'));
voice.on('result', (text) => console.log('Result:', text));
voice.on('error', (error) => console.error('Error:', error));
```

---

## Error Handling

```typescript
try {
  await voice.speak("Hello");
} catch (error) {
  switch (error.code) {
    case 'VOICE_NOT_SUPPORTED':
      // Browser doesn't support TTS
      break;
    case 'VOICE_NOT_FOUND':
      // Requested voice not available
      break;
    case 'PERMISSION_DENIED':
      // Microphone permission denied
      break;
  }
}
```

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Speech Recognition | ✅ | ❌ | ❌ | ✅ |
| Speech Synthesis | ✅ | ✅ | ✅ | ✅ |
| Wake Word | ✅ | ❌ | ❌ | ✅ |

---

## See Also

- `audioAnalyzer.ts` - Audio visualization
- `whisperSTT.ts` - Whisper speech-to-text
- `piperTTS.ts` - Local TTS
