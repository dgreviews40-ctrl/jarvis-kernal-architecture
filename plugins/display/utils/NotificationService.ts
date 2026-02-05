export class NotificationService {
  private listeners: Array<(message: string, type: 'info' | 'warning' | 'error') => void> = [];
  
  subscribe(listener: (message: string, type: 'info' | 'warning' | 'error') => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  notify(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Notify all subscribers
    this.listeners.forEach(listener => {
      try {
        listener(message, type);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }
  
  info(message: string): void {
    this.notify(message, 'info');
  }
  
  warn(message: string): void {
    this.notify(message, 'warning');
  }
  
  error(message: string): void {
    this.notify(message, 'error');
  }
  
  modelSwitchNotification(fromModel: string, toModel: string, reason: string): void {
    this.info(`Switching from ${fromModel} to ${toModel} model: ${reason}`);
  }
}