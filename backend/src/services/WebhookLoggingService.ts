// backend/src/services/WebhookLoggingService.ts
import { logger } from '../utils/logger';
import { WebhookLogRepository, CreateWebhookLogInput, UpdateWebhookLogInput, WebhookLog } from '../repositories/WebhookLogRepository';

export interface WebhookEvent {
  webhookId: string;
  eventType: string;
  source: 'stripe' | 'fixflow' | 'thirdweb' | 'other';
  payload: Record<string, unknown>;
  httpStatus?: number;
}

export interface WebhookProcessResult {
  success: boolean;
  response?: Record<string, unknown>;
  errorMessage?: string;
  processingTimeMs?: number;
}

export class WebhookLoggingService {
  private repository: WebhookLogRepository;
  private readonly ENABLE_LOGGING_KEY = 'enable_webhook_logging';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_SECONDS = 60;

  constructor() {
    this.repository = new WebhookLogRepository();
  }

  /**
   * Log an incoming webhook event
   */
  async logIncomingWebhook(event: WebhookEvent): Promise<WebhookLog> {
    try {
      const input: CreateWebhookLogInput = {
        webhookId: event.webhookId,
        eventType: event.eventType,
        source: event.source,
        payload: event.payload,
        httpStatus: event.httpStatus
      };

      const log = await this.repository.create(input);

      logger.info('Webhook logged', {
        id: log.id,
        webhookId: event.webhookId,
        source: event.source,
        eventType: event.eventType
      });

      return log;
    } catch (error) {
      logger.error('Error logging webhook:', error);
      throw new Error('Failed to log webhook event');
    }
  }

  /**
   * Update webhook log with processing result
   */
  async updateWebhookResult(
    logId: number,
    result: WebhookProcessResult
  ): Promise<WebhookLog> {
    try {
      const update: UpdateWebhookLogInput = {
        status: result.success ? 'success' : 'failed',
        response: result.response,
        errorMessage: result.errorMessage,
        processedAt: new Date()
      };

      const updatedLog = await this.repository.update(logId, update);

      logger.info('Webhook result updated', {
        id: logId,
        status: update.status,
        processingTimeMs: result.processingTimeMs
      });

      return updatedLog;
    } catch (error) {
      logger.error('Error updating webhook result:', error);
      throw new Error('Failed to update webhook result');
    }
  }

  /**
   * Mark webhook for retry
   */
  async markForRetry(logId: number): Promise<WebhookLog> {
    try {
      const log = await this.repository.findById(logId);

      if (!log) {
        throw new Error(`Webhook log not found: ${logId}`);
      }

      if (log.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        logger.warn('Webhook exceeded max retry attempts', {
          id: logId,
          retryCount: log.retryCount,
          maxRetries: this.MAX_RETRY_ATTEMPTS
        });

        return await this.repository.update(logId, {
          status: 'failed',
          errorMessage: `Exceeded maximum retry attempts (${this.MAX_RETRY_ATTEMPTS})`
        });
      }

      const update: UpdateWebhookLogInput = {
        status: 'retry',
        retryCount: log.retryCount + 1,
        lastRetryAt: new Date()
      };

      const updatedLog = await this.repository.update(logId, update);

      logger.info('Webhook marked for retry', {
        id: logId,
        retryCount: updatedLog.retryCount
      });

      return updatedLog;
    } catch (error) {
      logger.error('Error marking webhook for retry:', error);
      throw new Error('Failed to mark webhook for retry');
    }
  }

  /**
   * Get webhooks that need retry
   */
  async getWebhooksForRetry(): Promise<WebhookLog[]> {
    try {
      const webhooks = await this.repository.getFailedForRetry(this.MAX_RETRY_ATTEMPTS);

      logger.info('Retrieved webhooks for retry', {
        count: webhooks.length
      });

      return webhooks;
    } catch (error) {
      logger.error('Error getting webhooks for retry:', error);
      throw new Error('Failed to get webhooks for retry');
    }
  }

  /**
   * Get webhook health metrics for monitoring
   */
  async getHealthMetrics() {
    try {
      const metrics = await this.repository.getHealthMetrics();

      logger.debug('Retrieved webhook health metrics', {
        sources: metrics.length
      });

      return metrics;
    } catch (error) {
      logger.error('Error getting webhook health metrics:', error);
      throw new Error('Failed to get webhook health metrics');
    }
  }

  /**
   * Get paginated webhook logs with filtering
   */
  async getWebhookLogs(params: {
    page?: number;
    limit?: number;
    source?: string;
    status?: string;
    eventType?: string;
  }) {
    try {
      const result = await this.repository.getPaginated(params);

      logger.debug('Retrieved webhook logs', {
        page: result.page,
        total: result.total,
        filters: params
      });

      return result;
    } catch (error) {
      logger.error('Error getting webhook logs:', error);
      throw new Error('Failed to get webhook logs');
    }
  }

  /**
   * Find webhook log by webhook ID
   */
  async findByWebhookId(webhookId: string): Promise<WebhookLog | null> {
    try {
      const log = await this.repository.findByWebhookId(webhookId);

      if (!log) {
        logger.debug('Webhook log not found', { webhookId });
      }

      return log;
    } catch (error) {
      logger.error('Error finding webhook log:', error);
      throw new Error('Failed to find webhook log');
    }
  }

  /**
   * Cleanup old webhook logs based on retention policy
   */
  async cleanup(retentionDays?: number): Promise<number> {
    try {
      const deletedCount = await this.repository.cleanup(retentionDays);

      logger.info('Webhook logs cleaned up', {
        deletedCount,
        retentionDays: retentionDays || 90
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up webhook logs:', error);
      throw new Error('Failed to cleanup webhook logs');
    }
  }

  /**
   * Helper method to wrap webhook processing with automatic logging
   */
  async processWebhookWithLogging<T>(
    event: WebhookEvent,
    processFn: () => Promise<T>
  ): Promise<{ result: T; log: WebhookLog }> {
    const startTime = Date.now();
    let logEntry: WebhookLog;

    try {
      // Log incoming webhook
      logEntry = await this.logIncomingWebhook(event);

      // Update status to processing
      await this.repository.update(logEntry.id, { status: 'processing' });

      // Execute the webhook processing function
      const result = await processFn();

      // Calculate processing time
      const processingTimeMs = Date.now() - startTime;

      // Update with success
      const updatedLog = await this.updateWebhookResult(logEntry.id, {
        success: true,
        response: { result },
        processingTimeMs
      });

      return { result, log: updatedLog };
    } catch (error) {
      logger.error('Webhook processing failed', {
        webhookId: event.webhookId,
        error: error.message
      });

      const processingTimeMs = Date.now() - startTime;

      // Update with failure
      if (logEntry!) {
        const updatedLog = await this.updateWebhookResult(logEntry.id, {
          success: false,
          errorMessage: error.message,
          processingTimeMs
        });

        // Mark for retry if appropriate
        if (this.shouldRetry(error)) {
          await this.markForRetry(updatedLog.id);
        }

        throw error;
      }

      throw error;
    }
  }

  /**
   * Determine if a webhook should be retried based on error
   */
  private shouldRetry(error: Error): boolean {
    // Retry on network errors, temporary failures
    const retryableErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN'
    ];

    return retryableErrors.some(code =>
      error.message.includes(code) ||
      (error as NodeJS.ErrnoException).code === code
    );
  }

  /**
   * Check webhook health and create alerts if needed
   */
  async checkWebhookHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: Awaited<ReturnType<typeof this.getHealthMetrics>>;
  }> {
    try {
      const metrics = await this.getHealthMetrics();
      const issues: string[] = [];

      for (const metric of metrics) {
        const successRate = metric.totalCount > 0
          ? (metric.successCount / metric.totalCount) * 100
          : 100;

        // Alert if success rate is below 90%
        if (successRate < 90 && metric.totalCount >= 10) {
          issues.push(
            `${metric.source}: Low success rate (${successRate.toFixed(1)}%)`
          );
        }

        // Alert if average processing time is high
        if (metric.avgProcessingTimeMs > 5000) {
          issues.push(
            `${metric.source}: High processing time (${metric.avgProcessingTimeMs.toFixed(0)}ms)`
          );
        }

        // Alert if high retry count
        if (metric.retryCount > metric.totalCount * 0.2) {
          issues.push(
            `${metric.source}: High retry rate (${metric.retryCount} retries)`
          );
        }
      }

      const healthy = issues.length === 0;

      if (!healthy) {
        logger.warn('Webhook health check failed', {
          issues,
          metrics
        });
      }

      return { healthy, issues, metrics };
    } catch (error) {
      logger.error('Error checking webhook health:', error);
      return {
        healthy: false,
        issues: ['Failed to check webhook health'],
        metrics: []
      };
    }
  }
}

// Export singleton instance
export const webhookLoggingService = new WebhookLoggingService();
