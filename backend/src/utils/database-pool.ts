import { Pool } from 'pg';
import { logger } from './logger';

let sharedPool: Pool | null = null;

export function getSharedPool(): Pool {
  if (!sharedPool) {
    let sslConfig: any = false;
    
    // Determine SSL configuration
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
      sslConfig = { rejectUnauthorized: false };
      logger.info('SSL enabled for DATABASE_URL with sslmode=require');
    } else if (process.env.DB_SSL === 'true') {
      sslConfig = { rejectUnauthorized: false };
      logger.info('SSL enabled via DB_SSL environment variable');
    }
    
    const config: any = {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      max: parseInt(process.env.DB_POOL_MAX || '20'), // Increased to 20 connections for better concurrency
      min: parseInt(process.env.DB_POOL_MIN || '5'), // Maintain minimum 5 connections
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'), // 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000'), // Increased to 10 seconds
      keepAlive: true,
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000'), // 30 second query timeout
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000'), // 30 second query timeout
      allowExitOnIdle: false, // Keep pool alive even when idle
    };

    if (!process.env.DATABASE_URL) {
      config.connectionString = undefined as any;
      const host = process.env.DB_HOST || 'localhost';
      Object.assign(config, {
        host,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'repaircoin',
        user: process.env.DB_USER || 'repaircoin',
        password: process.env.DB_PASSWORD || 'repaircoin123',
      });
      
      // Enable SSL for DigitalOcean connections
      if (process.env.DB_SSL === 'true' || host.includes('digitalocean')) {
        config.ssl = {
          rejectUnauthorized: false
        };
        logger.info('SSL enabled for DigitalOcean host connection');
      }
    }

    // Log full configuration for debugging
    logger.info('Creating shared database pool with config:', {
      hasConnectionString: !!config.connectionString,
      connectionString: config.connectionString ? config.connectionString.substring(0, 50) + '...' : 'none',
      sslEnabled: !!config.ssl,
      sslConfig: config.ssl,
      host: config.host,
      port: config.port,
      database: config.database,
      max: config.max,
      min: config.min,
      idleTimeout: config.idleTimeoutMillis,
      connectionTimeout: config.connectionTimeoutMillis,
      statementTimeout: config.statement_timeout,
      queryTimeout: config.query_timeout
    });
    
    sharedPool = new Pool(config);

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

// Warm up the connection pool by pre-establishing multiple connections
export async function warmUpPool(): Promise<void> {
  const pool = getSharedPool();
  try {
    // Execute multiple parallel queries to establish several connections at once
    // This ensures the pool has ready connections for incoming requests
    const warmupQueries = Array(5).fill(null).map(() => pool.query('SELECT 1'));

    await Promise.race([
      Promise.all(warmupQueries),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pool warmup timeout after 8s')), 8000)
      )
    ]);

    logger.info('Database pool warmed up successfully with 5 connections');
  } catch (error) {
    logger.error('Failed to warm up database pool:', error);
    // Don't crash the app, just continue without warmup
    logger.warn('Continuing startup without database pool warmup...');
  }
}

// Get pool statistics for monitoring
export function getPoolStats() {
  if (!sharedPool) {
    return null;
  }

  return {
    totalCount: sharedPool.totalCount,
    idleCount: sharedPool.idleCount,
    waitingCount: sharedPool.waitingCount,
  };
}

// Log pool stats periodically for monitoring
export function startPoolMonitoring(intervalMs: number = 60000) {
  setInterval(() => {
    const stats = getPoolStats();
    if (stats) {
      logger.debug('Database pool stats:', stats);

      // Warn if pool is under pressure
      if (stats.waitingCount > 0) {
        logger.warn('Database pool has waiting clients - consider increasing pool size', {
          waiting: stats.waitingCount,
          total: stats.totalCount,
          idle: stats.idleCount
        });
      }
    }
  }, intervalMs);
}