/**
 * Resource Preloader Service
 * Intelligently preloads critical and predicted resources
 * Reduces perceived load times through predictive loading
 */

interface Resource {
  url: string;
  type: 'script' | 'style' | 'image' | 'font' | 'fetch';
  priority: 'critical' | 'high' | 'normal' | 'low';
  size?: number;
}

interface PreloadConfig {
  maxConcurrent: number;
  maxCacheSize: number;
  prefetchDelay: number;
  idleTimeout: number;
}

interface LoadedResource {
  url: string;
  data: unknown;
  size: number;
  loadTime: number;
  accessCount: number;
}

const DEFAULT_CONFIG: PreloadConfig = {
  maxConcurrent: 6,
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  prefetchDelay: 100,
  idleTimeout: 2000
};

class ResourceLoader {
  private config: PreloadConfig;
  private cache = new Map<string, LoadedResource>();
  private loading = new Set<string>();
  private queue: Resource[] = [];
  private idleCallback: number | null = null;
  private currentCacheSize = 0;

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Preload a single resource
   */
  async preload(resource: Resource): Promise<boolean> {
    // Check cache
    if (this.cache.has(resource.url)) {
      return true;
    }

    // Check if already loading
    if (this.loading.has(resource.url)) {
      return true;
    }

    // Add to queue based on priority
    this.enqueue(resource);
    this.processQueue();
    return true;
  }

  /**
   * Preload multiple resources
   */
  async preloadMany(resources: Resource[]): Promise<void> {
    for (const resource of resources) {
      this.enqueue(resource);
    }
    this.processQueue();
  }

  /**
   * Load critical resources immediately
   */
  async loadCritical(resources: Resource[]): Promise<void> {
    const critical = resources.filter(r => r.priority === 'critical');
    await Promise.all(
      critical.map(r => this.loadResource(r))
    );
  }

  /**
   * Schedule prefetching when browser is idle
   */
  prefetchWhenIdle(resources: Resource[]): void {
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
    }

    this.idleCallback = requestIdleCallback(
      (deadline) => {
        for (const resource of resources) {
          if (deadline.timeRemaining() <= 0) break;
          
          if (!this.cache.has(resource.url) && !this.loading.has(resource.url)) {
            this.loadResource(resource).catch(() => {
              // Ignore prefetch errors
            });
          }
        }
      },
      { timeout: this.config.idleTimeout }
    );
  }

  /**
   * Get a cached resource
   */
  get<T>(url: string): T | null {
    const resource = this.cache.get(url);
    if (resource) {
      resource.accessCount++;
      return resource.data as T;
    }
    return null;
  }

  /**
   * Check if resource is available
   */
  has(url: string): boolean {
    return this.cache.has(url) || this.loading.has(url);
  }

  /**
   * Get loader statistics
   */
  getStats(): {
    cachedResources: number;
    cacheSizeMB: number;
    loadingCount: number;
    queuedCount: number;
  } {
    return {
      cachedResources: this.cache.size,
      cacheSizeMB: Math.round(this.currentCacheSize / 1024 / 1024 * 100) / 100,
      loadingCount: this.loading.size,
      queuedCount: this.queue.length
    };
  }

  /**
   * Clear all cached resources
   */
  clear(): void {
    this.cache.clear();
    this.loading.clear();
    this.queue = [];
    this.currentCacheSize = 0;
    
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
      this.idleCallback = null;
    }
  }

  private enqueue(resource: Resource): void {
    // Insert based on priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const resourcePriority = priorityOrder[resource.priority];

    const insertIndex = this.queue.findIndex(
      r => priorityOrder[r.priority] > resourcePriority
    );

    if (insertIndex === -1) {
      this.queue.push(resource);
    } else {
      this.queue.splice(insertIndex, 0, resource);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.loading.size >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const resource = this.queue.shift()!;
    
    this.loading.add(resource.url);

    try {
      await this.loadResource(resource);
    } finally {
      this.loading.delete(resource.url);
      // Process next
      setTimeout(() => this.processQueue(), 0);
    }
  }

  private async loadResource(resource: Resource): Promise<void> {
    try {
      let data: unknown;
      let size = 0;

      switch (resource.type) {
        case 'script':
          await this.loadScript(resource.url);
          data = true;
          size = resource.size || 0;
          break;

        case 'style':
          await this.loadStyle(resource.url);
          data = true;
          size = resource.size || 0;
          break;

        case 'image':
          const img = await this.loadImage(resource.url);
          data = img;
          size = resource.size || 0;
          break;

        case 'font':
          await this.loadFont(resource.url);
          data = true;
          size = resource.size || 0;
          break;

        case 'fetch':
          const response = await fetch(resource.url);
          data = await response.json();
          size = JSON.stringify(data).length;
          break;
      }

      // Check cache size before adding
      if (this.currentCacheSize + size > this.config.maxCacheSize) {
        this.evictLRU(size);
      }

      this.cache.set(resource.url, {
        url: resource.url,
        data,
        size,
        loadTime: Date.now(),
        accessCount: 0
      });

      this.currentCacheSize += size;

    } catch (error) {
      console.warn(`[RESOURCE LOADER] Failed to load ${resource.url}:`, error);
      throw error;
    }
  }

  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  private loadStyle(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load style: ${url}`));
      document.head.appendChild(link);
    });
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private async loadFont(url: string): Promise<void> {
    const fontFace = new FontFace('PreloadedFont', `url(${url})`);
    await fontFace.load();
    document.fonts.add(fontFace);
  }

  private evictLRU(neededSpace: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by access count and last load time
    entries.sort((a, b) => {
      if (a[1].accessCount !== b[1].accessCount) {
        return a[1].accessCount - b[1].accessCount;
      }
      return a[1].loadTime - b[1].loadTime;
    });

    let freed = 0;
    for (const [url, resource] of entries) {
      if (freed >= neededSpace) break;
      
      this.cache.delete(url);
      this.currentCacheSize -= resource.size;
      freed += resource.size;
    }
  }
}

// Export singleton
export const resourceLoader = new ResourceLoader();

// Export class for custom instances
export { ResourceLoader };

/**
 * React hook for resource loading
 */
export function useResourceLoader() {
  const preload = React.useCallback((resource: Resource) => {
    return resourceLoader.preload(resource);
  }, []);

  const getResource = React.useCallback(<T,>(url: string): T | null => {
    return resourceLoader.get<T>(url);
  }, []);

  return { preload, getResource, stats: resourceLoader.getStats() };
}

// React import for the hook
import React from 'react';
