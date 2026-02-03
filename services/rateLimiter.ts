/**
 * Global Rate Limiter for Gemini API
 * Protects free tier usage across ALL API calls (intent, chat, vision, TTS)
 */

interface RateLimitConfig {
  // Daily limits (Gemini free tier)
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  
  // Per-minute limits (Gemini free tier)
  perMinuteRequestLimit: number;
  perMinuteTokenLimit: number;
}

interface UsageStats {
  // Daily tracking
  dailyRequests: number;
  dailyTokens: number;
  dayStartTime: number;
  
  // Per-minute tracking
  minuteRequests: number;
  minuteTokens: number;
  minuteStartTime: number;
  
  // Last error tracking
  lastErrorTime: number | null;
  consecutiveErrors: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  // Gemini free tier limits (conservative to stay safe)
  dailyRequestLimit: 1400,  // Actually 1500, but stay under
  dailyTokenLimit: 900000,  // 1M tokens/day, stay under
  
  // Per-minute limits (these are the ones hitting you)
  perMinuteRequestLimit: 14,   // 15/min for flash, stay under
  perMinuteTokenLimit: 90000,  // 1M tokens/min is high, but input tokens matter
};

const STORAGE_KEY = 'jarvis_gemini_rate_limit';

class GeminiRateLimiter {
  private config: RateLimitConfig;
  private stats: UsageStats;
  private isRateLimited = false;
  private rateLimitResetTime: number | null = null;
  
  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.loadStats();
  }
  
  private loadStats(): UsageStats {
    if (typeof localStorage === 'undefined') {
      return this.getFreshStats();
    }
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        
        // Check if it's a new day
        if (now - parsed.dayStartTime > 24 * 60 * 60 * 1000) {
          return this.getFreshStats();
        }
        
        // Check if minute has passed
        if (now - parsed.minuteStartTime > 60 * 1000) {
          parsed.minuteRequests = 0;
          parsed.minuteTokens = 0;
          parsed.minuteStartTime = now;
        }
        
        return parsed;
      } catch (e) {
        return this.getFreshStats();
      }
    }
    
    return this.getFreshStats();
  }
  
  private getFreshStats(): UsageStats {
    const now = Date.now();
    return {
      dailyRequests: 0,
      dailyTokens: 0,
      dayStartTime: now,
      minuteRequests: 0,
      minuteTokens: 0,
      minuteStartTime: now,
      lastErrorTime: null,
      consecutiveErrors: 0,
    };
  }
  
  private saveStats() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
  }
  
  private resetIfNeeded() {
    const now = Date.now();
    
    // Reset daily
    if (now - this.stats.dayStartTime > 24 * 60 * 60 * 1000) {
      this.stats = this.getFreshStats();
      this.isRateLimited = false;
      this.rateLimitResetTime = null;
    }
    
    // Reset minute
    if (now - this.stats.minuteStartTime > 60 * 1000) {
      this.stats.minuteRequests = 0;
      this.stats.minuteTokens = 0;
      this.stats.minuteStartTime = now;
      
      // Clear rate limit if it was per-minute
      if (this.rateLimitResetTime && now > this.rateLimitResetTime) {
        this.isRateLimited = false;
        this.rateLimitResetTime = null;
      }
    }
  }
  
  /**
   * Check if we can make a request
   */
  canMakeRequest(expectedTokens: number = 1000): { allowed: boolean; reason?: string; retryAfter?: number } {
    this.resetIfNeeded();
    
    // Check if globally rate limited (from 429 error)
    if (this.isRateLimited && this.rateLimitResetTime) {
      const now = Date.now();
      if (now < this.rateLimitResetTime) {
        return {
          allowed: false,
          reason: 'Rate limited by API (429)',
          retryAfter: Math.ceil((this.rateLimitResetTime - now) / 1000)
        };
      }
      // Reset time passed, clear limit
      this.isRateLimited = false;
      this.rateLimitResetTime = null;
    }
    
    // Check daily request limit
    if (this.stats.dailyRequests >= this.config.dailyRequestLimit) {
      const retryAfter = Math.ceil((this.stats.dayStartTime + 24 * 60 * 60 * 1000 - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Daily request limit reached (${this.config.dailyRequestLimit})`,
        retryAfter
      };
    }
    
    // Check daily token limit
    if (this.stats.dailyTokens + expectedTokens > this.config.dailyTokenLimit) {
      return {
        allowed: false,
        reason: `Daily token limit would be exceeded`,
        retryAfter: Math.ceil((this.stats.dayStartTime + 24 * 60 * 60 * 1000 - Date.now()) / 1000)
      };
    }
    
    // Check per-minute request limit
    if (this.stats.minuteRequests >= this.config.perMinuteRequestLimit) {
      const retryAfter = Math.ceil((this.stats.minuteStartTime + 60 * 1000 - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Per-minute request limit reached (${this.config.perMinuteRequestLimit})`,
        retryAfter: Math.max(1, retryAfter)
      };
    }
    
    // Check per-minute token limit
    if (this.stats.minuteTokens + expectedTokens > this.config.perMinuteTokenLimit) {
      const retryAfter = Math.ceil((this.stats.minuteStartTime + 60 * 1000 - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Per-minute token limit would be exceeded`,
        retryAfter: Math.max(1, retryAfter)
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Track a successful request
   */
  trackRequest(tokensUsed: number = 1000) {
    this.stats.dailyRequests++;
    this.stats.dailyTokens += tokensUsed;
    this.stats.minuteRequests++;
    this.stats.minuteTokens += tokensUsed;
    this.stats.consecutiveErrors = 0;
    this.saveStats();
    
    // Log at milestones
    if (this.stats.dailyRequests % 100 === 0 || this.stats.dailyRequests > this.config.dailyRequestLimit - 50) {
      console.log(`[RATE LIMITER] Daily usage: ${this.stats.dailyRequests}/${this.config.dailyRequestLimit} requests, ${this.stats.minuteRequests}/${this.config.perMinuteRequestLimit} this minute`);
    }
  }
  
  /**
   * Track an error (especially 429 rate limit errors)
   */
  trackError(error?: any) {
    this.stats.consecutiveErrors++;
    this.stats.lastErrorTime = Date.now();
    
    // Check if it's a rate limit error
    const isRateLimit = error?.code === 429 || 
                       error?.status === 'RESOURCE_EXHAUSTED' ||
                       error?.message?.includes('quota') ||
                       error?.message?.includes('rate limit');
    
    if (isRateLimit) {
      this.isRateLimited = true;
      
      // Extract retry delay from error if available
      const retryDelay = error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      if (retryDelay) {
        const seconds = parseInt(retryDelay);
        this.rateLimitResetTime = Date.now() + (seconds * 1000) + 2000; // Add buffer
      } else {
        // Default: wait 60 seconds
        this.rateLimitResetTime = Date.now() + 60000;
      }
      
      console.warn(`[RATE LIMITER] Rate limit hit! Pausing Gemini requests until ${new Date(this.rateLimitResetTime).toLocaleTimeString()}`);
    }
    
    this.saveStats();
  }
  
  /**
   * Get current usage stats
   */
  getStats() {
    this.resetIfNeeded();
    return {
      daily: {
        used: this.stats.dailyRequests,
        limit: this.config.dailyRequestLimit,
        remaining: Math.max(0, this.config.dailyRequestLimit - this.stats.dailyRequests),
        tokensUsed: this.stats.dailyTokens,
        tokenLimit: this.config.dailyTokenLimit,
      },
      perMinute: {
        used: this.stats.minuteRequests,
        limit: this.config.perMinuteRequestLimit,
        remaining: Math.max(0, this.config.perMinuteRequestLimit - this.stats.minuteRequests),
        tokensUsed: this.stats.minuteTokens,
        tokenLimit: this.config.perMinuteTokenLimit,
      },
      isRateLimited: this.isRateLimited,
      rateLimitResetTime: this.rateLimitResetTime,
      consecutiveErrors: this.stats.consecutiveErrors,
    };
  }
  
  /**
   * Force a cooldown period
   */
  forceCooldown(seconds: number) {
    this.isRateLimited = true;
    this.rateLimitResetTime = Date.now() + (seconds * 1000);
    console.log(`[RATE LIMITER] Forced ${seconds}s cooldown`);
  }
  
  /**
   * Reset all limits (for testing)
   */
  reset() {
    this.stats = this.getFreshStats();
    this.isRateLimited = false;
    this.rateLimitResetTime = null;
    this.saveStats();
  }
}

// Export singleton
export const geminiRateLimiter = new GeminiRateLimiter();

// Also export for custom configs
export { GeminiRateLimiter };
