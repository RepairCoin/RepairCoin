// backend/src/services/RescheduleExpirationService.ts
import { logger } from '../utils/logger';
import { RescheduleService } from '../domains/ServiceDomain/services/RescheduleService';

/**
 * Service that runs scheduled jobs to expire old reschedule requests
 * Runs every hour to mark pending requests that have exceeded their expiration time
 */
class RescheduleExpirationService {
  private scheduledIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private rescheduleService: RescheduleService | null = null;

  /**
   * Start the scheduled expiration job
   * Runs every hour
   */
  start(): void {
    if (this.scheduledIntervalId) {
      logger.warn('Reschedule expiration service already running');
      return;
    }

    // Run every hour (60 * 60 * 1000 = 3600000 ms)
    const INTERVAL_MS = 60 * 60 * 1000;

    // Run immediately on start
    this.runExpirationJob();

    // Then schedule to run every hour
    this.scheduledIntervalId = setInterval(() => {
      this.runExpirationJob();
    }, INTERVAL_MS);

    logger.info('Reschedule expiration service started (runs every hour)');
  }

  /**
   * Stop the scheduled expiration job
   */
  stop(): void {
    if (this.scheduledIntervalId) {
      clearInterval(this.scheduledIntervalId);
      this.scheduledIntervalId = null;
      logger.info('Reschedule expiration service stopped');
    }
  }

  /**
   * Run the expiration job
   */
  private async runExpirationJob(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Reschedule expiration job already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.debug('Running reschedule expiration job...');

      // Get or initialize the reschedule service
      if (!this.rescheduleService) {
        this.rescheduleService = new RescheduleService();
      }

      // Expire old requests
      const expiredRequests = await this.rescheduleService.expireOldRequests();

      if (expiredRequests.length > 0) {
        logger.info('Reschedule expiration job completed', {
          expiredCount: expiredRequests.length,
          requestIds: expiredRequests.map(r => r.requestId),
        });
      } else {
        logger.debug('Reschedule expiration job completed - no requests to expire');
      }
    } catch (error) {
      logger.error('Error in reschedule expiration job:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if the service is currently running
   */
  isServiceRunning(): boolean {
    return this.scheduledIntervalId !== null;
  }

  /**
   * Manually trigger the expiration job (for testing)
   */
  async triggerManualRun(): Promise<void> {
    await this.runExpirationJob();
  }
}

// Export singleton instance
export const rescheduleExpirationService = new RescheduleExpirationService();
