/**
 * Optimized Memory Service
 * Features: Indexed search, caching, lazy loading, and efficient storage
 */

import { MemoryNode, MemoryType, MemorySearchResult } from "../types";
import { optimizer } from "./performance";
import { vectorDB } from "./vectorDB";
import { vectorDBSync } from "./vectorDBSyncService";
import { logger } from "./logger";
import { eventSourcing, EventSourcingStats, ReplayResult, MemoryEvent } from "./eventSourcing";
import { memoryCompression, CompressionStats } from "./memoryCompression";

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
  backupInterval: number;
  maxBackups: number;
  encryptBackups: boolean;
}

// Search index for fast lookups
interface SearchIndex {
  wordToNodes: Map<string, Set<string>>;
  tagToNodes: Map<string, Set<string>>;
  typeToNodes: Map<MemoryType, Set<string>>;
}

export class MemoryCoreOptimized {
  public nodes: Map<string, MemoryNode> = new Map();
  private storageKey = 'jarvis_memory_banks_v2';
  private backupKey = 'jarvis_memory_backups';
  private backupConfigKey = 'jarvis_memory_backup_config';
  private backupIntervalId: number | null = null;

  // Observer pattern for UI updates
  private observers: (() => void)[] = [];

  // Search index for O(1) lookups
  private searchIndex: SearchIndex = {
    wordToNodes: new Map(),
    tagToNodes: new Map(),
    typeToNodes: new Map()
  };
  
  // Lazy loading state
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    // Defer loading until first access
    this.scheduleAutoBackup();
  }

  // ==================== LAZY LOADING ====================

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    
    if (this.loadPromise) {
      return this.loadPromise;
    }
    
    this.loadPromise = this.loadFromStorage();
    return this.loadPromise;
  }

  private async loadFromStorage(): Promise<void> {
    return optimizer.measure('memory.load', () => {
      const saved = localStorage.getItem(this.storageKey);
      
      if (saved) {
        try {
          const nodesArray: MemoryNode[] = JSON.parse(saved);
          // Convert array to Map for O(1) access
          nodesArray.forEach(node => {
            this.nodes.set(node.id, node);
          });
        } catch (e) {
          console.warn('[MEMORY] Failed to parse saved memories, using defaults');
          this.loadDefaults();
        }
      } else {
        this.loadDefaults();
      }
      
      // Build search index
      this.rebuildIndex();
      this.isLoaded = true;
      
      // Sync existing memories to Vector DB (migration)
      this.syncToVectorDB();
    });
  }

  /**
   * Sync all existing memories to Vector DB (one-time migration)
   * Uses batched processing for efficiency
   * Returns number of memories queued for sync
   */
  public async syncToVectorDB(): Promise<number> {
    try {
      const allNodes = Array.from(this.nodes.values());
      
      // Queue all nodes for batch sync
      vectorDBSync.queueBatchStore(
        allNodes.map(node => ({
          id: node.id,
          content: node.content,
          type: node.type,
          tags: node.tags,
          created: node.created,
          lastAccessed: node.lastAccessed || node.created
        })),
        'low'
      );
      
      // Trigger immediate sync with larger batch size
      const result = await vectorDBSync.syncNow();
      
      if (result.success > 0) {
        logger.log('MEMORY', `Migrated ${result.success} memories to Vector DB`, 'info');
      }
      return result.success;
    } catch (error) {
      logger.log('MEMORY', `Vector DB migration failed: ${error}`, 'warning');
      return 0;
    }
  }

  private loadDefaults(): void {
    INITIAL_MEMORY.forEach(node => {
      this.nodes.set(node.id, node);
    });
  }

  // ==================== INDEXING ====================

  private rebuildIndex(): void {
    this.searchIndex = {
      wordToNodes: new Map(),
      tagToNodes: new Map(),
      typeToNodes: new Map()
    };
    
    this.nodes.forEach(node => {
      this.indexNode(node);
    });
  }

  private indexNode(node: MemoryNode): void {
    // Index words in content
    const words = this.tokenize(node.content);
    words.forEach(word => {
      if (!this.searchIndex.wordToNodes.has(word)) {
        this.searchIndex.wordToNodes.set(word, new Set());
      }
      this.searchIndex.wordToNodes.get(word)!.add(node.id);
    });
    
    // Index tags
    node.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      if (!this.searchIndex.tagToNodes.has(normalizedTag)) {
        this.searchIndex.tagToNodes.set(normalizedTag, new Set());
      }
      this.searchIndex.tagToNodes.get(normalizedTag)!.add(node.id);
    });
    
    // Index type
    if (!this.searchIndex.typeToNodes.has(node.type)) {
      this.searchIndex.typeToNodes.set(node.type, new Set());
    }
    this.searchIndex.typeToNodes.get(node.type)!.add(node.id);
  }

  private removeFromIndex(nodeId: string): void {
    // Remove from word index
    this.searchIndex.wordToNodes.forEach((nodeIds, word) => {
      nodeIds.delete(nodeId);
      if (nodeIds.size === 0) {
        this.searchIndex.wordToNodes.delete(word);
      }
    });
    
    // Remove from tag index
    this.searchIndex.tagToNodes.forEach((nodeIds, tag) => {
      nodeIds.delete(nodeId);
      if (nodeIds.size === 0) {
        this.searchIndex.tagToNodes.delete(tag);
      }
    });
    
    // Remove from type index
    this.searchIndex.typeToNodes.forEach((nodeIds, type) => {
      nodeIds.delete(nodeId);
      if (nodeIds.size === 0) {
        this.searchIndex.typeToNodes.delete(type);
      }
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  // ==================== PERSISTENCE ====================

  private persistDebounced = optimizer.debounce(() => {
    this.persist();
  }, 500, false);

  private persist(): void {
    try {
      const nodesArray = Array.from(this.nodes.values());
      localStorage.setItem(this.storageKey, JSON.stringify(nodesArray));
    } catch (e) {
      console.error('[MEMORY] Failed to persist:', e);
    }
  }

  private generateId(): string {
    return 'mem_' + Math.random().toString(36).substring(2, 11);
  }

  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  // ==================== PUBLIC API ====================

  public async getAll(): Promise<MemoryNode[]> {
    await this.ensureLoaded();
    return memoryCompression.decompressBatch(
      Array.from(this.nodes.values()).sort((a, b) => b.created - a.created)
    );
  }

  public async getByType(type: MemoryType): Promise<MemoryNode[]> {
    await this.ensureLoaded();
    const nodeIds = this.searchIndex.typeToNodes.get(type);
    if (!nodeIds) return [];
    
    const nodes = Array.from(nodeIds)
      .map(id => this.nodes.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.created - a.created);
    
    return memoryCompression.decompressBatch(nodes);
  }

  private readonly MAX_NODES = 10000; // Prevent unbounded memory growth
  
  public async store(content: string, type: MemoryType = 'FACT', tags: string[] = []): Promise<MemoryNode> {
    await this.ensureLoaded();
    
    // Enforce maximum node limit to prevent memory bloat
    if (this.nodes.size >= this.MAX_NODES) {
      // Remove oldest nodes (first 10% of max)
      const nodesToRemove = Math.floor(this.MAX_NODES * 0.1);
      const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.created - b.created);
      for (let i = 0; i < nodesToRemove && i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        this.nodes.delete(node.id);
        this.removeFromIndex(node.id);
        // Record deletion event for removed nodes
        await eventSourcing.recordDeleted(node, 'SYSTEM');
      }
      console.warn(`[MEMORY] Reached max capacity (${this.MAX_NODES}), removed ${nodesToRemove} oldest nodes`);
    }
    
    const newNode: MemoryNode = {
      id: this.generateId(),
      content,
      type,
      tags,
      created: Date.now(),
      lastAccessed: Date.now()
    };
    
    // Index BEFORE compression (search index needs original content)
    this.indexNode(newNode);
    
    // Compress for storage (if exceeds threshold)
    const compressedNode = memoryCompression.compress(newNode);
    
    // Store compressed version
    this.nodes.set(compressedNode.id, compressedNode);
    this.persistDebounced();
    this.triggerAutoBackup();
    
    // Record event for audit trail
    await eventSourcing.recordCreated(newNode, 'USER');
    
    // Queue for Vector DB sync (use original content for embeddings)
    vectorDBSync.queueStore(newNode, 'normal');
    
    this.notify();

    // Return original (uncompressed) node to caller
    return newNode;
  }

  public async recall(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    await this.ensureLoaded();

    // Check cache first
    const cacheKey = `recall_${query}_${limit}`;
    const cached = optimizer.get<MemorySearchResult[]>('memory', cacheKey, 5000);
    if (cached) return cached;

    const queryLower = query.toLowerCase();
    const queryWords = this.tokenize(query);

    // Use index for fast candidate selection
    const candidateIds = new Set<string>();

    // Add nodes matching query words
    queryWords.forEach(word => {
      const matches = this.searchIndex.wordToNodes.get(word);
      if (matches) {
        matches.forEach(id => candidateIds.add(id));
      }
    });

    // If no word matches, search all nodes (fallback)
    if (candidateIds.size === 0) {
      this.nodes.forEach((_, id) => candidateIds.add(id));
    }

    // Special handling for user identity queries
    const isIdentityQuery = this.isIdentityQuery(queryLower);

    // Score candidates
    const results: MemorySearchResult[] = [];

    candidateIds.forEach(id => {
      const node = this.nodes.get(id);
      if (!node) return;

      let score = 0;
      const contentLower = node.content.toLowerCase();

      // Exact match bonus
      if (contentLower.includes(queryLower)) score += 2.0;

      // Word match scoring
      queryWords.forEach(word => {
        if (contentLower.includes(word)) score += 0.5;
        if (node.tags.some(t => t.toLowerCase().includes(word))) score += 0.7;
      });

      // Tag match bonus
      node.tags.forEach(tag => {
        if (queryLower.includes(tag.toLowerCase())) score += 0.3;
      });

      // Special boost for user identity if this is an identity query
      if (isIdentityQuery) {
        if (node.tags.includes('user_identity') || node.tags.includes('name') || node.tags.includes('identity')) {
          score += 1.5; // Extra boost for identity-related memories
        }
        // Look for keywords that suggest user information
        if (contentLower.includes('name') || contentLower.includes('called') || contentLower.includes('i am') || contentLower.includes('i\'m')) {
          score += 1.0;
        }
      }

      // Recency boost (decay over 30 days)
      const ageDays = (Date.now() - node.created) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 0.2 - (ageDays * 0.01));

      // Access frequency boost
      if (node.relevanceScore) {
        score += node.relevanceScore * 0.1;
      }

      if (score > 0.1) {
        results.push({ node, score });
      }
    });

    const sorted = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Update relevance scores for accessed memories
    sorted.forEach(({ node }) => {
      node.relevanceScore = (node.relevanceScore || 0) + 0.1;
      node.lastAccessed = Date.now();
    });

    // Decompress nodes before returning
    const decompressed = sorted.map(result => ({
      ...result,
      node: memoryCompression.decompress(result.node)
    }));

    // Cache result (store decompressed)
    optimizer.set('memory', cacheKey, decompressed, 100);

    return decompressed;
  }

  /**
   * Check if the query is asking for user identity information
   */
  private isIdentityQuery(query: string): boolean {
    const identityIndicators = [
      'my name', 'what is my name', 'who am i', 'identify me',
      'remember me', 'my identity', 'call me', 'i am', 'i\'m',
      'what do you know about me', 'personal information'
    ];

    return identityIndicators.some(indicator => query.includes(indicator));
  }

  /**
   * Store user identity information
   */
  public async storeIdentity(name: string, additionalInfo: string = ''): Promise<MemoryNode> {
    const content = additionalInfo ? `${name} - ${additionalInfo}` : name;
    return await this.store(content, 'PREFERENCE', ['user_identity', 'name', 'identity']);
  }

  /**
   * Retrieve user identity information
   */
  public async getUserIdentity(): Promise<MemoryNode | null> {
    const results = await this.recall('user identity');
    if (results.length > 0) {
      return results[0].node;
    }

    // Also try to find by name tag
    const nameResults = await this.recall('name');
    if (nameResults.length > 0) {
      return nameResults[0].node;
    }

    return null;
  }

  public async forget(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const node = this.nodes.get(id);
    if (node) {
      this.removeFromIndex(id);
      this.nodes.delete(id);
      this.persistDebounced();
      this.triggerAutoBackup();
      
      // Record deletion event for audit trail
      await eventSourcing.recordDeleted(node, 'USER');
      
      // Queue delete for Vector DB (batched)
      vectorDBSync.queueDelete(id);
      
      this.notify();
      return true;
    }
    return false;
  }

  public async restore(nodes: MemoryNode[]): Promise<void> {
    await this.ensureLoaded();

    this.nodes.clear();
    
    // Process each node: decompress if needed, then re-compress for storage
    for (const node of nodes) {
      // Decompress if restoring a compressed node
      const decompressedNode = node.compressed 
        ? memoryCompression.decompress(node) 
        : node;
      
      // Compress for storage (if needed)
      const storageNode = memoryCompression.compress(decompressedNode);
      this.nodes.set(storageNode.id, storageNode);
    }

    // Build index from decompressed nodes
    this.rebuildIndex();
    this.persist();
    this.triggerAutoBackup();
    
    // Record restore events for audit trail (use decompressed)
    const decompressedNodes = nodes.map(n => n.compressed ? memoryCompression.decompress(n) : n);
    for (const node of decompressedNodes) {
      await eventSourcing.recordRestored(node, false, 'USER');
    }
    
    // Batch restore to Vector DB (use decompressed)
    vectorDBSync.queueBatchStore(decompressedNodes, 'low');
    
    this.notify();
    
    // Force immediate sync for restore (async, don't block)
    vectorDBSync.syncNow().catch(err => {
      logger.log('MEMORY', `Vector DB batch restore failed: ${err}`, 'warning');
    });
  }

  // ==================== EXPORT/IMPORT ====================

  public async exportToFile(): Promise<void> {
    await this.ensureLoaded();
    
    // Export decompressed nodes for portability
    const nodesArray = memoryCompression.decompressBatch(
      Array.from(this.nodes.values())
    );
    // Remove compression metadata from export
    const cleanNodes = nodesArray.map(({ compressed, originalSize, compressedSize, ...node }) => node);
    
    const exportData: MemoryExportData = {
      version: '2.0',
      exportedAt: Date.now(),
      nodeCount: cleanNodes.length,
      nodes: cleanNodes,
      checksum: this.generateChecksum(JSON.stringify(cleanNodes))
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

  public async importFromFile(file: File): Promise<{ success: boolean; imported: number; errors: string[] }> {
    await this.ensureLoaded();
    
    const errors: string[] = [];
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data: MemoryExportData = JSON.parse(content);
          
          if (!data.nodes || !Array.isArray(data.nodes)) {
            errors.push('Invalid file format: missing nodes array');
            resolve({ success: false, imported: 0, errors });
            return;
          }

          let imported = 0;
          const validNodes: MemoryNode[] = [];
          
          for (const node of data.nodes) {
            if (this.validateNode(node)) {
              node.id = this.generateId();
              validNodes.push(node);
              imported++;
            } else {
              errors.push(`Invalid node skipped: ${JSON.stringify(node).substring(0, 50)}...`);
            }
          }

          if (validNodes.length > 0) {
            for (const node of validNodes) {
              // Decompress if importing a compressed node (for backward compatibility)
              const decompressedNode = node.compressed 
                ? memoryCompression.decompress(node) 
                : node;
              
              // Re-compress for storage if needed
              const storageNode = memoryCompression.compress(decompressedNode);
              
              // Index using decompressed content
              this.indexNode(decompressedNode);
              this.nodes.set(storageNode.id, storageNode);
            }
            this.persist();
            this.triggerAutoBackup();
            
            // Record batch import event for audit trail (use decompressed)
            const auditNodes = validNodes.map(n => n.compressed ? memoryCompression.decompress(n) : n);
            eventSourcing.recordBatchImported(auditNodes, file.name, 'USER').catch(err => {
              logger.log('MEMORY', `Failed to record import event: ${err}`, 'warning');
            });
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

  private scheduleAutoBackup(): void {
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
      optimizer.batch('memory_backup', null, () => {
        this.createBackup();
      }, 5000);
    }
  }

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
    
    // Restart auto-backup with new config
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
    }
    this.scheduleAutoBackup();
  }

  public createBackup(): string {
    const config = this.getBackupConfig();
    const timestamp = Date.now();
    
    // Backup decompressed nodes for data safety
    const nodesArray = memoryCompression.decompressBatch(
      Array.from(this.nodes.values())
    );
    const backupData: MemoryExportData = {
      version: '2.0',
      exportedAt: timestamp,
      nodeCount: nodesArray.length,
      nodes: nodesArray,
      checksum: this.generateChecksum(JSON.stringify(nodesArray))
    };

    const backups = this.getBackups();
    backups.push({
      id: `backup_${timestamp}`,
      timestamp,
      data: backupData
    });

    while (backups.length > config.maxBackups) {
      backups.shift();
    }

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
    
    if (backup?.data?.nodes) {
      this.restore(backup.data.nodes);
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

  public async getStats(): Promise<{
    totalNodes: number;
    byType: Record<MemoryType, number>;
    oldestMemory: number;
    newestMemory: number;
    totalBackups: number;
    indexSize: number;
    eventSourcing: EventSourcingStats;
    compression: CompressionStats;
  }> {
    await this.ensureLoaded();
    
    const byType: Record<MemoryType, number> = { FACT: 0, PREFERENCE: 0, EPISODE: 0, SUMMARY: 0 };
    let oldest = Date.now();
    let newest = 0;

    this.nodes.forEach(node => {
      byType[node.type]++;
      if (node.created < oldest) oldest = node.created;
      if (node.created > newest) newest = node.created;
    });

    // Get event sourcing stats
    const eventStats = await eventSourcing.getStats();
    
    // Get compression stats
    const compressionStats = memoryCompression.getStats(Array.from(this.nodes.values()));

    return {
      totalNodes: this.nodes.size,
      byType,
      oldestMemory: oldest === Date.now() ? 0 : oldest,
      newestMemory: newest,
      totalBackups: this.getBackups().length,
      indexSize: this.searchIndex.wordToNodes.size,
      eventSourcing: eventStats,
      compression: compressionStats
    };
  }

  /**
   * Get Vector DB stats for dashboard
   */
  public async getVectorDBStats(): Promise<{
    totalVectors: number;
    indexSize: number;
    cacheSize: number;
    backend: string;
    embeddingCacheSize: number;
  } | null> {
    try {
      if (!vectorDB.initialized) {
        await vectorDB.initialize();
      }
      return await vectorDB.getStats();
    } catch (error) {
      logger.log('MEMORY', `Failed to get Vector DB stats: ${error}`, 'warning');
      return null;
    }
  }

  // ==================== SUBSCRIPTION ====================

  public subscribe(callback: () => void): () => void {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }

  private notify(): void {
    this.observers.forEach(cb => cb());
  }

  // ==================== VECTOR DB BRIDGE ====================

  /**
   * Get Vector DB sync statistics
   */
  public getVectorDBSyncStats() {
    return vectorDBSync.getStats();
  }

  /**
   * Force immediate Vector DB sync
   */
  public async forceVectorDBSync(): Promise<{ success: number; failed: number }> {
    return vectorDBSync.syncNow();
  }

  /**
   * Semantic recall using Vector DB
   */
  public async recallSemantic(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    try {
      if (!vectorDB.initialized) {
        await vectorDB.initialize();
      }
      
      const results = await vectorDB.search(query, { maxResults: limit, minScore: 0.6 });
      
      // Decompress nodes before returning
      return results.map(result => ({
        ...result,
        node: memoryCompression.decompress(result.node)
      }));
    } catch (error) {
      logger.log('MEMORY', `Semantic recall failed, falling back to keyword search: ${error}`, 'warning');
      return this.recall(query, limit);
    }
  }

  // ==================== EVENT SOURCING ====================

  /**
   * Replay events to rebuild memory state
   * Useful for debugging and time-travel scenarios
   */
  public async replayEvents(
    options: {
      fromTimestamp?: number;
      toTimestamp?: number;
      nodeIds?: string[];
    } = {}
  ): Promise<ReplayResult> {
    return eventSourcing.replay(options);
  }

  /**
   * Undo the last memory operation
   * @returns The undone event, or null if nothing to undo
   */
  public async undo(): Promise<MemoryEvent | null> {
    const event = await eventSourcing.undo();
    if (event) {
      // Rebuild current state from events
      const result = await eventSourcing.replay();
      this.nodes = result.nodes;
      this.rebuildIndex();
      this.persist();
      this.notify();
    }
    return event;
  }

  /**
   * Redo a previously undone operation
   * @returns The redone event, or null if nothing to redo
   */
  public async redo(): Promise<MemoryEvent | null> {
    const event = await eventSourcing.redo();
    if (event) {
      // Rebuild current state from events
      const result = await eventSourcing.replay();
      this.nodes = result.nodes;
      this.rebuildIndex();
      this.persist();
      this.notify();
    }
    return event;
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return eventSourcing.canUndo();
  }

  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return eventSourcing.canRedo();
  }

  /**
   * Get event sourcing statistics
   */
  public async getEventSourcingStats(): Promise<EventSourcingStats> {
    return eventSourcing.getStats();
  }

  /**
   * Get event history for a specific memory node
   */
  public async getNodeHistory(nodeId: string): Promise<MemoryEvent[]> {
    return eventSourcing.getNodeHistory(nodeId);
  }

  /**
   * Get recent events across all memories
   */
  public async getRecentEvents(limit: number = 50): Promise<MemoryEvent[]> {
    return eventSourcing.getRecentEvents(limit);
  }

  /**
   * Export event log for debugging
   */
  public async exportEvents(): Promise<string> {
    return eventSourcing.exportEvents();
  }

  /**
   * Prune old events to free storage
   * @param maxAgeDays Maximum age of events to keep
   * @returns Number of events removed
   */
  public async pruneEvents(maxAgeDays?: number): Promise<number> {
    return eventSourcing.pruneOldEvents(maxAgeDays);
  }

  // ==================== COMPRESSION CONFIGURATION ====================

  /**
   * Get memory compression configuration
   */
  public getCompressionConfig() {
    return memoryCompression.getConfig();
  }

  /**
   * Update memory compression configuration
   */
  public setCompressionConfig(config: { enabled?: boolean; threshold?: number }): void {
    memoryCompression.setConfig(config);
  }

  /**
   * Enable memory compression
   */
  public enableCompression(): void {
    memoryCompression.enable();
  }

  /**
   * Disable memory compression
   */
  public disableCompression(): void {
    memoryCompression.disable();
  }

  /**
   * Check if memory compression is enabled
   */
  public isCompressionEnabled(): boolean {
    return memoryCompression.isEnabled();
  }

  /**
   * Get compression statistics
   */
  public getCompressionStats(): CompressionStats {
    return memoryCompression.getStats(Array.from(this.nodes.values()));
  }
}

// Re-export event sourcing types for convenience
export type {
  MemoryEvent,
  MemoryEventType,
  MemoryCreatedEvent,
  MemoryUpdatedEvent,
  MemoryDeletedEvent,
  MemoryRestoredEvent,
  MemoryBatchImportedEvent,
  MemoryCompactedEvent,
  EventSourcingStats,
  ReplayResult
} from './eventSourcing';

// Re-export compression types
export type { CompressionStats, MemoryCompressionConfig } from './memoryCompression';

// Export both the class (for testing) and the singleton instance (for app use)
export const memory = new MemoryCoreOptimized();
export { MemoryCoreOptimized as MemoryService };
