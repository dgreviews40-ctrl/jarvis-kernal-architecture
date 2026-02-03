import { memory } from './memory';
import { conversation } from './conversation';

// Correction patterns that indicate user is correcting JARVIS
const CORRECTION_PATTERNS = [
  /^no[,.]?\s+/i,
  /^that'?s?\s+(not|wrong|incorrect)/i,
  /^actually[,.]?\s+/i,
  /^i\s+(meant|said|wanted)/i,
  /^not\s+quite/i,
  /^you\s+(misunderstood|got\s+it\s+wrong)/i,
  /^wrong[,.]?\s+/i,
  /^incorrect[,.]?\s+/i,
  /^i\s+didn'?t\s+(mean|say|want)/i,
  /^that'?s?\s+not\s+what\s+i/i,
  /^let\s+me\s+(clarify|rephrase)/i,
  /^to\s+clarify/i,
  /^what\s+i\s+meant\s+was/i,
];

// Preference patterns
const PREFERENCE_PATTERNS = [
  { pattern: /i\s+(prefer|like|want)\s+(.+)/i, type: 'preference' },
  { pattern: /always\s+(.+)/i, type: 'preference' },
  { pattern: /never\s+(.+)/i, type: 'negative_preference' },
  { pattern: /don'?t\s+(ever\s+)?(.+)/i, type: 'negative_preference' },
  { pattern: /my\s+name\s+is\s+(.+)/i, type: 'identity' },
  { pattern: /i'?m?\s+(a|an)\s+(.+)/i, type: 'identity' },
  { pattern: /i\s+live\s+in\s+(.+)/i, type: 'location' },
  { pattern: /i\s+work\s+(at|for)\s+(.+)/i, type: 'work' },
  { pattern: /call\s+me\s+(.+)/i, type: 'identity' },
];

export interface Correction {
  id: string;
  timestamp: number;
  originalQuery: string;
  incorrectResponse: string;
  correctionText: string;
  learnedFact?: string;
}

export interface LearnedPreference {
  id: string;
  timestamp: number;
  type: string;
  content: string;
  source: string;
}

class LearningService {
  private corrections: Correction[] = [];
  private storageKey = 'jarvis_corrections';

  constructor() {
    this.loadCorrections();
  }

  /**
   * Detect if user input is a correction of previous response
   */
  public isCorrection(input: string): boolean {
    return CORRECTION_PATTERNS.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Process a correction and learn from it
   */
  public async processCorrection(userInput: string): Promise<string | null> {
    const lastUserQuery = conversation.getLastUserInput();
    const lastResponse = conversation.getLastResponse();

    if (!lastResponse) {
      return null;
    }

    // Extract the correction content (what the user is correcting to)
    let correctionContent = userInput;
    for (const pattern of CORRECTION_PATTERNS) {
      correctionContent = correctionContent.replace(pattern, '').trim();
    }

    if (!correctionContent) {
      return null;
    }

    // Create correction record
    const correction: Correction = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      originalQuery: lastUserQuery || '',
      incorrectResponse: lastResponse.substring(0, 200),
      correctionText: correctionContent,
    };

    // Try to extract a learnable fact
    const learnedFact = this.extractLearnableFact(correctionContent, lastUserQuery);
    if (learnedFact) {
      correction.learnedFact = learnedFact;
      
      // Store in memory
      await memory.store(learnedFact, 'FACT', ['user_correction', 'learned']);
      console.log('[LEARNING] Stored correction as fact:', learnedFact);
    }

    // Save correction
    this.corrections.unshift(correction);
    if (this.corrections.length > 50) {
      this.corrections.pop();
    }
    this.saveCorrections();

    return learnedFact;
  }

  /**
   * Detect and learn from user preferences in input
   */
  public async detectAndLearnPreference(input: string): Promise<LearnedPreference | null> {
    for (const { pattern, type } of PREFERENCE_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        const content = match[match.length - 1]?.trim();
        if (content && content.length > 2) {
          const preference: LearnedPreference = {
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now(),
            type,
            content,
            source: input
          };

          // Build memory content based on type
          let memoryContent = '';
          switch (type) {
            case 'preference':
              memoryContent = `User preference: ${content}`;
              break;
            case 'negative_preference':
              memoryContent = `User dislikes/avoids: ${content}`;
              break;
            case 'identity':
              memoryContent = `User identity: ${content}`;
              break;
            case 'location':
              memoryContent = `User location: ${content}`;
              break;
            case 'work':
              memoryContent = `User works at: ${content}`;
              break;
            default:
              memoryContent = content;
          }

          // Store in memory
          await memory.store(memoryContent, 'PREFERENCE', ['auto_learned', type]);
          console.log('[LEARNING] Learned preference:', memoryContent);

          return preference;
        }
      }
    }
    return null;
  }

  /**
   * Extract a learnable fact from correction text
   */
  private extractLearnableFact(correction: string, originalQuery: string | null): string | null {
    // Simple heuristic: if correction contains "is", "are", "was", treat as fact
    const factPatterns = [
      /(.+)\s+is\s+(.+)/i,
      /(.+)\s+are\s+(.+)/i,
      /(.+)\s+was\s+(.+)/i,
      /(.+)\s+were\s+(.+)/i,
      /the\s+(.+)\s+is\s+(.+)/i,
      /my\s+(.+)\s+is\s+(.+)/i,
    ];

    for (const pattern of factPatterns) {
      if (pattern.test(correction)) {
        return `Corrected fact: ${correction}`;
      }
    }

    // If original query was a question, the correction might be the answer
    if (originalQuery && (originalQuery.includes('?') || originalQuery.toLowerCase().startsWith('what'))) {
      return `Answer to "${originalQuery}": ${correction}`;
    }

    return null;
  }

  /**
   * Get recent corrections for context
   */
  public getRecentCorrections(limit: number = 5): Correction[] {
    return this.corrections.slice(0, limit);
  }

  /**
   * Check if a similar query was corrected before
   */
  public findRelevantCorrection(query: string): Correction | null {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(w => w.length > 3);

    for (const correction of this.corrections) {
      const originalLower = correction.originalQuery.toLowerCase();
      // Check for word overlap
      const matchCount = queryWords.filter(w => originalLower.includes(w)).length;
      if (matchCount >= 2 || (queryWords.length <= 2 && matchCount >= 1)) {
        return correction;
      }
    }
    return null;
  }

  private loadCorrections() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.corrections = JSON.parse(saved);
      }
    } catch (e) {
      this.corrections = [];
    }
  }

  private saveCorrections() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.corrections));
    } catch (e) {
      console.warn('[LEARNING] Failed to save corrections:', e);
    }
  }
}

export const learningService = new LearningService();
