import React, { useEffect, useState } from 'react';
import { cortex } from '../services/cortex';
import { ReliabilityScore, OperationalEvent, AdaptivePolicy, HealthEventType } from '../types';
import { Activity, Shield, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

export const HealthDashboard: React.FC = () => {
  const [scores, setScores] = useState<ReliabilityScore[]>([]);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [policies, setPolicies] = useState<AdaptivePolicy[]>([]);

  useEffect(() => {
    const refresh = () => {
      setScores(cortex.getAllReliability());
      setEvents([...cortex.getLogs()]); // Copy array
      setPolicies(cortex.getAllPolicies());
    };

    refresh();
    return cortex.subscribe(refresh);
  }, []);

  const getHealthColor = (score: number) => {
    if (score > 90) return 'text-green-500 bg-green-950/20 border-green-900/50';
    if (score > 50) return 'text-yellow-500 bg-yellow-950/20 border-yellow-900/50';
    return 'text-red-500 bg-red-950/20 border-red-900/50';
  };

  const getEventColor = (type: HealthEventType) => {
    switch (type) {
        case HealthEventType.SUCCESS: return 'text-green-400';
        case HealthEventType.TIMEOUT: return 'text-yellow-400';
        case HealthEventType.CRASH: return 'text-red-500 font-bold';
        default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full bg-[#0a0a0a] border border-[#333] rounded-lg p-6 flex flex-col gap-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#333]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="text-pink-500" />
          CORTEX OPS: SYSTEM HEALTH
        </h2>
        <div className="text-xs text-gray-500 font-mono">
            OPERATIONAL MEMORY (SQLITE)
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        
        {/* LEFT COL: RELIABILITY SCORES */}
        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
           <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
               <Zap size={16} /> SUBSYSTEM RELIABILITY
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scores.map(s => (
                <div key={s.sourceId} className={`p-4 rounded border ${getHealthColor(s.currentHealth)} transition-all`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm truncate">{s.sourceId}</span>
                        <span className="text-xs font-mono">{s.trend}</span>
                    </div>
                    
                    {/* Health Bar */}
                    <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden mb-2">
                        <div 
                           className="h-full transition-all duration-500 ease-out bg-current" 
                           style={{ width: `${s.currentHealth}%` }}
                        />
                    </div>
                    
                    <div className="flex justify-between text-[10px] opacity-80">
                        <span>HP: {s.currentHealth.toFixed(0)}/100</span>
                        <span>FAILS: {s.totalFailures}</span>
                    </div>
                </div>
              ))}
           </div>

           {/* ACTIVE POLICIES */}
           <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 mt-4">
               <Shield size={16} /> ACTIVE ADAPTIVE POLICIES
           </h3>
           <div className="space-y-2">
               {policies.length === 0 && (
                   <div className="text-xs text-gray-600 italic">No restrictive policies active. System nominal.</div>
               )}
               {policies.map(p => (
                   <div key={p.policyId} className="bg-pink-950/10 border border-pink-900/30 p-3 rounded text-pink-200 text-xs">
                       <div className="flex justify-between font-bold mb-1">
                           <span>{p.targetSourceId}</span>
                           <span>{p.parameterKey}</span>
                       </div>
                       <div className="opacity-80 mb-2">
                           "{p.reason}"
                       </div>
                       <div className="flex justify-between text-[10px] opacity-60">
                           <span>OVERRIDE: {JSON.stringify(p.overrideValue)}</span>
                           <span>EXPIRES: {p.expiresAt ? new Date(p.expiresAt).toLocaleTimeString() : 'NEVER'}</span>
                       </div>
                   </div>
               ))}
           </div>
        </div>

        {/* RIGHT COL: EVENT LOG */}
        <div className="flex flex-col gap-4 overflow-hidden">
            <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
               <Activity size={16} /> OPERATIONAL EVENT LOG
            </h3>
            <div className="flex-1 bg-[#050505] border border-[#222] rounded p-2 font-mono text-xs overflow-y-auto custom-scrollbar">
                {events.map((e, i) => (
                    <div key={e.id} className="mb-2 pb-2 border-b border-[#111] last:border-0">
                        <div className="flex gap-2 mb-1">
                            <span className="text-gray-600">[{new Date(e.timestamp).toLocaleTimeString()}]</span>
                            <span className={`font-bold ${getEventColor(e.type)}`}>{e.type}</span>
                            <span className="text-gray-400 truncate">{e.sourceId}</span>
                        </div>
                        {e.context.errorMessage && (
                            <div className="text-red-900/80 pl-4 truncate">{e.context.errorMessage}</div>
                        )}
                        <div className="flex gap-4 pl-4 text-gray-700">
                             <span>Latency: {e.latencyMs}ms</span>
                             {e.impact > 0 && <span>Impact: {e.impact}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};