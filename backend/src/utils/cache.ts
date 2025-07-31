// backend/src/utils/cache.ts
import { Request, Response, NextFunction } from 'express';
// TODO: DatabaseService no longer exists - refactor caching logic

interface CustomerData {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  balance: number;
  active: boolean;
  joinDate: string;
  lastActivity: string;
}

interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  reimbursementAddress?: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalReimbursements: number;
  joinDate: string;
  lastActivity: string;
}

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTtlMs: number = 300000) { // 5 minutes default
    // Cleanup expired items every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { data: value, expiresAt });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;
    
    // Use Array.from to avoid iterator issues
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Cache cleanup: removed ${deletedCount} expired items`);
    }
  }

  getStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Cache instances
export const generalCache = new MemoryCache(300000); // 5 minutes
export const shortCache = new MemoryCache(60000);    // 1 minute
export const longCache = new MemoryCache(1800000);   // 30 minutes

// Cache decorator
export function cached(ttlMs: number = 300000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = generalCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      generalCache.set(cacheKey, result, ttlMs);
      
      return result;
    };
  };
}

// Enhanced database service with caching
// TODO: Refactor to work with repositories instead of DatabaseService
/* 
export class CachedDatabaseService extends DatabaseService {
  // Use manual caching instead of decorators for better TypeScript support
  async getCustomer(address: string): Promise<CustomerData | null> {
    const cacheKey = `DatabaseService:getCustomer:${address}`;
    const cached = generalCache.get<CustomerData>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const result = await super.getCustomer(address);
    if (result) {
      generalCache.set(cacheKey, result, 300000); // 5 minutes
    }
    return result;
  }

  async getShop(shopId: string): Promise<ShopData | null> {
    const cacheKey = `DatabaseService:getShop:${shopId}`;
    const cached = generalCache.get<ShopData>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const result = await super.getShop(shopId);
    if (result) {
      generalCache.set(cacheKey, result, 600000); // 10 minutes
    }
    return result;
  }

  async getActiveShops(): Promise<ShopData[]> {
    const cacheKey = `DatabaseService:getActiveShops:all`;
    const cached = generalCache.get<ShopData[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const result = await super.getActiveShops();
    generalCache.set(cacheKey, result, 60000); // 1 minute
    return result;
  }

  // Override update methods to invalidate cache
  async updateCustomer(address: string, updates: Partial<CustomerData>): Promise<void> {
    await super.updateCustomer(address, updates);
    // Invalidate related cache entries
    const cacheKey = `DatabaseService:getCustomer:${address}`;
    generalCache.delete(cacheKey);
  }

  async updateShop(shopId: string, updates: Partial<ShopData>): Promise<void> {
    await super.updateShop(shopId, updates);
    // Invalidate related cache entries
    const shopCacheKey = `DatabaseService:getShop:${shopId}`;
    const activeShopsCacheKey = `DatabaseService:getActiveShops:all`;
    generalCache.delete(shopCacheKey);
    generalCache.delete(activeShopsCacheKey);
  }
}
*/

// Request caching middleware
export const requestCache = (ttlMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `request:${req.originalUrl}`;
    const cached = generalCache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data: any) {
      generalCache.set(cacheKey, data, ttlMs);
      return originalJson.call(this, data);
    };

    next();
  };
};

// Database query optimization helper
export class QueryOptimizer {
  static buildSelectQuery(
    table: string,
    conditions: { [key: string]: any } = {},
    options: {
      select?: string[];
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): { query: string; values: any[] } {
    let query = `SELECT ${options.select?.join(', ') || '*'} FROM ${table}`;
    const values: any[] = [];
    let paramIndex = 1;

    // WHERE clause
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = $${paramIndex++}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }

    // ORDER BY
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    // LIMIT and OFFSET
    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      values.push(options.offset);
    }

    return { query, values };
  }
}