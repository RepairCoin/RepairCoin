// backend/src/services/RescheduleExpirationService.ts
import { logger } from '../utils/logger';
import { RescheduleService } from '../domains/ServiceDomain/services/RescheduleService';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

class RescheduleExpirationService {
  private rescheduleService: RescheduleService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.rescheduleService = new RescheduleService();
  }

  /**
   * Run expiration check once
   */
  private async runExpiration(): Promise<void> {
    try {
      const expired = await this.rescheduleService.expireOldRequests();
      if (expired.length > 0) {
        logger.info(`⏰ Reschedule expiration: expired ${expired.length} pending request(s)`);
      } else {
        logger.debug('⏰ Reschedule expiration: no pending requests to expire');
      }
    } catch (error) {
      logger.error('Error in reschedule expiration run:', error);
    }
  }

  /**
   * Start the scheduled expiration job (every hour)
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Reschedule expiration service is already running');
      return;
    }

    // Run immediately on start
    this.runExpiration();

    this.intervalId = setInterval(() => {
      this.runExpiration();
    }, INTERVAL_MS);

    logger.info('⏰ Reschedule expiration service started (runs every hour)');
  }

  /**
   * Stop the scheduled expiration job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('⏰ Reschedule expiration service stopped');
    }
  }
}

export const rescheduleExpirationService = new RescheduleExpirationService();
