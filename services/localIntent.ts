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
  // VISION_ANALYSIS - Physical visual commands (MOVED FIRST for priority)
  {
    type: IntentType.VISION_ANALYSIS,
    confidence: 0.95,
    complexity: 0.4,
    patterns: [
      // Direct camera/webcam commands - HIGH PRIORITY
      /\b(open|start|turn on)\s+(the|my)\s+(camera|webcam)\b/i,
      /\b(camera|webcam)\s+(on|open|start)\b/i,
      // Snapshot commands - HIGH PRIORITY
      /\b(take|capture|grab)\s+(a\s+)?(snapshot|photo|picture|image|pic)\b/i,
      /\b(snapshot|photo|picture)\s+(camera|webcam|me|this|now)\b/i,
      // Look at camera/webcam/feed
      /\b(look|see|view|check)\s+(at|at my|at the)?\s*(camera|webcam|local camera|video feed|camera feed)\b/i,
      /\b(look|see|view)\s+(at|my|the)?\s*(local|this|my)?\s*(camera|webcam|feed)\b/i,
      // Specific camera names (garage, front door, etc.)
      /\b(take|capture|grab)\s+(a\s+)?(snapshot|photo|picture)\s+(of|from)\s+(the|my)?\s*(garage|front|back|rear|door|porch|yard|kitchen|living|office|room)\s*(cam|camera)?\b/i,
      /\b(snapshot|photo)\s+(of|from)\s+(the|my)?\s*(garage|front|back|rear|door|porch|yard)\s*(cam|camera)?\b/i,
      /\b(garage|front|back|rear|door|porch|yard|kitchen|living|office)\s*(cam|camera)\s*(snapshot|photo|picture)?\b/i,
      // Physical/visual looking
      /\b(show me|what is this|describe this|scan this|analyze this|what do you see|can you see)\s+(on|in|the|my)?\s*(camera|webcam|screen|feed)?\b/i,
      /\b(take a look|show what|what's in front of you|what can you see)\b/i,
      /\b(camera|webcam|visual)\s+(check|scan|analyze|show|feed|view|look)\b/i,
      // Read/see content
      /\b(read this|what does this say|translate this|ocr|can you read)\b/i,
      // Looking at physical things (not data systems)
      /\blook\s+(at|in|out)\s+(the|my|this|that)\s+(room|window|door|desk|table|object|thing)\b/i,
      /\bwhat\s+(is|do you see)\s+(this|that|here|there|in front of you)\b/i,
      // Voice-specific patterns for physical vision
      /jarvis.*\b(look|see|show|describe|scan|analyze)\s+(at|this|the|my|camera|webcam)/i,
      /jarvis.*\bwhat.*\b(see|looking at|on my|in my|in the|on the)\s+(screen|camera|desk|room)\b/i
    ],
    keywords: ['look', 'see', 'camera', 'webcam', 'visual', 'scan', 'describe', 'image', 'picture', 'screen', 'read', 'ocr', 'translate', 'show me', 'this', 'that', 'here', 'snapshot', 'photo', 'pic', 'local camera', 'camera feed', 'video feed', 'open camera', 'take photo', 'capture image', 'garage', 'front door', 'back yard'],
    // Negative patterns - if these match, reduce confidence (data/system queries, not visual)
    negativePatterns: [
      /\b(home assistant|ha)\s+(sensor|entity|device|status|camera)\s+(value|reading|status)\b/i,
      /\blook\s+(at|in)\s+(home assistant|ha|solar|energy|data|statistics|history|log)\b/i,
      /\bcamera\s+(sensor|entity|status|value|reading)\b/i
    ]
  },
  
  // HOME ASSISTANT DATA QUERY - Catch sensor queries
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
    // Negative patterns - exclude idea/project requests
    negativePatterns: [
      /\b(ideas?|suggestions?|projects?|recommendations?)\b/i,
      /\bhelp\s+me\s+(with|on)\b/i,
      /\bhow\s+(can|do)\s+I\s+(work on|build|create|make|set up)\b/i,
      /\bwhat\s+can\s+I\s+(do|work on|build|create)\b/i
    ],
    // Negative patterns - exclude vision commands and personal conversation
    negativePatterns: [
      /\b(open|start|turn on)\s+(the|my)\s+(camera|webcam)\b/i,
      /\b(look|see|view)\s+(at)?\s*(my|the|local)?\s*(camera|webcam|video feed)\b/i,
      /\b(take|capture|grab)\s+(a\s+)?(snapshot|photo|picture|image|pic)\s+(of|from|at)/i,
      /\bsnapshot\s+(of|from)\b/i,
      /\bwhat\s+(do you see|can you see|is in front of you)\b/i,
      /\bmy\s+(camera|webcam|local camera)\b/i,
      /\b(garage|front|back|rear|door|porch|yard)\s*(cam|camera)\b/i,
      // Exclude conversational/personal context after vision interactions
      /\bthis\s+(image|photo|picture|snapshot)\s+(is|was|shows)\b/i,
      /\b(my\s+garage|my\s+house|i'm\s+converting|i'm\s+cleaning|i'm\s+working)\b/i,
      /\b(i\s+do|i\s+am|i'm\s+trying|i\s+want|i\s+like|i\s+have)\s+\w+\s+(projects|woodworking|cleaning|organizing)\b/i,
      // Exclude vision memory recall patterns
      /\b(look|show|find|search)\s+(in|at|through)\s+(vision memory|vision memories|stored images)\b/i,
      /\b(do you remember|recall)\s+(the|that|my|seeing)\s*(image|photo|picture|snapshot|garage)\b/i,
      // Exclude personal routines and morning conversation
      /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i,
      /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning)\b/i,
      /\b(drinking|sipping)\s+(my|a)\s+(coffee|tea)\b/i,
      /\b(just|i'm)\s+(up|awake|starting)\b/i,
      /\bfiguring\s+(out|that)\s+(my|the|what|today)\b/i,
      /\b(i'm|i am)\s+(just|currently|still)\s+\w+ing\b/i,
      /\b(i|my)\s+(day|morning|afternoon|evening|routine)\b/i,
      /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking|here)\b/i,
      /\bsitting\s+here\b/i,
      /\bthinking\s+about\s+(it|that|things)\b/i,
      // Exclude JARVIS-related coding conversation
      /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis)\b/i,
      /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i,
      /\b(coding|programming|writing)\s+.*\s+(for|to)\s+(you|jarvis)\b/i
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
    confidence: 0.92,
    complexity: 0.2,
    patterns: [
      /^(save|remember|store|note|write down|record|log|add to memory)/i,
      /^(don't forget|never forget|make sure to remember|keep in mind)/i,
      /(my name is|i am|i live|i work|i prefer|i like|i want)/i,
      /(this is important|remember that|take note)/i,
      // Personal identification from images/vision memory
      /\b(that|this|the)\s+(image|photo|picture|snapshot|person)\s+(is|was)\s+(me|myself|i|my\s+\w+)\b/i,
      /\b(i am|i'm)\s+(the person|that person|in the|in that)\s+(image|photo|picture|snapshot)\b/i,
      /\b(that|the)\s+(image|photo|picture|snapshot)\s+(shows|is|has)\s+(me|myself)\b/i,
      // Image ownership statements
      /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)?\s*(the|my)?\s*(garage|house|room|office)\s+(is|was)\s+(my|our)\b/i,
      /\b(my|our)\s+(garage|house|room|office)\s+(is|was)\s+(in|shown in|depicted in)\s+(this|that|the)\s+(image|photo|picture|snapshot)\b/i,
      /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\b/i
    ],
    keywords: ['save', 'remember', 'store', 'note', 'record', 'log', 'forget', 'important', 'that is me', 'this is me', 'i am the person', 'my garage', 'my house', 'this image is']
  },
  
  // MEMORY_READ - Personal memory recall (NOT sensor data)
  {
    type: IntentType.MEMORY_READ,
    confidence: 0.92,
    complexity: 0.2,
    patterns: [
      /^(recall|what did|do you remember|what was|what have)/i,
      /^(where is|where are|where did|where was|where am i)/i,
      /^(what did i|what did we|what was the|what were the)/i,
      /^(tell me about|what do you know about|what can you tell me)/i,
      /\b(previously|before|earlier|last time|yesterday|last week|stored|saved)\b/i,
      // "What's my" only for personal info, not sensor data
      /what's my\s+(name|location|preference|setting|password)/i,
      // Vision memory recall - HIGH PRIORITY
      /\b(look|show|find|search|check)\s+(in|at|through|my|the)?\s*(vision memory|vision memories|stored images|saved photos)\b/i,
      /\b(show me|find|search|recall)\s+(my|the|past|previous|old)?\s*(images|photos|pictures|snapshots)\s+(of|from|in|my)?\b/i,
      /\b(look|see|check)\s+(for|at)?\s*(the|my)?\s*(image|photo|picture|snapshot)\s+(of|from|in|my)?\b/i,
      /\b(what|which)\s+(images|photos|pictures)\s+(did|have|was|do you have|did you save)\b/i,
      /\b(do you remember|recall)\s+(the|that|my|seeing)\s*(image|photo|picture|snapshot|garage|the garage)\b/i
    ],
    keywords: ['recall', 'remember', 'where', 'what did', 'previously', 'before', 'earlier', 'know about', 'stored', 'images', 'photos', 'pictures', 'vision memory', 'snapshots', 'look for', 'find image', 'see the image', 'vision'],
    // Strong negative patterns - reject sensor/data queries
    negativePatterns: [
      /\b(solar|energy|power|production|consumption|usage|sensor|device|entity|temperature|humidity|weather|stock|price|news)\b/i,
      /\b(current|now|today)\s+(solar|energy|power|temperature|weather)\b/i,
      /\b(producing|generating|consuming)\s+(solar|energy|power)\b/i,
      // But ALLOW vision memory + garage
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
    keywords: ['turn', 'toggle', 'switch', 'activate', 'enable', 'disable', 'open', 'close', 'lock', 'unlock', 'play', 'pause', 'stop', 'set', 'adjust', 'run', 'launch', 'increase', 'decrease', 'light', 'fan', 'thermostat'],
    // Negative patterns - exclude conversational context
    negativePatterns: [
      /\b(my\s+garage|my\s+house|this\s+image|this\s+photo)\s+(is|has|looks|was)\b/i,
      /\b(i'm|i am|i've been)\s+(converting|cleaning|organizing|working|renovating|building)\b/i,
      /\b(converting|cleaning|organizing)\s+(my|the)\s+(garage|house|room|space)\b/i
    ]
  },
  
  // SOCIAL - Conversational/social interactions (highest priority for natural responses)
  {
    type: IntentType.SOCIAL,
    confidence: 0.94,
    complexity: 0.1,
    patterns: [
      // Greeting with reciprocation expected
      /\b(how\s+are\s+you|how\s+you\s+doing|how's\s+it\s+going|how\s+are\s+things)\b/i,
      /\bhow're\s+you\b/i,
      /\bwhat's\s+up\b/i,
      /\bhow\s+you\s+been\b/i,
      // Shared experience (working on JARVIS together)
      /\b(working|coding|programming)\s+on\s+(you|your\s+code|jarvis|the\s+project)\b/i,
      /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis|your)\b/i,
      /\b(I've been|I have been)\s+(improving|updating|fixing|enhancing)\s+(you|your\s+code|jarvis)\b/i,
      /\bmaking\s+(you|jarvis)\s+(better|smarter|faster)\b/i,
      /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i,
      // Personal updates about user's space/projects (after vision interactions)
      /\bthis\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|the)\s+(garage|house|room|office|workshop)\b/i,
      /\b(my\s+garage|my\s+house|my\s+room|my\s+office|my\s+workshop)\s+(is|was|has)\b/i,
      /\b(i'm|i am|i've been)\s+(converting|cleaning|organizing|working on|renovating|building)\b/i,
      /\b(i\s+do|i\s+am|i'm|i\s+like|i\s+enjoy)\s+\w+\s*(projects|woodworking|cleaning|organizing|building|making)\b/i,
      /\b(trying|want|plan)\s+to\s+(clean|organize|convert|renovate|build|work on)\b/i,
      // Personal updates
      /\b(I've been|I have been|I was)\s+(working|coding|programming|developing)\s+on\b/i,
      /\b(I'm|I am)\s+(feeling|doing|been)\s+(good|great|well|tired|excited|stressed)\b/i,
      // Morning/routine conversation
      /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i,
      /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning|drink|cup)\b/i,
      /\b(coffee|tea|breakfast)\s+time\b/i,
      /\b(enjoying|drinking|sipping)\s+(my|a|some)\s+(coffee|tea|drink|breakfast)\b/i,
      /\b(cup\s+of)\s+(coffee|tea)\b/i,
      /\b(just|i'm)\s+(up|awake|starting|beginning)\b/i,
      /\bfiguring\s+(out|that)\s+(my|the|what|today|now)\b/i,
      /\b(i'm|i am)\s+(just|currently|still)\s+\w+ing\b/i,
      /\b(i|my)\s+(day|morning|afternoon|evening|routine|schedule)\b/i,
      /\b(i|i've|i have)\s+(slept|sleep)\b/i,
      /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking)\b/i,
      /\bsitting\s+here\b/i,
      /\bthinking\s+about\s+(it|that|things)\b/i,
      // Casual conversation
      /\b(i'm|i am)\s+(just|only|simply)\b/i,
      /\b(i|my|me)\s+(think|thought|wonder|wondering|guess|suppose)\b/i,
      /\b(let me|lemme|i'll)\s+(tell|share|say|explain)\b/i,
    ],
    keywords: ['how are you', 'how you doing', 'how is it going', 'working on you', 'working on jarvis', 'coding', 'your code', 'I have been', 'Ive been', 'my garage', 'my house', 'converting', 'cleaning', 'woodworking', 'projects', 'this image', 'my workshop'],
    // Negative patterns - exclude personal identification statements (should go to MEMORY_WRITE)
    negativePatterns: [
      /\b(that|this|the)\s+(image|photo|picture|snapshot|person)\s+(is|was)\s+(me|myself)\b/i,
      /\b(i am|i'm)\s+(the person|that person|in the|in that)\s+(image|photo|picture|snapshot)\b/i,
      /\b(that|the)\s+(image|photo|picture|snapshot)\s+(shows|is|has)\s+(me|myself)\b/i
    ]
  },
  
  // SIMPLE_QUERY - Common informational questions
  {
    type: IntentType.QUERY,
    confidence: 0.88,
    complexity: 0.3,
    patterns: [
      // Personal info queries
      /\bwhat('s| is)\s+your\s+name\b/i,
      /\b(do you|can you|will you)\s+(know|remember|recall)\s+(my\s+)?name\b/i,
      /\bwho\s+am\s+i\b/i,
      /\btell\s+me\s+about\s+yourself\b/i,
      /\bwhat\s+can\s+you\s+do\b/i,
      /\bwhat\s+time\s+is\s+(it|it now)\b/i,
      /\bwhat\s+day\s+is\s+(it|today)\b/i,
      // Ideas and suggestions
      /\b(can you|could you)\s+give\s+me\s+(some\s+)?(ideas?|suggestions?)/i,
      /\bwhat\s+(are|do)\s+you\s+(suggest|recommend)/i,
      /\b(ideas?|suggestions?)\s+(for|about|on)\b/i,
      // Weather (simple forms)
      /\bwhat('s|s| is)\s+(the\s+)?weather\b/i,
      /\bhow('s| is)\s+(the\s+)?weather\b/i,
      // Simple recommendations
      /\b(do you have|what are)\s+(any\s+)?recommendations\b/i,
      /\bwhat\s+(do you|should i)\s+(suggest|recommend)\b/i,
      /\bwhat\s+(can|should)\s+i\s+do\b/i
    ],
    keywords: ['your name', 'my name', 'who am i', 'what time', 'what day', 'weather', 'recommendations', 'suggest']
  },
  
  // QUERY - Catch-all for questions (lowest priority in patterns)
  {
    type: IntentType.QUERY,
    confidence: 0.70,
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
    
    // EARLY CHECK: Vision memory recall - high priority
    const isVisionMemoryQuery = /\b(look|show|find|search|check)\s+(in|at|through|for|my|the|into)?\s*(vision memory|vision memories|stored images|saved photos|image memory|visual memory)\b/i.test(normalized) ||
                                /\b(look|see|check)\s+(for|at)?\s*(the|my|any)?\s*(image|photo|picture|snapshot|snapshots)\s+(of|from|in|my|the)?\b/i.test(normalized) ||
                                /\b(do you remember|recall)\s+(the|that|my|seeing|any)?\s*(image|photo|picture|snapshot|garage|photos)\b/i.test(normalized) ||
                                /\b(current|previous|last|stored|saved)\s+(image|photo|picture|snapshot|photos)\b/i.test(normalized) ||
                                /\bimage\s+of\s+(my|the)\s+(garage|house|room|office|person|me)\b/i.test(normalized) ||
                                /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i.test(normalized);
    
    // EXCLUDE ownership/identification statements
    const isOwnershipStatement = /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i.test(normalized) ||
                                 /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i.test(normalized);
    
    if (isVisionMemoryQuery && !isOwnershipStatement) {
      const result: ParsedIntent = {
        type: IntentType.MEMORY_READ,
        confidence: 0.95,
        complexity: 0.2,
        suggestedProvider: 'OLLAMA',
        entities: this.extractEntities(normalized),
        reasoning: 'Vision memory recall detected - high priority'
      };
      this.cacheResult(normalized, result);
      return result;
    }
    
    // EARLY CHECK: Social conversation - prevent misclassification as HA query
    const isSocialConversation = /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i.test(normalized) ||
                                 /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning|drink|cup)\b/i.test(normalized) ||
                                 /\b(coffee|tea|breakfast)\s+time\b/i.test(normalized) ||
                                 /\b(enjoying|drinking|sipping)\s+(my|a|some)\s+(coffee|tea|drink|breakfast)\b/i.test(normalized) ||
                                 /\b(cup\s+of)\s+(coffee|tea)\b/i.test(normalized) ||
                                 /\b(just|i'm)\s+(up|awake|starting)\b/i.test(normalized) ||
                                 /\bfiguring\s+(out|that)\s+(my|the|what|today|now)\b/i.test(normalized) ||
                                 /\b(i'm|i am)\s+(just|currently|still)\s+\w+ing\b/i.test(normalized) ||
                                 /\b(good\s+morning|morning|evening|afternoon)\b/i.test(normalized) ||
                                 /\b(i'm|i am)\s+(just|only|simply)\b/i.test(normalized) ||
                                 /\b(i|my)\s+(think|thought|wonder|wondering|guess|suppose)\b/i.test(normalized) ||
                                 /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking)\b/i.test(normalized) ||
                                 /\bsitting\s+here\b/i.test(normalized) ||
                                 /\bthinking\s+about\s+(it|that|things)\b/i.test(normalized) ||
                                 /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis)\b/i.test(normalized) ||
                                 /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i.test(normalized);
    
    if (isSocialConversation) {
      const result: ParsedIntent = {
        type: IntentType.SOCIAL,
        confidence: 0.94,
        complexity: 0.1,
        suggestedProvider: 'OLLAMA',
        entities: this.extractEntities(normalized),
        reasoning: 'Social conversation detected - personal routine/update'
      };
      this.cacheResult(normalized, result);
      return result;
    }
    
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
    
    // NEVER use Gemini for vision memory queries - handle locally
    const isVisionMemoryQuery = /\b(look|show|find|search|check)\s+(in|at|through|for|my|the|into)?\s*(vision memory|vision memories|stored images|saved photos|image memory|visual memory)\b/i.test(normalized) ||
                                /\b(look|see|check)\s+(for|at)?\s*(the|my|any)?\s*(image|photo|picture|snapshot|snapshots)\s+(of|from|in|my|the)?\b/i.test(normalized) ||
                                /\b(do you remember|recall)\s+(the|that|my|seeing|any)?\s*(image|photo|picture|snapshot|garage|photos)\b/i.test(normalized) ||
                                /\b(current|previous|last|stored|saved)\s+(image|photo|picture|snapshot|photos)\b/i.test(normalized) ||
                                /\bimage\s+of\s+(my|the)\s+(garage|house|room|office|person|me)\b/i.test(normalized) ||
                                /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i.test(normalized);
    
    // EXCLUDE ownership/identification statements
    const isOwnershipStatement = /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i.test(normalized) ||
                                 /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i.test(normalized);
    
    if (isVisionMemoryQuery && !isOwnershipStatement) {
      return false; // Handle vision memory locally
    }
    
    // NEVER use Gemini for social conversation - handle locally
    const isSocialConversation = /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i.test(normalized) ||
                                 /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning|drink|cup)\b/i.test(normalized) ||
                                 /\b(coffee|tea|breakfast)\s+time\b/i.test(normalized) ||
                                 /\b(enjoying|drinking|sipping)\s+(my|a|some)\s+(coffee|tea|drink|breakfast)\b/i.test(normalized) ||
                                 /\b(cup\s+of)\s+(coffee|tea)\b/i.test(normalized) ||
                                 /\b(just|i'm)\s+(up|awake|starting)\b/i.test(normalized) ||
                                 /\bfiguring\s+(out|that)\s+(my|the|what|today|now)\b/i.test(normalized) ||
                                 /\b(i'm|i am)\s+(just|currently|still)\s+\w+ing\b/i.test(normalized) ||
                                 /\b(good\s+morning|morning|evening|afternoon)\b/i.test(normalized) ||
                                 /\b(i'm|i am)\s+(just|only|simply)\b/i.test(normalized) ||
                                 /\b(i|my)\s+(think|thought|wonder|wondering|guess|suppose)\b/i.test(normalized) ||
                                 /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking)\b/i.test(normalized) ||
                                 /\bsitting\s+here\b/i.test(normalized) ||
                                 /\bthinking\s+about\s+(it|that|things)\b/i.test(normalized) ||
                                 /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis)\b/i.test(normalized) ||
                                 /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i.test(normalized);
    
    if (isSocialConversation) {
      return false; // Handle social conversation locally
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
