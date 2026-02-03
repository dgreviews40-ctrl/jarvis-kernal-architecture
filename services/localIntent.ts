import { IntentType, AIProvider } from "../types";
import { ParsedIntent } from "./gemini";
import { isHomeAssistantQuery } from "./haEntitySearch";

/**
 * Local Intent Classifier
 * Completely free, rule-based intent classification
 * Reduces Gemini API calls by handling common patterns locally
 */

interface IntentPattern {
  type: IntentType;
  confidence: number;
  patterns: RegExp[];
  keywords: string[];
  complexity: number;
  negativePatterns?: RegExp[]; // Patterns that reduce confidence if matched
}

const INTENT_PATTERNS: IntentPattern[] = [
  // HOME ASSISTANT DATA QUERY - MUST be first to catch sensor queries before MEMORY_READ
  {
    type: IntentType.QUERY,
    confidence: 0.95,
    complexity: 0.4,
    patterns: [
      // Generic sensor queries - catch-all patterns
      /\bwhat('s| is)\s+(my|the|current)\s+(status|value|reading|level)\s+of\b/i,
      /\bwhat('s| is)\s+(my|the|current)\s+\w+\s+(in|at|from)\s+(my|the)\s+(house|home|room)\b/i,
      /\bhow\s+(much|many|long|hot|cold|warm)\s+(is|are|do|does)\b/i,
      /\btell me\s+(my|the|about)\s+(current\s+)?\w+\s+(status|level|value|reading)\b/i,
      /\bcheck\s+(my|the)\s+\w+\s+(sensor|device|entity)\b/i,
      
      // Specific sensor types (comprehensive list)
      /\bwhat('s| is)\s+(my|the|current)\s+(solar|energy|power)\s+(production|usage|consumption|generation|level|output)\b/i,
      /\b(how much|what amount)\s+(solar|energy|power)\s+(am i|are we)\s+(producing|using|consuming|generating)\b/i,
      /\btell me\s+(my|the)\s+(solar|energy|power|current)\s+(production|usage|status|level)\b/i,
      /\bcurrent\s+(solar|energy|power)\s+(production|usage|consumption|generation|status|level)\b/i,
      
      // Air quality
      /\bwhat('s| is)\s+(my|the|current)\s+(air quality|aqi|co2|co²|pm2\.5|voc)\b/i,
      /\bhow('s| is)\s+(my|the)\s+air\s+(quality|in)\b/i,
      /\bair\s+quality\s+(in|at)\s+(my|the)\s+(house|home|room)\b/i,
      
      // 3D Printer
      /\bhow\s+(much|long)\s+(time\s+)?(is\s+)?(left|remaining)\s+(on|for)\s+(my|the)\s+(3d\s+)?print(er)?\b/i,
      /\bwhat('s| is)\s+(my|the)\s+(3d\s+)?print(er)?\s+(status|progress|doing)\b/i,
      /\bprint\s+(progress|status|time|percent)\b/i,
      
      // Temperature/weather - comprehensive patterns for sensor queries
      /\b(temperature|humidity|weather|pressure|uv|wind)\s+(in|at|outside|inside|outdoor|indoor)\b/i,
      /\bwhat('s| is)\s+(the|my|current|outside|inside|outdoor|indoor)\s+(temperature|humidity|weather)\b/i,
      /\bhow\s+(hot|cold|warm)\s+(is it|outside|inside|outdoors|indoors)\b/i,
      /\btell me\s+(the|my|current|outside|inside|outdoor|indoor)?\s*(temperature|humidity|weather)\b/i,
      /\bcan you\s+(tell|give)\s+me\s+(the|my|current)?\s*(temperature|humidity|weather)\b/i,
      
      // Battery
      /\bwhat('s| is)\s+(my|the)\s+battery\s+(level|percentage|status)\b/i,
      /\bhow\s+much\s+battery\s+(is left|remaining)\b/i,
      
      // Motion/Presence
      /\bis\s+(there|anyone|someone)\s+(in|at)\s+(my|the)\b/i,
      /\bmotion\s+(detected|in|at)\b/i,
      
      // Water/Leak
      /\bwater\s+(leak|detected|level)\b/i,
      /\bis\s+there\s+a\s+leak\b/i,
      
      // Home Assistant specific
      /\b(home assistant|ha)\s+(sensor|entity|device|status)\b/i,
      /\bsensor\s+(value|reading|status)\b/i
    ],
    keywords: [
      // Core sensor keywords
      'sensor', 'device', 'entity', 'status', 'value', 'reading', 'level',
      'current', 'in my house', 'in my home', 'at my', 'check my',
      
      // Energy/Power
      'solar', 'sore', 'soar', 'energy', 'power', 'production', 'consumption', 
      'usage', 'generating', 'producing', 'watt', 'kilowatt', 'kwh',
      
      // Environment
      'temperature', 'temp', 'humidity', 'weather', 'pressure', 'air quality', 
      'aqi', 'co2', 'co²', 'pm2.5', 'voc', 'pollution', 'ozone',
      
      // 3D Printer
      'printer', '3d', 'print', 'progress', 'remaining', 'time left',
      'ender', 'prus', 'bambu', 'klipper', 'octoprint',
      
      // Other sensors
      'battery', 'charge', 'motion', 'presence', 'door', 'window', 'leak', 
      'water', 'smoke', 'light', 'lux', 'brightness', 'network', 'wifi',
      // Temperature variants
      'outdoor', 'indoor', 'outside', 'inside'
    ]
  },
  
  // VISION_ANALYSIS - Physical visual commands
  {
    type: IntentType.VISION_ANALYSIS,
    confidence: 0.92,
    complexity: 0.6,
    patterns: [
      // Physical/visual looking - camera/webcam/physical objects
      /\b(look|see)\s+(at|this|here|the)\s+(camera|webcam|screen|image|picture|photo|video|display)/i,
      /\b(show me|what is this|describe this|scan this|analyze this|what do you see|can you see)\s+(on|in|the)/i,
      /\b(take a look|show what|what's in front of you)/i,
      /\b(camera|webcam|visual)\s+(check|scan|analyze|show|feed|view)/i,
      /\b(read this|what does this say|translate this|ocr)/i,
      // Looking at physical things (not data systems)
      /\blook\s+(at|in|out)\s+(the|my|this|that)\s+(room|window|door|desk|table|object|thing)/i,
      /\bwhat\s+(is|do you see)\s+(this|that|here|there)/i,
      // Voice-specific patterns for physical vision
      /jarvis.*\b(look|see|show|describe|scan|analyze)\s+(at|this|the|my)/i,
      /jarvis.*\bwhat.*\b(see|looking at|on my|in my|in the|on the)\s+(screen|camera|desk|room)/i
    ],
    keywords: ['look', 'see', 'camera', 'webcam', 'visual', 'scan', 'describe', 'image', 'picture', 'screen', 'read', 'ocr', 'translate', 'show me', 'this', 'that', 'here'],
    // Negative patterns - if these match, reduce confidence (data/system queries, not visual)
    negativePatterns: [
      /\b(home assistant|ha|solar|production|energy|power usage|statistics|data|sensor value|entity state)\b/i,
      /\blook\s+(at|in)\s+(home assistant|ha|solar|energy|data|statistics|history|log)/i
    ]
  },
  
  // TIMER_REMINDER - Timer and reminder requests
  {
    type: IntentType.TIMER_REMINDER,
    confidence: 0.95,
    complexity: 0.3,
    patterns: [
      /^(set|start|create)\s+(a\s+)?timer/i,
      /^(set|add)\s+(a\s+)?reminder/i,
      /^(remind me|remind us)/i,
      /\b(timer|reminder|alarm)\s+(for|in|at)\b/i,
      /\b(in\s+\d+\s+(second|seconds|minute|minutes|hour|hours))\b/i,
      /\b(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i,
      /\b(tomorrow|later|soon|in a while)\s+remind/i
    ],
    keywords: ['timer', 'remind', 'reminder', 'alarm', 'countdown', 'in', 'minutes', 'hours', 'seconds']
  },
  
  // MEMORY_WRITE - High confidence patterns
  {
    type: IntentType.MEMORY_WRITE,
    confidence: 0.90,
    complexity: 0.2,
    patterns: [
      /^(save|remember|store|note|write down|record|log|add to memory)/i,
      /^(don't forget|never forget|make sure to remember|keep in mind)/i,
      /(my name is|i am|i live|i work|i prefer|i like|i want)/i,
      /(this is important|remember that|take note)/i
    ],
    keywords: ['save', 'remember', 'store', 'note', 'record', 'log', 'forget', 'important']
  },
  
  // MEMORY_READ - Personal memory recall (NOT sensor data)
  {
    type: IntentType.MEMORY_READ,
    confidence: 0.85,
    complexity: 0.2,
    patterns: [
      /^(recall|what did|do you remember|what was|what have)/i,
      /^(where is|where are|where did|where was|where am i)/i,
      /^(what did i|what did we|what was the|what were the)/i,
      /^(tell me about|what do you know about|what can you tell me)/i,
      /\b(previously|before|earlier|last time|yesterday|last week|stored|saved)\b/i,
      // "What's my" only for personal info, not sensor data
      /what's my\s+(name|location|preference|setting|password)/i
    ],
    keywords: ['recall', 'remember', 'where', 'what did', 'previously', 'before', 'earlier', 'know about', 'stored'],
    // Strong negative patterns - reject sensor/data queries
    negativePatterns: [
      /\b(solar|energy|power|production|consumption|usage|sensor|device|entity|temperature|humidity|weather|stock|price|news)\b/i,
      /\b(current|now|today)\s+(solar|energy|power|temperature|weather)\b/i,
      /\b(producing|generating|consuming)\s+(solar|energy|power)\b/i
    ]
  },
  
  // COMMAND - Smart home and system commands
  {
    type: IntentType.COMMAND,
    confidence: 0.90,
    complexity: 0.3,
    patterns: [
      /^(turn on|turn off|toggle|switch|activate|deactivate|enable|disable)/i,
      /^(open|close|lock|unlock|start|stop|pause|resume|play)/i,
      // Note: 'set' alone is too broad - removed to avoid conflict with TIMER_REMINDER
      /^(adjust|change|modify|update|configure|dim|brighten)/i,
      /^(run|execute|launch|kill|terminate|restart|reboot|reset)/i,
      /^(increase|decrease|raise|lower|mute|unmute|volume)/i,
      // Note: 'temperature' removed - sensor queries handled by HOME ASSISTANT DATA QUERY
      /(light|lights|lamp|switch|fan|thermostat|climate|ac|heat|heater|cooler|hvac)/i,
      /(door|lock|garage|cover|blind|shade|curtain|window)/i,
      /(printer|outlet|plug|socket|power|device|entity)/i
    ],
    keywords: ['turn', 'toggle', 'switch', 'activate', 'enable', 'disable', 'open', 'close', 'lock', 'unlock', 'play', 'pause', 'stop', 'set', 'adjust', 'run', 'launch', 'increase', 'decrease', 'light', 'fan', 'thermostat']
  },
  
  // QUERY - Catch-all for questions (lowest priority in patterns)
  {
    type: IntentType.QUERY,
    confidence: 0.65,
    complexity: 0.6,
    patterns: [
      /^(what|who|when|where|why|how|which|whose|whom)/i,
      /^(is|are|was|were|do|does|did|can|could|will|would|should|may|might)/i,
      /^(tell me|explain|describe|elaborate|clarify)/i,
      /^(calculate|compute|solve|find|search|look up)/i,
      /\?$/  // Ends with question mark
    ],
    keywords: ['what', 'who', 'when', 'where', 'why', 'how', 'which', 'explain', 'tell me', 'calculate', 'search']
  }
];

// Words that indicate complexity (need cloud AI)
const COMPLEXITY_INDICATORS = [
  'explain', 'analyze', 'compare', 'contrast', 'evaluate', 'synthesize',
  'creative', 'write', 'story', 'poem', 'code', 'program', 'script',
  'philosophy', 'ethics', 'opinion', 'recommend', 'suggest', 'advice',
  'complex', 'detailed', 'comprehensive', 'thorough', 'in-depth'
];

// Words that indicate simple local handling is fine
const SIMPLICITY_INDICATORS = [
  'on', 'off', 'yes', 'no', 'now', 'today', 'here', 'there',
  'save', 'remember', 'recall', 'where', 'what is', 'who is'
];

export class LocalIntentClassifier {
  private patternCache: Map<string, { result: ParsedIntent; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly MAX_CACHE_SIZE = 100;
  
  // Common speech recognition typos and their corrections
  private readonly TYPO_CORRECTIONS: [RegExp, string][] = [
    [/\bsore\b/g, 'solar'],           // "sore" → "solar"
    [/\bsoar\b/g, 'solar'],          // "soar" → "solar"
    [/\bjervis\b/g, 'jarvis'],       // "jervis" → "jarvis"
    [/\bjarvis\b/g, ''],             // Remove wake word for classification
    [/\bproducktion\b/g, 'production'], // Common speech typo
    [/\bproduktion\b/g, 'production'],  // Another variant
  ];

  /**
   * Normalize input by fixing common speech recognition errors
   */
  private normalizeInput(input: string): string {
    let normalized = input.toLowerCase();
    for (const [pattern, replacement] of this.TYPO_CORRECTIONS) {
      normalized = normalized.replace(pattern, replacement);
    }
    return normalized.trim();
  }

  /**
   * Classify intent using local rules only
   * Completely free, no API calls
   */
  classify(input: string): ParsedIntent {
    const trimmed = input.trim();
    // Normalize to fix typos
    const normalized = this.normalizeInput(trimmed);
    
    // Check cache with normalized input
    const cached = this.getCached(normalized);
    if (cached) return cached;
    
    // Try pattern matching with normalized input
    const result = this.matchPatterns(normalized, trimmed);
    
    // Cache result
    this.cacheResult(normalized, result);
    
    return result;
  }
  
  /**
   * Check if this input should use Gemini (complex) or can be handled locally
   */
  shouldUseGemini(input: string): boolean {
    const normalized = this.normalizeInput(input);
    
    // Always use Gemini for complex creative tasks
    if (COMPLEXITY_INDICATORS.some(w => normalized.includes(w))) {
      return true;
    }
    
    // Check if this is a Home Assistant sensor query
    // These can be handled locally with our semantic search
    if (isHomeAssistantQuery(normalized)) {
      return false; // Handle HA queries locally
    }
    
    // Check if we have high confidence local match
    const localResult = this.classify(input);
    if (localResult.confidence >= 0.85) {
      return false; // Local is good enough
    }
    
    // Long inputs (>100 chars) might need AI understanding
    if (input.length > 100) {
      return true;
    }
    
    return false;
  }
  
  private matchPatterns(lower: string, original: string): ParsedIntent {
    let bestMatch: ParsedIntent | null = null;
    let highestScore = 0;
    
    for (const pattern of INTENT_PATTERNS) {
      const score = this.calculateMatchScore(lower, original, pattern);
      
      if (score > highestScore && score >= 0.6) {
        highestScore = score;
        bestMatch = {
          type: pattern.type,
          confidence: Math.min(0.95, pattern.confidence * score),
          complexity: this.calculateComplexity(lower),
          suggestedProvider: this.determineProvider(lower, pattern.type),
          entities: this.extractEntities(lower),
          reasoning: `Local pattern match: ${pattern.type} (score: ${score.toFixed(2)})`
        };
      }
    }
    
    // Default to QUERY if no strong match
    if (!bestMatch) {
      return {
        type: IntentType.QUERY,
        confidence: 0.55,
        complexity: this.calculateComplexity(lower),
        suggestedProvider: this.determineProvider(lower, IntentType.QUERY),
        entities: this.extractEntities(lower),
        reasoning: "No strong local pattern match, defaulting to query"
      };
    }
    
    return bestMatch;
  }
  
  private calculateMatchScore(lower: string, original: string, pattern: IntentPattern): number {
    let score = 0;
    let matches = 0;
    
    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(original) || regex.test(lower)) {
        matches++;
        score += 0.4; // Strong pattern match
      }
    }
    
    // Check keywords
    const words = lower.split(/\s+/);
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        matches++;
        score += 0.15;
      }
    }
    
    // Check negative patterns (reduce score if matched)
    if (pattern.negativePatterns) {
      for (const negRegex of pattern.negativePatterns) {
        if (negRegex.test(lower)) {
          score -= 0.3; // Significant penalty
          matches = Math.max(0, matches - 1);
        }
      }
    }
    
    // Bonus for multiple keyword matches
    if (matches >= 3) {
      score += 0.1;
    }
    
    // Penalty for very short inputs (harder to classify)
    if (lower.length < 10) {
      score *= 0.9;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private calculateComplexity(input: string): number {
    let complexity = 0.3; // Base complexity
    const lower = input.toLowerCase();
    
    // Increase for complex indicators
    for (const indicator of COMPLEXITY_INDICATORS) {
      if (lower.includes(indicator)) {
        complexity += 0.15;
      }
    }
    
    // Decrease for simplicity indicators
    for (const indicator of SIMPLICITY_INDICATORS) {
      if (lower.includes(indicator)) {
        complexity -= 0.1;
      }
    }
    
    // Length factor
    if (input.length > 150) complexity += 0.2;
    else if (input.length < 30) complexity -= 0.1;
    
    // Question complexity
    const questionWords = (lower.match(/\b(what|who|when|where|why|how)\b/g) || []).length;
    complexity += questionWords * 0.05;
    
    return Math.max(0.1, Math.min(1, complexity));
  }
  
  private determineProvider(input: string, intentType: IntentType): string {
    const lower = input.toLowerCase();
    
    // Commands and memory operations can always use Ollama
    if (intentType === IntentType.COMMAND || 
        intentType === IntentType.MEMORY_READ || 
        intentType === IntentType.MEMORY_WRITE) {
      return 'OLLAMA';
    }
    
    // Vision can use Ollama if llava is available
    if (intentType === IntentType.VISION_ANALYSIS) {
      return 'OLLAMA'; // Will fall back to Gemini if llava not available
    }
    
    // Queries: use complexity to decide
    if (this.calculateComplexity(lower) > 0.6) {
      return 'GEMINI';
    }
    
    return 'OLLAMA';
  }
  
  private extractEntities(input: string): string[] {
    const entities: string[] = [];
    const lower = input.toLowerCase();
    
    // Extract quoted strings
    const quotes = input.match(/"([^"]*)"/g);
    if (quotes) {
      entities.push(...quotes.map(q => q.replace(/"/g, '')));
    }
    
    // Extract device names (common smart home devices)
    const devicePatterns = [
      /\b(living room|bedroom|kitchen|bathroom|office|garage)\s+(light|lights|fan|switch|outlet)\b/gi,
      /\b(front|back|side|garage)\s+(door|light|camera)\b/gi,
      /\b(printer|tv|television|radio|speaker|thermostat|ac|heater)\b/gi,
      /\b(\d+)\s*(percent|%|degrees)\b/gi
    ];
    
    for (const pattern of devicePatterns) {
      const matches = lower.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }
    
    // Extract time references
    const timePattern = /\b(tomorrow|today|yesterday|now|later|soon|in \d+ (minutes?|hours?|days?))\b/gi;
    const timeMatches = lower.match(timePattern);
    if (timeMatches) {
      entities.push(...timeMatches);
    }
    
    return entities.length > 0 ? entities : input.split(/\s+/).filter(w => w.length > 3);
  }
  
  private getCached(key: string): ParsedIntent | null {
    const cached = this.patternCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    return null;
  }
  
  private cacheResult(key: string, result: ParsedIntent): void {
    // Enforce max cache size (LRU eviction)
    if (this.patternCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.patternCache.keys().next().value;
      if (firstKey) {
        this.patternCache.delete(firstKey);
      }
    }
    
    this.patternCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get classification statistics for debugging
   */
  getStats(): { cacheSize: number; patterns: number } {
    return {
      cacheSize: this.patternCache.size,
      patterns: INTENT_PATTERNS.length
    };
  }
  
  /**
   * Clear the pattern cache
   */
  clearCache(): void {
    this.patternCache.clear();
  }
}

// Export singleton instance
export const localIntentClassifier = new LocalIntentClassifier();
