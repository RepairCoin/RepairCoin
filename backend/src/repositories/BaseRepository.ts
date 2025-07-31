import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export abstract class BaseRepository {
  protected pool: Pool;

  constructor() {
    // Support DATABASE_URL from DigitalOcean
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
      });
    } else {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'repaircoin',
        user: process.env.DB_USER || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
      });
    }

    // Test connection on startup
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info(`✅ ${this.constructor.name} database connection successful`);
    } catch (error) {
      logger.error(`❌ ${this.constructor.name} database connection failed:`, error);
    }
  }

  // Helper method to convert snake_case to camelCase
  protected mapSnakeToCamel(obj: any): any {
    if (!obj) return obj;
    
    const camelCaseObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        camelCaseObj[camelKey] = obj[key];
      }
    }
    return camelCaseObj;
  }

  // Common transaction wrapper
  protected async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Common pagination helper
  protected getPaginationOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      const result = await this.pool.query('SELECT 1');
      return { status: 'healthy' };
    } catch (error: any) {
      logger.error(`${this.constructor.name} health check failed:`, error);
      return { 
        status: 'unhealthy', 
        message: error.message 
      };
    }
  }

  // Cleanup
  async close(): Promise<void> {
    await this.pool.end();
  }
}