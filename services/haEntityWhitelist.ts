/**
 * Home Assistant Entity Whitelist Service
 * 
 * Manages which entities Jarvis is allowed to access/search.
 * This gives users fine-grained control over what Jarvis can "see"
 * without affecting the actual Home Assistant devices.
 */

import { HAEntity } from './home_assistant';

const STORAGE_KEY = 'jarvis_ha_entity_whitelist';

export interface WhitelistEntry {
  entity_id: string;
  friendly_name: string;
  domain: string;
  enabled: boolean;
  category: string;
  addedAt: string;
}

export interface WhitelistState {
  entities: WhitelistEntry[];
  lastUpdated: string;
  mode: 'whitelist' | 'blacklist' | 'all'; // whitelist = only selected, blacklist = exclude selected, all = everything
}

/**
 * Get the current whitelist state from localStorage
 */
export function getWhitelistState(): WhitelistState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[HA_WHITELIST] Error reading whitelist:', error);
  }
  
  // Default: empty whitelist, mode 'all' (Jarvis can see everything until configured)
  return {
    entities: [],
    lastUpdated: new Date().toISOString(),
    mode: 'all'
  };
}

/**
 * Save whitelist state to localStorage
 */
export function saveWhitelistState(state: WhitelistState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    console.error('[HA_WHITELIST] Error saving whitelist:', error);
  }
}

/**
 * Categorize an entity based on its ID, name, and attributes
 */
export function categorizeEntity(entity: HAEntity): string {
  const entityId = entity.entity_id.toLowerCase();
  const name = (entity.attributes?.friendly_name || '').toLowerCase();
  const deviceClass = (entity.attributes?.device_class || '').toLowerCase();
  
  // Energy/Power
  if (entityId.includes('solar') || name.includes('solar') || 
      entityId.includes('energy') || name.includes('energy') ||
      entityId.includes('power') || name.includes('power') ||
      entityId.includes('grid') || name.includes('grid')) {
    return 'energy';
  }
  
  // Environment/Air Quality
  if (entityId.includes('air') || name.includes('air') ||
      entityId.includes('co2') || name.includes('co2') ||
      entityId.includes('co²') || name.includes('co²') ||
      entityId.includes('pm2') || name.includes('pm2') ||
      entityId.includes('voc') || name.includes('voc') ||
      entityId.includes('aqi') || name.includes('aqi') ||
      deviceClass === 'carbon_dioxide' || deviceClass === 'pm25' ||
      deviceClass === 'volatile_organic_compounds') {
    return 'environment';
  }
  
  // Temperature/Humidity
  if (entityId.includes('temp') || name.includes('temp') ||
      entityId.includes('humid') || name.includes('humid') ||
      deviceClass === 'temperature' || deviceClass === 'humidity') {
    return 'climate';
  }
  
  // 3D Printer
  if (entityId.includes('printer') || name.includes('printer') ||
      entityId.includes('ender') || name.includes('ender') ||
      entityId.includes('bambu') || name.includes('bambu') ||
      entityId.includes('prus') || name.includes('prus') ||
      entityId.includes('klipper') || name.includes('klipper') ||
      entityId.includes('octoprint') || name.includes('octoprint')) {
    return '3d_printer';
  }
  
  // Motion/Presence
  if (entityId.includes('motion') || name.includes('motion') ||
      entityId.includes('presence') || name.includes('presence') ||
      entityId.includes('occupancy') || name.includes('occupancy') ||
      deviceClass === 'motion' || deviceClass === 'presence' || deviceClass === 'occupancy') {
    return 'motion';
  }
  
  // Door/Window
  if (entityId.includes('door') || name.includes('door') ||
      entityId.includes('window') || name.includes('window') ||
      deviceClass === 'door' || deviceClass === 'window') {
    return 'openings';
  }
  
  // Water/Leak
  if (entityId.includes('water') || name.includes('water') ||
      entityId.includes('leak') || name.includes('leak') ||
      entityId.includes('flood') || name.includes('flood') ||
      deviceClass === 'moisture') {
    return 'water';
  }
  
  // Smoke/CO
  if (entityId.includes('smoke') || name.includes('smoke') ||
      entityId.includes('co_') || name.includes('co ') ||
      entityId.includes('carbon') || name.includes('carbon') ||
      deviceClass === 'smoke' || deviceClass === 'carbon_monoxide') {
    return 'safety';
  }
  
  // Battery
  if (entityId.includes('battery') || name.includes('battery') ||
      deviceClass === 'battery') {
    return 'battery';
  }
  
  // Light
  if (entityId.includes('light') || name.includes('light') ||
      entityId.includes('lux') || name.includes('lux') ||
      entityId.includes('brightness') || name.includes('brightness') ||
      deviceClass === 'illuminance') {
    return 'lighting';
  }
  
  // Network
  if (entityId.includes('wifi') || name.includes('wifi') ||
      entityId.includes('network') || name.includes('network') ||
      entityId.includes('internet') || name.includes('internet') ||
      entityId.includes('ping') || name.includes('ping')) {
    return 'network';
  }
  
  // Weather
  if (entityId.includes('weather') || name.includes('weather') ||
      entityId.includes('rain') || name.includes('rain') ||
      entityId.includes('wind') || name.includes('wind') ||
      entityId.includes('uv') || name.includes('uv')) {
    return 'weather';
  }
  
  // Media
  if (entityId.includes('tv') || name.includes('tv') ||
      entityId.includes('media') || name.includes('media') ||
      entityId.includes('speaker') || name.includes('speaker') ||
      entityId.includes('sonos') || name.includes('sonos')) {
    return 'media';
  }
  
  // System
  if (entityId.includes('cpu') || name.includes('cpu') ||
      entityId.includes('memory') || name.includes('memory') ||
      entityId.includes('disk') || name.includes('disk') ||
      entityId.includes('uptime') || name.includes('uptime')) {
    return 'system';
  }
  
  return 'other';
}

/**
 * Get human-readable category name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    energy: '⚡ Energy & Power',
    environment: '🌬️ Air Quality',
    climate: '🌡️ Temperature & Humidity',
    '3d_printer': '🖨️ 3D Printer',
    motion: '🚶 Motion & Presence',
    openings: '🚪 Doors & Windows',
    water: '💧 Water & Leaks',
    safety: '🔥 Safety (Smoke/CO)',
    battery: '🔋 Battery',
    lighting: '💡 Light & Brightness',
    network: '📶 Network',
    weather: '🌤️ Weather',
    media: '📺 Media',
    system: '💻 System',
    other: '📦 Other'
  };
  return labels[category] || category;
}

/**
 * Toggle an entity in the whitelist
 */
export function toggleEntity(entity: HAEntity, enabled: boolean): void {
  const state = getWhitelistState();
  const category = categorizeEntity(entity);
  
  // Find existing entry
  const existingIndex = state.entities.findIndex(e => e.entity_id === entity.entity_id);
  
  if (existingIndex >= 0) {
    // Update existing
    state.entities[existingIndex].enabled = enabled;
  } else {
    // Add new entry
    state.entities.push({
      entity_id: entity.entity_id,
      friendly_name: entity.attributes?.friendly_name || entity.entity_id,
      domain: entity.entity_id.split('.')[0],
      enabled,
      category,
      addedAt: new Date().toISOString()
    });
  }
  
  saveWhitelistState(state);
}

/**
 * Check if an entity is enabled (allowed for Jarvis to access)
 */
export function isEntityEnabled(entityId: string): boolean {
  const state = getWhitelistState();
  
  // In 'all' mode, everything is enabled by default
  if (state.mode === 'all') {
    return true;
  }
  
  // In 'whitelist' mode, only explicitly enabled entities are allowed
  if (state.mode === 'whitelist') {
    const entry = state.entities.find(e => e.entity_id === entityId);
    return entry?.enabled === true;
  }
  
  // In 'blacklist' mode, everything is enabled except explicitly disabled
  if (state.mode === 'blacklist') {
    const entry = state.entities.find(e => e.entity_id === entityId);
    return entry?.enabled !== false;
  }
  
  return true;
}

/**
 * Get all enabled entity IDs
 */
export function getEnabledEntityIds(): string[] {
  const state = getWhitelistState();
  
  if (state.mode === 'all') {
    return []; // Empty means "all" in this context
  }
  
  return state.entities
    .filter(e => e.enabled)
    .map(e => e.entity_id);
}

/**
 * Set the whitelist mode
 * Also updates all entities' enabled status to match the new mode's defaults
 */
export function setMode(mode: 'whitelist' | 'blacklist' | 'all'): void {
  const state = getWhitelistState();
  const oldMode = state.mode;
  
  // Only update entity states if mode actually changed
  if (oldMode !== mode) {
    state.mode = mode;
    
    // Update all entities to match new mode's defaults
    for (const entry of state.entities) {
      if (mode === 'all') {
        // All mode: everything enabled
        entry.enabled = true;
      } else if (mode === 'whitelist') {
        // Whitelist mode: everything disabled by default
        // (unless it was explicitly enabled before)
        entry.enabled = false;
      } else if (mode === 'blacklist') {
        // Blacklist mode: everything enabled by default
        entry.enabled = true;
      }
    }
    
    saveWhitelistState(state);
  }
}

/**
 * Get the current mode
 */
export function getMode(): 'whitelist' | 'blacklist' | 'all' {
  return getWhitelistState().mode;
}

/**
 * Clear the entire whitelist
 */
export function clearWhitelist(): void {
  saveWhitelistState({
    entities: [],
    lastUpdated: new Date().toISOString(),
    mode: 'all'
  });
}

/**
 * Bulk update entities (e.g., after fetching from HA)
 * Removes entities that no longer exist, adds new ones with default state
 */
export function syncWithEntities(entities: HAEntity[]): void {
  const state = getWhitelistState();
  const currentIds = new Set(entities.map(e => e.entity_id));
  
  // Remove entries for entities that no longer exist
  state.entities = state.entities.filter(e => currentIds.has(e.entity_id));
  
  // Add new entities with appropriate default state based on mode
  const existingIds = new Set(state.entities.map(e => e.entity_id));
  
  for (const entity of entities) {
    if (!existingIds.has(entity.entity_id)) {
      // Default state depends on mode:
      // - 'all': all enabled
      // - 'whitelist': all disabled (user must explicitly enable)
      // - 'blacklist': all enabled (user must explicitly disable)
      const defaultEnabled = state.mode !== 'whitelist';
      
      state.entities.push({
        entity_id: entity.entity_id,
        friendly_name: entity.attributes?.friendly_name || entity.entity_id,
        domain: entity.entity_id.split('.')[0],
        enabled: defaultEnabled,
        category: categorizeEntity(entity),
        addedAt: new Date().toISOString()
      });
    }
  }
  
  saveWhitelistState(state);
}

/**
 * Select all entities in a category
 */
export function selectCategory(category: string, enabled: boolean): void {
  const state = getWhitelistState();
  
  for (const entry of state.entities) {
    if (entry.category === category) {
      entry.enabled = enabled;
    }
  }
  
  saveWhitelistState(state);
}

/**
 * Get statistics about the whitelist
 */
export function getWhitelistStats(): {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: Record<string, { total: number; enabled: number }>;
} {
  const state = getWhitelistState();
  const byCategory: Record<string, { total: number; enabled: number }> = {};
  
  for (const entry of state.entities) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = { total: 0, enabled: 0 };
    }
    byCategory[entry.category].total++;
    if (entry.enabled) {
      byCategory[entry.category].enabled++;
    }
  }
  
  return {
    total: state.entities.length,
    enabled: state.entities.filter(e => e.enabled).length,
    disabled: state.entities.filter(e => !e.enabled).length,
    byCategory
  };
}
