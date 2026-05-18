// backend/src/domains/AIAgentDomain/index.ts
import { Router } from 'express';
import { DomainModule } from '../types';
import { initializeRoutes } from './routes';
import { logger } from '../../utils/logger';
import { eventBus } from '../../events/EventBus';
import { OrderConfirmationHandler } from './services/OrderConfirmationHandler';
import { BookingConfirmationHandler } from './services/BookingConfirmationHandler';
import { AISalesFollowUpHandler } from './services/AISalesFollowUpHandler';
import { AISalesFollowUpDetector } from './services/AISalesFollowUpDetector';
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
  // AI sales follow-up nudge (Claude-backed) — lazily constructed since it
  // needs ANTHROPIC_API_KEY. The detector polls; the handler sends.
  private followUpHandler: AISalesFollowUpHandler | null = null;
  private followUpDetector: AISalesFollowUpDetector | null = null;

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
    // followUpHandler is constructed in initialize() (runs before this).
    this.followUpHandler?.setWebSocketManager(wsManager);
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

    // Start the AI sales follow-up detector — polls every 5 minutes for
    // customers who went quiet mid-conversation and nudges them. Per-shop
    // gated by ai_shop_settings.ai_followup_enabled (staged rollout: OFF
    // by default). AI_FOLLOWUP_ENABLED=false is a global kill-switch.
    if (process.env.AI_FOLLOWUP_ENABLED === 'false') {
      logger.info(`${this.name} domain: AI follow-up detector DISABLED via AI_FOLLOWUP_ENABLED=false`);
    } else {
      try {
        this.followUpHandler = new AISalesFollowUpHandler();
        this.followUpDetector = new AISalesFollowUpDetector(this.followUpHandler);
        this.followUpDetector.start();
        logger.info(`${this.name} domain: AI sales follow-up detector started`);
      } catch (err) {
        // AISalesFollowUpHandler builds an AnthropicClient — missing
        // ANTHROPIC_API_KEY in dev/test throws here. Degrade gracefully.
        this.followUpHandler = null;
        this.followUpDetector = null;
        logger.warn(
          `${this.name} domain: AI follow-up detector unavailable (likely no ANTHROPIC_API_KEY)`,
          { error: (err as Error)?.message }
        );
      }
    }

    logger.info(`${this.name} domain initialized — AI Sales Agent`);
  }

  /** Stop background jobs on graceful shutdown (DomainModule.cleanup). */
  async cleanup(): Promise<void> {
    this.followUpDetector?.stop();
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
