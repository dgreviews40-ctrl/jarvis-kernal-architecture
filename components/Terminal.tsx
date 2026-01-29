import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal as TerminalIcon } from 'lucide-react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  onCommand: (cmd: string) => void;
  isProcessing: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, onCommand, isProcessing }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onCommand(input);
    setInput('');
  };

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden shadow-2xl font-mono">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-[#111] border-b border-[#333]">
        <TerminalIcon className="w-4 h-4 text-cyan-500 mr-2" />
        <span className="text-sm text-gray-400">JARVIS.EXE - TERMINAL</span>
      </div>

      {/* Logs Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 && (
          <div className="text-gray-600 italic">System ready. Waiting for input...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="text-sm break-words animate-fadeIn">
            <span className="text-gray-500 mr-2">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={`font-bold mr-2 ${log.source === 'USER' ? 'text-white' : 'text-cyan-600'}`}>
              {log.source}:
            </span>
            <span className={getTypeColor(log.type)}>{log.message}</span>
            {log.details && (
              <pre className="mt-1 ml-6 text-xs text-gray-500 overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {isProcessing && (
           <div className="text-sm text-cyan-500 animate-pulse ml-2">_ PROCESSING...</div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-center p-2 bg-[#111] border-t border-[#333]">
        <span className="text-cyan-500 mr-2">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 font-mono"
          placeholder="Enter command or query..."
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};