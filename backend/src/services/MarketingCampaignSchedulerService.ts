import { logger } from '../utils/logger';
import { MarketingService } from './MarketingService';

export class MarketingCampaignSchedulerService {
  private marketingService: MarketingService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.marketingService = new MarketingService();
  }

  async processOnce(): Promise<void> {
    try {
      const result = await this.marketingService.processScheduledCampaigns();
      if (result.processed > 0 || result.failed > 0) {
        logger.info('Marketing campaign scheduler run completed', result);
      }
    } catch (error) {
      logger.error('Marketing campaign scheduler run failed:', error);
    }
  }

  start(intervalSeconds: number = 60): void {
    if (this.intervalId) {
      logger.warn('Marketing campaign scheduler already started');
      return;
    }

    this.processOnce();

    this.intervalId = setInterval(() => {
      this.processOnce();
    }, intervalSeconds * 1000);

    logger.info('Marketing campaign scheduler started', { intervalSeconds });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Marketing campaign scheduler stopped');
    }
  }
}

export const marketingCampaignSchedulerService = new MarketingCampaignSchedulerService();
