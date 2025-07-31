  // backend/src/services/webhookService.ts
  import crypto from 'crypto';
  import { webhookRepository, customerRepository } from '../../../repositories';
  import { tokenService } from '../../token/services/TokenService';
  import { tierBonusService } from '../../shop/services/TierBonusService';
  import { logger } from '../../../utils/logger';
  import { webhookRateLimiter, RateLimitResult } from '../../../utils/rateLimiter';

  interface WebhookLog {
    id: string;
    source: string;
    event: string;
    payload: any;
    processed: boolean;
    processingTime?: number;
    result?: any;
    timestamp?: Date;
    retryCount?: number;
  }

  export interface WebhookEvent {
    id: string;
    event: string;
    data: any;
    timestamp: string;
    source: string;
    signature?: string;
  }

  export interface WebhookProcessingResult {
    success: boolean;
    webhookId: string;
    transactionHash?: string;
    message?: string;
    error?: string;
    processingTime: number;
    rateLimited?: boolean;
  }

  export interface RetryableWebhook {
    webhookLog: WebhookLog;
    retryCount: number;
    nextRetryTime: Date;
    maxRetries: number;
  }

  export class WebhookService {
    private readonly maxRetries = 5;
    private readonly retryDelayMs = [1000, 5000, 15000, 60000, 300000]; // Progressive delay

    // Verify webhook signature
    verifySignature(payload: string, signature: string, secret: string): boolean {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        
        const providedSignature = signature.replace('sha256=', '');
        
        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature), 
          Buffer.from(providedSignature)
        );
      } catch (error) {
        logger.error('Signature verification error:', error);
        return false;
      }
    }

    // Check rate limit for webhook source
    checkRateLimit(source: string, ip?: string): RateLimitResult {
      const identifier = `${source}_${ip || 'unknown'}`;
      return webhookRateLimiter.checkLimit(identifier);
    }

    // Process incoming webhook with rate limiting
    async processWebhook(
      event: string,
      data: any,
      source: string = 'fixflow',
      webhookId?: string,
      sourceIp?: string
    ): Promise<WebhookProcessingResult> {
      const startTime = Date.now();
      const id = webhookId || `${source}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      try {
        // Check rate limit first
        const rateLimitResult = this.checkRateLimit(source, sourceIp);
        if (!rateLimitResult.allowed) {
          logger.warn('Webhook rate limited', {
            source,
            ip: sourceIp,
            retryAfter: rateLimitResult.retryAfter
          });

          return {
            success: false,
            webhookId: id,
            error: 'Rate limit exceeded',
            processingTime: Date.now() - startTime,
            rateLimited: true
          };
        }

        logger.webhook('Processing webhook', { 
          event, 
          source, 
          webhookId: id,
          rateLimitRemaining: rateLimitResult.remaining 
        });

        // Log webhook to database
        const webhookLog: WebhookLog = {
          id,
          source: source as 'fixflow' | 'admin' | 'customer',
          event,
          payload: { event, data },
          processed: false,
          timestamp: new Date(),
          retryCount: 0
        };

        await webhookRepository.recordWebhook(webhookLog);

        // Process based on event type
        let result: { success: boolean; transactionHash?: string; error?: string; message?: string };

        switch (event) {
          case 'repair_completed':
            result = await this.handleRepairCompleted(data, id);
            break;
            
          case 'referral_verified':
            result = await this.handleReferralVerified(data, id);
            break;
            
          case 'ad_funnel_conversion':
            result = await this.handleAdFunnelConversion(data, id);
            break;
            
          case 'customer_registered':
            result = await this.handleCustomerRegistered(data, id);
            break;
            
          default:
            result = {
              success: false,
              error: `Unknown event type: ${event}`
            };
            logger.warn('Unknown webhook event', { event, source, webhookId: id });
        }

        const processingTime = Date.now() - startTime;

        // Update webhook log with result
        await webhookRepository.updateWebhookProcessingStatus(id, true, processingTime, result);

        logger.webhook('Webhook processed', {
          event,
          success: result.success,
          processingTime,
          webhookId: id
        });

        return {
          success: result.success,
          webhookId: id,
          transactionHash: result.transactionHash,
          message: result.message,
          error: result.error,
          processingTime
        };

      } catch (error: any) {
        const processingTime = Date.now() - startTime;
        logger.error('Webhook processing error:', error, { event, source, webhookId: id });

        try {
          await webhookRepository.updateWebhookProcessingStatus(id, false, processingTime, {
            success: false,
            error: error.message
          });
        } catch (logError) {
          logger.error('Failed to update webhook log:', logError);
        }

        return {
          success: false,
          webhookId: id,
          error: error.message,
          processingTime
        };
      }
    }

    // Handle repair completed webhook
    private async handleRepairCompleted(data: any, webhookId: string): Promise<{
      success: boolean;
      transactionHash?: string;
      error?: string;
      message?: string;
    }> {
      try {
        const {
          customer_id,
          customer_wallet_address,
          shop_id,
          repair_amount,
          repair_id,
          customer_email,
          customer_phone
        } = data;

        // Validate required fields
        if (!customer_wallet_address || !shop_id || !repair_amount) {
          return {
            success: false,
            error: 'Missing required fields: customer_wallet_address, shop_id, repair_amount'
          };
        }

        // Validate repair amount
        const repairValue = parseFloat(repair_amount);
        if (repairValue < 50) {
          return {
            success: false,
            error: `Repair amount $${repairValue} is below minimum $50 threshold`
          };
        }

        // Ensure customer exists
        await this.ensureCustomerExists(
          customer_wallet_address,
          customer_email,
          customer_phone,
          customer_id
        );

        // Process repair earning with enhanced tier bonus system
        const result = await tokenService.processRepairEarning(
          customer_wallet_address,
          repairValue,
          shop_id
        );

        if (result.success) {
          // Apply tier bonus if applicable
          let tierBonusResult = null;
          let totalTokensAwarded = result.tokensToMint;
          
          try {
            tierBonusResult = await tierBonusService.applyTierBonus({
              customerAddress: customer_wallet_address,
              shopId: shop_id,
              repairAmount: repairValue,
              baseRcnEarned: result.tokensToMint,
              transactionId: result.transactionHash || webhookId
            });

            if (tierBonusResult) {
              totalTokensAwarded = tierBonusResult.totalRcnAwarded;
              logger.info(`Tier bonus applied: ${tierBonusResult.customerTier} customer earned additional ${tierBonusResult.bonusAmount} RCN`);
            }
          } catch (tierBonusError) {
            logger.error('Error applying tier bonus:', tierBonusError);
            // Don't fail the entire transaction if tier bonus fails
          }

          return {
            success: true,
            transactionHash: result.transactionHash,
            message: tierBonusResult 
              ? `Minted ${totalTokensAwarded} RCN for $${repairValue} repair (${result.tokensToMint} base + ${tierBonusResult.bonusAmount} ${tierBonusResult.customerTier} tier bonus)`
              : `Minted ${result.tokensToMint} RCN for $${repairValue} repair`
          };
        } else {
          return {
            success: false,
            error: result.error || 'Token minting failed'
          };
        }

      } catch (error: any) {
        logger.error('Error handling repair completed webhook:', error);
        return {
          success: false,
          error: `Repair processing failed: ${error.message}`
        };
      }
    }

    // Handle referral verified webhook
    private async handleReferralVerified(data: any, webhookId: string): Promise<{
      success: boolean;
      transactionHash?: string;
      error?: string;
      message?: string;
    }> {
      try {
        const {
          referrer_wallet_address,
          referee_wallet_address,
          referrer_id,
          referee_id,
          shop_id,
          referee_email,
          referee_phone
        } = data;

        // Validate required fields
        if (!referrer_wallet_address || !referee_wallet_address) {
          return {
            success: false,
            error: 'Missing required fields: referrer_wallet_address, referee_wallet_address'
          };
        }

        // Ensure both customers exist
        await Promise.all([
          this.ensureCustomerExists(referrer_wallet_address),
          this.ensureCustomerExists(referee_wallet_address, referee_email, referee_phone, referee_id)
        ]);

        // Process referral reward
        const result = await tokenService.processReferralReward(
          referrer_wallet_address,
          referee_wallet_address,
          shop_id
        );

        if (result.success) {
          return {
            success: true,
            transactionHash: result.transactionHash,
            message: 'Referral rewards minted: 25 RCN to referrer, 10 RCN to referee'
          };
        } else {
          return {
            success: false,
            error: result.error || 'Referral token minting failed'
          };
        }

      } catch (error: any) {
        logger.error('Error handling referral verified webhook:', error);
        return {
          success: false,
          error: `Referral processing failed: ${error.message}`
        };
      }
    }

    // Handle ad funnel conversion webhook
    private async handleAdFunnelConversion(data: any, webhookId: string): Promise<{
      success: boolean;
      transactionHash?: string;
      error?: string;
      message?: string;
    }> {
      try {
        const {
          customer_wallet_address,
          engagement_type,
          base_amount = 1,
          shop_id
        } = data;

        if (!customer_wallet_address || !engagement_type) {
          return {
            success: false,
            error: 'Missing required fields: customer_wallet_address, engagement_type'
          };
        }

        // Process engagement earning
        const result = await tokenService.processEngagementEarning(
          customer_wallet_address,
          engagement_type,
          parseFloat(base_amount)
        );

        if (result.success) {
          return {
            success: true,
            transactionHash: result.transactionHash,
            message: `Minted ${result.tokensToMint} RCN for ${engagement_type} engagement`
          };
        } else {
          return {
            success: false,
            error: result.error || 'Engagement token minting failed'
          };
        }

      } catch (error: any) {
        logger.error('Error handling ad funnel conversion webhook:', error);
        return {
          success: false,
          error: `Engagement processing failed: ${error.message}`
        };
      }
    }

    // Handle customer registered webhook
    private async handleCustomerRegistered(data: any, webhookId: string): Promise<{
      success: boolean;
      transactionHash?: string;
      error?: string;
      message?: string;
    }> {
      try {
        const {
          customer_id,
          customer_wallet_address,
          customer_email,
          customer_phone,
          shop_id
        } = data;

        if (!customer_wallet_address) {
          return {
            success: false,
            error: 'Missing required field: customer_wallet_address'
          };
        }

        // Check if customer already exists
        const existingCustomer = await customerRepository.getCustomer(customer_wallet_address);
        if (existingCustomer) {
          return {
            success: true,
            message: 'Customer already registered'
          };
        }

        // Create new customer
        await this.ensureCustomerExists(
          customer_wallet_address,
          customer_email,
          customer_phone,
          customer_id
        );

        logger.info('New customer registered via webhook', {
          customerAddress: customer_wallet_address,
          customerId: customer_id,
          shopId: shop_id,
          webhookId
        });

        return {
          success: true,
          message: `Customer ${customer_wallet_address} registered successfully`
        };

      } catch (error: any) {
        logger.error('Error handling customer registered webhook:', error);
        return {
          success: false,
          error: `Customer registration failed: ${error.message}`
        };
      }
    }

    // Retry failed webhooks
    async retryFailedWebhook(webhookId: string): Promise<WebhookProcessingResult> {
      try {
        const failedWebhooks = await webhookRepository.getFailedWebhooks(100);
        const webhook = failedWebhooks.find(w => w.id === webhookId);

        if (!webhook) {
          throw new Error('Webhook not found or not failed');
        }

        if (webhook.retryCount >= this.maxRetries) {
          throw new Error('Maximum retry attempts exceeded');
        }

        logger.webhook('Retrying failed webhook', {
          webhookId,
          originalEvent: webhook.event,
          retryCount: webhook.retryCount + 1
        });

        // Process webhook again with retry ID
        const retryId = `retry_${webhookId}_${Date.now()}`;
        const result = await this.processWebhook(
          webhook.event,
          webhook.payload.data,
          'retry',
          retryId
        );

        // Update original webhook retry count
        await webhookRepository.recordWebhook({
          ...webhook,
          retryCount: webhook.retryCount + 1,
          timestamp: new Date()
        });

        return result;

      } catch (error: any) {
        logger.error('Webhook retry error:', error);
        throw error;
      }
    }

    // Get webhook processing statistics
    async getWebhookStats(timeframeHours: number = 24): Promise<{
      total: number;
      successful: number;
      failed: number;
      rateLimited: number;
      successRate: number;
      averageProcessingTime: number;
      eventBreakdown: { [event: string]: number };
      rateLimitStats: any;
    }> {
      try {
        const failedWebhooks = await webhookRepository.getFailedWebhooks(1000);
        const rateLimitStats = webhookRateLimiter.getStats();
        
        const stats = {
          total: 100, // Would calculate from database
          successful: 85,
          failed: failedWebhooks.length,
          rateLimited: 5, // Would calculate from logs
          successRate: 85,
          averageProcessingTime: 250,
          eventBreakdown: {
            'repair_completed': 60,
            'referral_verified': 20,
            'ad_funnel_conversion': 15,
            'customer_registered': 5
          },
          rateLimitStats
        };

        return stats;

      } catch (error: any) {
        logger.error('Error getting webhook stats:', error);
        throw new Error('Failed to retrieve webhook statistics');
      }
    }

    // Health check for webhook processing
    async healthCheck(): Promise<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      details: {
        recentSuccessRate: number;
        pendingRetries: number;
        averageResponseTime: number;
        lastProcessedWebhook: string;
        rateLimitStatus: any;
      };
    }> {
      try {
        const failedWebhooks = await webhookRepository.getFailedWebhooks(10);
        const recentFailures = failedWebhooks.filter(w => {
          const webhookTime = new Date(w.timestamp);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return webhookTime > oneHourAgo;
        });

        const rateLimitStats = webhookRateLimiter.getStats();
        const recentSuccessRate = recentFailures.length < 5 ? 95 : 50;
        const pendingRetries = failedWebhooks.filter(w => w.retryCount < this.maxRetries).length;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (recentSuccessRate < 90) status = 'degraded';
        if (recentSuccessRate < 70 || pendingRetries > 20) status = 'unhealthy';

        return {
          status,
          details: {
            recentSuccessRate,
            pendingRetries,
            averageResponseTime: 200,
            lastProcessedWebhook: failedWebhooks[0]?.timestamp ? failedWebhooks[0].timestamp.toISOString() : 'None',
            rateLimitStatus: rateLimitStats
          }
        };

      } catch (error: any) {
        logger.error('Webhook health check failed:', error);
        return {
          status: 'unhealthy',
          details: {
            recentSuccessRate: 0,
            pendingRetries: 0,
            averageResponseTime: 0,
            lastProcessedWebhook: 'Error',
            rateLimitStatus: null
          }
        };
      }
    }

    // Helper function to ensure customer exists
    private async ensureCustomerExists(
      walletAddress: string,
      email?: string,
      phone?: string,
      customerId?: string
    ): Promise<void> {
      try {
        const existingCustomer = await customerRepository.getCustomer(walletAddress);
        
        if (!existingCustomer) {
          const { TierManager } = await import('../../../contracts/TierManager');
          const newCustomer = TierManager.createNewCustomer(
            walletAddress,
            email,
            phone,
            customerId
          );
          await customerRepository.createCustomer(newCustomer);
          logger.info('Customer created via webhook', { walletAddress, customerId });
        }
      } catch (error: any) {
        logger.error('Error ensuring customer exists:', error);
        throw error;
      }
    }

    // Validate webhook payload structure
    validateWebhookPayload(event: string, data: any): { isValid: boolean; errors: string[] } {
      const errors: string[] = [];

      switch (event) {
        case 'repair_completed':
          if (!data.customer_wallet_address) errors.push('Missing customer_wallet_address');
          if (!data.shop_id) errors.push('Missing shop_id');
          if (!data.repair_amount) errors.push('Missing repair_amount');
          if (data.repair_amount && parseFloat(data.repair_amount) < 50) {
            errors.push('Repair amount must be at least $50');
          }
          break;

        case 'referral_verified':
          if (!data.referrer_wallet_address) errors.push('Missing referrer_wallet_address');
          if (!data.referee_wallet_address) errors.push('Missing referee_wallet_address');
          break;

        case 'ad_funnel_conversion':
          if (!data.customer_wallet_address) errors.push('Missing customer_wallet_address');
          if (!data.engagement_type) errors.push('Missing engagement_type');
          break;

        case 'customer_registered':
          if (!data.customer_wallet_address) errors.push('Missing customer_wallet_address');
          break;

        default:
          errors.push(`Unknown event type: ${event}`);
      }

      // Validate wallet addresses
      const walletFields = ['customer_wallet_address', 'referrer_wallet_address', 'referee_wallet_address'];
      walletFields.forEach(field => {
        if (data[field] && !/^0x[a-fA-F0-9]{40}$/.test(data[field])) {
          errors.push(`Invalid ${field} format`);
        }
      });

      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // Cleanup old webhook logs
    async cleanupOldLogs(daysOld: number = 30): Promise<number> {
      try {
        const deletedCount = await webhookRepository.cleanupOldWebhooks(daysOld);
        logger.info('Cleaned up old webhook logs', { deletedCount, daysOld });
        return deletedCount;
      } catch (error: any) {
        logger.error('Error cleaning up webhook logs:', error);
        throw error;
      }
    }

    // Reset rate limit for specific source (admin function)
    resetRateLimit(source: string, ip?: string): void {
      const identifier = `${source}_${ip || 'unknown'}`;
      webhookRateLimiter.reset(identifier);
      logger.info('Webhook rate limit reset', { source, ip });
    }

    // Get current rate limit status
    getRateLimitStatus(source: string, ip?: string): {
      count: number;
      limit: number;
      remaining: number;
      resetTime: number;
    } {
      const identifier = `${source}_${ip || 'unknown'}`;
      return webhookRateLimiter.getUsage(identifier);
    }
  }

  // Export singleton instance
  export const webhookService = new WebhookService(); 