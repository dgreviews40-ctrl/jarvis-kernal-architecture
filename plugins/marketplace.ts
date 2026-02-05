/**
 * Plugin Marketplace API
 *
 * Provides:
 * - Plugin discovery and search
 * - Installation from marketplace
 * - Rating and review system
 * - Verified plugin registry
 */

import { PluginManifestV2, PluginListing } from './types';
import { fetchManifest, loadPlugin } from './loader';
import { registerPlugin, startPlugin } from './registry';
import { logger } from '../services/logger';

// Marketplace data - real plugins
const MOCK_MARKETPLACE: PluginListing[] = [
  {
    manifest: {
      id: 'plugin.weather',
      name: 'Weather Station',
      version: '1.0.0',
      description: 'Real-time weather data with hourly/daily forecasts, air quality monitoring, and location search. Powered by Open-Meteo API.',
      author: 'JARVIS',
      engineVersion: '1.0.0',
      dependencies: [],
      permissions: ['network:fetch'],
      provides: [{ name: 'weather_data', version: '1.0.0', description: 'Weather data provider' }],
      entry: { ui: 'WeatherDashboard.tsx' },
      tags: ['weather', 'utilities', 'monitoring'],
      license: 'MIT'
    },
    downloadUrl: 'builtin://plugin.weather',
    rating: 4.8,
    downloadCount: 1250,
    verified: true,
    updatedAt: '2026-02-01T00:00:00Z'
  },
  {
    manifest: {
      id: 'plugin.voice',
      name: 'Voice Interface',
      version: '1.0.0',
      description: 'Speech recognition and neural text-to-speech synthesis with wake word detection.',
      author: 'JARVIS',
      engineVersion: '1.0.0',
      dependencies: [],
      permissions: ['audio:input', 'audio:output'],
      provides: [{ name: 'speech_recognition', version: '1.0.0', description: 'Voice input' }],
      entry: { ui: 'VoicePanel.tsx' },
      tags: ['voice', 'audio', 'accessibility'],
      license: 'MIT'
    },
    downloadUrl: 'builtin://plugin.voice',
    rating: 4.7,
    downloadCount: 2100,
    verified: true,
    updatedAt: '2026-02-01T00:00:00Z'
  },
  {
    manifest: {
      id: 'plugin.vision',
      name: 'Vision System',
      version: '1.0.0',
      description: 'Camera interface with frame capture, recording, and AI-powered image analysis.',
      author: 'JARVIS',
      engineVersion: '1.0.0',
      dependencies: [],
      permissions: ['vision:camera', 'vision:analyze'],
      provides: [{ name: 'video_capture', version: '1.0.0', description: 'Camera access' }],
      entry: { ui: 'VisionDashboard.tsx' },
      tags: ['vision', 'camera', 'ai'],
      license: 'MIT'
    },
    downloadUrl: 'builtin://plugin.vision',
    rating: 4.6,
    downloadCount: 980,
    verified: true,
    updatedAt: '2026-02-01T00:00:00Z'
  },
  {
    manifest: {
      id: 'integration.home_assistant',
      name: 'Home Assistant',
      version: '1.0.0',
      description: 'Smart home control via Home Assistant REST/WebSocket API. Control lights, switches, climate, and more.',
      author: 'JARVIS',
      engineVersion: '1.0.0',
      dependencies: [],
      permissions: ['network:fetch', 'network:websocket'],
      provides: [{ name: 'iot_control', version: '1.0.0', description: 'Smart home control' }],
      entry: { ui: 'HomeAssistantDashboard.tsx' },
      tags: ['smart-home', 'iot', 'automation'],
      license: 'MIT'
    },
    downloadUrl: 'builtin://integration.home_assistant',
    rating: 4.9,
    downloadCount: 3200,
    verified: true,
    updatedAt: '2026-02-01T00:00:00Z'
  },
  {
    manifest: {
      id: 'display.core',
      name: 'Display Core',
      version: '1.0.0',
      description: 'Core display functionality for JARVIS with intelligent model selection and rich content rendering. Handles diagrams, images, documentation, and interactive elements.',
      author: 'JARVIS',
      engineVersion: '1.5.0',
      dependencies: [],
      permissions: ['display:render', 'model:selection'],
      provides: [
        { name: 'display.content', version: '1.0.0', description: 'Content display service' },
        { name: 'display.render', version: '1.0.0', description: 'Content rendering service' },
        { name: 'model.selection', version: '1.0.0', description: 'Intelligent model selection' }
      ],
      entry: { ui: 'DisplayDashboard.tsx' },
      tags: ['display', 'visualization', 'rendering', 'ai', 'content'],
      license: 'MIT'
    },
    downloadUrl: 'builtin://display.core',
    rating: 4.9,
    downloadCount: 850,
    verified: true,
    updatedAt: '2026-02-03T00:00:00Z'
  }
];

// Export built-in plugin manifests for initialization
export const BUILTIN_PLUGIN_MANIFESTS = MOCK_MARKETPLACE
  .filter(p => p.downloadUrl.startsWith('builtin://'))
  .map(p => p.manifest);

/**
 * Search for plugins in the marketplace
 */
export async function searchPlugins(query: string = '', filters: {
  category?: string;
  verified?: boolean;
} = {}): Promise<{ plugins: PluginListing[]; error?: string }> {
  try {
    // In production, this would be an API call
    // For now, filter the mock data
    let results = [...MOCK_MARKETPLACE];

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.manifest.name.toLowerCase().includes(lowerQuery) ||
        p.manifest.description.toLowerCase().includes(lowerQuery) ||
        p.manifest.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    // Category filter
    if (filters.category) {
      results = results.filter(p =>
        p.manifest.tags.includes(filters.category!)
      );
    }

    // Verified filter
    if (filters.verified !== undefined) {
      results = results.filter(p => p.verified === filters.verified);
    }

    // Sort alphabetically by name
    results.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

    return { plugins: results };
  } catch (error) {
    return {
      plugins: [],
      error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get plugin details
 */
export async function getPluginDetails(pluginId: string): Promise<{ listing?: PluginListing; error?: string }> {
  const listing = MOCK_MARKETPLACE.find(p => p.manifest.id === pluginId);

  if (!listing) {
    return { error: 'Plugin not found' };
  }

  return { listing };
}

/**
 * Get featured plugins
 */
export async function getFeaturedPlugins(): Promise<{ plugins: PluginListing[]; error?: string }> {
  // Return verified plugins (alphabetically)
  const featured = MOCK_MARKETPLACE
    .filter(p => p.verified)
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
    .slice(0, 5);

  return { plugins: featured };
}

/**
 * Get plugin categories
 */
export function getCategories(): string[] {
  const categories = new Set<string>();

  MOCK_MARKETPLACE.forEach(p => {
    p.manifest.tags.forEach(tag => categories.add(tag));
  });

  return Array.from(categories).sort();
}

/**
 * Install a plugin from the marketplace
 */
export async function installFromMarketplace(
  pluginId: string,
  onProgress?: (stage: 'downloading' | 'validating' | 'installing' | 'starting', progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get plugin details
    const { listing, error: detailsError } = await getPluginDetails(pluginId);
    if (detailsError || !listing) {
      return { success: false, error: detailsError || 'Plugin not found' };
    }

    onProgress?.('downloading', 10);

    // Check if this is a built-in plugin
    if (listing.downloadUrl.startsWith('builtin://')) {
      onProgress?.('installing', 50);
      
      // Register the built-in plugin in the new registry so it shows as installed
      const registered = await registerPlugin(listing.manifest);
      if (!registered) {
        // Plugin might already be registered, which is fine
        logger.log('PLUGIN', `${pluginId} is already registered or registration skipped`);
      }
      
      onProgress?.('starting', 90);
      
      // Start the plugin
      const started = await startPlugin(pluginId);
      if (!started) {
        return { success: false, error: 'Failed to start built-in plugin' };
      }
      
      onProgress?.('starting', 100);
      logger.success('MARKETPLACE', `${pluginId} is a built-in plugin - activated`);
      return { success: true };
    }

    // Fetch manifest from plugin URL
    const { manifest, error: manifestError } = await fetchManifest(listing.downloadUrl);
    if (manifestError || !manifest) {
      return { success: false, error: manifestError || 'Invalid manifest' };
    }

    onProgress?.('validating', 30);

    // Verify manifest matches
    if (manifest.id !== pluginId) {
      return { success: false, error: 'Plugin ID mismatch' };
    }

    onProgress?.('installing', 50);

    // Register plugin
    const registered = await registerPlugin(manifest);
    if (!registered) {
      return { success: false, error: 'Failed to register plugin' };
    }

    onProgress?.('installing', 70);

    // Load plugin code
    const { success: loadSuccess, error: loadError, sandbox } = await loadPlugin(
      pluginId,
      manifest,
      listing.downloadUrl
    );

    if (!loadSuccess || !sandbox) {
      return { success: false, error: loadError || 'Failed to load plugin' };
    }

    onProgress?.('starting', 90);

    // Start plugin
    const started = await startPlugin(pluginId);
    if (!started) {
      return { success: false, error: 'Failed to start plugin' };
    }

    onProgress?.('starting', 100);

    logger.success('MARKETPLACE', `Installed ${pluginId} v${manifest.version}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Submit a plugin rating
 */
export async function submitRating(
  pluginId: string,
  rating: number,
  review?: string
): Promise<{ success: boolean; error?: string }> {
  // In production, this would submit to an API
  // For now, just log it
  logger.log('PLUGIN', `Rating submitted for ${pluginId}: ${rating} stars`);
  return { success: true };
}

/**
 * Check for plugin updates
 */
export async function checkAllUpdates(
  installedPlugins: Array<{ id: string; version: string }>
): Promise<{ updates: Array<{ id: string; currentVersion: string; newVersion: string }>; error?: string }> {
  const updates: Array<{ id: string; currentVersion: string; newVersion: string }> = [];

  for (const plugin of installedPlugins) {
    const { listing } = await getPluginDetails(plugin.id);
    if (listing) {
      const current = plugin.version.split('.').map(Number);
      const latest = listing.manifest.version.split('.').map(Number);

      // Check if update available
      let hasUpdate = false;
      for (let i = 0; i < 3; i++) {
        if (latest[i] > current[i]) {
          hasUpdate = true;
          break;
        }
        if (latest[i] < current[i]) break;
      }

      if (hasUpdate) {
        updates.push({
          id: plugin.id,
          currentVersion: plugin.version,
          newVersion: listing.manifest.version
        });
      }
    }
  }

  return { updates };
}

/**
 * Get installation statistics
 */
export function getMarketplaceStats(): {
  totalPlugins: number;
  verifiedPlugins: number;
} {
  const totalPlugins = MOCK_MARKETPLACE.length;
  const verifiedPlugins = MOCK_MARKETPLACE.filter(p => p.verified).length;

  return {
    totalPlugins,
    verifiedPlugins
  };
}
