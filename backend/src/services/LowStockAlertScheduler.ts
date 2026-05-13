// backend/src/services/LowStockAlertScheduler.ts
import cron from 'node-cron';
import { logger } from '../utils/logger';
import { getLowStockAlertService, LowStockAlertResult } from './LowStockAlertService';

export class LowStockAlertScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastRun: Date | null = null;
  private lastRunResults: LowStockAlertResult[] = [];

  /**
   * Start the low stock alert scheduler
   * Runs every day at 9:00 AM
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Low stock alert scheduler is already running');
      return;
    }

    // Run every day at 9:00 AM
    // Cron format: minute hour day month weekday
    // '0 9 * * *' = At 09:00 every day
    this.cronJob = cron.schedule('0 9 * * *', async () => {
      await this.runAlertCheck();
    }, {
      timezone: 'America/New_York' // Adjust to your timezone
    });

    logger.info('Low stock alert scheduler started - will run daily at 9:00 AM');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Low stock alert scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  /**
   * Run the alert check manually
   */
  async runAlertCheck(): Promise<LowStockAlertResult[]> {
    if (this.isRunning) {
      logger.warn('Low stock alert check is already running, skipping...');
      return [];
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled low stock alert check...');

      const alertService = getLowStockAlertService();
      const results = await alertService.checkAndSendAlerts();

      this.lastRun = new Date();
      this.lastRunResults = results;

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.emailSent).length;
      const errorCount = results.filter(r => r.error).length;

      logger.info(`Low stock alert check completed in ${duration}ms`, {
        totalShops: results.length,
        emailsSent: successCount,
        errors: errorCount
      });

      return results;
    } catch (error) {
      logger.error('Error in scheduled low stock alert check:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isSchedulerRunning(),
      isCheckInProgress: this.isRunning,
      lastRun: this.lastRun,
      lastRunResults: this.lastRunResults,
      schedule: '9:00 AM daily',
      timezone: 'America/New_York'
    };
  }
}

// Singleton instance
let schedulerInstance: LowStockAlertScheduler | null = null;

export function getLowStockAlertScheduler(): LowStockAlertScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new LowStockAlertScheduler();
  }
  return schedulerInstance;
}

// Auto-start scheduler when module is loaded (for production)
if (process.env.NODE_ENV === 'production' && process.env.LOW_STOCK_ALERTS_ENABLED !== 'false') {
  const scheduler = getLowStockAlertScheduler();
  scheduler.start();
  logger.info('Low stock alert scheduler auto-started for production');
}
