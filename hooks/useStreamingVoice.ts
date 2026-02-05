/**
 * useStreamingVoice Hook v1.1
 * React hook for token-level streaming TTS integration
 * 
 * Usage:
 * const { startStreaming, onToken, endStreaming, isStreaming, isSpeaking } = useStreamingVoice();
 * 
 * // Start a session
 * startStreaming('PIPER');
 * 
 * // Feed tokens as they arrive from AI
 * onToken('Hello ');
 * onToken('world');
 * onToken('!');
 * 
 * // End the session
 * endStreaming();
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { voiceStreaming, StreamingMetrics, StreamingTTSConfig } from '../services/voiceStreaming';

export interface UseStreamingVoiceReturn {
  /** Start a new streaming session */
  startStreaming: (voiceType?: 'SYSTEM' | 'PIPER' | 'GEMINI') => string | null;
  /** Feed a token to the streaming engine */
  onToken: (token: string) => boolean;
  /** End the current streaming session */
  endStreaming: () => Promise<StreamingMetrics | null>;
  /** Abort current session immediately */
  abortStreaming: () => void;
  /** Whether a streaming session is active */
  isStreaming: boolean;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Current session buffer content */
  currentBuffer: string;
  /** Number of tokens received this session */
  tokensReceived: number;
  /** Number of tokens spoken this session */
  tokensSpoken: number;
  /** Update streaming configuration */
  setConfig: (config: Partial<StreamingTTSConfig>) => void;
  /** Get recent performance metrics */
  getMetrics: (count?: number) => StreamingMetrics[];
  /** Get average performance stats */
  getAverageStats: () => {
    avgTimeToFirstSpeech: number;
    avgTotalLatency: number;
    avgEfficiency: number;
    totalSessions: number;
  };
}

export function useStreamingVoice(): UseStreamingVoiceReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentBuffer, setCurrentBuffer] = useState('');
  const [tokensReceived, setTokensReceived] = useState(0);
  const [tokensSpoken, setTokensSpoken] = useState(0);
  
  // Use refs for interval updates without re-renders
  const sessionRef = useRef(voiceStreaming.getSession());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for state updates - only when streaming
  useEffect(() => {
    if (!isStreaming) return; // Only poll when streaming
    
    intervalRef.current = setInterval(() => {
      const session = voiceStreaming.getSession();
      sessionRef.current = session;
      
      if (session) {
        setIsSpeaking(voiceStreaming.isSpeaking());
        setCurrentBuffer(session.buffer);
        setTokensReceived(session.tokensReceived);
        setTokensSpoken(session.tokensSpoken);
      } else {
        // Session ended externally
        setIsStreaming(false);
        setIsSpeaking(false);
        setCurrentBuffer('');
        setTokensReceived(0);
        setTokensSpoken(0);
      }
    }, 100); // 100ms poll interval

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isStreaming]);

  const startStreaming = useCallback((voiceType?: 'SYSTEM' | 'PIPER' | 'GEMINI'): string | null => {
    const sessionId = voiceStreaming.startSession(voiceType);
    setIsStreaming(true);
    return sessionId;
  }, []);

  const onToken = useCallback((token: string): boolean => {
    return voiceStreaming.onToken(token);
  }, []);

  const endStreaming = useCallback(async (): Promise<StreamingMetrics | null> => {
    const metrics = await voiceStreaming.endSession();
    setIsStreaming(false);
    setIsSpeaking(false);
    return metrics;
  }, []);

  const abortStreaming = useCallback((): void => {
    voiceStreaming.abort();
    setIsStreaming(false);
    setIsSpeaking(false);
    setCurrentBuffer('');
  }, []);

  const setConfig = useCallback((config: Partial<StreamingTTSConfig>): void => {
    voiceStreaming.setConfig(config);
  }, []);

  const getMetrics = useCallback((count?: number): StreamingMetrics[] => {
    return voiceStreaming.getMetrics(count);
  }, []);

  const getAverageStats = useCallback(() => {
    return voiceStreaming.getAverageStats();
  }, []);

  // Note: We don't abort on unmount because voiceStreaming is a singleton
  // Multiple components might share the same session
  // Users should manually call abortStreaming() if needed

  return {
    startStreaming,
    onToken,
    endStreaming,
    abortStreaming,
    isStreaming,
    isSpeaking,
    currentBuffer,
    tokensReceived,
    tokensSpoken,
    setConfig,
    getMetrics,
    getAverageStats
  };
}

export default useStreamingVoice;
