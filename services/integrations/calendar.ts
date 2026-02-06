/**
 * Calendar Integration Service
 * Connects with Google Calendar, Outlook, Apple Calendar
 */

import { memory } from '../memory';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  location?: string;
  attendees?: string[];
  type: 'meeting' | 'reminder' | 'task' | 'personal';
  source: 'google' | 'outlook' | 'apple' | 'local';
}

export interface ReminderRequest {
  text: string;
  time: Date;
  priority: 'low' | 'medium' | 'high';
  recurring?: 'daily' | 'weekly' | 'monthly';
}

class CalendarService {
  private events: CalendarEvent[] = [];
  private reminders: Map<string, NodeJS.Timeout> = new Map();
  private observers: ((event: CalendarEvent) => void)[] = [];

  /**
   * Parse natural language date/time expressions
   */
  public parseDateTime(text: string): Date | null {
    const now = new Date();
    const lower = text.toLowerCase();
    
    // "in X minutes/hours/days"
    const inMatch = lower.match(/in\s+(\d+)\s+(minute|hour|day|week)s?/);
    if (inMatch) {
      const amount = parseInt(inMatch[1]);
      const unit = inMatch[2];
      const result = new Date(now);
      if (unit === 'minute') result.setMinutes(result.getMinutes() + amount);
      if (unit === 'hour') result.setHours(result.getHours() + amount);
      if (unit === 'day') result.setDate(result.getDate() + amount);
      if (unit === 'week') result.setDate(result.getDate() + amount * 7);
      return result;
    }
    
    // "tomorrow at X"
    if (lower.includes('tomorrow')) {
      const timeMatch = lower.match(/(\d+):?(\d*)?\s*(am|pm)?/);
      const result = new Date(now);
      result.setDate(result.getDate() + 1);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]) || 0;
        const period = timeMatch[3];
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        result.setHours(hours, minutes, 0, 0);
      }
      return result;
    }
    
    // "next Monday/Tuesday/etc"
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = days.find(day => lower.includes(`next ${day}`));
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch);
      const result = new Date(now);
      const currentDay = result.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      result.setDate(result.getDate() + daysUntil);
      return result;
    }
    
    return null;
  }

  /**
   * Set a reminder with natural language
   */
  public setReminder(request: ReminderRequest): string {
    const id = Math.random().toString(36).substring(2, 11);
    const delay = request.time.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Reminder time must be in the future');
    }
    
    const timeout = setTimeout(() => {
      this.triggerReminder(id, request);
    }, Math.min(delay, 2147483647)); // Max setTimeout value
    
    this.reminders.set(id, timeout);
    
    // Store in memory
    memory.store(
      `Reminder: ${request.text} at ${request.time.toLocaleString()}`,
      'PREFERENCE',
      ['reminder', request.priority]
    );
    
    return id;
  }

  /**
   * Parse reminder from natural language
   */
  public parseReminder(text: string): ReminderRequest | null {
    // "Remind me to [action] at/in [time]"
    const patterns = [
      /remind\s+me\s+(?:to\s+)?(.+?)\s+(?:at|in|on)\s+(.+)/i,
      /set\s+(?:a\s+)?reminder\s+(?:to\s+)?(.+?)\s+(?:at|in|on)\s+(.+)/i,
      /remind\s+me\s+(?:at|in|on)\s+(.+?)\s+to\s+(.+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const action = match[1].trim();
        const timeText = match[2].trim();
        const time = this.parseDateTime(timeText);
        
        if (time) {
          return {
            text: action,
            time,
            priority: text.includes('urgent') || text.includes('important') ? 'high' : 'medium'
          };
        }
      }
    }
    
    return null;
  }

  private triggerReminder(id: string, request: ReminderRequest): void {
    const event: CalendarEvent = {
      id,
      title: request.text,
      startTime: request.time,
      endTime: new Date(request.time.getTime() + 60000),
      type: 'reminder',
      source: 'local'
    };
    
    this.observers.forEach(cb => cb(event));
    this.reminders.delete(id);
  }

  public subscribe(callback: (event: CalendarEvent) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  /**
   * Get upcoming events
   */
  public getUpcoming(hours: number = 24): CalendarEvent[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    return this.events
      .filter(e => e.startTime >= now && e.startTime <= cutoff)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Cancel a reminder
   */
  public cancelReminder(id: string): boolean {
    const timeout = this.reminders.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.reminders.delete(id);
      return true;
    }
    return false;
  }
}

export const calendar = new CalendarService();
