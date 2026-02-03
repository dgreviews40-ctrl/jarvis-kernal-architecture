import { Session, ConversationTurn, HealthEventType, ImpactLevel } from "../types";
import { memory } from "./memory";
import { cortex } from "./cortex";

// Configuration for conversation context
const MAX_CONTEXT_TURNS = 6; // Include last 6 turns (3 exchanges) for context
const MAX_CONTEXT_CHARS = 2000; // Limit context size to avoid token bloat

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

  /**
   * Get recent conversation context formatted for AI prompts
   * Returns the last N turns as a formatted string
   */
  public getRecentContext(maxTurns: number = MAX_CONTEXT_TURNS): string {
    if (!this.currentSession || this.currentSession.turns.length === 0) {
      return '';
    }

    const recentTurns = this.currentSession.turns.slice(-maxTurns);
    let context = '';
    
    for (const turn of recentTurns) {
      const speaker = turn.speaker === 'USER' ? 'User' : 'JARVIS';
      const text = turn.text.length > 300 ? turn.text.substring(0, 300) + '...' : turn.text;
      context += `${speaker}: ${text}\n`;
      
      // Stop if we exceed max chars
      if (context.length > MAX_CONTEXT_CHARS) {
        break;
      }
    }

    return context.trim();
  }

  /**
   * Build a context-aware prompt that includes conversation history
   */
  public buildContextualPrompt(userInput: string, baseInstruction?: string): string {
    const recentContext = this.getRecentContext();
    
    if (!recentContext) {
      return userInput;
    }

    return `${baseInstruction ? baseInstruction + '\n\n' : ''}RECENT CONVERSATION CONTEXT:
${recentContext}

CURRENT USER INPUT: ${userInput}

Respond naturally, taking into account the conversation history above. If the user refers to something mentioned earlier, use that context.`;
  }

  /**
   * Check if user input references previous conversation
   */
  public detectsContextReference(input: string): boolean {
    const contextIndicators = [
      'that', 'this', 'it', 'they', 'them', 'those', 'these',
      'earlier', 'before', 'previous', 'again', 'also',
      'what i said', 'what you said', 'like i mentioned',
      'as i said', 'remember when', 'you told me',
      'we talked about', 'you mentioned', 'i asked'
    ];
    
    const lower = input.toLowerCase();
    return contextIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Get the last user input (for suggestions)
   */
  public getLastUserInput(): string | null {
    if (!this.currentSession) return null;
    
    for (let i = this.currentSession.turns.length - 1; i >= 0; i--) {
      if (this.currentSession.turns[i].speaker === 'USER') {
        return this.currentSession.turns[i].text;
      }
    }
    return null;
  }

  /**
   * Get the last JARVIS response
   */
  public getLastResponse(): string | null {
    if (!this.currentSession) return null;
    
    for (let i = this.currentSession.turns.length - 1; i >= 0; i--) {
      if (this.currentSession.turns[i].speaker === 'JARVIS') {
        return this.currentSession.turns[i].text;
      }
    }
    return null;
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