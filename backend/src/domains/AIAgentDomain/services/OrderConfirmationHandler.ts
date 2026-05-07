// backend/src/domains/AIAgentDomain/services/OrderConfirmationHandler.ts
//
// Phase 3 Task 11 — when an order is marked completed, if the customer
// originally chatted with the AI for that service, send a short
// confirmation message in the same chat thread.
//
// Subscribes to `service.order_completed` (published by ServiceDomain's
// OrderController when a shop transitions an order from 'paid' → 'completed').
//
// Behavior:
//   1. Look up the conversation for this (customer, shop) pair
//   2. If no conversation OR no prior AI messages → skip silently. The
//      customer never engaged with the AI; randomly inserting a "thanks
//      for booking" feels weird if they only ever talked to a human.
//   3. Check shop AI kill-switch + spend cap — same guards as the main
//      reply hook. If AI is off, a human will already be sending the
//      thank-you (no double-message).
//   4. Build a tight Haiku prompt focused on ONE friendly confirmation
//      sentence. No service summary, no upsell, no questions. Just goodbye.
//   5. Persist the AI reply via messageRepo (matches AgentOrchestrator
//      pattern), audit-log, broadcast WS so customer sees it in real-time.
//
// On any failure: swallow + log. Booking flow must never be affected by
// AI confirmation hiccups.

import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { MessageRepository } from "../../../repositories/MessageRepository";
import { OrderRepository } from "../../../repositories/OrderRepository";
import { ShopRepository } from "../../../repositories/ShopRepository";
import { CustomerRepository } from "../../../repositories/CustomerRepository";
import { AnthropicClient } from "./AnthropicClient";
import { AuditLogger } from "./AuditLogger";
import { SpendCapEnforcer } from "./SpendCapEnforcer";
import { WebSocketManager } from "../../../services/WebSocketManager";
import { ClaudeModel } from "../types";
import { DomainEvent } from "../../types";

const CONFIRMATION_MODEL: ClaudeModel = "claude-haiku-4-5-20251001";
const CONFIRMATION_MAX_TOKENS = 80;

interface OrderCompletedPayload {
  orderId: string;
  customerAddress: string;
  shopId: string;
  serviceId: string;
  totalAmount: number;
  completedAt: Date | string;
}

export interface OrderConfirmationHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  orderRepo?: OrderRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
  anthropicClient?: AnthropicClient;
  auditLogger?: AuditLogger;
  spendCapEnforcer?: SpendCapEnforcer;
}

export class OrderConfirmationHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly orderRepo: OrderRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly anthropicClient: AnthropicClient;
  private readonly auditLogger: AuditLogger;
  private readonly spendCapEnforcer: SpendCapEnforcer;
  private wsManager?: WebSocketManager;

  constructor(deps: OrderConfirmationHandlerDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.orderRepo = deps.orderRepo ?? new OrderRepository();
    this.shopRepo = deps.shopRepo ?? new ShopRepository();
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
    this.anthropicClient = deps.anthropicClient ?? new AnthropicClient();
    this.auditLogger = deps.auditLogger ?? new AuditLogger();
    this.spendCapEnforcer = deps.spendCapEnforcer ?? new SpendCapEnforcer();
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Subscribed to `service.order_completed` event. Errors are caught here so
   * a confirmation hiccup never breaks the booking-completion flow.
   */
  async handleOrderCompleted(event: DomainEvent): Promise<void> {
    try {
      const payload = event.data as OrderCompletedPayload;
      if (!payload?.orderId || !payload?.customerAddress || !payload?.shopId) {
        logger.warn("OrderConfirmationHandler: malformed event payload, skipping", {
          eventType: event.type,
        });
        return;
      }
      await this.processCompletion(payload);
    } catch (err) {
      logger.error("OrderConfirmationHandler: top-level failure", {
        eventType: event?.type,
        error: (err as Error)?.message,
      });
    }
  }

  /** Visible for testing. The actual logic. */
  async processCompletion(payload: OrderCompletedPayload): Promise<void> {
    const { orderId, customerAddress, shopId, serviceId } = payload;

    // 1. Find the existing conversation. We do NOT auto-create — if the
    // customer never chatted with anyone, we don't suddenly start one with
    // a "thanks for booking" message out of nowhere. That would be jarring.
    const conversation = await this.findExistingConversation(customerAddress, shopId);
    if (!conversation) {
      logger.debug("OrderConfirmationHandler: no conversation, skipping", {
        orderId,
        customerAddress,
        shopId,
      });
      return;
    }

    // 2. Did the AI ever reply in this thread? If not, the customer talked
    // exclusively to the human shop and a sudden AI reply would be off-brand.
    const hasPriorAi = await this.conversationHasPriorAiMessage(conversation.conversationId);
    if (!hasPriorAi) {
      logger.debug("OrderConfirmationHandler: conversation has no prior AI messages, skipping", {
        orderId,
        conversationId: conversation.conversationId,
      });
      return;
    }

    // 3. Shop AI kill-switch — if AI is globally off for this shop, the human
    // owner is sending their own thank-you. Don't double up.
    const shopSettings = await this.pool.query<{ ai_global_enabled: boolean }>(
      `SELECT ai_global_enabled FROM ai_shop_settings WHERE shop_id = $1`,
      [shopId]
    );
    if (shopSettings.rows.length === 0 || shopSettings.rows[0].ai_global_enabled !== true) {
      logger.debug("OrderConfirmationHandler: AI globally off for shop, skipping", { shopId });
      return;
    }

    // 4. Spend cap — even cheap Haiku calls add up. Skip if shop's over budget.
    const spendCheck = await this.spendCapEnforcer.canSpend(shopId);
    if (!spendCheck.allowed) {
      logger.info("OrderConfirmationHandler: spend cap exceeded, skipping", { shopId });
      return;
    }

    // 5. Pull order + shop + customer for prompt context.
    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      logger.warn("OrderConfirmationHandler: order not found, skipping", { orderId });
      return;
    }

    const [shop, customer, tzRow] = await Promise.all([
      this.shopRepo.getShop(shopId),
      this.customerRepo.getCustomer(customerAddress),
      // Shop's IANA timezone is on shop_time_slot_config, not on the shop row.
      // Default to America/New_York to match AppointmentService's fallback.
      this.pool.query<{ timezone: string | null }>(
        `SELECT timezone FROM shop_time_slot_config WHERE shop_id = $1`,
        [shopId]
      ),
    ]);

    // Use the customer's stored display name verbatim ("Lee Ann" stays
    // "Lee Ann"). No first-name splitting — many real names have multi-word
    // first names. The orchestrator uses the same convention.
    const customerFirstName = (customer?.name && customer.name.trim()) || "there";
    const shopName = shop?.name ?? "the shop";
    const timezone = tzRow.rows[0]?.timezone ?? "America/New_York";
    const slotLabel = this.formatSlot(
      order.bookingDate,
      order.bookingTime ?? (order as any).booking_time_slot,
      timezone
    );

    const systemPrompt = this.buildConfirmationPrompt({
      shopName,
      customerFirstName,
      slotLabel,
    });

    // 6. Call Claude — Haiku, tight token budget.
    let claudeResponse;
    try {
      claudeResponse = await this.anthropicClient.complete({
        systemPrompt: [{ text: systemPrompt, cache: false }],
        messages: [
          { role: "user", content: "(send the booking confirmation message now)" },
        ],
        model: CONFIRMATION_MODEL,
        maxTokens: CONFIRMATION_MAX_TOKENS,
      });
    } catch (err) {
      await this.auditLogger.log({
        conversationId: conversation.conversationId,
        serviceId,
        shopId,
        customerAddress,
        requestPayload: { reason: "confirmation_send", orderId },
        responsePayload: null,
        model: CONFIRMATION_MODEL,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        latencyMs: null,
        errorMessage: (err as Error)?.message ?? String(err),
      });
      logger.error("OrderConfirmationHandler: Claude call failed", err);
      return;
    }

    // 7. Persist as a shop-sender message marked generated_by=ai_agent.
    const aiMessageId = `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
    try {
      await this.messageRepo.createMessage({
        messageId: aiMessageId,
        conversationId: conversation.conversationId,
        senderAddress: shopId,
        senderType: "shop",
        messageText: claudeResponse.text.trim(),
        messageType: "text",
        metadata: {
          generated_by: "ai_agent",
          model: claudeResponse.model,
          source: "order_completed",
          order_id: orderId,
          cost_usd: claudeResponse.costUsd,
          latency_ms: claudeResponse.latencyMs,
        },
      });
    } catch (err) {
      logger.error("OrderConfirmationHandler: failed to persist AI message", err);
      return;
    }

    // 8. Audit log.
    await this.auditLogger.log({
      conversationId: conversation.conversationId,
      serviceId,
      shopId,
      customerAddress,
      requestPayload: { source: "order_completed", orderId, slotLabel },
      responsePayload: {
        text: claudeResponse.text,
        stopReason: claudeResponse.stopReason,
        aiMessageId,
      },
      model: claudeResponse.model,
      inputTokens: claudeResponse.usage.inputTokens,
      outputTokens: claudeResponse.usage.outputTokens,
      cachedInputTokens: claudeResponse.usage.cacheReadInputTokens,
      costUsd: claudeResponse.costUsd,
      latencyMs: claudeResponse.latencyMs,
    });

    // 9. Spend cap recording.
    await this.spendCapEnforcer.recordSpend(shopId, claudeResponse.costUsd);

    // 10. WS broadcast to the customer so the message lands in real-time.
    if (this.wsManager) {
      try {
        this.wsManager.sendToAddresses([customerAddress.toLowerCase()], {
          type: "message:new",
          payload: { conversationId: conversation.conversationId },
        });
      } catch (wsErr) {
        logger.error("OrderConfirmationHandler: WS broadcast failed", {
          messageId: aiMessageId,
          error: (wsErr as Error)?.message,
        });
      }
    }

    logger.info("OrderConfirmationHandler: confirmation sent", {
      orderId,
      conversationId: conversation.conversationId,
      messageId: aiMessageId,
      costUsd: claudeResponse.costUsd,
    });
  }

  /**
   * Build the system prompt for the confirmation reply. Intentionally tight:
   * one friendly sentence, customer's first name, slot mention if available.
   * No service summary, no upsells, no follow-up question.
   */
  private buildConfirmationPrompt(args: {
    shopName: string;
    customerFirstName: string;
    slotLabel: string | null;
  }): string {
    const { shopName, customerFirstName, slotLabel } = args;
    const slotLine = slotLabel
      ? `Their appointment was ${slotLabel}.`
      : "Their appointment is now complete.";

    return `You are a friendly assistant for ${shopName}. The customer (${customerFirstName}) just had their booking marked complete by the shop. ${slotLine}

Your job: send ONE short, warm confirmation message — like saying goodbye after a friendly visit. Examples of what we want:
  ✅ "Thanks ${customerFirstName} — see you next time!"
  ✅ "All done! Hope to see you again soon, ${customerFirstName}."
  ✅ "Thanks for stopping by, ${customerFirstName}!"

HARD RULES:
- ONE sentence. No follow-up question.
- Use the customer's first name once.
- DO NOT restate the price, duration, or service name. They already know.
- DO NOT ask them to book again or upsell anything.
- DO NOT include any code block, JSON, or formatting markers.
- Reply with the message text only — no greetings like "Here is your confirmation:" or signoffs.
- Keep it under 20 words.`.trim();
  }

  /**
   * Look up the existing customer↔shop conversation. Direct pool query —
   * MessageRepository doesn't have a "find without create" version of
   * getOrCreateConversation, and we don't want the side-effect of creating
   * one when none exists.
   */
  private async findExistingConversation(
    customerAddress: string,
    shopId: string
  ): Promise<{ conversationId: string } | null> {
    const result = await this.pool.query<{ conversation_id: string }>(
      `SELECT conversation_id FROM conversations
       WHERE customer_address = $1 AND shop_id = $2 LIMIT 1`,
      [customerAddress.toLowerCase(), shopId]
    );
    if (result.rows.length === 0) return null;
    return { conversationId: result.rows[0].conversation_id };
  }

  /**
   * Returns true if any past message in the conversation has
   * `metadata.generated_by = 'ai_agent'`. Indexed lookup is cheap.
   */
  private async conversationHasPriorAiMessage(conversationId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM messages
         WHERE conversation_id = $1
           AND metadata->>'generated_by' = 'ai_agent'
       ) AS exists`,
      [conversationId]
    );
    return result.rows[0]?.exists === true;
  }

  /**
   * Format the booking slot for the prompt as "Thursday at 2:30 PM".
   *
   * Assumes `bookingTime` is already in the shop's local timezone (per
   * AppointmentService convention — slot picker shows HH:MM in shop tz),
   * so we don't need to do timezone arithmetic on the time itself; we just
   * format the string. The date is converted to a day-of-week label using
   * UTC parsing (the day boundary is unambiguous for a YYYY-MM-DD string).
   *
   * Returns null if booking date or time is missing — the handler still
   * sends a generic "thanks" without naming the slot.
   */
  private formatSlot(
    bookingDate: Date | string | undefined | null,
    bookingTime: string | undefined | null,
    _timezone: string | null | undefined
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
      // UTC anchor so day-of-week is unambiguous regardless of process tz.
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      });
      const [hh, mm = "00"] = bookingTime.split(":");
      const hour = parseInt(hh, 10);
      if (Number.isNaN(hour)) return null;
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const minutes = mm.padStart(2, "0").slice(0, 2);
      return `${dayOfWeek} at ${displayHour}:${minutes} ${ampm}`;
    } catch {
      return null;
    }
  }

}
