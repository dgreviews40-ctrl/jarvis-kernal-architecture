
import { memory } from "./memory";
import { providerManager } from "./providers";
import { voice } from "./voice";
import { registry } from "./registry";

import { AIConfig, OllamaConfig, VoiceConfig, MemoryNode, RuntimePlugin } from "../types";

export interface SystemBackup {
  version: string;
  timestamp: number;
  data: {
    aiConfig: AIConfig;
    ollamaConfig: OllamaConfig;
    voiceConfig: VoiceConfig;
    memoryNodes: MemoryNode[];
    pluginStates: Record<string, RuntimePlugin['status']>;
  };
}

class BackupService {
  private backupKey = 'jarvis_system_backup';

  /**
   * Aggregates all kernel data into a single object
   */
  public generateBackup(): SystemBackup {
    return {
      version: "1.5.0",
      timestamp: Date.now(),
      data: {
        aiConfig: providerManager.getAIConfig(),
        ollamaConfig: providerManager.getOllamaConfig(),
        voiceConfig: voice.getConfig(),
        memoryNodes: memory.getAll(),
        pluginStates: this.getPluginStates()
      }
    };
  }

  private getPluginStates() {
    const states: Record<string, RuntimePlugin['status']> = {};
    registry.getAll().forEach(p => {
      states[p.manifest.id] = p.status;
    });
    return states;
  }

  /**
   * Exports data as a JSON file download
   */
  public downloadLocal() {
    const backup = this.generateBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JARVIS_KERNEL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Restores system state from a backup object
   */
  public async restore(backup: SystemBackup): Promise<void> {
    if (!backup.data) throw new Error("Invalid Backup Format: Missing Data Root");

    // 1. Restore AI & Ollama Configs
    if (backup.data.aiConfig) providerManager.setAIConfig(backup.data.aiConfig);
    if (backup.data.ollamaConfig) providerManager.setOllamaConfig(backup.data.ollamaConfig);
    
    // 2. Restore Voice
    if (backup.data.voiceConfig) voice.setConfig(backup.data.voiceConfig);
    
    // 3. Restore Memory
    if (backup.data.memoryNodes) memory.restore(backup.data.memoryNodes);
    
    // 4. Restore Plugin Registry
    if (backup.data.pluginStates) registry.restore(backup.data.pluginStates);

    console.log("[BACKUP] Kernel Restoration Sequence Complete.");
  }
}

export const backupService = new BackupService();
