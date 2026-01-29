import React from 'react';
import { Wifi, Cpu, Layers } from 'lucide-react';
import { AIProvider } from '../types';

interface NetworkControlProps {
  forcedMode: AIProvider | null;
  onToggle: () => void;
}

export const NetworkControl: React.FC<NetworkControlProps> = ({ forcedMode, onToggle }) => {
  const isSimulated = forcedMode === AIProvider.OLLAMA;
  const isCore = forcedMode === AIProvider.GEMINI;

  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border uppercase tracking-widest
        ${isSimulated 
          ? 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900/30' 
          : 'bg-indigo-950/40 border-indigo-900/50 text-indigo-400 hover:bg-indigo-900/30'}
      `}
      title={isSimulated ? "Currently using Local Ollama Model" : "Currently using Core Gemini Engine"}
    >
      {isSimulated ? <Layers size={14} /> : <Cpu size={14} />}
      {isSimulated ? "Local Ollama" : "Core Engine (Gemini)"}
    </button>
  );
};