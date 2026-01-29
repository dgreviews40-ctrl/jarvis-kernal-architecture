import { CircuitBreaker } from "./execution";

export interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
}

export interface HAServiceCall {
  entity_id: string;
  domain: string;
  service: string;
  service_data?: Record<string, any>;
}

class HomeAssistantService {
  private baseUrl: string = "";
  private token: string | null = null;
  private entities: Map<string, HAEntity> = new Map();
  private _initialized: boolean = false;
  private proxyUrl: string = "http://localhost:3101"; // Default proxy URL

  constructor() {}

  public configure(url: string, token: string) {
    this.baseUrl = url;
    this.token = token;
  }

  public get initialized(): boolean {
    return this._initialized;
  }

  protected setInitialized(value: boolean) {
    this._initialized = value;
  }

  private async updateProxyConfig(url: string, token: string): Promise<void> {
    try {
      // Wait a bit to ensure proxy is running
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch(`${this.proxyUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, token })
      });

      if (!response.ok) {
        console.error('Failed to update proxy configuration:', response.statusText);
      } else {
        console.log('[HOME_ASSISTANT] Proxy configuration updated successfully');
      }
    } catch (error) {
      console.error('Error updating proxy configuration:', error);
      console.log('[HOME_ASSISTANT] Proxy server may not be running. Please ensure "npm run proxy" is started.');
    }
  }

  public async initialize(): Promise<void> {
    if (!this.baseUrl || !this.token) {
      throw new Error("Home Assistant service not configured. Please set URL and token.");
    }

    try {
      // First ensure proxy is configured
      await this.updateProxyConfig(this.baseUrl, this.token);
      // Wait a moment for configuration to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.fetchEntities();
      this._initialized = true;
    } catch (error) {
      console.error("Failed to initialize Home Assistant service:", error);
      throw error;
    }
  }

  public async fetchEntities(): Promise<void> {
    if (!this.token) {
      throw new Error("Home Assistant service not configured. Please set URL and token.");
    }

    try {
      // First, ensure proxy is configured
      await this.updateProxyConfig(this.baseUrl, this.token);

      // Check if proxy is available first
      try {
        const statusResponse = await fetch(`${this.proxyUrl}/status`);
        if (!statusResponse.ok) {
          console.warn("[HOME_ASSISTANT] Proxy server not responding, attempting to fetch entities anyway...");
        }
      } catch (statusError) {
        console.warn("[HOME_ASSISTANT] Could not reach proxy server, attempting to fetch entities anyway...");
      }

      // Wait a moment for the configuration to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch(`${this.proxyUrl}/ha-api/states`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entities: ${response.status} ${response.statusText}`);
      }

      const entities: HAEntity[] = await response.json();

      // Clear existing entities and populate with fresh data
      this.entities.clear();
      entities.forEach(entity => {
        this.entities.set(entity.entity_id, entity);
      });
    } catch (error) {
      console.error("Error fetching entities from Home Assistant:", error);
      throw error;
    }
  }

  /**
   * Smart Command Router
   * Maps intent entities (e.g. ["lights", "on", "kitchen"]) to specific API calls
   */
  public async executeSmartCommand(entities: string[]): Promise<string> {
    if (!this._initialized) {
      await this.initialize();
    }

    const input = entities.join(" ").toLowerCase();

    // 1. Determine Target Entity
    const target = this.findTargetEntity(input);
    if (!target) {
      throw new Error(`I couldn't identify which device you're referring to from "${input}". Available devices: ${Array.from(this.entities.values()).map(e => e.attributes.friendly_name || e.entity_id).join(', ')}`);
    }

    // 2. Determine Action based on entity domain
    let action = 'toggle';
    const domain = target.entity_id.split('.')[0]; // e.g., 'switch', 'light', 'lock'

    // Different domains may require different service calls
    if (input.includes('on') || input.includes('active') || input.includes('open') || input.includes('unlock')) {
      switch(domain) {
        case 'lock':
          action = 'unlock';
          break;
        case 'cover': // covers like garage doors, blinds
          action = 'open_cover';
          break;
        default:
          action = 'turn_on';
      }
    }
    else if (input.includes('off') || input.includes('deactivate') || input.includes('close') || input.includes('lock')) {
      switch(domain) {
        case 'lock':
          action = 'lock';
          break;
        case 'cover':
          action = 'close_cover';
          break;
        default:
          action = 'turn_off';
      }
    }

    console.log(`[HOME_ASSISTANT] Calling service: ${action} on entity: ${target.entity_id} (domain: ${domain})`);

    // 3. Execute
    return this.callService(target.entity_id, action);
  }

  private findTargetEntity(input: string): HAEntity | null {
    // Improved fuzzy match with better scoring and context awareness
    let bestMatch: HAEntity | null = null;
    let maxScore = 0;

    // Define controllable domains that can be turned on/off
    const controllableDomains = ['switch', 'light', 'fan', 'cover', 'lock', 'media_player', 'input_boolean', 'scene', 'script'];

    // Pre-process input to extract meaningful terms
    const inputWords = input.toLowerCase().split(/\s+/).filter(word => word.length >= 2);

    for (const entity of this.entities.values()) {
      let score = 0;
      const friendlyName = (entity.attributes.friendly_name || '').toLowerCase();
      const entityId = entity.entity_id.toLowerCase();
      const entityIdPart = entity.entity_id.split('.')[1]?.toLowerCase() || ''; // e.g., 'living_room'
      const domain = entity.entity_id.split('.')[0]; // e.g., 'switch'

      // Skip non-controllable domains unless specifically requested
      if (!controllableDomains.includes(domain) && !input.includes(domain)) {
        continue;
      }

      // Score based on friendly name (highest priority)
      if (friendlyName) {
        // Exact phrase match gets highest score
        if (friendlyName.includes(input.trim().toLowerCase())) score += 20;

        // Individual word matches
        inputWords.forEach(word => {
          if (friendlyName.includes(word)) score += 5; // Strong match in friendly name
        });

        // Partial matches for common device types
        if (input.includes('printer') && friendlyName.includes('printer')) score += 15;
        if (input.includes('light') && friendlyName.includes('light')) score += 15;
        if (input.includes('fan') && friendlyName.includes('fan')) score += 15;
        if (input.includes('switch') && friendlyName.includes('switch')) score += 15;
      }

      // Score based on entity ID parts
      if (entityIdPart) {
        inputWords.forEach(word => {
          if (entityIdPart.includes(word)) score += 3; // Match in entity ID
        });
      }

      // Domain-specific matching with higher weights
      if (domain === 'switch') {
        if (input.includes('switch') || input.includes('power') || input.includes('plug') || input.includes('socket')) score += 5;
        // Specific device matching
        if (friendlyName.includes('printer') || entityIdPart.includes('printer')) {
          if (input.includes('printer') || input.includes('3d')) score += 20; // Very strong match
        }
        if (friendlyName.includes('light') || entityIdPart.includes('light')) {
          if (input.includes('light')) score += 20;
        }
      }
      if (domain === 'light' && input.includes('light')) score += 5;
      if (domain === 'lock' && (input.includes('lock') || input.includes('door'))) score += 5;
      if (domain === 'cover' && (input.includes('cover') || input.includes('garage') || input.includes('blind') || input.includes('shade'))) score += 5;
      if (domain === 'fan' && input.includes('fan')) score += 5;

      // Contextual scoring based on common phrases
      if (input.includes('turn on') && (domain === 'switch' || domain === 'light' || domain === 'fan')) score += 3;
      if (input.includes('turn off') && (domain === 'switch' || domain === 'light' || domain === 'fan')) score += 3;

      if (score > maxScore) {
        maxScore = score;
        bestMatch = entity;
      }
    }

    // Only return a match if it meets a minimum confidence threshold
    return maxScore >= 5 ? bestMatch : null;
  }

  // Makes actual HTTP call to Home Assistant API via proxy
  private async callService(entityId: string, service: string): Promise<string> {
    if (!this.token) {
      throw new Error("Home Assistant service not configured. Please set URL and token.");
    }

    // Check for "Unlock" safety policy
    if (service === 'unlock') {
        // Log security critical action
        console.warn("SECURITY CRITICAL ACTION: Unlocking door.");
    }

    try {
      // Determine the domain from the entity_id (e.g., 'light.living_room' -> 'light')
      const domain = entityId.split('.')[0];
      const serviceUrl = `${this.proxyUrl}/ha-api/services/${domain}/${service}`;

      console.log(`[HOME_ASSISTANT] Making request to: ${serviceUrl} with entity: ${entityId} and service: ${service}`);

      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_id: entityId
        })
      });

      console.log(`[HOME_ASSISTANT] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HOME_ASSISTANT] Service call failed: ${response.status} - ${errorText}`);
        throw new Error(`Failed to call service: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }

      // Update local entity state after successful call
      await this.updateEntityState(entityId);

      return `Successfully called service '${service}' on ${(this.entities.get(entityId)?.attributes.friendly_name || entityId)}.`;
    } catch (error) {
      console.error("Error calling Home Assistant service:", error);
      throw error;
    }
  }

  private async updateEntityState(entityId: string): Promise<void> {
    try {
      const response = await fetch(`${this.proxyUrl}/ha-api/states/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const entity: HAEntity = await response.json();
        this.entities.set(entityId, entity);
      }
    } catch (error) {
      console.error(`Error updating state for ${entityId}:`, error);
      // If we can't update the state, we'll just leave it as is
    }
  }

  public async getStatus(): Promise<{ connected: boolean; entitiesCount: number; error?: string }> {
    if (!this.token) {
      return { connected: false, entitiesCount: 0, error: "Not configured" };
    }

    try {
      // First ensure proxy is configured
      await this.updateProxyConfig(this.baseUrl, this.token);
      await this.fetchEntities();
      return {
        connected: true,
        entitiesCount: this.entities.size,
        initialized: this._initialized
      };
    } catch (error) {
      return {
        connected: false,
        entitiesCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        initialized: false
      };
    }
  }
}

export const haService = new HomeAssistantService();