// backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts
//
// Main entry point for AI Sales Agent reply generation. Wires together every
// other service in this domain.
//
// Flow per call to handleCustomerMessage():
//   1. Load service + ai_shop_settings → check kill-switches (silent skip if
//      ai_sales_enabled=false on service or ai_global_enabled=false on shop)
//   2. SpendCapEnforcer.canSpend(shopId) → skip if over budget, otherwise
//      pick model (Sonnet vs Haiku based on 70% threshold)
//   3. EscalationDetector.shouldEscalate() → if true, log audit row with
//      escalated_to_human=true and exit (no AI reply, but Task 9 will
//      surface this state in the UI; for MVP the conversation just goes
//      quiet and a human can pick it up)
//   4. ContextBuilder.build() → AgentContext
//   5. PromptTemplates[tone](ctx) → system prompt
//   6. AnthropicClient.complete() → ClaudeResponse
//   7. Insert AI reply into messages table with metadata.generated_by='ai_agent'
//   8. AuditLogger.log() → ai_agent_messages
//   9. SpendCapEnforcer.recordSpend() → bump current_month_spend_usd
//
// On error: log to ai_agent_messages with error_message, do NOT post a
// reply. The customer sees nothing — the original conversation stays as-is
// and a human can pick up.
//
// No callers yet. Task 8 wires this to MessageService.sendMessage().

import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { ServiceRepository } from "../../../repositories/ServiceRepository";
import { MessageRepository } from "../../../repositories/MessageRepository";
import { AnthropicClient } from "./AnthropicClient";
import { ContextBuilder } from "./ContextBuilder";
import { buildSystemPrompt } from "./PromptTemplates";
import { AuditLogger } from "./AuditLogger";
import { SpendCapEnforcer } from "./SpendCapEnforcer";
import { EscalationDetector } from "./EscalationDetector";
import { parseBookingSuggestions } from "./BookingSuggestionParser";
import { reorderSlotsByPreference } from "./TimePreferenceMatcher";
import { scrubAssistantHistory } from "./ConversationHistoryScrubber";
import { ClaudeTool, BookingSuggestion } from "../types";

/**
 * Tool name for the booking-suggestion path. Phase 3 Task 10 fix-6 — replaces
 * the fenced-JSON-block parser with a tool-use schema Claude can't ignore.
 *
 * Anthropic validates `input` against `input_schema` BEFORE we see the
 * response. So slot_iso is guaranteed to be one of the listed values
 * (no hallucinated slots), and reply_text is guaranteed to fit the maxLength
 * (no rambling "$99 and 30 minutes" prefix).
 */
const BOOKING_TOOL_NAME = "propose_booking_slot";
// Lowered from 200 to 130 in fix-7. Empirical observation: Claude with a
// 200-char ceiling still fit the "Hi Lee Ann! The Newly Baker service is
// $99.00 and runs about 30 minutes..." boilerplate (175+ chars) before the
// slot mention. 130 chars forces the slot mention to come first or the
// reply gets truncated — which Claude avoids by writing tighter.
const BOOKING_REPLY_MAX_CHARS = 130;
import {
  HandleCustomerMessageInput,
  HandleCustomerMessageResult,
  AITone,
  ClaudeModel,
} from "../types";

const FALLBACK_MODEL: ClaudeModel = "claude-haiku-4-5-20251001";
const DEFAULT_MODEL: ClaudeModel = "claude-sonnet-4-6";
const DEFAULT_TONE: AITone = "professional";
const DEFAULT_ESCALATION_THRESHOLD = 5;
const MAX_OUTPUT_TOKENS = 800;

/**
 * Fallback text used when the same-slot loop guard drops every tool block
 * Claude emitted AND Claude provided no companion text. Brief, neutral —
 * the previous tap card from the prior turn is still visible so we don't
 * need to repeat the booking pitch.
 */
const LOOP_GUARD_FALLBACK_TEXT = "Anything else I can help with?";

export interface AgentOrchestratorDeps {
  pool?: Pool;
  serviceRepo?: ServiceRepository;
  messageRepo?: MessageRepository;
  anthropicClient?: AnthropicClient;
  contextBuilder?: ContextBuilder;
  auditLogger?: AuditLogger;
  spendCapEnforcer?: SpendCapEnforcer;
  escalationDetector?: EscalationDetector;
}

export class AgentOrchestrator {
  private readonly pool: Pool;
  private readonly serviceRepo: ServiceRepository;
  private readonly messageRepo: MessageRepository;
  private readonly anthropicClient: AnthropicClient;
  private readonly contextBuilder: ContextBuilder;
  private readonly auditLogger: AuditLogger;
  private readonly spendCapEnforcer: SpendCapEnforcer;
  private readonly escalationDetector: EscalationDetector;

  constructor(deps: AgentOrchestratorDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.serviceRepo = deps.serviceRepo ?? new ServiceRepository();
    this.messageRepo = deps.messageRepo ?? new MessageRepository();
    this.anthropicClient = deps.anthropicClient ?? new AnthropicClient();
    this.contextBuilder = deps.contextBuilder ?? new ContextBuilder();
    this.auditLogger = deps.auditLogger ?? new AuditLogger();
    this.spendCapEnforcer = deps.spendCapEnforcer ?? new SpendCapEnforcer();
    this.escalationDetector = deps.escalationDetector ?? new EscalationDetector();
  }

  async handleCustomerMessage(
    input: HandleCustomerMessageInput
  ): Promise<HandleCustomerMessageResult> {
    const { conversationId, customerAddress, shopId, serviceId, customerMessageText } = input;

    try {
      // 1. Service kill-switch check
      const service = await this.serviceRepo.getServiceById(serviceId);
      if (!service) {
        return { outcome: "failed", error: `Service not found: ${serviceId}` };
      }
      // Ownership check — the service must belong to the conversation's shop.
      // Without this, a spoofed serviceId (e.g. arriving via metadata) could
      // make the AI generate a reply based on a different shop's service
      // context, billed to the conversation's shop. Skip silently — same
      // shape as a kill-switch skip.
      if (service.shopId !== shopId) {
        return { outcome: "skipped", reason: "service_shop_mismatch" };
      }
      if (service.aiSalesEnabled !== true) {
        return { outcome: "skipped", reason: "service_ai_disabled" };
      }

      // 2. Shop kill-switch check (read ai_shop_settings directly via pool —
      //    keeps the orchestrator unaware of repository abstractions for
      //    a domain-local table)
      const shopSettings = await this.pool.query<{
        ai_global_enabled: boolean;
        escalation_threshold: number;
      }>(
        `SELECT ai_global_enabled, escalation_threshold
         FROM ai_shop_settings
         WHERE shop_id = $1`,
        [shopId]
      );

      if (shopSettings.rows.length === 0) {
        return { outcome: "skipped", reason: "no_shop_settings" };
      }
      if (shopSettings.rows[0].ai_global_enabled !== true) {
        return { outcome: "skipped", reason: "shop_ai_disabled" };
      }

      const escalationThreshold =
        shopSettings.rows[0].escalation_threshold ?? DEFAULT_ESCALATION_THRESHOLD;

      // 3. Spend cap check
      const spendCheck = await this.spendCapEnforcer.canSpend(shopId);
      if (!spendCheck.allowed) {
        return { outcome: "skipped", reason: "spend_cap_exceeded" };
      }
      const model: ClaudeModel = spendCheck.useCheaperModel
        ? FALLBACK_MODEL
        : DEFAULT_MODEL;

      // 4. Build context (we need the conversation history for the
      //    escalation detector AND for the prompt itself, so build before
      //    deciding escalation)
      const ctx = await this.contextBuilder.build({
        customerAddress,
        serviceId,
        conversationId,
        // includeUpsells defaults to service.aiSuggestUpsells inside builder
      });

      // 4.1 ai_paused check (Phase 2 of the handoff strategy doc).
      // Reads conversations.ai_paused_until directly — single source of
      // truth for both the 30-second auto race-window pause (bumped by
      // MessageRepository whenever a non-AI shop message lands) and the
      // explicit indefinite "Take Over" hold (set via the shop
      // dashboard). NULL or past timestamp → AI is active.
      //
      // Audit-logged so the admin dashboard can quantify how often
      // pause is firing and distinguish the auto race window from
      // explicit takeover (auto bumps are short; takeover holds are
      // months-long).
      try {
        const pausedRow = await this.pool.query<{ ai_paused_until: Date | null }>(
          `SELECT ai_paused_until FROM conversations WHERE conversation_id = $1`,
          [conversationId]
        );
        const pausedUntil = pausedRow.rows[0]?.ai_paused_until ?? null;
        if (pausedUntil && pausedUntil.getTime() > Date.now()) {
          const secondsRemaining = Math.round(
            (pausedUntil.getTime() - Date.now()) / 1000
          );
          logger.info(
            "AgentOrchestrator: skipping AI reply — ai_paused_until is in the future",
            { conversationId, secondsRemaining, pausedUntil }
          );
          await this.auditLogger.log({
            conversationId,
            serviceId,
            shopId,
            customerAddress,
            requestPayload: {
              reason: "ai_paused",
              pausedUntil: pausedUntil.toISOString(),
              secondsRemaining,
              customerMessageText,
            },
            responsePayload: null,
            model,
            inputTokens: 0,
            outputTokens: 0,
            cachedInputTokens: 0,
            costUsd: 0,
            latencyMs: null,
            escalatedToHuman: false,
            errorMessage: null,
          });
          return { outcome: "skipped", reason: "ai_paused" };
        }
      } catch (pauseLookupErr) {
        // Never let the pause-state read fail the whole reply flow.
        // Falling through means AI replies even when it shouldn't —
        // degraded behavior in a corner case, but preferable to the
        // alternative of silent total failure on every customer turn.
        logger.error("AgentOrchestrator: ai_paused lookup failed, proceeding without pause check", {
          conversationId,
          error: (pauseLookupErr as Error)?.message,
        });
      }

      // 4.5 Reorder availability slots based on the customer's stated time
      // preference (Phase 3 Task 10 fix-4). Pure prompt rules failed to
      // override Claude's recency bias — Claude kept picking the first slot
      // in the list even when the prompt said "match the customer's
      // preference". By putting matching slots first, we use Claude's bias
      // instead of fighting it. No-op when no preference is detected.
      if (ctx.availabilitySlots && ctx.availabilitySlots.length > 0) {
        const reordered = reorderSlotsByPreference(
          ctx.availabilitySlots,
          customerMessageText
        );
        if (reordered.band) {
          logger.info("AgentOrchestrator: reordered slots by detected preference", {
            band: reordered.band,
            matchedPhrase: reordered.matchedPhrase,
            slotCount: reordered.slots.length,
            firstSlotTime: reordered.slots[0]?.time,
          });
        }
        ctx.availabilitySlots = reordered.slots;
      }

      // 4.6 Focused-service-default enforcement at the schema layer.
      //
      // Background: prompt-only guidance (Rule #13 + the PRIMARY/OTHER
      // labelled slot groups) wasn't enough on long history-heavy threads.
      // Claude kept picking a historically-prominent service over the
      // current focus for unnamed booking requests like "book me thursday
      // at 2pm". Staging audit confirmed it even after the prompt rules
      // shipped — Claude was reading and ignoring them.
      //
      // Fix: if the customer's CURRENT message doesn't literally name any
      // AI-enabled service at the shop, filter the slot list (and thus the
      // tool's service_id enum) down to the focused service ONLY. Claude
      // physically cannot pick another service — Anthropic's schema
      // validator rejects out-of-enum values at the API boundary.
      //
      // When the customer DOES name a service explicitly ("book me
      // AQua Tech thursday"), the full multi-service slot list stays
      // available and the Phase 2/3 multi-service paths work as designed.
      // Build the universe of service names the customer might literally
      // name in their message: focused service + menu items + any service
      // present in the slot list (defensive — covers test fixtures or
      // unusual states where a service has slots but isn't in the menu).
      const namesByServiceId = new Map<string, string>();
      namesByServiceId.set(ctx.service.serviceId, ctx.service.serviceName);
      for (const m of ctx.shopServiceMenu ?? []) {
        namesByServiceId.set(m.serviceId, m.serviceName);
      }
      for (const s of ctx.availabilitySlots ?? []) {
        if (!namesByServiceId.has(s.serviceId)) {
          namesByServiceId.set(s.serviceId, s.serviceName);
        }
      }
      const allShopServicesForDetection = Array.from(
        namesByServiceId.entries()
      ).map(([serviceId, serviceName]) => ({ serviceId, serviceName }));
      const mentionedServiceIds = detectMentionedServices(
        customerMessageText,
        allShopServicesForDetection
      );
      const customerNamedNoService = mentionedServiceIds.size === 0;

      // Cross-service offer follow-up detection.
      //
      // Background: the focused-default filter + active-topic reminder
      // were designed to fight HISTORY bias — keep Claude on the anchor
      // when older history discussed a different service. But on a fresh
      // anchor where the AI's IMMEDIATELY PREVIOUS turn opened a thread
      // about a non-focused service ("Newly Baker is one of our services
      // — want to grab a slot?"), the customer's follow-up "yes please"
      // is accepting THAT offer, not the anchor. Without this check the
      // filter strips Newly Baker's slots and the reminder tells Claude
      // "stay on I Robot" — Claude either books I Robot (wrong) or
      // bails to teammate-handoff (the observed bug).
      //
      // Distinguish from anchor-switch: in anchor-switch, the prior
      // turn's anchor != current anchor (the customer just clicked into
      // a different service modal). In cross-service offer follow-up,
      // the anchor is unchanged AND the AI's prior text introduced
      // another service. Compare `metadata.anchor_service_id` from the
      // prior AI turn to the current serviceId.
      const crossServiceOffer = detectCrossServiceOfferFollowUp(
        ctx.conversationHistory,
        ctx.service.serviceId,
        allShopServicesForDetection
      );
      if (crossServiceOffer) {
        logger.info(
          "AgentOrchestrator: prior AI turn opened a cross-service offer on the same anchor — promoting offered service for this turn",
          {
            conversationId,
            focusedServiceId: serviceId,
            offeredServiceId: crossServiceOffer.offeredServiceId,
            offeredServiceName: crossServiceOffer.offeredServiceName,
          }
        );
      }

      if (
        customerNamedNoService &&
        !crossServiceOffer &&
        ctx.availabilitySlots &&
        ctx.availabilitySlots.length > 0
      ) {
        const originalSlotCount = ctx.availabilitySlots.length;
        const filtered = ctx.availabilitySlots.filter(
          (s) => s.serviceId === serviceId
        );
        if (filtered.length < originalSlotCount) {
          ctx.availabilitySlots = filtered;
          logger.info(
            "AgentOrchestrator: customer named no service → restricted tool to focused service slots only",
            {
              conversationId,
              focusedServiceId: serviceId,
              originalSlotCount,
              filteredSlotCount: filtered.length,
            }
          );
        }
      }

      // 5. Escalation detection — runs for TELEMETRY only.
      //
      // Pre-2026-05-15: matching escalation keywords short-circuited the
      // turn — no Claude call, no AI message, just a silent skip. The
      // customer saw the typing indicator appear and disappear without
      // any acknowledgement, which contradicted prompt rule #4's intent
      // (politely hand off, don't go silent).
      //
      // Now: the detector still fires to set an audit flag for "how
      // often do customers ask for humans?" tracking, but the orchestrator
      // proceeds to Claude. Rule #4 instructs Claude to reply briefly
      // ("a teammate will follow up shortly") instead of trying to
      // handle the request. Customer always sees an acknowledgement.
      const escalation = this.escalationDetector.shouldEscalate(
        customerMessageText,
        ctx.conversationHistory,
        escalationThreshold
      );
      if (escalation.shouldEscalate) {
        logger.info(
          "AgentOrchestrator: escalation keywords detected — proceeding to Claude for rule #4 handoff reply",
          { conversationId, reason: escalation.reason ?? "unspecified" }
        );
      }
      // Stamped onto the audit row after the Claude call resolves so
      // admins can filter ai_agent_messages for escalation turns
      // regardless of whether the reply itself fired.
      const escalationFlagForAudit = escalation.shouldEscalate;

      // 6. Build prompt + call Claude
      const tone: AITone = (service.aiTone ?? DEFAULT_TONE) as AITone;
      const systemPrompt = buildSystemPrompt(tone, ctx);

      // Map AgentMessageContext → ChatMessage shape for AnthropicClient.
      // Filter out empty-content turns: attachment-only messages, system
      // messages, encrypted ciphertext bodies, etc. Anthropic rejects the
      // entire request if any user message has empty content, so a single
      // empty turn in history would brick every AI reply on that thread.
      // Also scrub specific time mentions from past assistant messages
      // (Phase 3 Task 10 fix-5) — without this, Claude reads its own past
      // "How does Thursday at 9 AM sound?" output and copy-pastes the time
      // even when the customer is asking for a different slot. Customer
      // messages are left intact — only the AI's past suggestions get
      // scrubbed.
      const messages = scrubAssistantHistory(
        ctx.conversationHistory
          .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
          .map((m) => ({
            role: m.role,
            content: m.content,
            // Pass metadata through so the scrubber can scrub ONLY
            // slot-proposal messages (those with booking_suggestions)
            // — not every message that happens to mention a time
            // (shop hours, durations, etc).
            metadata: m.metadata,
          }))
      );

      // Add the current customer message as the final turn (it may not yet
      // be in the conversation history if Task 8's hook fires before the
      // message is committed — pass it explicitly to avoid a race).
      const lastHistoryRole = messages.length > 0 ? messages[messages.length - 1].role : null;
      if (lastHistoryRole !== "user") {
        messages.push({ role: "user", content: customerMessageText });
      }

      // Synthetic-assistant-note injection (one of two flavors, mutually
      // exclusive).
      //
      // Flavor A — ACTIVE-TOPIC ANCHOR reminder:
      //   Fires when the customer's current message NAMES NO SERVICE
      //   AND the AI's prior turn was on the same anchor with no
      //   cross-service offer. Pulls Claude back to the focused service
      //   on ambiguous follow-ups, defeating history-bias drift.
      //
      // Flavor B — CROSS-SERVICE OFFER reminder:
      //   Fires when the AI's prior turn (same anchor) introduced a
      //   non-focused service ("the Newly Baker tutorial is one of our
      //   services — want to grab a slot?") and the customer's current
      //   message is a follow-up. Pushes Claude TOWARD the offered
      //   service so a "yes please" produces a propose_booking_slot for
      //   it instead of waiting for the customer to name it explicitly.
      //
      // Without flavor B, the booking section's "OTHER AI-BOOKABLE
      // SERVICES — only book when the customer NAMES the service" rule
      // wins, and Claude refuses to propose a slot for the offered
      // service on a vague "yes please". Observed staging behavior.
      //
      // Neither flavor fires when the customer's CURRENT message names
      // a service — that signals intentional topic switch / explicit
      // selection, both flavors would interfere.
      if (messages.length > 0) {
        const lastIdx = messages.length - 1;
        const last = messages[lastIdx];
        if (last.role === "user" && customerNamedNoService) {
          let reminder: string | null = null;
          if (crossServiceOffer) {
            // Flavor B
            reminder = `[Internal note for the assistant — not visible to the customer: Your IMMEDIATELY PREVIOUS reply offered "${crossServiceOffer.offeredServiceName}" (id: ${crossServiceOffer.offeredServiceId}) to the customer. Their current message ("${customerMessageText.slice(0, 120).replace(/[\r\n]+/g, " ")}") is a follow-up to THAT offer — they are accepting / asking about "${crossServiceOffer.offeredServiceName}", NOT "${ctx.service.serviceName}". If "${crossServiceOffer.offeredServiceName}" has slots listed in the booking section below, CALL propose_booking_slot with service_id="${crossServiceOffer.offeredServiceId}" and one of its available slots — do not wait for them to name the service again; your prior offer is the context. Override the "only book OTHER AI-BOOKABLE SERVICES when the customer NAMES the service" rule for THIS turn only.]`;
          } else {
            // Flavor A
            reminder = `[Internal note for the assistant — not visible to the customer: This chat is anchored to "${ctx.service.serviceName}" (id: ${ctx.service.serviceId}). The customer's next question is about THIS service unless they explicitly name a different one. Answer using the "About this service" block, its FAQ entries, and its slots from above — not from earlier turns in the conversation that discussed other services. If the question is informational (price, duration, what's included, safety, etc.), use ${ctx.service.serviceName}'s data.]`;
          }
          // Splice in a brief synthetic assistant turn just before the
          // user message. Anthropic accepts an assistant turn followed
          // by a user turn — natural conversation shape. The text reads
          // as a self-directed note so Claude treats it as guidance,
          // not as something to quote to the customer.
          messages.splice(lastIdx, 0, {
            role: "assistant",
            content: reminder,
          });
        }
      }

      // Build the booking-suggestion tool when we have real slots to offer
      // (Phase 3 Task 10 fix-6). Claude is required to use this tool (and
      // only this tool) when proposing a booking. The schema constrains
      // slot_iso to the validated set + caps reply_text length, so Claude
      // physically can't hallucinate a slot or pad the message with the
      // service summary boilerplate the prompt rules couldn't suppress.
      //
      // Phase 2 of multi-service architecture: slots now span multiple
      // services. The tool builder builds the service_id enum from the
      // unique set of service IDs in the slot list, the slot_iso enum
      // from the union of all slots, and the orchestrator validates the
      // (service_id, slot_iso) PAIR consistency below (a valid service_id
      // matched with a slot_iso from a different service is rejected).
      const availabilitySlotsForCall = ctx.availabilitySlots ?? [];
      const slotLabelsByIsoForCall: Record<string, string> = {};
      const serviceIdBySlotIso: Record<string, string> = {};
      for (const slot of availabilitySlotsForCall) {
        slotLabelsByIsoForCall[slot.slotIso] = slot.humanLabel;
        serviceIdBySlotIso[slot.slotIso] = slot.serviceId;
      }
      const tools: ClaudeTool[] | undefined =
        availabilitySlotsForCall.length > 0
          ? [buildBookingSuggestionTool(availabilitySlotsForCall)]
          : undefined;

      const requestPayload = {
        model,
        systemPromptLength: systemPrompt.length,
        messageCount: messages.length,
        tone,
        toolsAvailable: tools?.length ?? 0,
      };

      let claudeResponse;
      try {
        claudeResponse = await this.anthropicClient.complete({
          systemPrompt: [
            // System prompt cached — same across many requests for this service+tone
            { text: systemPrompt, cache: true },
          ],
          messages,
          model,
          maxTokens: MAX_OUTPUT_TOKENS,
          ...(tools ? { tools, toolChoice: { type: "auto" as const } } : {}),
        });
      } catch (err: any) {
        await this.auditLogger.log({
          conversationId,
          serviceId,
          shopId,
          customerAddress,
          requestPayload,
          responsePayload: null,
          model,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: null,
          errorMessage: err?.message ?? String(err),
        });
        logger.error("AgentOrchestrator: Claude call failed", err);
        return { outcome: "failed", error: err?.message ?? String(err) };
      }

      // 6.5 Extract booking suggestions (Phase 3 — multi tool_use blocks).
      // Anthropic responses can contain N tool_use blocks. Phase 3 lifts the
      // earlier "one card per call" restriction so customers can say
      // "book me X AND Y" and get TWO tap-to-book cards in a single reply.
      // Each tool block is validated independently:
      //   - service_id must come from the enum
      //   - slot_iso must come from the enum
      //   - (service_id, slot_iso) pair must come from the same source slot
      //   - reply_text must be non-empty
      //   - duplicate (serviceId, slotIso) pairs across blocks are deduped
      // Invalid blocks are dropped with a reason; valid blocks accumulate
      // into bookingSuggestions[] in the order Claude emitted them.
      const availabilitySlots = ctx.availabilitySlots ?? [];
      const slotLabelsByIso = slotLabelsByIsoForCall;

      // Defensive `?? []` for older AnthropicClient mocks that don't populate
      // toolUses. Real responses always do (empty array when no tools called).
      const toolBlocks = (claudeResponse.toolUses ?? []).filter(
        (t) => t.toolName === BOOKING_TOOL_NAME
      );

      let customerFacingText: string;
      let bookingSuggestions: BookingSuggestion[];
      let bookingSuggestionDropReasons: string[];
      let bookingPath: "tool" | "text_parser" | "none";

      if (toolBlocks.length > 0) {
        const validSuggestions: BookingSuggestion[] = [];
        const validReplyTexts: string[] = [];
        const dropReasons: string[] = [];
        // Dedupe key: serviceId|slotIso. If Claude proposes the same slot
        // for the same service in two tool_use blocks, the second one is
        // dropped — one tap card per (serviceId, slotIso) is the contract
        // the frontend's BookingSuggestionCard render assumes.
        const seenPairs = new Set<string>();

        for (const toolBlock of toolBlocks) {
          const slotIso = String(toolBlock.input.slot_iso ?? "");
          const replyText = String(toolBlock.input.reply_text ?? "").trim();
          // Fallback to the focused service when service_id is missing —
          // preserves pre-Phase-2 single-service behavior for any client
          // emitting the old tool schema. Real Phase 2+ responses always
          // populate service_id (Anthropic schema enforces it).
          const proposedServiceId = String(
            toolBlock.input.service_id ?? serviceId
          );
          const matchingSlot = availabilitySlots.find(
            (s) =>
              s.slotIso === slotIso && s.serviceId === proposedServiceId
          );
          if (!matchingSlot) {
            const slotInSetButWrongService =
              slotIso.length > 0 &&
              availabilitySlots.some((s) => s.slotIso === slotIso);
            const dropReason = slotInSetButWrongService
              ? "tool_returned_service_slot_mismatch"
              : "tool_returned_invalid_slot";
            dropReasons.push(dropReason);
            logger.warn(
              "AgentOrchestrator: tool block rejected — invalid slot or service mismatch",
              { slotIso, proposedServiceId, dropReason }
            );
            continue;
          }
          if (replyText.length === 0) {
            dropReasons.push("tool_returned_empty_reply_text");
            continue;
          }
          const pairKey = `${matchingSlot.serviceId}|${slotIso}`;
          if (seenPairs.has(pairKey)) {
            dropReasons.push("tool_returned_duplicate_pair");
            continue;
          }
          seenPairs.add(pairKey);
          // Source-of-truth serviceId + serviceName come from the matched
          // slot, not the input — defense-in-depth. Phase 5: serviceName is
          // now persisted on each suggestion so the frontend can render the
          // service label directly on the tap card without falling back to
          // a shared message-level field.
          validSuggestions.push({
            serviceId: matchingSlot.serviceId,
            serviceName: matchingSlot.serviceName,
            slotIso,
            ...(slotLabelsByIso[slotIso]
              ? { humanLabel: slotLabelsByIso[slotIso] }
              : {}),
          });
          validReplyTexts.push(replyText);
        }

        // Same-slot loop guard (unconditional).
        //
        // Background: in long conversations Claude pattern-matches its own
        // prior turns and re-emits the same (serviceId, slotIso) booking
        // card across multiple replies. Audit on a real shop showed three
        // identical "Earliest available is today at 3:00 PM" cards in
        // consecutive turns because Claude kept firing the tool on
        // closing/off-topic signals.
        //
        // Rule: if Claude proposes a (serviceId, slotIso) pair that was
        // ALREADY proposed in the IMMEDIATELY PREVIOUS assistant turn,
        // drop it. No exceptions for customer wording — the rule is
        // purely structural. The prior tap card is still visible and
        // still tappable; a second identical card adds nothing.
        //
        // Why no acceptance check: a brittle regex for "is the customer
        // accepting?" would false-negative on phrasings we didn't list
        // ("send it", "lets goooo", "yeppp"), dropping a card the
        // customer wanted to tap on the FIRST proposal. The structural
        // rule sidesteps that entirely — on acceptance, Claude's prompt
        // tells it to reply in text ("Great — see you Tuesday at 3 PM!")
        // instead of re-firing the tool. The prior card handles booking.
        // If Claude misbehaves and re-fires anyway, the guard catches it.
        if (validSuggestions.length > 0) {
          const priorPairs = collectPriorBookingPairs(ctx.conversationHistory);
          if (priorPairs.size > 0) {
            const keptSuggestions: BookingSuggestion[] = [];
            const keptReplyTexts: string[] = [];
            for (let i = 0; i < validSuggestions.length; i++) {
              const s = validSuggestions[i];
              const pairKey = `${s.serviceId}|${s.slotIso}`;
              if (priorPairs.has(pairKey)) {
                dropReasons.push("loop_guard_same_slot");
                logger.warn(
                  "AgentOrchestrator: loop guard dropped duplicate booking proposal",
                  {
                    conversationId,
                    serviceId: s.serviceId,
                    slotIso: s.slotIso,
                  }
                );
                continue;
              }
              keptSuggestions.push(s);
              keptReplyTexts.push(validReplyTexts[i]);
            }
            validSuggestions.length = 0;
            validSuggestions.push(...keptSuggestions);
            validReplyTexts.length = 0;
            validReplyTexts.push(...keptReplyTexts);
          }
        }

        if (validSuggestions.length > 0) {
          // Multi-service handling: Claude's response can include a text
          // block (free-form) alongside the tool_use blocks. We preserve
          // that text block when it adds non-duplicate content, then
          // append each tool's reply_text in order. Each reply_text
          // appears as its own line in the customer's bubble; the
          // frontend renders one tap-to-book card per booking suggestion
          // below the text.
          //
          // Reading order in the customer's chat:
          //   1. extraText (if any — e.g. "I've lined up both:")
          //   2. validReplyTexts[0] ("For the pastry tutorial — Thursday at 9 AM works.")
          //   3. validReplyTexts[1] ("For the laptop repair — Friday at 2 PM works.")
          //   4. [tap-to-book card 1]
          //   5. [tap-to-book card 2]
          //
          // The exact-match guard handles the rare case Claude emits the
          // same text in extraText and the first reply_text.
          const extraText = (claudeResponse.text ?? "").trim();
          const joinedReplies = validReplyTexts.join("\n\n");
          // Drop extraText when it's a near-duplicate of any reply_text.
          // Claude routinely emits a text block restating the slot info
          // it already passed via reply_text — "Friday at 3:30 PM is the
          // closest match — tap below" vs "Friday at 3:30 PM is the
          // closest we've got — tap below". Exact-string equality
          // doesn't catch this; word-overlap does. The legitimate
          // multi-service case ("For the laptop repair, book separately
          // — for the pastry tutorial, Friday at 2 PM works") has low
          // overlap and is preserved.
          const extraIsRedundant =
            !extraText ||
            extraText === joinedReplies ||
            joinedReplies.includes(extraText) ||
            validReplyTexts.some((rt) => isLikelyDuplicateText(extraText, rt));
          customerFacingText = extraIsRedundant
            ? joinedReplies
            : `${extraText}\n\n${joinedReplies}`;
          bookingSuggestions = validSuggestions;
          bookingSuggestionDropReasons = dropReasons;
          bookingPath = "tool";
        } else {
          // Every tool block was invalid OR all were dropped by the loop
          // guard. Fall back to whatever text Claude emitted alongside the
          // tool call. The loop-guard branch routinely lands here — Claude
          // emits ONLY a tool call when proposing a slot, so when the
          // guard removes the only block, both fields are empty. Use the
          // explicit fallback so the customer sees a brief acknowledgement
          // rather than nothing.
          const fallback = claudeResponse.text || validReplyTexts.join("\n\n");
          customerFacingText = fallback || LOOP_GUARD_FALLBACK_TEXT;
          bookingSuggestions = [];
          bookingSuggestionDropReasons = dropReasons;
          bookingPath = "tool";
        }
      } else {
        // No tool call — Claude chose not to propose a slot (or the request
        // didn't include the tool because no slots were available). Use the
        // legacy parser on the text reply. With tools deployed and slots
        // available, this branch should rarely fire — when it does, it just
        // means Claude judged this turn as not booking-relevant.
        const parsed = parseBookingSuggestions(claudeResponse.text, {
          expectedServiceId: serviceId,
          // Phase 5: parser stamps serviceName onto every suggestion it
          // returns. Single-service by construction (validate() rejects any
          // block where service_id != expectedServiceId), so one name is
          // correct for the whole batch.
          expectedServiceName: ctx.service.serviceName,
          validSlotsIso: availabilitySlots.map((s) => s.slotIso),
          slotLabelsByIso,
        });
        customerFacingText = parsed.cleanText;
        bookingSuggestions = parsed.suggestions;
        bookingSuggestionDropReasons = parsed.droppedReasons;
        bookingPath = parsed.suggestions.length > 0 ? "text_parser" : "none";
      }
      logger.debug("AgentOrchestrator: booking-suggestion path resolved", {
        bookingPath,
        suggestionCount: bookingSuggestions.length,
      });

      // 7. Insert AI reply into messages table
      const aiMessageId = `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
      // Active topic for this turn — separate from anchor_service_id below.
      // anchor_service_id is the service the customer originally clicked
      // into; discussed_service_id follows in-conversation drift so the
      // frontend "Currently discussing" chip reflects what's actually
      // being talked about (e.g., customer pivots from AQua Tech to
      // I Robot mid-thread → chip flips, anchor stays).
      const discussedServiceId = resolveDiscussedServiceId(
        bookingSuggestions,
        customerFacingText,
        allShopServicesForDetection,
        ctx.conversationHistory,
        serviceId
      );
      // Stamp the resolved service's display name alongside the id so the
      // frontend chip can render without a separate service lookup. The
      // anchor is guaranteed to be in allShopServicesForDetection (we seed
      // it from ctx.service.serviceName at the top of the method), and
      // every other branch resolves to a service that came from that same
      // list, so a name should always be findable.
      const discussedServiceName =
        allShopServicesForDetection.find((s) => s.serviceId === discussedServiceId)
          ?.serviceName ?? null;
      const inserted = await this.messageRepo.createMessage({
        messageId: aiMessageId,
        conversationId,
        senderAddress: shopId, // The shop is the sender (AI is replying on behalf of the shop)
        senderType: "shop",
        messageText: customerFacingText,
        messageType: "text",
        metadata: {
          generated_by: "ai_agent",
          model: claudeResponse.model,
          tone,
          // Anchor the AI turn was operating under. Read by the NEXT turn's
          // orchestrator to distinguish "current-thread cross-service offer
          // follow-up" from "anchor just switched" — when the prior turn's
          // anchor matches the current, a customer follow-up like "yes
          // please" may be accepting a non-focused service the AI just
          // offered (don't strip those slots / fire the anchor reminder).
          anchor_service_id: serviceId,
          // Active service for THIS turn — see comment above the
          // resolveDiscussedServiceId call. Read by the frontend chip;
          // equal to anchor_service_id in the common (no-drift) case.
          discussed_service_id: discussedServiceId,
          ...(discussedServiceName
            ? { discussed_service_name: discussedServiceName }
            : {}),
          // Store cost + latency on the message metadata too — easier for
          // shop dashboard to show "AI sent this in 2.6s, cost $0.018"
          // without joining to ai_agent_messages
          cost_usd: claudeResponse.costUsd,
          latency_ms: claudeResponse.latencyMs,
          // Booking suggestion cards (Phase 3 Task 10). Empty array when
          // either the AI didn't propose a slot, or the proposal failed
          // validation (e.g., hallucinated slot not in availability set).
          ...(bookingSuggestions.length > 0
            ? { booking_suggestions: bookingSuggestions }
            : {}),
          // Diagnostic counters when the AI emitted blocks that failed
          // validation. Surfaces "AI tried but parser rejected" vs "AI
          // never tried" without needing log access — see the DB to debug.
          ...(bookingSuggestionDropReasons.length > 0
            ? { booking_suggestion_dropped: bookingSuggestionDropReasons }
            : {}),
        },
      });

      // 8. Audit log the successful call
      await this.auditLogger.log({
        conversationId,
        serviceId,
        shopId,
        customerAddress,
        requestPayload,
        responsePayload: {
          text: claudeResponse.text,
          stopReason: claudeResponse.stopReason,
          aiMessageId: inserted.message.messageId,
        },
        model: claudeResponse.model,
        inputTokens: claudeResponse.usage.inputTokens,
        outputTokens: claudeResponse.usage.outputTokens,
        cachedInputTokens: claudeResponse.usage.cacheReadInputTokens,
        costUsd: claudeResponse.costUsd,
        latencyMs: claudeResponse.latencyMs,
        // Persist tool calls so audit consumers see Claude's structured
        // output, not just the free text. Without this, `tool_calls` was
        // logged as [] even when stop_reason was "tool_use" — misleading
        // diagnostic. Booking suggestions still land in
        // messages.metadata.booking_suggestions for the frontend; this is
        // for forensic queries against ai_agent_messages.
        ...((claudeResponse.toolUses ?? []).length > 0
          ? {
              toolCalls: (claudeResponse.toolUses ?? []).map((t) => ({
                toolName: t.toolName,
                toolUseId: t.toolUseId,
                input: t.input,
              })),
            }
          : {}),
        // Stamped on the audit row when the EscalationDetector flagged
        // this turn — used by admin dashboards to track "how often do
        // customers ask for humans?" without scanning message text.
        // Per the post-2026-05-15 design, the AI still replies on
        // escalation turns (rule #4 generates the polite handoff line)
        // — the flag is purely informational.
        escalatedToHuman: escalationFlagForAudit,
      });

      // 9. Update spend cap
      await this.spendCapEnforcer.recordSpend(shopId, claudeResponse.costUsd);

      return {
        outcome: "ai_replied",
        aiMessageId: inserted.message.messageId,
        costUsd: claudeResponse.costUsd,
        latencyMs: claudeResponse.latencyMs,
        model: claudeResponse.model,
      };
    } catch (err: any) {
      // Catch-all for unexpected failures (DB outages, etc). Audit-log
      // best-effort then return failed result.
      logger.error("AgentOrchestrator: unexpected failure", err);
      try {
        await this.auditLogger.log({
          conversationId,
          serviceId,
          shopId,
          customerAddress,
          requestPayload: { reason: "orchestrator_unexpected_error" },
          responsePayload: null,
          model: DEFAULT_MODEL,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: null,
          errorMessage: err?.message ?? String(err),
        });
      } catch {
        // Ignore — already in error path
      }
      return { outcome: "failed", error: err?.message ?? String(err) };
    }
  }
}

// No eager singleton — instantiating `new AnthropicClient()` requires
// ANTHROPIC_API_KEY at construction time, which breaks tests / non-AI code paths
// that import this file. Callers (Task 8's MessageService hook) instantiate
// `new AgentOrchestrator()` when needed.

/**
 * Build the propose_booking_slot tool definition for the current set of
 * available slots. Phase 3 Task 10 fix-6.
 *
 * Phase 2 of multi-service architecture: the slot list spans multiple
 * AI-enabled services at the shop. The tool now takes BOTH a service_id
 * and a slot_iso, each constrained to its respective enum. Anthropic
 * validates each field individually — pair consistency (slot_iso belongs
 * to the named service_id) is enforced by AgentOrchestrator after the
 * response lands.
 *
 * The schema enforces:
 *   - service_id MUST be one of the AI-enabled services at the shop (enum)
 *   - slot_iso MUST be one of the available slots (enum, union across services)
 *   - reply_text capped at BOOKING_REPLY_MAX_CHARS (no $99-and-30-min boilerplate)
 *
 * Anthropic validates the tool's input against this schema before returning
 * the response, so an out-of-enum slot or over-length reply is rejected at
 * the API boundary — Claude can't ignore a schema the way it ignores prompt
 * rules. The orchestrator still double-checks defensively, including the
 * (service_id, slot_iso) pair consistency that the schema alone can't enforce.
 */
function buildBookingSuggestionTool(
  availabilitySlots: { slotIso: string; humanLabel: string; serviceId: string; serviceName: string }[]
): ClaudeTool {
  // Deduplicate service IDs while preserving first-seen order (matches the
  // grouping order in the prompt's slot list).
  const seenServiceIds = new Set<string>();
  const serviceIdEnum: string[] = [];
  const serviceLabelsByIdForDescription: string[] = [];
  for (const slot of availabilitySlots) {
    if (!seenServiceIds.has(slot.serviceId)) {
      seenServiceIds.add(slot.serviceId);
      serviceIdEnum.push(slot.serviceId);
      serviceLabelsByIdForDescription.push(
        `${slot.serviceName} (${slot.serviceId})`
      );
    }
  }
  const slotEnum = availabilitySlots.map((s) => s.slotIso);
  const slotChoicesForDescription = availabilitySlots
    .slice(0, 5)
    .map((s) => `${s.serviceName} — ${s.humanLabel} (${s.slotIso})`)
    .join("; ");

  return {
    name: BOOKING_TOOL_NAME,
    description: [
      `Propose a specific bookable appointment slot to the customer. This is the ONLY way to render a tap-to-book card in chat — plain text with slot info will not produce a card.`,
      `Multi-service: the slot list in the system prompt is grouped by service. Always call the tool with BOTH a service_id and a slot_iso from the SAME service group — never mix service_id from one group with a slot_iso from another.`,
      `Multi-call: you MAY call this tool MULTIPLE TIMES in a single response — once per service the customer wants to book. Each call renders its own tap-to-book card. Example: customer says "book me a laptop repair AND a pastry tutorial" → emit TWO tool_use blocks, one per service. Each call must still pair a service_id with a slot_iso from that service's group. Do not emit two calls for the same (service_id, slot_iso) — duplicates are dropped server-side.`,
      `Default service: when the customer requests a booking WITHOUT NAMING a specific service ("book me thursday at 2pm", "I want an appointment", "any morning slot?"), use the service listed under "About this service" in the system prompt — that's the active anchor. The slot list's PRIMARY group is for this service. Do NOT default to a service from the conversation history; the anchor wins.`,
      `Available services: ${serviceLabelsByIdForDescription.join("; ")}.`,
      `CALL THE TOOL when the customer asks about times, picks a slot, or says yes to a previous suggestion. Specifically:`,
      `Trigger questions: "what times do you have?", "what time do you have?", "do you have morning slot?", "do you have afternoon slot?", "do you have evening slot?", "any openings?", "when can I come in?", "can I book Thursday?", "Thursday afternoon", "Thursday at 2pm", "yes please", "I'll take it", "book me in".`,
      `DO NOT call the tool — answer in plain text instead — for any of these patterns:`,
      `(a) Informational questions about the service: "how much does this cost?", "what's included?", "what should I bring?", "how long does it take?", "what's your cancellation policy?".`,
      `(b) Shop-scope or catalog questions: "what do you sell?", "what u sell?", "what services do you have?", "what do you offer?", "do you do X?" where X isn't named in the slot list. These are about the menu, not a booking.`,
      `(c) Closing or gratitude signals: "thanks", "thank you", "thank u", "ok", "okay", "got it", "great", "cool", "👍", "bye". The customer is wrapping up — do not re-propose a slot. Send a brief warm acknowledgement in plain text (e.g. "You're welcome — let me know whenever you'd like to book!").`,
      `(d) Off-topic, joking, or nonsense ("so u sell bread", "lol", random one-word replies that aren't time/day words). Answer briefly in plain text — redirect to the service if relevant, or just acknowledge.`,
      `(e) Negations or deferrals: "not now", "maybe later", "I'll think about it", "no thanks". Acknowledge and offer to be available later — no tap card needed.`,
      `Critical: if you already proposed a slot in your immediately previous turn and the customer's reply is one of (b)-(e) above, NEVER call the tool again with the same slot. Repeating the same booking card across turns reads as broken automation. Answer their question; the existing card is still visible.`,
      `When in doubt, DO NOT call the tool. A text reply is correct whenever the customer hasn't asked to book. A repeated identical card is worse than no card at all — it makes the assistant look stuck.`,
      `Sample slots: ${slotChoicesForDescription}.`,
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          enum: serviceIdEnum,
          description:
            "The ID of the service being booked. MUST be one of the IDs listed in the enum (these are the AI-enabled services at this shop). The chosen slot_iso MUST appear under this service_id's group in the prompt's slot list — mixing groups is rejected by the server.",
        },
        slot_iso: {
          type: "string",
          enum: slotEnum,
          description:
            "The ISO 8601 timestamp of the specific slot you are proposing. MUST be exactly one of the values listed in the enum — no invented or modified slots. The slot MUST come from the same service group as service_id above. If the customer asked for morning/afternoon/evening, pick a slot whose hour matches that band.",
        },
        reply_text: {
          type: "string",
          maxLength: BOOKING_REPLY_MAX_CHARS,
          description: [
            "The short natural-language message the customer sees in chat above the tap-to-book card.",
            "HARD RULES:",
            "(1) MUST mention the slot day + time (e.g. 'Thursday at 2:30 PM').",
            "(2) MUST be conversational and brief — under 130 characters.",
            "(3) MUST NOT mention price (no '$99'), duration (no '30 minutes'), or category. The customer already sees these on the card and elsewhere in the UI.",
            "(4) MAY mention the service name briefly when more than one service is in play (e.g. 'For the pastry tutorial — Thursday 9 AM works'). For single-service bookings, leave the service name out.",
            "(5) MUST NOT prefix with 'Hi {name}!' on follow-up turns — only on the very first AI reply in a conversation.",
            "(6) MUST NOT ask 'would you like me to lock this in?' / 'want me to book it?'. Just propose the slot directly. The tap card is the booking UI; the customer doesn't need permission language.",
            "GOOD examples (all valid):",
            "'Thursday at 2:30 PM works — tap below.'",
            "'How about Friday at 10 AM?'",
            "'Got 9 AM Thursday open.'",
            "'For the pastry tutorial — Thursday at 12 PM works.'",
            "BAD examples (NEVER produce these):",
            "'Hi Lee Ann! The Newly Baker service is $99 and runs 30 minutes. We have availability as early as Thursday — would you like me to lock one in?' (mentions price/duration + asks permission)",
            "'The service is $99.00 and takes about 30 minutes.' (just a service summary, no slot)",
            "'We have slots available — pick one.' (no specific slot, asks customer to choose)",
          ].join(" "),
        },
      },
      required: ["service_id", "slot_iso", "reply_text"],
      additionalProperties: false,
    },
  };
}

/**
 * Detect which (if any) services the customer has named by literal mention
 * in their current message. Used by the focused-default enforcement above:
 * when nothing is mentioned, the orchestrator filters the tool's service_id
 * enum down to the focused service so Claude physically cannot drift toward
 * a historically-discussed service.
 *
 * Rules:
 *   - Case-insensitive
 *   - Word-boundary anchored on both sides (avoids "Test" inside "testing")
 *   - Service names shorter than MIN_SERVICE_NAME_LEN_FOR_DETECTION chars
 *     are SKIPPED — they'd produce too many false positives on common
 *     English words. A 2-char service name like "AT" matched anywhere in
 *     "I want to book at 2pm" would mis-fire badly.
 *
 * Exported for unit testing — not used outside this module.
 */
export function detectMentionedServices(
  customerMessageText: string,
  services: { serviceId: string; serviceName: string }[]
): Set<string> {
  const mentioned = new Set<string>();
  if (!customerMessageText || typeof customerMessageText !== "string") {
    return mentioned;
  }
  for (const svc of services) {
    const needle = svc.serviceName?.trim();
    if (!needle || needle.length < MIN_SERVICE_NAME_LEN_FOR_DETECTION) {
      continue;
    }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Boundary handling: \b only matches between word/non-word transitions,
    // which fails when the service name starts/ends in non-word chars (e.g.
    // "C++ Tutoring (Beginner)" ends in ')'). Use explicit non-alphanumeric
    // lookalikes — match the needle when bordered by string start/end or
    // any non-alphanumeric character. Robust against names containing
    // regex special chars or trailing punctuation.
    const re = new RegExp(
      `(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`,
      "i"
    );
    if (re.test(customerMessageText)) {
      mentioned.add(svc.serviceId);
    }
  }
  return mentioned;
}

/**
 * Minimum service-name length we'll search for in the customer's message.
 * Short generic names (e.g. "Test", "Bar") would false-match common English
 * words. 3 chars is the empirical sweet spot — matches "Spa", "AQua Tech",
 * "Newly Baker" reliably; skips "AT", "Bar"-style generic names that look
 * indistinguishable from regular prose.
 */
const MIN_SERVICE_NAME_LEN_FOR_DETECTION = 3;

/**
 * Determine whether two short reply strings are near-duplicates of each
 * other. Used by the orchestrator to drop the free-text block Claude
 * sometimes emits ALONGSIDE a tool_use whose reply_text already conveys
 * the same information.
 *
 * Heuristic:
 *   1. Lowercase + strip non-alphanumerics → split into tokens
 *   2. Filter to tokens of length ≥ 3 (drops "of", "at", "is", "to" —
 *      noise that inflates overlap on every English sentence)
 *   3. Compute |A ∩ B| / min(|A|, |B|). If ≥ 0.70, declare duplicate.
 *
 * Why MIN, not UNION (Jaccard): we want to catch the case where one
 * string is a near-superset of the other (e.g., extra adds an emoji or
 * one filler word). Pure Jaccard would penalize size differences and
 * miss those.
 *
 * Tuning: 0.70 threshold accepts the observed staging duplicate
 * (86% overlap on "closest match" vs "closest we've got") and rejects
 * legitimate multi-service combinations (25% overlap). Tighten if false
 * positives appear; loosen if real duplicates slip through.
 *
 * Empty / very short strings → never duplicate (returning true on a
 * short "Sure!" would suppress legitimate confirmations).
 *
 * Exported for unit testing — not used outside this module.
 */
export function isLikelyDuplicateText(a: string, b: string): boolean {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return false;
  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.length < 3 || bTokens.length < 3) return false;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const t of aSet) if (bSet.has(t)) intersection++;
  const minSize = Math.min(aSet.size, bSet.size);
  if (minSize === 0) return false;
  return intersection / minSize >= 0.7;
}

/**
 * Detect whether the AI's IMMEDIATELY previous assistant turn opened a
 * cross-service offer on the SAME anchor that's active now — e.g., the
 * AI is anchored to I Robot, the previous turn mentioned "the Newly
 * Baker tutorial is one of our services — want to grab a slot?", and
 * the customer's current message is a follow-up.
 *
 * Returns the offered service's id + name when detected, otherwise null.
 *
 * When this returns non-null, the caller should:
 *   - Skip the focused-default slot filter (keep the offered service's
 *     slots available so Claude can book what it just offered).
 *   - Replace the active-topic anchor reminder with a cross-service-offer
 *     reminder pointing at the offered service.
 *
 * The check requires BOTH:
 *   (a) The prior assistant turn's metadata.anchor_service_id matches
 *       the current focused serviceId. Distinguishes "in-thread upsell"
 *       from "anchor just switched". Falls back to inferring the prior
 *       anchor from booking_suggestions[0].serviceId when metadata is
 *       missing (legacy data); when nothing tells us the prior anchor,
 *       we conservatively return null (existing behavior wins).
 *   (b) The prior assistant text content names at least one NON-focused
 *       service from the shop menu. When multiple non-focused services
 *       are named, the FIRST one detected is returned (stable order
 *       from the services array — typically reflects menu order).
 *
 * Exported for unit testing — not used outside this module.
 */
export function detectCrossServiceOfferFollowUp(
  conversationHistory: {
    role: string;
    content?: string;
    metadata?: Record<string, any>;
  }[],
  currentFocusedServiceId: string,
  allShopServicesForDetection: { serviceId: string; serviceName: string }[]
): { offeredServiceId: string; offeredServiceName: string } | null {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return null;
  }
  // Find the most-recent assistant turn.
  let priorAssistant: {
    role: string;
    content?: string;
    metadata?: Record<string, any>;
  } | null = null;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const turn = conversationHistory[i];
    if (turn?.role === "assistant") {
      priorAssistant = turn;
      break;
    }
  }
  if (!priorAssistant) return null;

  // (a) Was the prior turn's anchor the same as the current?
  const meta = priorAssistant.metadata;
  let priorAnchorServiceId: string | null = null;
  if (meta && typeof meta.anchor_service_id === "string") {
    priorAnchorServiceId = meta.anchor_service_id;
  } else if (
    meta &&
    Array.isArray(meta.booking_suggestions) &&
    meta.booking_suggestions.length > 0
  ) {
    // Legacy data without anchor_service_id: infer from a sole proposed
    // serviceId. Multi-service tool blocks may propose more than one;
    // only infer when all agree (otherwise we can't tell what the
    // anchor was).
    const ids = new Set(
      meta.booking_suggestions
        .map((s: any) => (typeof s?.serviceId === "string" ? s.serviceId : null))
        .filter((id: string | null): id is string => id !== null)
    );
    if (ids.size === 1) {
      priorAnchorServiceId = ids.values().next().value as string;
    }
  }
  if (priorAnchorServiceId !== currentFocusedServiceId) {
    // Anchor changed or unknown — fall back to existing focused-default
    // behavior so history bias keeps getting suppressed.
    return null;
  }

  // (b) Did the prior text content mention a non-focused service?
  const priorContent =
    typeof priorAssistant.content === "string" ? priorAssistant.content : "";
  if (priorContent.length === 0) return null;
  const mentioned = detectMentionedServices(
    priorContent,
    allShopServicesForDetection
  );
  // Iterate in the canonical service-detection input order so the
  // returned service is deterministic when the prior text mentions
  // more than one non-focused service. Typically reflects shop-menu
  // order, which puts the most-likely-offered service first.
  for (const svc of allShopServicesForDetection) {
    if (svc.serviceId === currentFocusedServiceId) continue;
    if (mentioned.has(svc.serviceId)) {
      return {
        offeredServiceId: svc.serviceId,
        offeredServiceName: svc.serviceName,
      };
    }
  }
  return null;
}

/**
 * Walk the conversation history in reverse and return the set of
 * (serviceId|slotIso) pair keys from the MOST RECENT assistant message's
 * `metadata.booking_suggestions`. Returns an empty set when no prior
 * assistant message exists, when it has no metadata, or when its metadata
 * carries no booking_suggestions array.
 *
 * Why most-recent only: the loop guard is anti-duplication for the
 * IMMEDIATE preceding turn. Older proposals are not the bug — Claude
 * proposing Tuesday 3 PM five turns ago is fine if the customer recently
 * asked again. Only the back-to-back duplicate is the failure mode.
 *
 * Exported for unit testing — not used outside this module.
 */
export function collectPriorBookingPairs(
  conversationHistory: { role: string; metadata?: Record<string, any> }[]
): Set<string> {
  const pairs = new Set<string>();
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return pairs;
  }
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const turn = conversationHistory[i];
    if (turn?.role !== "assistant") continue;
    const suggestions = turn.metadata?.booking_suggestions;
    if (!Array.isArray(suggestions)) {
      // Found the latest assistant turn but it has no suggestions — stop
      // (don't reach further back; we only care about the immediate
      // predecessor).
      return pairs;
    }
    for (const s of suggestions) {
      if (s && typeof s.serviceId === "string" && typeof s.slotIso === "string") {
        pairs.add(`${s.serviceId}|${s.slotIso}`);
      }
    }
    return pairs;
  }
  return pairs;
}

/**
 * Resolve the service the AI is ACTIVELY discussing on the turn being
 * persisted. Stamped onto messages.metadata.discussed_service_id so the
 * frontend's "Currently discussing" chip can follow conversation drift
 * instead of staying pinned to the original anchor (conversation.service_id).
 *
 * Resolution policy (Option A — carry-forward, anchor as last resort):
 *   1. AI proposed a booking via tool call → first proposal's service. The
 *      first call is the headlining topic; multi-tool turns may include
 *      secondaries, but the leading service is what the AI just committed
 *      to.
 *   2. AI named exactly ONE service in the reply text → that service.
 *      When the AI names multiple (a polite catch-all like
 *      "...whether AQua Tech or I Robot, happy to help") it's ambiguous
 *      and we fall through to carry-forward rather than guessing.
 *   3. No clear signal → carry forward the previous AI message's
 *      discussed_service_id. Keeps the chip stable across "thanks" / "ok"
 *      / off-topic replies instead of snapping back to the anchor.
 *   4. First AI reply / no prior discussed value → fall back to the
 *      anchor (the service the customer originally clicked into).
 *
 * Exported for unit testing.
 */
export function resolveDiscussedServiceId(
  bookingSuggestions: { serviceId?: string }[],
  aiReplyText: string,
  allShopServices: { serviceId: string; serviceName: string }[],
  conversationHistory: { role: string; metadata?: Record<string, any> }[],
  anchorServiceId: string
): string {
  // Step 1 — tool call wins. The "first one" rule is deliberate: when
  // Claude emits multiple propose_booking_slot calls (a rare multi-service
  // booking turn), pin to the lead service rather than letting the chip
  // jitter to whichever serviceId happened to appear last in the array.
  if (
    Array.isArray(bookingSuggestions) &&
    bookingSuggestions.length > 0 &&
    typeof bookingSuggestions[0].serviceId === "string" &&
    bookingSuggestions[0].serviceId.length > 0
  ) {
    return bookingSuggestions[0].serviceId;
  }

  // Step 2 — single-service text mention. Re-uses detectMentionedServices
  // (the same name-matching the customer-message detector uses) on the
  // AI's outgoing text so the rule is symmetric with how we detect
  // customer-named services elsewhere in the orchestrator.
  if (typeof aiReplyText === "string" && aiReplyText.trim().length > 0) {
    const mentioned = detectMentionedServices(aiReplyText, allShopServices);
    if (mentioned.size === 1) {
      return mentioned.values().next().value as string;
    }
  }

  // Step 3 — carry forward. Walk the history in reverse to find the most
  // recent AI turn that already carries a discussed_service_id and reuse
  // it. Older turns predate the field (pre-deploy data) and will have
  // undefined — skip those rather than treating them as a "no prior"
  // signal, so the chip recovers gradually as new turns land.
  if (Array.isArray(conversationHistory)) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const turn = conversationHistory[i];
      if (turn?.role !== "assistant") continue;
      const prev = turn?.metadata?.discussed_service_id;
      if (typeof prev === "string" && prev.length > 0) {
        return prev;
      }
    }
  }

  // Step 4 — anchor fallback. First turn after deploy, or a conversation
  // with no AI history at all.
  return anchorServiceId;
}

// findMostRecentHumanShopMessage + toMillis helpers removed in Phase 2.
// The time-window heuristic they powered is replaced by the persistent
// conversations.ai_paused_until column (migration 114) — single source
// of truth for both the 30s auto race window and indefinite "Take Over"
// holds. See docs/tasks/strategy/ai-human-handoff-clash.md.
