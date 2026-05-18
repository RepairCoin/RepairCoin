// backend/src/domains/AIAgentDomain/services/BookingConfirmationHandler.ts
//
// When a customer completes payment for a booking that started from an AI
// booking card in chat, post a "your appointment is confirmed" message back
// into that same conversation — so the chat has a closing beat and the
// customer (redirected back into the thread) sees the confirmation.
//
// Subscribes to `service.order_paid` (published by PaymentService once an
// order row is created on payment success).
//
// Scope — strictly the AI-chat booking flow:
//   - The order must carry a `conversation_id`. That is set ONLY when the
//     customer tapped an AI booking card (threaded card → Stripe metadata →
//     order row). Marketplace / direct bookings leave it NULL → we skip.
//   - This is intentionally NOT a "find any conversation for this
//     customer+shop" lookup. A customer who once chatted with a shop and
//     later books a different service from the marketplace must NOT get a
//     message dropped into that old thread.
//
// The message is TEMPLATED, not Claude-generated:
//   - A booking confirmation is a transactional receipt — accuracy of the
//     date/time and immediacy matter more than personality.
//   - Zero token cost, zero latency: the customer is mid-redirect back into
//     the chat, so the message must already be there when they land.
//   - Still stamped metadata.generated_by = 'ai_agent' so the chat UI
//     renders it as an AI message — to the customer it reads as the AI
//     confirming the booking.
//
// On any failure: swallow + log. The booking/payment flow must never be
// affected by a confirmation-message hiccup.

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

interface OrderPaidPayload {
  orderId: string;
  customerAddress: string;
  shopId: string;
  serviceId: string;
  conversationId?: string | null;
  bookingDate?: Date | string | null;
  bookingTime?: string | null;
  totalAmount?: number;
}

export interface BookingConfirmationHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  orderRepo?: OrderRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
}

export class BookingConfirmationHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly orderRepo: OrderRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private wsManager?: WebSocketManager;

  constructor(deps: BookingConfirmationHandlerDeps = {}) {
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
   * Subscribed to `service.order_paid`. Errors are caught here so a
   * confirmation hiccup never breaks the booking-completion flow.
   */
  async handleOrderPaid(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as OrderPaidPayload;
      if (!payload?.orderId || !payload?.customerAddress || !payload?.shopId) {
        logger.warn("BookingConfirmationHandler: malformed event payload, skipping", {
          eventType: event.type,
        });
        return;
      }
      await this.processOrderPaid(payload);
    } catch (err) {
      logger.error("BookingConfirmationHandler: top-level failure", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  /** Visible for testing. The actual logic. */
  async processOrderPaid(payload: OrderPaidPayload): Promise<void> {
    const { orderId } = payload;

    // 1. Load the order — the authoritative source for conversation_id and
    // the booking slot. Skip if it has somehow gone missing.
    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      logger.warn("BookingConfirmationHandler: order not found, skipping", { orderId });
      return;
    }

    // 2. No conversation link → the booking did not come from an AI chat
    // card (marketplace / direct booking). Nothing to do.
    const conversationId = order.conversationId;
    if (!conversationId) {
      logger.debug("BookingConfirmationHandler: order has no conversation_id, skipping", {
        orderId,
      });
      return;
    }

    // 3. Confirm the conversation row still exists. createMessage would fail
    // on a dangling id; check first so we skip cleanly instead of throwing.
    const convExists = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM conversations WHERE conversation_id = $1
       ) AS exists`,
      [conversationId]
    );
    if (convExists.rows[0]?.exists !== true) {
      logger.warn("BookingConfirmationHandler: conversation not found, skipping", {
        orderId,
        conversationId,
      });
      return;
    }

    // 4. Idempotency — `service.order_paid` can fire more than once for the
    // same order (the confirm endpoint AND the Stripe webhook both call
    // handlePaymentSuccess; under a race both may emit). If a confirmation
    // for this order is already in the thread, do nothing.
    const alreadySent = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM messages
         WHERE conversation_id = $1
           AND metadata->>'source' = 'booking_confirmed'
           AND metadata->>'order_id' = $2
       ) AS exists`,
      [conversationId, orderId]
    );
    if (alreadySent.rows[0]?.exists === true) {
      logger.debug("BookingConfirmationHandler: confirmation already sent, skipping", {
        orderId,
        conversationId,
      });
      return;
    }

    // 5. Pull shop + customer for the message text.
    const [shop, customer] = await Promise.all([
      this.shopRepo.getShop(order.shopId),
      this.customerRepo.getCustomer(order.customerAddress),
    ]);

    // Use the customer's stored display name verbatim. No first-name
    // splitting — many real names have multi-word first names. Matches the
    // orchestrator + OrderConfirmationHandler convention.
    const customerName = (customer?.name && customer.name.trim()) || "there";
    const shopName = shop?.name ?? "the shop";
    const slotLabel = this.formatSlot(order.bookingDate, order.bookingTime);

    const messageText = slotLabel
      ? `You're all set, ${customerName}! Your appointment at ${shopName} is confirmed for ${slotLabel}. See you then 🎉`
      : `You're all set, ${customerName}! Your booking at ${shopName} is confirmed. We'll see you soon 🎉`;

    // 6. Persist as a shop-sender message stamped generated_by=ai_agent so
    // the chat UI renders it as the AI. source=booking_confirmed + order_id
    // is the idempotency key checked above.
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
          source: "booking_confirmed",
          order_id: orderId,
        },
      });
    } catch (err) {
      logger.error("BookingConfirmationHandler: failed to persist confirmation message", {
        orderId,
        conversationId,
        error: (err as Error)?.message,
      });
      return;
    }

    // 7. WS broadcast to BOTH customer and shop so the confirmation lands in
    // real-time on both sides (the 30s message poll is the fallback).
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
        logger.error("BookingConfirmationHandler: WS broadcast failed", {
          messageId: aiMessageId,
          error: (wsErr as Error)?.message,
        });
      }
    }

    logger.info("BookingConfirmationHandler: confirmation sent", {
      orderId,
      conversationId,
      messageId: aiMessageId,
    });
  }

  /**
   * Format the booking slot as "Thursday, May 22 at 2:30 PM".
   *
   * `bookingTime` is assumed already in the shop's local timezone (per
   * AppointmentService convention — the slot picker shows HH:MM in shop tz),
   * so no timezone arithmetic is needed; we just format the strings. The
   * date is parsed as a UTC anchor so the weekday/month label is unambiguous
   * regardless of the process timezone.
   *
   * Returns null if date or time is missing — the caller then sends a
   * generic confirmation without naming the slot.
   */
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
      // UTC anchor so the labels are unambiguous regardless of process tz.
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
