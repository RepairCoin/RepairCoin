import { Pool } from 'pg';
import { logger } from './logger';

let sharedPool: Pool | null = null;

export function getSharedPool(): Pool {
  if (!sharedPool) {
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      max: parseInt(process.env.DB_POOL_MAX || '10'), // Single pool with 10 connections
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'), // Increased to 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000'), // Increased to 10 seconds
      keepAlive: true,
    };

    if (!process.env.DATABASE_URL) {
      config.connectionString = undefined as any;
      Object.assign(config, {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'repaircoin',
        user: process.env.DB_USER || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123',
      });
    }

    sharedPool = new Pool(config);
    
    // Log pool creation
    logger.info('Created shared database pool', {
      max: config.max,
      idleTimeout: config.idleTimeoutMillis,
      connectionTimeout: config.connectionTimeoutMillis
    });

    // Handle pool errors
    sharedPool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });

    // Monitor pool connections
    sharedPool.on('connect', () => {
      logger.debug('New database connection established');
    });

    sharedPool.on('remove', () => {
      logger.debug('Database connection removed from pool');
    });
  }

  return sharedPool;
}

export async function closeSharedPool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
    logger.info('Shared database pool closed');
  }
}

// Warm up the connection pool by pre-establishing connections
export async function warmUpPool(): Promise<void> {
  const pool = getSharedPool();
  try {
    // Execute a simple query to establish connection
    await pool.query('SELECT 1');
    logger.info('Database pool warmed up successfully');
  } catch (error) {
    logger.error('Failed to warm up database pool:', error);
  }
}