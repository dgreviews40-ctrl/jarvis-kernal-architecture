/**
 * Home Assistant Entity Search Service
 * 
 * Provides semantic search across all HA entities to find relevant sensors
 * for any natural language query (air quality, 3D printer time, etc.)
 */

import { HAEntity, haService } from './home_assistant';
import { isEntityEnabled, getEnabledEntityIds, getMode } from './haEntityWhitelist';

export interface EntityMatch {
  entity: HAEntity;
  score: number;
  matchReason: string;
}

export interface EntitySearchResult {
  matches: EntityMatch[];
  query: string;
  totalEntities: number;
  searchTimeMs: number;
}

/**
 * Semantic entity categories and their associated keywords
 * Used to match natural language queries to entity types
 */
const ENTITY_CATEGORIES: Record<string, {
  keywords: string[];
  domains: string[];
  excludePatterns: RegExp[];
}> = {
  air_quality: {
    keywords: ['air', 'quality', 'aqi', 'pm2.5', 'pm10', 'co2', 'co²', 'carbon', 'dioxide', 'voc', 'volatile', 'organic', 'compound', 'pollution', 'pollutant', 'ozone', 'no2', 'nitrogen'],
    domains: ['sensor', 'air_quality'],
    excludePatterns: [/weather/, /forecast/, /outside/]
  },
  solar_energy: {
    keywords: ['solar', 'sore', 'soar', 'sun', 'pv', 'photovoltaic', 'inverter', 'production', 'generation', 'panel'],
    domains: ['sensor'],
    excludePatterns: [/forecast/, /prediction/, /estimated/, /tomorrow/]
  },
  power_usage: {
    keywords: ['power', 'watt', 'watts', 'kw', 'kilowatt', 'consumption', 'usage', 'draw', 'load'],
    domains: ['sensor', 'switch', 'light'],
    excludePatterns: [/battery/, /backup/]
  },
  energy: {
    keywords: ['energy', 'kwh', 'kilowatt.hour', 'electricity', 'grid', 'export', 'import', 'meter'],
    domains: ['sensor'],
    excludePatterns: [/forecast/]
  },
  temperature: {
    keywords: ['temperature', 'temp', 'hot', 'cold', 'warm', 'heat', 'thermostat', 'climate'],
    domains: ['sensor', 'climate'],
    excludePatterns: [/weather/, /forecast/]
  },
  humidity: {
    keywords: ['humidity', 'humid', 'moisture', 'damp', 'dry'],
    domains: ['sensor'],
    excludePatterns: [/weather/, /forecast/]
  },
  printer_3d: {
    keywords: ['printer', '3d', 'print', 'ender', 'prus', 'bambu', 'voron', 'klipper', 'octoprint', 'progress', 'remaining', 'time', 'percent'],
    domains: ['sensor', 'binary_sensor'],
    excludePatterns: [/paper/, /ink/, /laser/]
  },
  battery: {
    keywords: ['battery', 'charge', 'charging', 'discharge', 'level', 'percent'],
    domains: ['sensor', 'binary_sensor'],
    excludePatterns: [/backup/, /ups/]
  },
  motion: {
    keywords: ['motion', 'movement', 'detected', 'presence', 'occupancy', 'occupied'],
    domains: ['binary_sensor', 'sensor'],
    excludePatterns: []
  },
  door_window: {
    keywords: ['door', 'window', 'open', 'closed', 'contact', 'entry'],
    domains: ['binary_sensor', 'sensor'],
    excludePatterns: [/garage/, /gate/]
  },
  water: {
    keywords: ['water', 'leak', 'flood', 'moisture', 'wet', 'damp'],
    domains: ['binary_sensor', 'sensor'],
    excludePatterns: []
  },
  smoke_co: {
    keywords: ['smoke', 'co', 'carbon monoxide', 'fire', 'alarm', 'detector'],
    domains: ['binary_sensor', 'sensor'],
    excludePatterns: []
  },
  light: {
    keywords: ['light', 'brightness', 'lux', 'lumen', 'illumination', 'daylight'],
    domains: ['sensor', 'light'],
    excludePatterns: [/switch/, /outlet/]
  },
  pressure: {
    keywords: ['pressure', 'barometer', 'barometric', 'atmospheric'],
    domains: ['sensor'],
    excludePatterns: [/blood/, /weather/]
  },
  weather: {
    keywords: ['weather', 'rain', 'precipitation', 'uv', 'index', 'wind', 'speed', 'direction', 'solar radiation'],
    domains: ['sensor', 'weather'],
    excludePatterns: []
  },
  network: {
    keywords: ['network', 'wifi', 'internet', 'ping', 'latency', 'speed', 'bandwidth', 'download', 'upload'],
    domains: ['sensor', 'binary_sensor'],
    excludePatterns: []
  },
  system: {
    keywords: ['cpu', 'memory', 'ram', 'disk', 'storage', 'load', 'uptime', 'temperature'],
    domains: ['sensor'],
    excludePatterns: [/room/, /ambient/]
  }
};

/**
 * Extract search terms from natural language query
 * Preserves location context (inside/outside) for better matching
 */
function extractSearchTerms(query: string): string[] {
  const lower = query.toLowerCase();
  
  // Remove common filler words but PRESERVE location indicators
  const normalized = lower
    .replace(/\bwhat('s| is)\b/g, '')
    .replace(/\btell me\b/g, '')
    .replace(/\bhow much\b/g, '')
    .replace(/\bcurrent\b/g, '')
    // Don't remove 'my' or 'in my' - they're important for location context
    .replace(/\bthe\b/g, '')
    .replace(/\bjarvis\b/g, '')
    .trim();
  
  // Extract meaningful terms
  const terms: string[] = [];
  
  // Check for category matches
  for (const [category, config] of Object.entries(ENTITY_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (lower.includes(keyword)) {
        terms.push(category);
        terms.push(keyword);
        break;
      }
    }
  }
  
  // Add location-specific terms
  if (/\b(inside|indoor|interior|in my house|in my home)\b/.test(lower)) {
    terms.push('inside', 'indoor', 'interior', 'house', 'home');
  }
  if (/\b(outside|outdoor|exterior|outdoors)\b/.test(lower)) {
    terms.push('outside', 'outdoor', 'exterior', 'outdoors', 'weather');
  }
  
  // Add remaining significant words
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  terms.push(...words);
  
  return [...new Set(terms)]; // Remove duplicates
}

/**
 * Extract location context from query (inside/outside/indoor/outdoor/etc)
 */
function extractLocationContext(query: string): { 
  isInside: boolean; 
  isOutside: boolean; 
  locationTerms: string[];
} {
  const lower = query.toLowerCase();
  
  // Check for inside/indoor/house/home keywords
  const insidePatterns = /\b(inside|indoor|in my house|in my home|in the house|indoors|interior)\b/;
  const isInside = insidePatterns.test(lower);
  
  // Check for outside/outdoor/external keywords  
  const outsidePatterns = /\b(outside|outdoor|outdoors|exterior|external|out there)\b/;
  const isOutside = outsidePatterns.test(lower);
  
  // Extract specific location terms
  const locationTerms: string[] = [];
  
  if (isInside) {
    locationTerms.push('inside', 'indoor', 'interior', 'house', 'home', 'room');
  }
  if (isOutside) {
    locationTerms.push('outside', 'outdoor', 'exterior', 'external', 'outdoors', 'weather');
  }
  
  // Also check for specific room/area names
  const roomMatch = lower.match(/\b(in|at)\s+(my|the)\s+(\w+)/);
  if (roomMatch) {
    locationTerms.push(roomMatch[3].toLowerCase());
  }
  
  return { isInside, isOutside, locationTerms };
}

/**
 * Calculate semantic similarity score between query and entity
 */
function calculateEntityScore(
  entity: HAEntity, 
  searchTerms: string[], 
  originalQuery: string
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  
  const name = (entity.attributes?.friendly_name || '').toLowerCase();
  const entityId = entity.entity_id.toLowerCase();
  const domain = entity.entity_id.split('.')[0];
  const state = (entity.state || '').toLowerCase();
  
  const originalLower = originalQuery.toLowerCase();
  
  // Extract location context
  const locationContext = extractLocationContext(originalQuery);
  
  // Score based on entity name matches
  for (const term of searchTerms) {
    // Exact name match (highest priority)
    if (name === term) {
      score += 25;
      reasons.push(`exact name match: ${term}`);
    }
    // Name contains term
    else if (name.includes(term)) {
      score += 15;
      reasons.push(`name contains: ${term}`);
    }
    // Entity ID contains term
    else if (entityId.includes(term)) {
      score += 8;
      reasons.push(`entity ID contains: ${term}`);
    }
  }
  
  // Location context scoring - CRITICAL for inside/outside differentiation
  if (locationContext.isInside || locationContext.isOutside) {
    const idAndName = `${entityId} ${name}`;
    
    // Check for matching location indicators in entity name/ID
    let locationMatchScore = 0;
    let matchedTerms: string[] = [];
    
    for (const term of locationContext.locationTerms) {
      if (idAndName.includes(term)) {
        locationMatchScore += 15; // High bonus for location match
        matchedTerms.push(term);
      }
    }
    
    if (locationMatchScore > 0) {
      score += locationMatchScore;
      reasons.push(`location match: ${matchedTerms.join(', ')}`);
    }
    
    // PENALTY for opposite location
    if (locationContext.isInside) {
      // Penalize outdoor/outside sensors when asking for inside
      const outsideIndicators = /\b(outdoor|outside|exterior|weather|garden|backyard)\b/;
      if (outsideIndicators.test(idAndName)) {
        score -= 20;
        reasons.push('penalty: outside sensor for inside query');
      }
    }
    
    if (locationContext.isOutside) {
      // Penalize indoor/room sensors when asking for outside
      const insideIndicators = /\b(indoor|inside|interior|room|living|bedroom|kitchen|office)\b/;
      if (insideIndicators.test(idAndName)) {
        score -= 20;
        reasons.push('penalty: inside sensor for outside query');
      }
    }
    
    // Check area/room attributes
    const area = (entity.attributes?.area || '').toLowerCase();
    const room = (entity.attributes?.room || '').toLowerCase();
    for (const term of locationContext.locationTerms) {
      if (area.includes(term) || room.includes(term)) {
        score += 12;
        reasons.push(`area/room attribute match: ${term}`);
      }
    }
  }
  
  // Domain relevance scoring
  for (const [category, config] of Object.entries(ENTITY_CATEGORIES)) {
    const matchesCategory = searchTerms.some(term => 
      config.keywords.includes(term) || term === category
    );
    
    if (matchesCategory && config.domains.includes(domain)) {
      score += 5;
      reasons.push(`domain match: ${domain}`);
      
      // Check exclude patterns
      const idAndName = `${entityId} ${name}`;
      const isExcluded = config.excludePatterns.some(pattern => 
        pattern.test(idAndName)
      );
      
      if (isExcluded) {
        score -= 15;
        reasons.push('excluded by pattern');
      }
    }
  }
  
  // State quality scoring
  if (state && state !== 'unknown' && state !== 'unavailable' && state !== '') {
    score += 3;
    reasons.push('valid state');
  } else if (state === 'unknown' || state === 'unavailable') {
    score -= 5;
    reasons.push('unavailable state');
  }
  
  // Unit of measurement bonus (indicates numeric sensor)
  if (entity.attributes?.unit_of_measurement) {
    score += 2;
    reasons.push('has units');
  }
  
  // Device class bonus (well-defined sensor type)
  if (entity.attributes?.device_class) {
    score += 3;
    reasons.push(`device class: ${entity.attributes.device_class}`);
  }
  
  // Penalize diagnostic/technical entities
  if (entityId.includes('diagnostic') || name.includes('diagnostic')) {
    score -= 10;
    reasons.push('diagnostic entity');
  }
  
  // Penalize configuration entities
  if (entityId.includes('config') || name.includes('configuration')) {
    score -= 8;
    reasons.push('config entity');
  }
  
  return {
    score: Math.max(0, score),
    reason: reasons.join(', ')
  };
}

/**
 * Search Home Assistant entities based on natural language query
 * Respects the entity whitelist - only searches enabled entities
 */
export async function searchEntities(
  query: string,
  options: {
    maxResults?: number;
    minScore?: number;
    fetchFresh?: boolean;
    respectWhitelist?: boolean; // New option to control whitelist behavior
  } = {}
): Promise<EntitySearchResult> {
  const startTime = performance.now();
  const { maxResults = 5, minScore = 5, fetchFresh = true, respectWhitelist = true } = options;
  
  // Ensure HA service is initialized
  if (!haService.initialized) {
    throw new Error('Home Assistant service not initialized');
  }
  
  // Fetch fresh entities if requested
  if (fetchFresh) {
    await haService.fetchEntities();
  }
  
  // Get all entities from the service
  const allEntities = Array.from((haService as any).entities.values()) as HAEntity[];
  
  // Filter by whitelist if enabled
  let searchableEntities = allEntities;
  if (respectWhitelist) {
    const mode = getMode();
    if (mode === 'whitelist') {
      // Only search explicitly enabled entities
      searchableEntities = allEntities.filter(e => isEntityEnabled(e.entity_id));
    } else if (mode === 'blacklist') {
      // Exclude explicitly disabled entities
      searchableEntities = allEntities.filter(e => isEntityEnabled(e.entity_id));
    }
    // mode === 'all': search everything
  }
  
  // Extract search terms from query
  const searchTerms = extractSearchTerms(query);
  
  // Score all searchable entities
  const matches: EntityMatch[] = searchableEntities
    .map(entity => {
      const { score, reason } = calculateEntityScore(entity, searchTerms, query);
      return {
        entity,
        score,
        matchReason: reason
      };
    })
    .filter(match => match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  const searchTimeMs = performance.now() - startTime;
  
  return {
    matches,
    query,
    totalEntities: searchableEntities.length,
    searchTimeMs
  };
}

/**
 * Format entity value for display
 */
export function formatEntityValue(entity: HAEntity): string {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const state = entity.state || 'unknown';
  const unit = entity.attributes?.unit_of_measurement || '';

  // Handle temperature conversion from Celsius to Fahrenheit
  if (unit === '°C' && !isNaN(parseFloat(state))) {
    const celsius = parseFloat(state);
    const fahrenheit = (celsius * 9/5) + 32;
    return `${name}: ${Math.round(fahrenheit)} °F`;
  }

  // Format numeric values
  if (!isNaN(parseFloat(state))) {
    const num = parseFloat(state);
    // Format based on magnitude
    if (Math.abs(num) >= 1000000) {
      return `${name}: ${(num / 1000000).toFixed(2)} M${unit}`;
    } else if (Math.abs(num) >= 1000) {
      return `${name}: ${(num / 1000).toFixed(2)} k${unit}`;
    } else {
      return `${name}: ${num.toFixed(2)} ${unit}`.trim();
    }
  }
  
  // Format binary states
  if (state === 'on' || state === 'off') {
    const icon = state === 'on' ? '●' : '○';
    return `${name}: ${icon} ${state.toUpperCase()}`;
  }
  
  // Default formatting
  return `${name}: ${state}${unit ? ' ' + unit : ''}`;
}

/**
 * Check if a query is likely asking about a Home Assistant entity
 */
export function isHomeAssistantQuery(query: string): boolean {
  const lower = query.toLowerCase();
  
  // EXCLUDE vision/camera commands - these should go to VISION_ANALYSIS
  const visionPatterns = [
    /\b(take|capture|grab)\s+(a\s+)?(snapshot|photo|picture|image|pic)\b/,
    /\b(open|start|turn on)\s+(the|my)\s+(camera|webcam)\b/,
    /\b(look|see|view)\s+(at)?\s*(my|the|local)?\s*(camera|webcam|video feed)\b/,
    /\bwhat\s+(do you see|can you see|is in front of you)\b/,
    /\b(my|local)\s+(camera|webcam)\b/,
    /\bsnapshot\b/,
    // Exclude vision memory recall - BROADER PATTERNS
    /\b(look|show|find|search|check)\s+(in|at|through|for|my|the|into)?\s*(vision memory|vision memories|stored images|saved photos|image memory|visual memory)\b/i,
    /\b(look|see|check)\s+(for|at)?\s*(the|my|any)?\s*(image|photo|picture|snapshot|snapshots)\s+(of|from|in|my|the)?\b/i,
    /\b(do you remember|recall)\s+(the|that|my|seeing|any)?\s*(image|photo|picture|snapshot|garage|photos)\b/i,
    /\b(current|previous|last|stored|saved)\s+(image|photo|picture|snapshot|photos)\b/i,
    /\bimage\s+of\s+(my|the)\s+(garage|house|room|office|person|me|someone)\b/i,
    /\b(garage|house)\s+(image|photo|picture|snapshot)\b/i,
    /\bvision\s+(memory|memories)\b/i,
    /\brecall\s+(the|my|that|an)?\s*(image|photo|picture|snapshot|garage)\b/i,
    /\b(who|what|which)\s+(is|was)\s+(the person|that person|in|the)\s+(image|photo|picture|snapshot)\b/i,
    /\b(that|this|the)\s+(image|photo|picture|snapshot|person)\s+(is|was)\s+(me|myself)\b/i,
    // Exclude ownership/identification statements
    /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|our)\s+(garage|house|room|office|workshop)\b/i,
    /\b(this|that|the)\s+(image|photo|picture|snapshot)\s+(of|showing)\s+(my|our)\b/i,
    /\b(my|our)\s+(garage|house|room|office)\s+(is|was)\s+(in|shown|depicted)\b/i,
    // Exclude personal conversation/routines
    /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i,
    /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning|drink|cup)\b/i,
    /\b(coffee|tea|breakfast)\s+time\b/i,
    /\b(enjoying|drinking|sipping)\s+(my|a|some)\s+(coffee|tea|drink|breakfast)\b/i,
    /\b(cup\s+of)\s+(coffee|tea)\b/i,
    /\b(just|i'm)\s+(up|awake|starting)\b/i,
    /\bfiguring\s+(out|that)\s+(my|the|what|today)\b/i,
    /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking)\b/i,
    /\bsitting\s+here\b/i,
    /\bthinking\s+about\s+(it|that|things)\b/i,
    // Exclude JARVIS-related coding
    /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis)\b/i,
    /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i
  ];
  
  if (visionPatterns.some(p => p.test(lower))) {
    return false;
  }
  
  // Exclude idea/suggestion requests about HA (not status queries)
  const isIdeaRequest = /\b(ideas?|suggestions?|projects?|recommendations?)\b/i.test(lower) &&
                        /\b(home assistant|ha|smart home)\b/i.test(lower);
  const isHelpRequest = /\b(help me|how (can|do) I|what can I|ideas for|suggestions for)\b/i.test(lower) &&
                        /\b(home assistant|ha|smart home|automation)\b/i.test(lower);
  
  if (isIdeaRequest || isHelpRequest) {
    return false; // This is a request for ideas/help, not a sensor query
  }
  
  // Direct HA keywords
  const haKeywords = [
    'sensor', 'entity', 'device', 'home assistant', 'ha ', 'smart home',
    'temperature', 'humidity', 'air quality', 'aqi', 'co2', 'solar', 'energy',
    'power', 'battery', 'motion', 'door', 'window', 'light', 'switch',
    'thermostat', 'climate', 'printer', '3d', 'water', 'leak', 'smoke',
    'in my house', 'in my home', 'current', 'status of'
  ];
  
  if (haKeywords.some(kw => lower.includes(kw))) {
    return true;
  }
  
  // Check for category matches
  const searchTerms = extractSearchTerms(query);
  for (const [category, config] of Object.entries(ENTITY_CATEGORIES)) {
    if (searchTerms.some(term => 
      config.keywords.includes(term) || term === category
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if entity is indoor or outdoor based on name/ID
 */
function getEntityLocation(entity: HAEntity): 'indoor' | 'outdoor' | 'unknown' {
  const idAndName = `${entity.entity_id} ${entity.attributes?.friendly_name || ''}`.toLowerCase();
  
  // Outdoor indicators
  const outdoorPatterns = /\b(outdoor|outside|exterior|weather|garden|backyard|frontyard|patio|balcony)\b/;
  if (outdoorPatterns.test(idAndName)) {
    return 'outdoor';
  }
  
  // Indoor indicators
  const indoorPatterns = /\b(indoor|inside|interior|room|living|bedroom|kitchen|office|hallway|basement|attic)\b/;
  if (indoorPatterns.test(idAndName)) {
    return 'indoor';
  }
  
  return 'unknown';
}

/**
 * Format entity with location indicator
 */
function formatEntityWithLocation(entity: HAEntity): string {
  const baseFormatted = formatEntityValue(entity);
  const location = getEntityLocation(entity);
  
  if (location === 'indoor') {
    return `${baseFormatted} (indoor)`;
  } else if (location === 'outdoor') {
    return `${baseFormatted} (outdoor)`;
  }
  
  return baseFormatted;
}

/**
 * Generate a natural language response from entity matches
 * Handles location context (inside/outside) intelligently
 */
export function generateEntityResponse(
  query: string, 
  result: EntitySearchResult
): string {
  if (result.matches.length === 0) {
    return `I couldn't find any relevant sensors for "${query}" in your Home Assistant. Make sure your devices are connected and named clearly.`;
  }
  
  // Check for location context in query
  const locationContext = extractLocationContext(query);
  const hasLocationContext = locationContext.isInside || locationContext.isOutside;
  
  if (result.matches.length === 1) {
    const match = result.matches[0];
    const formatted = formatEntityWithLocation(match.entity);
    return `Here's what I found:\n${formatted}`;
  }
  
  // Multiple matches - prioritize by location context if present
  let topMatches = result.matches.slice(0, 3);
  
  // If we have location context, try to find the best matching entity
  if (hasLocationContext) {
    // Sort by location relevance
    topMatches = result.matches
      .sort((a, b) => {
        const locA = getEntityLocation(a.entity);
        const locB = getEntityLocation(b.entity);
        
        // Prioritize matching location
        if (locationContext.isInside) {
          if (locA === 'indoor' && locB !== 'indoor') return -1;
          if (locB === 'indoor' && locA !== 'indoor') return 1;
        }
        if (locationContext.isOutside) {
          if (locA === 'outdoor' && locB !== 'outdoor') return -1;
          if (locB === 'outdoor' && locA !== 'outdoor') return 1;
        }
        
        // Fall back to score
        return b.score - a.score;
      })
      .slice(0, 3);
    
    // If the top match has a clear location that matches the query, just return that one
    const bestMatch = topMatches[0];
    const bestLocation = getEntityLocation(bestMatch.entity);
    
    if (locationContext.isInside && bestLocation === 'indoor') {
      // Convert to Fahrenheit if the unit is Celsius
      let tempValue = parseFloat(bestMatch.entity.state);
      const unit = bestMatch.entity.attributes?.unit_of_measurement || '°F';

      if (unit === '°C') {
        tempValue = (tempValue * 9/5) + 32; // Convert Celsius to Fahrenheit
        return `The indoor temperature is ${Math.round(tempValue)}°F.`;
      } else {
        return `The indoor temperature is ${bestMatch.entity.state}${unit}.`;
      }
    }
    if (locationContext.isOutside && bestLocation === 'outdoor') {
      // Convert to Fahrenheit if the unit is Celsius
      let tempValue = parseFloat(bestMatch.entity.state);
      const unit = bestMatch.entity.attributes?.unit_of_measurement || '°F';

      if (unit === '°C') {
        tempValue = (tempValue * 9/5) + 32; // Convert Celsius to Fahrenheit
        return `The outdoor temperature is ${Math.round(tempValue)}°F.`;
      } else {
        return `The outdoor temperature is ${bestMatch.entity.state}${unit}.`;
      }
    }
  }
  
  // Multiple relevant sensors - show with location indicators
  const formatted = topMatches.map(m => formatEntityWithLocation(m.entity)).join('\n');
  
  if (result.matches.length > 3) {
    return `I found ${result.matches.length} relevant sensors:\n${formatted}\n...and ${result.matches.length - 3} more`;
  }
  
  return `Here are the relevant sensors:\n${formatted}`;
}
