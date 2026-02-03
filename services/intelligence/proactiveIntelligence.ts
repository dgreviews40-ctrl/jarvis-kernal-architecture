/**
 * Proactive Intelligence System
 * 
 * Enables JARVIS to anticipate user needs and provide proactive assistance:
 * - Pattern recognition in user behavior
 * - Predictive suggestions
 * - Contextual reminders
 * - Smart notifications
 * - Habit learning
 */

import { memory as memoryOptimized } from "../memory";
import { cortex } from "../cortex";
import { HealthEventType, ImpactLevel } from "../../types";

interface UserPattern {
  id: string;
  type: 'time' | 'sequence' | 'context' | 'habit';
  pattern: string;
  frequency: number;
  lastObserved: number;
  confidence: number;
  context: Record<string, unknown>;
}

interface PredictedNeed {
  id: string;
  prediction: string;
  confidence: number;
  suggestedAction: string;
  urgency: 'low' | 'medium' | 'high';
  triggerTime?: number;
  context: Record<string, unknown>;
}

interface ContextualReminder {
  id: string;
  condition: {
    type: 'time' | 'location' | 'context' | 'event';
    value: string;
  };
  message: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  triggered: boolean;
}

interface HabitData {
  action: string;
  typicalTime: number; // Hour of day (0-23)
  typicalDay: number; // Day of week (0-6)
  frequency: number; // Times per week
  lastPerformed: number;
  consistency: number; // 0-1
}

export class ProactiveIntelligence {
  private patterns: Map<string, UserPattern> = new Map();
  private habits: Map<string, HabitData> = new Map();
  private reminders: Map<string, ContextualReminder> = new Map();
  private lastInteractionTime: number = 0;
  private interactionHistory: { time: number; action: string; context: string }[] = [];
  
  private readonly MAX_HISTORY = 100;
  private readonly PATTERN_CONFIDENCE_THRESHOLD = 0.6;
  private readonly HABIT_DETECTION_THRESHOLD = 3; // Minimum occurrences to be a habit

  constructor() {
    this.loadPatternsFromMemory();
    this.startProactiveMonitoring();
  }

  /**
   * Record user interaction for pattern analysis
   */
  recordInteraction(action: string, context: Record<string, unknown> = {}): void {
    const now = Date.now();
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    this.interactionHistory.push({
      time: now,
      action,
      context: JSON.stringify(context)
    });

    // Keep history manageable
    if (this.interactionHistory.length > this.MAX_HISTORY) {
      this.interactionHistory.shift();
    }

    // Analyze for patterns
    this.analyzeTimePatterns(action, hour, dayOfWeek);
    this.analyzeSequencePatterns(action);
    this.updateHabitData(action, hour, dayOfWeek);

    this.lastInteractionTime = now;
  }

  /**
   * Analyze time-based patterns
   */
  private analyzeTimePatterns(action: string, hour: number, dayOfWeek: number): void {
    const patternKey = `${action}_time_${hour}`;
    const existingPattern = this.patterns.get(patternKey);

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastObserved = Date.now();
      existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.05);
    } else {
      this.patterns.set(patternKey, {
        id: patternKey,
        type: 'time',
        pattern: `${action} at ${hour}:00`,
        frequency: 1,
        lastObserved: Date.now(),
        confidence: 0.3,
        context: { hour, dayOfWeek }
      });
    }
  }

  /**
   * Analyze sequence patterns (what typically follows what)
   */
  private analyzeSequencePatterns(currentAction: string): void {
    if (this.interactionHistory.length < 2) return;

    const previousAction = this.interactionHistory[this.interactionHistory.length - 2].action;
    const patternKey = `sequence_${previousAction}_${currentAction}`;
    
    const existingPattern = this.patterns.get(patternKey);
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastObserved = Date.now();
      existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.1);
    } else {
      this.patterns.set(patternKey, {
        id: patternKey,
        type: 'sequence',
        pattern: `${previousAction} → ${currentAction}`,
        frequency: 1,
        lastObserved: Date.now(),
        confidence: 0.2,
        context: { previousAction, currentAction }
      });
    }
  }

  /**
   * Update habit tracking data
   */
  private updateHabitData(action: string, hour: number, dayOfWeek: number): void {
    const existingHabit = this.habits.get(action);

    if (existingHabit) {
      // Update typical time with moving average
      existingHabit.typicalTime = (existingHabit.typicalTime * 0.7) + (hour * 0.3);
      existingHabit.frequency++;
      existingHabit.lastPerformed = Date.now();
      
      // Calculate consistency (how regular the habit is)
      const timeDiff = Math.abs(existingHabit.typicalTime - hour);
      const consistencyBonus = timeDiff < 2 ? 0.05 : -0.02;
      existingHabit.consistency = Math.max(0, Math.min(1, existingHabit.consistency + consistencyBonus));
    } else {
      this.habits.set(action, {
        action,
        typicalTime: hour,
        typicalDay: dayOfWeek,
        frequency: 1,
        lastPerformed: Date.now(),
        consistency: 0.5
      });
    }
  }

  /**
   * Get predictive suggestions based on current context
   */
  getPredictiveSuggestions(currentContext: Record<string, unknown> = {}): PredictedNeed[] {
    const predictions: PredictedNeed[] = [];
    const now = new Date();
    const currentHour = now.getHours();

    // Check for time-based predictions
    for (const pattern of this.patterns.values()) {
      if (pattern.type === 'time' && pattern.confidence > this.PATTERN_CONFIDENCE_THRESHOLD) {
        const patternHour = pattern.context.hour as number;
        const hourDiff = Math.abs(currentHour - patternHour);

        if (hourDiff <= 1) {
          predictions.push({
            id: `pred_${pattern.id}`,
            prediction: `User typically ${pattern.pattern}`,
            confidence: pattern.confidence,
            suggestedAction: `Prepare for ${pattern.pattern}`,
            urgency: hourDiff === 0 ? 'high' : 'medium',
            context: pattern.context
          });
        }
      }
    }

    // Check for sequence-based predictions
    if (this.interactionHistory.length > 0) {
      const lastAction = this.interactionHistory[this.interactionHistory.length - 1].action;
      
      for (const pattern of this.patterns.values()) {
        if (pattern.type === 'sequence' && 
            pattern.context.previousAction === lastAction &&
            pattern.confidence > this.PATTERN_CONFIDENCE_THRESHOLD) {
          predictions.push({
            id: `pred_seq_${pattern.id}`,
            prediction: `User often ${pattern.pattern} after current activity`,
            confidence: pattern.confidence,
            suggestedAction: `Suggest ${pattern.context.currentAction}`,
            urgency: 'low',
            context: pattern.context
          });
        }
      }
    }

    // Check for habit-based predictions
    for (const habit of this.habits.values()) {
      if (habit.frequency >= this.HABIT_DETECTION_THRESHOLD && 
          habit.consistency > 0.6) {
        const hourDiff = Math.abs(currentHour - habit.typicalTime);
        const daysSinceLast = (Date.now() - habit.lastPerformed) / (1000 * 60 * 60 * 24);

        if (hourDiff <= 1 && daysSinceLast >= 0.8) {
          predictions.push({
            id: `pred_habit_${habit.action}`,
            prediction: `Regular habit: ${habit.action} around this time`,
            confidence: habit.consistency,
            suggestedAction: `Ask if user wants to ${habit.action}`,
            urgency: daysSinceLast > 1.2 ? 'high' : 'medium',
            context: { habit }
          });
        }
      }
    }

    // Sort by confidence
    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Create a contextual reminder
   */
  async createReminder(
    condition: { type: 'time' | 'location' | 'context' | 'event'; value: string },
    message: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<string> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const reminder: ContextualReminder = {
      id,
      condition,
      message,
      priority,
      createdAt: Date.now(),
      triggered: false
    };

    this.reminders.set(id, reminder);

    // Store in memory for persistence
    await memoryOptimized.store(
      `Reminder set: "${message}" when ${condition.type} is ${condition.value}`,
      'FACT',
      ['reminder', condition.type, priority]
    );

    return id;
  }

  /**
   * Check if any reminders should trigger
   */
  checkReminders(currentContext: Record<string, unknown> = {}): ContextualReminder[] {
    const triggered: ContextualReminder[] = [];
    const now = new Date();

    for (const reminder of this.reminders.values()) {
      if (reminder.triggered) continue;

      let shouldTrigger = false;

      switch (reminder.condition.type) {
        case 'time':
          // Simple time check (e.g., "14:00")
          const [hours, minutes] = reminder.condition.value.split(':').map(Number);
          if (now.getHours() === hours && now.getMinutes() === minutes) {
            shouldTrigger = true;
          }
          break;

        case 'context':
          // Check if context matches
          const contextKey = reminder.condition.value.split('=')[0];
          const contextValue = reminder.condition.value.split('=')[1];
          if (currentContext[contextKey] === contextValue) {
            shouldTrigger = true;
          }
          break;

        case 'event':
          // Check for specific events in context
          if (currentContext.event === reminder.condition.value) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        reminder.triggered = true;
        triggered.push(reminder);
        
        // Report to cortex
        cortex.reportEvent({
          sourceId: 'proactive.intelligence',
          type: HealthEventType.SUCCESS,
          impact: ImpactLevel.LOW,
          latencyMs: 0,
          context: { params: `Reminder triggered: ${reminder.message}` }
        });
      }
    }

    return triggered;
  }

  /**
   * Start proactive monitoring loop
   */
  private startProactiveMonitoring(): void {
    // Check every minute for time-based reminders
    setInterval(() => {
      const triggered = this.checkReminders();
      triggered.forEach(reminder => {
        console.log(`[PROACTIVE] Reminder: ${reminder.message}`);
      });
    }, 60000);
  }

  /**
   * Load learned patterns from memory
   */
  private async loadPatternsFromMemory(): Promise<void> {
    try {
      const results = await memoryOptimized.recall('habit pattern', 20);
      
      results.forEach(({ node }) => {
        // Parse stored patterns
        const habitMatch = node.content.match(/Habit "(.+?)" performed (\d+) times/);
        if (habitMatch) {
          const [, action, frequency] = habitMatch;
          this.habits.set(action, {
            action,
            typicalTime: 12, // Default
            typicalDay: 1,
            frequency: parseInt(frequency),
            lastPerformed: Date.now(),
            consistency: 0.5
          });
        }
      });
    } catch (e) {
      console.warn('[PROACTIVE] Failed to load patterns:', e);
    }
  }

  /**
   * Save patterns to memory periodically
   */
  async savePatterns(): Promise<void> {
    // Save significant habits
    for (const habit of this.habits.values()) {
      if (habit.frequency >= this.HABIT_DETECTION_THRESHOLD) {
        await memoryOptimized.store(
          `Habit "${habit.action}" performed ${habit.frequency} times, typically at ${Math.round(habit.typicalTime)}:00. Consistency: ${(habit.consistency * 100).toFixed(0)}%`,
          'FACT',
          ['habit', 'pattern', 'learned']
        );
      }
    }

    // Save high-confidence patterns
    for (const pattern of this.patterns.values()) {
      if (pattern.confidence > 0.8 && pattern.frequency > 5) {
        await memoryOptimized.store(
          `Pattern detected: ${pattern.pattern} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
          'FACT',
          ['pattern', pattern.type, 'learned']
        );
      }
    }
  }

  /**
   * Get insights about user behavior
   */
  getInsights(): {
    topHabits: HabitData[];
    commonPatterns: UserPattern[];
    activeReminders: number;
  } {
    const topHabits = Array.from(this.habits.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const commonPatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence > this.PATTERN_CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const activeReminders = Array.from(this.reminders.values())
      .filter(r => !r.triggered).length;

    return {
      topHabits,
      commonPatterns,
      activeReminders
    };
  }

  /**
   * Generate proactive message based on predictions
   */
  generateProactiveMessage(): string | null {
    const predictions = this.getPredictiveSuggestions();
    
    if (predictions.length === 0) return null;

    const topPrediction = predictions[0];
    
    if (topPrediction.confidence < 0.7) return null;

    // Generate contextual message
    switch (topPrediction.context.habit ? 'habit' : 'pattern') {
      case 'habit':
        const habit = topPrediction.context.habit as HabitData;
        return `I noticed you usually ${habit.action} around this time. Would you like me to help with that?`;
      
      default:
        return `Based on your patterns, you might want to ${topPrediction.suggestedAction.toLowerCase()}. Would that be helpful?`;
    }
  }

  /**
   * Clear all learned data
   */
  clearAllData(): void {
    this.patterns.clear();
    this.habits.clear();
    this.reminders.clear();
    this.interactionHistory = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    patternsLearned: number;
    habitsTracked: number;
    remindersActive: number;
    interactionsRecorded: number;
  } {
    return {
      patternsLearned: this.patterns.size,
      habitsTracked: this.habits.size,
      remindersActive: Array.from(this.reminders.values()).filter(r => !r.triggered).length,
      interactionsRecorded: this.interactionHistory.length
    };
  }
}

export const proactiveIntelligence = new ProactiveIntelligence();
