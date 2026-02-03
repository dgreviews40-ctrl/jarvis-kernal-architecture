import React, { useEffect, useState, useRef } from 'react';
    import { BootPhase, BootState } from '../types';
    import { bootLoader, BOOT_PHASES } from '../services/boot';
    import { KERNEL_VERSION } from '../stores/kernelStore';
    import { Terminal, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';
    
    interface BootSequenceProps {
      onComplete: () => void;
    }
    
    export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
      const [currentPhase, setCurrentPhase] = useState<BootPhase>(BOOT_PHASES[0]);
      const [history, setHistory] = useState<BootPhase[]>([]);
      const [bootState, setBootState] = useState<BootState>(BootState.BOOTSTRAP);
      const scrollRef = useRef<HTMLDivElement>(null);
    
      useEffect(() => {
        // Start the sequence
        bootLoader.subscribe((phase, state) => {
          setCurrentPhase(phase);
          setBootState(state);
          
          if (phase.status === 'SUCCESS') {
             setHistory(prev => {
                const exists = prev.find(p => p.id === phase.id);
                return exists ? prev : [...prev, phase];
             });
          }
    
          if (state === BootState.RUNNING) {
             setTimeout(onComplete, 800); // Slight delay before clearing
          }
        });
    
        bootLoader.startSequence();
      }, [onComplete]);
    
      useEffect(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, [currentPhase, history]);
    
      const progress = ((history.length) / BOOT_PHASES.length) * 100;
    
      return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-mono text-cyan-500 p-8">
          <div className="w-full max-w-2xl border border-cyan-900 rounded bg-[#050505] p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
            
            {/* Header */}
            <div className="flex justify-between items-end mb-6 border-b border-cyan-900/50 pb-2">
               <div>
                  <h1 className="text-2xl font-bold tracking-widest flex items-center gap-2">
                    <Cpu className="animate-pulse" /> JARVIS KERNEL
                  </h1>
                  <div className="text-xs text-cyan-700">STARK INDUSTRIES • KERNEL v{KERNEL_VERSION.major}.{KERNEL_VERSION.minor}.{KERNEL_VERSION.patch}</div>
               </div>
               <div className="text-right">
                  <div className="text-xl font-bold">{Math.min(100, Math.round(progress))}%</div>
                  <div className="text-xs text-cyan-700">SYSTEM CHECK</div>
               </div>
            </div>
    
            {/* Log Area */}
            <div ref={scrollRef} className="h-64 overflow-y-auto mb-6 space-y-2 font-mono text-sm custom-scrollbar">
               {history.map(phase => (
                 <div key={phase.id} className="opacity-50">
                    <div className="flex items-center gap-2 text-green-500">
                       <CheckCircle size={14} /> 
                       <span className="font-bold">[{phase.name}]</span> 
                       <span>MOUNTED</span>
                    </div>
                 </div>
               ))}
               
               {/* Current Active Phase */}
               {bootState !== BootState.RUNNING && (
                 <div className="space-y-1 animate-pulse">
                    <div className="flex items-center gap-2 text-cyan-400">
                       <Terminal size={14} />
                       <span className="font-bold">[{currentPhase.name}]</span>
                       <span>INITIALIZING...</span>
                    </div>
                    {currentPhase.logs.map((log, i) => (
                       <div key={i} className="pl-6 text-xs text-cyan-700">
                         {'>'} {log}
                       </div>
                    ))}
                 </div>
               )}
            </div>
    
            {/* Progress Bar */}
            <div className="h-1 w-full bg-cyan-900/30 rounded overflow-hidden">
               <div 
                 className="h-full bg-cyan-500 transition-all duration-300 ease-out shadow-[0_0_10px_cyan]"
                 style={{ width: `${progress}%` }}
               />
            </div>
    
            {/* Footer */}
            <div className="mt-4 flex justify-between text-[10px] text-cyan-800 uppercase">
               <span>Mem: 64TB OK</span>
               <span>Neural Net: LINKED</span>
               <span>Secure Boot: ENABLED</span>
            </div>
    
          </div>
        </div>
      );
    };