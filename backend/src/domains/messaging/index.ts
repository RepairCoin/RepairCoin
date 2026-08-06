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

    // booking_created → the moment a booking is made, as opposed to completed. Lets a shop send what
    // the confirmation deliberately doesn't: parking directions, what to bring, an upsell.
    //
    // Every creation path publishes this now. It previously came only from the manual-booking and
    // ad-lead paths, so subscribing before PaymentService was fixed would have produced a rule that
    // fired for shop-entered bookings and silently ignored the ones customers made themselves — active
    // on screen, absent in practice, and nothing in the UI could have shown the difference.
    eventBus.subscribe('service.order_created', async (event) => {
      try {
        const { shopId, customerAddress, orderId } = event.data;
        if (!shopId || !customerAddress) return;
        await autoMessageSchedulerService.handleEventTrigger('booking_created', {
          shopId,
          customerAddress,
          orderId,
        });
      } catch (error) {
        logger.error('Error handling order_created for auto-messages:', error);
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

    // payment_failed → a recoverable moment: the customer wanted the service and the card didn't go
    // through. Customer-scoped, so it uses the normal path.
    eventBus.subscribe('service.payment_failed', async (event) => {
      try {
        const { shopId, customerAddress, orderId } = event.data;
        if (!shopId || !customerAddress) return;
        await autoMessageSchedulerService.handleEventTrigger('payment_failed', { shopId, customerAddress, orderId });
      } catch (error) {
        logger.error('Error handling payment_failed for auto-messages:', error);
      }
    }, 'MessagingDomain');

    // low_stock → the first SHOP-scoped trigger: it happens to the shop, with no customer involved.
    // Reuses the event LowStockAlertService already publishes, which also already throttles per item
    // and honours the shop's digest preference — so the automation inherits that de-duplication
    // instead of building a second, competing one.
    /**
     * W3 — a new lead from an ad campaign.
     *
     * SHOP-scoped, and that is not a shortcut: an ad lead is a name and a phone number, not a platform
     * customer. There is no wallet to message and nobody to credit RCN to until they convert, so a
     * customer-facing action here would have nothing to act on. The useful automation is "tell the team
     * to ring them", which is what the shop-scoped path gives.
     *
     * shopId is read from the payload rather than looked up here — LeadAttributionService resolves it
     * via campaign_id → ad_campaigns.shop_id, because ad_leads has no shop of its own.
     */
    eventBus.subscribe('ads:lead_captured', async (event) => {
      try {
        const { shopId, campaignId } = event.data;
        // Absent when the campaign lookup failed. Skipping is right: an automation addressed to no
        // shop would either do nothing or, worse, be attributed to the wrong one.
        if (!shopId) return;

        await autoMessageSchedulerService.handleShopEvent('new_ad_lead', {
          shopId,
          reference: event.aggregateId ? String(event.aggregateId) : undefined,
          summary: 'A new lead came in from your ads.',
        });
      } catch (error) {
        logger.error('Error handling ads:lead_captured for automations:', error);
      }
    });

    /**
     * subscription_lapsed → the shop's OWN subscription payment failed.
     *
     * Deliberately scoped to the payment FAILING, not to the subscription being cancelled. After a
     * cancellation the shop is no longer entitled to automations at all — `isShopEntitled` skips it —
     * so a workflow is structurally the wrong channel for "you have been cut off"; that belongs in a
     * billing email. Firing while they are still `past_due` is both deliverable and more useful: it is
     * a warning with time left to act on it.
     *
     * Rides on `payment.webhook.failed`, which the Stripe webhook already publishes with the shopId
     * resolved. No new publish — the event existed and nothing consumed it for automations.
     *
     * Fires once per INVOICE, not once per attempt, via the reference dedup in handleShopEvent. Stripe
     * retries a failed invoice over several days and re-delivers webhooks on any non-2xx, so without
     * that the team would be paged repeatedly about one unpaid bill.
     */
    eventBus.subscribe('payment.webhook.failed', async (event) => {
      try {
        const { shopId, invoiceId, attemptCount } = event.data;
        if (!shopId) return;

        const n = Number(attemptCount) || 1;
        await autoMessageSchedulerService.handleShopEvent('subscription_lapsed', {
          shopId,
          // The invoice, not the attempt — so retry number 2 for the same bill is recognised as the
          // same problem rather than a new one.
          reference: invoiceId ? String(invoiceId) : undefined,
          summary:
            n > 1
              ? `Your subscription payment failed again (attempt ${n}). Update your card to avoid losing access.`
              : 'Your subscription payment failed. Update your card to avoid losing access.',
        });
      } catch (error) {
        logger.error('Error handling payment.webhook.failed for automations:', error);
      }
    }, 'MessagingDomain');

    eventBus.subscribe('inventory:low_stock_alert', async (event) => {
      try {
        const { shopId, items, itemsCount } = event.data;
        if (!shopId) return;

        const names = Array.isArray(items) ? items.slice(0, 3).map((i: any) => i.name).filter(Boolean) : [];
        const more = (itemsCount || names.length) - names.length;
        const summary =
          names.length > 0
            ? `Low stock: ${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`
            : `${itemsCount || 'Some'} item(s) are low on stock.`;

        await autoMessageSchedulerService.handleShopEvent('low_stock', {
          shopId,
          reference: Array.isArray(items) && items[0]?.id ? String(items[0].id) : undefined,
          summary,
        });
      } catch (error) {
        logger.error('Error handling low_stock_alert for automations:', error);
      }
    }, 'MessagingDomain');

    logger.info(
      'Messaging domain event subscriptions registered (order_completed, order_cancelled, order_no_show, review:created, payment_failed, low_stock_alert)'
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
