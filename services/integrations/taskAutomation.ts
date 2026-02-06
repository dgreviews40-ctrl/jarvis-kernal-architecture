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
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  tags?: string[];
  createdAt: number;
  completedAt?: number;
}

class TaskAutomationService {
  private rules: Map<string, AutomationRule> = new Map();
  private tasks: Map<string, Task> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private observers: ((event: string, data: any) => void)[] = [];
  private speakFunction: ((text: string) => void) | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Set the speak function to use for automation notifications
   */
  public setSpeakFunction(speakFn: (text: string) => void): void {
    this.speakFunction = speakFn;
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
   * Get all automation rules
   */
  public getRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Delete an automation rule
   */
  public deleteRule(ruleId: string): boolean {
    // Clear any associated timers
    const initialTimerId = `${ruleId}_initial`;
    if (this.timers.has(initialTimerId)) {
      clearTimeout(this.timers.get(initialTimerId)!);
      this.timers.delete(initialTimerId);
    }
    if (this.timers.has(ruleId)) {
      // Check if it's a timeout or interval and clear appropriately
      const timer = this.timers.get(ruleId);
      // We can't determine the exact type, so try both
      try {
        clearTimeout(timer!);
      } catch (e) {}
      try {
        clearInterval(timer!);
      } catch (e) {}
      this.timers.delete(ruleId);
    }

    // Remove the rule
    const deleted = this.rules.delete(ruleId);

    // Save to storage
    this.saveToStorage();

    // Notify subscribers
    this.notify('automation_deleted', { id: ruleId });

    return deleted;
  }

  /**
   * Update an automation rule status
   */
  public updateRuleStatus(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    // If disabling, clear the timer
    if (!enabled) {
      rule.enabled = enabled;

      const initialTimerId = `${ruleId}_initial`;
      if (this.timers.has(initialTimerId)) {
        clearTimeout(this.timers.get(initialTimerId)!);
        this.timers.delete(initialTimerId);
      }
      if (this.timers.has(ruleId)) {
        // Check if it's a timeout or interval and clear appropriately
        const timer = this.timers.get(ruleId);
        try {
          clearTimeout(timer!);
        } catch (e) {}
        try {
          clearInterval(timer!);
        } catch (e) {}
        this.timers.delete(ruleId);
      }
    } else {
      // If enabling, clear existing timers and restart the trigger
      const initialTimerId = `${ruleId}_initial`;
      if (this.timers.has(initialTimerId)) {
        clearTimeout(this.timers.get(initialTimerId)!);
        this.timers.delete(initialTimerId);
      }
      if (this.timers.has(ruleId)) {
        // Check if it's a timeout or interval and clear appropriately
        const timer = this.timers.get(ruleId);
        try {
          clearTimeout(timer!);
        } catch (e) {}
        try {
          clearInterval(timer!);
        } catch (e) {}
        this.timers.delete(ruleId);
      }

      rule.enabled = enabled;

      // Restart the trigger
      this.setupTrigger(rule);
    }

    // Save to storage
    this.saveToStorage();

    // Notify subscribers
    this.notify('automation_updated', { id: ruleId, enabled });

    return true;
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

    // Notify subscribers that a task was created
    this.notify('task_created', newTask);

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

    // Notify subscribers that a task was completed
    this.notify('task_completed', task);

    return true;
  }

  /**
   * Parse natural language automation
   */
  public parseAutomation(text: string): { name: string; trigger: TriggerCondition; actions: AutomationAction[] } | null {
    const lower = text.toLowerCase();

    // Morning briefing automation: "Wake me up at 7:40 AM with weather and encouragement"
    const morningBriefingMatch = text.match(/(?:wake me up|morning briefing|daily briefing|daily report|daily update).*?at\s+(\d{1,2}):(\d{2})\s*(?:AM|PM|am|pm)?/i);
    if (morningBriefingMatch) {
      const hours = parseInt(morningBriefingMatch[1]);
      const minutes = parseInt(morningBriefingMatch[2]);

      // Convert to 24-hour format if needed
      let adjustedHours = hours;
      if (text.toLowerCase().includes('pm') && hours !== 12) {
        adjustedHours = hours + 12;
      } else if (text.toLowerCase().includes('am') && hours === 12) {
        adjustedHours = 0;
      }

      const timeString = `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      // Generate a morning briefing message
      const message = "morning_briefing"; // Special indicator for dynamic briefing

      return {
        name: `Morning Briefing at ${timeString}`,
        trigger: {
          type: 'time',
          config: { time: timeString, recurrence: 'daily' }
        },
        actions: [{
          type: 'speak',
          config: { message: message }
        }]
      };
    }

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
          // Handle dynamic morning briefing with weather info
          let message = action.config.message;

          // If this is a morning briefing, enrich with weather data
          if (message.includes('morning_briefing') || message.includes('daily briefing') || message.includes('morning briefing')) {
            message = await this.generateMorningBriefing();
          }

          this.notify('speak', message);
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

  /**
   * Generate a dynamic morning briefing with weather and encouragement
   */
  private async generateMorningBriefing(): Promise<string> {
    // Get current time for personalization
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good morning, sir!";

    if (hour >= 12 && hour < 17) {
      greeting = "Good afternoon, sir!";
    } else if (hour >= 17) {
      greeting = "Good evening, sir!";
    }

    // Try to get weather information
    let weatherInfo = "";
    try {
      // Import the main weather service dynamically to avoid circular dependencies
      const mainWeatherService = await import('../weather');
      const weatherData = mainWeatherService.weatherService.getData();

      if (weatherData) {
        const current = weatherData.current;
        // Use the imperial-only temperature formatter
        const tempF = mainWeatherService.weatherService.formatTemperatureOnlyFahrenheit(current.temperature);
        const condition = current.condition.description;

        weatherInfo = `The current weather is ${tempF} and ${condition.toLowerCase()}. `;

        // Add clothing advice based on weather
        const tempCelsius = current.temperature; // Use the original Celsius value for comparison
        if (tempCelsius < 18) { // ~65°F
          weatherInfo += "It's a bit cool, so I recommend bundling up. ";
        } else if (tempCelsius > 27) { // ~80°F
          weatherInfo += "It's quite warm, so stay hydrated and wear light clothing. ";
        }

        if (condition.toLowerCase().includes("rain")) {
          weatherInfo += "Don't forget your umbrella or raincoat. ";
        }
      } else {
        // Fallback to simulated weather if no real data
        const tempCelsius = Math.floor(Math.random() * 10) + 15; // Random temp in Celsius (about 60-80°F equivalent)
        const tempF = mainWeatherService.weatherService.formatTemperatureOnlyFahrenheit(tempCelsius);
        const conditions = ["sunny", "partly cloudy", "cloudy", "rainy"];
        const condition = conditions[Math.floor(Math.random() * conditions.length)];

        weatherInfo = `The current weather is ${tempF} and ${condition}. `;

        // Add clothing advice based on weather
        if (tempCelsius < 18) { // ~65°F
          weatherInfo += "It's a bit cool, so I recommend bundling up. ";
        } else if (tempCelsius > 27) { // ~80°F
          weatherInfo += "It's quite warm, so stay hydrated and wear light clothing. ";
        }

        if (condition === "rainy") {
          weatherInfo += "Don't forget your umbrella or raincoat. ";
        }
      }
    } catch (e) {
      // Fallback to simulated weather if service fails
      const tempCelsius = Math.floor(Math.random() * 10) + 15; // Random temp in Celsius (about 60-80°F equivalent)
      const tempF = mainWeatherService.weatherService.formatTemperatureOnlyFahrenheit(tempCelsius);
      const conditions = ["sunny", "partly cloudy", "cloudy", "rainy"];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];

      weatherInfo = `The current weather is ${tempF} and ${condition}. `;

      // Add clothing advice based on weather
      const tempCelsiusFallback = Math.floor(Math.random() * 10) + 15; // Use random value for advice
      if (tempCelsiusFallback < 18) { // ~65°F
        weatherInfo += "It's a bit cool, so I recommend bundling up. ";
      } else if (tempCelsiusFallback > 27) { // ~80°F
        weatherInfo += "It's quite warm, so stay hydrated and wear light clothing. ";
      }

      if (condition === "rainy") {
        weatherInfo += "Don't forget your umbrella or raincoat. ";
      }
    }

    // Generate encouragement
    const encouragements = [
      "I trust you'll have a productive day ahead.",
      "I hope your day is filled with success and satisfaction.",
      "May this day bring you closer to your goals.",
      "I'm here to assist you with whatever challenges arise today.",
      "Wishing you a day of achievement and positive outcomes."
    ];
    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    // Generate coffee/tea suggestion
    const beverageSuggestion = Math.random() > 0.5 ?
      "I recommend starting your day with a warm cup of coffee." :
      "A warm cup of tea might be just what you need to begin.";

    return `${greeting} ${weatherInfo}${beverageSuggestion} ${encouragement}`;
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
    } else if (rule.trigger.type === 'time' && rule.trigger.config.time) {
      // Handle specific time triggers (e.g., "every day at 7:40 AM")
      const timeParts = rule.trigger.config.time.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);

      // Determine recurrence pattern
      const recurrence = rule.trigger.config.recurrence || 'daily';
      const selectedDays = rule.trigger.config.selectedDays || [];

      // Calculate milliseconds until next occurrence based on recurrence
      const nextRun = this.getNextRunTime(hours, minutes, recurrence, selectedDays);
      const now = new Date();
      let delay = nextRun.getTime() - now.getTime();

      // If the time has already passed, calculate the next occurrence
      if (delay <= 0) {
        // Calculate next occurrence based on recurrence
        const nextValidRun = this.getNextRunTime(hours, minutes, recurrence, selectedDays, true);
        delay = nextValidRun.getTime() - now.getTime();
      }

      // Set up the initial timeout
      const timer = setTimeout(() => {
        // Execute the action
        this.executeActions(rule.actions);
        rule.lastTriggered = Date.now();
        rule.triggerCount++;

        // Set up the recurring timer based on recurrence pattern
        let intervalTimer: NodeJS.Timeout;

        if (recurrence === 'daily') {
          // Daily recurrence - every 24 hours
          intervalTimer = setInterval(() => {
            this.executeActions(rule.actions);
            rule.lastTriggered = Date.now();
            rule.triggerCount++;
          }, 24 * 60 * 60 * 1000); // 24 hours
        } else if (recurrence === 'weekdays') {
          // Weekdays only (Mon-Fri) - check daily and only execute on weekdays
          intervalTimer = setInterval(() => {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

            // Execute only on weekdays (Monday to Friday)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              this.executeActions(rule.actions);
              rule.lastTriggered = Date.now();
              rule.triggerCount++;
            }
          }, 24 * 60 * 60 * 1000); // Check daily
        } else if (recurrence === 'weekends') {
          // Weekends only (Sat-Sun) - check daily and only execute on weekends
          intervalTimer = setInterval(() => {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

            // Execute only on weekends (Saturday and Sunday)
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              this.executeActions(rule.actions);
              rule.lastTriggered = Date.now();
              rule.triggerCount++;
            }
          }, 24 * 60 * 60 * 1000); // Check daily
        } else if (recurrence === 'custom' && selectedDays && selectedDays.length > 0) {
          // Custom days - check daily and execute on selected days
          intervalTimer = setInterval(() => {
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

            // Execute only on selected days
            if (selectedDays[dayOfWeek]) {
              this.executeActions(rule.actions);
              rule.lastTriggered = Date.now();
              rule.triggerCount++;
            }
          }, 24 * 60 * 60 * 1000); // Check daily
        } else {
          // Default to daily if no valid recurrence specified
          intervalTimer = setInterval(() => {
            this.executeActions(rule.actions);
            rule.lastTriggered = Date.now();
            rule.triggerCount++;
          }, 24 * 60 * 60 * 1000); // 24 hours
        }

        this.timers.set(rule.id, intervalTimer);
      }, delay);

      // Store the initial timer with a unique ID to avoid conflicts with the recurring timer
      this.timers.set(`${rule.id}_initial`, timer);
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

  private getNextRunTime(hours: number, minutes: number, recurrence: string, selectedDays: boolean[], isRescheduling: boolean = false): Date {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    // If rescheduling, we want the next occurrence, not today
    if (isRescheduling) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    // If it's a custom recurrence with specific days
    if (recurrence === 'custom' && selectedDays && selectedDays.length > 0) {
      // Find the next day in the selected days
      let daysToAdd = 0;
      let currentDay = nextRun.getDay();

      // Look ahead for the next selected day
      while (daysToAdd < 7) { // Maximum 7 days to find a match
        if (selectedDays[currentDay]) {
          // If it's today but the time has already passed, add days
          if (daysToAdd === 0 && nextRun.getTime() <= now.getTime()) {
            daysToAdd++;
            currentDay = (currentDay + 1) % 7;
            continue;
          }
          break;
        }
        daysToAdd++;
        currentDay = (currentDay + 1) % 7;
      }

      nextRun.setDate(now.getDate() + daysToAdd);
      nextRun.setHours(hours, minutes, 0, 0);
      return nextRun;
    }

    // For other recurrences
    if (recurrence === 'weekdays') {
      // If it's a weekend, find the next Monday
      const dayOfWeek = nextRun.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (7 - dayOfWeek + 1);
        nextRun.setDate(nextRun.getDate() + daysUntilMonday);
        nextRun.setHours(hours, minutes, 0, 0);
        return nextRun;
      }
    } else if (recurrence === 'weekends') {
      // If it's a weekday, find the next weekend
      const dayOfWeek = nextRun.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        const daysUntilSaturday = 6 - dayOfWeek;
        nextRun.setDate(nextRun.getDate() + daysUntilSaturday);
        nextRun.setHours(hours, minutes, 0, 0);
        return nextRun;
      }
    }

    // If the time has already passed today, set for tomorrow
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
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

    // Handle speak events by using the registered speak function
    if (event === 'speak' && typeof data === 'string' && this.speakFunction) {
      this.speakFunction(data);
    }
  }

  public subscribe(callback: (event: string, data: any) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private saveToStorage(): void {
    // Convert Date objects to ISO strings for storage
    const serializableTasks = Array.from(this.tasks.values()).map(task => ({
      ...task,
      dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
      completedAt: task.completedAt ? task.completedAt : undefined
    }));

    localStorage.setItem('jarvis_automations', JSON.stringify({
      rules: Array.from(this.rules.values()),
      tasks: serializableTasks
    }));
  }

  /**
   * Clean up all timers when shutting down
   */
  public cleanup(): void {
    // Clear all timers
    for (const [id, timer] of this.timers.entries()) {
      // Try both clearTimeout and clearInterval since we're not sure which type it is
      try {
        clearTimeout(timer as any);
      } catch (e) {}
      try {
        clearInterval(timer as any);
      } catch (e) {}
    }
    this.timers.clear();
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem('jarvis_automations');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.rules = new Map(data.rules.map((r: AutomationRule) => [r.id, r]));

        // Convert ISO strings back to Date objects
        this.tasks = new Map(data.tasks.map((t: any) => {
          const task: Task = {
            ...t,
            dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
            completedAt: t.completedAt ? new Date(t.completedAt) : undefined
          };
          return [t.id, task];
        }));

        // Set up triggers for all loaded rules
        for (const rule of this.rules.values()) {
          if (rule.enabled) {
            this.setupTrigger(rule);
          }
        }
      } catch (e) {
        console.error('Failed to load automations:', e);
      }
    }
  }
}

export const taskAutomation = new TaskAutomationService();
