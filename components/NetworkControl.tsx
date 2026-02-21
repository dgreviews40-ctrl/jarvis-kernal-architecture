import React from 'react';
import { Wifi, Cpu, Layers, Sparkles } from 'lucide-react';
import { AIProvider } from '../types';

interface NetworkControlProps {
  forcedMode: AIProvider | null;
  onToggle: () => void;
}

export const NetworkControl: React.FC<NetworkControlProps> = ({ forcedMode, onToggle }) => {
  const isOllama = forcedMode === AIProvider.OLLAMA;
  const isLoRA = forcedMode === AIProvider.LORA;
  const isGemini = forcedMode === AIProvider.GEMINI || (!isOllama && !isLoRA);

  // Determine styles based on provider
  const getStyles = () => {
    if (isLoRA) {
      return 'bg-purple-950/40 border-purple-900/50 text-purple-400 hover:bg-purple-900/30';
    }
    if (isOllama) {
      return 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900/30';
    }
    return 'bg-indigo-950/40 border-indigo-900/50 text-indigo-400 hover:bg-indigo-900/30';
  };

  // Determine icon and label
  const getIcon = () => {
    if (isLoRA) return <Sparkles size={14} />;
    if (isOllama) return <Layers size={14} />;
    return <Cpu size={14} />;
  };

  const getLabel = () => {
    if (isLoRA) return "Personal (LoRA)";
    if (isOllama) return "Local Ollama";
    return "Core Engine (Gemini)";
  };

  const getTitle = () => {
    if (isLoRA) return "Currently using Personal LoRA Adapter";
    if (isOllama) return "Currently using Local Ollama Model";
    return "Currently using Core Gemini Engine";
  };

  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border uppercase tracking-widest
        ${getStyles()}
      `}
      title={getTitle()}
    >
      {getIcon()}
      {getLabel()}
    </button>
  );
};