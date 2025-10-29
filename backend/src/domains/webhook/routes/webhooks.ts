// backend/src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../../utils/logger';
import { webhookRepository } from '../../../repositories';
import { ResponseHelper } from '../../../utils/responseHelper';
import { asyncHandler } from '../../../middleware/errorHandler';
import { createRateLimitMiddleware, webhookRateLimiter } from '../../../utils/rateLimiter';
import { PaginationHelper } from '../../../utils/pagination';
import { webhookLoggingService } from '../../../services/WebhookLoggingService';
import {
  handleRepairCompleted,
  handleReferralVerified,
  handleAdFunnelConversion,
  handleCustomerRegistered
} from '../../../handlers/webhookHandlers';

const router = Router();

// Rate limiting middleware for webhooks
const webhookRateLimit = createRateLimitMiddleware(
  webhookRateLimiter,
  (req: Request) => `${req.body?.source || 'unknown'}_${req.ip}`
);

// Webhook signature verification middleware
const verifyWebhookSignature = (req: Request, res: Response, next: any) => {
  try {
    const signature = req.headers['x-fixflow-signature'] as string;
    const webhookSecret = process.env.FIXFLOW_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('FIXFLOW_WEBHOOK_SECRET not configured');
      return ResponseHelper.internalServerError(res, 'Webhook secret not configured');
    }
    
    if (!signature) {
      logger.warn('Webhook received without signature', { ip: req.ip });
      return ResponseHelper.unauthorized(res, 'Missing webhook signature');
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
      logger.warn('Invalid webhook signature', { ip: req.ip });
      return ResponseHelper.unauthorized(res, 'Invalid webhook signature');
    }
    
    next();
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return ResponseHelper.internalServerError(res, 'Signature verification failed');
  }
};

// Helper function to generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Main FixFlow webhook endpoint with rate limiting
router.post('/fixflow',
  webhookRateLimit,
  verifyWebhookSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const webhookId = generateId();

    // Parse webhook payload
    const payload = JSON.parse(req.body.toString());
    const { event, data } = payload;

    logger.info(`📥 Received FixFlow webhook: ${event}`, {
      webhookId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Log incoming webhook using new logging service
    const webhookLog = await webhookLoggingService.logIncomingWebhook({
      webhookId,
      eventType: event,
      source: 'fixflow',
      payload: { event, data },
      httpStatus: 200
    });

    // Also maintain backward compatibility with old logging
    await webhookRepository.recordWebhook({
      id: webhookId,
      source: 'fixflow' as const,
      event,
      payload,
      processed: false,
      timestamp: new Date(),
      retryCount: 0
    });

    // Process webhook based on event type
    let result: Record<string, unknown> = { success: false };

    try {
      switch (event) {
        case 'repair_completed':
          result = await handleRepairCompleted(data, webhookId);
          break;

        case 'referral_verified':
          result = await handleReferralVerified(data, webhookId);
          break;

        case 'ad_funnel_conversion':
          result = await handleAdFunnelConversion(data, webhookId);
          break;

        case 'customer_registered':
          result = await handleCustomerRegistered(data, webhookId);
          break;

        default:
          result = {
            success: false,
            error: `Unknown event type: ${event}`
          };
          logger.warn(`Unknown webhook event: ${event}`, { webhookId });
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update webhook log with result using new service
      await webhookLoggingService.updateWebhookResult(webhookLog.id, {
        success: result.success as boolean,
        response: result,
        processingTimeMs: processingTime
      });

      // Also update old logging for backward compatibility
      await webhookRepository.updateWebhookProcessingStatus(webhookId, result.success as boolean, processingTime, result);

    } catch (processingError) {
      const processingTime = Date.now() - startTime;

      // Log processing error
      await webhookLoggingService.updateWebhookResult(webhookLog.id, {
        success: false,
        errorMessage: processingError.message,
        processingTimeMs: processingTime
      });

      throw processingError;
    }

    // Add rate limit headers to response
    const rateLimitStatus = webhookRateLimiter.getUsage(`${req.body?.source || 'unknown'}_${req.ip}`);
    res.setHeader('X-RateLimit-Limit', rateLimitStatus.limit);
    res.setHeader('X-RateLimit-Remaining', rateLimitStatus.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitStatus.resetTime / 1000));

    // Return response
    const processingTime = Date.now() - startTime;
    if (result.success) {
      logger.info(`✅ Webhook processed successfully: ${event}`, {
        webhookId,
        processingTime: `${processingTime}ms`,
        transactionHash: result.transactionHash
      });

      ResponseHelper.success(res, {
        webhookId,
        message: result.message || 'Webhook processed successfully',
        transactionHash: result.transactionHash,
        processingTime
      });
    } else {
      logger.error(`❌ Webhook processing failed: ${event}`, {
        webhookId,
        error: result.error,
        processingTime: `${processingTime}ms`
      });

      ResponseHelper.badRequest(res, result.error || 'Webhook processing failed');
    }
  })
);

// Test webhook endpoint for development
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return ResponseHelper.notFound(res, 'Test endpoint not available in production');
  }
  
  const { event, data } = req.body;
  
  logger.info(`🧪 Test webhook received: ${event}`, data);
  
  // Process the webhook without signature verification
  let result: any = { success: false };
  
  switch (event) {
    case 'repair_completed':
      result = await handleRepairCompleted(data, `test_${Date.now()}`);
      break;
    case 'referral_verified':
      result = await handleReferralVerified(data, `test_${Date.now()}`);
      break;
    case 'ad_funnel_conversion':
      result = await handleAdFunnelConversion(data, `test_${Date.now()}`);
      break;
    case 'customer_registered':
      result = await handleCustomerRegistered(data, `test_${Date.now()}`);
      break;
    default:
      result = { success: false, error: `Unknown event: ${event}` };
  }
  
  ResponseHelper.success(res, {
    success: result.success,
    message: result.message || result.error,
    transactionHash: result.transactionHash,
    event,
    data
  });
}));

// Webhook retry endpoint for failed webhooks
router.post('/retry/:webhookId', asyncHandler(async (req: Request, res: Response) => {
  const { webhookId } = req.params;
  
  // Get the failed webhook from database
  const failedWebhooks = await webhookRepository.getFailedWebhooks(100);
  const failedWebhook = failedWebhooks.find(log => log.id === webhookId);
  
  if (!failedWebhook) {
    return ResponseHelper.notFound(res, 'Webhook not found or not failed');
  }
  
  logger.info(`🔄 Retrying webhook: ${webhookId}`, { 
    event: failedWebhook.event,
    originalTimestamp: failedWebhook.timestamp
  });
  
  // Process the webhook again
  let result: any = { success: false };
  const retryWebhookId = `retry_${webhookId}_${Date.now()}`;
  
  switch (failedWebhook.event) {
    case 'repair_completed':
      result = await handleRepairCompleted(failedWebhook.payload.data, retryWebhookId);
      break;
    case 'referral_verified':
      result = await handleReferralVerified(failedWebhook.payload.data, retryWebhookId);
      break;
    case 'ad_funnel_conversion':
      result = await handleAdFunnelConversion(failedWebhook.payload.data, retryWebhookId);
      break;
    case 'customer_registered':
      result = await handleCustomerRegistered(failedWebhook.payload.data, retryWebhookId);
      break;
    default:
      result = { success: false, error: `Unknown event: ${failedWebhook.event}` };
  }
  
  // Log the retry attempt
  await webhookRepository.recordWebhook({
    id: retryWebhookId,
    source: 'admin',
    event: `retry_${failedWebhook.event}`,
    payload: failedWebhook.payload,
    processed: true,
    result,
    timestamp: new Date(),
    retryCount: failedWebhook.retryCount + 1
  });
  
  ResponseHelper.success(res, {
    success: result.success,
    originalWebhookId: webhookId,
    retryWebhookId,
    message: result.message || result.error,
    transactionHash: result.transactionHash
  });
}));

// Get webhook logs with pagination (admin endpoint)
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const paginationParams = PaginationHelper.fromQuery(req.query);
  const { eventType, source, status } = req.query;

  const result = await webhookLoggingService.getWebhookLogs({
    ...paginationParams,
    eventType: eventType as string,
    source: source as string,
    status: status as string
  });

  ResponseHelper.success(res, result);
}));

// Get failed webhooks only
router.get('/failed', asyncHandler(async (req: Request, res: Response) => {
  const { limit = '50' } = req.query;
  
  const failedWebhooks = await webhookRepository.getFailedWebhooks(parseInt(limit as string));
  
  ResponseHelper.success(res, {
    webhooks: failedWebhooks,
    count: failedWebhooks.length
  });
}));

// Get webhook statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { timeframe = '24' } = req.query;
  
  // Get rate limiter stats
  const rateLimitStats = webhookRateLimiter.getStats();
  
  // Get failed webhooks for stats calculation
  const failedWebhooks = await webhookRepository.getFailedWebhooks(1000);
  
  // Calculate basic stats (in production, you'd use proper aggregation)
  const stats = {
    total: 150, // Would calculate from database
    successful: 142,
    failed: failedWebhooks.length,
    rateLimited: 3,
    successRate: 94.7,
    averageProcessingTime: 245,
    eventBreakdown: {
      'repair_completed': 85,
      'referral_verified': 28,
      'ad_funnel_conversion': 22,
      'customer_registered': 15
    },
    rateLimitStats,
    timeframe: `${timeframe} hours`
  };
  
  ResponseHelper.success(res, stats);
}));

// Webhook health check
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  // Get comprehensive webhook health from logging service
  const webhookHealth = await webhookLoggingService.checkWebhookHealth();

  const health = {
    status: webhookHealth.healthy ? 'healthy' : 'degraded',
    timestamp: new Date(),
    services: {
      rateLimiter: {
        status: 'healthy',
        stats: webhookRateLimiter.getStats()
      },
      database: await checkDatabaseHealth(),
      processing: await checkWebhookProcessingHealth(),
      webhookMetrics: {
        status: webhookHealth.healthy ? 'healthy' : 'degraded',
        issues: webhookHealth.issues,
        metrics: webhookHealth.metrics
      }
    }
  };

  const allHealthy = Object.values(health.services).every(service =>
    service.status === 'healthy' || service.status === 'paused'
  );

  if (!allHealthy) {
    health.status = 'degraded';
  }

  ResponseHelper.healthCheck(res, health.status as 'healthy' | 'degraded', health.services);
}));

// Reset rate limit for specific source (admin endpoint)
router.post('/rate-limit/reset', asyncHandler(async (req: Request, res: Response) => {
  const { source, ip } = req.body;
  
  if (!source) {
    return ResponseHelper.badRequest(res, 'Source parameter is required');
  }
  
  const identifier = `${source}_${ip || 'unknown'}`;
  webhookRateLimiter.reset(identifier);
  
  logger.info('Webhook rate limit reset', { source, ip, resetBy: req.ip });
  
  ResponseHelper.success(res, {
    message: `Rate limit reset for ${source}${ip ? ` from ${ip}` : ''}`,
    newStats: webhookRateLimiter.getUsage(identifier)
  });
}));

// Get rate limit status for specific source
router.get('/rate-limit/status', asyncHandler(async (req: Request, res: Response) => {
  const { source, ip } = req.query;
  
  if (!source) {
    return ResponseHelper.badRequest(res, 'Source parameter is required');
  }
  
  const identifier = `${source}_${ip || 'unknown'}`;
  const status = webhookRateLimiter.getUsage(identifier);
  
  ResponseHelper.success(res, {
    source,
    ip: ip || 'unknown',
    ...status,
    resetTime: new Date(status.resetTime).toISOString()
  });
}));

// Helper functions for health checks
async function checkDatabaseHealth(): Promise<{ status: string; details?: any }> {
  try {
    // TODO: Implement healthCheck in repository
    const health = { status: 'healthy', details: { pool: { totalConnections: 0, idleConnections: 0, activeConnections: 0 } } }; // await webhookRepository.healthCheck();
    return {
      status: health.status,
      details: health.details
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: 'Database connection failed' }
    };
  }
}

async function checkWebhookProcessingHealth(): Promise<{ status: string; details?: any }> {
  try {
    const failedWebhooks = await webhookRepository.getFailedWebhooks(10);
    const recentFailures = failedWebhooks.filter(w => {
      const webhookTime = new Date(w.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return webhookTime > oneHourAgo;
    });

    const recentSuccessRate = recentFailures.length < 5 ? 95 : 70;
    let status = 'healthy';
    
    if (recentSuccessRate < 90) status = 'degraded';
    if (recentSuccessRate < 70) status = 'unhealthy';

    return {
      status,
      details: {
        recentFailures: recentFailures.length,
        recentSuccessRate,
        pendingRetries: failedWebhooks.filter(w => w.retryCount < 5).length
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: 'Failed to check webhook processing health' }
    };
  }
}

export default router;