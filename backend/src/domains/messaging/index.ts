// backend/src/domains/messaging/index.ts
import { DomainModule } from '../types';
import { logger } from '../../utils/logger';
import messagingRoutes from './routes';
import { MessageService, messageService } from './services/MessageService';
import { WebSocketManager } from '../../services/WebSocketManager';
import { eventBus } from '../../events/EventBus';
import { autoMessageSchedulerService } from '../../services/AutoMessageSchedulerService';
import { getSharedPool } from '../../utils/database-pool';

/**
 * Ratings at or below this fire the `low_rating` trigger as well as `review_received` (W3). 1–2 stars
 * out of 5 is unambiguously an unhappy customer; 3 is mixed, and firing a "let us make it right" flow
 * at someone who left a fair review would read as tone-deaf.
 */
const LOW_RATING_THRESHOLD = 2;

export class MessagingDomain implements DomainModule {
  name = 'messages';
  routes = messagingRoutes;
  private messageService: MessageService = messageService;
  private wsManager?: WebSocketManager;
  private cleanupInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    this.setupPeriodicCleanup();
    this.setupEventSubscriptions();
    logger.info('Messaging domain initialized');
  }

  public setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
    this.messageService.setWebSocketManager(wsManager);
    logger.info('WebSocket manager attached to MessagingDomain');
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

    // Custom Workflows W3 — operations triggers. Until now every trigger was a marketing/customer
    // moment; these are the events a shop reacts to operationally.

    // no_show → "sorry we missed you, want to rebook?"
    eventBus.subscribe('service.order_no_show', async (event) => {
      try {
        const { shopId, customerAddress, orderId } = event.data;
        if (!shopId || !customerAddress) return;
        await autoMessageSchedulerService.handleEventTrigger('no_show', { shopId, customerAddress, orderId });
      } catch (error) {
        logger.error('Error handling order_no_show for auto-messages:', error);
      }
    }, 'MessagingDomain');

    // review:created → 'review_received' always, plus 'low_rating' for 1–2 stars so a shop can run a
    // different flow for an unhappy customer than for a happy one. Two event types rather than one
    // because the engine has no condition system to branch on rating.
    eventBus.subscribe('review:created', async (event) => {
      try {
        const { shopId, customerAddress, rating } = event.data;
        // shopId was added to this event for W3; older publishers only carried shopAddress.
        if (!shopId || !customerAddress) return;

        await autoMessageSchedulerService.handleEventTrigger('review_received', { shopId, customerAddress });

        if (typeof rating === 'number' && rating <= LOW_RATING_THRESHOLD) {
          await autoMessageSchedulerService.handleEventTrigger('low_rating', { shopId, customerAddress });
        }
      } catch (error) {
        logger.error('Error handling review:created for auto-messages:', error);
      }
    }, 'MessagingDomain');

    logger.info(
      'Messaging domain event subscriptions registered (order_completed, order_cancelled, order_no_show, review:created)'
    );
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
