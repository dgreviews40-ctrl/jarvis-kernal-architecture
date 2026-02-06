/**
 * Worker Pool Dashboard - Kernel v1.3
 * Visualizes worker pool activity, task queue, and performance metrics
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  Cpu, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  BarChart3,
  Zap,
  Layers,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause
} from 'lucide-react';
import { workerPool, WorkerTaskType } from '../services/workerService';
import { eventBus, EventChannels } from '../services/eventBus';

interface WorkerStats {
  activeWorkers: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
}

interface TaskHistoryItem {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export const WorkerPoolDashboard: React.FC = () => {
  const [stats, setStats] = useState<WorkerStats>({
    activeWorkers: 0,
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0
  });
  const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedTaskType, setSelectedTaskType] = useState<WorkerTaskType>('data.transform');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMonitoring) {
      intervalRef.current = window.setInterval(() => {
        const currentStats = workerPool.getStats();
        setStats(currentStats);
      }, 500);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring]);

  const runTestTask = async () => {
    const taskId = Math.random().toString(36).substring(2, 9);
    
    setTaskHistory(prev => [{
      id: taskId,
      type: selectedTaskType,
      status: 'pending' as const
    }, ...prev].slice(0, 20));

    try {
      setTaskHistory(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'running', startTime: Date.now() } : t
      ));

      let result;
      switch (selectedTaskType) {
        case 'data.transform':
          result = await workerPool.execute(selectedTaskType, {
            data: [3, 1, 4, 1, 5, 9, 2, 6],
            operation: 'sort'
          });
          break;
        case 'crypto.hash':
          result = await workerPool.execute(selectedTaskType, {
            data: `test-data-${Date.now()}`,
            algorithm: 'sha256'
          });
          break;
        case 'ai.process':
          result = await workerPool.execute(selectedTaskType, {
            text: 'Process this sample text for testing',
            context: {}
          });
          break;
        case 'image.analyze':
          result = await workerPool.execute(selectedTaskType, {
            imageData: 'mock-image-data'
          });
          break;
        case 'search.index':
          result = await workerPool.execute(selectedTaskType, {
            documents: ['Hello world', 'Test document', 'Sample text']
          });
          break;
        default:
          result = await workerPool.execute(selectedTaskType, {});
      }

      const endTime = Date.now();
      setTaskHistory(prev => prev.map(t => 
        t.id === taskId ? { 
          ...t, 
          status: 'completed', 
          endTime,
          duration: t.startTime ? endTime - t.startTime : 0
        } : t
      ));

      // Publish event
      eventBus.publish(EventChannels.SYSTEM.PERFORMANCE, {
        type: 'worker_task_complete',
        taskType: selectedTaskType,
        duration: endTime - (taskHistory.find(t => t.id === taskId)?.startTime || endTime)
      });

    } catch (error) {
      setTaskHistory(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'failed', endTime: Date.now() } : t
      ));
    }
  };

  const runBatchTasks = async (count: number) => {
    const tasks = Array(count).fill(null).map((_, i) => ({
      type: 'data.transform' as WorkerTaskType,
      payload: { 
        data: Array(100).fill(0).map(() => Math.random()), 
        operation: 'sort' as const 
      },
      priority: Math.floor(Math.random() * 3)
    }));

    const startTime = Date.now();
    await workerPool.executeAll(tasks);
    const duration = Date.now() - startTime;

    // Add batch to history
    const batchId = Math.random().toString(36).substring(2, 9);
    setTaskHistory(prev => [{
      id: `batch-${batchId}`,
      type: `Batch (${count} tasks)`,
      status: 'completed' as const,
      startTime,
      endTime: Date.now(),
      duration
    }, ...prev].slice(0, 20));
  };

  const clearHistory = () => {
    setTaskHistory([]);
  };

  const utilizationPercent = Math.min(100, (stats.pendingTasks / Math.max(1, stats.activeWorkers * 2)) * 100);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-cyan-400 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-cyan-900/50">
        <div className="flex items-center gap-3">
          <Cpu className="text-cyan-500" size={24} />
          <div>
            <h2 className="text-lg font-bold text-white">WORKER POOL</h2>
            <p className="text-xs text-cyan-600">Kernel v1.5.0 • Background Task Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isMonitoring 
                ? 'bg-green-900/30 text-green-400 border border-green-800' 
                : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
            }`}
          >
            {isMonitoring ? <Activity size={14} /> : <Pause size={14} />}
            {isMonitoring ? 'MONITORING' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard
          icon={<Layers size={18} />}
          label="Active Workers"
          value={stats.activeWorkers}
          color="cyan"
          subtitle="2-8 auto-scaling"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Pending Tasks"
          value={stats.pendingTasks}
          color="yellow"
          subtitle="In queue"
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          label="Completed"
          value={stats.completedTasks}
          color="green"
          subtitle="Total successful"
        />
        <StatCard
          icon={<XCircle size={18} />}
          label="Failed"
          value={stats.failedTasks}
          color="red"
          subtitle="Total errors"
        />
        <StatCard
          icon={<BarChart3 size={18} />}
          label="Avg Time"
          value={`${stats.averageExecutionTime.toFixed(0)}ms`}
          color="purple"
          subtitle="Per task"
        />
      </div>

      {/* Utilization Bar */}
      <div className="mb-4 p-3 bg-cyan-950/20 border border-cyan-900/30 rounded">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cyan-600 flex items-center gap-2">
            <Zap size={14} />
            Pool Utilization
          </span>
          <span className="text-xs font-mono text-cyan-400">{utilizationPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-cyan-950 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 rounded-full ${
              utilizationPercent > 80 ? 'bg-red-500' : 
              utilizationPercent > 50 ? 'bg-yellow-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${utilizationPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-cyan-700">
          <span>Idle</span>
          <span>Optimal</span>
          <span>Maxed</span>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-4 p-3 bg-cyan-950/20 border border-cyan-900/30 rounded">
        <div className="text-xs text-cyan-600 mb-2 flex items-center gap-2">
          <Play size={14} />
          TEST CONTROLS
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTaskType}
            onChange={(e) => setSelectedTaskType(e.target.value as WorkerTaskType)}
            className="bg-black border border-cyan-800 text-cyan-400 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="data.transform">Data Transform</option>
            <option value="crypto.hash">Crypto Hash</option>
            <option value="ai.process">AI Process</option>
            <option value="image.analyze">Image Analyze</option>
            <option value="search.index">Search Index</option>
          </select>
          
          <button
            onClick={runTestTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-400 text-xs rounded transition-colors"
          >
            <Play size={12} />
            Run Task
          </button>
          
          <button
            onClick={() => runBatchTasks(5)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-400 text-xs rounded transition-colors"
          >
            <Layers size={12} />
            Batch 5
          </button>
          
          <button
            onClick={() => runBatchTasks(10)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-400 text-xs rounded transition-colors"
          >
            <Layers size={12} />
            Batch 10
          </button>

          <div className="flex-1" />
          
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800 text-red-400 text-xs rounded transition-colors"
          >
            <RefreshCw size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Task History */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cyan-600 flex items-center gap-2">
            <Activity size={14} />
            TASK HISTORY
          </span>
          <span className="text-[10px] text-cyan-700">{taskHistory.length} tasks</span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar border border-cyan-900/30 rounded bg-black/30">
          {taskHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-cyan-800">
              <Clock size={32} className="mb-2 opacity-50" />
              <span className="text-xs">No tasks executed yet</span>
              <span className="text-[10px] mt-1">Run a test task to see activity</span>
            </div>
          ) : (
            <div className="divide-y divide-cyan-900/20">
              {taskHistory.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TaskStatusIcon status={task.status} />
                    <div>
                      <div className="text-xs text-cyan-400 font-medium">{task.type}</div>
                      <div className="text-[10px] text-cyan-700 font-mono">{task.id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {task.duration && (
                      <div className="text-xs text-cyan-500 font-mono">
                        {task.duration}ms
                      </div>
                    )}
                    <div className="text-[10px] text-cyan-700">
                      {task.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-3 border-t border-cyan-900/30 flex items-center justify-between text-[10px] text-cyan-700">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Web Workers Active
          </span>
          <span>Auto-scaling: 2-8 workers</span>
        </div>
        <div>
          Task timeout: 30s
        </div>
      </div>
    </div>
  );
};

// Sub-components
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'cyan' | 'green' | 'yellow' | 'red' | 'purple';
  subtitle: string;
}> = ({ icon, label, value, color, subtitle }) => {
  const colorClasses = {
    cyan: 'border-cyan-800 bg-cyan-950/20 text-cyan-400',
    green: 'border-green-800 bg-green-950/20 text-green-400',
    yellow: 'border-yellow-800 bg-yellow-950/20 text-yellow-400',
    red: 'border-red-800 bg-red-950/20 text-red-400',
    purple: 'border-purple-800 bg-purple-950/20 text-purple-400'
  };

  return (
    <div className={`p-3 rounded border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
      <div className="text-[10px] opacity-50">{subtitle}</div>
    </div>
  );
};

const TaskStatusIcon: React.FC<{ status: TaskHistoryItem['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock size={14} className="text-yellow-500" />;
    case 'running':
      return <RefreshCw size={14} className="text-cyan-500 animate-spin" />;
    case 'completed':
      return <CheckCircle size={14} className="text-green-500" />;
    case 'failed':
      return <XCircle size={14} className="text-red-500" />;
    default:
      return <AlertTriangle size={14} className="text-gray-500" />;
  }
};

export default WorkerPoolDashboard;
