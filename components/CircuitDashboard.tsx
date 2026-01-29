import React from 'react';
import { BreakerStatus, CircuitState } from '../types';
import { Activity, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface CircuitDashboardProps {
  statuses: BreakerStatus[];
  onTrip: (id: string) => void;
}

export const CircuitDashboard: React.FC<CircuitDashboardProps> = ({ statuses, onTrip }) => {
  const getStateColor = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED: return 'border-green-500/50 bg-green-950/20 text-green-400';
      case CircuitState.OPEN: return 'border-red-500/50 bg-red-950/20 text-red-400';
      case CircuitState.HALF_OPEN: return 'border-yellow-500/50 bg-yellow-950/20 text-yellow-400';
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <ShieldAlert size={16} className="text-cyan-500" />
          CIRCUIT BREAKERS
        </h3>
        <span className="text-xs text-gray-600 font-mono">EXECUTION ENGINE</span>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {statuses.map(status => (
          <div 
            key={status.pluginId} 
            className={`border rounded p-3 relative transition-all ${getStateColor(status.state)}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono font-bold text-sm uppercase">{status.pluginId}</span>
              <span className="text-[10px] font-bold border px-1 rounded opacity-80">
                {status.state}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs opacity-80 mb-2">
              <div className="flex items-center gap-1">
                <CheckCircle size={10} />
                <span>Success: {status.successes}</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity size={10} />
                <span>Failures: {status.failures}</span>
              </div>
            </div>

            {status.state === CircuitState.OPEN && (
              <div className="flex items-center gap-1 text-[10px] text-red-300 mt-1 bg-red-950/40 p-1 rounded">
                <Clock size={10} />
                <span>Retry in: {Math.max(0, Math.ceil(((status.nextAttempt || 0) - Date.now()) / 1000))}s</span>
              </div>
            )}
            
            {status.lastError && (
              <div className="mt-2 text-[10px] font-mono text-red-400 break-words bg-black/30 p-1 rounded">
                Err: {status.lastError}
              </div>
            )}

            {/* Debug Actions */}
            {status.state === CircuitState.CLOSED && (
              <button 
                onClick={() => onTrip(status.pluginId)}
                className="absolute top-2 right-20 text-[10px] hover:text-white underline opacity-0 hover:opacity-100 transition-opacity"
              >
                force_fail
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};