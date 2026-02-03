
import { MemoryNode, MemoryType, MemorySearchResult } from "../types";

// Simulated "Pre-existing" Long Term Memory
const INITIAL_MEMORY: MemoryNode[] = [
  {
    id: 'mem_001',
    content: "User prefers dark mode interfaces.",
    type: 'PREFERENCE',
    tags: ['ui', 'theme', 'user_preference'],
    created: Date.now() - 1000000
  },
  {
    id: 'mem_002',
    content: "Project 'Iron Legion' deadline is October 15th.",
    type: 'FACT',
    tags: ['work', 'deadlines', 'project'],
    created: Date.now() - 500000
  }
];

export interface MemoryExportData {
  version: string;
  exportedAt: number;
  nodeCount: number;
  nodes: MemoryNode[];
  checksum: string;
}

export interface MemoryBackupConfig {
  autoBackup: boolean;
  backupInterval: number; // minutes
  maxBackups: number;
  encryptBackups: boolean;
}

class MemoryCore {
  private nodes: MemoryNode[];
  private storageKey = 'jarvis_memory_banks';
  private backupKey = 'jarvis_memory_backups';
  private backupConfigKey = 'jarvis_memory_backup_config';
  private backupIntervalId: number | null = null;

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.nodes = JSON.parse(saved);
      } catch (e) {
        this.nodes = [...INITIAL_MEMORY];
      }
    } else {
      this.nodes = [...INITIAL_MEMORY];
    }
    
    // Initialize auto-backup if enabled
    this.initAutoBackup();
  }

  private persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.nodes));
  }

  private generateId(): string {
    return 'mem_' + Math.random().toString(36).substring(2, 11);
  }

  private generateChecksum(data: string): string {
    // Simple checksum for integrity verification
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  public getAll(): MemoryNode[] {
    return this.nodes.sort((a, b) => b.created - a.created);
  }

  public async store(content: string, type: MemoryType = 'FACT', tags: string[] = []): Promise<MemoryNode> {
    const newNode: MemoryNode = {
      id: this.generateId(),
      content,
      type,
      tags,
      created: Date.now()
    };
    this.nodes.unshift(newNode);
    this.persist();
    
    // Trigger auto-backup if enabled
    this.triggerAutoBackup();
    
    return newNode;
  }

  public async recall(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(' ').filter(t => t.length > 3);

    const results = this.nodes.map(node => {
      let score = 0;
      const contentLower = node.content.toLowerCase();
      if (contentLower.includes(queryLower)) score += 1.0;
      queryTokens.forEach(token => {
        if (contentLower.includes(token)) score += 0.3;
        if (node.tags.some(t => t.includes(token))) score += 0.4;
      });
      const ageHours = (Date.now() - node.created) / (1000 * 60 * 60);
      score += Math.max(0, 0.1 - (ageHours * 0.001));
      return { node, score };
    });

    return results
      .filter(r => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public async forget(id: string): Promise<boolean> {
    const initialLen = this.nodes.length;
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.persist();
    
    if (this.nodes.length < initialLen) {
      this.triggerAutoBackup();
      return true;
    }
    return false;
  }

  public restore(nodes: MemoryNode[]) {
    this.nodes = nodes;
    this.persist();
    this.triggerAutoBackup();
  }

  // ==================== EXPORT/IMPORT ====================

  /**
   * Export all memories to a JSON file
   */
  public exportToFile(): void {
    const exportData: MemoryExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      nodeCount: this.nodes.length,
      nodes: this.nodes,
      checksum: this.generateChecksum(JSON.stringify(this.nodes))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-memory-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import memories from a JSON file
   */
  public async importFromFile(file: File): Promise<{ success: boolean; imported: number; errors: string[] }> {
    const errors: string[] = [];
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data: MemoryExportData = JSON.parse(content);
          
          // Validate structure
          if (!data.nodes || !Array.isArray(data.nodes)) {
            errors.push('Invalid file format: missing nodes array');
            resolve({ success: false, imported: 0, errors });
            return;
          }

          // Verify checksum if present
          if (data.checksum) {
            const computedChecksum = this.generateChecksum(JSON.stringify(data.nodes));
            if (computedChecksum !== data.checksum) {
              errors.push('Warning: Checksum mismatch - file may be corrupted');
            }
          }

          // Validate and import nodes
          let imported = 0;
          const validNodes: MemoryNode[] = [];
          
          for (const node of data.nodes) {
            if (this.validateNode(node)) {
              // Generate new ID to avoid conflicts
              node.id = this.generateId();
              validNodes.push(node);
              imported++;
            } else {
              errors.push(`Invalid node skipped: ${JSON.stringify(node).substring(0, 50)}...`);
            }
          }

          if (validNodes.length > 0) {
            // Merge with existing or replace? Let's merge
            this.nodes = [...validNodes, ...this.nodes];
            this.persist();
            this.triggerAutoBackup();
          }

          resolve({ success: imported > 0, imported, errors });
        } catch (err) {
          errors.push(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          resolve({ success: false, imported: 0, errors });
        }
      };

      reader.onerror = () => {
        errors.push('Failed to read file');
        resolve({ success: false, imported: 0, errors });
      };

      reader.readAsText(file);
    });
  }

  /**
   * Export to encrypted string (for cloud sync)
   */
  public exportEncrypted(password: string): string {
    const data = JSON.stringify(this.nodes);
    // Simple XOR encryption (for demonstration - use proper crypto in production)
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    return btoa(encrypted);
  }

  /**
   * Import from encrypted string
   */
  public importEncrypted(encryptedData: string, password: string): boolean {
    try {
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length));
      }
      const nodes: MemoryNode[] = JSON.parse(decrypted);
      
      if (Array.isArray(nodes) && nodes.every(n => this.validateNode(n))) {
        this.nodes = nodes;
        this.persist();
        this.triggerAutoBackup();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private validateNode(node: any): node is MemoryNode {
    return node &&
      typeof node.id === 'string' &&
      typeof node.content === 'string' &&
      typeof node.type === 'string' &&
      ['FACT', 'PREFERENCE', 'EPISODE', 'SUMMARY'].includes(node.type) &&
      Array.isArray(node.tags) &&
      typeof node.created === 'number';
  }

  // ==================== BACKUP SYSTEM ====================

  public getBackupConfig(): MemoryBackupConfig {
    const saved = localStorage.getItem(this.backupConfigKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      autoBackup: false,
      backupInterval: 60,
      maxBackups: 10,
      encryptBackups: false
    };
  }

  public setBackupConfig(config: Partial<MemoryBackupConfig>): void {
    const current = this.getBackupConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(this.backupConfigKey, JSON.stringify(updated));
    this.initAutoBackup();
  }

  private initAutoBackup(): void {
    // Clear existing interval
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
      this.backupIntervalId = null;
    }

    const config = this.getBackupConfig();
    if (config.autoBackup && config.backupInterval > 0) {
      this.backupIntervalId = window.setInterval(() => {
        this.createBackup();
      }, config.backupInterval * 60 * 1000);
    }
  }

  private triggerAutoBackup(): void {
    const config = this.getBackupConfig();
    if (config.autoBackup) {
      // Debounce: wait 5 seconds after last change
      if (this.backupTimeout) {
        clearTimeout(this.backupTimeout);
      }
      this.backupTimeout = window.setTimeout(() => {
        this.createBackup();
      }, 5000);
    }
  }

  private backupTimeout: number | null = null;

  public createBackup(): string {
    const config = this.getBackupConfig();
    const timestamp = Date.now();
    
    const backupData: MemoryExportData = {
      version: '1.0',
      exportedAt: timestamp,
      nodeCount: this.nodes.length,
      nodes: [...this.nodes],
      checksum: this.generateChecksum(JSON.stringify(this.nodes))
    };

    // Get existing backups
    const backups = this.getBackups();
    
    // Add new backup
    backups.push({
      id: `backup_${timestamp}`,
      timestamp,
      data: backupData
    });

    // Trim to maxBackups
    while (backups.length > config.maxBackups) {
      backups.shift();
    }

    // Save
    localStorage.setItem(this.backupKey, JSON.stringify(backups));
    
    return `backup_${timestamp}`;
  }

  public getBackups(): Array<{ id: string; timestamp: number; data: MemoryExportData }> {
    const saved = localStorage.getItem(this.backupKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }

  public restoreBackup(backupId: string): boolean {
    const backups = this.getBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (backup && backup.data && backup.data.nodes) {
      this.nodes = [...backup.data.nodes];
      this.persist();
      return true;
    }
    return false;
  }

  public deleteBackup(backupId: string): boolean {
    const backups = this.getBackups();
    const filtered = backups.filter(b => b.id !== backupId);
    
    if (filtered.length < backups.length) {
      localStorage.setItem(this.backupKey, JSON.stringify(filtered));
      return true;
    }
    return false;
  }

  public clearAllBackups(): void {
    localStorage.removeItem(this.backupKey);
  }

  /**
   * Get memory statistics
   */
  public getStats(): {
    totalNodes: number;
    byType: Record<MemoryType, number>;
    oldestMemory: number;
    newestMemory: number;
    totalBackups: number;
  } {
    const byType: Record<MemoryType, number> = { FACT: 0, PREFERENCE: 0, EPISODE: 0, SUMMARY: 0 };
    let oldest = Date.now();
    let newest = 0;

    for (const node of this.nodes) {
      byType[node.type]++;
      if (node.created < oldest) oldest = node.created;
      if (node.created > newest) newest = node.created;
    }

    return {
      totalNodes: this.nodes.length,
      byType,
      oldestMemory: oldest === Date.now() ? 0 : oldest,
      newestMemory: newest,
      totalBackups: this.getBackups().length
    };
  }
}

export const memory = new MemoryCore();
