/**
 * GPU Dashboard Component
 * 
 * Real-time GPU monitoring for GTX 1080 Ti
 * Shows VRAM, temperature, utilization, power, and running models
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, 
  Thermometer, 
  Zap, 
  Cpu, 
  MemoryStick, 
  AlertTriangle,
  CheckCircle,
  Server,
  HardDrive,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  gpuMonitor, 
  GpuMonitorData, 
  GpuStats,
  GpuProcess 
} from '../services/gpuMonitor';
import { logger } from '../services/logger';

interface GpuDashboardProps {
  onClose?: () => void;
}

// Helper to format bytes
const formatMB = (mb: number): string => {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb} MB`;
};

// Helper to format time
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const GpuDashboard: React.FC<GpuDashboardProps> = ({ onClose }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  
  // GPU data
  const [stats, setStats] = useState<GpuStats | null>(null);
  const [models, setModels] = useState<GpuMonitorData['models']>({ 
    llm: [], whisper: [], embedding: [], other: [] 
  });
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [history, setHistory] = useState<GpuStats[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'history'>('overview');
  const [error, setError] = useState<string | null>(null);

  // Connect to GPU monitor
  useEffect(() => {
    logger.log('GPU_DASHBOARD', 'Connecting to GPU Monitor...', 'info');
    
    // Start GPU monitor service
    gpuMonitor.start();
    
    // Set up event handlers
    const unsubscribeStats = gpuMonitor.onStats((data) => {
      setStats(data.current);
      setModels(data.models);
      setRecommendations(data.recommendations);
      setHistory(data.history);
      
      // Check if mock mode
      if (data.current.name.includes('MOCK')) {
        setIsMockMode(true);
      }
    });
    
    const unsubscribeConnect = gpuMonitor.onConnect(() => {
      setIsConnected(true);
      setError(null);
      logger.log('GPU_DASHBOARD', 'Connected to GPU Monitor', 'success');
    });
    
    const unsubscribeDisconnect = gpuMonitor.onDisconnect(() => {
      setIsConnected(false);
      logger.log('GPU_DASHBOARD', 'Disconnected from GPU Monitor', 'warning');
    });
    
    const unsubscribeError = gpuMonitor.onError((err) => {
      setError(err.message);
      logger.log('GPU_DASHBOARD', `Error: ${err.message}`, 'error');
    });
    
    // Cleanup
    return () => {
      unsubscribeStats();
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
    };
  }, []);

  // Get temperature color
  const getTempColor = (temp: number): string => {
    if (temp >= 85) return 'text-red-500';
    if (temp >= 80) return 'text-orange-500';
    if (temp >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Get temperature bg color
  const getTempBgColor = (temp: number): string => {
    if (temp >= 85) return 'bg-red-500';
    if (temp >= 80) return 'bg-orange-500';
    if (temp >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get VRAM color
  const getVramColor = (percent: number): string => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Calculate total model VRAM
  const totalModelVram = useMemo(() => {
    return Object.values(models).flat().reduce((sum, proc) => sum + proc.vram_mb, 0);
  }, [models]);

  // Format history for chart
  const chartData = useMemo(() => {
    return history.map(stat => ({
      time: formatTime(stat.timestamp),
      vram: stat.vram_percent,
      temp: stat.temperature,
      util: stat.gpu_utilization,
      power: stat.power_draw
    }));
  }, [history]);

  if (!stats && !isConnected) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-8 max-w-md w-full text-center">
          <Server className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-white mb-2">Connecting to GPU Monitor...</h2>
          <p className="text-gray-400 mb-4">
            Make sure the GPU Monitor server is running:
          </p>
          <code className="block bg-black/50 p-3 rounded text-sm text-green-400 mb-4">
            Start-GPU-Monitor.bat
          </code>
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto">
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto bg-gray-900 rounded-2xl border border-blue-500/30 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-6 border-b border-blue-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Cpu className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">GPU Monitor</h1>
                  <p className="text-gray-400 text-sm">
                    {stats?.name || 'Unknown GPU'}
                    {isMockMode && (
                      <span className="ml-2 text-yellow-400">(MOCK MODE)</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Connection status */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-6">
              {(['overview', 'processes', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* VRAM Card */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <MemoryStick className="w-5 h-5 text-purple-400" />
                      <span className="text-gray-400 text-sm">VRAM Usage</span>
                    </div>
                    <div className={`text-2xl font-bold ${getVramColor(stats?.vram_percent || 0)}`}>
                      {stats?.vram_percent.toFixed(1) || 0}%
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      {formatMB(stats?.vram_used || 0)} / {formatMB(stats?.vram_total || 0)}
                    </div>
                    <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (stats?.vram_percent || 0) >= 90 ? 'bg-red-500' :
                          (stats?.vram_percent || 0) >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(stats?.vram_percent || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Temperature Card */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Thermometer className="w-5 h-5 text-red-400" />
                      <span className="text-gray-400 text-sm">Temperature</span>
                    </div>
                    <div className={`text-2xl font-bold ${getTempColor(stats?.temperature || 0)}`}>
                      {stats?.temperature || 0}°C
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      {stats && stats.temperature >= 85 ? 'Critical' :
                       stats && stats.temperature >= 80 ? 'Hot' :
                       stats && stats.temperature >= 75 ? 'Warm' : 'Normal'}
                    </div>
                    <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getTempBgColor(stats?.temperature || 0)}`}
                        style={{ width: `${Math.min((stats?.temperature || 0) / 100 * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* GPU Utilization Card */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Activity className="w-5 h-5 text-blue-400" />
                      <span className="text-gray-400 text-sm">GPU Utilization</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                      {stats?.gpu_utilization || 0}%
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      Memory: {stats?.memory_utilization || 0}%
                    </div>
                    <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${stats?.gpu_utilization || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Power Card */}
                  <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      <span className="text-gray-400 text-sm">Power Draw</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {stats?.power_draw.toFixed(1) || 0}W
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      Limit: {stats?.power_limit || 0}W
                    </div>
                    <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                        style={{ width: `${((stats?.power_draw || 0) / (stats?.power_limit || 250)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Clock Speeds */}
                <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Clock Speeds
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-gray-500 text-xs mb-1">Graphics Clock</div>
                      <div className="text-xl font-bold text-white">{stats?.graphics_clock || 0} MHz</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-gray-500 text-xs mb-1">Memory Clock</div>
                      <div className="text-xl font-bold text-white">{stats?.memory_clock || 0} MHz</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-gray-500 text-xs mb-1">SM Clock</div>
                      <div className="text-xl font-bold text-white">{stats?.sm_clock || 0} MHz</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400" />
                      Recommendations
                    </h3>
                    <div className="space-y-2">
                      {recommendations.map((rec, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            rec.includes('⚠️') || rec.includes('Critical') ? 'bg-red-500/10 border border-red-500/30' :
                            rec.includes('💡') || rec.includes('consider') ? 'bg-yellow-500/10 border border-yellow-500/30' :
                            rec.includes('✅') ? 'bg-green-500/10 border border-green-500/30' :
                            'bg-blue-500/10 border border-blue-500/30'
                          }`}
                        >
                          {rec.includes('⚠️') || rec.includes('Critical') ? (
                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          ) : rec.includes('✅') ? (
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-gray-300 text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Processes Tab */}
            {activeTab === 'processes' && (
              <div className="space-y-6">
                {/* Model Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { key: 'llm', label: 'LLM Models', color: 'purple' },
                    { key: 'whisper', label: 'Whisper STT', color: 'blue' },
                    { key: 'embedding', label: 'Embedding', color: 'green' },
                    { key: 'other', label: 'Other', color: 'gray' }
                  ].map(({ key, label, color }) => {
                    const processes = models[key as keyof typeof models] || [];
                    const totalVram = processes.reduce((sum, p) => sum + p.vram_mb, 0);
                    
                    return (
                      <div key={key} className={`bg-${color}-500/10 rounded-xl p-5 border border-${color}-500/30`}>
                        <div className="text-gray-400 text-sm mb-2">{label}</div>
                        <div className="text-2xl font-bold text-white">{processes.length}</div>
                        <div className="text-gray-500 text-sm mt-1">
                          {formatMB(totalVram)} VRAM
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Process List */}
                <div className="bg-black/20 rounded-xl border border-white/5">
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-white font-semibold">Running Processes</h3>
                    <p className="text-gray-500 text-sm">
                      Total Model VRAM: {formatMB(totalModelVram)}
                    </p>
                  </div>
                  
                  <div className="divide-y divide-white/5">
                    {Object.values(models).flat().length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No GPU processes detected</p>
                      </div>
                    ) : (
                      Object.entries(models).map(([type, processes]) => 
                        processes.map((proc: GpuProcess, idx: number) => (
                          <div key={`${type}-${proc.pid}-${idx}`} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                type === 'llm' ? 'bg-purple-500/20 text-purple-400' :
                                type === 'whisper' ? 'bg-blue-500/20 text-blue-400' :
                                type === 'embedding' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                <Cpu className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-white font-medium">{proc.name}</div>
                                <div className="text-gray-500 text-sm">
                                  PID: {proc.pid} • Type: {proc.type}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white font-medium">{formatMB(proc.vram_mb)}</div>
                              <div className="text-gray-500 text-sm">VRAM</div>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {chartData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No history data available yet</p>
                  </div>
                ) : (
                  <>
                    {/* VRAM Chart */}
                    <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                      <h3 className="text-white font-semibold mb-4">VRAM Usage History</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="vramGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                              labelStyle={{ color: '#9ca3af' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="vram"
                              name="VRAM %"
                              stroke="#8b5cf6"
                              fillOpacity={1}
                              fill="url(#vramGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Temperature Chart */}
                    <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                      <h3 className="text-white font-semibold mb-4">Temperature History</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} domain={[40, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                              labelStyle={{ color: '#9ca3af' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="temp"
                              name="Temperature °C"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* GPU Utilization Chart */}
                    <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                      <h3 className="text-white font-semibold mb-4">GPU Utilization History</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                              labelStyle={{ color: '#9ca3af' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="util"
                              name="GPU %"
                              stroke="#3b82f6"
                              fillOpacity={1}
                              fill="url(#utilGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GpuDashboard;
