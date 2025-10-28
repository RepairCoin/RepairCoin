import { Pool, QueryResult } from 'pg';
import { getSharedPool } from '../utils/database-pool';

/**
 * DatabaseService wrapper that uses the shared pool for consistency
 * All database connections now go through the same shared pool
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;

  private constructor() {
    // Use the shared pool instead of creating a new one
    this.pool = getSharedPool();
    
    // Skip connection test during startup to avoid conflicts
    if (process.env.SKIP_DB_CONNECTION_TESTS !== 'true') {
      // Add a small delay to avoid conflicts with BaseRepository tests
      setTimeout(() => this.testConnection(), 500);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      // Set a shorter timeout for the test connection
      const client = await Promise.race([
        this.pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DatabaseService connection test timeout after 3s')), 3000)
        )
      ]) as any;
      
      const result = await client.query('SELECT NOW(), current_database()');
      const dbInfo = result.rows[0];
      
      console.log('✅ DatabaseService connected successfully via shared pool');
      console.log(`📊 Database: ${dbInfo.current_database}`);
      console.log(`⏰ Server Time: ${new Date(dbInfo.now).toISOString()}`);
      
      client.release();
    } catch (error: any) {
      console.error('❌ DatabaseService connection test failed!');
      console.error(`🔥 Error: ${error.message}`);
      
      // Log helpful hints for common issues
      if (error.message.includes('timeout')) {
        console.error('💡 Hint: Database connection timeout - check shared pool configuration');
      } else if (error.message.includes('does not support SSL')) {
        console.error('💡 Hint: Check SSL configuration in database-pool.ts');
      }
      
      // Don't crash the app during startup
      console.warn('⚠️  Warning: DatabaseService test failed, but continuing startup...');
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