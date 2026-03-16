// backend/src/routes/health.ts
import { Router, Request, Response } from 'express';
import { TokenMinter } from '../contracts/TokenMinter';
import { ResponseHelper } from '../utils/responseHelper';
import { asyncHandler } from '../middleware/errorHandler';
import { healthRepository } from '../repositories';
import { getPoolStats } from '../utils/database-pool';

const router = Router();

// Lazy loading helper
let tokenMinter: TokenMinter | null = null;

const getTokenMinter = (): TokenMinter => {
  if (!tokenMinter) {
    tokenMinter = new TokenMinter();
  }
  return tokenMinter;
};

// Fast ping endpoint - NO database or blockchain calls
router.get('/ping', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Performance diagnostic endpoint - measures actual DB query times
router.get('/perf', asyncHandler(async (req: Request, res: Response) => {
  const timings: { step: string; ms: number }[] = [];
  const start = Date.now();

  // Test 1: Simple DB query
  const t1 = Date.now();
  await healthRepository.healthCheck();
  timings.push({ step: 'db_health_check', ms: Date.now() - t1 });

  // Test 2: Pool stats from connection pool
  const poolStats = getPoolStats();

  res.json({
    status: 'ok',
    totalMs: Date.now() - start,
    timings,
    poolStats,
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
}));

// Basic health check
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.2',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services: {
      database: await checkDatabaseHealth(),
      blockchain: await checkBlockchainHealth(),
      contract: await checkContractHealth()
    }
  };

  // Determine overall status
  const serviceStatuses = Object.values(health.services).map(service => service.status);
  if (serviceStatuses.includes('unhealthy')) {
    health.status = 'unhealthy';
  } else if (serviceStatuses.includes('degraded')) {
    health.status = 'degraded';
  }

  ResponseHelper.healthCheck(res, health.status as any, health.services, health.uptime);
}));

// Detailed system information
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      hasThirdwebConfig: !!(process.env.THIRDWEB_CLIENT_ID && process.env.THIRDWEB_SECRET_KEY),
      hasContractAddress: !!process.env.REPAIRCOIN_CONTRACT_ADDRESS,
      hasFirebaseConfig: !!process.env.FIREBASE_PROJECT_ID,
      hasWebhookSecret: !!process.env.FIXFLOW_WEBHOOK_SECRET
    },
    services: {
      database: await checkDatabaseHealth(),
      blockchain: await checkBlockchainHealth(),
      contract: await checkContractHealth()
    }
  };

  ResponseHelper.success(res, health);
}));

// Database-specific health check
router.get('/database', asyncHandler(async (req: Request, res: Response) => {
  const dbHealth = await healthRepository.healthCheck();
  const tableHealth = await healthRepository.checkTableHealth();
  
  const response = {
    ...dbHealth,
    table_health: tableHealth
  };
  
  if (dbHealth.status === 'healthy') {
    ResponseHelper.success(res, response);
  } else {
    ResponseHelper.serviceUnavailable(res, 'Database health check failed');
  }
}));

// Blockchain-specific health check
router.get('/blockchain', asyncHandler(async (req: Request, res: Response) => {
  const blockchainHealth = await checkBlockchainHealth();
  
  if (blockchainHealth.status === 'healthy' || blockchainHealth.status === 'paused') {
    ResponseHelper.success(res, blockchainHealth);
  } else {
    ResponseHelper.serviceUnavailable(res, 'Blockchain health check failed');
  }
}));

// Helper functions
async function checkDatabaseHealth() {
  try {
    const dbHealth = await healthRepository.healthCheck();
    return {
      status: dbHealth.status,
      responseTime: `${dbHealth.details.database.response_time_ms}ms`,
      connectionPool: dbHealth.details.connection_pool,
      database: dbHealth.details.database
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: 'Database connection failed'
    };
  }
}

async function checkBlockchainHealth() {
  try {
    // Check if TokenMinter has these methods, if not provide fallback
    let isPaused = false;
    try {
      isPaused = await getTokenMinter().isContractPaused();
    } catch (error) {
      // Method might not exist, continue with default
    }
    
    return {
      status: isPaused ? 'paused' : 'healthy',
      network: 'Base Sepolia',
      contractPaused: isPaused
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: 'Blockchain connection failed'
    };
  }
}

async function checkContractHealth() {
  try {
    // Check if TokenMinter has these methods, if not provide fallback
    let stats = null;
    try {
      stats = await getTokenMinter().getContractStats();
    } catch (error) {
      // Method might not exist, provide basic info
      stats = {
        contractAddress: process.env.REPAIRCOIN_CONTRACT_ADDRESS || 'Unknown',
        totalSupplyReadable: 'N/A',
        isPaused: false
      };
    }
    
    return {
      status: 'healthy',
      contractAddress: stats?.contractAddress,
      totalSupply: stats?.totalSupplyReadable,
      isPaused: stats?.isPaused
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: 'Contract interaction failed'
    };
  }
}

// Temporary diagnostic endpoint - REMOVE after fixing waitlist issue
router.get('/diag-waitlist', asyncHandler(async (req: Request, res: Response) => {
  const { getSharedPool } = require('../utils/database-pool');
  const pool = getSharedPool();
  const results: any = {};

  // 1. Check if waitlist table exists
  try {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'waitlist' ORDER BY ordinal_position");
    results.waitlistColumns = r.rows;
  } catch (e: any) { results.waitlistColumnsError = e.message; }

  // 2. Check if shop_email_preferences exists
  try {
    const r = await pool.query("SELECT count(*) as cnt FROM information_schema.tables WHERE table_name = 'shop_email_preferences'");
    results.shopEmailPrefsExists = r.rows[0].cnt > 0;
  } catch (e: any) { results.shopEmailPrefsError = e.message; }

  // 3. Try the ALTER TABLE directly and capture error
  try {
    await pool.query("ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS inquiry_type VARCHAR(20) DEFAULT 'waitlist'");
    results.alterTable = 'SUCCESS';
  } catch (e: any) { results.alterTableError = { message: e.message, code: e.code, detail: e.detail }; }

  // 4. Re-check columns after ALTER
  try {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'waitlist' AND column_name = 'inquiry_type'");
    results.inquiryTypeAfterAlter = r.rows.length > 0 ? 'EXISTS' : 'STILL MISSING';
  } catch (e: any) { results.recheckError = e.message; }

  // 5. Check schema_migrations for 85 and 87
  try {
    const r = await pool.query("SELECT version, name, applied_at FROM schema_migrations WHERE version IN (85, 87) ORDER BY version");
    results.migrationRecords = r.rows;
  } catch (e: any) { results.migrationError = e.message; }

  // 6. DB connection info
  results.dbEnv = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 60) + '...' : 'NOT SET',
    dbHost: process.env.DB_HOST || 'not set',
    dbPort: process.env.DB_PORT || 'not set',
    dbName: process.env.DB_NAME || 'not set',
  };

  res.json({ success: true, data: results });
}));

export default router;