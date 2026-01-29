import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface MonitoringMetric {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  apiLatency: number;
  errorRate: number;
  requestCount: number;
}

const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MonitoringMetric[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'last5min' | 'last30min' | 'lastHour' | 'lastDay'>('last5min');

  // Mock data generation for demonstration
  useEffect(() => {
    const generateMockData = (): MonitoringMetric[] => {
      const now = Date.now();
      const data: MonitoringMetric[] = [];
      
      // Generate data based on selected time range
      let points = 60; // Default to 60 points (1 per minute)
      let intervalMs: number;
      
      switch (selectedTimeRange) {
        case 'last5min':
          intervalMs = 5000; // 5 seconds
          points = 60; // 5 minutes * 60 seconds / 5 seconds
          break;
        case 'last30min':
          intervalMs = 30000; // 30 seconds
          points = 60; // 30 minutes * 60 seconds / 30 seconds
          break;
        case 'lastHour':
          intervalMs = 60000; // 1 minute
          points = 60; // 60 minutes
          break;
        case 'lastDay':
          intervalMs = 3600000; // 1 hour
          points = 24; // 24 hours
          break;
      }
      
      for (let i = points - 1; i >= 0; i--) {
        const timestamp = now - (i * intervalMs);
        const baseCpu = 30 + Math.sin(timestamp / 10000) * 20;
        const baseMemory = 45 + Math.cos(timestamp / 15000) * 15;
        const baseLatency = 150 + Math.sin(timestamp / 20000) * 50;
        
        data.push({
          timestamp,
          cpuUsage: Math.max(10, Math.min(95, baseCpu + (Math.random() - 0.5) * 10)),
          memoryUsage: Math.max(20, Math.min(85, baseMemory + (Math.random() - 0.5) * 8)),
          apiLatency: Math.max(50, Math.min(500, baseLatency + (Math.random() - 0.5) * 30)),
          errorRate: Math.max(0, Math.min(5, 1 + Math.sin(timestamp / 25000) * 2 + (Math.random() - 0.5) * 0.5)),
          requestCount: Math.max(10, Math.min(200, 50 + Math.sin(timestamp / 18000) * 40 + (Math.random() - 0.5) * 15))
        });
      }
      
      return data;
    };

    const mockData = generateMockData();
    setMetrics(mockData);
  }, [selectedTimeRange]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMetricStats = (metric: keyof MonitoringMetric) => {
    if (metrics.length === 0) return { avg: 0, min: 0, max: 0 };
    
    const values = metrics.map(m => m[metric]);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max };
  };

  const cpuStats = getMetricStats('cpuUsage');
  const memoryStats = getMetricStats('memoryUsage');
  const latencyStats = getMetricStats('apiLatency');
  const errorStats = getMetricStats('errorRate');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">System Monitoring Dashboard</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setSelectedTimeRange('last5min')}
            className={`px-3 py-1 rounded-md text-sm ${selectedTimeRange === 'last5min' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Last 5 min
          </button>
          <button 
            onClick={() => setSelectedTimeRange('last30min')}
            className={`px-3 py-1 rounded-md text-sm ${selectedTimeRange === 'last30min' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Last 30 min
          </button>
          <button 
            onClick={() => setSelectedTimeRange('lastHour')}
            className={`px-3 py-1 rounded-md text-sm ${selectedTimeRange === 'lastHour' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Last Hour
          </button>
          <button 
            onClick={() => setSelectedTimeRange('lastDay')}
            className={`px-3 py-1 rounded-md text-sm ${selectedTimeRange === 'lastDay' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Last Day
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-medium">CPU Usage</h3>
          <p className="text-2xl font-bold text-gray-800">{cpuStats.avg.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Min: {cpuStats.min.toFixed(0)}% | Max: {cpuStats.max.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-medium">Memory Usage</h3>
          <p className="text-2xl font-bold text-gray-800">{memoryStats.avg.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Min: {memoryStats.min.toFixed(0)}% | Max: {memoryStats.max.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <h3 className="text-gray-500 text-sm font-medium">API Latency</h3>
          <p className="text-2xl font-bold text-gray-800">{latencyStats.avg.toFixed(0)}ms</p>
          <p className="text-xs text-gray-500">Min: {latencyStats.min.toFixed(0)}ms | Max: {latencyStats.max.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm font-medium">Error Rate</h3>
          <p className="text-2xl font-bold text-gray-800">{errorStats.avg.toFixed(2)}%</p>
          <p className="text-xs text-gray-500">Min: {errorStats.min.toFixed(2)}% | Max: {errorStats.max.toFixed(2)}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">System Resource Usage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Value']}
                  labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cpuUsage" 
                  stroke="#3b82f6" 
                  activeDot={{ r: 8 }} 
                  name="CPU Usage"
                />
                <Line 
                  type="monotone" 
                  dataKey="memoryUsage" 
                  stroke="#10b981" 
                  name="Memory Usage"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">API Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                  interval="preserveStartEnd"
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${value}ms`, 'Latency']}
                  labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                />
                <Legend />
                <Bar dataKey="apiLatency" fill="#8b5cf6" name="API Latency (ms)" />
                <Bar dataKey="errorRate" fill="#ef4444" name="Error Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent System Events</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { time: '18:45:25', event: 'Provider Switch', status: 'Success', details: 'Switched to LOCAL OLLAMA' },
                { time: '18:45:02', event: 'Memory Recall', status: 'Success', details: 'Retrieved location: Medford, OR' },
                { time: '18:44:58', event: 'Weather Query', status: 'Partial', details: 'Weather search returned generic response' },
                { time: '18:44:30', event: 'Voice Recognition', status: 'Success', details: 'Wake word detected' },
                { time: '18:44:15', event: 'Hardware Monitor', status: 'Success', details: 'CPU: 42%, Memory: 58%' },
              ].map((item, index) => (
                <tr key={index} className={item.status === 'Success' ? 'bg-green-50' : item.status === 'Partial' ? 'bg-yellow-50' : 'bg-red-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.time}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.event}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === 'Success' ? 'bg-green-100 text-green-800' :
                      item.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Status */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="font-medium">AI Providers</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Gemini: Online, Ollama: Online</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="font-medium">Hardware Monitor</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Status: Healthy, Last update: 2s ago</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="font-medium">Memory System</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Nodes: 12, Storage: 85% used</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;