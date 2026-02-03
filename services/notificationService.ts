/**
 * Notification Service
 * 
 * Toast notification system for user feedback:
 * - Success, error, warning, info notifications
 * - Auto-dismiss with progress indicator
 * - Action buttons
 * - Notification history
 */

import { logger } from './logger';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // ms, 0 = persistent
  actions?: NotificationAction[];
  timestamp: number;
  read: boolean;
}

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  duration?: number;
  actions?: NotificationAction[];
}

// Default durations by type
const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

// Max notifications to show at once
const MAX_VISIBLE = 5;

// Max history size
const MAX_HISTORY = 100;

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: Set<(notifications: Notification[]) => void> = new Set();
  private history: Notification[] = [];

  /**
   * Show a notification
   */
  show(options: NotificationOptions): string {
    const id = this.generateId();
    const type = options.type || 'info';
    const duration = options.duration ?? DEFAULT_DURATIONS[type];

    const notification: Notification = {
      id,
      type,
      title: options.title || this.getDefaultTitle(type),
      message: options.message,
      duration,
      actions: options.actions,
      timestamp: Date.now(),
      read: false,
    };

    this.notifications.push(notification);
    this.history.unshift({ ...notification });

    // Trim history
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    // Trim visible notifications
    if (this.notifications.length > MAX_VISIBLE) {
      const removed = this.notifications.shift();
      if (removed) {
        logger.debug('NOTIFICATION', `Removed old notification: ${removed.id}`);
      }
    }

    this.notifyListeners();

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    logger.debug('NOTIFICATION', `Showed ${type} notification: ${options.message}`);
    return id;
  }

  /**
   * Convenience methods for each type
   */
  success(message: string, title?: string, duration?: number): string {
    return this.show({ type: 'success', title, message, duration });
  }

  error(message: string, title?: string, duration?: number): string {
    return this.show({ type: 'error', title, message, duration });
  }

  warning(message: string, title?: string, duration?: number): string {
    return this.show({ type: 'warning', title, message, duration });
  }

  info(message: string, title?: string, duration?: number): string {
    return this.show({ type: 'info', title, message, duration });
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.notifyListeners();
      logger.debug('NOTIFICATION', `Dismissed notification: ${id}`);
    }
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    this.notifications = [];
    this.notifyListeners();
    logger.debug('NOTIFICATION', 'Dismissed all notifications');
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }

    // Also mark in history
    const historyItem = this.history.find(n => n.id === id);
    if (historyItem) {
      historyItem.read = true;
    }
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.history.forEach(n => n.read = true);
    this.notifyListeners();
  }

  /**
   * Get current notifications
   */
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get notification history
   */
  getHistory(): Notification[] {
    return [...this.history];
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.notifications);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    logger.info('NOTIFICATION', 'History cleared');
  }

  /**
   * Export notification history
   */
  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  // Private methods
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(): void {
    const notifications = [...this.notifications];
    this.listeners.forEach(listener => {
      try {
        listener(notifications);
      } catch (e) {
        logger.error('NOTIFICATION', 'Listener error', { error: e });
      }
    });
  }

  private getDefaultTitle(type: NotificationType): string {
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': return 'Information';
      default: return 'Notification';
    }
  }
}

// Export singleton
export const notificationService = new NotificationService();

// React hook for using notifications
export function useNotifications() {
  return {
    show: notificationService.show.bind(notificationService),
    success: notificationService.success.bind(notificationService),
    error: notificationService.error.bind(notificationService),
    warning: notificationService.warning.bind(notificationService),
    info: notificationService.info.bind(notificationService),
    dismiss: notificationService.dismiss.bind(notificationService),
    dismissAll: notificationService.dismissAll.bind(notificationService),
  };
}
