// backend/src/domains/AIAgentDomain/controllers/UnifiedAssistantController.ts
//
// ⚠️ SPIKE — Unified "Talk To My Business" assistant (the flagship demo).
//
// Proves the exec vision (docs/tasks/strategy/voice-ai-dispatcher/
// unified-assistant-vision.md): ONE conversation that does
// Information → Recommendation → Action across domains, without the owner
// picking a panel. e.g.
//   "How did we do this month?" → revenue/top-customer/repeat metrics
//   "Fix it"                    → finds lapsed customers + drafts a win-back
//
// HOW IT WORKS: this is the Insights agent loop (copied from
// InsightsController) with ONE change — the tool array is a *merged, curated*
// set drawn from BOTH the insights and marketing registries, and dispatch
// routes each tool_use to whichever registry owns it. No new tool logic is
// written: it reuses the existing insights read tools and marketing
// draft/lookup tools verbatim (they all implement ClaudeTool + execute({shopId,
// pool})). This is the orchestrator pattern the scope-delta calls the "central
// new build," kept deliberately small here to validate the thesis cheaply.
//
// SCOPE GUARDRAILS (spike):
//   - DRAFT only. propose_campaign_send is intentionally NOT exposed — the
//     assistant never sends; the draft card is the human-in-the-loop confirm.
//   - Curated 5-tool set, not the full ~19, to keep the demo on-script.
//   - No dedicated audit table (no migration); spend still flows through the
//     shared SpendCapEnforcer.
//
// Route: POST /api/ai/orchestrate (authMiddleware, requireRole(['shop'])).

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
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

const ORCHESTRATE_MODEL: ClaudeModel = "claude-sonnet-4-6";
const ORCHESTRATE_MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 6; // a "fix it" turn can chain lookup → draft

// Curated cross-domain tool set for the flagship demo. Names must match the
// existing registries; anything not found is simply omitted.
const SPIKE_TOOL_NAMES = new Set<string>([
  // Insights (Information)
  "revenue_summary",
  "top_customers",
  "repeat_customer_analysis",
  // Marketing (Action) — draft path only, no send
  "lookup_audience_count",
  "propose_campaign_draft",
]);

function getSpikeTools(): ClaudeTool[] {
  return [...getInsightsTools(), ...getMarketingTools()].filter((t) =>
    SPIKE_TOOL_NAMES.has(t.name)
  );
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

const ORCHESTRATE_SYSTEM_PROMPT = `You are the shop owner's unified business assistant for RepairCoin (a brandable, Siri-like helper — the owner may name you). In ONE conversation you both ANSWER questions about the owner's business and TAKE marketing actions. Your style is Information → Recommendation → Action: state the number, then what it means, then offer the next step.

You have these tools:
- revenue_summary — revenue for a range; pass compare:"prior" to get the trend vs the previous period.
- top_customers — the shop's highest-value customers for a range.
- repeat_customer_analysis — new vs repeat customer split (repeat-visit health) for a range.
- lookup_audience_count — size a customer segment from a free-text hint (e.g. "haven't booked in 60 days").
- propose_campaign_draft — create a DRAFT marketing campaign for a resolved audience. Echo the audience_type / audience_filters returned by lookup_audience_count into the draft.

Rules:
- For "how did we do?" / performance questions, default the range to "this_month" unless the owner says otherwise, and use compare:"prior" on revenue_summary so you can report the trend ("revenue up 18%"). Pull repeat-visit health and the top customer too when relevant.
- When the owner reacts with "fix it", "win them back", "send a promo to lapsed customers", or similar, FIRST call lookup_audience_count to size the segment, THEN call propose_campaign_draft to create the win-back draft.
- REUSE what's already in this conversation. Do NOT re-call a tool for a metric, range, or segment you already fetched earlier in the thread — read it from the conversation instead. Only call a tool when you genuinely need data you don't have yet (a new metric, a different range, or a not-yet-sized segment). Concretely: on a "fix it" / win-back turn, go STRAIGHT to lookup_audience_count + propose_campaign_draft — do not re-pull the revenue, top-customer, or repeat-visit numbers you already reported.
- You NEVER send. You only DRAFT. After drafting, tell the owner the draft is ready and they can review and send it — the send is their confirmation, not yours. If asked to "send it", explain they confirm via the draft.
- Ground EVERY number in tool output. Never invent figures. If a tool returns zero or no data, say so plainly.
- Be concise — a sentence or two per turn, like a sharp ops manager, not a report.`;

export interface UnifiedAssistantDeps {
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
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
        const { messages } = parsed.value;

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

        const tools = getSpikeTools();
        const loopMessages: ChatMessage[] = messages.map((m: InsightsMessage) => ({
          role: m.role,
          content: m.content,
        }));
        const toolCalls: UnifiedToolCallSummary[] = [];
        const cumulative = { costUsd: 0, latencyMs: 0, cachedInputTokens: 0 };
        const responseTexts: string[] = [];
        let lastResponse: ClaudeResponse | null = null;

        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const response = await anthropic.complete({
            systemPrompt: [{ text: ORCHESTRATE_SYSTEM_PROMPT, cache: true }],
            messages: loopMessages,
            model: ORCHESTRATE_MODEL,
            maxTokens: ORCHESTRATE_MAX_TOKENS,
            tools,
            toolChoice: { type: "auto" },
          });

          cumulative.costUsd += response.costUsd;
          cumulative.latencyMs += response.latencyMs;
          cumulative.cachedInputTokens += response.usage.cacheReadInputTokens;
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

        if (!lastResponse) {
          res.status(503).json({
            success: false,
            error: "AI service temporarily unavailable. Please try again.",
          });
          return;
        }

        await spendCap.recordSpend(shopId, cumulative.costUsd);

        logger.info("UnifiedAssistant(spike) turn", {
          shopId,
          tools: toolCalls.map((t) => t.tool),
          costUsd: cumulative.costUsd,
          latencyMs: cumulative.latencyMs,
        });

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
