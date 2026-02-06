/**
 * Notification System
 * 
 * Displays user-friendly error messages, warnings, and info notifications.
 * Auto-dismisses after a timeout, with action buttons for recovery.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, RefreshCw } from 'lucide-react';

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // ms, 0 = persistent
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

interface NotificationSystemProps {
  maxNotifications?: number;
  defaultDuration?: number;
}

// Global notification queue
let notificationQueue: Notification[] = [];
let listeners: Set<(notifications: Notification[]) => void> = new Set();

function notify(notification: Omit<Notification, 'id'>): string {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newNotification = { ...notification, id };
  
  notificationQueue = [...notificationQueue, newNotification];
  listeners.forEach(listener => listener(notificationQueue));
  
  return id;
}

function dismiss(id: string): void {
  notificationQueue = notificationQueue.filter(n => n.id !== id);
  listeners.forEach(listener => listener(notificationQueue));
}

// Public API
export const notifications = {
  error: (title: string, message: string, options?: Partial<Notification>) => 
    notify({ type: 'error', title, message, duration: 0, ...options }),
  
  warning: (title: string, message: string, options?: Partial<Notification>) => 
    notify({ type: 'warning', title, message, duration: 5000, ...options }),
  
  info: (title: string, message: string, options?: Partial<Notification>) => 
    notify({ type: 'info', title, message, duration: 3000, ...options }),
  
  success: (title: string, message: string, options?: Partial<Notification>) => 
    notify({ type: 'success', title, message, duration: 3000, ...options }),
  
  dismiss
};

// Hook to use notifications
export function useNotifications() {
  return notifications;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000
}) => {
  const [notificationList, setNotificationList] = useState<Notification[]>([]);
  
  useEffect(() => {
    // Subscribe to notification queue
    listeners.add(setNotificationList);
    
    // Listen for global error events
    const handleGlobalNotification = (event: CustomEvent) => {
      const { type, message } = event.detail;
      
      if (type === 'error') {
        notify({ type: 'error', title: 'Error', message, duration: 0 });
      } else if (type === 'warning') {
        notify({ type: 'warning', title: 'Warning', message, duration: 5000 });
      } else {
        notify({ type: 'info', title: 'Info', message, duration: 3000 });
      }
    };
    
    window.addEventListener('jarvis-notification', handleGlobalNotification as EventListener);
    
    return () => {
      listeners.delete(setNotificationList);
      window.removeEventListener('jarvis-notification', handleGlobalNotification as EventListener);
    };
  }, []);
  
  // Auto-dismiss notifications
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    notificationList.forEach(notification => {
      const duration = notification.duration ?? defaultDuration;
      
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(notification.id);
        }, duration);
        timers.push(timer);
      }
    });
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, defaultDuration]);
  
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'error': return <AlertCircle size={20} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={20} className="text-yellow-400" />;
      case 'success': return <CheckCircle size={20} className="text-green-400" />;
      case 'info': return <Info size={20} className="text-cyan-400" />;
    }
  };
  
  const getStyles = (type: NotificationType) => {
    switch (type) {
      case 'error': return 'bg-red-950/90 border-red-500/50';
      case 'warning': return 'bg-yellow-950/90 border-yellow-500/50';
      case 'success': return 'bg-green-950/90 border-green-500/50';
      case 'info': return 'bg-cyan-950/90 border-cyan-500/50';
    }
  };
  
  // Limit visible notifications
  const visibleNotifications = notificationList.slice(0, maxNotifications);
  const overflowCount = notificationList.length - maxNotifications;
  
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
      {visibleNotifications.map(notification => (
        <div
          key={notification.id}
          className={`
            p-4 rounded-lg border shadow-lg backdrop-blur-sm
            animate-in slide-in-from-right fade-in duration-200
            ${getStyles(notification.type)}
          `}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-sm">
                {notification.title}
              </h4>
              <p className="text-gray-300 text-xs mt-1">
                {notification.message}
              </p>
              
              {/* Action buttons */}
              {notification.actions && notification.actions.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {notification.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick();
                        dismiss(notification.id);
                      }}
                      className={`
                        px-3 py-1.5 text-xs font-medium rounded transition-colors
                        ${action.variant === 'primary'
                          ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Dismiss button */}
            <button
              onClick={() => dismiss(notification.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Progress bar for auto-dismiss */}
          {notification.duration !== 0 && (
            <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`
                  h-full rounded-full
                  ${notification.type === 'error' ? 'bg-red-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' :
                    notification.type === 'success' ? 'bg-green-500' :
                    'bg-cyan-500'}
                `}
                style={{
                  animation: `shrink ${notification.duration ?? defaultDuration}ms linear forwards`
                }}
              />
            </div>
          )}
        </div>
      ))}
      
      {/* Overflow indicator */}
      {overflowCount > 0 && (
        <div className="text-center text-xs text-gray-500 py-2">
          +{overflowCount} more notifications
        </div>
      )}
      
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default NotificationSystem;
