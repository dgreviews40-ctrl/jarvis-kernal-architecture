import React, { useEffect, useState, useRef } from 'react';
import { hardware } from '../services/hardware';
import { voice } from '../services/voice';
import { vision } from '../services/vision';
import { providerManager } from '../services/providers';
import { registry } from '../services/registry';
import { useKernelStore, useLogsStore } from '../stores';
import { SystemMetrics, VoiceState, ProcessorState, AIProvider, LogEntry, VisionState, RuntimePlugin } from '../types';
import { Zap, Mic, Camera, Command, Cpu } from 'lucide-react';
import { DisplayArea } from './display';
import { textStyle, textColor, fontFamily, tracking } from '../constants/typography';

interface MainDashboardProps {
  onCommand: (cmd: string) => void;
  onNavigate: (tab: 'ARCH' | 'MEMORY' | 'VISION' | 'HEALTH' | 'GRAPH' | 'HOME_ASSISTANT' | 'AGENT') => void;
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
        <h3 className={`${textStyle.cardHeader} text-cyan-500 flex items-center gap-2`}>
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
     <div className={`${textStyle.label} text-cyan-700`}>{label}</div>
     <div className={`w-3 h-3 rounded-full ${active ? `${color} animate-pulse shadow-[0_0_10px_currentColor]` : 'bg-gray-800'}`}></div>
  </button>
);

const StatRow: React.FC<{ label: string; value: string; active?: boolean }> = ({ label, value, active = false }) => (
  <div className="flex justify-between items-end border-b border-cyan-900/20 pb-2 mb-2 last:border-0 shrink-0">
     <span className={`${textStyle.bodySecondary} text-cyan-700 font-bold`}>{label}</span>
     <span className={`${textStyle.dataSecondary} ${active ? 'text-cyan-400' : 'text-cyan-600'}`}>{value}</span>
  </div>
);

// --- MAIN COMPONENT ---

export const MainDashboard: React.FC<MainDashboardProps> = ({ onCommand, onNavigate }) => {
  // Get state from stores
  const processorState = useKernelStore((s) => s.processorState);
  const vState = useKernelStore((s) => s.voiceState);
  const viState = useKernelStore((s) => s.visionState);
  const plugins = useKernelStore((s) => s.plugins);
  const logs = useLogsStore((s) => s.filteredLogs);
  const clearLogs = useLogsStore((s) => s.clearLogs);

  // Display Area state
  const displayMode = useKernelStore((s) => s.displayMode);
  const displayContent = useKernelStore((s) => s.displayContent);
  const clearDisplay = useKernelStore((s) => s.clearDisplay);

  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuLoad: 0, gpuLoad: 0, memoryUsage: 0, gpuTemperature: 0, uptime: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atmosphere, setAtmosphere] = useState({ humidity: 42, pressure: 1013 });

  useEffect(() => {
    const unsubHw = hardware.subscribe(setMetrics);
    
    const atmoInterval = setInterval(() => {
       setAtmosphere(prev => ({
           humidity: Math.min(60, Math.max(30, prev.humidity + (Math.random() - 0.5))),
           pressure: Math.floor(1013 + (Math.random() * 4 - 2))
       }));
    }, 3000);
    
    return () => {
        unsubHw();
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
  const lastOp = logs?.slice().reverse().find(l => l.source === 'KERNEL' || l.source === 'GEMINI' || l.source === 'OLLAMA');
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
                  <h1 className={`text-3xl font-bold ${tracking.widest} text-white shadow-cyan-glow text-shadow-cyan`}>J.A.R.V.I.S.</h1>
                  <div className={`${textStyle.label} text-cyan-700`}>JUST A RATHER VERY INTELLIGENT SYSTEM</div>
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

              <HUDFrame title="DEEP_ATMOSPHERIC_SCAN" action={<div className={`bg-cyan-900 text-white ${textStyle.label} px-2 py-0.5 animate-pulse rounded-sm`}>LIVE</div>} className="shrink-0 h-40">
                  <div className="p-2 space-y-3">
                      <div className={`${textStyle.label} text-cyan-600 mb-2`}>Sector 7G Telemetry</div>
                      <StatRow label="HUMIDITY" value={`${atmosphere.humidity.toFixed(1)}%`} />
                      <StatRow label="PRESSURE" value={`${atmosphere.pressure} hPa`} />
                      <StatRow label="WIND" value="0 km/h" />
                  </div>
              </HUDFrame>

              <HUDFrame title="KERNEL_OPERATIONS" className="flex-1 min-h-0">
                 <div className="p-2 space-y-4 h-full flex flex-col overflow-hidden">
                     <div className="flex items-center gap-3 mb-2 shrink-0">
                         <Cpu size={20} className="text-cyan-400" />
                         <span className={`${textStyle.cardHeader} text-white`}>Neural Activity</span>
                     </div>

                     <div className="bg-cyan-950/20 p-4 border border-cyan-900/30 rounded-lg shrink-0">
                         <div className={`${textStyle.label} text-cyan-700 mb-1`}>STATE_VAL</div>
                         <div className={`text-xl font-bold ${tracking.wide} ${isExecuting ? 'text-white animate-pulse' : 'text-gray-500'}`}>
                             {processorState}
                         </div>
                     </div>

                     <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                         <StatRow label="LINK_PROT" value={providerManager.getMode() === AIProvider.OLLAMA ? 'LOCAL' : 'CLOUD'} />
                         <StatRow label="LATENCY" value={(lastOp?.details as { latency?: string })?.latency || "0ms"} />
                         <StatRow label="LOAD" value="OPTIMAL" />
                     </div>
                 </div>
              </HUDFrame>

              {/* NEURAL TRANSCRIPT */}
              <HUDFrame title="NEURAL_TRANSCRIPT" className="h-64 shrink-0" action={
                  <button onClick={clearLogs} className={`${textStyle.label} cursor-pointer hover:text-white hover:bg-red-900/50 px-2 py-0.5 rounded transition-colors`}>Purge</button>
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

          {/* MIDDLE COLUMN - Flexible Display Area with Waveform Background */}
          <div className="col-span-6 flex flex-col min-h-0 h-full overflow-hidden">
              <DisplayArea
                processorState={processorState}
                voiceState={vState}
                displayMode={displayMode}
                displayContent={displayContent}
                onClearDisplay={clearDisplay}
              />
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
                                  <div className={`${textStyle.tag} text-white truncate`}>{p.manifest.name}</div>
                                  <div className={`${textStyle.timestamp} text-cyan-700 truncate`}>{p.manifest.id}</div>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_lime] animate-pulse shrink-0"></div>
                          </div>
                      ))}
                  </div>
              </HUDFrame>

              <HUDFrame title="OPERATIONAL_PROTOCOLS" action={
                  <button onClick={() => onNavigate('ARCH')} className={`border border-cyan-700 px-2 py-0.5 ${textStyle.label} cursor-pointer hover:bg-cyan-900 text-cyan-500 hover:text-white transition-colors rounded`}>Schematic</button>
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
                              <div className={`${textStyle.bodySecondary} font-bold text-white group-hover:text-cyan-300 mb-0.5`}>{proto.label}</div>
                              <div className={`${textStyle.timestamp} text-cyan-700 group-hover:text-cyan-500`}>{proto.sub}</div>
                          </button>
                      ))}
                      <div className={`mt-4 ${textStyle.timestamp} text-gray-700 opacity-20 text-right`}>
                          License ID: STARK ENT 732
                      </div>
                  </div>
              </HUDFrame>
          </div>
      </div>
    </div>
  );
};