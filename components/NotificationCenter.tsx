/**
 * Notification Center
 * 
 * Shows notification history and unread notifications
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  Check,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Notification, notificationService } from '../services/notificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const updateNotifications = () => {
      setNotifications(notificationService.getNotifications());
      setHistory(notificationService.getHistory());
    };

    updateNotifications();
    const unsubscribe = notificationService.subscribe(updateNotifications);

    return unsubscribe;
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Otherwise show date
    return date.toLocaleDateString();
  };

  const icons = {
    success: <CheckCircle size={16} className="text-green-400" />,
    error: <XCircle size={16} className="text-red-400" />,
    warning: <AlertTriangle size={16} className="text-yellow-400" />,
    info: <Info size={16} className="text-cyan-400" />,
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={20} className="text-cyan-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white">Notifications</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'current'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current
            {notifications.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                {notifications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            History
            {history.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {activeTab === 'current' && unreadCount > 0 && (
              <button
                onClick={() => notificationService.markAllAsRead()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (activeTab === 'current') {
                notificationService.dismissAll();
              } else {
                notificationService.clearHistory();
                setHistory([]);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 size={14} />
            {activeTab === 'current' ? 'Dismiss all' : 'Clear history'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'current' ? (
            notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bell size={48} className="mx-auto mb-4 opacity-30" />
                <p>No active notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`
                    p-3 rounded-lg border transition-colors
                    ${notification.read 
                      ? 'bg-gray-800/50 border-gray-800' 
                      : 'bg-gray-800 border-gray-700'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {icons[notification.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-white text-sm">
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                          <Clock size={12} />
                          {formatTime(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {notification.message}
                      </p>

                      {/* Actions */}
                      {notification.actions && notification.actions.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          {notification.actions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                action.onClick();
                                notificationService.markAsRead(notification.id);
                              }}
                              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => notificationService.dismiss(notification.id)}
                      className="flex-shrink-0 p-1 text-gray-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock size={48} className="mx-auto mb-4 opacity-30" />
                <p>No notification history</p>
              </div>
            ) : (
              history.map(notification => (
                <div
                  key={notification.id}
                  className="p-3 rounded-lg border border-gray-800 bg-gray-800/30"
                >
                  <button
                    onClick={() => toggleExpanded(notification.id)}
                    className="w-full flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {icons[notification.type]}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-gray-300 text-sm">
                          {notification.title}
                        </h4>
                        {expanded.has(notification.id) ? (
                          <ChevronUp size={14} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-500" />
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {formatTime(notification.timestamp)}
                      </p>
                      
                      {expanded.has(notification.id) && (
                        <p className="text-gray-400 text-sm mt-2">
                          {notification.message}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
