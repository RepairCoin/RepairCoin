// backend/src/domains/AIAgentDomain/services/RescheduleRequestConfirmationHandler.ts
//
// When a customer submits a reschedule request that originated from an AI
// chat reschedule card, post a "request submitted" message into the same
// conversation — closing beat for the customer + a record in the chat
// thread the shop staff sees.
//
// Subscribes to `reschedule:request_created` (published by
// RescheduleService.createRescheduleRequest). The event payload carries
// the orderId; we look up the order to read its `conversation_id`. Only
// orders that originated from an AI chat have one set; marketplace /
// dashboard reschedules leave it NULL and we skip.
//
// Note this fires on REQUEST CREATION, not on shop approval. A second
// event (`service.order_rescheduled` or similar) would fire on approval
// — that's deferred to Phase 8 per the impl plan.
//
// Templated message, no Claude call. Phase 5.3 of the reschedule + cancel
// chat work.

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

interface RescheduleRequestCreatedPayload {
  requestId: string;
  orderId: string;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  serviceName?: string;
  originalDate?: string;
  originalTimeSlot?: string;
  requestedDate: string;
  requestedTimeSlot: string;
  reason?: string;
}

export interface RescheduleRequestConfirmationHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  orderRepo?: OrderRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
}

export class RescheduleRequestConfirmationHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly orderRepo: OrderRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private wsManager?: WebSocketManager;

  constructor(deps: RescheduleRequestConfirmationHandlerDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.orderRepo = deps.orderRepo ?? new OrderRepository();
    this.shopRepo = deps.shopRepo ?? new ShopRepository();
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  async handleRescheduleRequestCreated(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as RescheduleRequestCreatedPayload;
      if (
        !payload?.requestId ||
        !payload?.orderId ||
        !payload?.customerAddress
      ) {
        logger.warn(
          "RescheduleRequestConfirmationHandler: malformed event payload, skipping",
          { eventType: event.type }
        );
        return;
      }
      await this.processRequestCreated(payload);
    } catch (err) {
      logger.error("RescheduleRequestConfirmationHandler: top-level failure", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  async processRequestCreated(
    payload: RescheduleRequestCreatedPayload
  ): Promise<void> {
    const { orderId, requestId } = payload;

    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      logger.warn(
        "RescheduleRequestConfirmationHandler: order not found, skipping",
        { orderId }
      );
      return;
    }

    const conversationId = order.conversationId;
    if (!conversationId) {
      logger.debug(
        "RescheduleRequestConfirmationHandler: order has no conversation_id, skipping",
        { orderId }
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
        "RescheduleRequestConfirmationHandler: conversation not found, skipping",
        { orderId, conversationId }
      );
      return;
    }

    // Idempotency on requestId — re-emit safety. Two events for the same
    // request shouldn't double-message.
    const alreadySent = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM messages
         WHERE conversation_id = $1
           AND metadata->>'source' = 'reschedule_request_submitted'
           AND metadata->>'request_id' = $2
       ) AS exists`,
      [conversationId, requestId]
    );
    if (alreadySent.rows[0]?.exists === true) {
      logger.debug(
        "RescheduleRequestConfirmationHandler: confirmation already sent, skipping",
        { orderId, requestId, conversationId }
      );
      return;
    }

    // Customer name + shop name preferred from payload (RescheduleService
    // enriches the event), fall back to repo lookups if absent.
    let customerName = payload.customerName?.trim() || "";
    let shopName = payload.shopName?.trim() || "";
    if (!customerName || !shopName) {
      const [shop, customer] = await Promise.all([
        shopName ? Promise.resolve(null) : this.shopRepo.getShop(order.shopId),
        customerName
          ? Promise.resolve(null)
          : this.customerRepo.getCustomer(order.customerAddress),
      ]);
      if (!customerName)
        customerName = (customer?.name && customer.name.trim()) || "there";
      if (!shopName) shopName = shop?.name ?? "the shop";
    }
    const serviceName = payload.serviceName?.trim() || "your booking";

    const newSlot = this.formatRequestedSlot(
      payload.requestedDate,
      payload.requestedTimeSlot
    );

    const messageText = newSlot
      ? `Your reschedule request for ${serviceName} is in — ${shopName} will review the move to ${newSlot} shortly.`
      : `Your reschedule request for ${serviceName} is in — ${shopName} will review it shortly.`;

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
          source: "reschedule_request_submitted",
          order_id: orderId,
          request_id: requestId,
        },
      });
    } catch (err) {
      logger.error(
        "RescheduleRequestConfirmationHandler: failed to persist confirmation message",
        {
          orderId,
          requestId,
          conversationId,
          error: (err as Error)?.message,
        }
      );
      return;
    }

    if (this.wsManager) {
      const targets: string[] = [order.customerAddress.toLowerCase()];
      try {
        const shop = await this.shopRepo.getShop(order.shopId);
        if (shop?.walletAddress) {
          targets.push(shop.walletAddress.toLowerCase());
        }
      } catch {
        // shop lookup is just for WS broadcast; non-fatal
      }
      try {
        this.wsManager.sendToAddresses(targets, {
          type: "message:new",
          payload: { conversationId },
        });
      } catch (wsErr) {
        logger.error(
          "RescheduleRequestConfirmationHandler: WS broadcast failed",
          {
            messageId: aiMessageId,
            error: (wsErr as Error)?.message,
          }
        );
      }
    }

    logger.info("RescheduleRequestConfirmationHandler: confirmation sent", {
      orderId,
      requestId,
      conversationId,
      messageId: aiMessageId,
    });
  }

  /**
   * Render "Friday, May 30 at 1:00 PM" from the requested date + time slot.
   * The slot is already in shop-local time (RescheduleService stores it as
   * HH:MM in the shop's tz). Returns null if either field is missing.
   */
  private formatRequestedSlot(
    requestedDate: string | undefined | null,
    requestedTimeSlot: string | undefined | null
  ): string | null {
    if (!requestedDate || !requestedTimeSlot) return null;
    try {
      const [yStr, mStr, dStr] = requestedDate.slice(0, 10).split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      if (!y || !m || !d) return null;
      const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }
      );
      const [hh, mm = "00"] = requestedTimeSlot.split(":");
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
