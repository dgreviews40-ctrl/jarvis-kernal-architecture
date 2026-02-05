/**
 * Streaming Voice Demo Component v1.1
 * Demonstrates token-level TTS synchronization
 */

import React, { useState, useCallback } from 'react';
import { useStreamingVoice } from '../hooks/useStreamingVoice';
import { voiceStreaming } from '../services/voiceStreaming';

export const StreamingVoiceDemo: React.FC = () => {
  const {
    startStreaming,
    onToken,
    endStreaming,
    abortStreaming,
    isStreaming,
    isSpeaking,
    currentBuffer,
    tokensReceived,
    tokensSpoken,
    getAverageStats
  } = useStreamingVoice();

  const [logs, setLogs] = useState<string[]>([]);
  const [voiceType, setVoiceType] = useState<'SYSTEM' | 'PIPER' | 'GEMINI'>('PIPER');

  const addLog = useCallback((message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50));
  }, []);

  const handleStart = useCallback(() => {
    const sessionId = startStreaming(voiceType);
    addLog(`Started streaming session: ${sessionId}`);
  }, [startStreaming, voiceType, addLog]);

  const handleToken = useCallback((token: string) => {
    const triggered = onToken(token);
    addLog(`Token: "${token}" ${triggered ? '(triggered speech)' : '(buffered)'}`);
  }, [onToken, addLog]);

  const handleEnd = useCallback(async () => {
    const metrics = await endStreaming();
    addLog(`Session ended. Time to first speech: ${metrics?.timeToFirstSpeech.toFixed(0)}ms`);
  }, [endStreaming, addLog]);

  const handleAbort = useCallback(() => {
    abortStreaming();
    addLog('Session aborted');
  }, [abortStreaming, addLog]);

  const simulateStream = useCallback(async () => {
    try {
      const sessionId = startStreaming(voiceType);
      addLog(`Started simulation: ${sessionId}`);

      // Simulate AI generating tokens
      const sentences = [
        "Hello! ",
        "I'm JARVIS, ",
        "your AI assistant. ",
        "I can now speak ",
        "while I'm still thinking. ",
        "This makes conversations ",
        "feel much more natural ",
        "and responsive."
      ];

      for (const token of sentences) {
        if (!voiceStreaming.isStreaming()) break;
        
        const triggered = onToken(token);
        addLog(`Token: "${token}" ${triggered ? '🔊' : '⏳'}`);
        
        // Simulate variable generation speed
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      }

      await endStreaming();
      addLog('Simulation complete');
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      abortStreaming();
    }
  }, [startStreaming, voiceType, onToken, endStreaming, abortStreaming, addLog]);

  const stats = getAverageStats();

  return (
    <div className="bg-gray-900 text-cyan-400 font-mono p-6 rounded-lg max-w-4xl">
      <h2 className="text-2xl font-bold text-white mb-4">🎙️ Streaming Voice v1.1 Demo</h2>
      
      {/* Status Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Status</div>
          <div className={`font-bold ${isStreaming ? 'text-green-400' : 'text-gray-400'}`}>
            {isStreaming ? '● STREAMING' : '○ IDLE'}
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Speaking</div>
          <div className={`font-bold ${isSpeaking ? 'text-yellow-400' : 'text-gray-400'}`}>
            {isSpeaking ? '🔊 SPEAKING' : '🔇 SILENT'}
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Tokens</div>
          <div className="font-bold text-white">
            {tokensSpoken} / {tokensReceived}
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-xs text-gray-400">Buffer</div>
          <div className="font-bold text-white truncate" title={currentBuffer}>
            {currentBuffer.length} chars
          </div>
        </div>
      </div>

      {/* Voice Type Selector */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mr-2">Voice Type:</label>
        <select
          value={voiceType}
          onChange={(e) => setVoiceType(e.target.value as any)}
          className="bg-gray-800 text-white px-3 py-1 rounded border border-cyan-800"
          disabled={isStreaming}
        >
          <option value="PIPER">Piper (Local)</option>
          <option value="SYSTEM">System TTS</option>
          <option value="GEMINI">Gemini Neural</option>
        </select>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={handleStart}
          disabled={isStreaming}
          className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          Start Streaming
        </button>
        <button
          onClick={() => handleToken('Hello world! ')}
          disabled={!isStreaming}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          Send Token
        </button>
        <button
          onClick={handleEnd}
          disabled={!isStreaming}
          className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          End Session
        </button>
        <button
          onClick={handleAbort}
          disabled={!isStreaming}
          className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          Abort
        </button>
        <button
          onClick={simulateStream}
          disabled={isStreaming}
          className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          ▶ Simulate Stream
        </button>
      </div>

      {/* Performance Stats */}
      {stats.totalSessions > 0 && (
        <div className="bg-gray-800 p-4 rounded mb-6">
          <h3 className="text-lg font-bold text-white mb-2">Performance Stats ({stats.totalSessions} sessions)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Avg Time to First Speech:</span>
              <div className="text-cyan-400">{stats.avgTimeToFirstSpeech.toFixed(0)}ms</div>
            </div>
            <div>
              <span className="text-gray-400">Avg Total Latency:</span>
              <div className="text-cyan-400">{stats.avgTotalLatency.toFixed(0)}ms</div>
            </div>
            <div>
              <span className="text-gray-400">Efficiency:</span>
              <div className="text-cyan-400">{stats.avgEfficiency.toFixed(2)} chars/ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Buffer Display */}
      {isStreaming && (
        <div className="bg-gray-800 p-4 rounded mb-6">
          <h3 className="text-sm font-bold text-gray-400 mb-2">Current Buffer:</h3>
          <div className="text-white min-h-[3rem] whitespace-pre-wrap">
            {currentBuffer || <span className="text-gray-600 italic">Empty</span>}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="bg-black p-4 rounded h-64 overflow-y-auto font-mono text-sm">
        <h3 className="text-xs font-bold text-gray-500 mb-2 sticky top-0 bg-black pb-2">Event Log</h3>
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">No events yet...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-gray-300 mb-1">{log}</div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 text-sm text-gray-500">
        <h3 className="font-bold text-gray-400 mb-1">How it works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Click "Start Streaming" to begin a session</li>
          <li>Send tokens - they'll be buffered until a sentence delimiter (.!?) is found</li>
          <li>When a sentence is complete, TTS starts speaking immediately</li>
          <li>The AI can continue generating while TTS speaks</li>
          <li>Click "Simulate Stream" for an automated demo</li>
        </ul>
      </div>
    </div>
  );
};

export default StreamingVoiceDemo;
