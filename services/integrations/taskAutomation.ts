/**
 * Task Automation Service
 * Creates and manages automated workflows
 */

import { memory } from '../memory';

export interface AutomationRule {
  id: string;
  name: string;
  trigger: TriggerCondition;
  actions: AutomationAction[];
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface TriggerCondition {
  type: 'time' | 'voice' | 'event' | 'state' | 'location';
  config: Record<string, any>;
}

export interface AutomationAction {
  type: 'speak' | 'notify' | 'call_service' | 'set_memory' | 'delay';
  config: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  tags: string[];
  createdAt: number;
  completedAt?: number;
}

class TaskAutomationService {
  private rules: Map<string, AutomationRule> = new Map();
  private tasks: Map<string, Task> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private observers: ((event: string, data: any) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Create a new automation rule
   */
  public createRule(name: string, trigger: TriggerCondition, actions: AutomationAction[]): AutomationRule {
    const rule: AutomationRule = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      trigger,
      actions,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0
    };

    this.rules.set(rule.id, rule);
    this.setupTrigger(rule);
    this.saveToStorage();

    return rule;
  }

  /**
   * Create a task
   */
  public createTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
    const newTask: Task = {
      ...task,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: Date.now()
    };

    this.tasks.set(newTask.id, newTask);
    this.saveToStorage();

    // Set up reminder if due date exists
    if (newTask.dueDate) {
      this.scheduleTaskReminder(newTask);
    }

    return newTask;
  }

  /**
   * Get tasks with filters
   */
  public getTasks(filters?: { status?: Task['status']; priority?: Task['priority']; tag?: string }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters?.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    if (filters?.tag) {
      tasks = tasks.filter(t => t.tags.includes(filters.tag!));
    }

    return tasks.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Then by due date
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return 0;
    });
  }

  /**
   * Complete a task
   */
  public completeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.completedAt = Date.now();
    this.saveToStorage();

    return true;
  }

  /**
   * Parse natural language automation
   */
  public parseAutomation(text: string): { name: string; trigger: TriggerCondition; actions: AutomationAction[] } | null {
    const lower = text.toLowerCase();

    // "Every [time] do [action]"
    const everyMatch = text.match(/every\s+(.+?)\s+(?:do|say|tell me|remind me)\s+(.+)/i);
    if (everyMatch) {
      const timeExpr = everyMatch[1];
      const action = everyMatch[2];

      return {
        name: `Automation: ${action}`,
        trigger: {
          type: 'time',
          config: { schedule: this.parseSchedule(timeExpr) }
        },
        actions: [{
          type: 'speak',
          config: { message: action }
        }]
      };
    }

    // "When I say [phrase] do [action]"
    const whenMatch = text.match(/when\s+i\s+say\s+['"]?(.+?)['"]?\s+(?:do|say|run)\s+(.+)/i);
    if (whenMatch) {
      const phrase = whenMatch[1];
      const action = whenMatch[2];

      return {
        name: `Voice trigger: ${phrase}`,
        trigger: {
          type: 'voice',
          config: { phrase }
        },
        actions: this.parseAction(action)
      };
    }

    return null;
  }

  /**
   * Parse task from natural language
   */
  public parseTask(text: string): Partial<Task> | null {
    // "Add task: [title] due [date]"
    const taskMatch = text.match(/(?:add|create)\s+(?:a\s+)?task(?:\s*:\s*|\s+to\s+)(.+?)(?:\s+due\s+(.+))?$/i);
    if (taskMatch) {
      const title = taskMatch[1].trim();
      const dueText = taskMatch[2];

      const task: Partial<Task> = {
        title,
        status: 'pending',
        priority: text.includes('urgent') || text.includes('important') ? 'high' : 'medium',
        tags: []
      };

      if (dueText) {
        task.dueDate = this.parseDateTime(dueText);
      }

      return task;
    }

    return null;
  }

  /**
   * Execute actions for a rule
   */
  public async executeActions(actions: AutomationAction[]): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'speak':
          this.notify('speak', action.config.message);
          break;
        case 'notify':
          this.notify('notify', action.config);
          break;
        case 'set_memory':
          memory.store({
            id: `auto_${Date.now()}`,
            content: action.config.content,
            type: 'FACT',
            tags: ['automation'],
            created: Date.now()
          });
          break;
        case 'delay':
          await new Promise(r => setTimeout(r, action.config.duration));
          break;
      }
    }
  }

  private setupTrigger(rule: AutomationRule): void {
    if (!rule.enabled) return;

    if (rule.trigger.type === 'time' && rule.trigger.config.schedule) {
      // Set up recurring timer (simplified - would use cron in production)
      const interval = this.scheduleToMs(rule.trigger.config.schedule);
      if (interval) {
        const timer = setInterval(() => {
          this.executeActions(rule.actions);
          rule.lastTriggered = Date.now();
          rule.triggerCount++;
        }, interval);
        this.timers.set(rule.id, timer);
      }
    }
  }

  private scheduleTaskReminder(task: Task): void {
    if (!task.dueDate) return;

    const reminderTime = new Date(task.dueDate.getTime() - 15 * 60 * 1000); // 15 min before
    const delay = reminderTime.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        this.notify('task_reminder', {
          taskId: task.id,
          title: task.title,
          dueIn: '15 minutes'
        });
      }, Math.min(delay, 2147483647));
    }
  }

  private parseSchedule(timeExpr: string): string {
    // Simplified schedule parsing
    if (timeExpr.includes('morning')) return '0 9 * * *';
    if (timeExpr.includes('evening')) return '0 18 * * *';
    if (timeExpr.includes('hour')) return '0 * * * *';
    return '0 9 * * *';
  }

  private scheduleToMs(schedule: string): number | null {
    // Convert simple schedules to milliseconds
    if (schedule === '0 * * * *') return 60 * 60 * 1000; // hourly
    if (schedule === '0 9 * * *') return 24 * 60 * 60 * 1000; // daily
    return null;
  }

  private parseDateTime(text: string): Date | null {
    // Simple date parsing (reuse from calendar service)
    const now = new Date();
    if (text.toLowerCase().includes('tomorrow')) {
      const result = new Date(now);
      result.setDate(result.getDate() + 1);
      return result;
    }
    return now;
  }

  private parseAction(action: string): AutomationAction[] {
    if (action.toLowerCase().startsWith('say ') || action.toLowerCase().startsWith('tell me ')) {
      return [{
        type: 'speak',
        config: { message: action.replace(/^(say|tell me)\s+/i, '') }
      }];
    }
    return [{ type: 'notify', config: { action } }];
  }

  private notify(event: string, data: any): void {
    this.observers.forEach(cb => cb(event, data));
  }

  public subscribe(callback: (event: string, data: any) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private saveToStorage(): void {
    localStorage.setItem('jarvis_automations', JSON.stringify({
      rules: Array.from(this.rules.values()),
      tasks: Array.from(this.tasks.values())
    }));
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem('jarvis_automations');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.rules = new Map(data.rules.map((r: AutomationRule) => [r.id, r]));
        this.tasks = new Map(data.tasks.map((t: Task) => [t.id, t]));
      } catch (e) {
        console.error('Failed to load automations:', e);
      }
    }
  }
}

export const taskAutomation = new TaskAutomationService();
