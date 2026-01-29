
import { PluginManifest, RuntimePlugin } from "../types";

const CORE_PLUGINS: PluginManifest[] = [
  {
    id: "core.os",
    name: "Windows Core",
    version: "10.0.1",
    description: "Hardware Abstraction Layer",
    author: "Microsoft",
    permissions: ["HARDWARE_CONTROL"],
    provides: ["os_level_control", "filesystem", "system_diagnostics", "security_protocols", "automation_protocols"],
    requires: [],
    priority: 100,
    capabilities: ["system_diagnostics", "security_protocols", "automation_protocols"] 
  },
  {
    id: "core.network",
    name: "Network Driver",
    version: "1.0.0",
    description: "Connectivity Interface",
    author: "System",
    permissions: ["NETWORK"],
    provides: ["network"],
    requires: ["os_level_control"],
    priority: 90,
    capabilities: []
  },
  {
    id: "core.memory",
    name: "Cortex Memory",
    version: "1.0.0",
    description: "Vector database interface.",
    author: "Stark Ind.",
    permissions: ["READ_MEMORY", "WRITE_MEMORY"],
    provides: ["memory_read", "memory_write"],
    requires: ["filesystem"],
    priority: 80,
    capabilities: ["memory_read", "memory_write"]
  },
  {
    id: "plugin.io.microphone",
    name: "Array Microphone Driver",
    version: "2.0.0",
    description: "Audio Input Source (WASAPI)",
    author: "Realtek",
    permissions: ["AUDIO_INPUT"],
    provides: ["audio_input"],
    requires: ["os_level_control"],
    priority: 95,
    capabilities: []
  },
  {
    id: "plugin.ai.stt",
    name: "Whisper STT Engine",
    version: "3.0.0",
    description: "Speech-to-Text Transcriber",
    author: "OpenAI",
    permissions: [],
    provides: ["text_input"],
    requires: ["audio_input", "network"],
    priority: 85,
    capabilities: []
  },
  {
    id: "plugin.io.speaker",
    name: "Speaker Output",
    version: "1.0.0",
    description: "Audio Sink",
    author: "System",
    permissions: ["AUDIO_OUTPUT"],
    provides: ["audio_output"],
    requires: ["os_level_control"],
    priority: 95,
    capabilities: []
  },
  {
    id: "plugin.ai.tts",
    name: "Neural TTS Engine",
    version: "4.1.0",
    description: "Text-to-Speech Synthesis",
    author: "ElevenLabs / Google",
    permissions: [],
    provides: ["speech_synthesis"],
    requires: ["audio_output", "network"],
    priority: 85,
    capabilities: []
  },
  {
    id: "system.home_assistant",
    name: "Home Assistant Bridge",
    version: "2.4.1",
    description: "IoT control via Websocket.",
    author: "Community",
    permissions: ["NETWORK", "HARDWARE_CONTROL"],
    provides: ["iot_control"],
    requires: ["network"],
    priority: 50,
    capabilities: ["light_control", "lock_control", "climate_control"]
  },
  {
    id: "media.spotify",
    name: "Spotify Connect",
    version: "0.9.beta",
    description: "Music playback control.",
    author: "Spotify AB",
    permissions: ["NETWORK", "AUDIO_OUTPUT"],
    provides: ["music_playback"],
    requires: ["network", "audio_output"],
    priority: 40,
    capabilities: ["music_playback", "volume_control"]
  }
];

class PluginRegistry {
  private plugins: Map<string, RuntimePlugin> = new Map();
  private observers: (() => void)[] = [];
  private storageKey = 'jarvis_plugin_registry';

  constructor() {
    this.initialize();
  }

  private initialize() {
    const savedStates = localStorage.getItem(this.storageKey);
    let statesMap: Record<string, RuntimePlugin['status']> = {};
    if (savedStates) {
      try { statesMap = JSON.parse(savedStates); } catch (e) {}
    }

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
