import React, { useEffect, useState, useRef } from 'react';
import { BootPhase, BootState } from '../types';
import { bootLoaderFast, BOOT_PHASES_FAST } from '../services/bootFast';
import { KERNEL_VERSION } from '../stores/kernelStore';
import { Terminal, CheckCircle, Cpu } from 'lucide-react';

interface BootSequenceFastProps {
  onComplete: () => void;
}

export const BootSequenceFast: React.FC<BootSequenceFastProps> = ({ onComplete }) => {
  const [currentPhase, setCurrentPhase] = useState<BootPhase>(BOOT_PHASES_FAST[0]);
  const [history, setHistory] = useState<BootPhase[]>([]);
  const [bootState, setBootState] = useState<BootState>(BootState.BOOTSTRAP);
  const [bootTime, setBootTime] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bootStartTime = useRef<number>(Date.now());

  useEffect(() => {
    // Start the fast sequence
    bootLoaderFast.subscribe((phase, state) => {
      setCurrentPhase(phase);
      setBootState(state);
      
      if (phase.status === 'SUCCESS') {
         setHistory(prev => {
            const exists = prev.find(p => p.id === phase.id);
            return exists ? prev : [...prev, phase];
         });
      }

      if (state === BootState.RUNNING) {
         const totalTime = Date.now() - bootStartTime.current;
         setBootTime(totalTime);
         setTimeout(onComplete, 400); // Faster transition (400ms vs 800ms)
      }
    });

    bootLoaderFast.startSequence();
  }, [onComplete]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentPhase, history]);

  const progress = ((history.length) / BOOT_PHASES_FAST.length) * 100;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-mono text-cyan-500 p-8">
      <div className="w-full max-w-2xl border border-cyan-900 rounded bg-[#050505] p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-6 border-b border-cyan-900/50 pb-2">
           <div>
              <h1 className="text-2xl font-bold tracking-widest flex items-center gap-2">
                <Cpu className="animate-pulse" /> JARVIS KERNEL
              </h1>
              <div className="text-xs text-cyan-700 flex items-center gap-2">
                <span>FAST BOOT MODE</span>
                <span>•</span>
                <span>v{KERNEL_VERSION.major}.{KERNEL_VERSION.minor}.{KERNEL_VERSION.patch}</span>
              </div>
           </div>
           <div className="text-right">
              <div className="text-xl font-bold">{Math.min(100, Math.round(progress))}%</div>
              <div className="text-xs text-cyan-700">
                {bootTime > 0 ? `${bootTime}ms` : 'SYSTEM CHECK'}
              </div>
           </div>
        </div>

        {/* Log Area - Shorter for faster boot feel */}
        <div ref={scrollRef} className="h-48 overflow-y-auto mb-6 space-y-1 font-mono text-sm custom-scrollbar">
           {history.map(phase => (
             <div key={phase.id} className="opacity-60">
                <div className="flex items-center gap-2 text-green-500 text-xs">
                   <CheckCircle size={12} /> 
                   <span className="font-bold">[{phase.name}]</span> 
                   <span>READY</span>
                   <span className="text-cyan-700 ml-auto">
                     {phase.logs[phase.logs.length - 1]?.includes('ms') 
                       ? phase.logs[phase.logs.length - 1].match(/\d+ms/)?.[0] 
                       : ''}
                   </span>
                </div>
             </div>
           ))}
           
           {/* Current Active Phase */}
           {bootState !== BootState.RUNNING && (
             <div className="space-y-1 animate-pulse">
                <div className="flex items-center gap-2 text-cyan-400 text-xs">
                   <Terminal size={12} />
                   <span className="font-bold">[{currentPhase.name}]</span>
                   <span>INITIALIZING...</span>
                </div>
                {currentPhase.logs.slice(0, 2).map((log, i) => (
                   <div key={i} className="pl-5 text-xs text-cyan-700">
                     {'>'} {log}
                   </div>
                ))}
             </div>
           )}
        </div>

        {/* Progress Bar - Faster animation */}
        <div className="h-1 w-full bg-cyan-900/30 rounded overflow-hidden">
           <div 
             className="h-full bg-cyan-500 transition-all duration-150 ease-out shadow-[0_0_10px_cyan]"
             style={{ width: `${progress}%` }}
           />
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-between text-[10px] text-cyan-800 uppercase">
           <span>Fast Boot: ENABLED</span>
           <span>Neural Net: LINKED</span>
           <span>Secure Boot: ON</span>
        </div>

      </div>
    </div>
  );
};
