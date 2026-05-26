// backend/src/domains/AIAgentDomain/services/RescheduleRequestOutcomeHandler.ts
//
// Follow-on to RescheduleRequestConfirmationHandler. After the customer
// submits a reschedule request via the AI chat (Phase 5 — already shipped),
// the shop either approves, rejects, or lets it expire. This handler closes
// the loop in the chat thread by posting an AI message into the originating
// conversation when any of those terminal events fires.
//
// Three subscriptions:
//   - reschedule:request_approved — "your reschedule was approved, you're now on {newSlot}"
//   - reschedule:request_rejected — "the shop wasn't able to move your booking, original time stands"
//   - reschedule:request_expired  — "the shop didn't respond, original time stands"
//
// Same scope rules as the other AI-chat confirmation handlers:
//   - Only posts when the order has a `conversation_id` (originated from AI chat).
//   - Templated messages (no Claude call), so no ANTHROPIC_API_KEY dependency.
//   - Idempotent on (source, request_id) so a re-emit can't double-post.
//
// Phase 6 of the reschedule + cancel chat work — added after PR #384
// landed, in response to "what happens when the shop approves?" feedback.

import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { MessageRepository } from "../../../repositories/MessageRepository";
import { OrderRepository } from "../../../repositories/OrderRepository";
import { ShopRepository } from "../../../repositories/ShopRepository";
import { CustomerRepository } from "../../../repositories/CustomerRepository";
import { WebSocketManager } from "../../../services/WebSocketManager";
import { DomainEvent } from "../../types";

interface ApprovedPayload {
  requestId: string;
  orderId: string;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  serviceName?: string;
  originalDate?: string;
  originalTimeSlot?: string;
  newDate: string;
  newTimeSlot: string;
}

interface RejectedPayload {
  requestId: string;
  orderId: string;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  serviceName?: string;
  reason?: string;
}

interface ExpiredPayload {
  requestId: string;
  orderId: string;
  shopId: string;
  customerAddress: string;
  customerName?: string;
  shopName?: string;
  serviceName?: string;
}

type Outcome = "approved" | "rejected" | "expired";

export interface RescheduleRequestOutcomeHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  orderRepo?: OrderRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
}

export class RescheduleRequestOutcomeHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly orderRepo: OrderRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private wsManager?: WebSocketManager;

  constructor(deps: RescheduleRequestOutcomeHandlerDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.orderRepo = deps.orderRepo ?? new OrderRepository();
    this.shopRepo = deps.shopRepo ?? new ShopRepository();
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  async handleRequestApproved(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as ApprovedPayload;
      if (!payload?.requestId || !payload?.orderId || !payload?.customerAddress) {
        logger.warn("RescheduleRequestOutcomeHandler: malformed approved payload", {
          eventType: event.type,
        });
        return;
      }
      const newSlot = this.formatSlot(payload.newDate, payload.newTimeSlot);
      const customerName = payload.customerName?.trim() || "there";
      const shopName = payload.shopName?.trim() || "the shop";
      const serviceName = payload.serviceName?.trim() || "your booking";

      const messageText = newSlot
        ? `Good news ${customerName} — ${shopName} approved your reschedule. Your ${serviceName} is now on ${newSlot}.`
        : `Good news ${customerName} — ${shopName} approved your reschedule.`;

      await this.postOutcomeMessage(payload.orderId, payload.requestId, "approved", messageText);
    } catch (err) {
      logger.error("RescheduleRequestOutcomeHandler.handleRequestApproved failed", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  async handleRequestRejected(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as RejectedPayload;
      if (!payload?.requestId || !payload?.orderId || !payload?.customerAddress) {
        logger.warn("RescheduleRequestOutcomeHandler: malformed rejected payload", {
          eventType: event.type,
        });
        return;
      }
      const order = await this.orderRepo.getOrderById(payload.orderId);
      // Order's booking_date/booking_time is STILL the original since the
      // reschedule wasn't applied. Use it for the "your booking stays at"
      // line — gives the customer the concrete fall-back time.
      const originalSlot = order
        ? this.formatSlot(this.normalizeDateField(order.bookingDate), order.bookingTime ?? null)
        : null;

      const customerName = payload.customerName?.trim() || "there";
      const shopName = payload.shopName?.trim() || "The shop";
      const serviceName = payload.serviceName?.trim() || "your booking";
      const reasonSuffix = payload.reason?.trim()
        ? ` Reason: ${payload.reason.trim()}.`
        : "";

      const messageText = originalSlot
        ? `${shopName} wasn't able to move ${serviceName} — your booking stays at ${originalSlot}.${reasonSuffix}`
        : `${shopName} wasn't able to move ${serviceName} — your original booking stands.${reasonSuffix}`;

      // Suppress unused-name warning for symmetry with approved/expired.
      void customerName;

      await this.postOutcomeMessage(payload.orderId, payload.requestId, "rejected", messageText);
    } catch (err) {
      logger.error("RescheduleRequestOutcomeHandler.handleRequestRejected failed", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  async handleRequestExpired(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as ExpiredPayload;
      if (!payload?.requestId || !payload?.orderId || !payload?.customerAddress) {
        logger.warn("RescheduleRequestOutcomeHandler: malformed expired payload", {
          eventType: event.type,
        });
        return;
      }
      const order = await this.orderRepo.getOrderById(payload.orderId);
      const originalSlot = order
        ? this.formatSlot(this.normalizeDateField(order.bookingDate), order.bookingTime ?? null)
        : null;

      const serviceName = payload.serviceName?.trim() || "your booking";

      const messageText = originalSlot
        ? `Your reschedule request for ${serviceName} timed out without a response from the shop. Your booking stays at ${originalSlot}.`
        : `Your reschedule request for ${serviceName} timed out without a response from the shop. Your original booking stands.`;

      await this.postOutcomeMessage(payload.orderId, payload.requestId, "expired", messageText);
    } catch (err) {
      logger.error("RescheduleRequestOutcomeHandler.handleRequestExpired failed", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  /**
   * Shared post-message path. Looks up the order, guards on
   * conversation_id, checks idempotency, persists, and WS broadcasts.
   * Outcome arg drives the `metadata.source` value so each outcome has
   * its own idempotency key.
   */
  private async postOutcomeMessage(
    orderId: string,
    requestId: string,
    outcome: Outcome,
    messageText: string
  ): Promise<void> {
    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      logger.warn("RescheduleRequestOutcomeHandler: order not found, skipping", {
        orderId,
        outcome,
      });
      return;
    }

    const conversationId = order.conversationId;
    if (!conversationId) {
      logger.debug(
        "RescheduleRequestOutcomeHandler: order has no conversation_id, skipping",
        { orderId, outcome }
      );
      return;
    }

    const convExists = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM conversations WHERE conversation_id = $1
       ) AS exists`,
      [conversationId]
    );
    if (convExists.rows[0]?.exists !== true) {
      logger.warn(
        "RescheduleRequestOutcomeHandler: conversation not found, skipping",
        { orderId, conversationId, outcome }
      );
      return;
    }

    const source = `reschedule_request_${outcome}`;
    const alreadySent = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM messages
         WHERE conversation_id = $1
           AND metadata->>'source' = $2
           AND metadata->>'request_id' = $3
       ) AS exists`,
      [conversationId, source, requestId]
    );
    if (alreadySent.rows[0]?.exists === true) {
      logger.debug(
        "RescheduleRequestOutcomeHandler: outcome message already sent, skipping",
        { orderId, requestId, conversationId, outcome }
      );
      return;
    }

    const aiMessageId = `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
    try {
      await this.messageRepo.createMessage({
        messageId: aiMessageId,
        conversationId,
        senderAddress: order.shopId,
        senderType: "shop",
        messageText,
        messageType: "text",
        metadata: {
          generated_by: "ai_agent",
          source,
          order_id: orderId,
          request_id: requestId,
        },
      });
    } catch (err) {
      logger.error(
        "RescheduleRequestOutcomeHandler: failed to persist outcome message",
        { orderId, requestId, conversationId, outcome, error: (err as Error)?.message }
      );
      return;
    }

    if (this.wsManager) {
      const targets: string[] = [order.customerAddress.toLowerCase()];
      try {
        const shop = await this.shopRepo.getShop(order.shopId);
        if (shop?.walletAddress) targets.push(shop.walletAddress.toLowerCase());
      } catch {
        // shop lookup non-fatal — WS broadcast scope just narrows.
      }
      try {
        this.wsManager.sendToAddresses(targets, {
          type: "message:new",
          payload: { conversationId },
        });
      } catch (wsErr) {
        logger.error("RescheduleRequestOutcomeHandler: WS broadcast failed", {
          messageId: aiMessageId,
          outcome,
          error: (wsErr as Error)?.message,
        });
      }
    }

    logger.info("RescheduleRequestOutcomeHandler: outcome message sent", {
      orderId,
      requestId,
      conversationId,
      outcome,
      messageId: aiMessageId,
    });
  }

  /**
   * Normalize a Date / string / null booking_date field into the
   * YYYY-MM-DD shape `formatSlot` expects. The OrderRepository's
   * mapOrderRow returns Date objects, but the underlying column is
   * `date` (no time) — toISOString gives us the right prefix.
   */
  private normalizeDateField(
    bookingDate: Date | string | null | undefined
  ): string | null {
    if (!bookingDate) return null;
    if (bookingDate instanceof Date) {
      return bookingDate.toISOString().slice(0, 10);
    }
    return String(bookingDate).slice(0, 10);
  }

  /**
   * Render "Friday, May 29 at 2:00 PM" from a YYYY-MM-DD date string and
   * HH:MM or HH:MM:SS time slot. Identical formatting to the other
   * confirmation handlers — keeps the chat thread visually consistent.
   * Returns null on missing or unparseable input.
   */
  private formatSlot(
    bookingDate: string | null | undefined,
    bookingTime: string | null | undefined
  ): string | null {
    if (!bookingDate || !bookingTime) return null;
    try {
      const [yStr, mStr, dStr] = bookingDate.slice(0, 10).split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      if (!y || !m || !d) return null;
      const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
      const [hh, mm = "00"] = bookingTime.split(":");
      const hour = parseInt(hh, 10);
      if (Number.isNaN(hour)) return null;
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const minutes = mm.padStart(2, "0").slice(0, 2);
      return `${dateLabel} at ${displayHour}:${minutes} ${ampm}`;
    } catch {
      return null;
    }
  }
}
