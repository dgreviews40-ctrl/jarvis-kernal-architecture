

import { VoiceState, VoiceConfig, VoiceType } from "../types";
import { conversation } from "./conversation";
import { GoogleGenAI, Modality } from "@google/genai";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    AudioContext: any;
    webkitAudioContext: any;
  }
}

const DEFAULT_CONFIG: VoiceConfig = {
  wakeWord: "jarvis",
  voiceType: 'SYSTEM',
  voiceName: 'Kore', 
  rate: 1.0,
  pitch: 1.0
};

function decodeBase64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

class VoiceCore {
  private recognition: any = null;
  private synthesis: SpeechSynthesis = window.speechSynthesis;
  private state: VoiceState = VoiceState.MUTED;
  private config: VoiceConfig = { ...DEFAULT_CONFIG };
  private observers: ((state: VoiceState) => void)[] = [];
  private transcriptObservers: ((text: string, isFinal: boolean) => void)[] = [];
  private onCommandCallback: ((text: string) => void) | null = null;
  
  private restartTimer: number | null = null;
  private errorCount: number = 0; 
  private audioContext: AudioContext | null = null;
  
  private isRestarting: boolean = false;
  private sessionStartTime: number = 0;
  private lastManualActivation: number = 0;
  private hasProcessedSpeech: boolean = false;
  private consecutiveShortSessions: number = 0;

  constructor() {
    const saved = localStorage.getItem('jarvis_voice_config');
    if (saved) {
      try { this.config = { ...this.config, ...JSON.parse(saved) }; } catch (e) {}
    }
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;
    if (this.recognition) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true; 
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.onresult = (event: any) => this.handleResult(event);
        this.recognition.onerror = (event: any) => this.handleError(event);
        this.recognition.onend = () => this.handleEnd();
        this.recognition.onstart = () => {
            this.sessionStartTime = Date.now();
            this.hasProcessedSpeech = false;
        };
      } catch (e) {
        this.setState(VoiceState.ERROR);
      }
    } else {
      this.setState(VoiceState.ERROR);
    }
  }

  public subscribe(callback: (state: VoiceState) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  public subscribeToTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.transcriptObservers.push(callback);
    return () => {
        this.transcriptObservers = this.transcriptObservers.filter(cb => cb !== callback);
    };
  }

  public setCommandCallback(cb: (text: string) => void) {
    this.onCommandCallback = cb;
  }

  private setState(newState: VoiceState) {
    if (this.state === newState) return;
    this.state = newState;
    this.observers.forEach(cb => cb(newState));
  }

  private emitTranscript(text: string, isFinal: boolean) {
      this.transcriptObservers.forEach(cb => cb(text, isFinal));
  }

  public getState(): VoiceState {
    return this.state;
  }

  public setConfig(config: VoiceConfig) {
    this.config = config;
    localStorage.setItem('jarvis_voice_config', JSON.stringify(config));
  }

  public getConfig(): VoiceConfig {
    return this.config;
  }

  public toggleMute() {
    if (this.state === VoiceState.MUTED || this.state === VoiceState.ERROR) {
      this.errorCount = 0; 
      this.consecutiveShortSessions = 0;
      this.startListening();
      this.setState(VoiceState.LISTENING); 
      this.lastManualActivation = Date.now();
      return;
    }

    if (this.state === VoiceState.IDLE) {
        this.errorCount = 0;
        this.startListening();
        this.setState(VoiceState.LISTENING);
        return;
    }

    if (this.state === VoiceState.LISTENING || this.state === VoiceState.SPEAKING) {
        this.setState(VoiceState.IDLE);
    }
  }

  public setPower(on: boolean) {
      if (on) {
          this.errorCount = 0;
          this.consecutiveShortSessions = 0;
          this.startListening();
      } else {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          if (this.recognition) {
             this.recognition.onend = () => {}; 
             this.recognition.abort();
             this.recognition = null;
          }
          this.setState(VoiceState.MUTED);
      }
  }

  private startListening() {
    if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
    }

    if (this.isRestarting) return;
    this.isRestarting = true;

    try {
        this.lastManualActivation = Date.now();
        if (this.recognition) {
            this.recognition.onend = () => {}; 
            try { this.recognition.abort(); } catch(e) {}
            this.recognition = null;
        }
        
        setTimeout(() => {
            try {
                this.initRecognition();
                // Check if current state allows starting recognition.
                // initRecognition might have failed and set state to ERROR.
                if (this.state !== VoiceState.MUTED && this.state !== VoiceState.ERROR) {
                    this.recognition?.start();
                    // Fix: Removed impossible check here as state is narrowed to non-MUTED/ERROR
                }
            } catch(e) {
                this.setState(VoiceState.ERROR);
            } finally {
                this.isRestarting = false;
            }
        }, 100); 
      } catch (e) {
        this.setState(VoiceState.ERROR);
        this.isRestarting = false;
      }
  }

  public interrupt() {
    if (this.config.voiceType === 'SYSTEM') {
      if (this.synthesis.speaking || this.synthesis.pending) {
          this.synthesis.cancel();
          this.onSpeakComplete();
      }
    } else {
      // For Neural, we just stop the context
      if (this.audioContext) {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
        this.onSpeakComplete();
      }
    }
  }

  private onSpeakComplete() {
    this.setState(VoiceState.IDLE);
    conversation.addTurn('JARVIS', "Interrupted");
  }

  public async speak(text: string) {
    if (this.state === VoiceState.MUTED || this.state === VoiceState.ERROR) return;
    this.interrupt(); 
    this.setState(VoiceState.SPEAKING);

    if (this.config.voiceType === 'SYSTEM') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(v => v.name === this.config.voiceName) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.onend = () => this.setState(VoiceState.IDLE);
      this.synthesis.speak(utterance);
    } else {
      // NEURAL GEMINI TTS
      try {
        // Try localStorage first, then fall back to process.env (same pattern as gemini.ts)
        const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
        const apiKey = storedKey || process.env.API_KEY;
        
        if (!apiKey) {
          console.error("Neural TTS Failed: No API key configured. Please add your Gemini API key in Settings > API & Security.");
          this.setState(VoiceState.IDLE);
          return;
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: this.config.voiceName as any },
                },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio returned");

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
        this.audioContext = audioCtx;
        
        const audioBuffer = await decodeRawPCM(
          decodeBase64ToUint8Array(base64Audio),
          audioCtx,
          24000,
          1,
        );

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
          this.setState(VoiceState.IDLE);
          this.audioContext = null;
        };
        source.start();

      } catch (e) {
        console.error("Neural TTS Failed:", e);
        this.setState(VoiceState.IDLE);
      }
    }
    conversation.addTurn('JARVIS', text);
  }

  private handleResult(event: any) {
    this.hasProcessedSpeech = true; 
    this.errorCount = 0;
    this.consecutiveShortSessions = 0;
    let interimTranscript = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      else interimTranscript += event.results[i][0].transcript;
    }
    const transcript = (finalTranscript || interimTranscript).toLowerCase().trim();
    if (!transcript) return;
    this.emitTranscript(transcript, !!finalTranscript);
    
    // Only interrupt speech if user says a deliberate interrupt phrase (final transcript only)
    // This prevents background noise or partial speech from cutting off JARVIS
    if (this.state === VoiceState.SPEAKING && finalTranscript) {
       const interruptPhrases = ['stop', 'cancel', 'shut up', 'be quiet', 'enough', 'okay stop', 'jarvis stop', 'hey stop'];
       const shouldInterrupt = interruptPhrases.some(phrase => transcript.includes(phrase));
       if (shouldInterrupt) {
         this.interrupt();
         this.setState(VoiceState.LISTENING);
         return;
       }
       // Otherwise ignore speech input while JARVIS is talking
       return;
    }
    
    if (this.state === VoiceState.IDLE || this.state === VoiceState.INTERRUPTED) {
      if (transcript.includes(this.config.wakeWord) || transcript.includes("jarvis")) {
        this.setState(VoiceState.LISTENING);
        this.lastManualActivation = Date.now(); 
      }
    } else if (this.state === VoiceState.LISTENING) {
      if (finalTranscript) {
        let cleanText = finalTranscript.trim();
        if (cleanText) {
          this.setState(VoiceState.PROCESSING);
          conversation.addTurn('USER', cleanText);
          this.onCommandCallback?.(cleanText);
        }
      }
    }
  }

  private handleError(event: any) {
    const error = event.error;
    if (error === 'no-speech' || error === 'aborted' || error === 'audio-capture' || error === 'network') return; 
    this.errorCount++;
    if (error === 'not-allowed') this.setState(VoiceState.ERROR);
  }

  private handleEnd() {
    if (this.state === VoiceState.ERROR || this.isRestarting) return;
    if (this.state !== VoiceState.MUTED) {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const isShortSession = sessionDuration < 500 && !this.hasProcessedSpeech;
      if (isShortSession) this.consecutiveShortSessions++;
      else this.consecutiveShortSessions = 0;
      let delay = 50; 
      if (this.consecutiveShortSessions > 5) delay = 5000;
      else if (this.errorCount > 0) delay = Math.min(10000, 500 * Math.pow(1.5, this.errorCount));
      this.restartTimer = window.setTimeout(() => {
        try {
          if (this.state !== VoiceState.MUTED && this.state !== VoiceState.ERROR) {
              try { this.recognition?.start(); } catch(e) { this.startListening(); }
              if (this.state === VoiceState.LISTENING) {
                  if (Date.now() - this.lastManualActivation > 15000) this.setState(VoiceState.IDLE);
              }
          }
        } catch (e) { }
      }, delay);
    }
  }
}

export const voice = new VoiceCore();