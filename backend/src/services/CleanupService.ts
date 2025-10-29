// backend/src/services/CleanupService.ts
import { logger } from '../utils/logger';
import { WebhookLogRepository } from '../repositories/WebhookLogRepository';
import { databasePool } from '../config/database-pool';

export interface CleanupReport {
  timestamp: Date;
  webhookLogsDeleted: number;
  transactionsArchived: number;
  errors: string[];
  totalDurationMs: number;
}

export interface CleanupConfig {
  webhookRetentionDays: number;
  transactionArchiveDays: number;
  enableWebhookCleanup: boolean;
  enableTransactionArchiving: boolean;
}

export class CleanupService {
  private webhookLogRepository: WebhookLogRepository;
  private isRunning: boolean = false;
  private scheduledIntervalId: NodeJS.Timeout | null = null;

  private defaultConfig: CleanupConfig = {
    webhookRetentionDays: 90,
    transactionArchiveDays: 365,
    enableWebhookCleanup: true,
    enableTransactionArchiving: true
  };

  constructor() {
    this.webhookLogRepository = new WebhookLogRepository(databasePool);
  }

  /**
   * Run all cleanup operations
   */
  async runCleanup(config?: Partial<CleanupConfig>): Promise<CleanupReport> {
    if (this.isRunning) {
      throw new Error('Cleanup is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let webhookLogsDeleted = 0;
    let transactionsArchived = 0;

    const finalConfig = { ...this.defaultConfig, ...config };

    logger.info('Starting cleanup operations', {
      config: finalConfig
    });

    try {
      // Clean up webhook logs
      if (finalConfig.enableWebhookCleanup) {
        try {
          webhookLogsDeleted = await this.cleanupWebhookLogs(
            finalConfig.webhookRetentionDays
          );
        } catch (error) {
          const errorMsg = `Webhook cleanup failed: ${error.message}`;
          logger.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      // Archive old transactions
      if (finalConfig.enableTransactionArchiving) {
        try {
          transactionsArchived = await this.archiveOldTransactions(
            finalConfig.transactionArchiveDays
          );
        } catch (error) {
          const errorMsg = `Transaction archiving failed: ${error.message}`;
          logger.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      const totalDurationMs = Date.now() - startTime;

      const report: CleanupReport = {
        timestamp: new Date(),
        webhookLogsDeleted,
        transactionsArchived,
        errors,
        totalDurationMs
      };

      logger.info('Cleanup operations completed', report);

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up old webhook logs
   */
  async cleanupWebhookLogs(retentionDays: number = 90): Promise<number> {
    try {
      logger.info('Cleaning up webhook logs', { retentionDays });

      const deletedCount = await this.webhookLogRepository.cleanup(retentionDays);

      logger.info('Webhook logs cleanup completed', {
        deletedCount,
        retentionDays
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up webhook logs:', error);
      throw new Error('Failed to cleanup webhook logs');
    }
  }

  /**
   * Archive old transactions to archived_transactions table
   */
  async archiveOldTransactions(retentionDays: number = 365): Promise<number> {
    try {
      logger.info('Archiving old transactions', { retentionDays });

      const query = 'SELECT archive_old_transactions($1)';
      const result = await databasePool.query(query, [retentionDays]);

      const archivedCount = parseInt(result.rows[0].archive_old_transactions || '0');

      logger.info('Transaction archiving completed', {
        archivedCount,
        retentionDays
      });

      return archivedCount;
    } catch (error) {
      logger.error('Error archiving transactions:', error);
      throw new Error('Failed to archive transactions');
    }
  }

  /**
   * Get statistics about archived data
   */
  async getArchiveStatistics(): Promise<{
    archivedTransactions: {
      total: number;
      oldestDate: Date | null;
      newestDate: Date | null;
      totalAmount: number;
    };
    webhookLogs: {
      total: number;
      oldestDate: Date | null;
      successCount: number;
      failedCount: number;
    };
  }> {
    try {
      // Get archived transactions stats
      const archivedTransQuery = `
        SELECT
          COUNT(*) as total,
          MIN(created_at) as oldest_date,
          MAX(created_at) as newest_date,
          COALESCE(SUM(amount), 0) as total_amount
        FROM archived_transactions
      `;

      // Get webhook logs stats
      const webhookLogsQuery = `
        SELECT
          COUNT(*) as total,
          MIN(created_at) as oldest_date,
          COUNT(*) FILTER (WHERE status = 'success') as success_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count
        FROM webhook_logs
      `;

      const [archivedResult, webhookResult] = await Promise.all([
        databasePool.query(archivedTransQuery),
        databasePool.query(webhookLogsQuery)
      ]);

      const archivedRow = archivedResult.rows[0];
      const webhookRow = webhookResult.rows[0];

      return {
        archivedTransactions: {
          total: parseInt(archivedRow.total || '0'),
          oldestDate: archivedRow.oldest_date,
          newestDate: archivedRow.newest_date,
          totalAmount: parseFloat(archivedRow.total_amount || '0')
        },
        webhookLogs: {
          total: parseInt(webhookRow.total || '0'),
          oldestDate: webhookRow.oldest_date,
          successCount: parseInt(webhookRow.success_count || '0'),
          failedCount: parseInt(webhookRow.failed_count || '0')
        }
      };
    } catch (error) {
      logger.error('Error getting archive statistics:', error);
      throw new Error('Failed to get archive statistics');
    }
  }

  /**
   * Get cleanup recommendations based on current data
   */
  async getCleanupRecommendations(): Promise<{
    shouldCleanup: boolean;
    recommendations: string[];
    estimatedSavings: {
      webhookLogs: number;
      transactions: number;
    };
  }> {
    try {
      const stats = await this.getArchiveStatistics();
      const recommendations: string[] = [];
      let shouldCleanup = false;

      // Check webhook logs
      if (stats.webhookLogs.total > 10000) {
        recommendations.push(
          `High number of webhook logs (${stats.webhookLogs.total}). Consider cleanup.`
        );
        shouldCleanup = true;
      }

      // Check old transactions
      const oldTransactionsQuery = `
        SELECT COUNT(*) as old_count
        FROM transactions
        WHERE created_at < NOW() - INTERVAL '365 days'
        AND status = 'completed'
      `;

      const oldTransResult = await databasePool.query(oldTransactionsQuery);
      const oldTransCount = parseInt(oldTransResult.rows[0].old_count || '0');

      if (oldTransCount > 1000) {
        recommendations.push(
          `${oldTransCount} old transactions ready for archiving (>365 days).`
        );
        shouldCleanup = true;
      }

      // Estimate space savings
      const estimatedSavings = {
        webhookLogs: Math.floor(stats.webhookLogs.total * 0.7), // Estimate 70% can be cleaned
        transactions: oldTransCount
      };

      return {
        shouldCleanup,
        recommendations,
        estimatedSavings
      };
    } catch (error) {
      logger.error('Error getting cleanup recommendations:', error);
      throw new Error('Failed to get cleanup recommendations');
    }
  }

  /**
   * Schedule automatic cleanup operations
   */
  scheduleCleanup(intervalHours: number = 24, config?: Partial<CleanupConfig>): void {
    if (this.scheduledIntervalId) {
      logger.warn('Cleanup is already scheduled');
      return;
    }

    // Run immediately
    this.runCleanup(config).catch(error => {
      logger.error('Scheduled cleanup failed:', error);
    });

    // Schedule periodic runs
    this.scheduledIntervalId = setInterval(async () => {
      try {
        await this.runCleanup(config);
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    }, intervalHours * 60 * 60 * 1000);

    logger.info('Cleanup scheduled', {
      intervalHours,
      config: { ...this.defaultConfig, ...config }
    });
  }

  /**
   * Stop scheduled cleanup operations
   */
  stopScheduledCleanup(): void {
    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
      logger.info('Scheduled cleanup stopped');
    }
  }

  /**
   * Check if cleanup is currently running
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get cleanup configuration from system settings
   */
  async getCleanupConfigFromSettings(): Promise<CleanupConfig> {
    try {
      const query = `
        SELECT key, value
        FROM system_settings
        WHERE category = 'cleanup'
      `;

      const result = await databasePool.query(query);
      const config: Partial<CleanupConfig> = {};

      for (const row of result.rows) {
        if (row.key === 'webhook_retention_days') {
          config.webhookRetentionDays = parseInt(row.value);
        } else if (row.key === 'transaction_archive_days') {
          config.transactionArchiveDays = parseInt(row.value);
        }
      }

      return { ...this.defaultConfig, ...config };
    } catch (error) {
      logger.error('Error getting cleanup config from settings:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Perform emergency cleanup if database is getting full
   */
  async emergencyCleanup(): Promise<CleanupReport> {
    logger.warn('Running emergency cleanup');

    const aggressiveConfig: CleanupConfig = {
      webhookRetentionDays: 30, // More aggressive
      transactionArchiveDays: 180, // More aggressive
      enableWebhookCleanup: true,
      enableTransactionArchiving: true
    };

    return await this.runCleanup(aggressiveConfig);
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();
