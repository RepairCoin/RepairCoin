// backend/src/utils/rateLimiter.ts
import { logger } from './logger';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is allowed under rate limit
   */
  checkLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const windowStart = now - this.config.windowMs;
    
    // Get current request data
    let requestData = this.requests.get(key);
    
    // Initialize or reset if window expired
    if (!requestData || requestData.resetTime <= now) {
      requestData = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
    }
    
    // Check if limit exceeded
    if (requestData.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);
      
      logger.warn('Rate limit exceeded', {
        identifier,
        count: requestData.count,
        limit: this.config.maxRequests,
        retryAfter
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: requestData.resetTime,
        retryAfter
      };
    }
    
    // Increment counter
    requestData.count++;
    this.requests.set(key, requestData);
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - requestData.count,
      resetTime: requestData.resetTime
    };
  }

  /**
   * Reset rate limit for specific identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.requests.delete(key);
    logger.info('Rate limit reset', { identifier });
  }

  /**
   * Get current usage for identifier
   */
  getUsage(identifier: string): { count: number; limit: number; remaining: number; resetTime: number } {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const requestData = this.requests.get(key);
    
    if (!requestData || requestData.resetTime <= Date.now()) {
      return {
        count: 0,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }
    
    return {
      count: requestData.count,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - requestData.count,
      resetTime: requestData.resetTime
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, data] of this.requests.entries()) {
      if (data.resetTime <= now) {
        this.requests.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Rate limiter cleanup', { cleanedEntries: cleanedCount });
    }
  }

  /**
   * Get statistics about rate limiter
   */
  getStats(): {
    activeKeys: number;
    totalRequests: number;
    averageUsage: number;
  } {
    const now = Date.now();
    let totalRequests = 0;
    let activeKeys = 0;
    
    for (const [key, data] of this.requests.entries()) {
      if (data.resetTime > now) {
        activeKeys++;
        totalRequests += data.count;
      }
    }
    
    return {
      activeKeys,
      totalRequests,
      averageUsage: activeKeys > 0 ? totalRequests / activeKeys : 0
    };
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

// Pre-configured rate limiters for common use cases
export const webhookRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  keyGenerator: (source: string) => `webhook_${source}_${Math.floor(Date.now() / 60000)}`
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 1000,
  windowMs: 60000, // 1 minute
  keyGenerator: (ip: string) => `api_${ip}_${Math.floor(Date.now() / 60000)}`
});

export const adminRateLimiter = new RateLimiter({
  maxRequests: 50,
  windowMs: 60000, // 1 minute - stricter for admin operations
  keyGenerator: (address: string) => `admin_${address}_${Math.floor(Date.now() / 60000)}`
});

// Middleware factory for Express routes
export const createRateLimitMiddleware = (limiter: RateLimiter, keyExtractor: (req: any) => string) => {
  return (req: any, res: any, next: any) => {
    try {
      const identifier = keyExtractor(req);
      const result = limiter.checkLimit(identifier);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.getUsage(identifier).limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter
        });
      }
      
      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      next(); // Allow request to proceed if rate limiter fails
    }
  };
};