/**
 * Enhanced Security Service for JARVIS Kernel v1.5
 * 
 * Implements proper security features:
 * - JWT-based authentication using Web Crypto API
 * - Role-based access control
 * - Request signing using HMAC-SHA256
 * - API rate limiting
 * - Secure token generation
 * 
 * SECURITY FIXES (v1.5):
 * - Replaced Math.random() token generation with crypto.getRandomValues
 * - Replaced fake btoa-based HMAC with real HMAC-SHA256
 * - Replaced predictable JWT signing with proper Web Crypto implementation
 * - Added constant-time comparison for signatures
 */

import { logger } from './logger';
import { eventBus } from './eventBus';
import { constantTimeCompare, generateSecureId } from './secureStorage';

interface SecurityRule {
  id: string;
  resource: string;
  roles: string[];
  permissions: string[];
  conditions?: (context: SecurityContext) => boolean;
}

interface SecurityContext {
  userId: string;
  roles: string[];
  permissions: string[];
  resource: string;
  action: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

interface JWTClaims {
  userId: string;
  roles: string[];
  exp: number;
  iat: number;
  permissions: string[];
  jti: string; // JWT ID for token revocation
}

interface JWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export class SecurityService {
  private static instance: SecurityService;
  private signingKey: CryptoKey | null = null;
  private securityRules: SecurityRule[] = [];
  private requestSignatures: Map<string, { timestamp: number; userId: string }> = new Map();
  private rateLimits: Map<string, { count: number; windowStart: number }> = new Map();
  private revokedTokens: Set<string> = new Set(); // Token revocation list
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 100;

  private constructor() {
    this.initializeDefaultRules();
    this.initializeSigningKey();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Check if Web Crypto API is available
   */
  private isCryptoAvailable(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined';
  }

  /**
   * Initialize the signing key for JWT
   */
  private async initializeSigningKey(): Promise<void> {
    try {
      if (!this.isCryptoAvailable()) {
        console.warn('[SecurityService] Web Crypto API not available. JWT features disabled.');
        return;
      }
      
      // Generate a secure random key for HMAC-SHA256
      this.signingKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false, // Not extractable
        ['sign', 'verify']
      );
      logger.log('SYSTEM', 'Security service signing key initialized', 'info');
    } catch (error) {
      logger.log('SYSTEM', `Failed to initialize signing key: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Ensure signing key is ready
   */
  private async ensureSigningKey(): Promise<CryptoKey> {
    if (!this.signingKey) {
      await this.initializeSigningKey();
    }
    if (!this.signingKey) {
      throw new Error('Signing key not available');
    }
    return this.signingKey;
  }

  /**
   * Initialize default security rules
   */
  private initializeDefaultRules(): void {
    // Admin-only operations
    this.addRule({
      id: 'admin-plugins',
      resource: 'plugin:*',
      roles: ['admin'],
      permissions: ['read', 'write', 'execute']
    });

    this.addRule({
      id: 'admin-system',
      resource: 'system:*',
      roles: ['admin'],
      permissions: ['read', 'write', 'execute']
    });

    // User-level operations
    this.addRule({
      id: 'user-memory',
      resource: 'memory:*',
      roles: ['admin', 'user'],
      permissions: ['read', 'write']
    });

    this.addRule({
      id: 'user-ai',
      resource: 'ai:*',
      roles: ['admin', 'user', 'guest'],
      permissions: ['execute']
    });

    // Guest-level operations
    this.addRule({
      id: 'guest-basic',
      resource: 'basic:*',
      roles: ['admin', 'user', 'guest'],
      permissions: ['read']
    });
  }

  /**
   * Add a security rule
   */
  public addRule(rule: SecurityRule): void {
    this.securityRules.push(rule);
    logger.log('SYSTEM', `Added security rule: ${rule.id}`, 'info');
  }

  /**
   * Remove a security rule
   */
  public removeRule(ruleId: string): boolean {
    const initialLength = this.securityRules.length;
    this.securityRules = this.securityRules.filter(rule => rule.id !== ruleId);
    const removed = initialLength !== this.securityRules.length;

    if (removed) {
      logger.log('SYSTEM', `Removed security rule: ${ruleId}`, 'info');
    }

    return removed;
  }

  /**
   * Check if a user has permission to access a resource
   */
  public async checkPermission(context: SecurityContext): Promise<boolean> {
    try {
      // Check rate limits first
      if (!(await this.checkRateLimit(context.userId))) {
        logger.log('SYSTEM', `Rate limit exceeded for user: ${context.userId}`, 'warning');
        return false;
      }

      // Find applicable rules
      const applicableRules = this.securityRules.filter(rule =>
        this.matchesResource(rule.resource, context.resource) &&
        rule.roles.some(role => context.roles.includes(role)) &&
        rule.permissions.some(permission =>
          context.permissions.includes(permission) || context.permissions.includes('*')
        )
      );

      // If no applicable rules, deny by default
      if (applicableRules.length === 0) {
        logger.log('SYSTEM', `No applicable rules for user ${context.userId} accessing ${context.resource}`, 'warning');
        return false;
      }

      // Check conditions for each rule
      for (const rule of applicableRules) {
        if (rule.conditions && !rule.conditions(context)) {
          continue;
        }
        return true;
      }

      logger.log('SYSTEM', `Permission denied for user ${context.userId} accessing ${context.resource}`, 'warning');
      return false;
    } catch (error) {
      logger.log('SYSTEM', `Error checking permission: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return false;
    }
  }

  /**
   * Generate a JWT token using proper HMAC-SHA256
   */
  public async generateToken(
    userId: string, 
    roles: string[], 
    permissions: string[], 
    expiresInMinutes: number = 60
  ): Promise<string> {
    try {
      // Check crypto availability first
      if (!this.isCryptoAvailable()) {
        throw new Error('Web Crypto API not available');
      }

      const key = await this.ensureSigningKey();
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (expiresInMinutes * 60);

      const header: JWTHeader = { alg: 'HS256', typ: 'JWT' };
      const claims: JWTClaims = {
        userId,
        roles,
        permissions,
        exp,
        iat: now,
        jti: generateSecureId(16) // Unique token ID for revocation
      };

      // Encode header and payload
      const headerB64 = this.base64UrlEncode(JSON.stringify(header));
      const payloadB64 = this.base64UrlEncode(JSON.stringify(claims));
      const signingInput = `${headerB64}.${payloadB64}`;

      // Sign with HMAC-SHA256
      const encoder = new TextEncoder();
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signingInput)
      );

      const signatureB64 = this.base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
      );

      return `${signingInput}.${signatureB64}`;
    } catch (error) {
      logger.log('SYSTEM', `Error generating token: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      throw error;
    }
  }

  /**
   * Verify a JWT token
   */
  public async verifyToken(token: string): Promise<JWTClaims | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.log('SYSTEM', 'Invalid token format', 'error');
        return null;
      }

      const [headerB64, payloadB64, signatureB64] = parts;
      const key = await this.ensureSigningKey();

      // Verify signature
      const signingInput = `${headerB64}.${payloadB64}`;
      const encoder = new TextEncoder();
      const signature = new Uint8Array(
        [...this.base64UrlDecode(signatureB64)].map(c => c.charCodeAt(0))
      );

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        encoder.encode(signingInput)
      );

      if (!isValid) {
        logger.log('SYSTEM', 'Invalid token signature', 'error');
        return null;
      }

      // Decode payload
      const claims: JWTClaims = JSON.parse(this.base64UrlDecode(payloadB64));

      // Check if token is revoked
      if (this.revokedTokens.has(claims.jti)) {
        logger.log('SYSTEM', 'Token has been revoked', 'warning');
        return null;
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        logger.log('SYSTEM', 'Token expired', 'warning');
        return null;
      }

      return claims;
    } catch (error) {
      logger.log('SYSTEM', `Error verifying token: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return null;
    }
  }

  /**
   * Revoke a token
   */
  public revokeToken(jti: string): void {
    this.revokedTokens.add(jti);
    logger.log('SYSTEM', `Token revoked: ${jti}`, 'info');
  }

  /**
   * Sign a request for critical operations using HMAC-SHA256
   */
  public async signRequest(
    userId: string, 
    resourceId: string, 
    timestamp: number, 
    nonce: string
  ): Promise<string> {
    const key = await this.ensureSigningKey();
    const data = `${userId}|${resourceId}|${timestamp}|${nonce}`;
    
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Store the signature temporarily to prevent replay attacks
    const signatureKey = `${userId}|${resourceId}|${timestamp}|${nonce}`;
    this.requestSignatures.set(signatureKey, { timestamp, userId });

    // Clean up old signatures
    this.cleanupOldSignatures();

    return signatureB64;
  }

  /**
   * Verify a signed request
   */
  public async verifySignedRequest(
    userId: string, 
    resourceId: string, 
    timestamp: number, 
    nonce: string, 
    signature: string
  ): Promise<boolean> {
    try {
      const key = await this.ensureSigningKey();
      const data = `${userId}|${resourceId}|${timestamp}|${nonce}`;

      const encoder = new TextEncoder();
      const expectedSignature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data)
      );

      const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));

      // Constant-time comparison to prevent timing attacks
      if (!constantTimeCompare(signature, expectedB64)) {
        logger.log('SYSTEM', 'Invalid request signature', 'error');
        return false;
      }

      // Check if this signature was already used (replay attack prevention)
      const signatureKey = `${userId}|${resourceId}|${timestamp}|${nonce}`;
      const storedSignature = this.requestSignatures.get(signatureKey);

      if (!storedSignature) {
        logger.log('SYSTEM', 'Request signature not found (possible replay attack)', 'warning');
        return false;
      }

      // Remove the signature after verification
      this.requestSignatures.delete(signatureKey);

      // Check if the request is too old
      const now = Date.now();
      if (now - storedSignature.timestamp > 300000) { // 5 minutes
        logger.log('SYSTEM', 'Request signature is too old', 'warning');
        return false;
      }

      return true;
    } catch (error) {
      logger.log('SYSTEM', `Error verifying request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      return false;
    }
  }

  /**
   * Apply role-based access control to a function
   */
  public async withRBAC<T>(
    userId: string,
    resource: string,
    action: string,
    fn: () => Promise<T>,
    roles: string[],
    permissions: string[],
    ip?: string,
    userAgent?: string
  ): Promise<T> {
    const context: SecurityContext = {
      userId,
      roles,
      permissions,
      resource,
      action,
      ip,
      userAgent,
      timestamp: Date.now()
    };

    const hasPermission = await this.checkPermission(context);
    if (!hasPermission) {
      throw new Error(`Access denied: User ${userId} does not have permission to ${action} on ${resource}`);
    }

    return fn();
  }

  /**
   * Check rate limits for a user
   */
  private async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;

    // Clean up old entries
    this.rateLimits.forEach((value, key) => {
      if (value.windowStart < windowStart) {
        this.rateLimits.delete(key);
      }
    });

    // Get or create user's rate limit entry
    let userLimit = this.rateLimits.get(userId);
    if (!userLimit) {
      userLimit = { count: 0, windowStart: now };
      this.rateLimits.set(userId, userLimit);
    }

    // Check if window has expired
    if (userLimit.windowStart < windowStart) {
      userLimit.count = 0;
      userLimit.windowStart = now;
    }

    // Increment count
    userLimit.count++;

    // Check if limit exceeded
    if (userLimit.count > this.MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    return true;
  }

  /**
   * Clean up old request signatures
   */
  private cleanupOldSignatures(): void {
    const now = Date.now();
    const cutoff = now - 300000; // 5 minutes ago

    this.requestSignatures.forEach((value, key) => {
      if (value.timestamp < cutoff) {
        this.requestSignatures.delete(key);
      }
    });
  }

  /**
   * Check if a resource pattern matches a specific resource
   */
  private matchesResource(pattern: string, resource: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.substring(0, pattern.length - 1);
      return resource.startsWith(prefix);
    }
    return pattern === resource;
  }

  /**
   * Base64Url encode a string
   */
  private base64UrlEncode(input: string): string {
    return btoa(input)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Base64Url decode a string
   */
  private base64UrlDecode(input: string): string {
    // Restore padding
    const padding = 4 - (input.length % 4);
    if (padding !== 4) {
      input += '='.repeat(padding);
    }
    return atob(input.replace(/-/g, '+').replace(/_/g, '/'));
  }

  /**
   * Get security statistics
   */
  public getStats(): {
    totalRules: number;
    activeSignatures: number;
    trackedUsers: number;
    rateLimitedUsers: number;
    revokedTokens: number;
  } {
    return {
      totalRules: this.securityRules.length,
      activeSignatures: this.requestSignatures.size,
      trackedUsers: this.rateLimits.size,
      rateLimitedUsers: Array.from(this.rateLimits.values())
        .filter(limit => limit.count > this.MAX_REQUESTS_PER_WINDOW).length,
      revokedTokens: this.revokedTokens.size
    };
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();

// Initialize security service when module loads
logger.log('SYSTEM', 'Security service initialized', 'info');
