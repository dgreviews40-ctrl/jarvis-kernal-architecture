/**
 * Optimized State Machine
 * Finite state machine with transition caching and batch updates
 * Reduces unnecessary re-renders and computations
 */

export type StateTransition<TState, TEvent> = {
  from: TState | TState[];
  to: TState;
  on: TEvent;
  guard?: (context: unknown) => boolean;
  action?: (context: unknown, event: TEvent) => void;
};

export interface StateMachineConfig<TState, TEvent> {
  initial: TState;
  transitions: StateTransition<TState, TEvent>[];
  context?: unknown;
}

interface TransitionCache<TState, TEvent> {
  key: string;
  result: { state: TState; allowed: boolean };
  timestamp: number;
}

class OptimizedStateMachine<TState extends string, TEvent extends string> {
  private currentState: TState;
  private context: unknown;
  private transitions: Map<string, StateTransition<TState, TEvent>[]> = new Map();
  private transitionCache = new Map<string, TransitionCache<TState, TEvent>>();
  private observers: ((state: TState, prevState: TState, event: TEvent) => void)[] = [];
  private pendingTransitions: Array<{ event: TEvent; resolve: (success: boolean) => void }> = [];
  private isProcessing = false;
  private readonly CACHE_TTL = 5000;

  constructor(config: StateMachineConfig<TState, TEvent>) {
    this.currentState = config.initial;
    this.context = config.context;
    this.buildTransitionMap(config.transitions);
  }

  private buildTransitionMap(transitions: StateTransition<TState, TEvent>[]): void {
    for (const transition of transitions) {
      const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
      
      for (const from of fromStates) {
        const key = `${from}_${transition.on}`;
        if (!this.transitions.has(key)) {
          this.transitions.set(key, []);
        }
        this.transitions.get(key)!.push(transition);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): TState {
    return this.currentState;
  }

  /**
   * Get context
   */
  getContext<T>(): T {
    return this.context as T;
  }

  /**
   * Set context (without triggering transitions)
   */
  setContext(context: unknown): void {
    this.context = context;
  }

  /**
   * Check if transition is possible without executing
   */
  canTransition(event: TEvent): boolean {
    const cacheKey = `can_${this.currentState}_${event}`;
    const cached = this.getCachedTransition(cacheKey);
    
    if (cached) return cached.result.allowed;

    const key = `${this.currentState}_${event}`;
    const transitions = this.transitions.get(key);
    
    if (!transitions || transitions.length === 0) {
      this.cacheTransition(cacheKey, { state: this.currentState, allowed: false });
      return false;
    }

    // Check guards
    for (const transition of transitions) {
      if (!transition.guard || transition.guard(this.context)) {
        this.cacheTransition(cacheKey, { state: transition.to, allowed: true });
        return true;
      }
    }

    this.cacheTransition(cacheKey, { state: this.currentState, allowed: false });
    return false;
  }

  /**
   * Transition to new state
   */
  async transition(event: TEvent): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingTransitions.push({ event, resolve });
      this.processTransitions();
    });
  }

  /**
   * Batch multiple transitions
   */
  async transitionBatch(events: TEvent[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const event of events) {
      const result = await this.transition(event);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: TState, prevState: TState, event: TEvent) => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  /**
   * Get possible transitions from current state
   */
  getPossibleTransitions(): TEvent[] {
    const events = new Set<TEvent>();
    
    for (const [key, transitions] of this.transitions.entries()) {
      if (key.startsWith(`${this.currentState}_`)) {
        for (const transition of transitions) {
          if (!transition.guard || transition.guard(this.context)) {
            events.add(transition.on);
          }
        }
      }
    }
    
    return Array.from(events);
  }

  /**
   * Get transition history (for debugging)
   */
  getStatePath(): TState[] {
    // This could be enhanced to track history
    return [this.currentState];
  }

  private async processTransitions(): Promise<void> {
    if (this.isProcessing || this.pendingTransitions.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.pendingTransitions.length > 0) {
      const { event, resolve } = this.pendingTransitions.shift()!;
      const success = await this.executeTransition(event);
      resolve(success);
    }

    this.isProcessing = false;
  }

  private async executeTransition(event: TEvent): Promise<boolean> {
    const key = `${this.currentState}_${event}`;
    const transitions = this.transitions.get(key);

    if (!transitions || transitions.length === 0) {
      return false;
    }

    // Find first valid transition
    for (const transition of transitions) {
      if (transition.guard && !transition.guard(this.context)) {
        continue;
      }

      const prevState = this.currentState;
      this.currentState = transition.to;

      // Execute action if defined
      if (transition.action) {
        try {
          transition.action(this.context, event);
        } catch (error) {
          console.error('[STATE MACHINE] Action failed:', error);
        }
      }

      // Clear relevant cache entries
      this.clearStateCache(prevState);

      // Notify observers
      this.notifyObservers(prevState, event);

      return true;
    }

    return false;
  }

  private getCachedTransition(key: string): TransitionCache<TState, TEvent> | null {
    const cached = this.transitionCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.transitionCache.delete(key);
      return null;
    }

    return cached;
  }

  private cacheTransition(key: string, result: { state: TState; allowed: boolean }): void {
    // Limit cache size
    if (this.transitionCache.size > 100) {
      const oldest = this.transitionCache.keys().next().value;
      if (oldest) {
        this.transitionCache.delete(oldest);
      }
    }

    this.transitionCache.set(key, {
      key,
      result,
      timestamp: Date.now()
    });
  }

  private clearStateCache(state: TState): void {
    for (const key of this.transitionCache.keys()) {
      if (key.includes(state)) {
        this.transitionCache.delete(key);
      }
    }
  }

  private notifyObservers(prevState: TState, event: TEvent): void {
    for (const observer of this.observers) {
      try {
        observer(this.currentState, prevState, event);
      } catch (error) {
        console.error('[STATE MACHINE] Observer failed:', error);
      }
    }
  }
}

// Export
export { OptimizedStateMachine };

/**
 * Create a processor state machine for JARVIS
 */
export function createProcessorStateMachine() {
  return new OptimizedStateMachine({
    initial: 'IDLE',
    transitions: [
      { from: 'IDLE', to: 'ANALYZING', on: 'START_ANALYSIS' },
      { from: 'ANALYZING', to: 'ROUTING', on: 'INTENT_DETECTED' },
      { from: 'ANALYZING', to: 'IDLE', on: 'ANALYSIS_FAILED' },
      { from: 'ROUTING', to: 'EXECUTING', on: 'ROUTE_SELECTED' },
      { from: 'ROUTING', to: 'IDLE', on: 'ROUTE_FAILED' },
      { from: 'EXECUTING', to: 'IDLE', on: 'EXECUTION_COMPLETE' },
      { from: 'EXECUTING', to: 'ERROR', on: 'EXECUTION_FAILED' },
      { from: 'ERROR', to: 'IDLE', on: 'RESET' },
      { from: ['ANALYZING', 'ROUTING', 'EXECUTING'], to: 'IDLE', on: 'CANCEL' }
    ]
  });
}

/**
 * React hook for state machine
 */
export function useStateMachine<TState extends string, TEvent extends string>(
  machine: OptimizedStateMachine<TState, TEvent>
) {
  const [state, setState] = React.useState<TState>(machine.getState());

  React.useEffect(() => {
    return machine.subscribe((newState) => {
      setState(newState);
    });
  }, [machine]);

  const transition = React.useCallback(
    (event: TEvent) => machine.transition(event),
    [machine]
  );

  const canTransition = React.useCallback(
    (event: TEvent) => machine.canTransition(event),
    [machine]
  );

  return {
    state,
    transition,
    canTransition,
    context: machine.getContext()
  };
}

import React from 'react';
