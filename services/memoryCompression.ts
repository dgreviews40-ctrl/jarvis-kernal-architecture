/**
 * Memory Compression Service
 * Compresses memory node content >1KB to reduce storage usage
 * Transparent to callers - compress on write, decompress on read
 */

import { LZString } from './compressedStorage';
import { MemoryNode } from '../types';

export interface MemoryCompressionConfig {
  /** Minimum content size (in bytes) to trigger compression (default: 1024) */
  threshold: number;
  /** Enable/disable compression (default: true) */
  enabled: boolean;
}

export interface CompressionStats {
  /** Total number of compressed nodes */
  compressedCount: number;
  /** Total number of uncompressed nodes */
  uncompressedCount: number;
  /** Original size of all content (bytes) */
  originalSize: number;
  /** Compressed size of all content (bytes) */
  compressedSize: number;
  /** Compression ratio (0-1, higher is better) */
  ratio: number;
  /** Estimated space saved in bytes */
  spaceSaved: number;
}

const DEFAULT_CONFIG: MemoryCompressionConfig = {
  threshold: 1024, // 1KB
  enabled: true
};

class MemoryCompressionService {
  private config: MemoryCompressionConfig;

  constructor(config: Partial<MemoryCompressionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compress a memory node if content exceeds threshold
   * Returns the node (modified if compressed)
   */
  compress(node: MemoryNode): MemoryNode {
    if (!this.config.enabled) return node;
    if (node.compressed) return node; // Already compressed

    const contentSize = new Blob([node.content]).size;
    if (contentSize < this.config.threshold) return node;

    try {
      const compressed = LZString.compress(node.content);
      const compressedSize = new Blob([compressed]).size;

      // Only use compression if it actually saves space
      if (compressedSize < contentSize * 0.9) {
        return {
          ...node,
          content: compressed,
          compressed: true,
          originalSize: contentSize,
          compressedSize: compressedSize
        };
      }
    } catch (error) {
      console.warn('[MEMORY_COMPRESSION] Failed to compress node:', node.id, error);
    }

    return node;
  }

  /**
   * Decompress a memory node if it was compressed
   * Returns the node with original content
   */
  decompress(node: MemoryNode): MemoryNode {
    if (!node.compressed) return node;

    try {
      const decompressed = LZString.decompress(node.content);
      if (decompressed !== null && decompressed !== undefined) {
        return {
          ...node,
          content: decompressed,
          compressed: undefined,
          originalSize: undefined,
          compressedSize: undefined
        };
      }
    } catch (error) {
      console.error('[MEMORY_COMPRESSION] Failed to decompress node:', node.id, error);
    }

    // Return original if decompression fails
    return node;
  }

  /**
   * Check if a node should be compressed based on current config
   */
  shouldCompress(node: MemoryNode): boolean {
    if (!this.config.enabled) return false;
    if (node.compressed) return false;
    const contentSize = new Blob([node.content]).size;
    return contentSize >= this.config.threshold;
  }

  /**
   * Get compression statistics for a set of nodes
   */
  getStats(nodes: MemoryNode[]): CompressionStats {
    let compressedCount = 0;
    let uncompressedCount = 0;
    let originalSize = 0;
    let compressedSize = 0;

    for (const node of nodes) {
      if (node.compressed && node.originalSize && node.compressedSize) {
        compressedCount++;
        originalSize += node.originalSize;
        compressedSize += node.compressedSize;
      } else {
        uncompressedCount++;
        originalSize += new Blob([node.content]).size;
        compressedSize += new Blob([node.content]).size;
      }
    }

    const spaceSaved = originalSize - compressedSize;
    const ratio = originalSize > 0 ? Math.round((spaceSaved / originalSize) * 100) / 100 : 0;

    return {
      compressedCount,
      uncompressedCount,
      originalSize,
      compressedSize,
      ratio,
      spaceSaved
    };
  }

  /**
   * Batch compress multiple nodes
   */
  compressBatch(nodes: MemoryNode[]): MemoryNode[] {
    return nodes.map(node => this.compress(node));
  }

  /**
   * Batch decompress multiple nodes
   */
  decompressBatch(nodes: MemoryNode[]): MemoryNode[] {
    return nodes.map(node => this.decompress(node));
  }

  /**
   * Update compression configuration
   */
  setConfig(config: Partial<MemoryCompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current compression configuration
   */
  getConfig(): MemoryCompressionConfig {
    return { ...this.config };
  }

  /**
   * Check if compression is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable compression
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable compression
   */
  disable(): void {
    this.config.enabled = false;
  }
}

// Export singleton instance
export const memoryCompression = new MemoryCompressionService();

// Export class for custom instances
export { MemoryCompressionService };
