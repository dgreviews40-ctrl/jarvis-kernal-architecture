/**
 * Smart Context Router v1.0
 * 
 * Automatically routes queries to the appropriate data source:
 * - Personal information (name, hobbies, preferences) → Memory
 * - Device/sensor data (temperature, lights, status) → Home Assistant
 * - General knowledge → AI's training data
 * 
 * This eliminates the need for users to explicitly specify where to look.
 */

import { vectorMemoryService } from './vectorMemoryService';
import { localVectorDB } from './localVectorDB';
import { haService, HAEntity } from './home_assistant';
import { searchEntities, generateEntityResponse } from './haEntitySearch';
import { logger } from './logger';

// Query type classification
export type QueryDomain = 'PERSONAL' | 'DEVICE' | 'SENSOR' | 'GENERAL' | 'AMBIGUOUS';

export interface QueryClassification {
  domain: QueryDomain;
  confidence: number;
  reasoning: string;
  suggestedAction: 'CHECK_MEMORY' | 'CHECK_HA' | 'CHECK_BOTH' | 'NONE';
  keyTerms: string[];
}

export interface EnrichedContext {
  personalContext?: string;
  deviceContext?: string;
  sensorData?: HAEntity[];
  hasRelevantData: boolean;
  source: 'memory' | 'home_assistant' | 'both' | 'none';
}

// Keywords for classification
const PERSONAL_KEYWORDS = {
  identity: ['my name', 'who am i', 'i am', 'i\'m', 'call me', 'known as', 'my identity'],
  hobbies: ['hobby', 'hobbies', 'like to', 'enjoy', 'interested in', 'passion', 'favorite activity', 'spare time', 'free time', 'for fun'],
  preferences: ['favorite', 'prefer', 'like', 'love', 'enjoy', 'hate', 'dislike', 'my taste', 'i want', 'i need'],
  personal_history: ['my birthday', 'my age', 'where i', 'i live', 'my address', 'my job', 'i work', 'my family', 'my wife', 'my husband', 'my kids', 'my children', 'my pet', 'my dog', 'my cat'],
  memories: ['remember when', 'what did i', 'yesterday', 'last week', 'last month', 'i told you', 'i said', 'we discussed', 'i mentioned', 'remind me'],
  facts: ['my', 'i have', 'i own', 'i drive', 'my car', 'my phone', 'my computer']
};

const DEVICE_KEYWORDS = {
  control: ['turn on', 'turn off', 'toggle', 'switch', 'enable', 'disable', 'activate', 'deactivate', 'start', 'stop', 'open', 'close', 'lock', 'unlock'],
  devices: ['light', 'lights', 'lamp', 'switch', 'outlet', 'plug', 'fan', 'thermostat', 'ac', 'heater', 'climate', 'lock', 'door', 'garage', 'cover', 'blind', 'curtain', 'camera'],
  sensors: ['temperature', 'humidity', 'pressure', 'motion', 'occupancy', 'light level', 'brightness', 'power', 'energy', 'voltage', 'current', 'battery'],
  media: ['tv', 'television', 'speaker', 'media player', 'spotify', 'music', 'play', 'pause', 'volume', 'mute'],
  // Only match specific device/sensor status queries - NOT general "conditions"
  status: ['status of', 'state of', 'is the', 'are the', 'what is the', 'how is the', 'tell me the', 'show me the', 'readout', 'sensor reading']
};

// Keywords that indicate this is NOT a device/sensor query (general knowledge topics)
const GENERAL_KNOWLEDGE_PATTERNS = [
  /\b(growing|plant|hydroponic|aquaponic|garden|crop|seedling|nutrient)\b/i,
  /\b(weather forecast|climate zone|hardiness zone|growing zone)\b/i,
  /\b(recipe|cooking|bake|cook|ingredient|cuisine)\b/i,
  /\b(exercise|workout|fitness|health tip|nutrition|diet)\b/i,
  /\b(history of|historical|ancient|century|decade|era|period)\b/i,
  /\b(science|physics|chemistry|biology|scientific)\b/i
];

/**
 * Classify a query to determine which domain it belongs to
 */
export function classifyQuery(input: string): QueryClassification {
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/);
  
  // First check if this is clearly a general knowledge query
  for (const pattern of GENERAL_KNOWLEDGE_PATTERNS) {
    if (pattern.test(input)) {
      return {
        domain: 'GENERAL',
        confidence: 0.9,
        reasoning: `Detected general knowledge topic matching pattern: ${pattern.source}`,
        suggestedAction: 'NONE',
        keyTerms: ['general_knowledge']
      };
    }
  }
  
  let personalScore = 0;
  let deviceScore = 0;
  let sensorScore = 0;
  const matchedTerms: string[] = [];
  
  // Check personal keywords
  for (const [category, keywords] of Object.entries(PERSONAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        personalScore += (category === 'identity') ? 3 : (category === 'memories') ? 2.5 : 2;
        matchedTerms.push(keyword);
      }
    }
  }
  
  // Check device keywords
  for (const [category, keywords] of Object.entries(DEVICE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        if (category === 'sensors' || category === 'status') {
          sensorScore += 2;
        } else {
          deviceScore += 2;
        }
        matchedTerms.push(keyword);
      }
    }
  }
  
  // Additional heuristics
  
  // Strong personal indicators
  if (/\bmy\s+\w+\s+(is|are|was|were)\b/i.test(input)) {
    personalScore += 3;
    matchedTerms.push('my_X_is_pattern');
  }
  
  // Direct questions about the user
  if (/\b(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did)\s+(i|my|me)\b/i.test(input)) {
    personalScore += 2;
    matchedTerms.push('question_about_user');
  }
  
  // Device control patterns
  if (/\b(turn|switch|toggle|enable|disable)\s+(on|off)\b/i.test(input)) {
    deviceScore += 3;
    matchedTerms.push('control_pattern');
  }
  
  // Sensor query patterns - require BOTH a status keyword AND a sensor keyword
  const hasStatusKeyword = /\b(tell me|what is|how is|what's the|show me|current)\b/i.test(input);
  const hasSensorType = /\b(temp|temperature|humidity|pressure|motion|occupancy|light level|brightness|power|energy|voltage|battery)\b/i.test(input);
  if (hasStatusKeyword && hasSensorType) {
    sensorScore += 3;
    matchedTerms.push('sensor_query_pattern');
  }
  
  // Determine domain
  let domain: QueryDomain;
  let suggestedAction: QueryClassification['suggestedAction'];
  let confidence: number;
  let reasoning: string;
  
  const maxScore = Math.max(personalScore, deviceScore, sensorScore);
  const totalScore = personalScore + deviceScore + sensorScore;
  
  if (maxScore === 0) {
    domain = 'GENERAL';
    suggestedAction = 'NONE';
    confidence = 0.9;
    reasoning = 'No specific personal or device keywords detected. Treating as general knowledge query.';
  } else if (personalScore > deviceScore && personalScore > sensorScore) {
    domain = 'PERSONAL';
    suggestedAction = 'CHECK_MEMORY';
    confidence = Math.min(0.95, 0.5 + (personalScore / 10));
    reasoning = `Detected personal information query (score: ${personalScore}). Checking memory for user data.`;
  } else if (sensorScore > personalScore && sensorScore > deviceScore) {
    domain = 'SENSOR';
    suggestedAction = 'CHECK_HA';
    confidence = Math.min(0.95, 0.5 + (sensorScore / 10));
    reasoning = `Detected sensor data query (score: ${sensorScore}). Checking Home Assistant for readings.`;
  } else if (deviceScore > personalScore) {
    domain = 'DEVICE';
    suggestedAction = 'CHECK_HA';
    confidence = Math.min(0.95, 0.5 + (deviceScore / 10));
    reasoning = `Detected device control/status query (score: ${deviceScore}). Checking Home Assistant.`;
  } else if (Math.abs(personalScore - Math.max(deviceScore, sensorScore)) <= 1) {
    domain = 'AMBIGUOUS';
    suggestedAction = 'CHECK_BOTH';
    confidence = 0.6;
    reasoning = `Query could be personal or device-related. Checking both sources.`;
  } else {
    domain = 'GENERAL';
    suggestedAction = 'NONE';
    confidence = 0.7;
    reasoning = 'Unclear domain. Treating as general query.';
  }
  
  return {
    domain,
    confidence,
    reasoning,
    suggestedAction,
    keyTerms: [...new Set(matchedTerms)]
  };
}

/**
 * Fetch personal context from memory systems
 */
export async function fetchPersonalContext(query: string): Promise<string | null> {
  try {
    const lowerQuery = query.toLowerCase();
    
    // Check for identity-specific queries
    const isIdentityQuery = /\b(my name|who am i|what is my name)\b/i.test(query);
    if (isIdentityQuery) {
      const identity = await vectorMemoryService.getUserIdentity();
      if (identity) {
        logger.log('KERNEL', `Retrieved identity for query: "${query.substring(0, 30)}..."`, 'info');
        return identity.content;
      }
      return null;
    }
    
    // Check for hobby-related queries
    const isHobbyQuery = /\b(hobby|hobbies|like to|enjoy doing|free time|for fun)\b/i.test(query);
    if (isHobbyQuery) {
      const hobbies = await vectorMemoryService.getUserHobbies();
      if (hobbies.length > 0) {
        const hobbyContent = hobbies.map(h => h.content).join('; ');
        logger.log('KERNEL', `Retrieved ${hobbies.length} hobbies`, 'info');
        return hobbyContent;
      }
    }
    
    // General memory search with semantic relevance
    const memories = await vectorMemoryService.recall(query, 3);
    if (memories.length > 0) {
      // Filter to only include highly relevant memories
      const relevantMemories = memories.filter(m => m.score > 0.6);
      if (relevantMemories.length > 0) {
        const memoryContent = relevantMemories.map(m => m.node.content).join('\n');
        logger.log('KERNEL', `Retrieved ${relevantMemories.length} relevant memories`, 'info');
        return memoryContent;
      }
    }
    
    // Try local vector DB as fallback
    const localResults = await localVectorDB.search(query, { maxResults: 3, minScore: 0.65 });
    if (localResults.length > 0) {
      const localContent = localResults.map(r => r.node.content).join('\n');
      logger.log('KERNEL', `Retrieved ${localResults.length} results from local vector DB`, 'info');
      return localContent;
    }
    
    return null;
  } catch (error) {
    logger.log('KERNEL', `Error fetching personal context: ${(error as Error).message}`, 'error');
    return null;
  }
}

/**
 * Check if Home Assistant is actually configured and reachable
 */
function isHAConfigured(): boolean {
  // Check if HA service is initialized AND has valid config
  if (!haService.initialized) {
    return false;
  }
  
  // Check if we have actual entity data (not just empty state)
  try {
    const entities = haService.getAllEntities();
    return entities.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch device/sensor context from Home Assistant
 */
export async function fetchDeviceContext(query: string): Promise<{ context: string | null; entities: HAEntity[] }> {
  if (!isHAConfigured()) {
    logger.log('KERNEL', 'Home Assistant not configured or no entities available', 'info');
    return { context: null, entities: [] };
  }
  
  try {
    const searchResult = await searchEntities(query, {
      maxResults: 5,
      minScore: 5,
      fetchFresh: true
    });
    
    if (searchResult.matches.length > 0) {
      const context = generateEntityResponse(query, searchResult);
      logger.log('KERNEL', `Retrieved ${searchResult.matches.length} Home Assistant entities`, 'info');
      return { context, entities: searchResult.matches.map(m => m.entity) };
    }
    
    return { context: null, entities: [] };
  } catch (error) {
    // Don't log as error if HA is just not configured - this is expected
    const errorMsg = (error as Error).message;
    if (errorMsg.includes('not configured') || errorMsg.includes('Failed to fetch')) {
      logger.log('KERNEL', 'Home Assistant fetch skipped - not configured', 'info');
    } else {
      logger.log('KERNEL', `Error fetching device context: ${errorMsg}`, 'error');
    }
    return { context: null, entities: [] };
  }
}

/**
 * Main entry point: enrich a query with relevant context
 */
export async function enrichQueryWithContext(
  query: string,
  options: { checkMemory?: boolean; checkHA?: boolean } = {}
): Promise<{ enrichedPrompt: string; systemContext: string; enrichedContext: EnrichedContext }> {
  const classification = classifyQuery(query);
  
  logger.log('KERNEL', 
    `Query classified as ${classification.domain} (conf: ${(classification.confidence * 100).toFixed(0)}%). Action: ${classification.suggestedAction}`,
    'info'
  );
  
  const enrichedContext: EnrichedContext = {
    hasRelevantData: false,
    source: 'none'
  };
  
  let personalContext: string | null = null;
  let deviceContext: string | null = null;
  
  // Determine which sources to check
  const shouldCheckMemory = options.checkMemory !== false && 
    (classification.suggestedAction === 'CHECK_MEMORY' || classification.suggestedAction === 'CHECK_BOTH');
  
  const shouldCheckHA = options.checkHA !== false && 
    (classification.suggestedAction === 'CHECK_HA' || classification.suggestedAction === 'CHECK_BOTH');
  
  // Fetch personal context if needed
  if (shouldCheckMemory) {
    personalContext = await fetchPersonalContext(query);
    if (personalContext) {
      enrichedContext.personalContext = personalContext;
      enrichedContext.hasRelevantData = true;
      enrichedContext.source = enrichedContext.source === 'none' ? 'memory' : 'both';
    }
  }
  
  // Fetch device context if needed
  if (shouldCheckHA) {
    const deviceResult = await fetchDeviceContext(query);
    if (deviceResult.context) {
      deviceContext = deviceResult.context;
      enrichedContext.deviceContext = deviceContext;
      enrichedContext.sensorData = deviceResult.entities;
      enrichedContext.hasRelevantData = true;
      enrichedContext.source = enrichedContext.source === 'none' ? 'home_assistant' : 'both';
    }
  }
  
  // Build enriched prompt and system context
  let enrichedPrompt = query;
  let systemContext = '';
  
  if (personalContext) {
    systemContext += `\n\n[USER PERSONAL INFORMATION]\n${personalContext}\n\nWhen answering, use this personal information if relevant. If the user is asking about something not in this context, you can say you don't have that information yet.`;
  }
  
  if (deviceContext) {
    if (classification.domain === 'SENSOR' || classification.domain === 'DEVICE') {
      // For direct sensor/device queries, the context IS the answer
      enrichedPrompt = `${query}\n\n[AVAILABLE DATA]\n${deviceContext}\n\nBased on the above data, answer the user's question concisely.`;
    } else {
      systemContext += `\n\n[HOME ASSISTANT DATA]\n${deviceContext}`;
    }
  }
  
  return { enrichedPrompt, systemContext, enrichedContext };
}

/**
 * Quick check if a query likely needs context enrichment
 */
export function shouldEnrichContext(input: string): boolean {
  const classification = classifyQuery(input);
  return classification.suggestedAction !== 'NONE' && classification.confidence > 0.5;
}

/**
 * Get explanation of why certain context was fetched (for debugging)
 */
export function getRoutingExplanation(query: string): string {
  const classification = classifyQuery(query);
  return `
Query: "${query}"
Domain: ${classification.domain}
Confidence: ${(classification.confidence * 100).toFixed(0)}%
Action: ${classification.suggestedAction}
Key Terms: ${classification.keyTerms.join(', ') || 'None'}
Reasoning: ${classification.reasoning}
  `.trim();
}

// Export singleton
export const smartContextRouter = {
  classifyQuery,
  fetchPersonalContext,
  fetchDeviceContext,
  enrichQueryWithContext,
  shouldEnrichContext,
  getRoutingExplanation
};
