// backend/src/domains/AIAgentDomain/controllers/UnifiedAssistantController.ts
//
// Unified "Talk To My Business" assistant (v2). Owner-facing orchestrator:
// ONE conversation that does Information → Recommendation → Action across
// domains, without the owner picking a panel. e.g.
//   "How did we do this month?" → revenue/top-customer/repeat metrics
//   "Fix it"                    → finds lapsed customers + drafts a win-back
//
// Greenlit 2026-06-01 (exec approved G1 architecture reversal + G2 autonomy
// line). Phase 1 of the plan in docs/tasks/strategy/unified-assistant/
// implementation.md. Strategy: ../../../../docs/tasks/strategy/
// voice-ai-dispatcher/unified-assistant-vision.md.
//
// HOW IT WORKS: this is the Insights agent loop (copied from
// InsightsController) with ONE change — the tool array is a *merged* set drawn
// from BOTH the insights and marketing registries, and dispatch routes each
// tool_use to whichever registry owns it. No new tool logic: it reuses the
// existing insights read tools and marketing draft/lookup tools verbatim (they
// all implement ClaudeTool + execute({shopId, pool})).
//
// SCOPE GUARDRAILS:
//   - DRAFT only. propose_campaign_send is WITHHELD (see WITHHELD_TOOLS) — per
//     G2, sending / POs / refunds are confirm-before-execute; the actual
//     send tool with a confirm step lands in Phase 4. The assistant proposes;
//     the owner taps to send.
//   - Phase 1 exposes the full insights + marketing registry (send withheld).
//   - Stateless for now (client passes history, like InsightsController);
//     server-side conversation persistence is Phase 2 (D2). Each turn is
//     audited into ai_orchestrate_messages (migration 132); spend flows
//     through the shared SpendCapEnforcer.
//
// Route: POST /api/ai/orchestrate (authMiddleware, requireRole(['shop'])).

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { OrchestrateAuditLogger } from "../services/OrchestrateAuditLogger";
import {
  getInsightsTools,
  getInsightsToolByName,
} from "../services/insights/registry";
import { dispatchTool } from "../services/insights/dispatcher";
import {
  getMarketingTools,
  getMarketingToolByName,
} from "../services/marketing/registry";
import { dispatchMarketingTool } from "../services/marketing/dispatcher";
import {
  getOrchestratorOwnTools,
  getOrchestratorOwnToolByName,
} from "../services/orchestrator/registry";
import {
  ChatMessage,
  ChatMessageContentBlock,
  ClaudeModel,
  ClaudeResponse,
  ClaudeTool,
} from "../types";
// Reuse the strict user/assistant-alternation validator — identical shape.
import {
  parseInsightsRequest,
  InsightsMessage,
} from "./InsightsController";

// Sonnet for the reasoning + tool-use; drop to Haiku when the shared budget is
// ≥70% used (SpendCapEnforcer.useCheaperModel), matching the Sales Agent.
const ORCHESTRATE_MODEL_DEFAULT: ClaudeModel = "claude-sonnet-4-6";
const ORCHESTRATE_MODEL_CHEAP: ClaudeModel = "claude-haiku-4-5-20251001";
const ORCHESTRATE_MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 6; // a "fix it" turn can chain lookup → draft

// Full tool set across all three registries: insights (read) + marketing
// (incl. propose_campaign_send, un-withheld in Phase 4) + orchestrator-own
// actions (propose_purchase_order). Every ACTION is confirm-gated — the tool
// PROPOSES, the owner taps the card to execute (G2). Nothing is withheld.
function getOrchestratorTools(): ClaudeTool[] {
  return [
    ...getInsightsTools(),
    ...getMarketingTools(),
    ...getOrchestratorOwnTools(),
  ];
}

/** Normalized dispatch result — both registries share this shape. */
interface UnifiedDispatch {
  ok: boolean;
  tool: string;
  args: Record<string, unknown>;
  data?: Record<string, unknown>;
  display?: unknown;
  error?: string;
  latencyMs: number;
}

/** Route a tool_use to whichever registry owns it. */
async function dispatchUnified(
  name: string,
  input: unknown,
  ctx: { shopId: string; pool: Pool }
): Promise<UnifiedDispatch> {
  // Orchestrator-own action tools (e.g. propose_purchase_order) — executed
  // directly (they validate their own args); they never throw past here.
  const ownTool = getOrchestratorOwnToolByName(name);
  if (ownTool) {
    const started = Date.now();
    try {
      const r = await ownTool.execute(input, ctx);
      return {
        ok: true,
        tool: name,
        args: (input ?? {}) as Record<string, unknown>,
        data: r.data,
        display: r.display,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        tool: name,
        args: (input ?? {}) as Record<string, unknown>,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      };
    }
  }
  const insightsTool = getInsightsToolByName(name);
  if (insightsTool) {
    const r = await dispatchTool(insightsTool, input, ctx);
    return {
      ok: r.ok,
      tool: r.tool,
      args: r.args,
      data: r.result?.data,
      display: r.result?.display,
      error: r.error,
      latencyMs: r.latencyMs,
    };
  }
  const marketingTool = getMarketingToolByName(name);
  if (marketingTool) {
    const r = await dispatchMarketingTool(marketingTool, input, ctx);
    return {
      ok: r.ok,
      tool: r.tool,
      args: r.args,
      data: r.result?.data,
      display: r.result?.display,
      error: r.error,
      latencyMs: r.latencyMs,
    };
  }
  return {
    ok: false,
    tool: name,
    args: (input ?? {}) as Record<string, unknown>,
    error: `Unknown tool '${name}'`,
    latencyMs: 0,
  };
}

const ORCHESTRATE_SYSTEM_PROMPT = `You are the shop owner's unified business assistant for RepairCoin (a brandable, Siri-like helper — the owner may name you). In ONE conversation you both ANSWER questions about the owner's business and TAKE marketing actions, without the owner switching screens. Your style is Information → Recommendation → Action: state the number, then what it means, then offer the next step.

Your tools fall into three groups (full schemas are provided to you separately):
- INSIGHTS (read) — revenue, customers, repeat-visit health, bookings, services, and inventory / low-stock for a given range. Use these to answer "how are we doing?" questions.
- MARKETING — size a customer segment (lookup_audience_count), draft a campaign (propose_campaign_draft), and propose sending a draft (propose_campaign_send).
- INVENTORY ACTION — propose a purchase order to restock a low / running-out item (propose_purchase_order). Use when the owner says "order more", "restock", or "reorder".

Rules:
- For "how did we do?" / performance questions, default the range to "this_month" unless the owner says otherwise, and use compare:"prior" on revenue_summary so you can report the trend ("revenue up 18%"). Pull the most relevant 1-3 metrics — don't dump every tool.
- When the owner reacts with "fix it", "win them back", "send a promo to lapsed customers", or similar, FIRST call lookup_audience_count to size the segment, THEN call propose_campaign_draft. Echo the audience_type / audience_filters returned by the lookup into the draft.
- REUSE what's already in this conversation. Do NOT re-call a tool for a metric, range, or segment you already fetched earlier in the thread — read it from the conversation instead. Only call a tool for data you don't have yet (a new metric, a different range, a not-yet-sized segment). On a "fix it" / win-back turn, go STRAIGHT to lookup_audience_count + propose_campaign_draft — do not re-pull numbers you already reported.
- You can PROPOSE actions — draft or send a campaign, or order/restock inventory (propose_purchase_order) — but you NEVER execute them yourself. Every proposal renders a card the owner taps to confirm; the tap performs the action, not you. Never claim something was sent or ordered — say it's drafted/proposed and ready for their confirmation.
- Ground EVERY number in tool output. Never invent figures. If a tool returns zero or no data, say so plainly.
- ALWAYS respond in English (the shop dashboard is English). If the user's message looks garbled or contains non-English text — e.g. a voice transcription that mis-detected the language — do NOT switch languages or guess; reply in English and ask them to rephrase.
- Be concise — a sentence or two per turn, like a sharp ops manager, not a report.`;

export interface UnifiedAssistantDeps {
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: OrchestrateAuditLogger;
  pool?: Pool;
}

export interface UnifiedToolCallSummary {
  tool: string;
  args: Record<string, unknown>;
  display?: unknown;
}

export interface UnifiedResponseData {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: UnifiedToolCallSummary[];
}

export function makeUnifiedAssistantController(deps: UnifiedAssistantDeps = {}) {
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? new OrchestrateAuditLogger();
  const pool = deps.pool ?? getSharedPool();
  let anthropic: AnthropicClient | null = deps.anthropic ?? null;

  return {
    askOrchestrator: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const parsed = parseInsightsRequest(req.body);
        if (!parsed.ok || !parsed.value) {
          res.status(400).json({ success: false, error: parsed.error });
          return;
        }
        const { sessionId, messages } = parsed.value;

        const spendCheck = await spendCap.canSpend(shopId);
        if (!spendCheck.allowed) {
          res.status(429).json({
            success: false,
            error:
              "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
            details: {
              currentSpendUsd: spendCheck.currentSpendUsd,
              monthlyBudgetUsd: spendCheck.monthlyBudgetUsd,
              blockReason: spendCheck.blockReason,
            },
          });
          return;
        }

        if (!anthropic) anthropic = new AnthropicClient();

        const model: ClaudeModel = spendCheck.useCheaperModel
          ? ORCHESTRATE_MODEL_CHEAP
          : ORCHESTRATE_MODEL_DEFAULT;
        const tools = getOrchestratorTools();
        const loopMessages: ChatMessage[] = messages.map((m: InsightsMessage) => ({
          role: m.role,
          content: m.content,
        }));
        const toolCalls: UnifiedToolCallSummary[] = [];
        const cumulative = {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: 0,
        };
        const responseTexts: string[] = [];
        let lastResponse: ClaudeResponse | null = null;
        let errorMessage: string | null = null;

        // Wrap the agent loop so a Claude failure still writes an audit row
        // (mirrors InsightsController). Loop-body indentation is unchanged.
        try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const response = await anthropic.complete({
            systemPrompt: [{ text: ORCHESTRATE_SYSTEM_PROMPT, cache: true }],
            messages: loopMessages,
            model,
            maxTokens: ORCHESTRATE_MAX_TOKENS,
            tools,
            toolChoice: { type: "auto" },
          });

          cumulative.inputTokens += response.usage.inputTokens;
          cumulative.outputTokens += response.usage.outputTokens;
          cumulative.cachedInputTokens += response.usage.cacheReadInputTokens;
          cumulative.costUsd += response.costUsd;
          cumulative.latencyMs += response.latencyMs;
          lastResponse = response;

          if (response.text && response.text.trim().length > 0) {
            responseTexts.push(response.text);
          }
          if (response.toolUses.length === 0) break;

          const assistantBlocks: ChatMessageContentBlock[] = [];
          if (response.text) {
            assistantBlocks.push({ type: "text", text: response.text });
          }
          for (const tu of response.toolUses) {
            assistantBlocks.push({
              type: "tool_use",
              id: tu.toolUseId,
              name: tu.toolName,
              input: tu.input,
            });
          }
          loopMessages.push({ role: "assistant", content: assistantBlocks });

          const toolResultBlocks: ChatMessageContentBlock[] = [];
          for (const tu of response.toolUses) {
            const result = await dispatchUnified(tu.toolName, tu.input, {
              shopId,
              pool,
            });
            toolCalls.push({
              tool: result.tool,
              args: result.args,
              display: result.ok ? result.display : undefined,
            });
            const resultContent = result.ok
              ? JSON.stringify(result.data ?? {})
              : JSON.stringify({ error: result.error });
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tu.toolUseId,
              content: resultContent,
              is_error: !result.ok,
            });
          }
          loopMessages.push({ role: "user", content: toolResultBlocks });
        }
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
          logger.error("UnifiedAssistantController: Claude call failed", err);
        }

        // Audit — ALWAYS (success AND failure), cumulative across the loop.
        await auditLogger.log({
          shopId,
          sessionId,
          requestPayload: { messages },
          responsePayload: lastResponse,
          model: lastResponse?.model ?? model,
          inputTokens: cumulative.inputTokens,
          outputTokens: cumulative.outputTokens,
          cachedInputTokens: cumulative.cachedInputTokens,
          costUsd: cumulative.costUsd,
          toolCalls,
          latencyMs: cumulative.latencyMs || null,
          errorMessage,
        });

        if (!lastResponse) {
          res.status(503).json({
            success: false,
            error: "AI service temporarily unavailable. Please try again.",
          });
          return;
        }

        await spendCap.recordSpend(shopId, cumulative.costUsd);

        const data: UnifiedResponseData = {
          reply:
            responseTexts.length > 0
              ? responseTexts.join("\n\n")
              : lastResponse.text,
          model: lastResponse.model,
          cached: cumulative.cachedInputTokens > 0,
          latencyMs: cumulative.latencyMs,
          toolCalls,
        };
        res.json({ success: true, data });
      } catch (err) {
        logger.error("UnifiedAssistantController error", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to process request" });
      }
    },
  };
}

let _default: ReturnType<typeof makeUnifiedAssistantController> | null = null;
export function askOrchestrator(req: Request, res: Response): Promise<void> {
  if (!_default) _default = makeUnifiedAssistantController();
  return _default.askOrchestrator(req, res);
}
