import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { useLogsStore } from '../stores';
import { suggestionService, Suggestion } from '../services/suggestions';

interface TerminalProps {
  onCommand: (cmd: string) => void;
  isProcessing: boolean;
}

// Command history configuration
const MAX_HISTORY_SIZE = 50;

export const Terminal: React.FC<TerminalProps> = ({ onCommand, isProcessing }) => {
  const logs = useLogsStore((s) => s.filteredLogs);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    // Load history from localStorage
    const saved = localStorage.getItem('jarvis_command_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(''); // Store current input when navigating history
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get suggestions based on current input
  const suggestions = useMemo(() => {
    if (isProcessing) return [];
    return suggestionService.getSuggestions(input, 5);
  }, [input, isProcessing]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('jarvis_command_history', JSON.stringify(commandHistory));
  }, [commandHistory]);

  // Show/hide suggestions based on input focus and content
  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && !isProcessing);
    setSelectedSuggestion(0);
  }, [suggestions, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    // Add to history (avoid duplicates of last command)
    const trimmedInput = input.trim();
    if (commandHistory[0] !== trimmedInput) {
      const newHistory = [trimmedInput, ...commandHistory].slice(0, MAX_HISTORY_SIZE);
      setCommandHistory(newHistory);
    }
    
    // Record for suggestions
    suggestionService.recordCommand(trimmedInput);
    
    onCommand(trimmedInput);
    setInput('');
    setHistoryIndex(-1);
    setShowSuggestions(false);
    setTempInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab completion for suggestions
    if (e.key === 'Tab' && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      const selected = suggestions[selectedSuggestion];
      if (selected) {
        setInput(selected.text);
        setShowSuggestions(false);
      }
      return;
    }

    // Navigate suggestions with Ctrl+N/P or when suggestions are shown
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
    }

    // History navigation (only when not using Ctrl)
    if (e.key === 'ArrowUp' && !e.ctrlKey && commandHistory.length > 0) {
      e.preventDefault();
      
      // Save current input when first pressing up
      if (historyIndex === -1) {
        setTempInput(input);
      }
      
      // Navigate up in history
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
      
      // Move cursor to end
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current.value.length;
          inputRef.current.selectionEnd = inputRef.current.value.length;
        }
      }, 0);
    } else if (e.key === 'ArrowDown' && !e.ctrlKey && commandHistory.length > 0) {
      e.preventDefault();
      
      if (historyIndex > 0) {
        // Navigate down in history
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        // Return to original input
        setHistoryIndex(-1);
        setInput(tempInput);
      }
    } else if (e.key === 'Escape') {
      // Clear input and reset history navigation
      setInput('');
      setHistoryIndex(-1);
      setTempInput('');
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    setInput(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.focus();
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
        {logs.map((log) => {
          // Handle case where source might be an object (edge case fix)
          const sourceStr = typeof log.source === 'string' ? log.source : 
                           typeof log.source === 'object' && log.source !== null ? 
                           (log.source as any).source || 'UNKNOWN' : 'UNKNOWN';
          
          return (
            <div key={log.id} className="text-sm break-words animate-fadeIn">
              <span className="text-gray-500 mr-2">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={`font-bold mr-2 ${sourceStr === 'USER' ? 'text-white' : 'text-cyan-600'}`}>
                {sourceStr}:
              </span>
              <span className={getTypeColor(log.type)}>{log.message}</span>
              {log.details && (
                <pre className="mt-1 ml-6 text-xs text-gray-500 overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
        {isProcessing && (
           <div className="text-sm text-cyan-500 animate-pulse ml-2">_ PROCESSING...</div>
        )}
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border-t border-cyan-900/30 bg-[#0a0a0a] px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span className="text-[10px] text-cyan-700 uppercase tracking-wider">Suggestions (Tab to complete)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => applySuggestion(suggestion)}
                className={`px-2 py-1 text-xs rounded border transition-all ${
                  idx === selectedSuggestion 
                    ? 'border-cyan-500 bg-cyan-950/50 text-cyan-300' 
                    : 'border-cyan-900/30 text-cyan-600 hover:border-cyan-700 hover:text-cyan-400'
                }`}
              >
                {suggestion.text}
                {suggestion.description && (
                  <span className="ml-1 text-gray-600">• {suggestion.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-center p-2 bg-[#111] border-t border-[#333]">
        <span className="text-cyan-500 mr-2">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 font-mono"
          placeholder="Enter command... (↑↓ history, Tab complete)"
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