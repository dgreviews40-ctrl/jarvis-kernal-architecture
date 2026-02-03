/**
 * Centralized API Key Management
 * 
 * Provides secure, unified access to API keys with:
 * - In-memory caching for performance
 * - AES-GCM encryption for localStorage (password-protected)
 * - Environment variable fallback
 * - Validation and error handling
 */

import { encrypt, decrypt } from './crypto';

export type APIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

interface KeyMetadata {
  provider: APIProvider;
  source: 'env' | 'localStorage' | 'manual';
  lastAccessed: number;
  encrypted: boolean;
}

interface StoredKeyData {
  encrypted: string;
  salt: string;
  iv: string;
}

class APIKeyManager {
  private cache: Map<APIProvider, { key: string; metadata: KeyMetadata }> = new Map();
  private readonly STORAGE_PREFIX = 'JARVIS_API_KEY_';
  private encryptionPassword: string | null = null;
  private encryptionEnabled: boolean = false;
  
  /**
   * Initialize encryption with a password
   * Call this once at app startup (after user authentication)
   */
  async initializeEncryption(password: string): Promise<void> {
    if (!password || password.length < 8) {
      throw new Error('Encryption password must be at least 8 characters');
    }
    
    this.encryptionPassword = password;
    this.encryptionEnabled = true;
    
    // Try to decrypt existing keys to verify password
    const providers: APIProvider[] = ['gemini', 'openai', 'anthropic', 'ollama'];
    let migratedCount = 0;
    
    for (const provider of providers) {
      const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
      if (stored) {
        try {
          // Check if it's old format (base64) or new format (encrypted)
          const data = JSON.parse(stored);
          if (data.encrypted) {
            // New format - verify we can decrypt
            const decrypted = await decrypt(data.encrypted, password);
            if (decrypted) {
              // Cache the decrypted key
              this.cache.set(provider, {
                key: decrypted,
                metadata: {
                  provider,
                  source: 'localStorage',
                  lastAccessed: Date.now(),
                  encrypted: true
                }
              });
            }
          } else {
            // Old format - migrate to encrypted
            const oldKey = atob(stored);
            if (oldKey) {
              await this.setKeyEncrypted(provider, oldKey);
              migratedCount++;
            }
          }
        } catch {
          // Old format (not JSON) - try base64 decode
          try {
            const oldKey = atob(stored);
            if (oldKey) {
              await this.setKeyEncrypted(provider, oldKey);
              migratedCount++;
            }
          } catch {
            // Invalid data, skip
          }
        }
      }
    }
    
    if (migratedCount > 0) {
      console.log(`[APIKeyManager] Migrated ${migratedCount} keys to encrypted storage`);
    }
  }
  
  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.encryptionEnabled;
  }
  
  /**
   * Get API key for a provider
   * Checks cache first, then environment, then localStorage
   */
  getKey(provider: APIProvider): string | null {
    // Check cache first
    const cached = this.cache.get(provider);
    if (cached) {
      cached.metadata.lastAccessed = Date.now();
      return cached.key;
    }
    
    // Try environment variables (Vite format)
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
    
    // Try localStorage (encrypted or legacy)
    // Note: For encrypted storage, initializeEncryption() must be called first
    const storedKey = this.getFromStorage(provider);
    if (storedKey) {
      this.cache.set(provider, {
        key: storedKey,
        metadata: {
          provider,
          source: 'localStorage',
          lastAccessed: Date.now(),
          encrypted: this.encryptionEnabled
        }
      });
      return storedKey;
    }
    
    return null;
  }
  
  /**
   * Set API key for a provider
   * Stores encrypted if encryption is enabled, otherwise base64
   */
  async setKey(provider: APIProvider, key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new Error(`Invalid API key for ${provider}: empty or whitespace`);
    }
    
    // Validate key format (basic checks)
    if (!this.validateKeyFormat(provider, key)) {
      throw new Error(`Invalid API key format for ${provider}`);
    }
    
    const trimmed = key.trim();
    
    if (this.encryptionEnabled && this.encryptionPassword) {
      await this.setKeyEncrypted(provider, trimmed);
    } else {
      this.setKeyLegacy(provider, trimmed);
    }
  }
  
  /**
   * Store key with encryption
   */
  private async setKeyEncrypted(provider: APIProvider, key: string): Promise<void> {
    if (!this.encryptionPassword) {
      throw new Error('Encryption not initialized');
    }
    
    // Update cache
    this.cache.set(provider, {
      key,
      metadata: {
        provider,
        source: 'manual',
        lastAccessed: Date.now(),
        encrypted: true
      }
    });
    
    // Encrypt and store
    try {
      const encrypted = await encrypt(key, this.encryptionPassword);
      localStorage.setItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`, JSON.stringify({
        encrypted,
        version: 2
      }));
    } catch (e) {
      console.error(`[APIKeyManager] Failed to encrypt/store key for ${provider}:`, e);
      throw new Error('Failed to store API key securely');
    }
  }
  
  /**
   * Store key with legacy base64 encoding (fallback)
   */
  private setKeyLegacy(provider: APIProvider, key: string): void {
    // Update cache
    this.cache.set(provider, {
      key,
      metadata: {
        provider,
        source: 'manual',
        lastAccessed: Date.now(),
        encrypted: false
      }
    });
    
    // Store encoded in localStorage
    try {
      const encoded = btoa(key);
      localStorage.setItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`, encoded);
    } catch (e) {
      console.error(`[APIKeyManager] Failed to encode/store key for ${provider}:`, e);
      throw new Error('Failed to store API key securely');
    }
  }
  
  /**
   * Remove API key for a provider
   */
  removeKey(provider: APIProvider): void {
    this.cache.delete(provider);
    localStorage.removeItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
  }
  
  /**
   * Check if a key exists for a provider
   */
  hasKey(provider: APIProvider): boolean {
    return this.getKey(provider) !== null;
  }
  
  /**
   * Get all configured providers
   */
  getConfiguredProviders(): APIProvider[] {
    const providers: APIProvider[] = ['gemini', 'openai', 'anthropic', 'ollama'];
    return providers.filter(p => this.hasKey(p));
  }
  
  /**
   * Clear in-memory cache (does not affect localStorage)
   */
  clearCache(): void {
    this.cache.clear();
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
   * Securely clear all keys (for logout/security)
   */
  clearAllKeys(): void {
    this.cache.clear();
    
    // Clear from localStorage
    const providers: APIProvider[] = ['gemini', 'openai', 'anthropic', 'ollama'];
    providers.forEach(provider => {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
    });
    
    this.encryptionPassword = null;
    this.encryptionEnabled = false;
    
    console.log('[APIKeyManager] All API keys cleared');
  }
  
  // ==================== PRIVATE METHODS ====================
  
  private getFromEnvironment(provider: APIProvider): string | null {
    // Check various environment variable formats
    const envVars = [
      import.meta.env[`VITE_${provider.toUpperCase()}_API_KEY`],
      import.meta.env[`${provider.toUpperCase()}_API_KEY`],
      import.meta.env[`VITE_API_KEY`], // Legacy fallback for Gemini
      typeof process !== 'undefined' ? process.env[`${provider.toUpperCase()}_API_KEY`] : null
    ];
    
    for (const envVar of envVars) {
      if (envVar && typeof envVar === 'string' && envVar.trim().length > 0) {
        return envVar.trim();
      }
    }
    
    return null;
  }
  
  private getFromStorage(provider: APIProvider): string | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${provider.toUpperCase()}`);
      
      if (!stored) {
        // Legacy fallback for old format
        const legacy = localStorage.getItem('GEMINI_API_KEY');
        if (legacy && provider === 'gemini') {
          return this.decodeKeyLegacy(legacy);
        }
        return null;
      }
      
      // Check if it's new encrypted format
      try {
        const data = JSON.parse(stored);
        if (data.encrypted && this.encryptionPassword) {
          return decrypt(data.encrypted, this.encryptionPassword);
        }
      } catch {
        // Not JSON, try legacy decode
      }
      
      return this.decodeKeyLegacy(stored);
    } catch (e) {
      console.error(`[APIKeyManager] Failed to retrieve key for ${provider}:`, e);
      return null;
    }
  }
  
  private decodeKeyLegacy(encoded: string): string | null {
    try {
      return atob(encoded);
    } catch (e) {
      console.error('[APIKeyManager] Failed to decode key:', e);
      return null;
    }
  }
  
  private validateKeyFormat(provider: APIProvider, key: string): boolean {
    // Basic format validation per provider
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
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager();

// Convenience hook for React components
export function useAPIKey(provider: APIProvider) {
  return {
    key: apiKeyManager.getKey(provider),
    hasKey: apiKeyManager.hasKey(provider),
    setKey: (key: string) => apiKeyManager.setKey(provider, key),
    removeKey: () => apiKeyManager.removeKey(provider),
    isEncryptionEnabled: () => apiKeyManager.isEncryptionEnabled()
  };
}
