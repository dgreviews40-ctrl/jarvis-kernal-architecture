import React, { useEffect, useState, useRef } from 'react';
import { hardware } from '../services/hardware';
import { voice } from '../services/voice';
import { vision } from '../services/vision';
import { providerManager } from '../services/providers';
import { registry } from '../services/registry';
import { SystemMetrics, VoiceState, ProcessorState, AIProvider, LogEntry, VisionState, RuntimePlugin } from '../types';
import { 
  Activity, Zap, Mic, Camera, Command, Cpu
} from 'lucide-react';

interface MainDashboardProps {
  processorState: ProcessorState;
  logs: LogEntry[];
  onCommand: (cmd: string) => void;
  onClearLogs: () => void;
  onNavigate: (tab: 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'HOME_ASSISTANT') => void;
}

// --- SUB-COMPONENTS ---

const HUDFrame: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  className?: string; 
  action?: React.ReactNode;
  hollow?: boolean;
}> = ({ title, children, className = "", action, hollow = false }) => (
  <div className={`relative border border-cyan-900/40 bg-[#050505]/90 p-3 flex flex-col min-h-0 overflow-hidden ${className}`}>
    {/* Header */}
    <div className="flex justify-between items-center mb-3 px-1 border-b border-cyan-900/30 pb-2 shrink-0">
        <h3 className="text-xs tracking-[0.2em] font-bold text-cyan-500 uppercase flex items-center gap-2">
           {title}
        </h3>
        {action}
    </div>
    
    {/* Content Wrapper */}
    <div className={`flex-1 relative min-h-0 ${hollow ? '' : 'overflow-hidden'}`}>
        {children}
    </div>

    {/* Decorative Corners */}
    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500"></div>
    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500"></div>
    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500"></div>
    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500"></div>
  </div>
);

const StatusDot: React.FC<{ label: string; active: boolean; color?: string; onClick?: () => void }> = ({ label, active, color = "bg-cyan-500", onClick }) => (
  <button 
    onClick={onClick}
    disabled={!onClick}
    className={`flex flex-col items-center gap-1 min-w-[70px] p-2 border border-cyan-900/30 bg-black/50 rounded shrink-0 transition-all ${onClick ? 'hover:bg-cyan-950/20 cursor-pointer active:scale-95' : 'cursor-default'}`}
  >
     <div className="text-[10px] text-cyan-700 tracking-wider font-bold uppercase">{label}</div>
     <div className={`w-3 h-3 rounded-full ${active ? `${color} animate-pulse shadow-[0_0_10px_currentColor]` : 'bg-gray-800'}`}></div>
  </button>
);

const StatRow: React.FC<{ label: string; value: string; active?: boolean }> = ({ label, value, active = false }) => (
  <div className="flex justify-between items-end border-b border-cyan-900/20 pb-2 mb-2 last:border-0 shrink-0">
     <span className="text-xs text-cyan-700 font-bold tracking-wide">{label}</span>
     <span className={`text-sm font-mono ${active ? 'text-cyan-400' : 'text-cyan-600'}`}>{value}</span>
  </div>
);

// --- CONSTELLATION VISUALIZER ---

interface ConstellationProps {
  state: ProcessorState;
  voiceState: VoiceState;
}

const ConstellationCanvas: React.FC<ConstellationProps> = ({ state, voiceState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const activityRef = useRef({ 
     isActive: false, 
     energy: 1.0 
  });

  useEffect(() => {
     const active = 
        state === ProcessorState.EXECUTING || 
        state === ProcessorState.ANALYZING || 
        state === ProcessorState.ROUTING ||
        voiceState === VoiceState.SPEAKING ||
        voiceState === VoiceState.LISTENING ||
        voiceState === VoiceState.PROCESSING;
     
     activityRef.current.isActive = active;
  }, [state, voiceState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const PARTICLE_COUNT = 140; 
    const CONNECTION_DIST = 180; 
    const BASE_SPEED = 0.4;
    const ACTIVE_SPEED_MULT = 3.0;

    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const signals: { fromIdx: number; toIdx: number; progress: number; speed: number }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * BASE_SPEED,
            vy: (Math.random() - 0.5) * BASE_SPEED
        });
    }

    let animationFrame: number;

    const render = () => {
        const { isActive } = activityRef.current;
        const currentSpeedMult = isActive ? ACTIVE_SPEED_MULT : 1.0;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        ctx.fillRect(0, 0, width, height);

        particles.forEach(p => {
            p.x += p.vx * currentSpeedMult;
            p.y += p.vy * currentSpeedMult;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
        });

        ctx.lineWidth = 1;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DIST) {
                    const opacity = 1 - (dist / CONNECTION_DIST);
                    ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.4})`;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();

                    const spawnChance = isActive ? 0.005 : 0.0002;
                    if (Math.random() < spawnChance) {
                        signals.push({
                            fromIdx: i,
                            toIdx: j,
                            progress: 0,
                            speed: 0.02 + Math.random() * 0.04
                        });
                    }
                }
            }
        }

        for (let i = signals.length - 1; i >= 0; i--) {
            const sig = signals[i];
            sig.progress += sig.speed * (isActive ? 1.5 : 1);
            if (sig.progress >= 1) {
                signals.splice(i, 1);
                continue;
            }
            const p1 = particles[sig.fromIdx];
            const p2 = particles[sig.toIdx];
            const sx = p1.x + (p2.x - p1.x) * sig.progress;
            const sy = p1.y + (p2.y - p1.y) * sig.progress;
            const glowSize = isActive ? 5 : 3;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isActive ? 'rgba(34, 211, 238, 0.8)' : 'rgba(6, 182, 212, 0.4)';
            ctx.beginPath();
            ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        particles.forEach(p => {
             ctx.fillStyle = isActive ? '#22d3ee' : '#0891b2';
             ctx.beginPath();
             ctx.arc(p.x, p.y, isActive ? 2.5 : 2, 0, Math.PI * 2);
             ctx.fill();
        });

        animationFrame = requestAnimationFrame(render);
    };

    render();
    
    const handleResize = () => {
        if (!canvas) return;
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// --- MAIN COMPONENT ---

export const MainDashboard: React.FC<MainDashboardProps> = ({ processorState, logs, onCommand, onClearLogs, onNavigate }) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuLoad: 0, gpuLoad: 0, memoryUsage: 0, temperature: 0, uptime: 0 });
  const [vState, setVState] = useState<VoiceState>(VoiceState.MUTED);
  const [viState, setViState] = useState<VisionState>(VisionState.OFF);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [plugins, setPlugins] = useState<RuntimePlugin[]>([]);
  const [atmosphere, setAtmosphere] = useState({ humidity: 42, pressure: 1013 });

  useEffect(() => {
    const unsubHw = hardware.subscribe(setMetrics);
    const unsubVoice = voice.subscribe(setVState);
    const unsubVision = vision.subscribe(setViState);
    setPlugins(registry.getAll());
    const unsubRegistry = registry.subscribe(() => setPlugins(registry.getAll()));

    const atmoInterval = setInterval(() => {
       setAtmosphere(prev => ({
           humidity: Math.min(60, Math.max(30, prev.humidity + (Math.random() - 0.5))),
           pressure: Math.floor(1013 + (Math.random() * 4 - 2))
       }));
    }, 3000);
    
    return () => {
        unsubHw();
        unsubVoice();
        unsubVision();
        unsubRegistry();
        clearInterval(atmoInterval);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleProtocol = (name: string, command: string) => {
      onCommand(command);
  };

  const toggleCamera = () => {
    if (viState === VisionState.ACTIVE) {
        vision.stopCamera();
    } else {
        vision.startCamera();
    }
  };

  const isExecuting = processorState === ProcessorState.EXECUTING || processorState === ProcessorState.ANALYZING;
  const lastOp = logs.slice().reverse().find(l => l.source === 'KERNEL' || l.source === 'GEMINI' || l.source === 'OLLAMA');
  const isMicActive = vState !== VoiceState.MUTED && vState !== VoiceState.ERROR;
  const isCamActive = viState === VisionState.ACTIVE || viState === VisionState.CAPTURING;

  return (
    <div className="h-full w-full bg-[#020202] text-cyan-500 font-mono flex flex-col p-6 gap-6 overflow-hidden select-none border border-cyan-900/20 rounded-xl max-h-full">
      
      {/* TOP ROW */}
      <div className="flex justify-between items-center h-20 border-b border-cyan-900/30 shrink-0">
          <div className="flex items-center gap-6">
              <div className="w-14 h-14 border-2 border-cyan-500 flex items-center justify-center bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <span className="font-bold text-2xl text-cyan-400">J</span>
              </div>
              <div>
                  <h1 className="text-3xl font-bold tracking-[0.3em] text-white shadow-cyan-glow text-shadow-cyan">J.A.R.V.I.S.</h1>
                  <div className="text-xs text-cyan-700 tracking-[0.2em] font-bold">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
              </div>
          </div>
          
          <div className="flex gap-6">
             <StatusDot 
                label="CAMERA" 
                active={isCamActive} 
                color="bg-red-500" 
                onClick={toggleCamera}
             />
             <StatusDot 
                label="MIC" 
                active={isMicActive} 
                color="bg-green-500" 
                onClick={() => voice.toggleMute()}
             />
             <StatusDot 
                label="NETWORK" 
                active={providerManager.getMode() !== AIProvider.OLLAMA} 
                color="bg-green-500" 
             />
             <StatusDot 
                label="UPLINK" 
                active={true} 
                color="bg-cyan-500" 
             />
          </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden h-full">
          
          {/* LEFT COLUMN */}
          <div className="col-span-3 flex flex-col gap-6 min-h-0 h-full overflow-hidden">
              
              <HUDFrame title="DEEP_ATMOSPHERIC_SCAN" action={<div className="bg-cyan-900 text-white text-[10px] px-2 py-0.5 animate-pulse rounded-sm">LIVE</div>} className="shrink-0 h-40">
                  <div className="p-2 space-y-3">
                      <div className="text-xs text-cyan-600 mb-2 font-bold uppercase tracking-widest">Sector 7G Telemetry</div>
                      <StatRow label="HUMIDITY" value={`${atmosphere.humidity.toFixed(1)}%`} />
                      <StatRow label="PRESSURE" value={`${atmosphere.pressure} hPa`} />
                      <StatRow label="WIND" value="0 km/h" />
                  </div>
              </HUDFrame>

              <HUDFrame title="KERNEL_OPERATIONS" className="flex-1 min-h-0">
                 <div className="p-2 space-y-4 h-full flex flex-col overflow-hidden">
                     <div className="flex items-center gap-3 mb-2 shrink-0">
                         <Cpu size={20} className="text-cyan-400" />
                         <span className="text-sm font-bold text-white uppercase tracking-wider">Neural Activity</span>
                     </div>

                     <div className="bg-cyan-950/20 p-4 border border-cyan-900/30 rounded-lg shrink-0">
                         <div className="text-[10px] text-cyan-700 mb-1 font-bold tracking-wider">STATE_VAL</div>
                         <div className={`text-xl font-bold tracking-wide ${isExecuting ? 'text-white animate-pulse' : 'text-gray-500'}`}>
                             {processorState}
                         </div>
                     </div>

                     <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                         <StatRow label="LINK_PROT" value={providerManager.getMode() === AIProvider.OLLAMA ? 'LOCAL' : 'CLOUD'} />
                         <StatRow label="LATENCY" value={lastOp?.details?.latency || "0ms"} />
                         <StatRow label="LOAD" value="OPTIMAL" />
                     </div>
                 </div>
              </HUDFrame>

              {/* NEURAL TRANSCRIPT */}
              <HUDFrame title="NEURAL_TRANSCRIPT" className="h-64 shrink-0" action={
                  <button onClick={onClearLogs} className="text-[10px] cursor-pointer hover:text-white hover:bg-red-900/50 px-2 py-0.5 rounded transition-colors uppercase font-bold">Purge</button>
              }>
                  <div ref={scrollRef} className="absolute inset-0 p-3 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col gap-2">
                      {logs.slice(-30).map(log => (
                          <div key={log.id} className="text-[10px] leading-relaxed font-mono border-b border-cyan-900/10 pb-1 last:border-0 shrink-0 break-words w-full">
                              <span className="text-cyan-800 font-bold inline-block mr-2 shrink-0">[{log.timestamp.toLocaleTimeString().split(' ')[0]}]</span> 
                              <span className={`inline ${log.type === 'error' ? 'text-red-500' : 'text-cyan-300'}`}>{log.message}</span>
                          </div>
                      ))}
                      {logs.length === 0 && <div className="text-cyan-900 italic text-[10px]">Awaiting Uplink...</div>}
                  </div>
              </HUDFrame>

          </div>

          {/* MIDDLE COLUMN */}
          <div className="col-span-6 flex flex-col min-h-0 h-full overflow-hidden">
              <div className="flex-1 relative border border-cyan-900/40 bg-black/40 flex items-center justify-center overflow-hidden rounded-lg shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] min-h-0">
                  <ConstellationCanvas state={processorState} voiceState={vState} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isExecuting ? (
                          <div className="text-center bg-black/40 p-8 rounded-2xl backdrop-blur-md border border-cyan-500/20 shadow-2xl">
                              <Activity size={64} className="mx-auto text-cyan-400 animate-bounce mb-6" />
                              <div className="text-4xl font-bold text-white tracking-[0.5em] animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] uppercase">Processing</div>
                          </div>
                      ) : (
                          <div className="text-center opacity-30">
                               <div className="text-sm text-cyan-800 tracking-[0.8em] font-bold uppercase">Stark OS Ready</div>
                          </div>
                      )}
                  </div>
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-600 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-cyan-600 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-600 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-600 rounded-br-lg"></div>
              </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-3 flex flex-col gap-6 min-h-0 h-full overflow-hidden">
              <HUDFrame title="DEVICE_MANAGER" className="flex-1 min-h-0">
                  <div className="p-3 h-full flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                      {plugins.filter(p => p.status === 'ACTIVE').map(p => (
                          <div key={p.manifest.id} className="flex items-center gap-3 bg-cyan-950/20 border border-cyan-900/30 p-2.5 rounded hover:bg-cyan-900/20 transition-colors cursor-default shrink-0">
                              <div className="p-1.5 bg-cyan-900/50 rounded text-cyan-300">
                                  {p.manifest.id.includes('mic') ? <Mic size={12} /> : 
                                   p.manifest.id.includes('speaker') ? <Command size={12} /> :
                                   p.manifest.id.includes('camera') ? <Camera size={12} /> : <Zap size={12} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-white truncate">{p.manifest.name}</div>
                                  <div className="text-[9px] text-cyan-700 truncate font-bold tracking-tight">{p.manifest.id}</div>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_lime] animate-pulse shrink-0"></div>
                          </div>
                      ))}
                  </div>
              </HUDFrame>

              <HUDFrame title="OPERATIONAL_PROTOCOLS" action={
                  <button onClick={() => onNavigate('ARCH')} className="border border-cyan-700 px-2 py-0.5 text-[9px] cursor-pointer hover:bg-cyan-900 text-cyan-500 hover:text-white transition-colors rounded uppercase font-bold">Schematic</button>
              } className="shrink-0 h-80">
                  <div className="p-2 space-y-2 h-full overflow-y-auto custom-scrollbar">
                      {[
                          { label: "DEEP SCAN", sub: "FULL SYSTEM DIAGNOSTIC", cmd: "Run full system diagnostic", color: "border-cyan-800 hover:bg-cyan-900/30" },
                          { label: "NETWORK PROBE", sub: "MEASURE UPLINK STABILITY", cmd: "Initiate network latency probe", color: "border-green-900/50 text-green-500 hover:bg-green-900/20" },
                          { label: "CIRCUIT RESET", sub: "CYCLE ALL VIRTUAL BREAKERS", cmd: "Reset system circuits", color: "border-yellow-900/50 text-yellow-500 hover:bg-yellow-900/20" },
                          { label: "MEMORY OPTIMIZE", sub: "COMPRESS VECTOR STORE", cmd: "Run memory optimization protocol", color: "border-purple-900/50 text-purple-400 hover:bg-purple-900/20" },
                          { label: "SMART HOME", sub: "HOME ASSISTANT DASHBOARD", cmd: "Show Home Assistant dashboard", color: "border-green-900/50 text-green-400 hover:bg-green-900/20" },
                      ].map(proto => (
                          <button
                            key={proto.label}
                            onClick={() => {
                              if (proto.label === "SMART HOME") {
                                onNavigate('HOME_ASSISTANT');
                              } else {
                                handleProtocol(proto.label, proto.cmd);
                              }
                            }}
                            className={`w-full text-left border ${proto.color} p-2.5 cursor-pointer transition-all group rounded bg-black/40 shrink-0`}
                          >
                              <div className="text-xs font-bold text-white group-hover:text-cyan-300 mb-0.5">{proto.label}</div>
                              <div className="text-[9px] text-cyan-700 group-hover:text-cyan-500 font-bold tracking-tight">{proto.sub}</div>
                          </button>
                      ))}
                      <div className="mt-4 text-[8px] text-gray-700 opacity-20 text-right font-mono uppercase">
                          License ID: STARK ENT 732
                      </div>
                  </div>
              </HUDFrame>
          </div>
      </div>
    </div>
  );
};