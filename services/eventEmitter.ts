/**
 * Simple EventEmitter implementation for TypeScript
 */

export type EventListener = (...args: any[]) => void;

export class EventEmitter {
  private listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: EventListener): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  once(event: string, listener: EventListener): void {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    this.on(event, onceListener);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export default EventEmitter;
