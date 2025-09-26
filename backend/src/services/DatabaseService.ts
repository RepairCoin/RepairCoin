import { Pool, QueryResult } from 'pg';

/**
 * Legacy DatabaseService wrapper for backward compatibility
 * The codebase is moving to a repository pattern, but some services still expect this
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;
  private connectionInfo: string;

  private constructor() {
    // Support DATABASE_URL from DigitalOcean
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      this.pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('sslmode=require') ? {
          rejectUnauthorized: false
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      
      // Extract host for logging (hide password)
      const urlParts = dbUrl.match(/postgresql:\/\/[^:]+:[^@]+@([^:\/]+)/);
      const host = urlParts ? urlParts[1] : 'unknown';
      this.connectionInfo = `DATABASE_URL (${host})`;
    } else {
      // Use individual connection parameters
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const database = process.env.DB_NAME || 'repaircoin';
      const user = process.env.DB_USER || 'repaircoin';
      
      const poolConfig: any = {
        host,
        port: parseInt(port),
        database,
        user,
        password: process.env.DB_PASSWORD || 'repaircoin123',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
      
      // Add SSL configuration if DB_SSL is set or if it's a DigitalOcean connection
      if (process.env.DB_SSL === 'true' || host.includes('digitalocean')) {
        poolConfig.ssl = {
          rejectUnauthorized: false,
          require: true
        };
        console.log('🔒 SSL enabled for database connection');
      }
      
      this.pool = new Pool(poolConfig);
      
      this.connectionInfo = `${user}@${host}:${port}/${database}`;
    }

    // Test connection and log status
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW(), current_database(), version()');
      const dbInfo = result.rows[0];
      
      console.log('✅ Database connected successfully');
      console.log(`📍 Connection: ${this.connectionInfo}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Database: ${dbInfo.current_database}`);
      console.log(`⏰ Server Time: ${new Date(dbInfo.now).toISOString()}`);
      
      // Log if it's local vs production
      if (this.connectionInfo.includes('localhost') || this.connectionInfo.includes('127.0.0.1')) {
        console.log('🏠 Using LOCAL database');
      } else if (this.connectionInfo.includes('digitalocean')) {
        console.log('☁️  Using DIGITAL OCEAN database');
      } else {
        console.log('🔗 Using REMOTE database');
      }
      
      client.release();
    } catch (error: any) {
      console.error('❌ Database connection failed!');
      console.error(`📍 Attempted connection: ${this.connectionInfo}`);
      console.error(`🔥 Error: ${error.message}`);
      
      // Don't crash the app, but log the error
      if (process.env.NODE_ENV === 'production') {
        console.error('⚠️  Warning: Running without database connection!');
      }
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