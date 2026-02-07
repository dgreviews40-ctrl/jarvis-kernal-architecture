import React, { useEffect, useState } from 'react';
import { hardware } from '../services/hardware';
import { SystemMetrics } from '../types';
import { Cpu, Activity, Thermometer, Clock } from 'lucide-react';

const Metric: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="flex flex-col items-center mx-3 min-w-[60px]">
    <div className={`flex items-center gap-1 text-[10px] ${color} font-bold mb-1`}>
      {icon} {label}
    </div>
    <div className="text-xl font-mono tracking-tighter text-white">{value}</div>
  </div>
);

export const SystemMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuLoad: 0,
    gpuLoad: 0,
    memoryUsage: 0,
    gpuTemperature: 0,
    uptime: 0
  });

  useEffect(() => {
    return hardware.subscribe(setMetrics);
  }, []);

  const formatUptime = (sec: number) => {
    const totalSeconds = Math.floor(sec);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hidden md:flex bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-2 items-center divide-x divide-[#222]">
      <Metric 
        label="CPU" 
        value={`${metrics.cpuLoad.toFixed(0)}%`} 
        icon={<Cpu size={10} />} 
        color="text-cyan-500" 
      />
      <Metric 
        label="GPU" 
        value={`${metrics.gpuLoad.toFixed(0)}%`} 
        icon={<Activity size={10} />} 
        color="text-purple-500" 
      />
      <Metric 
        label="RAM" 
        value={`${metrics.memoryUsage.toFixed(0)}%`} 
        icon={<Activity size={10} />} 
        color="text-green-500" 
      />
      <Metric 
        label="GPU TEMP" 
        value={`${metrics.gpuTemperature.toFixed(1)}°C`} 
        icon={<Thermometer size={10} />} 
        color={metrics.gpuTemperature > 70 ? "text-red-500" : metrics.gpuTemperature > 50 ? "text-yellow-500" : "text-green-500"} 
      />
      <Metric 
        label="UPTIME" 
        value={formatUptime(metrics.uptime)} 
        icon={<Clock size={10} />} 
        color="text-gray-500" 
      />
    </div>
  );
};