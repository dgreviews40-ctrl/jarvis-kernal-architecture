/**
 * Agent Dashboard - Kernel v1.5.0
 * 
 * Visual interface for the Agent System:
 * - Active goals and progress
 * - Task execution visualization
 * - Tool usage statistics
 * - Manual goal creation
 * - Real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, Play, Pause, X, CheckCircle, XCircle, Clock, 
  RotateCcw, Layers, Wrench, TrendingUp, AlertCircle,
  ChevronDown, ChevronRight, Zap
} from 'lucide-react';
import { 
  agentOrchestrator, 
  AgentGoal, 
  AgentTask, 
  AgentEvent,
  TaskStatus 
} from '../services/agentOrchestrator';
import { logger } from '../services/logger';

export const AgentDashboard: React.FC = () => {
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [newGoalInput, setNewGoalInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalGoals: 0,
    activeGoals: 0,
    completedGoals: 0,
    failedGoals: 0,
  });

  // Subscribe to agent events
  useEffect(() => {
    const unsubscribe = agentOrchestrator.onEvent((event: AgentEvent) => {
      // Refresh goals on any event
      refreshGoals();
    });

    // Initial load
    refreshGoals();

    // Refresh interval
    const interval = setInterval(refreshGoals, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const refreshGoals = useCallback(() => {
    const allGoals = agentOrchestrator.getAllGoals();
    setGoals(allGoals);
    
    setStats({
      totalGoals: allGoals.length,
      activeGoals: allGoals.filter(g => g.status === 'executing' || g.status === 'planning').length,
      completedGoals: allGoals.filter(g => g.status === 'completed').length,
      failedGoals: allGoals.filter(g => g.status === 'failed').length,
    });
  }, []);

  const handleCreateGoal = async () => {
    if (!newGoalInput.trim()) return;
    
    setIsCreating(true);
    try {
      const goal = await agentOrchestrator.createGoal(newGoalInput, {
        priority: 'medium',
      });
      setSelectedGoal(goal.id);
      setNewGoalInput('');
      logger.log('AGENT', `Created goal: ${goal.id}`, 'success');
    } catch (error) {
      logger.log('AGENT', `Failed to create goal: ${(error as Error).message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelGoal = (goalId: string) => {
    agentOrchestrator.cancelGoal(goalId);
    logger.log('AGENT', `Cancelled goal: ${goalId}`, 'warning');
  };

  const toggleTaskExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      case 'executing':
        return <Zap size={16} className="text-yellow-400 animate-pulse" />;
      case 'retrying':
        return <RotateCcw size={16} className="text-orange-400 animate-spin" />;
      case 'pending':
        return <Clock size={16} className="text-gray-500" />;
      case 'cancelled':
        return <X size={16} className="text-gray-500" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/30 border-green-700/50 text-green-400';
      case 'failed':
        return 'bg-red-900/30 border-red-700/50 text-red-400';
      case 'executing':
        return 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400';
      case 'retrying':
        return 'bg-orange-900/30 border-orange-700/50 text-orange-400';
      case 'pending':
        return 'bg-gray-900/30 border-gray-700/50 text-gray-400';
      case 'cancelled':
        return 'bg-gray-900/30 border-gray-700/50 text-gray-500';
      default:
        return 'bg-gray-900/30 border-gray-700/50 text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-cyan-400 font-mono p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-cyan-300">Agent System</h2>
            <p className="text-xs text-cyan-600">Kernel v1.5.0 • Full Autonomous Agents</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <StatBadge icon={<Layers size={14} />} label="Total" value={stats.totalGoals} color="cyan" />
          <StatBadge icon={<Zap size={14} />} label="Active" value={stats.activeGoals} color="yellow" />
          <StatBadge icon={<CheckCircle size={14} />} label="Completed" value={stats.completedGoals} color="green" />
          <StatBadge icon={<XCircle size={14} />} label="Failed" value={stats.failedGoals} color="red" />
        </div>
      </div>

      {/* New Goal Input */}
      <div className="mb-4 p-4 bg-cyan-900/20 border border-cyan-700/30 rounded">
        <label className="block text-sm text-cyan-300 mb-2">Create New Goal</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newGoalInput}
            onChange={(e) => setNewGoalInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGoal()}
            placeholder="Describe a complex task (e.g., 'Plan a dinner party for 6 people')..."
            className="flex-1 px-3 py-2 bg-cyan-950 border border-cyan-700 rounded text-cyan-300 placeholder-cyan-700"
            disabled={isCreating}
          />
          <button
            onClick={handleCreateGoal}
            disabled={isCreating || !newGoalInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-black font-semibold rounded transition-colors flex items-center gap-2"
          >
            <Play size={16} />
            {isCreating ? 'Creating...' : 'Execute'}
          </button>
        </div>
        <p className="text-xs text-cyan-600 mt-2">
          The agent will decompose your request into sub-tasks, select appropriate tools, and execute them.
        </p>
      </div>

      {/* Goals List */}
      <div className="flex-1 overflow-auto space-y-3">
        {goals.length === 0 ? (
          <div className="text-center py-12 text-cyan-600">
            <Bot size={48} className="mx-auto mb-4 opacity-50" />
            <p>No goals yet. Create one above to see the agent in action!</p>
          </div>
        ) : (
          goals.slice().reverse().map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isSelected={selectedGoal === goal.id}
              onSelect={() => setSelectedGoal(selectedGoal === goal.id ? null : goal.id)}
              onCancel={() => handleCancelGoal(goal.id)}
              expandedTasks={expandedTasks}
              onToggleTask={toggleTaskExpand}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-cyan-800/30 text-xs text-cyan-600 flex justify-between">
        <span>Agent System v1.5.0</span>
        <span>Tools: {agentOrchestrator.getAllTools().length} registered</span>
      </div>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface GoalCardProps {
  goal: AgentGoal;
  isSelected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  expandedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
  getStatusIcon: (status: TaskStatus) => React.ReactNode;
  getStatusColor: (status: TaskStatus) => string;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  isSelected,
  onSelect,
  onCancel,
  expandedTasks,
  onToggleTask,
  getStatusIcon,
  getStatusColor,
}) => {
  const isActive = goal.status === 'executing' || goal.status === 'planning';
  const completedTasks = goal.tasks.filter(t => t.status === 'completed').length;
  const failedTasks = goal.tasks.filter(t => t.status === 'failed').length;

  return (
    <div className={`border rounded transition-all ${
      isSelected ? 'border-cyan-500 bg-cyan-900/20' : 'border-cyan-800/30 bg-cyan-900/10'
    }`}>
      {/* Goal Header */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-cyan-800/20"
        onClick={onSelect}
      >
        {isSelected ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-cyan-300 truncate">{goal.description}</span>
            {isActive && <span className="text-xs animate-pulse">●</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-cyan-600 mt-1">
            <span>{completedTasks}/{goal.tasks.length} tasks</span>
            {failedTasks > 0 && <span className="text-red-400">{failedTasks} failed</span>}
            <span>{formatDuration(goal.createdAt, goal.completedAt)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-24">
          <div className="h-2 bg-cyan-950 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                goal.status === 'completed' ? 'bg-green-500' :
                goal.status === 'failed' ? 'bg-red-500' :
                'bg-cyan-500'
              }`}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <div className="text-xs text-center mt-1">{goal.progress}%</div>
        </div>

        {/* Actions */}
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="p-1 hover:bg-red-900/50 rounded text-red-400"
            title="Cancel Goal"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Task List */}
      {isSelected && (
        <div className="border-t border-cyan-800/30 p-3 space-y-2">
          {goal.tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={index}
              isExpanded={expandedTasks.has(task.id)}
              onToggle={() => onToggleTask(task.id)}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TaskRowProps {
  task: AgentTask;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  getStatusIcon: (status: TaskStatus) => React.ReactNode;
  getStatusColor: (status: TaskStatus) => string;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  index,
  isExpanded,
  onToggle,
  getStatusIcon,
  getStatusColor,
}) => {
  return (
    <div className={`rounded border ${getStatusColor(task.status)}`}>
      <div 
        className="p-2 flex items-center gap-2 cursor-pointer"
        onClick={onToggle}
      >
        {getStatusIcon(task.status)}
        <span className="text-xs text-cyan-600 w-6">#{index + 1}</span>
        <span className="flex-1 text-sm">{task.description}</span>
        {task.tool && (
          <span className="text-xs px-2 py-0.5 bg-cyan-800/50 rounded">
            <Wrench size={10} className="inline mr-1" />
            {task.tool}
          </span>
        )}
        {task.retryCount > 0 && (
          <span className="text-xs text-orange-400">
            Retry {task.retryCount}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 text-xs space-y-1 border-t border-cyan-800/20 pt-2">
          <div className="text-cyan-600">ID: {task.id}</div>
          {task.tool && <div className="text-cyan-600">Tool: {task.tool}</div>}
          {task.dependencies.length > 0 && (
            <div className="text-cyan-600">Depends on: {task.dependencies.join(', ')}</div>
          )}
          {task.startedAt && (
            <div className="text-cyan-600">
              Started: {new Date(task.startedAt).toLocaleTimeString()}
            </div>
          )}
          {task.completedAt && (
            <div className="text-cyan-600">
              Completed: {new Date(task.completedAt).toLocaleTimeString()}
            </div>
          )}
          {task.error && (
            <div className="text-red-400">Error: {task.error}</div>
          )}
          {task.result !== undefined && task.result !== null && (
            <div className="text-green-400">
              Result: {typeof task.result === 'string' ? task.result : JSON.stringify(task.result).substring(0, 100)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface StatBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'cyan' | 'yellow' | 'green' | 'red';
}

const StatBadge: React.FC<StatBadgeProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    cyan: 'bg-cyan-900/30 text-cyan-400',
    yellow: 'bg-yellow-900/30 text-yellow-400',
    green: 'bg-green-900/30 text-green-400',
    red: 'bg-red-900/30 text-red-400',
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${colorClasses[color]}`}>
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
};

// ==================== UTILITIES ====================

function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default AgentDashboard;
