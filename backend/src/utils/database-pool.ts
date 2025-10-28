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
      max: parseInt(process.env.DB_POOL_MAX || '5'), // Reduced to 5 connections to avoid timeout issues
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'), // 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000'), // Reduced to 5 seconds for faster failure
      keepAlive: true,
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
      idleTimeout: config.idleTimeoutMillis,
      connectionTimeout: config.connectionTimeoutMillis
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

// Warm up the connection pool by pre-establishing connections
export async function warmUpPool(): Promise<void> {
  const pool = getSharedPool();
  try {
    // Execute a simple query with timeout to establish connection
    const result = await Promise.race([
      pool.query('SELECT 1 as test'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pool warmup timeout after 3s')), 3000)
      )
    ]);
    
    logger.info('Database pool warmed up successfully');
  } catch (error) {
    logger.error('Failed to warm up database pool:', error);
    // Don't crash the app, just continue without warmup
    logger.warn('Continuing startup without database pool warmup...');
  }
}