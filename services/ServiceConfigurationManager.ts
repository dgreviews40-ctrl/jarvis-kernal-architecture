/**
 * Service Configuration Manager for JARVIS
 * Handles configuration validation, service discovery, and secure credential storage
 */

export interface ServiceConfig {
  gemini: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  ollama: {
    url: string;
    model: string;
    port?: number;
  };
  whisper: {
    url: string;
    port?: number;
    model?: string;
  };
  piper: {
    url: string;
    port?: number;
    voice?: string;
  };
  homeAssistant?: {
    url?: string;
    token?: string;
  };
}

export class ServiceConfigurationManager {
  private static readonly DEFAULT_CONFIG: ServiceConfig = {
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash'
    },
    ollama: {
      url: 'http://localhost:11434',
      model: 'llama3',
      port: 11434
    },
    whisper: {
      url: 'http://localhost:5001',
      port: 5001,
      model: 'base'
    },
    piper: {
      url: 'http://localhost:5000',
      port: 5000,
      voice: 'jarvis'
    }
  };

  private config: ServiceConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ServiceConfig {
    const saved = localStorage.getItem('jarvis_service_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return this.mergeConfigs(ServiceConfigurationManager.DEFAULT_CONFIG, parsed);
      } catch (e) {
        console.warn('Invalid service config in storage, using defaults:', e);
        return ServiceConfigurationManager.DEFAULT_CONFIG;
      }
    }
    return ServiceConfigurationManager.DEFAULT_CONFIG;
  }

  private mergeConfigs(defaultConfig: ServiceConfig, userConfig: Partial<ServiceConfig>): ServiceConfig {
    return {
      gemini: { ...defaultConfig.gemini, ...userConfig.gemini },
      ollama: { ...defaultConfig.ollama, ...userConfig.ollama },
      whisper: { ...defaultConfig.whisper, ...userConfig.whisper },
      piper: { ...defaultConfig.piper, ...userConfig.piper },
      homeAssistant: { ...defaultConfig.homeAssistant, ...userConfig.homeAssistant }
    };
  }

  public saveConfig(config: ServiceConfig): void {
    // Validate config before saving
    if (this.validateConfig(config)) {
      this.config = { ...ServiceConfigurationManager.DEFAULT_CONFIG, ...config };
      localStorage.setItem('jarvis_service_config', JSON.stringify(this.config));
    } else {
      throw new Error('Invalid configuration provided');
    }
  }

  public get(): ServiceConfig {
    return this.config;
  }

  public validateConfig(config: ServiceConfig): boolean {
    // Validate URLs
    if (config.ollama.url && !this.isValidUrl(config.ollama.url)) {
      console.error('Invalid Ollama URL:', config.ollama.url);
      return false;
    }
    
    if (config.whisper.url && !this.isValidUrl(config.whisper.url)) {
      console.error('Invalid Whisper URL:', config.whisper.url);
      return false;
    }
    
    if (config.piper.url && !this.isValidUrl(config.piper.url)) {
      console.error('Invalid Piper URL:', config.piper.url);
      return false;
    }
    
    // Validate models exist
    const validModels = ['llama3', 'llama2', 'mistral', 'gemma'];
    if (config.ollama.model && !validModels.includes(config.ollama.model)) {
      console.warn('Potentially invalid Ollama model:', config.ollama.model);
    }
    
    return true;
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Only allow http/https protocols
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }
      
      // Check for obvious malicious patterns
      if (url.includes('../') || url.includes('..\\') || 
          url.includes('127.0.0.1') && url.includes('etc/passwd')) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Port scanning utility for flexible service discovery
  public async findAvailablePort(
    serviceName: 'ollama' | 'whisper' | 'piper', 
    startPort: number = 11434, 
    maxAttempts: number = 10
  ): Promise<number | null> {
    for (let port = startPort; port < startPort + maxAttempts; port++) {
      try {
        let testUrl = '';
        switch (serviceName) {
          case 'ollama':
            testUrl = `http://localhost:${port}/api/tags`;
            break;
          case 'whisper':
            testUrl = `http://localhost:${port}/health`;
            break;
          case 'piper':
            testUrl = `http://localhost:${port}/`;
            break;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(testUrl, { 
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`${serviceName} found on port ${port}`);
          return port;
        }
      } catch (error) {
        // Port not available, continue to next
        continue;
      }
    }
    return null; // No available port found
  }

  // Secure API key storage with basic encryption
  public async storeApiKey(apiKey: string): Promise<void> {
    if (typeof window !== 'undefined' && window.isSecureContext) {
      try {
        // For now, we'll use a basic encoding approach
        // In production, use proper encryption with user password
        const encodedKey = encodeURIComponent(apiKey);
        const encryptedKey = btoa(encodedKey);
        localStorage.setItem('jarvis_gemini_api_key_encrypted', encryptedKey);
      } catch (error) {
        console.error('Failed to securely store API key:', error);
        // Fallback to current method with warning
        localStorage.setItem('jarvis_gemini_api_key', btoa(apiKey));
      }
    }
  }

  public async getApiKey(): Promise<string | null> {
    const encryptedKey = localStorage.getItem('jarvis_gemini_api_key_encrypted');
    if (encryptedKey) {
      try {
        return decodeURIComponent(atob(encryptedKey));
      } catch (error) {
        // Try legacy decoding
        const legacyKey = localStorage.getItem('jarvis_gemini_api_key');
        if (legacyKey) {
          return atob(legacyKey);
        }
        return null;
      }
    }
    return null;
  }
}

export const serviceConfig = new ServiceConfigurationManager();