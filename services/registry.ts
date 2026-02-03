
import { PluginManifest, RuntimePlugin } from "../types";

const CORE_PLUGINS: PluginManifest[] = [
  {
    id: "core.os",
    name: "System Core",
    version: "1.0.0",
    description: "Core operating system interface and hardware abstraction layer.",
    author: "JARVIS",
    permissions: ["HARDWARE_CONTROL"],
    provides: ["os_level_control", "filesystem", "system_diagnostics"],
    requires: [],
    priority: 100,
    capabilities: ["system_diagnostics", "process_management"]
  },
  {
    id: "core.network",
    name: "Network Stack",
    version: "1.0.0",
    description: "HTTP/WebSocket connectivity and API communication layer.",
    author: "JARVIS",
    permissions: ["NETWORK"],
    provides: ["network", "http_client", "websocket"],
    requires: ["os_level_control"],
    priority: 90,
    capabilities: ["api_requests", "realtime_data"]
  },
  {
    id: "core.memory",
    name: "Memory Core",
    version: "1.0.0",
    description: "Long-term memory storage with semantic search capabilities.",
    author: "JARVIS",
    permissions: ["READ_MEMORY", "WRITE_MEMORY"],
    provides: ["memory_read", "memory_write", "semantic_search"],
    requires: ["filesystem"],
    priority: 80,
    capabilities: ["memory_read", "memory_write", "context_recall"]
  },
  {
    id: "core.ai",
    name: "AI Engine",
    version: "1.0.0",
    description: "Multi-provider AI inference engine (Gemini, Ollama, Local).",
    author: "JARVIS",
    permissions: ["NETWORK"],
    provides: ["ai_inference", "intent_analysis", "text_generation"],
    requires: ["network"],
    priority: 85,
    capabilities: ["natural_language", "intent_parsing", "conversation"]
  },
  {
    id: "plugin.voice",
    name: "Voice Interface",
    version: "1.0.0",
    description: "Speech recognition and neural text-to-speech synthesis.",
    author: "JARVIS",
    permissions: ["AUDIO_INPUT", "AUDIO_OUTPUT"],
    provides: ["speech_recognition", "speech_synthesis"],
    requires: ["os_level_control", "ai_inference"],
    priority: 75,
    capabilities: ["voice_input", "voice_output", "wake_word"]
  },
  {
    id: "plugin.vision",
    name: "Vision System",
    version: "1.0.0",
    description: "Camera interface with frame capture and recording capabilities.",
    author: "JARVIS",
    permissions: ["CAMERA_ACCESS"],
    provides: ["video_capture", "frame_analysis"],
    requires: ["os_level_control"],
    priority: 70,
    capabilities: ["camera_control", "image_capture", "video_recording"]
  },
  {
    id: "integration.home_assistant",
    name: "Home Assistant",
    version: "1.0.0",
    description: "Smart home control via Home Assistant REST/WebSocket API.",
    author: "JARVIS",
    permissions: ["NETWORK", "HARDWARE_CONTROL"],
    provides: ["iot_control", "device_state"],
    requires: ["network"],
    priority: 60,
    capabilities: ["light_control", "switch_control", "climate_control", "sensor_read"]
  },
  {
    id: "plugin.weather",
    name: "Weather Station",
    version: "1.0.0",
    description: "Real-time weather data with forecasts, air quality, and location search via Open-Meteo API.",
    author: "JARVIS",
    permissions: ["NETWORK"],
    provides: ["weather_data", "weather_forecast", "air_quality"],
    requires: ["network"],
    priority: 55,
    capabilities: ["current_weather", "hourly_forecast", "daily_forecast", "air_quality", "location_search"]
  }
];

// Version to force cache clear when plugins change
// Bump this number whenever CORE_PLUGINS changes to clear localStorage
const REGISTRY_VERSION = 10;

class PluginRegistry {
  private plugins: Map<string, RuntimePlugin> = new Map();
  private observers: (() => void)[] = [];
  private storageKey = 'jarvis_plugin_registry';
  private versionKey = 'jarvis_plugin_registry_version';

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check version and clear stale data if needed
    const savedVersion = localStorage.getItem(this.versionKey);
    if (!savedVersion || parseInt(savedVersion) < REGISTRY_VERSION) {
      localStorage.removeItem(this.storageKey);
      localStorage.setItem(this.versionKey, REGISTRY_VERSION.toString());
    }

    const savedStates = localStorage.getItem(this.storageKey);
    let statesMap: Record<string, RuntimePlugin['status']> = {};
    if (savedStates) {
      try { statesMap = JSON.parse(savedStates); } catch (e) {}
    }

    // Only load plugins defined in CORE_PLUGINS
    CORE_PLUGINS.forEach(manifest => {
      this.plugins.set(manifest.id, {
        manifest,
        status: statesMap[manifest.id] || 'ACTIVE',
        loadedAt: Date.now()
      });
    });
  }

  private persist() {
    const statesMap: Record<string, RuntimePlugin['status']> = {};
    this.plugins.forEach((p, id) => {
      statesMap[id] = p.status;
    });
    localStorage.setItem(this.storageKey, JSON.stringify(statesMap));
  }

  public install(manifest: PluginManifest) {
    if (this.plugins.has(manifest.id)) return;
    this.plugins.set(manifest.id, {
      manifest,
      status: 'ACTIVE',
      loadedAt: Date.now()
    });
    this.persist();
    this.notify();
  }

  public getAll(): RuntimePlugin[] {
    return Array.from(this.plugins.values());
  }

  public get(id: string): RuntimePlugin | undefined {
    return this.plugins.get(id);
  }

  public findProviderForCapability(capability: string): string | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'ACTIVE' && (plugin.manifest.provides.includes(capability) || plugin.manifest.capabilities.includes(capability))) {
        return plugin.manifest.id;
      }
    }
    return null;
  }

  public setPluginStatus(id: string, status: RuntimePlugin['status']) {
     const plugin = this.plugins.get(id);
     if (plugin) {
         plugin.status = status;
         this.persist();
         this.notify();
     }
  }

  public togglePlugin(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    plugin.status = plugin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    this.persist();
    this.notify();
  }

  public subscribe(callback: () => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.observers.forEach(cb => cb());
  }

  public restore(states: Record<string, RuntimePlugin['status']>) {
    this.plugins.forEach((p, id) => {
      if (states[id]) p.status = states[id];
    });
    this.persist();
    this.notify();
  }
}

export const registry = new PluginRegistry();
