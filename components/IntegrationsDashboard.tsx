import React, { useState, useEffect } from 'react';
import { 
  Calendar, Cloud, Newspaper, Search, CheckSquare, 
  Zap, Settings, X, Plus, Trash2, Bell 
} from 'lucide-react';
import { integrationHub } from '../services/integrations';
import { calendar, CalendarEvent } from '../services/integrations/calendar';
import { taskAutomation, Task, AutomationRule } from '../services/integrations/taskAutomation';

interface IntegrationsDashboardProps {
  onClose: () => void;
}

export const IntegrationsDashboard: React.FC<IntegrationsDashboardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'tasks' | 'automations'>('overview');
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    // Load data
    setUpcomingEvents(calendar.getUpcoming(48));
    setTasks(taskAutomation.getTasks({ status: 'pending' }));
    
    // Subscribe to updates
    const unsubscribeCalendar = calendar.subscribe((event) => {
      setUpcomingEvents(prev => [...prev, event].sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      ));
    });

    return () => {
      unsubscribeCalendar();
    };
  }, []);

  const capabilities = integrationHub.getCapabilities();

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    
    const task = taskAutomation.createTask({
      title: newTaskTitle,
      status: 'pending',
      priority: 'medium',
      tags: []
    });
    
    setTasks(prev => [...prev, task]);
    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const handleCompleteTask = (taskId: string) => {
    taskAutomation.completeTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8">
      <div className="w-full max-w-5xl h-[80vh] bg-[#0a0a0a] border border-cyan-900/30 rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-900/20">
          <div className="flex items-center gap-4">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Integrations & Capabilities</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cyan-900/20 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 border-b border-cyan-900/20">
          {[
            { id: 'overview', label: 'Overview', icon: Zap },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'automations', label: 'Automations', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-900/40 text-cyan-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {capabilities.map((cap, i) => (
                  <div
                    key={i}
                    className="p-4 bg-cyan-900/10 border border-cyan-900/20 rounded-lg"
                  >
                    <p className="text-sm text-gray-300">{cap}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="p-4 bg-purple-900/10 border border-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Upcoming</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{upcomingEvents.length}</p>
                  <p className="text-xs text-gray-500">Events in next 48h</p>
                </div>

                <div className="p-4 bg-green-900/10 border border-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Tasks</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{tasks.length}</p>
                  <p className="text-xs text-gray-500">Pending tasks</p>
                </div>

                <div className="p-4 bg-orange-900/10 border border-orange-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5 text-orange-400" />
                    <span className="text-sm font-medium text-orange-400">Automations</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{automations.length}</p>
                  <p className="text-xs text-gray-500">Active rules</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Upcoming Events</h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-500">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 p-3 bg-cyan-900/10 border border-cyan-900/20 rounded"
                    >
                      <div className="w-12 h-12 bg-cyan-900/30 rounded flex flex-col items-center justify-center">
                        <span className="text-xs text-cyan-400">
                          {event.startTime.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-lg font-bold text-white">
                          {event.startTime.getDate()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{event.title}</p>
                        <p className="text-sm text-gray-500">
                          {event.startTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        event.type === 'reminder' 
                          ? 'bg-yellow-900/30 text-yellow-400' 
                          : 'bg-cyan-900/30 text-cyan-400'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Pending Tasks</h3>
                <button
                  onClick={() => setShowAddTask(true)}
                  className="flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded text-sm hover:bg-green-900/50"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>

              {showAddTask && (
                <div className="flex gap-2 p-3 bg-gray-900/50 rounded">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="flex-1 bg-black border border-cyan-900/30 rounded px-3 py-2 text-white text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-4 py-2 bg-green-900/50 text-green-400 rounded text-sm"
                  >
                    Add
                  </button>
                </div>
              )}

              {tasks.length === 0 ? (
                <p className="text-gray-500">No pending tasks</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-green-900/10 border border-green-900/20 rounded"
                    >
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="w-5 h-5 border-2 border-green-500 rounded hover:bg-green-500/20"
                      />
                      <div className="flex-1">
                        <p className="text-white">{task.title}</p>
                        {task.dueDate && (
                          <p className="text-xs text-gray-500">
                            Due: {task.dueDate.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        task.priority === 'high'
                          ? 'bg-red-900/30 text-red-400'
                          : task.priority === 'medium'
                          ? 'bg-yellow-900/30 text-yellow-400'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'automations' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Active Automations</h3>
              {automations.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No automations yet</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Try saying: "Every morning tell me the weather"
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {automations.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3 bg-orange-900/10 border border-orange-900/20 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-white">{rule.name}</p>
                        <span className={`w-2 h-2 rounded-full ${
                          rule.enabled ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Trigger: {rule.trigger.type} • Triggered {rule.triggerCount} times
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-900/20 text-xs text-gray-500">
          Try: "Remind me to call mom at 5pm" • "What's the weather?" • "Add task: Finish report"
        </div>
      </div>
    </div>
  );
};

export default IntegrationsDashboard;
