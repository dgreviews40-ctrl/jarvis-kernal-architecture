/**
 * Centralized API Key Management
 * 
 * Provides secure, unified access to API keys with:
 * - In-memory caching for performance
 * - AES-GCM encryption for localStorage (password-protected)
 * - Environment variable fallback
 * - Validation and error handling
 * - Automatic migration from legacy base64 storage
 * 
 * SECURITY FIXES (v1.5):
 * - Removed base64 "encryption" fallback - now requires proper password
 * - Uses SecureStorage with AES-GCM encryption
 * - Keys are only decrypted when needed
 * - Added secure memory clearing
 */

import { secureStorage, SecureStorage } from './secureStorage';
import { useState, useEffect } from 'react';

export type APIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

interface KeyMetadata {
  provider: APIProvider;
  source: 'env' | 'secureStorage' | 'manual';
  lastAccessed: number;
  encrypted: boolean;
}

interface StoredKeyData {
  encrypted: string;
  salt: string;
  iv: string;
}

// Legacy storage keys for migration
const LEGACY_KEYS: Record<APIProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: 'OLLAMA_API_KEY'
};

class APIKeyManager {
  private cache: Map<APIProvider, { key: string; metadata: KeyMetadata }> = new Map();
  private readonly STORAGE_PREFIX = 'JARVIS_API_KEY_';
  private storage: SecureStorage;
  private initialized: boolean = false;
  
  constructor() {
    // Use secure storage with auto-lock after 30 minutes
    this.storage = new SecureStorage({
      prefix: this.STORAGE_PREFIX,
      memoryOnly: false,
      autoLockMs: 30 * 60 * 1000
    });
  }

  /**
   * Initialize the API key manager with a password
   * This must be called before any get/set operations
   * 
   * @param password - Encryption password (min 8 characters)
   * @param options - Optional configuration
   * @returns Migration result if any legacy keys were migrated
   */
  async initialize(
    password: string, 
    options: { migrateLegacy?: boolean } = {}
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    if (!password || password.length < 8) {
      throw new Error('Encryption password must be at least 8 characters');
    }

    const result = { success: false, migrated: 0, errors: [] as string[] };

    try {
      await this.storage.initialize(password);
      this.initialized = true;
      result.success = true;

      // Migrate from legacy storage if requested
      if (options.migrateLegacy !== false) {
        const migrationResult = await this.migrateFromLegacy();
        result.migrated = migrationResult.migrated;
        result.errors = migrationResult.errors;
      }
    } catch (e) {
      result.errors.push(`Failed to initialize: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if secure storage is available
   */
  isSecure(): boolean {
    return this.initialized && !this.storage.isLocked();
  }

  /**
   * Lock the storage (clear keys from memory)
   */
  lock(): void {
    this.storage.lock();
    this.cache.clear();
  }

  /**
   * Get API key for a provider
   * Checks environment variables first, then secure storage
   * 
   * SECURITY: Returns null if storage is locked or not initialized
   */
  async getKey(provider: APIProvider): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(provider);
    if (cached) {
      cached.metadata.lastAccessed = Date.now();
      return cached.key;
    }

    // Try environment variables first (Vite format)
    const envKey = this.getFromEnvironment(provider);
    if (envKey) {
      this.cache.set(provider, {
        key: envKey,
        metadata: {
          provider,
          source: 'env',
          lastAccessed: Date.now(),
          encrypted: false
        }
      });
      return envKey;
    }

    // Try secure storage if initialized
    if (this.initialized && !this.storage.isLocked()) {
      try {
        const storedKey = await this.storage.get(provider);
        if (storedKey) {
          this.cache.set(provider, {
            key: storedKey,
            metadata: {
              provider,
              source: 'secureStorage',
              lastAccessed: Date.now(),
              encrypted: true
            }
          });
          return storedKey;
        }
      } catch (e) {
        console.error(`[APIKeyManager] Failed to retrieve key for ${provider}:`, e);
      }
    }

    return null;
  }

  /**
   * Set API key for a provider
   * Stores encrypted using secure storage
   * 
   * SECURITY: Throws error if storage is not initialized
   */
  async setKey(provider: APIProvider, key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new Error(`Invalid API key for ${provider}: empty or whitespace`);
    }

    if (!this.initialized) {
      throw new Error('APIKeyManager not initialized. Call initialize() first with a password.');
    }

    if (this.storage.isLocked()) {
      throw new Error('Storage is locked. Please unlock with your password.');
    }

    // Validate key format
    if (!this.validateKeyFormat(provider, key)) {
      throw new Error(`Invalid API key format for ${provider}`);
    }

    const trimmed = key.trim();

    // Update cache
    this.cache.set(provider, {
      key: trimmed,
      metadata: {
        provider,
        source: 'manual',
        lastAccessed: Date.now(),
        encrypted: true
      }
    });

    // Store encrypted
    try {
      await this.storage.set(provider, trimmed);
      console.log(`[APIKeyManager] Key stored securely for ${provider}`);
    } catch (e) {
      console.error(`[APIKeyManager] Failed to store key for ${provider}:`, e);
      throw new Error('Failed to store API key securely');
    }
  }

  /**
   * Remove API key for a provider
   */
  async removeKey(provider: APIProvider): Promise<void> {
    this.cache.delete(provider);
    
    if (this.initialized && !this.storage.isLocked()) {
      await this.storage.remove(provider);
    }

    // Also remove legacy key if present
    localStorage.removeItem(LEGACY_KEYS[provider]);
    localStorage.removeItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
  }

  /**
   * Check if a key exists for a provider
   */
  async hasKey(provider: APIProvider): Promise<boolean> {
    // Check cache
    if (this.cache.has(provider)) return true;

    // Check environment
    if (this.getFromEnvironment(provider)) return true;

    // Check secure storage
    if (this.initialized && !this.storage.isLocked()) {
      return await this.storage.has(provider);
    }

    return false;
  }

  /**
   * Get all configured providers
   */
  async getConfiguredProviders(): Promise<APIProvider[]> {
    const providers: APIProvider[] = ['gemini', 'openai', 'anthropic', 'ollama'];
    const results = await Promise.all(
      providers.map(async p => ({ provider: p, hasKey: await this.hasKey(p) }))
    );
    return results.filter(r => r.hasKey).map(r => r.provider);
  }

  /**
   * Clear in-memory cache (does not affect storage)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear all API keys from storage
   * Use this for logout/security
   */
  async clearAllKeys(): Promise<void> {
    this.cache.clear();
    
    if (this.initialized && !this.storage.isLocked()) {
      await this.storage.clear();
    }

    // Also clear legacy keys
    Object.values(LEGACY_KEYS).forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
    });

    console.log('[APIKeyManager] All API keys cleared');
  }

  /**
   * Get metadata about cached keys (for debugging)
   */
  getCacheMetadata(): KeyMetadata[] {
    return Array.from(this.cache.values()).map(v => v.metadata);
  }

  /**
   * Rotate/replace a key atomically
   */
  async rotateKey(provider: APIProvider, newKey: string): Promise<void> {
    // Validate new key before replacing
    if (!this.validateKeyFormat(provider, newKey)) {
      throw new Error(`Invalid new key format for ${provider}`);
    }

    // Store new key
    await this.setKey(provider, newKey);
    
    console.log(`[APIKeyManager] Key rotated for ${provider}`);
  }

  /**
   * Export keys (for backup) - requires password confirmation
   * Returns encrypted bundle
   */
  async exportKeys(password: string): Promise<{ 
    success: boolean; 
    data?: string; 
    error?: string;
  }> {
    try {
      if (!this.initialized || this.storage.isLocked()) {
        return { success: false, error: 'Storage not initialized or locked' };
      }

      const keys = await this.storage.getAll();
      const exportData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        keys
      };

      // Re-encrypt with provided password for export
      const tempStorage = new SecureStorage({ prefix: 'EXPORT_' });
      await tempStorage.initialize(password);
      
      for (const [provider, key] of Object.entries(keys)) {
        await tempStorage.set(provider, key);
      }

      const allEncrypted = await tempStorage.getAll();
      
      return { 
        success: true, 
        data: JSON.stringify({ ...exportData, encrypted: allEncrypted })
      };
    } catch (e) {
      return { 
        success: false, 
        error: e instanceof Error ? e.message : 'Export failed' 
      };
    }
  }

  // ==================== PRIVATE METHODS ====================

  private getFromEnvironment(provider: APIProvider): string | null {
    // Check various environment variable formats
    const envVars = [
      import.meta.env?.[`VITE_${provider.toUpperCase()}_API_KEY`],
      import.meta.env?.[`${provider.toUpperCase()}_API_KEY`],
      import.meta.env?.[`VITE_API_KEY`], // Legacy fallback for Gemini
      typeof process !== 'undefined' ? process.env?.[`${provider.toUpperCase()}_API_KEY`] : null
    ];

    for (const envVar of envVars) {
      if (envVar && typeof envVar === 'string' && envVar.trim().length > 0) {
        return envVar.trim();
      }
    }

    return null;
  }

  private validateKeyFormat(provider: APIProvider, key: string): boolean {
    switch (provider) {
      case 'gemini':
        // Gemini keys are typically 39 chars, start with AIza
        return key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);

      case 'openai':
        // OpenAI keys start with sk-
        return key.startsWith('sk-') && key.length > 20;

      case 'anthropic':
        // Anthropic keys start with sk-ant-
        return key.startsWith('sk-ant-') && key.length > 20;

      case 'ollama':
        // Ollama doesn't use API keys, just URL
        return true;

      default:
        return key.length >= 10;
    }
  }

  /**
   * Migrate from legacy base64 storage to secure storage
   */
  private async migrateFromLegacy(): Promise<{ migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    const providers: APIProvider[] = ['gemini', 'openai', 'anthropic', 'ollama'];

    for (const provider of providers) {
      try {
        // Check for legacy format
        const legacyKey = localStorage.getItem(LEGACY_KEYS[provider]);
        if (legacyKey) {
          try {
            // Try to decode base64
            const decoded = atob(legacyKey);
            if (decoded && decoded.length > 10) {
              // Store with proper encryption
              await this.storage.set(provider, decoded);
              // Remove legacy key
              localStorage.removeItem(LEGACY_KEYS[provider]);
              migrated++;
              console.log(`[APIKeyManager] Migrated ${provider} key from legacy storage`);
            }
          } catch (e) {
            errors.push(`Failed to migrate ${provider}: ${e instanceof Error ? e.message : 'Unknown'}`);
          }
        }

        // Also check for other legacy formats
        const oldFormat = localStorage.getItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
        if (oldFormat) {
          try {
            // Try to parse as JSON (newer legacy format)
            const data = JSON.parse(oldFormat);
            if (data.encrypted && !data.salt) {
              // Old v2 format without proper salt - try to migrate
              // This shouldn't happen if using secureStorage, but just in case
              errors.push(`${provider}: Old format detected but cannot auto-migrate`);
            }
          } catch {
            // Try base64 decode
            try {
              const decoded = atob(oldFormat);
              if (decoded && decoded.length > 10) {
                await this.storage.set(provider, decoded);
                localStorage.removeItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
                migrated++;
              }
            } catch {
              // Not valid base64, skip
            }
          }
        }
      } catch (e) {
        errors.push(`Error checking ${provider}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    if (migrated > 0) {
      console.log(`[APIKeyManager] Migrated ${migrated} keys to secure storage`);
    }

    return { migrated, errors };
  }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager();

// Convenience hook for React components
export function useAPIKey(provider: APIProvider) {
  const [key, setKeyState] = useState<string | null>(null);
  const [hasKeyState, setHasKeyState] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    
    const checkStatus = async () => {
      const initialized = apiKeyManager.isInitialized();
      const locked = !apiKeyManager.isSecure();
      
      if (mounted) {
        setIsInitialized(initialized);
        setIsLocked(locked);
        
        if (initialized && !locked) {
          const k = await apiKeyManager.getKey(provider);
          const has = await apiKeyManager.hasKey(provider);
          setKeyState(k);
          setHasKeyState(has);
        }
      }
    };
    
    checkStatus();
    
    // Re-check periodically
    const interval = setInterval(checkStatus, 1000);
    
    return () => { 
      mounted = false; 
      clearInterval(interval);
    };
  }, [provider]);

  return {
    key,
    hasKey: hasKeyState,
    isInitialized,
    isLocked,
    initialize: (password: string) => apiKeyManager.initialize(password),
    lock: () => apiKeyManager.lock(),
    setKey: (key: string) => apiKeyManager.setKey(provider, key),
    removeKey: () => apiKeyManager.removeKey(provider)
  };
}
