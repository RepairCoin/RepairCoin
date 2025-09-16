import { Pool, QueryResult } from 'pg';

/**
 * Legacy DatabaseService wrapper for backward compatibility
 * The codebase is moving to a repository pattern, but some services still expect this
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    // Support DATABASE_URL from DigitalOcean
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false
        } : false,
      });
    } else {
      // Use individual connection parameters
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'repaircoin',
        user: process.env.DB_USER || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query(text, params);
  }

  async getClient() {
    return this.pool.connect();
  }

  getPool(): Pool {
    return this.pool;
  }
}