// backend/src/domains/AIAgentDomain/controllers/HelpAssistantController.ts
//
// POST /api/ai/help — multi-turn how-to assistant for shop owners.
//
// Request:  { sessionId: string, messages: [{ role, content }, ...] }
// Response: { success: true, data: { reply, model, cached, latencyMs } }
//        |  { success: false, error: string }
//
// Flow:
//   1. Validate (auth, request shape, message alternation, length caps).
//   2. SpendCapEnforcer.canSpend(shopId) — 429 if monthly budget exhausted.
//      Shares the AI Sales Agent cap per scope-doc Section 3.5.
//   3. Load corpus block (lazy HelpCorpusLoader singleton) and build the
//      cache-friendly system prompt via buildHelpSystemPrompt.
//   4. Call Anthropic Haiku, with cache_control: ephemeral on the
//      stable system prompt block.
//   5. Audit-log one row to ai_help_messages (success OR failure).
//   6. Record spend.
//   7. Return { reply, model, cached, latencyMs }.
//
// Factory + lazy-default singleton mirrors SettingsController +
// MetricsController. Tests inject mocks via the deps shape.

import { Request, Response } from "express";
import { logger } from "../../../utils/logger";
import {
  AnthropicClient,
} from "../services/AnthropicClient";
import { SpendCapEnforcer } from "../services/SpendCapEnforcer";
import {
  HelpCorpusLoader,
  getDefaultHelpCorpusLoader,
} from "../services/HelpCorpusLoader";
import { buildHelpSystemPrompt } from "../services/HelpPromptBuilder";
import { HelpAuditLogger } from "../services/HelpAuditLogger";
import { ClaudeModel, ClaudeResponse } from "../types";
import { cheapModel } from "../../../config/aiModels";

export type HelpMessageRole = "user" | "assistant";

export interface HelpMessage {
  role: HelpMessageRole;
  content: string;
}

export interface HelpRequestBody {
  sessionId: string;
  messages: HelpMessage[];
}

export interface HelpResponseData {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
}

// ----- Validation bounds -----

export const MAX_MESSAGES = 20;
export const MAX_CONTENT_CHARS = 4000;
export const MAX_SESSION_ID_CHARS = 64;

// Help assistant always uses Haiku — cheap, grounded factual lookups.
// Per scope decision the spend cap is shared with the AI Sales Agent;
// switching to Sonnet would burn that cap fast with no quality win on
// corpus-only Q&A.
const HELP_MODEL: ClaudeModel = cheapModel();
const HELP_MAX_TOKENS = 1024;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: HelpRequestBody;
}

/**
 * Pure validator — exported for unit testing.
 *
 * Enforces strict user→assistant→user alternation starting with `user`
 * (so the array length is odd and the last message is always from
 * `user` — the new question). Anthropic's API requires this shape; we
 * fail at our edge with a clear error rather than letting Claude
 * reject the request.
 */
export function parseHelpRequest(body: unknown): ValidationResult {
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

  const cleaned: HelpMessage[] = [];
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
    const expectedRole: HelpMessageRole = i % 2 === 0 ? "user" : "assistant";
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

export interface HelpAssistantControllerDeps {
  corpusLoader?: HelpCorpusLoader;
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: HelpAuditLogger;
}

export function makeHelpAssistantController(
  deps: HelpAssistantControllerDeps = {}
) {
  const corpusLoader = deps.corpusLoader ?? getDefaultHelpCorpusLoader();
  const spendCap = deps.spendCap ?? new SpendCapEnforcer();
  const auditLogger = deps.auditLogger ?? new HelpAuditLogger();
  // AnthropicClient throws if ANTHROPIC_API_KEY is unset. Defer construction
  // to first request so tests/migrations don't hit that path on import.
  let anthropic: AnthropicClient | null = deps.anthropic ?? null;

  return {
    askHelp: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }

        const parsed = parseHelpRequest(req.body);
        if (!parsed.ok || !parsed.value) {
          res.status(400).json({ success: false, error: parsed.error });
          return;
        }
        const { sessionId, messages } = parsed.value;

        // 1. Spend-cap pre-flight (shared budget with AI Sales Agent).
        const spendCheck = await spendCap.canSpend(shopId);
        if (!spendCheck.allowed) {
          res.status(429).json({
            success: false,
            error: "AI budget for this month is exhausted. Try again next month or contact RepairCoin support.",
            details: {
              currentSpendUsd: spendCheck.currentSpendUsd,
              monthlyBudgetUsd: spendCheck.monthlyBudgetUsd,
              blockReason: spendCheck.blockReason,
            },
          });
          return;
        }

        // 2. System prompt — stable across calls, marked for prompt cache.
        const systemPromptText = buildHelpSystemPrompt(
          corpusLoader.getCorpusBlock()
        );

        // 3. Claude call. Lazy-construct AnthropicClient on first use so
        // import-time errors don't bubble into unrelated tests/scripts.
        if (!anthropic) anthropic = new AnthropicClient();

        let claudeResponse: ClaudeResponse | null = null;
        let errorMessage: string | null = null;
        try {
          claudeResponse = await anthropic.complete({
            systemPrompt: [{ text: systemPromptText, cache: true }],
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            model: HELP_MODEL,
            maxTokens: HELP_MAX_TOKENS,
          });
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
          logger.error("HelpAssistantController: Claude call failed", err);
        }

        // 4. Audit. Always — success AND failure. The audit row is the
        // system of record for cost / debugging / abuse review.
        await auditLogger.log({
          shopId,
          sessionId,
          requestPayload: { messages },
          responsePayload: claudeResponse,
          model: claudeResponse?.model ?? HELP_MODEL,
          inputTokens: claudeResponse?.usage.inputTokens ?? 0,
          outputTokens: claudeResponse?.usage.outputTokens ?? 0,
          cachedInputTokens: claudeResponse?.usage.cacheReadInputTokens ?? 0,
          costUsd: claudeResponse?.costUsd ?? 0,
          latencyMs: claudeResponse?.latencyMs ?? null,
          errorMessage,
        });

        // 5. If the call failed, return 503 to the client AFTER the audit
        // row was written, so we still have a record of the failure.
        if (!claudeResponse) {
          res.status(503).json({
            success: false,
            error: "AI service temporarily unavailable. Please try again.",
          });
          return;
        }

        // 6. Record spend (post-call, post-audit; non-throwing).
        await spendCap.recordSpend(shopId, claudeResponse.costUsd);

        // 7. Return shape the frontend (Phase 3) consumes.
        const data: HelpResponseData = {
          reply: claudeResponse.text,
          model: claudeResponse.model,
          cached: claudeResponse.usage.cacheReadInputTokens > 0,
          latencyMs: claudeResponse.latencyMs,
        };
        res.json({ success: true, data });
      } catch (err) {
        logger.error("HelpAssistantController.askHelp top-level error", err);
        res.status(500).json({
          success: false,
          error: "Failed to process help request",
        });
      }
    },
  };
}

let _defaultController: ReturnType<typeof makeHelpAssistantController> | null =
  null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeHelpAssistantController();
  }
  return _defaultController;
}

export function askHelp(req: Request, res: Response): Promise<void> {
  return getDefaults().askHelp(req, res);
}
