/**
 * Enhanced Security Service for JARVIS Kernel v1.3
 * 
 * Implements advanced security features:
 * - JWT-based authentication
 * - Role-based access control
 * - Request signing for critical operations
 * - API rate limiting
 */

import { logger } from './logger';
import { eventBus } from './eventBus';

interface SecurityRule {
  id: string;
  resource: string; // e.g., 'api:execute', 'plugin:install', 'memory:write'
  roles: string[]; // e.g., ['admin', 'user', 'guest']
  permissions: string[]; // e.g., ['read', 'write', 'execute']
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
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  permissions: string[];
}

export class SecurityService {
  private static instance: SecurityService;
  private secretKey: string;
  private securityRules: SecurityRule[] = [];
  private requestSignatures: Map<string, { timestamp: number, userId: string }> = new Map();
  private rateLimits: Map<string, { count: number, windowStart: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 100;

  private constructor(secretKey?: string) {
    this.secretKey = secretKey || this.generateSecretKey();
    this.initializeDefaultRules();
  }

  public static getInstance(secretKey?: string): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService(secretKey);
    }
    return SecurityService.instance;
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
          continue; // Condition not met, try next rule
        }
        // If we reach here, permission is granted
        return true;
      }

      logger.log('SYSTEM', `Permission denied for user ${context.userId} accessing ${context.resource}`, 'warning');
      return false;
    } catch (error) {
      logger.log('SYSTEM', `Error checking permission: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Generate a JWT token
   */
  public generateToken(userId: string, roles: string[], permissions: string[], expiresInMinutes: number = 60): string {
    try {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (expiresInMinutes * 60);

      const claims: JWTClaims = {
        userId,
        roles,
        permissions,
        exp,
        iat: now
      };

      // In a real implementation, we would use a proper JWT library
      // For now, we'll create a simple signed token
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(claims));
      const signature = this.sign(`${header}.${payload}`);

      return `${header}.${payload}.${signature}`;
    } catch (error) {
      logger.log('SYSTEM', `Error generating token: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Verify a JWT token
   */
  public verifyToken(token: string): JWTClaims | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.log('SYSTEM', 'Invalid token format', 'error');
        return null;
      }

      const [header, payload, signature] = parts;

      // Verify signature
      const expectedSignature = this.sign(`${header}.${payload}`);
      if (signature !== expectedSignature) {
        logger.log('SYSTEM', 'Invalid token signature', 'error');
        return null;
      }

      // Decode payload
      const claims: JWTClaims = JSON.parse(atob(payload));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        logger.log('SYSTEM', 'Token expired', 'warning');
        return null;
      }

      return claims;
    } catch (error) {
      logger.log('SYSTEM', `Error verifying token: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Sign a request for critical operations
   */
  public signRequest(userId: string, resourceId: string, timestamp: number, nonce: string): string {
    const data = `${userId}|${resourceId}|${timestamp}|${nonce}`;
    const signature = this.sign(data);
    
    // Store the signature temporarily to prevent replay attacks
    const signatureKey = `${userId}|${resourceId}|${timestamp}|${nonce}`;
    this.requestSignatures.set(signatureKey, { timestamp, userId });
    
    // Clean up old signatures
    this.cleanupOldSignatures();
    
    return signature;
  }

  /**
   * Verify a signed request
   */
  public verifySignedRequest(userId: string, resourceId: string, timestamp: number, nonce: string, signature: string): boolean {
    const data = `${userId}|${resourceId}|${timestamp}|${nonce}`;
    const expectedSignature = this.sign(data);
    
    if (signature !== expectedSignature) {
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
    
    // Check if the request is too old (prevent old requests from being reused)
    const now = Date.now();
    if (now - storedSignature.timestamp > 300000) { // 5 minutes
      logger.log('SYSTEM', 'Request signature is too old', 'warning');
      return false;
    }
    
    return true;
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
   * Generate a random secret key
   */
  private generateSecretKey(): string {
    // In a real implementation, use crypto.randomUUID() or similar secure method
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Sign data with the secret key
   */
  private sign(data: string): string {
    // Simple HMAC-like signature (in real implementation, use proper crypto)
    return btoa(data + this.secretKey).substring(0, 20);
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
   * Get security statistics
   */
  public getStats(): { 
    totalRules: number; 
    activeSignatures: number; 
    trackedUsers: number; 
    rateLimitedUsers: number 
  } {
    return {
      totalRules: this.securityRules.length,
      activeSignatures: this.requestSignatures.size,
      trackedUsers: this.rateLimits.size,
      rateLimitedUsers: Array.from(this.rateLimits.values())
        .filter(limit => limit.count > this.MAX_REQUESTS_PER_WINDOW).length
    };
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();

// Initialize security service when module loads
logger.log('SYSTEM', 'Security service initialized', 'info');