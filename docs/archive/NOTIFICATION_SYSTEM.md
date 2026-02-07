# Notification System

## Overview

Toast notification system for user feedback with auto-dismiss, progress indicators, and action buttons.

## Features

### Toast Notifications
- **Types**: Success, Error, Warning, Info
- **Auto-dismiss**: Configurable duration with progress bar
- **Manual dismiss**: Click X to close
- **Action buttons**: Up to 2 actions per notification
- **Stacking**: Up to 5 notifications visible at once

### Notification Center
- **Bell icon**: Shows unread count badge
- **Current tab**: Active notifications
- **History tab**: Past 100 notifications
- **Bulk actions**: Mark all read, dismiss all, clear history

## Usage

### Basic Notifications

```typescript
import { notificationService } from './services/notificationService';

// Simple notifications
notificationService.success('Settings saved');
notificationService.error('Failed to connect');
notificationService.warning('Low memory');
notificationService.info('Update available');

// Custom options
notificationService.show({
  type: 'success',
  title: 'Export Complete',
  message: 'Your settings have been exported',
  duration: 5000, // 5 seconds (0 = persistent)
});
```

### Notifications with Actions

```typescript
notificationService.show({
  type: 'warning',
  title: 'Unsaved Changes',
  message: 'You have unsaved changes. Save before leaving?',
  duration: 0, // Persistent
  actions: [
    {
      label: 'Save',
      variant: 'primary',
      onClick: () => saveChanges(),
    },
    {
      label: 'Discard',
      variant: 'danger',
      onClick: () => discardChanges(),
    },
  ],
});
```

### React Hook

```typescript
import { useNotifications } from './services/notificationService';

function MyComponent() {
  const { success, error, warning, info } = useNotifications();
  
  const handleSave = async () => {
    try {
      await saveData();
      success('Data saved successfully');
    } catch (e) {
      error('Failed to save data');
    }
  };
}
```

## Default Durations

| Type | Duration |
|------|----------|
| Success | 3 seconds |
| Error | 5 seconds |
| Warning | 4 seconds |
| Info | 3 seconds |

## UI Components

### ToastNotifications
Renders toast notifications in top-right corner:
```tsx
<ToastNotifications />
```

### NotificationCenter
Modal for viewing history:
```tsx
<NotificationCenter isOpen={show} onClose={() => setShow(false)} />
```

### NotificationBell
Toolbar button with badge:
```tsx
<NotificationBell />
```

## Access

- **Toasts**: Appear automatically when triggered
- **Notification Center**: Click bell icon in top toolbar

## API Reference

```typescript
// Show notification
show(options: NotificationOptions): string

// Convenience methods
success(message: string, title?: string, duration?: number): string
error(message: string, title?: string, duration?: number): string
warning(message: string, title?: string, duration?: number): string
info(message: string, title?: string, duration?: number): string

// Manage notifications
dismiss(id: string): void
dismissAll(): void
markAsRead(id: string): void
markAllAsRead(): void

// Get state
getNotifications(): Notification[]
getHistory(): Notification[]
getUnreadCount(): number

// Subscribe to changes
subscribe(listener: (notifications: Notification[]) => void): () => void

// History management
clearHistory(): void
exportHistory(): string
```

## File Structure

```
services/
  notificationService.ts    # Core notification logic
  
components/
  ToastNotifications.tsx    # Toast display component
  NotificationCenter.tsx    # History modal
```

## Integration

Already integrated in:
- Plugin installation
- Settings export/import
- API key encryption
- Future: All async operations
