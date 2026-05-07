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
const BOOKING_REPLY_MAX_CHARS = 200;
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
      const availabilitySlotsForCall = ctx.availabilitySlots ?? [];
      const slotLabelsByIsoForCall: Record<string, string> = {};
      for (const slot of availabilitySlotsForCall) {
        slotLabelsByIsoForCall[slot.slotIso] = slot.humanLabel;
      }
      const tools: ClaudeTool[] | undefined =
        availabilitySlotsForCall.length > 0
          ? [buildBookingSuggestionTool(serviceId, availabilitySlotsForCall)]
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
        const inSet = availabilitySlots.some((s) => s.slotIso === slotIso);
        if (inSet && replyText.length > 0) {
          // Tool call validated by Anthropic + double-checked by us.
          customerFacingText = replyText;
          bookingSuggestions = [
            {
              serviceId,
              slotIso,
              ...(slotLabelsByIso[slotIso]
                ? { humanLabel: slotLabelsByIso[slotIso] }
                : {}),
            },
          ];
          bookingSuggestionDropReasons = [];
          bookingPath = "tool";
        } else {
          // Anthropic should have rejected an out-of-enum slot_iso, but
          // defense-in-depth: if it slips through, drop the suggestion and
          // fall back to whatever text Claude emitted.
          logger.warn(
            "AgentOrchestrator: tool returned invalid slot_iso, falling back to text",
            { slotIso, replyTextLen: replyText.length }
          );
          customerFacingText = claudeResponse.text || replyText;
          bookingSuggestions = [];
          bookingSuggestionDropReasons = ["tool_returned_invalid_slot"];
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
 * The schema enforces:
 *   - slot_iso MUST be one of the available slots (enum)
 *   - reply_text capped at BOOKING_REPLY_MAX_CHARS (no $99-and-30-min boilerplate)
 *
 * Anthropic validates the tool's input against this schema before returning
 * the response, so an out-of-enum slot or over-length reply is rejected at
 * the API boundary — Claude can't ignore a schema the way it ignores prompt
 * rules. The orchestrator still double-checks defensively (model could in
 * principle skip the tool call entirely if Anthropic's validator changes
 * behavior).
 */
function buildBookingSuggestionTool(
  serviceId: string,
  availabilitySlots: { slotIso: string; humanLabel: string }[]
): ClaudeTool {
  const slotEnum = availabilitySlots.map((s) => s.slotIso);
  const slotChoicesForDescription = availabilitySlots
    .slice(0, 5)
    .map((s) => `${s.humanLabel} (${s.slotIso})`)
    .join("; ");

  return {
    name: BOOKING_TOOL_NAME,
    description: [
      `Propose a specific bookable appointment slot to the customer for service ${serviceId}.`,
      `Use ONLY when the customer is showing booking intent (asking about times, picking a slot, saying yes to a previous suggestion).`,
      `Do NOT use for general pricing/policy questions where the customer hasn't expressed booking intent.`,
      `Examples of when to use: "what times do you have?", "Can I book Thursday?", "yes please", "Thursday at 2pm works".`,
      `Examples of when NOT to use: "how much does this cost?", "what's included?", "what should I bring?".`,
      `Available slots include: ${slotChoicesForDescription}.`,
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        slot_iso: {
          type: "string",
          enum: slotEnum,
          description:
            "The ISO 8601 timestamp of the specific slot you are proposing. MUST be exactly one of the values listed in the enum — no invented or modified slots.",
        },
        reply_text: {
          type: "string",
          maxLength: BOOKING_REPLY_MAX_CHARS,
          description: [
            "The natural-language message the customer will see in chat alongside the tap-to-book card.",
            "RULES:",
            "(1) MUST reference the proposed slot in plain English (e.g. 'How does Thursday at 2:30 PM sound?').",
            "(2) MUST be conversational — like a real shop owner texting back, not a service brochure.",
            "(3) MUST NOT restate price, duration, or category. The customer already knows.",
            "(4) MUST NOT include a follow-up question chain. One sentence is best.",
            "(5) Keep under 150 characters in practice.",
            "GOOD: 'Thursday at 2:30 PM works — tap below to lock it in.'",
            "BAD: 'The service is $99 and runs 30 minutes. We have availability as early as Thursday — would you like me to lock in a slot?'",
          ].join(" "),
        },
      },
      required: ["slot_iso", "reply_text"],
      additionalProperties: false,
    },
  };
}
