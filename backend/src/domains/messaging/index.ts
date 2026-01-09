// backend/src/domains/messaging/index.ts
import { DomainModule } from '../types';
import { logger } from '../../utils/logger';
import messagingRoutes from './routes';
import { MessageService } from './services/MessageService';

export class MessagingDomain implements DomainModule {
  name = 'messages';
  routes = messagingRoutes;
  private messageService!: MessageService;
  private cleanupInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    this.messageService = new MessageService();
    this.setupPeriodicCleanup();
    logger.info('Messaging domain initialized');
  }

  /**
   * Set up periodic cleanup of expired typing indicators
   * Runs every 30 seconds
   */
  private setupPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.messageService.cleanupExpiredTypingIndicators();
      } catch (error) {
        logger.error('Error cleaning up typing indicators:', error);
      }
    }, 30000); // 30 seconds

    logger.info('Messaging cleanup scheduler started');
  }

  /**
   * Cleanup when domain is shutting down
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Messaging cleanup scheduler stopped');
    }
  }
}
