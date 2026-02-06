/**
 * Toast Notifications Component
 * 
 * Displays toast notifications with auto-dismiss and progress bar
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Bell
} from 'lucide-react';
import { Notification, notificationService } from '../services/notificationService';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  index: number;
}

const Toast: React.FC<ToastProps> = ({ notification, onDismiss, index }) => {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const startTimeRef = useRef(Date.now());
  const animationRef = useRef<number | null>(null);

  const icons = {
    success: <CheckCircle size={20} className="text-green-400" />,
    error: <XCircle size={20} className="text-red-400" />,
    warning: <AlertTriangle size={20} className="text-yellow-400" />,
    info: <Info size={20} className="text-cyan-400" />,
  };

  const borderColors = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    warning: 'border-yellow-500/30',
    info: 'border-cyan-500/30',
  };

  const bgColors = {
    success: 'bg-green-950/20',
    error: 'bg-red-950/20',
    warning: 'bg-yellow-950/20',
    info: 'bg-cyan-950/20',
  };

  const progressColors = {
    success: 'bg-green-400',
    error: 'bg-red-400',
    warning: 'bg-yellow-400',
    info: 'bg-cyan-400',
  };

  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  }, [notification.id, onDismiss]);

  // Progress bar animation
  useEffect(() => {
    if (notification.duration === 0) return;

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, notification.duration! - elapsed);
      const newProgress = (remaining / notification.duration!) * 100;
      
      setProgress(newProgress);

      if (remaining > 0) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [notification.duration]);

  // Calculate position offset
  const topOffset = index * 80;

  return (
    <div
      className={`
        fixed right-4 z-50 w-96 max-w-[calc(100vw-2rem)]
        transition-all duration-300 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      style={{ top: `${16 + topOffset}px` }}
    >
      <div
        className={`
          relative overflow-hidden rounded-lg border ${borderColors[notification.type]} ${bgColors[notification.type]}
          bg-gray-900/95 backdrop-blur-sm shadow-lg
        `}
      >
        {/* Progress bar */}
        {notification.duration !== 0 && (
          <div
            className={`absolute bottom-0 left-0 h-1 ${progressColors[notification.type]} transition-none`}
            style={{ width: `${progress}%` }}
          />
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {icons[notification.type]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-sm">
                {notification.title}
              </h4>
              <p className="text-gray-400 text-sm mt-1">
                {notification.message}
              </p>

              {/* Actions */}
              {notification.actions && notification.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {notification.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        action.onClick();
                        handleDismiss();
                      }}
                      className={`
                        px-3 py-1.5 text-xs font-medium rounded transition-colors
                        ${action.variant === 'danger' 
                          ? 'bg-red-600 hover:bg-red-500 text-white' 
                          : action.variant === 'primary'
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-black'
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
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
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToastNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notifs) => {
      setNotifications(notifs);
    });

    return unsubscribe;
  }, []);

  const handleDismiss = useCallback((id: string) => {
    notificationService.dismiss(id);
  }, []);

  return (
    <>
      {notifications.map((notification, index) => (
        <Toast
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
          index={index}
        />
      ))}
    </>
  );
};

export default ToastNotifications;
