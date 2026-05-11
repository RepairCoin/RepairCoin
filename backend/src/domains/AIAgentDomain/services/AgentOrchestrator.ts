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

      // 5. Escalation check — does the customer want a human?
      const escalation = this.escalationDetector.shouldEscalate(
        customerMessageText,
        ctx.conversationHistory,
        escalationThreshold
      );
      if (escalation.shouldEscalate) {
        // Log to audit so admins can see we backed off, but don't post a reply
        await this.auditLogger.log({
          conversationId,
          serviceId,
          shopId,
          customerAddress,
          requestPayload: { reason: "escalated_pre_call", customerMessageText },
          responsePayload: null,
          model,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: null,
          escalatedToHuman: true,
          errorMessage: null,
        });
        return { outcome: "escalated", reason: escalation.reason ?? "unspecified" };
      }

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
          }))
      );

      // Add the current customer message as the final turn (it may not yet
      // be in the conversation history if Task 8's hook fires before the
      // message is committed — pass it explicitly to avoid a race).
      const lastHistoryRole = messages.length > 0 ? messages[messages.length - 1].role : null;
      if (lastHistoryRole !== "user") {
        messages.push({ role: "user", content: customerMessageText });
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

      // 6.5 Extract booking suggestion (Phase 3 Task 10 fix-6 — tool use).
      // Prefer Claude's tool_use output (schema-enforced) over the legacy
      // fenced-JSON parser. Fall back to the parser if Claude emitted plain
      // text without using the tool — rare, but covers the case where Claude
      // decides not to suggest a slot at all (then the parser returns no
      // suggestions and the text passes through cleanly).
      const availabilitySlots = ctx.availabilitySlots ?? [];
      const slotLabelsByIso = slotLabelsByIsoForCall;

      // Defensive `?? []` for older AnthropicClient mocks that don't populate
      // toolUses. Real responses always do (empty array when no tools called).
      const toolBlock = (claudeResponse.toolUses ?? []).find(
        (t) => t.toolName === BOOKING_TOOL_NAME
      );

      let customerFacingText: string;
      let bookingSuggestions: BookingSuggestion[];
      let bookingSuggestionDropReasons: string[];
      let bookingPath: "tool" | "text_parser" | "none";

      if (toolBlock) {
        const slotIso = String(toolBlock.input.slot_iso ?? "");
        const replyText = String(toolBlock.input.reply_text ?? "").trim();
        // Phase 2 of multi-service architecture: tool input now carries
        // service_id alongside slot_iso. The slot list spans multiple
        // services, so a valid service_id paired with a valid slot_iso
        // from a different service is still wrong — the booking card
        // would render for the wrong service. We accept the call only
        // when (service_id, slot_iso) come from the SAME source slot.
        //
        // Fallback for older clients/mocks that didn't pass service_id:
        // default to the focused conversation service. That preserves
        // pre-Phase-2 single-service behavior.
        const proposedServiceId = String(
          toolBlock.input.service_id ?? serviceId
        );
        const matchingSlot = availabilitySlots.find(
          (s) => s.slotIso === slotIso && s.serviceId === proposedServiceId
        );
        const inSet = matchingSlot !== undefined;
        if (inSet && replyText.length > 0) {
          // Tool call validated by Anthropic + double-checked by us.
          // Multi-service handling: Claude's response can include BOTH a
          // text block AND a tool_use block. For single-service bookings,
          // Claude typically emits only tool_use (text empty). For
          // multi-service requests (rule #11), Claude emits a text block
          // addressing the OTHER service alongside the tool call for the
          // current service. Concatenating ensures both reach the
          // customer.
          //
          // Order: extraText first, then reply_text. Tap-to-book card
          // renders below the message, so the customer reads:
          //   1. "For laptop repair, book separately..." (text block)
          //   2. "For pastry tutorial, Thursday 12 PM..." (reply_text)
          //   3. [Tap to book card]
          //
          // The exact-match dedupe guard handles the rare case Claude
          // emits the same text in both blocks.
          const extraText = (claudeResponse.text ?? "").trim();
          customerFacingText =
            extraText && extraText !== replyText
              ? `${extraText}\n\n${replyText}`
              : replyText;
          // Use the service_id from the matched slot rather than the
          // input (defense-in-depth: matchingSlot is the source of truth).
          bookingSuggestions = [
            {
              serviceId: matchingSlot!.serviceId,
              slotIso,
              ...(slotLabelsByIso[slotIso]
                ? { humanLabel: slotLabelsByIso[slotIso] }
                : {}),
            },
          ];
          bookingSuggestionDropReasons = [];
          bookingPath = "tool";
        } else {
          // Anthropic should have rejected an out-of-enum slot_iso (and an
          // out-of-enum service_id), but defense-in-depth: if a mismatched
          // (service_id, slot_iso) pair slips through — both individually
          // valid but from different services — reject it. Same outcome
          // as a hallucinated slot.
          const slotInSetButWrongService =
            slotIso.length > 0 &&
            availabilitySlots.some((s) => s.slotIso === slotIso) &&
            !matchingSlot;
          const dropReason = slotInSetButWrongService
            ? "tool_returned_service_slot_mismatch"
            : "tool_returned_invalid_slot";
          logger.warn(
            "AgentOrchestrator: tool returned invalid slot or service mismatch, falling back to text",
            {
              slotIso,
              proposedServiceId,
              replyTextLen: replyText.length,
              dropReason,
            }
          );
          customerFacingText = claudeResponse.text || replyText;
          bookingSuggestions = [];
          bookingSuggestionDropReasons = [dropReason];
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
      `Available services: ${serviceLabelsByIdForDescription.join("; ")}.`,
      `CALL THE TOOL when the customer asks about times, picks a slot, or says yes to a previous suggestion. Specifically:`,
      `Trigger questions: "what times do you have?", "what time do you have?", "do you have morning slot?", "do you have afternoon slot?", "do you have evening slot?", "any openings?", "when can I come in?", "can I book Thursday?", "Thursday afternoon", "Thursday at 2pm", "yes please", "I'll take it", "book me in".`,
      `Do NOT call the tool for genuinely informational questions: "how much does this cost?", "what's included?", "what should I bring?", "how long does it take?", "what's your cancellation policy?".`,
      `When in doubt between booking-intent and informational, lean toward calling the tool. A miss-call is better than no card.`,
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
