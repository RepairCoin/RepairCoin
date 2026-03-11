// backend/src/domains/messaging/index.ts
import { DomainModule } from '../types';
import { logger } from '../../utils/logger';
import messagingRoutes from './routes';
import { MessageService } from './services/MessageService';
import { eventBus } from '../../events/EventBus';
import { autoMessageSchedulerService } from '../../services/AutoMessageSchedulerService';
import { getSharedPool } from '../../utils/database-pool';

export class MessagingDomain implements DomainModule {
  name = 'messages';
  routes = messagingRoutes;
  private messageService!: MessageService;
  private cleanupInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    this.messageService = new MessageService();
    this.setupPeriodicCleanup();
    this.setupEventSubscriptions();
    logger.info('Messaging domain initialized');
  }

  /**
   * Subscribe to domain events for event-based auto-messages
   */
  private setupEventSubscriptions(): void {
    // booking_completed → triggers auto-messages with event_type = 'booking_completed'
    // Also checks if this is the customer's first completed order at this shop → triggers 'first_visit'
    eventBus.subscribe('service.order_completed', async (event) => {
      try {
        const { shopId, customerAddress, orderId } = event.data;
        if (!shopId || !customerAddress) return;

        await autoMessageSchedulerService.handleEventTrigger('booking_completed', {
          shopId,
          customerAddress,
          orderId,
        });

        // Check if this is the customer's first completed order at this shop
        try {
          const pool = getSharedPool();
          const result = await pool.query(
            `SELECT COUNT(*) FROM service_orders
             WHERE LOWER(customer_address) = LOWER($1) AND shop_id = $2 AND status = 'completed'`,
            [customerAddress, shopId]
          );
          const completedCount = parseInt(result.rows[0].count, 10);
          if (completedCount === 1) {
            logger.info('First visit detected, triggering first_visit auto-message', { customerAddress, shopId });
            await autoMessageSchedulerService.handleEventTrigger('first_visit', {
              shopId,
              customerAddress,
              orderId,
            });
          }
        } catch (firstVisitError) {
          logger.error('Error checking first visit:', firstVisitError);
        }
      } catch (error) {
        logger.error('Error handling order_completed for auto-messages:', error);
      }
    }, 'MessagingDomain');

    // booking_cancelled → triggers auto-messages with event_type = 'booking_cancelled'
    eventBus.subscribe('service.order_cancelled', async (event) => {
      try {
        const { shopId, customerAddress, orderId } = event.data;
        if (!shopId || !customerAddress) return;

        await autoMessageSchedulerService.handleEventTrigger('booking_cancelled', {
          shopId,
          customerAddress,
          orderId,
        });
      } catch (error) {
        logger.error('Error handling order_cancelled for auto-messages:', error);
      }
    }, 'MessagingDomain');

    logger.info('Messaging domain event subscriptions registered (order_completed, order_cancelled)');
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
