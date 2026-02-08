/**
 * Notification Service Tests
 * 
 * Tests for toast notification functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService, NotificationOptions } from '../../services/notificationService';

describe('NotificationService', () => {
  beforeEach(() => {
    notificationService.dismissAll();
    notificationService.clearHistory();
  });

  describe('show', () => {
    it('should create a notification', () => {
      const id = notificationService.show({ message: 'Test message' });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('notif_')).toBe(true);
    });

    it('should add notification to list', () => {
      notificationService.show({ message: 'Test' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Test');
    });

    it('should auto-assign type', () => {
      notificationService.show({ message: 'Test' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].type).toBe('info');
    });

    it('should use provided type', () => {
      notificationService.show({ message: 'Test', type: 'success' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].type).toBe('success');
    });

    it('should use provided title', () => {
      notificationService.show({ message: 'Test', title: 'Custom Title' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].title).toBe('Custom Title');
    });

    it('should use default title based on type', () => {
      notificationService.show({ message: 'Test', type: 'error' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].title).toBe('Error');
    });

    it('should add to history', () => {
      notificationService.show({ message: 'Test' });
      
      const history = notificationService.getHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('convenience methods', () => {
    it('should show success notification', () => {
      const id = notificationService.success('Success message');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('success');
      expect(notification.message).toBe('Success message');
    });

    it('should show error notification', () => {
      const id = notificationService.error('Error message');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('error');
      expect(notification.message).toBe('Error message');
    });

    it('should show warning notification', () => {
      const id = notificationService.warning('Warning message');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('warning');
      expect(notification.message).toBe('Warning message');
    });

    it('should show info notification', () => {
      const id = notificationService.info('Info message');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('info');
      expect(notification.message).toBe('Info message');
    });
  });

  describe('dismiss', () => {
    it('should remove notification by id', () => {
      const id = notificationService.show({ message: 'Test' });
      
      notificationService.dismiss(id);
      
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should do nothing for invalid id', () => {
      notificationService.show({ message: 'Test' });
      
      notificationService.dismiss('invalid-id');
      
      expect(notificationService.getNotifications()).toHaveLength(1);
    });
  });

  describe('dismissAll', () => {
    it('should remove all notifications', () => {
      notificationService.show({ message: 'Test 1' });
      notificationService.show({ message: 'Test 2' });
      notificationService.show({ message: 'Test 3' });
      
      notificationService.dismissAll();
      
      expect(notificationService.getNotifications()).toHaveLength(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const id = notificationService.show({ message: 'Test' });
      
      notificationService.markAsRead(id);
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.read).toBe(true);
    });

    it('should update unread count', () => {
      notificationService.show({ message: 'Test 1' });
      notificationService.show({ message: 'Test 2' });
      
      expect(notificationService.getUnreadCount()).toBe(2);
      
      const notifications = notificationService.getNotifications();
      notificationService.markAsRead(notifications[0].id);
      
      expect(notificationService.getUnreadCount()).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      notificationService.show({ message: 'Test 1' });
      notificationService.show({ message: 'Test 2' });
      
      notificationService.markAllAsRead();
      
      expect(notificationService.getUnreadCount()).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should call listener with current notifications', () => {
      const listener = vi.fn();
      notificationService.show({ message: 'Test' });
      
      notificationService.subscribe(listener);
      
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Test' })
        ])
      );
    });

    it('should call listener on changes', () => {
      const listener = vi.fn();
      notificationService.subscribe(listener);
      listener.mockClear();
      
      notificationService.show({ message: 'Test' });
      
      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = notificationService.subscribe(listener);
      
      unsubscribe();
      listener.mockClear();
      
      notificationService.show({ message: 'Test' });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('should maintain history after dismiss', () => {
      const id = notificationService.show({ message: 'Test' });
      notificationService.dismiss(id);
      
      expect(notificationService.getNotifications()).toHaveLength(0);
      expect(notificationService.getHistory()).toHaveLength(1);
    });

    it('should limit history size', () => {
      // Add more than MAX_HISTORY notifications
      for (let i = 0; i < 110; i++) {
        notificationService.show({ message: `Test ${i}` });
        notificationService.dismissAll();
      }
      
      expect(notificationService.getHistory().length).toBeLessThanOrEqual(100);
    });

    it('should clear history', () => {
      notificationService.show({ message: 'Test' });
      notificationService.dismissAll();
      
      notificationService.clearHistory();
      
      expect(notificationService.getHistory()).toHaveLength(0);
    });
  });

  describe('actions', () => {
    it('should include actions in notification', () => {
      const actionFn = vi.fn();
      
      notificationService.show({
        message: 'Test',
        actions: [
          { label: 'Action', onClick: actionFn, variant: 'primary' }
        ]
      });
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.actions).toBeDefined();
      expect(notification.actions).toHaveLength(1);
      expect(notification.actions![0].label).toBe('Action');
    });
  });

  describe('exportHistory', () => {
    it('should return JSON string', () => {
      notificationService.show({ message: 'Test' });
      
      const exported = notificationService.exportHistory();
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});
