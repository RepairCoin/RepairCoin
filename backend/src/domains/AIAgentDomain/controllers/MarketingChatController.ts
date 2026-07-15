// backend/src/domains/AIAgentDomain/controllers/MarketingChatController.ts
//
// POST /api/ai/marketing-chat — multi-turn AI Marketing Assistant for
// shop owners. Sibling to InsightsController; same agent-loop shape,
// different tools + prompt + audit destination.
//
// Request:  { sessionId: string, messages: [{ role, content }, ...] }
// Response: { success: true, data: {
//              reply, model, cached, latencyMs,
//              toolCalls: [{ tool, args, display? }, ...]
//            } }
//        |  { success: false, error: string }
//
// Pipeline (mirrors Insights):
//   1. Auth (shop JWT) + parse + validate
//   2. Spend-cap pre-flight (shared monthly budget)
//   3. 50-drafts/day guard (shop-scoped, AI-origin only)
//   4. Build system prompt = static rules block + per-shop context block
//   5. Agent loop — Claude call → dispatch tools → repeat (max 5)
//   6. Audit log every call (success + failure)
//   7. 503 on Claude failure
//   8. Record spend
//   9. Return aggregated reply + toolCalls for frontend rendering

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { MarketingAuditLogger } from "../services/MarketingAuditLogger";
import {
  buildMarketingRulesBlock,
  buildMarketingShopContextBlock,
} from "../services/marketing/promptBuilder";
import { buildMarketingShopContext } from "../services/marketing/contextBuilder";
import { buildDateContextBlock } from "../services/dateContext";
import { getAiMemoryService } from "../services/AiMemoryService";
import {
  getMarketingTools,
  getMarketingToolByName,
} from "../services/marketing/registry";
import { dispatchMarketingTool } from "../services/marketing/dispatcher";
import {
  MarketingToolDisplay,
  MarketingToolInvocationRecord,
} from "../services/marketing/types";
import {
  ChatMessage,
  ChatMessageContentBlock,
  ClaudeModel,
  ClaudeResponse,
} from "../types";

export type MarketingMessageRole = "user" | "assistant";

export interface MarketingMessage {
  role: MarketingMessageRole;
  content: string;
}

export interface MarketingRequestBody {
  sessionId: string;
  messages: MarketingMessage[];
}

export interface MarketingToolCallSummary {
  tool: string;
  args: Record<string, unknown>;
  display?: MarketingToolDisplay;
}

export interface MarketingResponseData {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: MarketingToolCallSummary[];
  // WS3 soft-landing — see InsightsResponseData. True once the monthly AI
  // allowance is spent; the reply still came through on the cheaper model.
  limitReached: boolean;
  budgetUsd: number;
  spentUsd: number;
}

// ----- Validation bounds (mirror Insights) -----

export const MAX_MESSAGES = 30;
export const MAX_CONTENT_CHARS = 8000; // higher than Insights — campaign bodies are longer than questions
export const MAX_SESSION_ID_CHARS = 64;

// ----- Agent-loop constants -----

const MARKETING_MODEL: ClaudeModel = "claude-sonnet-4-6";
// Spend-cap soft landing (D2): Haiku at ≥70% + past the 100% cap so AI keeps working at minimal cost.
const MARKETING_MODEL_CHEAP: ClaudeModel = "claude-haiku-4-5-20251001";
const MARKETING_MAX_TOKENS = 2048; // larger than Insights — drafted bodies can be several paragraphs

// Same shape as Insights: 5 iterations is enough for
// lookup_audience_count → propose_campaign_draft → final prose, with
// headroom for an extra tool call when the shop iterates.
const MAX_TOOL_ITERATIONS = 5;

// Anti-spam guard. Counts AI-originated drafts in marketing_campaigns
// for this shop in the last 24h. Hard cap at 50 — beyond that the
// behavior is almost certainly programmatic abuse, not a real shop
// owner. Scope §5 Q9.
const MAX_DRAFTS_PER_DAY = 50;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: MarketingRequestBody;
}

/**
 * Pure validator — exported for unit testing. Enforces alternation
 * starting with user, like InsightsController.parseInsightsRequest.
 */
export function parseMarketingRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required" };
  }
  const b = body as { sessionId?: unknown; messages?: unknown };

  if (typeof b.sessionId !== "string" || b.sessionId.length === 0) {
    return { ok: false, error: "`sessionId` must be a non-empty string" };
  }
  if (b.sessionId.length > MAX_SESSION_ID_CHARS) {
    return {
      ok: false,
      error: `\`sessionId\` exceeds maximum of ${MAX_SESSION_ID_CHARS} characters`,
    };
  }

  if (!Array.isArray(b.messages)) {
    return { ok: false, error: "`messages` must be an array" };
  }
  if (b.messages.length === 0) {
    return { ok: false, error: "`messages` must not be empty" };
  }
  if (b.messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: `\`messages\` exceeds maximum of ${MAX_MESSAGES}`,
    };
  }

  const cleaned: MarketingMessage[] = [];
  for (let i = 0; i < b.messages.length; i++) {
    const m = b.messages[i] as { role?: unknown; content?: unknown };
    if (!m || typeof m !== "object") {
      return { ok: false, error: `messages[${i}] must be an object` };
    }
    if (m.role !== "user" && m.role !== "assistant") {
      return {
        ok: false,
        error: `messages[${i}].role must be 'user' or 'assistant'`,
      };
    }
    if (typeof m.content !== "string" || m.content.length === 0) {
      return {
        ok: false,
        error: `messages[${i}].content must be a non-empty string`,
      };
    }
    if (m.content.length > MAX_CONTENT_CHARS) {
      return {
        ok: false,
        error: `messages[${i}].content exceeds maximum of ${MAX_CONTENT_CHARS} characters`,
      };
    }
    const expectedRole: MarketingMessageRole = i % 2 === 0 ? "user" : "assistant";
    if (m.role !== expectedRole) {
      return {
        ok: false,
        error: `messages[${i}].role expected '${expectedRole}' (alternation user/assistant starting with user)`,
      };
    }
    cleaned.push({ role: m.role, content: m.content });
  }

  if (cleaned[cleaned.length - 1].role !== "user") {
    return {
      ok: false,
      error: "The last message must be from `user` (it's the new question)",
    };
  }

  return { ok: true, value: { sessionId: b.sessionId, messages: cleaned } };
}

// ----- Controller factory + lazy default -----

export interface MarketingChatControllerDeps {
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: MarketingAuditLogger;
  pool?: Pool;
}

export function makeMarketingChatController(
  deps: MarketingChatControllerDeps = {}
) {
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? new MarketingAuditLogger();
  const pool = deps.pool ?? getSharedPool();
  let anthropic: AnthropicClient | null = deps.anthropic ?? null;

  return {
    askMarketing: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const parsed = parseMarketingRequest(req.body);
        if (!parsed.ok || !parsed.value) {
          res.status(400).json({ success: false, error: parsed.error });
          return;
        }

        const { sessionId, messages } = parsed.value;

        // Phase 9 — optional image attached to this turn (paperclip). Only honor
        // a URL recognizably owned by THIS shop; ignore anything else.
        const rawAttached = (req.body as { attachedImageUrl?: unknown })
          ?.attachedImageUrl;
        const attachedImageUrl =
          typeof rawAttached === "string" &&
          rawAttached.includes(`/shops/${shopId}/`)
            ? rawAttached
            : undefined;
        const rawLast = (req.body as { lastImageUrl?: unknown })?.lastImageUrl;
        const lastImageUrl =
          typeof rawLast === "string" && rawLast.includes(`/shops/${shopId}/`)
            ? rawLast
            : undefined;

        // 1. Spend cap (shared budget across all AI surfaces for this shop).
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

        // 2. Daily drafts guard (anti-spam). UTC midnight rollover —
        // scope Q-impl-2 (impl doc §9). Counts persisted AI-origin
        // drafts in the last 24h regardless of status. Doesn't BLOCK
        // the chat — only blocks new drafts via propose_campaign_draft.
        const draftsToday = await countAiDraftsToday(pool, shopId);
        if (draftsToday >= MAX_DRAFTS_PER_DAY) {
          res.status(429).json({
            success: false,
            error: `Daily AI campaign draft limit reached (${MAX_DRAFTS_PER_DAY}). Try again tomorrow or contact RepairCoin support if you need more.`,
            details: { draftsToday, limit: MAX_DRAFTS_PER_DAY },
          });
          return;
        }

        // 3. Build the system prompt — static rules + per-shop context.
        // Both blocks are cache-friendly (≥1024 tokens combined easily).
        const rulesBlock = buildMarketingRulesBlock();
        const shopContext = await buildMarketingShopContext(shopId);
        const contextBlock = buildMarketingShopContextBlock(shopContext);
        // Per-turn, non-cached note when the owner attached an image.
        const systemBlocks: { text: string; cache: boolean }[] = [
          { text: rulesBlock, cache: true },
          { text: contextBlock, cache: true },
          // Non-cached: today's date so campaign timing is judged correctly
          // (don't draft a Black Friday promo in June).
          { text: buildDateContextBlock(), cache: false },
        ];
        if (attachedImageUrl) {
          systemBlocks.push({
            text: `The owner ATTACHED AN IMAGE to their current message (url: ${attachedImageUrl}). For "analyze / what theme fits / what colors" call analyze_brand_assets (defaults to this image). For "edit / add X to this" call propose_image_edit with this url as source_image_url. To use it as an email banner, pass it as propose_campaign_draft's image_url. Don't ask them to re-share it.`,
            cache: false,
          });
        }
        // AI Memory (Phase 5 shared reads): honor the owner's standing instructions
        // in marketing drafts (e.g. "never suggest discounts"). No-op when the flag
        // is off or nothing is saved. Hint = the latest user message.
        const memHint =
          [...messages].reverse().find(
            (m: { role: string; content: unknown }) =>
              m.role === "user" && typeof m.content === "string"
          )?.content as string | undefined;
        const marketingMemBlock = await getAiMemoryService().recallBlock(shopId, memHint);
        if (marketingMemBlock) {
          systemBlocks.push({ text: marketingMemBlock, cache: false });
        }

        // 4. Lazy-construct AnthropicClient.
        if (!anthropic) anthropic = new AnthropicClient();

        const tools = getMarketingTools();
        const loopMessages: ChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const allToolInvocations: MarketingToolInvocationRecord[] = [];
        let cumulative = {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: 0,
        };
        let lastResponse: ClaudeResponse | null = null;
        let errorMessage: string | null = null;
        // Aggregate text across iterations — same fix as InsightsController.
        // Claude often writes prose in the same iteration as
        // suggest_campaign_strategies / propose_campaign_draft and the
        // tool-clear iteration that follows has empty text.
        const responseTexts: string[] = [];

        try {
          for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            const response = await anthropic.complete({
              systemPrompt: systemBlocks,
              messages: loopMessages,
              model: spendCheck.useCheaperModel ? MARKETING_MODEL_CHEAP : MARKETING_MODEL,
              maxTokens: MARKETING_MAX_TOKENS,
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
              const tool = getMarketingToolByName(tu.toolName);
              let dispatchResult;
              if (!tool) {
                dispatchResult = {
                  ok: false as const,
                  tool: tu.toolName,
                  args: tu.input,
                  error: `Unknown tool '${tu.toolName}'`,
                  latencyMs: 0,
                };
              } else {
                dispatchResult = await dispatchMarketingTool(tool, tu.input, {
                  shopId,
                  pool,
                  attachedImageUrl,
                  lastImageUrl,
                });
              }

              allToolInvocations.push({
                tool: dispatchResult.tool,
                args: dispatchResult.args,
                display: dispatchResult.ok
                  ? dispatchResult.result?.display
                  : undefined,
                latencyMs: dispatchResult.latencyMs,
                ...(dispatchResult.ok ? {} : { error: dispatchResult.error }),
              });

              const resultContent = dispatchResult.ok
                ? JSON.stringify(dispatchResult.result?.data ?? {})
                : JSON.stringify({ error: dispatchResult.error });

              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tu.toolUseId,
                content: resultContent,
                is_error: !dispatchResult.ok,
              });
            }
            loopMessages.push({ role: "user", content: toolResultBlocks });
          }
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
          logger.error("MarketingChatController: Claude call failed", err);
        }

        // 5. Audit. ALWAYS — success AND failure.
        await auditLogger.log({
          shopId,
          sessionId,
          requestPayload: { messages },
          responsePayload: lastResponse,
          model: lastResponse?.model ?? MARKETING_MODEL,
          inputTokens: cumulative.inputTokens,
          outputTokens: cumulative.outputTokens,
          cachedInputTokens: cumulative.cachedInputTokens,
          costUsd: cumulative.costUsd,
          toolCalls: allToolInvocations,
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

        const aggregatedReply =
          responseTexts.length > 0
            ? responseTexts.join("\n\n")
            : lastResponse.text;

        const data: MarketingResponseData = {
          reply: aggregatedReply,
          model: lastResponse.model,
          cached: cumulative.cachedInputTokens > 0,
          latencyMs: cumulative.latencyMs,
          toolCalls: allToolInvocations.map((t) => ({
            tool: t.tool,
            args: t.args,
            display: t.display,
          })),
          limitReached: spendCheck.limitReached ?? false,
          budgetUsd: spendCheck.monthlyBudgetUsd,
          spentUsd: spendCheck.currentSpendUsd,
        };
        res.json({ success: true, data });
      } catch (err) {
        logger.error("MarketingChatController.askMarketing top-level error", err);
        res.status(500).json({
          success: false,
          error: "Failed to process marketing chat request",
        });
      }
    },
  };
}

/**
 * Counts AI-originated draft campaigns this shop created in the last
 * 24 hours. The composite index on
 *   (shop_id, created_by_source, created_at DESC)
 * (added in migration 127) keeps this query cheap.
 */
async function countAiDraftsToday(pool: Pool, shopId: string): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM marketing_campaigns
       WHERE shop_id = $1
         AND created_by_source = 'ai_agent'
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [shopId]
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  } catch (err) {
    logger.error("countAiDraftsToday failed", err);
    // Fail-open — don't block legitimate use because the count query had a hiccup.
    return 0;
  }
}

let _defaultController: ReturnType<typeof makeMarketingChatController> | null =
  null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeMarketingChatController();
  }
  return _defaultController;
}

export function askMarketing(req: Request, res: Response): Promise<void> {
  return getDefaults().askMarketing(req, res);
}
