import React from 'react';
import { ProcessorState, AIProvider, VisionState } from '../types';
import { 
  Cpu, 
  BrainCircuit, 
  ShieldCheck, 
  Database, 
  Server, 
  Zap, 
  Activity,
  ArrowRight,
  Eye
} from 'lucide-react';
import { vision } from '../services/vision';

interface ArchitectureDiagramProps {
  state: ProcessorState;
  activeModule: string | null;
  provider: AIProvider | null;
}

const ModuleBox: React.FC<{
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  description: string;
  extraClass?: string;
}> = ({ title, icon, isActive, description, extraClass = "" }) => (
  <div className={`
    relative p-4 rounded-lg border transition-all duration-300
    ${isActive 
      ? 'bg-cyan-950/30 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
      : 'bg-[#111] border-[#333] text-gray-500'}
    ${extraClass}
  `}>
    <div className="flex items-center gap-3 mb-2">
      <div className={`${isActive ? 'text-cyan-400' : 'text-gray-600'}`}>
        {icon}
      </div>
      <h3 className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>{title}</h3>
    </div>
    <p className="text-xs leading-relaxed">{description}</p>
    {isActive && (
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
    )}
  </div>
);

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ state, activeModule, provider }) => {
  const isVisionActive = vision.getState() === VisionState.ACTIVE || vision.getState() === VisionState.CAPTURING;

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Cpu size={200} />
      </div>

      <div className="flex items-center justify-between mb-8 z-10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="text-cyan-500" />
          KERNEL ARCHITECTURE v1.2
        </h2>
        <div className="flex items-center gap-2 text-xs font-mono">
           <span className="text-gray-500">STATE:</span>
           <span className={`px-2 py-1 rounded ${state === ProcessorState.IDLE ? 'bg-gray-800 text-gray-400' : 'bg-cyan-900 text-cyan-400'}`}>
             {state}
           </span>
        </div>
      </div>

      {/* Diagram Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        
        {/* Column 1: Input & Parse */}
        <div className="space-y-6 flex flex-col justify-center">
           {/* Optical Sensors (New) */}
           <ModuleBox 
             title="Optical Sensors" 
             icon={<Eye size={20} />} 
             isActive={isVisionActive}
             description="Raw video stream ingestion and frame capture buffer."
             extraClass={isVisionActive ? "border-cyan-500" : ""}
           />
           
           <ModuleBox 
             title="Intent Parser" 
             icon={<BrainCircuit size={20} />} 
             isActive={activeModule === 'PARSER'}
             description="Analyzes raw input using Gemini Flash. Classifies intent type and extracts entities."
           />
           <div className="flex justify-center text-gray-600"><ArrowRight className="rotate-90 md:rotate-0" /></div>
           <ModuleBox 
             title="Security Layer" 
             icon={<ShieldCheck size={20} />} 
             isActive={activeModule === 'SECURITY'}
             description="Validates permissions. Enforces safety policies before execution."
           />
        </div>

        {/* Column 2: Orchestration */}
        <div className="space-y-6 flex flex-col justify-center border-x border-[#222] px-4 md:px-6">
           <div className="text-center text-xs text-gray-500 font-mono mb-2 uppercase tracking-widest">Kernel Core</div>
           <ModuleBox 
             title="Orchestrator" 
             icon={<Cpu size={24} />} 
             isActive={activeModule === 'ROUTER'}
             description="Routes tasks. Decides between local fallback (Ollama) or Cloud (Gemini)."
           />
           
           {/* Provider Indicator */}
           <div className={`mt-4 p-3 rounded border text-center transition-all ${
             provider ? 'opacity-100' : 'opacity-0'
           } ${provider === AIProvider.GEMINI ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300' : 'bg-green-950/50 border-green-500 text-green-300'}`}>
              <div className="text-xs font-bold mb-1">SELECTED PROVIDER</div>
              <div className="flex items-center justify-center gap-2">
                <Server size={14} />
                {provider || 'WAITING...'}
              </div>
           </div>
        </div>

        {/* Column 3: Execution & Memory */}
        <div className="space-y-6 flex flex-col justify-center">
           <ModuleBox 
             title="Plugin Registry" 
             icon={<Zap size={20} />} 
             isActive={activeModule === 'EXECUTION'}
             description="Executes tools. Manages hardware interfaces and software bindings."
           />
           <div className="flex justify-center text-gray-600"><ArrowRight className="rotate-90 md:rotate-0" /></div>
           <ModuleBox 
             title="Long-Term Memory" 
             icon={<Database size={20} />} 
             isActive={activeModule === 'MEMORY'}
             description="Vector store for persistent context and user preferences."
           />
        </div>

      </div>
      
      {/* Background decoration lines */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-900 to-transparent"></div>
        <div className="absolute left-1/3 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-900 to-transparent"></div>
        <div className="absolute right-1/3 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-900 to-transparent"></div>
      </div>
    </div>
  );
};

export default ArchitectureDiagram;