// backend/src/domains/AIAgentDomain/services/CancellationConfirmationHandler.ts
//
// When a customer cancels a booking that originated from an AI chat
// conversation, post a "your appointment has been cancelled" message back
// into that same conversation — so the chat has a closing beat and the
// customer sees the cancellation lined up with the chat that initiated it.
//
// Mirror of BookingConfirmationHandler. Subscribes to
// `service.order_cancelled` (published from
// AppointmentController.cancelCustomerAppointment AND from the shop-side
// cancel + bulk-cancel paths — see emit sites in ServiceDomain).
//
// Scope — only orders that came from an AI chat:
//   - The order must carry a `conversation_id`. Set only when the customer
//     tapped an AI booking card. Marketplace / direct cancellations leave it
//     NULL → we skip.
//   - This covers all cancellation paths (AI chat tap, dashboard tap, shop
//     dashboard) — the question we care about isn't "who cancelled?" but
//     "does this order have a chat thread that needs a closing beat?"
//
// The message is TEMPLATED (no Claude call). Phase 5.2 of the reschedule +
// cancel chat work.

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

interface OrderCancelledPayload {
  orderId: string;
  customerAddress: string;
  shopId: string;
  serviceId: string;
  cancelledBy?: string;
}

export interface CancellationConfirmationHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  orderRepo?: OrderRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
}

export class CancellationConfirmationHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly orderRepo: OrderRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private wsManager?: WebSocketManager;

  constructor(deps: CancellationConfirmationHandlerDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.orderRepo = deps.orderRepo ?? new OrderRepository();
    this.shopRepo = deps.shopRepo ?? new ShopRepository();
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Subscribed to `service.order_cancelled`. Errors caught here so a
   * confirmation hiccup never breaks the cancel flow itself.
   */
  async handleOrderCancelled(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as OrderCancelledPayload;
      if (!payload?.orderId || !payload?.customerAddress || !payload?.shopId) {
        logger.warn("CancellationConfirmationHandler: malformed event payload, skipping", {
          eventType: event.type,
        });
        return;
      }
      await this.processOrderCancelled(payload);
    } catch (err) {
      logger.error("CancellationConfirmationHandler: top-level failure", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  /** Visible for testing. The actual logic. */
  async processOrderCancelled(payload: OrderCancelledPayload): Promise<void> {
    const { orderId } = payload;

    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      logger.warn("CancellationConfirmationHandler: order not found, skipping", { orderId });
      return;
    }

    // Order didn't come from an AI chat — nothing to post into.
    const conversationId = order.conversationId;
    if (!conversationId) {
      logger.debug(
        "CancellationConfirmationHandler: order has no conversation_id, skipping",
        { orderId }
      );
      return;
    }

    // Conversation row must still exist for createMessage.
    const convExists = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM conversations WHERE conversation_id = $1
       ) AS exists`,
      [conversationId]
    );
    if (convExists.rows[0]?.exists !== true) {
      logger.warn("CancellationConfirmationHandler: conversation not found, skipping", {
        orderId,
        conversationId,
      });
      return;
    }

    // Idempotency — re-emit safety. Cancellation should be a single beat in
    // the chat thread; if a second event fires for the same order
    // (defensive against the bus replaying), the second one no-ops.
    const alreadySent = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM messages
         WHERE conversation_id = $1
           AND metadata->>'source' = 'cancellation_confirmed'
           AND metadata->>'order_id' = $2
       ) AS exists`,
      [conversationId, orderId]
    );
    if (alreadySent.rows[0]?.exists === true) {
      logger.debug(
        "CancellationConfirmationHandler: confirmation already sent, skipping",
        { orderId, conversationId }
      );
      return;
    }

    const [shop, customer] = await Promise.all([
      this.shopRepo.getShop(order.shopId),
      this.customerRepo.getCustomer(order.customerAddress),
    ]);

    const customerName = (customer?.name && customer.name.trim()) || "there";
    const shopName = shop?.name ?? "the shop";
    const slotLabel = this.formatSlot(order.bookingDate, order.bookingTime);

    // Branch wording on who initiated the cancellation. The customer
    // self-cancel path ("Got it...") reads like an acknowledgement of the
    // customer's own action. The shop-initiated path needs different
    // framing so the customer understands the shop changed plans on them.
    // Free-form `cancellation_notes` (if the shop typed any) is the most
    // useful "why" — the categorical `cancellation_reason` code is too
    // techie ("schedule_conflict") to put in a customer-facing message.
    const cancelledByShop = payload.cancelledBy === "shop";
    let messageText: string;
    if (cancelledByShop) {
      const notes = (order.cancellationNotes ?? "").trim();
      const reasonSuffix = notes ? ` Reason: ${notes}.` : "";
      messageText = slotLabel
        ? `${shopName} had to cancel your appointment on ${slotLabel}.${reasonSuffix}`
        : `${shopName} had to cancel your appointment.${reasonSuffix}`;
    } else {
      messageText = slotLabel
        ? `Got it ${customerName} — your appointment at ${shopName} on ${slotLabel} has been cancelled.`
        : `Got it ${customerName} — your appointment at ${shopName} has been cancelled.`;
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
          source: "cancellation_confirmed",
          order_id: orderId,
          // Stash who cancelled so the shop-side audit dashboard can show
          // "customer cancelled this in chat" vs "you cancelled via
          // dashboard." Defaults to 'customer' when the event omits it.
          cancelled_by: payload.cancelledBy ?? "customer",
        },
      });
    } catch (err) {
      logger.error(
        "CancellationConfirmationHandler: failed to persist confirmation message",
        {
          orderId,
          conversationId,
          error: (err as Error)?.message,
        }
      );
      return;
    }

    if (this.wsManager) {
      const targets: string[] = [order.customerAddress.toLowerCase()];
      if (shop?.walletAddress) {
        targets.push(shop.walletAddress.toLowerCase());
      }
      try {
        this.wsManager.sendToAddresses(targets, {
          type: "message:new",
          payload: { conversationId },
        });
      } catch (wsErr) {
        logger.error("CancellationConfirmationHandler: WS broadcast failed", {
          messageId: aiMessageId,
          error: (wsErr as Error)?.message,
        });
      }
    }

    logger.info("CancellationConfirmationHandler: confirmation sent", {
      orderId,
      conversationId,
      messageId: aiMessageId,
    });
  }

  /** Format the booking slot. Identical to BookingConfirmationHandler.formatSlot. */
  private formatSlot(
    bookingDate: Date | string | undefined | null,
    bookingTime: string | undefined | null
  ): string | null {
    if (!bookingDate || !bookingTime) return null;
    try {
      const dateStr =
        typeof bookingDate === "string"
          ? bookingDate.slice(0, 10)
          : bookingDate.toISOString().slice(0, 10);
      const [yStr, mStr, dStr] = dateStr.split("-");
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
