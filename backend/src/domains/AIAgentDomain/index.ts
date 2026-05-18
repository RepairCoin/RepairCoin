// backend/src/domains/AIAgentDomain/index.ts
import { Router } from 'express';
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { eventBus } from '../../events/EventBus';
import { OrderConfirmationHandler } from './services/OrderConfirmationHandler';
import { BookingConfirmationHandler } from './services/BookingConfirmationHandler';
import { WebSocketManager } from '../../services/WebSocketManager';

/**
 * AI Sales Agent domain.
 *
 * Phase 3 home for the AI orchestration code:
 *   - GET  /api/ai/health      — liveness check
 *   - POST /api/ai/preview     — shop-side live preview (Task 6)
 *   - Auto-reply hook in MessageService.sendMessage (Task 8)
 *   - Order completion confirmation hook (Task 11) — subscribed below
 *
 * Required env vars (validated at startup by StartupValidationService):
 *   - ANTHROPIC_API_KEY              (required in production)
 *   - ANTHROPIC_DEFAULT_MODEL        (default: claude-sonnet-4-6)
 *   - ANTHROPIC_FALLBACK_MODEL       (default: claude-haiku-4-5-20251001)
 *
 * Mount path: /api/ai  (DomainRegistry mounts at /api/${domain.name})
 */
export class AIAgentDomain implements DomainModule {
  name = 'ai';
  routes: Router;
  private orderConfirmationHandler: OrderConfirmationHandler | null = null;
  private orderConfirmationAvailable: boolean | null = null;
  // Booking-confirmation handler (templated, no Claude call) — constructed
  // unconditionally since it has no ANTHROPIC_API_KEY dependency.
  private bookingConfirmationHandler: BookingConfirmationHandler;

  constructor() {
    this.routes = initializeRoutes();
    this.bookingConfirmationHandler = new BookingConfirmationHandler();
  }

  /**
   * Wire the AI confirmation handlers to the WebSocket manager so their
   * replies land in the customer's chat in real-time. Called by app.ts
   * after the WS server boots, mirroring the messaging + notification
   * domains' pattern.
   */
  setWebSocketManager(wsManager: WebSocketManager): void {
    const handler = this.getOrCreateOrderConfirmationHandler();
    handler?.setWebSocketManager(wsManager);
    this.bookingConfirmationHandler.setWebSocketManager(wsManager);
  }

  async initialize(): Promise<void> {
    // Subscribe the order-completion confirmation hook (Phase 3 Task 11).
    // We lazy-construct the handler so a missing ANTHROPIC_API_KEY in
    // dev/test envs doesn't crash domain init — same pattern Task 8 uses
    // for the message-send hook.
    const handler = this.getOrCreateOrderConfirmationHandler();
    if (handler) {
      eventBus.subscribe(
        'service.order_completed',
        (event) => handler.handleOrderCompleted(event),
        'AIAgentDomain'
      );
      logger.info(`${this.name} domain: subscribed to service.order_completed`);
    } else {
      logger.warn(
        `${this.name} domain: OrderConfirmationHandler unavailable (likely no ANTHROPIC_API_KEY); confirmation hook disabled`
      );
    }

    // Subscribe the booking-confirmation hook. Posts a templated "your
    // appointment is confirmed" message into the chat when a customer pays
    // for a booking that started from an AI booking card. No Claude call,
    // so it runs regardless of ANTHROPIC_API_KEY.
    eventBus.subscribe(
      'service.order_paid',
      (event) => this.bookingConfirmationHandler.handleOrderPaid(event),
      'AIAgentDomain'
    );
    logger.info(`${this.name} domain: subscribed to service.order_paid`);

    logger.info(`${this.name} domain initialized — AI Sales Agent`);
  }

  /**
   * Lazy construction guarded against AnthropicClient instantiation throwing
   * when ANTHROPIC_API_KEY is missing (dev/test). Returns null after the
   * first failed attempt to avoid spamming logs.
   */
  private getOrCreateOrderConfirmationHandler(): OrderConfirmationHandler | null {
    if (this.orderConfirmationAvailable === false) return null;
    if (this.orderConfirmationHandler) return this.orderConfirmationHandler;
    try {
      this.orderConfirmationHandler = new OrderConfirmationHandler();
      this.orderConfirmationAvailable = true;
      return this.orderConfirmationHandler;
    } catch (err) {
      logger.warn('AIAgentDomain: OrderConfirmationHandler construction failed', {
        error: (err as Error)?.message,
      });
      this.orderConfirmationAvailable = false;
      return null;
    }
  }
}
