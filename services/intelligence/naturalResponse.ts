/**
 * Natural Response Generator
 * 
 * Generates more natural, human-like responses:
 * - Response variation and diversity
 * - Conversational fillers and transitions
 * - Context-aware formatting
 * - Emotional tone matching
 * - Personality-consistent language
 */

import { personalityEngine } from "./personalityEngine";
import { conversationalContext } from "./conversationalContext";

interface ResponseTemplate {
  id: string;
  category: string;
  templates: string[];
  context: string[];
  tone: 'neutral' | 'friendly' | 'professional' | 'enthusiastic' | 'empathetic';
}

interface ResponseVariation {
  opening: string[];
  transition: string[];
  closing: string[];
  filler: string[];
}

export class NaturalResponseGenerator {
  private templates: Map<string, ResponseTemplate> = new Map();
  private usedTemplates: Map<string, number> = new Map(); // Track usage to avoid repetition
  private readonly MAX_TEMPLATE_REUSE = 3;

  // Natural language variations
  private variations: ResponseVariation = {
    opening: [
      "",
      "Well, ",
      "So, ",
      "Alright, ",
      "Okay, ",
      "Let me see, ",
      "Hmm, ",
      "You know, "
    ],
    transition: [
      " Also, ",
      " Additionally, ",
      " Furthermore, ",
      " On top of that, ",
      " Besides that, ",
      " What's more, ",
      " Not only that, ",
      " Along with that, "
    ],
    closing: [
      "",
      " Let me know if you need anything else!",
      " Hope that helps!",
      " Does that answer your question?",
      " Anything else I can help with?",
      " Make sense?",
      " Let me know if you'd like more details."
    ],
    filler: [
      "basically",
      "essentially",
      "in a way",
      "sort of",
      "kind of",
      "if you will",
      "so to speak",
      "if that makes sense"
    ]
  };

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize response templates
   */
  private initializeTemplates(): void {
    const templateData: ResponseTemplate[] = [
      {
        id: 'acknowledge',
        category: 'acknowledgment',
        templates: [
          "Got it.",
          "Understood.",
          "I see.",
          "Alright.",
          "Okay, noted.",
          "Roger that.",
          "Copy that.",
          "Message received."
        ],
        context: ['command', 'instruction', 'request'],
        tone: 'neutral'
      },
      {
        id: 'thinking',
        category: 'processing',
        templates: [
          "Let me think about that for a moment.",
          "Give me a second to process that.",
          "Let me work through this.",
          "I'm processing your request.",
          "One moment while I figure this out.",
          "Let me look into that for you."
        ],
        context: ['complex_query', 'calculation', 'research'],
        tone: 'professional'
      },
      {
        id: 'uncertainty',
        category: 'uncertainty',
        templates: [
          "I'm not entirely sure about that.",
          "I don't have a definitive answer for that.",
          "That's a bit outside my current knowledge.",
          "I'm afraid I can't say for certain.",
          "I'd need more information to answer that accurately.",
          "That's a good question - let me see what I can find out."
        ],
        context: ['unknown', 'unclear', 'ambiguous'],
        tone: 'empathetic'
      },
      {
        id: 'success',
        category: 'success',
        templates: [
          "Done!",
          "All set!",
          "Completed successfully.",
          "There you go!",
          "Finished!",
          "Success!",
          "Taken care of!",
          "All done!"
        ],
        context: ['task_complete', 'action_successful'],
        tone: 'friendly'
      },
      {
        id: 'error',
        category: 'error',
        templates: [
          "I ran into an issue there.",
          "Something went wrong on my end.",
          "I wasn't able to complete that.",
          "That didn't work as expected.",
          "I encountered a problem.",
          "I'm having trouble with that request."
        ],
        context: ['failure', 'error', 'unable'],
        tone: 'empathetic'
      },
      {
        id: 'clarification',
        category: 'clarification',
        templates: [
          "Just to make sure I understand...",
          "Let me clarify - ",
          "To be clear, ",
          "So what you're saying is...",
          "If I understand correctly, ",
          "Correct me if I'm wrong, but..."
        ],
        context: ['unclear', 'ambiguous', 'confirming'],
        tone: 'professional'
      },
      {
        id: 'gratitude',
        category: 'gratitude',
        templates: [
          "Thank you!",
          "Thanks for that!",
          "I appreciate it!",
          "Much appreciated!",
          "Thanks a bunch!",
          "Thank you for letting me know!"
        ],
        context: ['positive_feedback', 'helpful_input', 'correction'],
        tone: 'friendly'
      }
    ];

    templateData.forEach(t => this.templates.set(t.id, t));
  }

  /**
   * Generate a natural response
   */
  generate(
    content: string,
    options: {
      addOpening?: boolean;
      addClosing?: boolean;
      tone?: 'neutral' | 'friendly' | 'professional' | 'enthusiastic' | 'empathetic';
      context?: string[];
      avoidRepetition?: boolean;
    } = {}
  ): string {
    const {
      addOpening = true,
      addClosing = false,
      tone = 'neutral',
      context = [],
      avoidRepetition = true
    } = options;

    let response = content;

    // Add natural opening
    if (addOpening && !this.hasOpeningPhrase(content)) {
      const opening = this.selectOpening(tone);
      if (opening) {
        response = opening + this.lowercaseFirst(response);
      }
    }

    // Add natural closing
    if (addClosing && !this.hasClosingPhrase(content)) {
      const closing = this.selectClosing(tone);
      if (closing) {
        response = response + closing;
      }
    }

    // Apply personality adjustments
    response = this.applyPersonalityAdjustments(response, tone);

    // Add conversational elements if appropriate
    if (response.length > 100 && !response.includes('?')) {
      response = this.addConversationalElements(response);
    }

    return response;
  }

  /**
   * Select appropriate opening
   */
  private selectOpening(tone: string): string {
    const personality = personalityEngine.getStats();
    
    // Adjust based on emotional state
    if (personality.emotionalState === 'excited') {
      return this.variations.opening[Math.floor(Math.random() * 3) + 4]; // More energetic openings
    }
    
    if (personality.emotionalState === 'concerned') {
      return "Let me help you with that. ";
    }

    // Random selection with bias toward empty (no opening)
    const rand = Math.random();
    if (rand < 0.4) return ""; // 40% no opening
    
    const index = Math.floor(Math.random() * this.variations.opening.length);
    return this.variations.opening[index];
  }

  /**
   * Select appropriate closing
   */
  private selectClosing(tone: string): string {
    // Don't always add closing
    if (Math.random() < 0.6) return "";

    const relevantClosings = this.variations.closing.filter((_, i) => i > 0);
    const index = Math.floor(Math.random() * relevantClosings.length);
    return relevantClosings[index];
  }

  /**
   * Apply personality-based adjustments
   */
  private applyPersonalityAdjustments(response: string, tone: string): string {
    const stats = personalityEngine.getStats();
    
    // Adjust verbosity
    if (stats.style.verbosity === 'concise' && response.length > 150) {
      // Try to condense by removing filler words
      response = this.condenseResponse(response);
    }

    // Adjust formality
    if (stats.style.formality === 'casual') {
      response = this.makeMoreCasual(response);
    } else if (stats.style.formality === 'formal') {
      response = this.makeMoreFormal(response);
    }

    return response;
  }

  /**
   * Make response more casual
   */
  private makeMoreCasual(response: string): string {
    const replacements: [RegExp, string][] = [
      [/I will/g, "I'll"],
      [/I am/g, "I'm"],
      [/do not/g, "don't"],
      [/cannot/g, "can't"],
      [/would like/g, "want"],
      [/assistance/g, "help"],
      [/however/g, "but"],
      [/therefore/g, "so"],
      [/additionally/g, "also"]
    ];

    let casual = response;
    replacements.forEach(([pattern, replacement]) => {
      casual = casual.replace(pattern, replacement);
    });

    return casual;
  }

  /**
   * Make response more formal
   */
  private makeMoreFormal(response: string): string {
    const replacements: [RegExp, string][] = [
      [/I'll/g, "I will"],
      [/I'm/g, "I am"],
      [/don't/g, "do not"],
      [/can't/g, "cannot"],
      [/won't/g, "will not"],
      [/let's/g, "let us"],
      [/yeah/g, "yes"],
      [/okay/g, "alright"]
    ];

    let formal = response;
    replacements.forEach(([pattern, replacement]) => {
      formal = formal.replace(pattern, replacement);
    });

    return formal;
  }

  /**
   * Condense a verbose response
   */
  private condenseResponse(response: string): string {
    // Remove filler phrases
    const fillerPatterns = [
      /basically\s+/gi,
      /essentially\s+/gi,
      /in a way\s+/gi,
      /sort of\s+/gi,
      /kind of\s+/gi,
      /if you will\s+/gi,
      /so to speak\s+/gi
    ];

    let condensed = response;
    fillerPatterns.forEach(pattern => {
      condensed = condensed.replace(pattern, '');
    });

    // Remove redundant spaces
    condensed = condensed.replace(/\s+/g, ' ').trim();

    return condensed;
  }

  /**
   * Add conversational elements to longer responses
   */
  private addConversationalElements(response: string): string {
    // Split into sentences
    const sentences = response.split(/(?<=[.!?])\s+/);
    
    if (sentences.length < 3) return response;

    // Add transition between sentences 1 and 2 (occasionally)
    if (Math.random() < 0.3 && sentences.length > 2) {
      const transition = this.variations.transition[
        Math.floor(Math.random() * this.variations.transition.length)
      ];
      sentences[1] = transition.trim() + sentences[1].toLowerCase();
    }

    return sentences.join(' ');
  }

  /**
   * Check if response already has an opening
   */
  private hasOpeningPhrase(response: string): boolean {
    const openingPhrases = [
      'well,', 'so,', 'alright,', 'okay,', 'let me', 'hmm,', 'you know,',
      'actually,', 'basically,', 'essentially,'
    ];
    const lower = response.toLowerCase();
    return openingPhrases.some(phrase => lower.startsWith(phrase));
  }

  /**
   * Check if response already has a closing
   */
  private hasClosingPhrase(response: string): boolean {
    const closingPhrases = [
      'let me know', 'hope that helps', 'anything else',
      'does that', 'make sense', 'need more'
    ];
    const lower = response.toLowerCase();
    return closingPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Lowercase first character
   */
  private lowercaseFirst(str: string): string {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Get a template response
   */
  getTemplate(templateId: string, avoidRepetition: boolean = true): string {
    const template = this.templates.get(templateId);
    if (!template) return "";

    if (avoidRepetition) {
      // Find least recently used template
      const usage = template.templates.map((t, i) => ({
        index: i,
        used: this.usedTemplates.get(`${templateId}_${i}`) || 0
      }));
      
      usage.sort((a, b) => a.used - b.used);
      const selectedIndex = usage[0].index;
      
      // Track usage
      this.usedTemplates.set(`${templateId}_${selectedIndex}`, usage[0].used + 1);
      
      return template.templates[selectedIndex];
    }

    return template.templates[Math.floor(Math.random() * template.templates.length)];
  }

  /**
   * Generate acknowledgment response
   */
  generateAcknowledgment(context: string = 'general'): string {
    const templates = this.templates.get('acknowledge');
    if (!templates) return "Okay.";

    // Context-aware selection
    const relevant = templates.templates.filter((_, i) => {
      const usage = this.usedTemplates.get(`acknowledge_${i}`) || 0;
      return usage < this.MAX_TEMPLATE_REUSE;
    });

    const selected = relevant.length > 0 
      ? relevant[Math.floor(Math.random() * relevant.length)]
      : templates.templates[Math.floor(Math.random() * templates.templates.length)];

    return this.generate(selected, { addOpening: false, addClosing: false });
  }

  /**
   * Generate thinking/processing response
   */
  generateThinkingIndicator(): string {
    return this.getTemplate('thinking');
  }

  /**
   * Generate uncertainty response
   */
  generateUncertaintyResponse(addOfferToHelp: boolean = true): string {
    const base = this.getTemplate('uncertainty');
    
    if (addOfferToHelp) {
      return this.generate(base + " Is there something else I can help you with?", {
        addOpening: true,
        addClosing: false
      });
    }

    return this.generate(base, { addOpening: true, addClosing: false });
  }

  /**
   * Generate success confirmation
   */
  generateSuccessResponse(context: string = 'general'): string {
    const base = this.getTemplate('success');
    return this.generate(base, { addOpening: false, addClosing: true });
  }

  /**
   * Generate error response with empathy
   */
  generateErrorResponse(includeRetry: boolean = true): string {
    const base = this.getTemplate('error');
    
    if (includeRetry) {
      return this.generate(base + " Would you like me to try again, or is there another way I can help?", {
        addOpening: false,
        addClosing: false,
        tone: 'empathetic'
      });
    }

    return this.generate(base, { addOpening: false, addClosing: true, tone: 'empathetic' });
  }

  /**
   * Format a list naturally
   */
  formatList(items: string[], intro: string = "Here are the options:"): string {
    if (items.length === 0) return "";
    if (items.length === 1) return `${intro} ${items[0]}`;
    if (items.length === 2) return `${intro} ${items[0]} and ${items[1]}`;

    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return `${intro} ${allButLast}, and ${last}`;
  }

  /**
   * Format a choice naturally
   */
  formatChoice(options: string[]): string {
    if (options.length === 2) {
      return `Would you prefer ${options[0]} or ${options[1]}?`;
    }
    
    return this.formatList(options, "Your options are:") + ". Which would you like?";
  }

  /**
   * Add follow-up suggestion
   */
  addFollowUp(baseResponse: string, suggestion: string): string {
    const connectors = [
      " Also, ",
      " By the way, ",
      " Additionally, ",
      " If you're interested, "
    ];
    
    const connector = connectors[Math.floor(Math.random() * connectors.length)];
    return baseResponse + connector + suggestion;
  }

  /**
   * Reset usage tracking
   */
  resetUsageTracking(): void {
    this.usedTemplates.clear();
  }
}

export const naturalResponse = new NaturalResponseGenerator();
