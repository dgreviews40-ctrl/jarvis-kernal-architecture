import { Session, ConversationTurn, HealthEventType, ImpactLevel } from "../types";
import { memory } from "./memory";
import { cortex } from "./cortex";

class ConversationService {
  private currentSession: Session | null = null;
  private observers: (() => void)[] = [];

  constructor() {
    this.startNewSession();
  }

  public startNewSession() {
    this.currentSession = {
      id: Math.random().toString(36).substring(2, 9),
      startTime: Date.now(),
      turns: [],
      interruptCount: 0,
      learningUpdates: []
    };
    this.notify();
  }

  public getSession(): Session | null {
    return this.currentSession;
  }

  public addTurn(speaker: 'USER' | 'JARVIS', text: string) {
    if (!this.currentSession) return;
    
    const turn: ConversationTurn = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      speaker,
      text
    };
    
    this.currentSession.turns.push(turn);
    this.notify();
  }

  public reportInterrupt() {
    if (!this.currentSession) return;
    
    this.currentSession.interruptCount++;
    
    // Log Interruption to Cortex
    cortex.reportEvent({
        sourceId: 'core.conversation',
        type: HealthEventType.INTERRUPT,
        impact: ImpactLevel.LOW,
        latencyMs: 0,
        context: { params: `Count: ${this.currentSession.interruptCount}` }
    });

    // Mark last JARVIS turn as interrupted
    const lastTurn = this.currentSession.turns[this.currentSession.turns.length - 1];
    if (lastTurn && lastTurn.speaker === 'JARVIS') {
        lastTurn.interrupted = true;
    }

    // LEARNING LOGIC: Check for Verbosity Preference
    if (this.currentSession.interruptCount >= 3) {
       this.triggerLearning("User interrupts frequently. Reduce verbosity.");
    }
    
    this.notify();
  }

  private async triggerLearning(insight: string) {
      if (!this.currentSession) return;
      
      // Store new preference
      const node = await memory.store(insight, 'PREFERENCE', ['auto_learned', 'conversation_style']);
      this.currentSession.learningUpdates.push(node.id);
      
      // Notify Cortex (Learning Feedback Loop)
      cortex.reportEvent({
          sourceId: 'core.learning',
          type: HealthEventType.SUCCESS,
          impact: ImpactLevel.NONE,
          latencyMs: 100,
          context: { params: `Learned: ${insight}` }
      });
  }

  public subscribe(cb: () => void) {
    this.observers.push(cb);
    return () => {
      this.observers = this.observers.filter(o => o !== cb);
    };
  }

  private notify() {
    this.observers.forEach(cb => cb());
  }
}

export const conversation = new ConversationService();