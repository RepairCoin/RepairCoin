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

      // Map AgentMessageContext → ChatMessage shape for AnthropicClient
      const messages = ctx.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Add the current customer message as the final turn (it may not yet
      // be in the conversation history if Task 8's hook fires before the
      // message is committed — pass it explicitly to avoid a race)
      const lastHistoryRole = messages.length > 0 ? messages[messages.length - 1].role : null;
      if (lastHistoryRole !== "user") {
        messages.push({ role: "user", content: customerMessageText });
      }

      const requestPayload = {
        model,
        systemPromptLength: systemPrompt.length,
        messageCount: messages.length,
        tone,
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

      // 7. Insert AI reply into messages table
      const aiMessageId = `msg_${Date.now()}_${uuidv4().slice(0, 8)}`;
      const inserted = await this.messageRepo.createMessage({
        messageId: aiMessageId,
        conversationId,
        senderAddress: shopId, // The shop is the sender (AI is replying on behalf of the shop)
        senderType: "shop",
        messageText: claudeResponse.text,
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
