import React, { useState, useEffect } from 'react';
import { 
  Terminal, Play, Pause, RefreshCw, Save, 
  Database, ShieldAlert, Activity, Bug, ArrowRightLeft,
  Cpu, Trash2, X, ArrowLeft, Layers
} from 'lucide-react';
import { mockAI, mockMemory, mockHardware } from '../services/dev/mocks';
import { IPCMessage, LogEntry } from '../types';
import { WorkerPoolDashboard } from './WorkerPoolDashboard';

// Utility for fake IPC generation
const generateMockIPC = (): IPCMessage => ({
  id: Math.random().toString(36).substring(7),
  timestamp: Date.now(),
  direction: Math.random() > 0.5 ? 'INBOUND' : 'OUTBOUND',
  channel: Math.random() > 0.7 ? 'memory:store' : 'kernel:log',
  payload: { data: 'test_packet', size: Math.floor(Math.random() * 100) },
  status: 'OK'
});

interface DevDashboardProps {
  onClose?: () => void;
}

export const DevDashboard: React.FC<DevDashboardProps> = ({ onClose }) => {
  const [ipcLogs, setIpcLogs] = useState<IPCMessage[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [memories, setMemories] = useState(mockMemory.getAll());
  const [hwMetrics, setHwMetrics] = useState(mockHardware.getMetrics());
  const [activeTab, setActiveTab] = useState<'sandbox' | 'workers'>('sandbox');

  // Simulate IPC Traffic
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        setIpcLogs(prev => [generateMockIPC(), ...prev].slice(0, 50));
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Refresh Mocks
  const refreshState = () => {
    setMemories([...mockMemory.getAll()]);
    setHwMetrics({...mockHardware.getMetrics()});
  };

  const handleInjectMemory = () => {
    mockMemory.store("Injected via Dev Console", "FACT", ["debug"]);
    refreshState();
  };

  const handleTripBreaker = () => {
    setIpcLogs(prev => [{
      id: 'ERR_FAIL',
      timestamp: Date.now(),
      direction: 'INBOUND',
      channel: 'circuit:trip',
      payload: { reason: 'MANUAL_OVERRIDE' },
      status: 'ERROR'
    }, ...prev]);
  };

  return (
    <div className="h-full bg-[#0d0d0d] text-gray-300 font-mono flex flex-col overflow-hidden">
      
      {/* TOOLBAR */}
      <div className="h-14 border-b border-[#333] flex items-center justify-between px-4 bg-[#111]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-yellow-500 font-bold">
            <Bug size={18} />
            <span>DEV SANDBOX MODE</span>
          </div>
          <div className="h-6 w-[1px] bg-[#333]"></div>
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold ${isRunning ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isRunning ? 'RUNNING' : 'PAUSED'}
          </button>
          <button onClick={refreshState} className="p-2 hover:bg-[#222] rounded text-gray-400"><RefreshCw size={14} /></button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
             <ShieldAlert size={14} className="text-green-500" />
             <span>SANDBOX: SECURE</span>
          </div>
          <div className="flex items-center gap-2">
             <Activity size={14} className="text-blue-500" />
             <span>MOCKS: ACTIVE</span>
          </div>
          <div className="h-6 w-[1px] bg-[#333]"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                activeTab === 'sandbox' 
                  ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700' 
                  : 'bg-[#222] text-gray-400 hover:bg-[#333]'
              }`}
            >
              <Bug size={14} />
              SANDBOX
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                activeTab === 'workers' 
                  ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700' 
                  : 'bg-[#222] text-gray-400 hover:bg-[#333]'
              }`}
            >
              <Layers size={14} />
              WORKER POOL
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-[#333]" />
          
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs font-bold transition-colors"
          >
            <ArrowLeft size={14} />
            EXIT
          </button>
        </div>
      </div>

      {activeTab === 'workers' ? (
        <WorkerPoolDashboard />
      ) : (
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: MOCK HARDWARE & CONTROLS */}
        <div className="w-80 border-r border-[#333] bg-[#0a0a0a] flex flex-col">
          
          {/* Hardware Sliders */}
          <div className="p-4 border-b border-[#333]">
             <h3 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2"><Cpu size={14}/> MOCK HARDWARE STRESS</h3>
             
             <div className="space-y-4">
               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span>CPU Load</span>
                   <span className="text-cyan-500">{hwMetrics.cpuLoad}%</span>
                 </div>
                 <input 
                   type="range" min="0" max="100" 
                   value={hwMetrics.cpuLoad}
                   onChange={(e) => {
                     mockHardware.setMetric('cpuLoad', parseInt(e.target.value));
                     refreshState();
                   }}
                   className="w-full accent-cyan-600 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
                 />
               </div>
               
               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span>Memory Pressure</span>
                   <span className="text-purple-500">{hwMetrics.memoryUsage}%</span>
                 </div>
                 <input 
                   type="range" min="0" max="100"
                   value={hwMetrics.memoryUsage} 
                   onChange={(e) => {
                     mockHardware.setMetric('memoryUsage', parseInt(e.target.value));
                     refreshState();
                   }}
                   className="w-full accent-purple-600 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
                 />
               </div>

               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span>Temperature</span>
                   <span className={hwMetrics.temperature > 80 ? "text-red-500" : "text-yellow-500"}>{hwMetrics.temperature}°C</span>
                 </div>
                 <input 
                   type="range" min="20" max="100"
                   value={hwMetrics.temperature} 
                   onChange={(e) => {
                     mockHardware.setMetric('temperature', parseInt(e.target.value));
                     refreshState();
                   }}
                   className="w-full accent-yellow-600 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
                 />
               </div>
             </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-b border-[#333]">
             <h3 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2"><Activity size={14}/> ACTIONS</h3>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={handleTripBreaker} className="p-2 border border-red-900/50 bg-red-950/20 text-red-400 text-xs rounded hover:bg-red-900/40">
                   TRIP BREAKER
                </button>
                <button onClick={handleInjectMemory} className="p-2 border border-blue-900/50 bg-blue-950/20 text-blue-400 text-xs rounded hover:bg-blue-900/40">
                   INJECT MEM
                </button>
             </div>
          </div>

          {/* Mock Memory Inspector */}
          <div className="flex-1 overflow-hidden flex flex-col">
             <div className="p-3 bg-[#111] border-b border-[#333] flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-500 flex items-center gap-2"><Database size={14}/> SANDBOX MEMORY</h3>
                <button onClick={() => { mockMemory.reset(); refreshState(); }} className="text-gray-500 hover:text-white"><Trash2 size={12}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {memories.map(m => (
                  <div key={m.id} className="text-[10px] p-2 bg-[#151515] border border-[#222] rounded">
                     <div className="text-blue-400 font-bold mb-1">{m.type}</div>
                     <div className="text-gray-400">{m.content}</div>
                  </div>
                ))}
             </div>
          </div>

        </div>

        {/* RIGHT: IPC LOG & PREVIEW */}
        <div className="flex-1 flex flex-col">
          
          <div className="flex-1 bg-[#050505] p-4 font-mono text-xs overflow-y-auto custom-scrollbar">
             <div className="mb-4 text-gray-500">IPC BRIDGE CONNECTED (vhost: 127.0.0.1:9090)</div>
             
             {ipcLogs.map(log => (
               <div key={log.id} className="mb-2 flex gap-2 hover:bg-[#111] p-1 rounded">
                  <span className="text-gray-600 w-20">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`w-20 font-bold ${log.direction === 'INBOUND' ? 'text-green-500' : 'text-purple-500'}`}>
                    {log.direction === 'INBOUND' ? '<- HOST' : 'PLUGIN ->'}
                  </span>
                  <span className="w-32 text-cyan-600 truncate">{log.channel}</span>
                  <span className={`flex-1 truncate ${log.status === 'ERROR' ? 'text-red-500' : 'text-gray-400'}`}>
                    {JSON.stringify(log.payload)}
                  </span>
                  {log.status !== 'OK' && <span className="text-red-500 font-bold">[{log.status}]</span>}
               </div>
             ))}
          </div>

          <div className="h-32 border-t border-[#333] bg-[#0a0a0a] p-4 flex gap-4">
             <div className="w-1/2">
                <h3 className="text-xs font-bold text-gray-500 mb-2">PLUGIN PREVIEW</h3>
                <div className="h-full border border-dashed border-[#333] rounded flex items-center justify-center text-gray-600 text-xs">
                   [VISUAL OUTPUT PLACEHOLDER]
                </div>
             </div>
             <div className="w-1/2">
                <h3 className="text-xs font-bold text-gray-500 mb-2">VIRTUAL TERMINAL</h3>
                <div className="h-full bg-black rounded p-2 text-green-500 font-mono text-[10px]">
                   $ npm run dev<br/>
                   {'>'} listening on pipe \\.\pipe\jarvis-plugin-dev<br/>
                   {'>'} ready.
                </div>
             </div>
          </div>

        </div>

      </div>
      )}
    </div>
  );
};

export default DevDashboard;