import React, { useEffect, useState, useRef } from 'react';
import { VoiceState, Session } from '../types';
import { conversation } from '../services/conversation';
import { voice } from '../services/voice';
import { piperLauncher, PiperLauncherState } from '../services/piperLauncher';
import { useKernelStore } from '../stores';
import { Mic, MicOff, Volume2, Activity, Loader2, AlertTriangle, MessageSquare, XCircle, Power, Server, Cpu } from 'lucide-react';

interface VoiceHUDProps {
  onToggle: () => void;
}

export const VoiceHUD: React.FC<VoiceHUDProps> = ({ onToggle }) => {
  // Get voice state from kernel store
  const state = useKernelStore((s) => s.voiceState);
  const [session, setSession] = useState<Session | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [piperStatus, setPiperStatus] = useState<PiperLauncherState>('CHECKING');
  const [voiceConfig, setVoiceConfig] = useState(voice.getConfig());
  const [usingWhisper, setUsingWhisper] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const update = () => setSession({...conversation.getSession()!} as Session);
      const unsub = conversation.subscribe(update);
      
      // Subscribe to live audio text
      const unsubTranscript = voice.subscribeToTranscript((text, isFinal) => {
          setLiveTranscript(text);
          if (isFinal) {
              setTimeout(() => setLiveTranscript(""), 1000); // Clear after delay
          }
      });

      // Subscribe to Piper status if using Piper voice
      const unsubPiper = piperLauncher.subscribe((status) => {
          setPiperStatus(status.state);
      });
      
      // Trigger initial Piper status check
      piperLauncher.checkStatus();
      
      // Update voice config when it changes
      const updateVoiceConfig = () => setVoiceConfig(voice.getConfig());
      
      // Check if using Whisper
      const checkWhisper = async () => {
        const available = await voice.checkWhisperAvailable();
        setUsingWhisper(voice.isUsingWhisper());
      };
      
      // Poll for Whisper status
      const whisperInterval = setInterval(() => {
        setUsingWhisper(voice.isUsingWhisper());
      }, 1000);
      
      update();
      updateVoiceConfig();
      checkWhisper();
      
      return () => {
          unsub();
          unsubTranscript();
          unsubPiper();
          clearInterval(whisperInterval);
      };
  }, []);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [session?.turns.length]);

  const isMuted = state === VoiceState.MUTED;
  const isError = state === VoiceState.ERROR;
  const isOffline = isMuted || isError;

  const getStateDetails = () => {
    switch (state) {
      case VoiceState.IDLE: 
        return { color: 'text-gray-500', bg: 'bg-gray-500/10', text: "PASSIVE (SAY 'JARVIS')", icon: <Mic size={20} /> };
      case VoiceState.LISTENING: 
        return { color: 'text-red-500', bg: 'bg-red-500/10', text: 'LISTENING (ACTIVE)', icon: <Activity size={20} className="animate-pulse" /> };
      case VoiceState.PROCESSING: 
        return { color: 'text-cyan-500', bg: 'bg-cyan-500/10', text: 'PROCESSING...', icon: <Loader2 size={20} className="animate-spin" /> };
      case VoiceState.SPEAKING: 
        return { color: 'text-green-500', bg: 'bg-green-500/10', text: 'SPEAKING', icon: <Volume2 size={20} className="animate-pulse" /> };
      case VoiceState.INTERRUPTED:
        return { color: 'text-orange-500', bg: 'bg-orange-500/10', text: 'INTERRUPTED', icon: <XCircle size={20} /> };
      case VoiceState.ERROR: 
        return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', text: 'VOICE ERROR - CHECK CONSOLE', icon: <AlertTriangle size={20} /> };
      default: 
        return { color: 'text-gray-700', bg: 'bg-gray-900', text: 'VOICE MUTED', icon: <MicOff size={20} /> };
    }
  };

  const details = getStateDetails();

  return (
    <div className={`
      flex flex-col gap-2 p-4 rounded-lg border transition-all duration-300 relative
      ${isOffline ? 'border-[#333] bg-[#0a0a0a]' : `border-${details.color.split('-')[1]}-900 ${details.bg}`}
    `}>
      
      {/* Power Toggle (Absolute Top Right) */}
      <button
         onClick={() => {
           const newPowerState = isOffline;
           voice.setPower(newPowerState);
         }}
         className={`absolute top-2 right-2 p-1.5 rounded-full border hover:scale-110 transition-all ${isOffline ? 'border-red-900 text-red-900' : 'border-green-500/30 text-green-500 bg-green-500/10'}`}
         title={isOffline ? "Power On Voice System" : "Power Off Voice System"}
      >
          <Power size={12} />
      </button>

      {/* Top Bar: Status */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-4">
            <button
            onClick={() => {
              onToggle();
            }}
            title={state === VoiceState.IDLE ? "Wake Jarvis" : "Stop Listening"}
            className={`p-3 rounded-full border transition-all hover:scale-105 active:scale-95 ${isOffline ? 'bg-gray-800 border-gray-700 text-gray-400' : `${details.color} border-current`}`}
            >
            {details.icon}
            </button>
            
            <div className="flex flex-col">
            <span className={`text-xs font-bold font-mono tracking-widest ${details.color}`}>
                VOICE PIPELINE
            </span>
            <span className="text-sm font-bold text-white">
                {details.text}
            </span>
            </div>
            
            {/* Whisper STT Indicator */}
            {usingWhisper && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono bg-purple-950/30 border-purple-800/50 text-purple-400">
                <Cpu size={10} />
                WHISPER
              </div>
            )}
            
            {/* Piper Status Indicator - Only show when using Piper voice */}
            {voiceConfig.voiceType === 'PIPER' && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono
                ${piperStatus === 'RUNNING' 
                  ? 'bg-green-950/30 border-green-800/50 text-green-400' 
                  : 'bg-yellow-950/30 border-yellow-800/50 text-yellow-400'}`}>
                <Server size={10} />
                {piperStatus === 'RUNNING' ? 'PIPER ✓' : 
                 piperStatus === 'CHECKING' ? 'PIPER ...' :
                 piperStatus === 'STARTING' ? 'PIPER ⏳' :
                 piperStatus === 'NOT_RUNNING' ? 'PIPER ✗' :
                 piperStatus === 'ERROR' ? 'PIPER !' : 'PIPER ?'}
              </div>
            )}
        </div>
      </div>

      {/* Real-time Hearing Indicator */}
      {!isMuted && !isError && (
          <div className="h-6 flex items-center px-1">
              {liveTranscript ? (
                  <span className="text-xs font-mono text-cyan-300 animate-pulse truncate">
                      {'>'} {liveTranscript}
                  </span>
              ) : (
                  <span className="text-[10px] text-gray-600 font-mono italic">
                      {state === VoiceState.LISTENING ? "Waiting for audio..." : "..."}
                  </span>
              )}
          </div>
      )}

      {/* Context History Window */}
      {!isMuted && session && (
          <div className="mt-2 bg-black/40 rounded border border-white/10 p-2 h-32 overflow-hidden flex flex-col relative">
              <div className="absolute top-1 right-1 text-[9px] text-gray-600 font-mono">SESSION: {session.id}</div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {session.turns.length === 0 && <div className="text-xs text-gray-600 italic text-center mt-4">No conversation context yet.</div>}
                  {session.turns.map(turn => (
                      <div key={turn.id} className={`text-xs flex flex-col ${turn.speaker === 'USER' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] p-1.5 rounded ${
                              turn.speaker === 'USER' 
                                ? 'bg-cyan-900/30 text-cyan-200 rounded-tr-none' 
                                : 'bg-gray-800/50 text-gray-300 rounded-tl-none'
                          }`}>
                              {turn.text}
                          </div>
                          {turn.interrupted && (
                              <span className="text-[9px] text-orange-500 font-bold flex items-center gap-1">
                                  <XCircle size={8} /> INTERRUPTED
                              </span>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};