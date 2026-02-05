# Voice Interface v1.1 Upgrade Plan

## Current State (v1.0.0)

The Voice Interface currently provides:
- **Speech Recognition**: Browser Web Speech API with Whisper fallback
- **Text-to-Speech**: System voice, Piper (local), Gemini (neural)
- **Wake Word**: "Jarvis" with fuzzy matching
- **Basic VAD**: Voice Activity Detection for end-of-speech
- **Performance Monitoring**: Latency tracking

---

## Proposed v1.1 Features

### 🎯 Tier 1: High Impact (Recommended for v1.1)

#### 1. **Voice Command Shortcuts / Quick Actions**
**Description**: Allow users to define custom voice shortcuts for common actions.

**Example**:
- "What's the weather?" → Automatically runs weather tool
- "Turn on the lights" → Triggers home assistant light control
- "Take a screenshot" → Captures screen

**Implementation**:
```typescript
interface VoiceCommand {
  id: string;
  phrases: string[];          // "turn on the lights", "lights on"
  action: string;             // Tool name or callback
  parameters?: Record<string, any>;
  enabled: boolean;
}

// Registry in services/voiceCommands.ts
class VoiceCommandRegistry {
  register(command: VoiceCommand): void;
  match(transcript: string): MatchedCommand | null;
}
```

**Value**: Reduces latency by skipping AI inference for common commands.

---

#### 2. **Streaming TTS with Token-Level Synchronization**
**Description**: Currently TTS streams by sentence chunks. v1.1 would synchronize TTS with AI token generation for faster response.

**Current**: AI generates full response → TTS speaks
**v1.1**: AI generates tokens → TTS speaks first sentence while AI continues

**Implementation**:
```typescript
interface StreamingTTSSession {
  buffer: string;
  speaking: boolean;
  onToken(token: string): void;      // Called as AI generates
  flush(): void;                      // Speak buffered content
}
```

**Value**: 30-50% faster perceived response time.

---

#### 3. **Speaker Diarization / Multi-User Support**
**Description**: Distinguish between different speakers in the conversation.

**Features**:
- Identify who's speaking (user A, user B)
- Per-user voice profiles
- Per-user wake word sensitivity

**Implementation**:
```typescript
interface SpeakerProfile {
  id: string;
  name: string;
  voiceSignature: Float32Array;  // Voice embedding
  preferences: VoicePreferences;
}

// In voice.ts
class SpeakerRecognition {
  identifySpeaker(audioFeatures: AudioFeatures): string | null;
  enrollSpeaker(name: string, samples: AudioFeatures[]): SpeakerProfile;
}
```

**Value**: Multi-user households, personalized responses.

---

#### 4. **Advanced Barge-in / Interruption Handling**
**Description**: Better handling of interruptions during TTS playback.

**Current**: User can interrupt with "stop"
**v1.1**: 
- Detect interruption intent from tone/inflection
- Visual indicator when barge-in is available
- Smart continuation ("...as I was saying")

**Implementation**:
```typescript
interface BargeInConfig {
  enabled: boolean;
  visualIndicator: boolean;
  triggerPhrases: string[];
  toneDetection: boolean;  // Detect urgency in voice
}
```

**Value**: More natural conversation flow.

---

### 🎯 Tier 2: Medium Impact (Future or v1.1.x)

#### 5. **Voice Analytics Dashboard**
**Description**: Track and visualize voice usage metrics.

**Metrics**:
- Wake word detection rate
- STT accuracy over time
- TTS latency trends
- Command frequency heatmap
- Error rate by time of day

**Implementation**:
```typescript
// New file: services/voiceAnalytics.ts
interface VoiceMetrics {
  timestamp: number;
  wakeWordDetected: boolean;
  sttLatency: number;
  ttsLatency: number;
  transcript: string;
  error?: string;
}

class VoiceAnalytics {
  record(metric: VoiceMetrics): void;
  getStats(timeRange: [Date, Date]): AnalyticsReport;
  export(): VoiceMetrics[];
}
```

---

#### 6. **Custom Wake Word Training**
**Description**: Allow users to train their own wake word beyond "Jarvis".

**Features**:
- Record 3-5 samples of custom wake word
- Train lightweight model (TinyML)
- Store in localStorage

**Implementation**:
```typescript
interface WakeWordTraining {
  name: string;
  samples: Blob[];  // Audio samples
  threshold: number;
  model?: ArrayBuffer;  // Trained model
}

// New file: services/wakeWordTraining.ts
class WakeWordTrainer {
  startTraining(name: string): TrainingSession;
  recordSample(sessionId: string, audio: Blob): void;
  completeTraining(sessionId: string): WakeWordModel;
}
```

---

#### 7. **Voice Emotion Detection**
**Description**: Detect user's emotional state from voice for empathetic responses.

**Emotions**: Happy, sad, frustrated, excited, tired, neutral

**Implementation**:
```typescript
interface EmotionDetection {
  detect(audioFeatures: AudioFeatures): Emotion;
}

type Emotion = 'happy' | 'sad' | 'frustrated' | 'excited' | 'tired' | 'neutral';

// Usage in voice.ts
const emotion = emotionDetector.detect(audioFeatures);
if (emotion === 'frustrated') {
  // Use calmer voice, more patient responses
}
```

---

#### 8. **Language Auto-Detection & Multi-Language**
**Description**: Automatically detect spoken language and respond appropriately.

**Features**:
- Auto-detect language from audio
- Seamless switching between languages
- Language-specific voice models

**Implementation**:
```typescript
interface LanguageConfig {
  primary: string;      // 'en-US'
  secondary: string[];  // ['es-ES', 'fr-FR']
  autoDetect: boolean;
}

// Extend whisperSTT.ts
whisperSTT.setConfig({
  autoDetectLanguage: true,
  supportedLanguages: ['en', 'es', 'fr', 'de']
});
```

---

### 🎯 Tier 3: Nice to Have (v1.2+)

#### 9. **Voice Activity Visualization**
**Description**: Real-time waveform/FFT visualization for voice feedback.

**Already exists**: `services/audioAnalyzer.ts` - integrate with UI

---

#### 10. **Offline Wake Word (TensorFlow.js)**
**Description**: Run wake word detection entirely in browser without server.

**Implementation**:
- Use TensorFlow.js with pre-trained wake word model
- Falls back to server only for transcription

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Voice Command Shortcuts | Medium | High |
| P0 | Streaming TTS | Medium | High |
| P1 | Speaker Diarization | High | Medium |
| P1 | Advanced Barge-in | Low | Medium |
| P2 | Voice Analytics | Medium | Low |
| P2 | Custom Wake Word | High | Low |
| P2 | Emotion Detection | High | Medium |
| P3 | Multi-Language | Medium | Medium |

---

## Updated Registry Entry (v1.1.0)

```typescript
{
  id: "plugin.voice",
  name: "Voice Interface",
  version: "1.1.0",
  description: "Advanced speech recognition with command shortcuts, streaming TTS, multi-user support, and speaker diarization.",
  author: "JARVIS",
  permissions: ["AUDIO_INPUT", "AUDIO_OUTPUT", "MEMORY_READ", "MEMORY_WRITE"],
  provides: [
    "speech_recognition", 
    "speech_synthesis",
    "voice_commands",
    "speaker_recognition",
    "barge_in",
    "voice_analytics"
  ],
  requires: ["os_level_control", "ai_inference"],
  priority: 75,
  capabilities: [
    "voice_input", 
    "voice_output", 
    "wake_word",
    "command_shortcuts",
    "streaming_tts",
    "speaker_diarization",
    "barge_in_detection",
    "multi_user"
  ]
}
```

---

## Files to Create/Modify

### New Files
1. `services/voiceCommands.ts` - Command shortcut registry
2. `services/voiceStreaming.ts` - Token-level TTS synchronization
3. `services/speakerRecognition.ts` - Multi-user speaker ID
4. `services/voiceAnalytics.ts` - Usage metrics and analytics
5. `components/VoiceCommandEditor.tsx` - UI for managing shortcuts
6. `components/VoiceAnalyticsDashboard.tsx` - Analytics visualization

### Modified Files
1. `services/voice.ts` - Add command shortcuts, barge-in improvements
2. `services/whisperSTT.ts` - Add speaker diarization hooks
3. `services/piperTTS.ts` - Add streaming token support
4. `services/registry.ts` - Update version to 1.1.0

---

## Migration Path

1. **Phase 1**: Implement Voice Command Shortcuts (backwards compatible)
2. **Phase 2**: Add Streaming TTS (feature flag)
3. **Phase 3**: Speaker Diarization (opt-in feature)
4. **Phase 4**: Update registry version and documentation

---

## Success Metrics

- **Latency**: Reduce TTS start time by 30%
- **Accuracy**: Maintain >95% wake word detection
- **Adoption**: 50% of users create at least 1 custom command
- **Performance**: No increase in CPU/memory usage

---

**Date**: 2026-02-05  
**Status**: Planning Phase
