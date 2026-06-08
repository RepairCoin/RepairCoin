// backend/src/domains/AIAgentDomain/controllers/InsightsController.ts
//
// POST /api/ai/insights — multi-turn Business-Data Insights assistant
// for shop owners. The "Ask about your business" half of Square AI.
//
// Request:  { sessionId: string, messages: [{ role, content }, ...] }
// Response: { success: true, data: {
//              reply, model, cached, latencyMs,
//              toolCalls: [{ tool, display? }, ...]
//            } }
//        |  { success: false, error: string }
//
// Phase 3.2 (this file): factory + lazy-default pattern (mirrors
// HelpAssistantController), pure parseInsightsRequest validator, types
// + dep shape. The handler itself is a 501 stub; Phase 3.3 wires the
// pipeline (auth → validate → spend cap → Claude w/ tools loop → audit
// → return).
//
// Constants for message shape are duplicated from HelpAssistantController
// (MAX_MESSAGES, MAX_CONTENT_CHARS, MAX_SESSION_ID_CHARS) — matches the
// SettingsController / MetricsController pattern of preferring small
// duplication for module-boundary preservation.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";
import { AnthropicClient } from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import { InsightsAuditLogger } from "../services/InsightsAuditLogger";
import { buildInsightsSystemPrompt } from "../services/InsightsPromptBuilder";
import { buildDateContextBlock } from "../services/dateContext";
import {
  getInsightsTools,
  getInsightsToolByName,
} from "../services/insights/registry";
import { dispatchTool } from "../services/insights/dispatcher";
import {
  ToolDisplay,
  ToolInvocationRecord,
} from "../services/insights/types";
import {
  ChatMessage,
  ChatMessageContentBlock,
  ClaudeModel,
  ClaudeResponse,
} from "../types";

export type InsightsMessageRole = "user" | "assistant";

export interface InsightsMessage {
  role: InsightsMessageRole;
  content: string;
}

export interface InsightsRequestBody {
  sessionId: string;
  messages: InsightsMessage[];
}

/**
 * One tool call's surfaceable summary returned to the frontend. The
 * frontend renders one data card per entry directly under the assistant
 * bubble using the `display` hint. Phase 3.3 populates this array from
 * dispatcher results; Phase 4 renders it.
 *
 * `args` is surfaced (Phase 4.5) so the panel can extract the active
 * `range` for the range-chip display. Safe to expose — tool args are
 * always enum/literal values (range / by / limit / compare), never
 * Claude-supplied user PII or free text.
 */
export interface InsightsToolCallSummary {
  tool: string;
  args: Record<string, unknown>;
  display?: ToolDisplay;
}

export interface InsightsResponseData {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: InsightsToolCallSummary[];
}

// ----- Validation bounds -----
//
// MAX_CONTENT_CHARS + MAX_SESSION_ID_CHARS match HelpAssistantController.
// MAX_MESSAGES = 30 (vs Help's 20) — insights conversations are
// drill-down/analytics in nature (compare ranges, switch metrics,
// ask about specific customers/services), so 15 user-exchanges
// gives natural-feeling headroom. Per-session cost is still bounded
// by SpendCapEnforcer.canSpend (monthly per-shop budget).

export const MAX_MESSAGES = 30;
export const MAX_CONTENT_CHARS = 4000;
export const MAX_SESSION_ID_CHARS = 64;

// ----- Agent-loop constants -----

// Sonnet per scope-doc decision I — tool-use + structured reasoning
// benefits from the stronger model; corpus-only Q&A doesn't apply.
const INSIGHTS_MODEL: ClaudeModel = "claude-sonnet-4-6";
const INSIGHTS_MAX_TOKENS = 1024;

// Safety cap on the tool-use agent loop. The prompt tells Claude one
// tool is usually enough; 5 iterations leaves headroom for legitimate
// "show me revenue AND top customers AND bookings breakdown" requests
// without letting a misbehaving model loop forever and run up cost.
const MAX_TOOL_ITERATIONS = 5;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: InsightsRequestBody;
}

/**
 * Pure validator — exported for unit testing.
 *
 * Enforces strict user→assistant→user alternation starting with `user`
 * (so array length is odd and the last message is from `user` — the
 * new question). Anthropic's API requires this shape; failing at our
 * edge with a clear error beats letting Claude reject the request.
 */
export function parseInsightsRequest(body: unknown): ValidationResult {
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

  const cleaned: InsightsMessage[] = [];
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
    const expectedRole: InsightsMessageRole = i % 2 === 0 ? "user" : "assistant";
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

export interface InsightsControllerDeps {
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: InsightsAuditLogger;
  /**
   * Pool handed to each tool's `execute(args, { shopId, pool })`. Same
   * shared default as the rest of the domain; injectable for tests.
   */
  pool?: Pool;
}

export function makeInsightsController(deps: InsightsControllerDeps = {}) {
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? new InsightsAuditLogger();
  const pool = deps.pool ?? getSharedPool();
  // AnthropicClient throws if ANTHROPIC_API_KEY is unset. Defer
  // construction to first request so import-time doesn't fail in
  // tests/migrations that don't exercise this path.
  let anthropic: AnthropicClient | null = deps.anthropic ?? null;

  return {
    askInsights: async (req: Request, res: Response): Promise<void> => {
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

        // 1. Spend-cap pre-flight (shared budget with AI Sales Agent + Help).
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

        // 2. Stable system prompt — cache-friendly across requests.
        const systemPromptText = buildInsightsSystemPrompt();

        // 3. Lazy-construct AnthropicClient on first request so import-time
        // doesn't fail in tests / migrations that don't exercise this path.
        if (!anthropic) anthropic = new AnthropicClient();

        // 4-6. Agent loop. Each iteration: call Claude, dispatch any
        // tool_use blocks, append their tool_result back into messages,
        // repeat until Claude returns a response with no tool_use blocks
        // (= it's written its final prose). Hard cap at MAX_TOOL_ITERATIONS
        // so a misbehaving model can't burn the spend cap by looping.
        const tools = getInsightsTools();
        const loopMessages: ChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const allToolInvocations: ToolInvocationRecord[] = [];
        let cumulative = {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          costUsd: 0,
          latencyMs: 0,
        };
        let lastResponse: ClaudeResponse | null = null;
        let errorMessage: string | null = null;
        // Capture text from every iteration of the agent loop, not just
        // the last one. Claude typically writes its prose summary in the
        // SAME iteration as the `suggest_followups` tool_use (per prompt
        // rule #11 "after answering, call suggest_followups"). The
        // iteration that breaks the loop (no tool_use blocks) often has
        // empty or trivial text because Claude has nothing left to say
        // after suggest_followups. Using only `lastResponse.text` would
        // silently drop the actual prose. Join all non-empty text
        // chunks from every iteration so we surface whichever
        // iteration Claude wrote in.
        const responseTexts: string[] = [];

        try {
          for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            const response = await anthropic.complete({
              systemPrompt: [
                { text: systemPromptText, cache: true },
                // Non-cached: today's date for time-sensitive reasoning.
                { text: buildDateContextBlock(), cache: false },
              ],
              messages: loopMessages,
              model: INSIGHTS_MODEL,
              maxTokens: INSIGHTS_MAX_TOKENS,
              tools,
              toolChoice: { type: "auto" },
            });

            cumulative.inputTokens += response.usage.inputTokens;
            cumulative.outputTokens += response.usage.outputTokens;
            cumulative.cachedInputTokens +=
              response.usage.cacheReadInputTokens;
            cumulative.costUsd += response.costUsd;
            cumulative.latencyMs += response.latencyMs;
            lastResponse = response;

            if (response.text && response.text.trim().length > 0) {
              responseTexts.push(response.text);
            }

            // No tool calls → Claude wrote prose → we're done.
            if (response.toolUses.length === 0) break;

            // Append Claude's assistant message (text + tool_use blocks)
            // verbatim — Anthropic requires the assistant turn to be
            // echoed back so it can correlate tool_use_id ↔ tool_result.
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

            // Dispatch each tool the model picked. Tools never throw
            // (dispatcher wraps), so this loop never aborts mid-batch.
            const toolResultBlocks: ChatMessageContentBlock[] = [];
            for (const tu of response.toolUses) {
              const tool = getInsightsToolByName(tu.toolName);
              let dispatchResult;
              if (!tool) {
                // Claude hallucinated a tool name. Surface non-throwing
                // and let the model phrase the failure honestly.
                dispatchResult = {
                  ok: false as const,
                  tool: tu.toolName,
                  args: tu.input,
                  error: `Unknown tool '${tu.toolName}'`,
                  latencyMs: 0,
                };
              } else {
                dispatchResult = await dispatchTool(tool, tu.input, {
                  shopId,
                  pool,
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

              // Tool result content must be a string per the Anthropic
              // tool-use spec. Stringify the structured data; Claude
              // parses it back implicitly when phrasing its reply.
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
          logger.error("InsightsController: Claude call failed", err);
        }

        // 7. Audit. ALWAYS — success AND failure. Cumulative across
        // every iteration of the loop. tool_calls captures the full
        // sequence so future debugging can reconstruct what happened.
        await auditLogger.log({
          shopId,
          sessionId,
          requestPayload: { messages },
          responsePayload: lastResponse,
          model: lastResponse?.model ?? INSIGHTS_MODEL,
          inputTokens: cumulative.inputTokens,
          outputTokens: cumulative.outputTokens,
          cachedInputTokens: cumulative.cachedInputTokens,
          costUsd: cumulative.costUsd,
          toolCalls: allToolInvocations,
          latencyMs: cumulative.latencyMs || null,
          errorMessage,
        });

        // 8. 503 on Claude failure — after the audit row is safely written.
        if (!lastResponse) {
          res.status(503).json({
            success: false,
            error: "AI service temporarily unavailable. Please try again.",
          });
          return;
        }

        // 9. Record spend (post-call, post-audit; non-throwing).
        await spendCap.recordSpend(shopId, cumulative.costUsd);

        // 10. Final response. `toolCalls` is the slim per-card payload
        // the Phase 4 frontend renders directly under the assistant bubble.
        // `reply` is the joined text from EVERY iteration of the agent
        // loop, not just the last — Claude typically writes its prose
        // in the same iteration as `suggest_followups`, and the loop
        // runs one more iteration past that to clear the tool. Joining
        // with a blank line preserves any natural paragraph break Claude
        // emitted; fallback to lastResponse.text only when every
        // iteration emitted empty text (rare — usually means the model
        // declined or errored).
        const aggregatedReply =
          responseTexts.length > 0
            ? responseTexts.join("\n\n")
            : lastResponse.text;
        const data: InsightsResponseData = {
          reply: aggregatedReply,
          model: lastResponse.model,
          cached: cumulative.cachedInputTokens > 0,
          latencyMs: cumulative.latencyMs,
          toolCalls: allToolInvocations.map((t) => ({
            tool: t.tool,
            args: t.args,
            display: t.display,
          })),
        };
        res.json({ success: true, data });
      } catch (err) {
        logger.error("InsightsController.askInsights top-level error", err);
        res.status(500).json({
          success: false,
          error: "Failed to process insights request",
        });
      }
    },
  };
}

let _defaultController: ReturnType<typeof makeInsightsController> | null = null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeInsightsController();
  }
  return _defaultController;
}

export function askInsights(req: Request, res: Response): Promise<void> {
  return getDefaults().askInsights(req, res);
}
