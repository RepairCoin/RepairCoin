import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { getSharedPool } from '../utils/database-pool';

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
  private static connectionTestQueue: Promise<void> = Promise.resolve();
  private static connectionTestDelay = 100; // ms between tests

  constructor() {
    // Use shared pool for all repositories
    this.pool = getSharedPool();
    
    // Queue connection tests to avoid overwhelming the database
    this.queueConnectionTest();
  }

  private queueConnectionTest(): void {
    // Skip connection tests if disabled or in production with limited connections
    if (process.env.SKIP_DB_CONNECTION_TESTS === 'true') {
      return;
    }
    
    // Chain connection tests with a small delay to avoid timeouts
    BaseRepository.connectionTestQueue = BaseRepository.connectionTestQueue
      .then(() => new Promise(resolve => setTimeout(resolve, BaseRepository.connectionTestDelay)))
      .then(() => this.testConnection())
      .catch(error => {
        // Don't let one failed test break the chain
        logger.error(`Connection test failed for ${this.constructor.name}:`, error);
      });
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