import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notificationService, useNotifications, NotificationOptions, NotificationAction } from '../../services/notificationService';

describe('NotificationService', () => {
  beforeEach(() => {
    // Reset the notification service state completely
    notificationService['listeners'] = new Set();
    notificationService['notifications'] = [];
    notificationService['history'] = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clear all listeners to prevent cross-test contamination
    notificationService['listeners'] = new Set();
    notificationService['notifications'] = [];
    notificationService['history'] = [];
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('basic notification display', () => {
    it('should show a notification with default options', () => {
      const id = notificationService.show({ message: 'Test message' });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('notif_')).toBe(true);
      
      const notifications = notificationService.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Test message');
      expect(notifications[0].type).toBe('info');
    });

    it('should show notification with custom type', () => {
      notificationService.show({ message: 'Success!', type: 'success' });
      notificationService.show({ message: 'Error!', type: 'error' });
      notificationService.show({ message: 'Warning!', type: 'warning' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].type).toBe('success');
      expect(notifications[1].type).toBe('error');
      expect(notifications[2].type).toBe('warning');
    });

    it('should show notification with custom title', () => {
      notificationService.show({ message: 'Body', title: 'Custom Title' });
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.title).toBe('Custom Title');
    });

    it('should use default titles by type', () => {
      notificationService.show({ message: 'm1', type: 'success' });
      notificationService.show({ message: 'm2', type: 'error' });
      notificationService.show({ message: 'm3', type: 'warning' });
      notificationService.show({ message: 'm4', type: 'info' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].title).toBe('Success');
      expect(notifications[1].title).toBe('Error');
      expect(notifications[2].title).toBe('Warning');
      expect(notifications[3].title).toBe('Information');
    });

    it('should assign unique IDs to each notification', () => {
      const id1 = notificationService.show({ message: 'First' });
      const id2 = notificationService.show({ message: 'Second' });
      
      expect(id1).not.toBe(id2);
    });

    it('should set timestamp on notifications', () => {
      const before = Date.now();
      notificationService.show({ message: 'Test' });
      const after = Date.now();
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.timestamp).toBeGreaterThanOrEqual(before);
      expect(notification.timestamp).toBeLessThanOrEqual(after);
    });

    it('should mark notifications as unread by default', () => {
      notificationService.show({ message: 'Test' });
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.read).toBe(false);
    });
  });

  describe('convenience methods', () => {
    it('should show success notification', () => {
      const id = notificationService.success('Operation completed');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('success');
      expect(notification.message).toBe('Operation completed');
      expect(notification.title).toBe('Success');
    });

    it('should show error notification', () => {
      const id = notificationService.error('Something went wrong');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('error');
      expect(notification.message).toBe('Something went wrong');
      expect(notification.title).toBe('Error');
    });

    it('should show warning notification', () => {
      const id = notificationService.warning('Please check your input');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('warning');
      expect(notification.message).toBe('Please check your input');
      expect(notification.title).toBe('Warning');
    });

    it('should show info notification', () => {
      const id = notificationService.info('For your information');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.type).toBe('info');
      expect(notification.message).toBe('For your information');
      expect(notification.title).toBe('Information');
    });

    it('should allow custom title in convenience methods', () => {
      notificationService.success('Done', 'Custom Success');
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.title).toBe('Custom Success');
    });

    it('should allow custom duration in convenience methods', () => {
      notificationService.success('Done', undefined, 10000);
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.duration).toBe(10000);
    });
  });

  describe('dismissal', () => {
    it('should dismiss a notification by ID', () => {
      const id = notificationService.show({ message: 'To dismiss' });
      expect(notificationService.getNotifications()).toHaveLength(1);
      
      notificationService.dismiss(id);
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should do nothing when dismissing non-existent ID', () => {
      notificationService.show({ message: 'Stay' });
      notificationService.dismiss('non-existent-id');
      
      expect(notificationService.getNotifications()).toHaveLength(1);
    });

    it('should dismiss all notifications', () => {
      notificationService.show({ message: '1' });
      notificationService.show({ message: '2' });
      notificationService.show({ message: '3' });
      
      notificationService.dismissAll();
      
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should keep dismissed notifications in history', () => {
      const id = notificationService.show({ message: 'To history' });
      notificationService.dismiss(id);
      
      expect(notificationService.getNotifications()).toHaveLength(0);
      expect(notificationService.getHistory()).toHaveLength(1);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after duration', () => {
      notificationService.show({ message: 'Auto', duration: 3000 });
      expect(notificationService.getNotifications()).toHaveLength(1);
      
      vi.advanceTimersByTime(3000);
      
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should use default durations by type', () => {
      notificationService.show({ message: 'Success', type: 'success' });
      notificationService.show({ message: 'Error', type: 'error' });
      notificationService.show({ message: 'Warning', type: 'warning' });
      notificationService.show({ message: 'Info', type: 'info' });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].duration).toBe(3000); // success
      expect(notifications[1].duration).toBe(5000); // error
      expect(notifications[2].duration).toBe(4000); // warning
      expect(notifications[3].duration).toBe(3000); // info
    });

    it('should not auto-dismiss when duration is 0', () => {
      notificationService.show({ message: 'Persistent', duration: 0 });
      
      vi.advanceTimersByTime(100000);
      
      expect(notificationService.getNotifications()).toHaveLength(1);
    });

    it('should allow custom duration', () => {
      notificationService.show({ message: 'Custom', type: 'error', duration: 1000 });
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.duration).toBe(1000);
    });
  });

  describe('max notifications limit', () => {
    it('should limit visible notifications to 5', () => {
      for (let i = 0; i < 7; i++) {
        notificationService.show({ message: `Message ${i}`, duration: 0 });
      }
      
      expect(notificationService.getNotifications()).toHaveLength(5);
    });

    it('should remove oldest when exceeding limit', () => {
      notificationService.show({ message: 'First', duration: 0 });
      notificationService.show({ message: 'Second', duration: 0 });
      notificationService.show({ message: 'Third', duration: 0 });
      notificationService.show({ message: 'Fourth', duration: 0 });
      notificationService.show({ message: 'Fifth', duration: 0 });
      notificationService.show({ message: 'Sixth', duration: 0 });
      
      const notifications = notificationService.getNotifications();
      expect(notifications[0].message).toBe('Second');
      expect(notifications[4].message).toBe('Sixth');
    });
  });

  describe('read status', () => {
    it('should mark notification as read', () => {
      const id = notificationService.show({ message: 'Test' });
      expect(notificationService.getUnreadCount()).toBe(1);
      
      notificationService.markAsRead(id);
      
      expect(notificationService.getUnreadCount()).toBe(0);
      expect(notificationService.getNotifications()[0].read).toBe(true);
    });

    it('should mark all as read', () => {
      notificationService.show({ message: '1' });
      notificationService.show({ message: '2' });
      notificationService.show({ message: '3' });
      
      notificationService.markAllAsRead();
      
      expect(notificationService.getUnreadCount()).toBe(0);
      notificationService.getNotifications().forEach(n => {
        expect(n.read).toBe(true);
      });
    });

    it('should mark history items as read', () => {
      const id = notificationService.show({ message: 'Test' });
      notificationService.dismiss(id);
      
      notificationService.markAsRead(id);
      
      const history = notificationService.getHistory();
      expect(history[0].read).toBe(true);
    });
  });

  describe('history', () => {
    it('should add notifications to history', () => {
      notificationService.show({ message: 'Test 1' });
      notificationService.show({ message: 'Test 2' });
      
      const history = notificationService.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Test 2'); // Most recent first
      expect(history[1].message).toBe('Test 1');
    });

    it('should limit history to 100 items', () => {
      for (let i = 0; i < 110; i++) {
        notificationService.show({ message: `Message ${i}` });
      }
      
      expect(notificationService.getHistory()).toHaveLength(100);
    });

    it('should clear history', () => {
      notificationService.show({ message: 'Test' });
      notificationService.dismissAll();
      
      expect(notificationService.getHistory()).toHaveLength(1);
      
      notificationService.clearHistory();
      
      expect(notificationService.getHistory()).toHaveLength(0);
    });
  });

  describe('actions', () => {
    it('should include actions in notification', () => {
      const actions: NotificationAction[] = [
        { label: 'Undo', onClick: () => {}, variant: 'primary' },
        { label: 'Dismiss', onClick: () => {}, variant: 'secondary' }
      ];
      
      notificationService.show({ message: 'Actionable', actions });
      
      const notification = notificationService.getNotifications()[0];
      expect(notification.actions).toHaveLength(2);
      expect(notification.actions![0].label).toBe('Undo');
      expect(notification.actions![1].label).toBe('Dismiss');
    });
  });

  describe('subscription', () => {
    it('should notify listeners when notifications change', () => {
      const listener = vi.fn();
      
      const unsubscribe = notificationService.subscribe(listener);
      
      // Called immediately with current state
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([]);
      
      notificationService.show({ message: 'Test' });
      
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1][0]).toHaveLength(1);
      
      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      
      const unsubscribe = notificationService.subscribe(listener);
      listener.mockClear();
      
      unsubscribe();
      
      notificationService.show({ message: 'Test' });
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const goodListener = vi.fn();
      
      // First subscribe the good listener so we can verify it still works
      const unsubGood = notificationService.subscribe(goodListener);
      goodListener.mockClear();
      
      // Now add an error-throwing listener
      const errorListener = vi.fn(() => { throw new Error('Listener error'); });
      
      // Error during immediate call should not break subscribe
      expect(() => notificationService.subscribe(errorListener)).toThrow('Listener error');
      
      // The service should still work - show a notification
      // Should not throw even though error listener is subscribed
      expect(() => notificationService.show({ message: 'Test' })).not.toThrow();
      
      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
      
      unsubGood();
    });
  });

  describe('export', () => {
    it('should export history as JSON', () => {
      notificationService.show({ message: 'Test 1', type: 'success' });
      notificationService.show({ message: 'Test 2', type: 'error' });
      
      const exported = notificationService.exportHistory();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0].message).toBe('Test 2');
      expect(parsed[1].message).toBe('Test 1');
    });

    it('should export empty history', () => {
      const exported = notificationService.exportHistory();
      expect(exported).toBe('[]');
    });
  });

  describe('getNotifications immutability', () => {
    it('should return a copy of notifications array', () => {
      notificationService.show({ message: 'Test' });
      
      const notifications = notificationService.getNotifications();
      notifications.pop(); // Modify the returned array
      
      // Original should be unchanged
      expect(notificationService.getNotifications()).toHaveLength(1);
    });
  });

  describe('getHistory immutability', () => {
    it('should return a copy of history array', () => {
      notificationService.show({ message: 'Test' });
      
      const history = notificationService.getHistory();
      history.pop(); // Modify the returned array
      
      // Original should be unchanged
      expect(notificationService.getHistory()).toHaveLength(1);
    });
  });
});

describe('useNotifications hook', () => {
  it('should return all notification methods', () => {
    const hooks = useNotifications();
    
    expect(hooks.show).toBeDefined();
    expect(hooks.success).toBeDefined();
    expect(hooks.error).toBeDefined();
    expect(hooks.warning).toBeDefined();
    expect(hooks.info).toBeDefined();
    expect(hooks.dismiss).toBeDefined();
    expect(hooks.dismissAll).toBeDefined();
  });

  it('should call notificationService methods', () => {
    const hooks = useNotifications();
    
    // Test that methods are bound correctly
    const id = hooks.success('Test success');
    expect(typeof id).toBe('string');
    
    hooks.dismissAll();
    expect(notificationService.getNotifications()).toHaveLength(0);
  });
});
