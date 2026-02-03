import { conversation } from './conversation';
import { memory } from './memory';
import { haService } from './home_assistant';

export interface Suggestion {
  text: string;
  category: 'command' | 'query' | 'memory' | 'vision' | 'recent';
  description?: string;
}

// Common command templates
const COMMAND_TEMPLATES: Suggestion[] = [
  { text: 'turn on the lights', category: 'command', description: 'Control lighting' },
  { text: 'turn off the lights', category: 'command', description: 'Control lighting' },
  { text: 'what time is it', category: 'query', description: 'Get current time' },
  { text: 'run diagnostics', category: 'command', description: 'System check' },
  { text: 'what can you see', category: 'vision', description: 'Analyze camera' },
  { text: 'remember this', category: 'memory', description: 'Store information' },
  { text: 'what do you remember', category: 'memory', description: 'Recall memory' },
];

// Context-aware suggestion patterns
const FOLLOWUP_PATTERNS: Record<string, Suggestion[]> = {
  'light': [
    { text: 'dim the lights to 50%', category: 'command', description: 'Adjust brightness' },
    { text: 'change light color to blue', category: 'command', description: 'Change color' },
    { text: 'turn off all lights', category: 'command', description: 'All off' },
  ],
  'weather': [
    { text: 'what about tomorrow', category: 'query', description: 'Tomorrow\'s forecast' },
    { text: 'will it rain this week', category: 'query', description: 'Week forecast' },
  ],
  'time': [
    { text: 'set a timer for 5 minutes', category: 'command', description: 'Set timer' },
    { text: 'what day is it', category: 'query', description: 'Get date' },
  ],
  'remember': [
    { text: 'what else do you remember', category: 'memory', description: 'More memories' },
    { text: 'forget that', category: 'memory', description: 'Delete memory' },
  ],
  'vision': [
    { text: 'describe what you see in detail', category: 'vision', description: 'Detailed analysis' },
    { text: 'is anyone there', category: 'vision', description: 'Detect people' },
    { text: 'what colors do you see', category: 'vision', description: 'Color analysis' },
  ],
  'music': [
    { text: 'pause the music', category: 'command', description: 'Pause playback' },
    { text: 'skip this song', category: 'command', description: 'Next track' },
    { text: 'turn up the volume', category: 'command', description: 'Increase volume' },
  ],
};

class SuggestionService {
  private recentCommands: string[] = [];
  private maxRecent = 5;

  /**
   * Get suggestions based on current input and conversation context
   */
  public getSuggestions(currentInput: string, maxSuggestions: number = 5): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const inputLower = currentInput.toLowerCase().trim();

    // If input is empty, suggest based on context or show recent
    if (!inputLower) {
      return this.getContextualSuggestions(maxSuggestions);
    }

    // Filter command templates that match input
    const matchingTemplates = COMMAND_TEMPLATES.filter(s => 
      s.text.toLowerCase().includes(inputLower) ||
      inputLower.split(' ').some(word => s.text.toLowerCase().includes(word))
    );
    suggestions.push(...matchingTemplates);

    // Add Home Assistant entity suggestions if relevant
    if (this.isHomeAssistantQuery(inputLower)) {
      const haSuggestions = this.getHomeAssistantSuggestions(inputLower);
      suggestions.push(...haSuggestions);
    }

    // Dedupe and limit
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    return uniqueSuggestions.slice(0, maxSuggestions);
  }

  /**
   * Get context-aware suggestions based on last conversation
   */
  private getContextualSuggestions(maxSuggestions: number): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Get last JARVIS response to determine context
    const lastResponse = conversation.getLastResponse();
    const lastInput = conversation.getLastUserInput();
    
    if (lastResponse || lastInput) {
      const contextText = (lastResponse || '') + ' ' + (lastInput || '');
      const contextLower = contextText.toLowerCase();
      
      // Check for context patterns
      for (const [pattern, followups] of Object.entries(FOLLOWUP_PATTERNS)) {
        if (contextLower.includes(pattern)) {
          suggestions.push(...followups);
        }
      }
    }

    // Add recent commands
    const recentSuggestions: Suggestion[] = this.recentCommands.map(cmd => ({
      text: cmd,
      category: 'recent' as const,
      description: 'Recent command'
    }));
    suggestions.push(...recentSuggestions);

    // If still not enough, add default templates
    if (suggestions.length < maxSuggestions) {
      const remaining = maxSuggestions - suggestions.length;
      suggestions.push(...COMMAND_TEMPLATES.slice(0, remaining));
    }

    return this.deduplicateSuggestions(suggestions).slice(0, maxSuggestions);
  }

  /**
   * Check if query is related to Home Assistant
   */
  private isHomeAssistantQuery(input: string): boolean {
    const keywords = ['light', 'switch', 'turn', 'toggle', 'lock', 'door', 'thermostat', 'fan', 'plug', 'outlet'];
    return keywords.some(kw => input.includes(kw));
  }

  /**
   * Get Home Assistant entity suggestions
   */
  private getHomeAssistantSuggestions(input: string): Suggestion[] {
    if (!haService.initialized) return [];
    
    // This could be enhanced to actually query HA entities
    // For now, return common patterns
    const suggestions: Suggestion[] = [];
    
    if (input.includes('light')) {
      suggestions.push(
        { text: 'turn on living room lights', category: 'command', description: 'Living room' },
        { text: 'turn off bedroom lights', category: 'command', description: 'Bedroom' }
      );
    }
    
    return suggestions;
  }

  /**
   * Record a command for recent suggestions
   */
  public recordCommand(command: string): void {
    // Don't record very short commands
    if (command.length < 5) return;
    
    // Remove if already exists
    this.recentCommands = this.recentCommands.filter(c => c !== command);
    
    // Add to front
    this.recentCommands.unshift(command);
    
    // Limit size
    if (this.recentCommands.length > this.maxRecent) {
      this.recentCommands.pop();
    }

    // Persist to localStorage
    try {
      localStorage.setItem('jarvis_recent_commands', JSON.stringify(this.recentCommands));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Load recent commands from storage
   */
  public loadRecent(): void {
    try {
      const saved = localStorage.getItem('jarvis_recent_commands');
      if (saved) {
        this.recentCommands = JSON.parse(saved);
      }
    } catch (e) {
      this.recentCommands = [];
    }
  }

  /**
   * Remove duplicate suggestions
   */
  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      const key = s.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const suggestionService = new SuggestionService();

// Load recent commands on init
suggestionService.loadRecent();
