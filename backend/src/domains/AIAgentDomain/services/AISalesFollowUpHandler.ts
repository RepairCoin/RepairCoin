// backend/src/domains/AIAgentDomain/services/AISalesFollowUpHandler.ts
//
// AI sales follow-up nudge. When a customer goes quiet mid-conversation
// (the AI proposed a slot / answered a question and the customer didn't
// reply), this posts ONE short, friendly follow-up to re-engage and keep
// the sale alive. See docs/tasks/strategy/ai-sales-agent/ai-sales-followup-nudge.md.
//
// Triggered by AISalesFollowUpDetector (a 5-minute polling scan), NOT by a
// customer message. The detector does a cheap broad scan and hands each
// candidate conversationId here; THIS class is the authoritative gate —
// every guard is re-checked so a stale candidate is rejected cleanly.
//
// Guards (all must pass — mirrors AgentOrchestrator + the strategy doc):
//   - conversation is open, has a service, not under human takeover
//     (ai_paused_until)
//   - shop AI globally enabled AND ai_followup_enabled (staged-rollout gate)
//   - focused service has aiSalesEnabled
//   - the last message is an AI message (not a human shop reply, not a
//     prior follow-up, not a booking confirmation)
//   - the customer actually engaged (≥1 customer message) and has been
//     quiet for ≥ the shop's delay but ≤ 6h (older = cold, not our job)
//   - episode idempotency: no follow-up already sent since the last
//     customer message; ≤ 2 follow-ups in the last 24h
//   - no order already placed for this conversation
//   - shop spend cap not exceeded
//   - inside the shop's daytime window (no 3 AM nudges)
//
// On any failure: swallow + log. A follow-up hiccup must never affect
// anything else.

import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { shopHasFeature } from "../../../utils/shopTier";
import { MessageRepository, Message } from "../../../repositories/MessageRepository";
import { ShopRepository } from "../../../repositories/ShopRepository";
import { CustomerRepository } from "../../../repositories/CustomerRepository";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { AnthropicClient } from "./AnthropicClient";
import { AuditLogger } from "./AuditLogger";
import { SpendCapEnforcer } from "./SpendCapEnforcer";
import { WebSocketManager } from "../../../services/WebSocketManager";
import { ClaudeModel } from "../types";
import { cheapModel } from "../../../config/aiModels";

const FOLLOWUP_MODEL: ClaudeModel = cheapModel();
const FOLLOWUP_MAX_TOKENS = 120;
const DEFAULT_DELAY_MINUTES = 20;
/** Beyond this the lead is cold — a different "win-back" mechanism's job. */
const MAX_QUIET_HOURS = 6;
/** Shop-local daytime window for sending nudges (no overnight nudges). */
const DAYTIME_START_HOUR = 8;
const DAYTIME_END_HOUR = 21;
/** Hard ceiling so a long back-and-forth thread can't turn into nagging. */
const MAX_FOLLOWUPS_PER_24H = 2;
/** Conversation-tail size pulled into the prompt. */
const TAIL_MESSAGES = 12;

interface ConversationRow {
  conversation_id: string;
  customer_address: string;
  shop_id: string;
  service_id: string | null;
  status: string;
  ai_paused_until: Date | null;
}

export interface AISalesFollowUpHandlerDeps {
  pool?: Pool;
  messageRepo?: MessageRepository;
  shopRepo?: ShopRepository;
  customerRepo?: CustomerRepository;
  serviceRepo?: ServiceRepository;
  anthropicClient?: AnthropicClient;
  auditLogger?: AuditLogger;
  spendCapEnforcer?: SpendCapEnforcer;
}

export class AISalesFollowUpHandler {
  private readonly pool: Pool;
  private readonly messageRepo: MessageRepository;
  private readonly shopRepo: ShopRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly serviceRepo: ServiceRepository;
  private readonly anthropicClient: AnthropicClient;
  private readonly auditLogger: AuditLogger;
  private readonly spendCapEnforcer: SpendCapEnforcer;
  private wsManager?: WebSocketManager;

  constructor(deps: AISalesFollowUpHandlerDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.shopRepo = deps.shopRepo ?? new ShopRepository();
    this.customerRepo = deps.customerRepo ?? new CustomerRepository();
    this.serviceRepo = deps.serviceRepo ?? new ServiceRepository();
    this.anthropicClient = deps.anthropicClient ?? new AnthropicClient();
    this.auditLogger = deps.auditLogger ?? new AuditLogger();
    this.spendCapEnforcer = deps.spendCapEnforcer ?? new SpendCapEnforcer();
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Evaluate one conversation and send a follow-up if every guard passes.
   * Errors are swallowed here so a single bad conversation never breaks the
   * detector's sweep over the others.
   */
  async processFollowUp(conversationId: string): Promise<void> {
    try {
      await this.tryFollowUp(conversationId);
    } catch (err) {
      logger.error("AISalesFollowUpHandler: top-level failure", {
        conversationId,
        error: (err as Error)?.message,
      });
    }
  }

  /** Visible for testing. The authoritative logic + all guards. */
  async tryFollowUp(conversationId: string): Promise<void> {
    // 1. Conversation must exist, be open, have a service, not be under
    // human takeover.
    const convRes = await this.pool.query<ConversationRow>(
      `SELECT conversation_id, customer_address, shop_id, service_id, status, ai_paused_until
       FROM conversations WHERE conversation_id = $1`,
      [conversationId]
    );
    const conv = convRes.rows[0];
    if (!conv) return;
    if (conv.status !== "open") return;
    if (!conv.service_id) return;
    if (conv.ai_paused_until && new Date(conv.ai_paused_until).getTime() > Date.now()) {
      return; // human takeover (or active race-window pause)
    }

    // 2. Shop settings — AI on, follow-ups on (staged-rollout gate), delay.
    const settingsRes = await this.pool.query<{
      ai_global_enabled: boolean;
      ai_followup_enabled: boolean;
      ai_followup_delay_minutes: number | null;
    }>(
      `SELECT ai_global_enabled, ai_followup_enabled, ai_followup_delay_minutes
       FROM ai_shop_settings WHERE shop_id = $1`,
      [conv.shop_id]
    );
    const settings = settingsRes.rows[0];
    if (!settings) return;
    if (settings.ai_global_enabled !== true) return;
    if (settings.ai_followup_enabled !== true) return; // staged rollout
    // WS2 tier entitlement — AI Lead Follow-Up is Growth+; a stale flag can't bypass it.
    if (!(await shopHasFeature(conv.shop_id, "aiLeadFollowUp"))) return;
    const delayMinutes = settings.ai_followup_delay_minutes ?? DEFAULT_DELAY_MINUTES;

    // 3. Focused service must belong to the shop and have AI selling on.
    const service = await this.serviceRepo.getServiceById(conv.service_id);
    if (!service || service.shopId !== conv.shop_id || service.aiSalesEnabled !== true) {
      return;
    }

    // 4. Pull the conversation tail and evaluate the "quiet sales episode".
    const messages = await this.messageRepo.getRecentConversationMessages(
      conversationId,
      TAIL_MESSAGES
    );
    if (messages.length === 0) return;

    const last = messages[messages.length - 1];
    // Last message must be an AI message — not a human shop reply (human is
    // handling it), not a prior follow-up or a booking confirmation.
    if (last.senderType !== "shop" || (last.metadata as any)?.generated_by !== "ai_agent") {
      return;
    }
    const lastSource = (last.metadata as any)?.source;
    if (lastSource === "ai_followup" || lastSource === "booking_confirmed") return;

    // The customer must have actually engaged.
    const customerMessages = messages.filter((m) => m.senderType === "customer");
    if (customerMessages.length === 0) return;

    // Quiet long enough, but not so long the lead is cold.
    const lastMs = new Date(last.createdAt).getTime();
    const minutesQuiet = (Date.now() - lastMs) / 60_000;
    if (minutesQuiet < delayMinutes) return;
    if (minutesQuiet > MAX_QUIET_HOURS * 60) return;

    // 5. Episode idempotency + 24h cap + order check (one round trip).
    const lastCustomerMs = Math.max(
      ...customerMessages.map((m) => new Date(m.createdAt).getTime())
    );
    const guardRes = await this.pool.query<{
      since_last_customer: string;
      last_24h: string;
      has_order: boolean;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM messages
            WHERE conversation_id = $1
              AND metadata->>'source' = 'ai_followup'
              AND created_at > $2) AS since_last_customer,
         (SELECT COUNT(*) FROM messages
            WHERE conversation_id = $1
              AND metadata->>'source' = 'ai_followup'
              AND created_at > NOW() - INTERVAL '24 hours') AS last_24h,
         (SELECT EXISTS (
            SELECT 1 FROM service_orders WHERE conversation_id = $1
          )) AS has_order`,
      [conversationId, new Date(lastCustomerMs).toISOString()]
    );
    const guard = guardRes.rows[0];
    if (!guard) return;
    if (parseInt(guard.since_last_customer, 10) > 0) return; // already nudged this episode
    if (parseInt(guard.last_24h, 10) >= MAX_FOLLOWUPS_PER_24H) return; // 24h ceiling
    if (guard.has_order === true) return; // they already booked — nothing to chase

    // 6. Spend cap — skip rather than make an unbudgeted call.
    const spendCheck = await this.spendCapEnforcer.canSpend(conv.shop_id);
    if (!spendCheck.allowed) {
      logger.info("AISalesFollowUpHandler: spend cap exceeded, skipping", {
        conversationId,
        shopId: conv.shop_id,
      });
      return;
    }

    // 7. Daytime window — no overnight nudges. Computed in the shop's tz.
    const shopTimezone = await this.getShopTimezone(conv.shop_id);
    const shopHour = this.shopLocalHour(shopTimezone);
    if (shopHour < DAYTIME_START_HOUR || shopHour >= DAYTIME_END_HOUR) {
      logger.debug("AISalesFollowUpHandler: outside shop daytime window, skipping", {
        conversationId,
        shopHour,
        shopTimezone,
      });
      return;
    }

    // 8. Build the prompt context.
    const [shop, customer] = await Promise.all([
      this.shopRepo.getShop(conv.shop_id),
      this.customerRepo.getCustomer(conv.customer_address),
    ]);
    const customerName = (customer?.name && customer.name.trim()) || "there";
    const shopName = shop?.name ?? "the shop";
    const proposedSlot = this.findLatestProposedSlot(messages);
    const systemPrompt = this.buildFollowUpPrompt({
      shopName,
      serviceName: service.serviceName,
      customerName,
      minutesQuiet: Math.round(minutesQuiet),
      conversationTail: this.renderTail(messages),
      proposedSlotLabel: proposedSlot,
    });

    // 9. Call Claude — Haiku, tight budget.
    let claudeResponse;
    try {
      claudeResponse = await this.anthropicClient.complete({
        systemPrompt: [{ text: systemPrompt, cache: false }],
        messages: [
          { role: "user", content: "(write the follow-up message now)" },
        ],
        model: FOLLOWUP_MODEL,
        maxTokens: FOLLOWUP_MAX_TOKENS,
      });
    } catch (err) {
      await this.auditLogger.log({
        conversationId,
        serviceId: conv.service_id,
        shopId: conv.shop_id,
        customerAddress: conv.customer_address,
        requestPayload: { source: "ai_followup", minutesQuiet: Math.round(minutesQuiet) },
        responsePayload: null,
        model: FOLLOWUP_MODEL,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        latencyMs: null,
        errorMessage: (err as Error)?.message ?? String(err),
      });
      logger.error("AISalesFollowUpHandler: Claude call failed", err);
      return;
    }

    // 10. Persist as a shop-sender message stamped generated_by=ai_agent so
    // the chat UI renders it as the AI; source=ai_followup is the
    // idempotency key checked above.
    const aiMessageId = `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
    try {
      await this.messageRepo.createMessage({
        messageId: aiMessageId,
        conversationId,
        senderAddress: conv.shop_id,
        senderType: "shop",
        messageText: claudeResponse.text.trim(),
        messageType: "text",
        metadata: {
          generated_by: "ai_agent",
          model: claudeResponse.model,
          source: "ai_followup",
          minutes_quiet: Math.round(minutesQuiet),
          cost_usd: claudeResponse.costUsd,
          latency_ms: claudeResponse.latencyMs,
        },
      });
    } catch (err) {
      logger.error("AISalesFollowUpHandler: failed to persist follow-up message", {
        conversationId,
        error: (err as Error)?.message,
      });
      return;
    }

    // 11. Audit log + spend record.
    await this.auditLogger.log({
      conversationId,
      serviceId: conv.service_id,
      shopId: conv.shop_id,
      customerAddress: conv.customer_address,
      requestPayload: {
        source: "ai_followup",
        minutesQuiet: Math.round(minutesQuiet),
        proposedSlotLabel: proposedSlot,
      },
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
    await this.spendCapEnforcer.recordSpend(conv.shop_id, claudeResponse.costUsd);

    // 12. WS broadcast to customer + shop so it lands in real-time.
    if (this.wsManager) {
      const targets: string[] = [conv.customer_address.toLowerCase()];
      if (shop?.walletAddress) targets.push(shop.walletAddress.toLowerCase());
      try {
        this.wsManager.sendToAddresses(targets, {
          type: "message:new",
          payload: { conversationId },
        });
      } catch (wsErr) {
        logger.error("AISalesFollowUpHandler: WS broadcast failed", {
          messageId: aiMessageId,
          error: (wsErr as Error)?.message,
        });
      }
    }

    logger.info("AISalesFollowUpHandler: follow-up sent", {
      conversationId,
      messageId: aiMessageId,
      minutesQuiet: Math.round(minutesQuiet),
      costUsd: claudeResponse.costUsd,
    });
  }

  /**
   * System prompt for the follow-up. Embeds the conversation tail + the
   * proposed slot as text (same shape as OrderConfirmationHandler) so the
   * single synthetic user turn just triggers generation.
   */
  private buildFollowUpPrompt(args: {
    shopName: string;
    serviceName: string;
    customerName: string;
    minutesQuiet: number;
    conversationTail: string;
    proposedSlotLabel: string | null;
  }): string {
    const { shopName, serviceName, customerName, minutesQuiet, conversationTail, proposedSlotLabel } = args;
    const slotLine = proposedSlotLabel
      ? `\nThe customer was offered this appointment slot but hasn't confirmed yet: ${proposedSlotLabel}.`
      : "";
    const slotRule = proposedSlotLabel
      ? `- Reference the proposed slot naturally; offer to lock it in or answer any questions.`
      : `- Gently offer to answer any other questions or get them booked when ready.`;

    return `You are a friendly assistant for ${shopName}. The customer (${customerName}) was chatting with you about "${serviceName}" and then went quiet about ${minutesQuiet} minutes ago.

Recent conversation (oldest to newest):
${conversationTail}${slotLine}

Your job: write ONE short, warm follow-up message to gently re-engage ${customerName} and keep the conversation going — like a friendly salesperson circling back.

HARD RULES:
- ONE short message, under 30 words.
- Warm and low-pressure. NEVER use fake urgency or "limited time" pressure.
- Use the customer's first name once.
${slotRule}
- DO NOT restate the full price, hours, or policies — they already saw them.
- DO NOT include any code block, JSON, or booking-suggestion markup.
- Reply with the message text only — no preamble like "Here is the message:".`.trim();
  }

  /** Render the conversation tail for the prompt, oldest-first. */
  private renderTail(messages: Message[]): string {
    return messages
      .map((m) => {
        const who = m.senderType === "customer" ? "Customer" : "You (shop)";
        const text = (m.messageText || "").replace(/\s+/g, " ").trim().slice(0, 200);
        return `${who}: ${text}`;
      })
      .join("\n");
  }

  /**
   * Find the most recent AI-proposed booking slot in the tail, if any —
   * scanning newest-first for a message carrying booking_suggestions.
   */
  private findLatestProposedSlot(messages: Message[]): string | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const suggestions = (messages[i].metadata as any)?.booking_suggestions;
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        const s = suggestions[0];
        if (s?.humanLabel) {
          return s.serviceName ? `${s.serviceName} — ${s.humanLabel}` : s.humanLabel;
        }
      }
    }
    return null;
  }

  /** The shop's IANA timezone from shop_time_slot_config (default ET). */
  private async getShopTimezone(shopId: string): Promise<string> {
    try {
      const res = await this.pool.query<{ timezone: string | null }>(
        `SELECT timezone FROM shop_time_slot_config WHERE shop_id = $1 AND location_id IS NULL`,
        [shopId]
      );
      return res.rows[0]?.timezone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  }

  /** Current hour-of-day (0-23) in the given IANA timezone. */
  private shopLocalHour(timeZone: string): number {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      let h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
      if (h === 24) h = 0;
      return h;
    } catch {
      // Unknown tz — fall back to a value inside the window so a config
      // typo doesn't silently suppress every follow-up.
      return 12;
    }
  }
}
