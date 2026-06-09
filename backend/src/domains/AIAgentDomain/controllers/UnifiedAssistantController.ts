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
import { buildDateContextBlock } from "../services/dateContext";
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
import { getDefaultHelpCorpusLoader } from "../services/HelpCorpusLoader";
import { SUPPORT_FALLBACK_COPY } from "../services/HelpPromptBuilder";
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

/**
 * HELP KNOWLEDGE — folded in from the standalone How-To assistant so the
 * unified assistant is the ONE door (the separate Help launcher is retired).
 * The How-To assistant was never tool-based: it's RAG, answering "how do I…"
 * product-usage questions from a ~6K-token corpus injected into the system
 * prompt. We mirror that here as a SEPARATE cached system block (stable across
 * calls → high cache-hit), rather than a tool — no sub-call, no extra round
 * trip, and how-to answers blend inline with the owner's data.
 *
 * Reframed vs the standalone prompt: the standalone Help assistant DECLINES
 * business-data questions and actions (rule 5) — the orchestrator does the
 * opposite (it has the data/action tools), so those decline rules are dropped.
 * What's kept: answer how-to ONLY from the articles, cite *Related:* titles,
 * never invent UI, copy labels verbatim, support-fallback when uncovered.
 */
function buildHelpKnowledgeBlock(corpusBlock: string): string {
  return `# HELP KNOWLEDGE — using the RepairCoin shop dashboard

When the owner asks a HOW-TO / product-usage question — "how do I create a service?", "where do I set my appointment hours?", "how do I configure the AI sales agent?" — answer it from the help articles below. Do NOT reach for a data tool for a "how do I…" question.

Rules for how-to answers (these do NOT apply to data/action turns):
- Answer ONLY from these articles. Never invent UI elements, button labels, settings, fields, or steps that aren't written here. If no article covers it, reply exactly: "${SUPPORT_FALLBACK_COPY}"
- Copy UI labels VERBATIM in bold, exactly as they appear in the article; use numbered steps for procedures.
- End a how-to answer with ONE italic line citing the source article TITLE(s) — the "# How do I X?" heading — e.g. *Related: How do I create a service?* Use titles, never filenames.
- The "--- ARTICLE: <filename> ---" separators are delimiters for you only; never show them to the owner.

The articles are your only source of truth for product-usage questions:

${corpusBlock}`;
}

// Lazy + cached + failure-tolerant: corpus load is filesystem I/O that can
// throw (missing docs/help dir in odd deploys). Help is an enhancement to the
// orchestrator — a load failure must NOT take a turn down, so we memo null and
// the assistant simply runs without the help block.
let _helpBlock: string | null | undefined;
function getHelpKnowledgeBlock(): string | null {
  if (_helpBlock !== undefined) return _helpBlock;
  try {
    _helpBlock = buildHelpKnowledgeBlock(
      getDefaultHelpCorpusLoader().getCorpusBlock()
    );
  } catch (err) {
    logger.warn(
      "UnifiedAssistantController: help corpus unavailable — orchestrator will run without how-to knowledge",
      { error: err instanceof Error ? err.message : String(err) }
    );
    _helpBlock = null;
  }
  return _helpBlock;
}

/** Phase 6 branding — the owner's chosen assistant name (null when unset).
 *  Non-critical: never blocks a turn, so failures fall back to no name. */
async function fetchAssistantName(
  pool: Pool,
  shopId: string
): Promise<string | null> {
  try {
    const r = await pool.query<{ assistant_name: string | null }>(
      `SELECT assistant_name FROM ai_shop_settings WHERE shop_id = $1`,
      [shopId]
    );
    return r.rows[0]?.assistant_name ?? null;
  } catch {
    return null;
  }
}

/**
 * The shop's configured IANA timezone (shop_time_slot_config.timezone, migration
 * 056). Used to greet the owner in their local time of day. Returns null when
 * unset — buildDateContextBlock then stays time-neutral (it also treats the
 * America/New_York default as "unset"; see dateContext.ts).
 */
async function fetchShopTimezone(
  pool: Pool,
  shopId: string
): Promise<string | null> {
  try {
    const r = await pool.query<{ timezone: string | null }>(
      `SELECT timezone FROM shop_time_slot_config WHERE shop_id = $1`,
      [shopId]
    );
    return r.rows[0]?.timezone ?? null;
  } catch {
    return null;
  }
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
  ctx: {
    shopId: string;
    pool: Pool;
    attachedImageUrl?: string;
    lastImageUrl?: string;
  }
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
- INSIGHTS (read) — revenue, customers, repeat-visit health, bookings, services, and inventory / low-stock for a given range. For a BROAD status question ("how are we doing?", "give me a rundown", "morning briefing"), use the one-shot business_briefing tool (it returns revenue trend + top service + lapsed customers & their combined value + low stock + upcoming-booking demand in a single call) instead of chaining the individual metric tools.
- MARKETING — size a customer segment (lookup_audience_count), draft a campaign (propose_campaign_draft), and propose sending a draft (propose_campaign_send). For campaign visuals: generate a branded banner from a description (propose_campaign_image), edit an existing image (propose_image_edit), analyze an attached photo for description/colors/theme ideas (analyze_brand_assets), and list the shop's already-uploaded photos (list_shop_photos — the "storefront" entry is the shop's banner). When the owner attaches an image to their message, you'll be told its url in a separate note — use analyze_brand_assets to look at it or propose_image_edit to modify it; don't ask them to re-share it. A campaign banner is OPTIONAL; never block a draft on it.
- INVENTORY ACTION — propose a purchase order to restock a low / running-out item (propose_purchase_order). Use when the owner says "order more", "restock", or "reorder".

You also have HELP KNOWLEDGE (a section of product help articles, provided separately) for HOW-TO / product-usage questions about operating the dashboard ("how do I create a service?", "where do I set my hours?"). Answer those directly from that knowledge — do NOT call a data tool for a "how do I…" question — and follow its citation rules.

Rules:
- For a BROAD "how are we doing?" / "rundown" / "morning briefing" → call business_briefing ONCE, then deliver it as Information → Recommendation → Action: lead with the standout numbers (revenue trend, top service, lapsed customers + their $ value, low stock, the quietest upcoming day), give ONE concrete recommendation (e.g. a win-back or a campaign to fill the quiet day), then offer to do it. Keep it scannable (short bullets), not a wall of text. Don't also call the individual metric tools for the same question. On a briefing turn your recommendation + offer to act IS the follow-up — do NOT also call suggest_followups (its chips would just restate the recommendation you already made). GREETING: open with "Good morning/afternoon/evening" ONLY if the date context above tells you the owner's local time of day; if it says you don't know the local time, open neutrally ("Here's your briefing" / "Here's where things stand") — never assume it's morning.
- For a SPECIFIC "how did we do?" / single-metric question, default the range to "this_month" unless the owner says otherwise, and use compare:"prior" on revenue_summary so you can report the trend ("revenue up 18%"). Pull the most relevant 1-3 metrics — don't dump every tool.
- For "what am I doing wrong?" / "what's slipping?" / "where are we losing money?" / "why is business down?" → call business_diagnostics ONCE. Report ONLY the metrics it flags as regressed (with their before→after numbers), then offer 2-3 LIKELY causes as hypotheses grounded in those deltas — never invented. If nothing regressed, say so plainly. It's business-level only: if the owner asks about a specific employee/technician's performance, explain that per-staff tracking isn't available yet.
- When the owner reacts with "fix it", "win them back", "send a promo to lapsed customers", or — right after you RECOMMENDED an action — "Do it" / "yes" / "go ahead", GO STRAIGHT to executing THAT recommendation: call lookup_audience_count to size the segment you recommended, THEN propose_campaign_draft (reuse the audience + angle from your own recommendation in this thread — don't re-ask for details). Echo the audience_type / audience_filters from the lookup into the draft. The draft card shows a rough revenue estimate and a Send button the owner taps — you still NEVER send it yourself.
- REUSE what's already in this conversation. Do NOT re-call a tool for a metric, range, or segment you already fetched earlier in the thread — read it from the conversation instead. Only call a tool for data you don't have yet (a new metric, a different range, a not-yet-sized segment). On a "fix it" / win-back turn, go STRAIGHT to lookup_audience_count + propose_campaign_draft — do not re-pull numbers you already reported.
- CAMPAIGN REWARDS: a campaign can give each recipient RCN tokens. ONLY attach one when the owner explicitly asks ("send 25 RCN to lapsed customers", "give them a 10 RCN thank-you") — pass propose_campaign_draft's reward_rcn (RCN per recipient), drawn from the shop's purchased RCN balance. Choose reward_fulfillment: "on_send" issues it immediately (a thank-you to active customers); "on_return" issues it only when the customer comes back within return_window_days — prefer this for WIN-BACK / lapsed audiences, since it only spends on customers who actually return. The draft card shows the cost and the owner confirms before sending; when a reward is set you MAY state the exact amount in the body. NEVER add a reward on your own. If the draft result has reward_unavailable=true, tell the owner campaign rewards aren't enabled for their shop yet (an admin enables them) and that you drafted it without the reward.
- BANNERS are optional and owner-driven — never auto-generate one (it costs money + time). Draft text-only by default. Only add a banner when the owner asks, or when they tap a banner suggestion on the draft card, which arrives as a message like "Use our storefront photo as the banner…" or "Design a banner…". For the storefront case: call list_shop_photos, take the "storefront" url, and re-draft (REUSE the same subject/body) with that image_url — if has_storefront is false, say they haven't set a storefront photo and offer to design one instead. For the design case: call propose_campaign_image with a prompt drawn from the campaign's subject + message.
- You can PROPOSE actions — draft or send a campaign, or order/restock inventory (propose_purchase_order) — but you NEVER execute them yourself. Every proposal renders a card the owner taps to confirm; the tap performs the action, not you. Never claim something was sent or ordered — say it's drafted/proposed and ready for their confirmation.
- FOLLOW-UP CHIPS: when you call suggest_followups, the frontend renders those questions as tappable chips below your reply AUTOMATICALLY — so NEVER also write those same questions as a bulleted/numbered list in your prose (that double-shows them). Write your answer + recommendation in prose; let the chips be the only place the next-step questions appear.
- Ground EVERY number in tool output. Never invent figures. If a tool returns zero or no data, say so plainly.
- ALWAYS respond in English (the shop dashboard is English). If the user's message looks garbled or contains non-English text — e.g. a voice transcription that mis-detected the language — do NOT switch languages or guess; reply in English and ask them to rephrase.
- Be concise — a sentence or two per turn, like a sharp ops manager, not a report.
- FORMAT for a NARROW chat panel. NEVER use markdown tables (pipes \`|\` and \`---\` rows) — they don't render here and spill out as raw symbols. To present multiple items (e.g. an inventory breakdown), use a SHORT bulleted list, ONE item per line: the item name in **bold**, then its key numbers and status inline. Example:
  - **Back Glass** — 1 in stock, reorder at 6 · 🔴 Critical
  - **iPad Screen** — 0 in stock, reorder at 2 · 🔴 Out of stock
  Lead with a one-line summary, then the list, then your recommendation/next step. Keep lines short. Avoid headers (\`#\`) and long paragraphs.`;

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

        // Phase 9 — optional image the owner attached to this turn (paperclip
        // upload). Only honor a URL that is recognizably THIS shop's uploaded
        // asset; anything else is ignored (can't be coerced into reading another
        // shop's image). Passed into the tool context + announced in a per-turn
        // system block so the assistant knows to analyze / edit it.
        const rawAttached = (req.body as { attachedImageUrl?: unknown })
          ?.attachedImageUrl;
        const attachedImageUrl =
          typeof rawAttached === "string" &&
          rawAttached.includes(`/shops/${shopId}/`)
            ? rawAttached
            : undefined;
        // The image currently shown in the panel — "edit this" targets it (and
        // inherits its size). Shop-owned only.
        const rawLast = (req.body as { lastImageUrl?: unknown })?.lastImageUrl;
        const lastImageUrl =
          typeof rawLast === "string" && rawLast.includes(`/shops/${shopId}/`)
            ? rawLast
            : undefined;

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
        // System prompt is assembled as ordered blocks, cache-stable prefix
        // first so the prompt cache stays warm:
        //   1. main rules         (cache: true — stable)
        //   2. help knowledge     (cache: true — stable; folded-in How-To corpus)
        //   3. branding name      (cache: false — varies per shop, kept LAST)
        const helpBlock = getHelpKnowledgeBlock();
        const [assistantName, shopTimezone] = await Promise.all([
          fetchAssistantName(pool, shopId),
          fetchShopTimezone(pool, shopId),
        ]);
        const systemPrompt: { text: string; cache: boolean }[] = [
          { text: ORCHESTRATE_SYSTEM_PROMPT, cache: true },
        ];
        if (helpBlock) systemPrompt.push({ text: helpBlock, cache: true });
        // Non-cached: today's date (so the assistant can judge campaign timing —
        // don't propose a Black Friday promo in June) PLUS the owner's local time
        // of day when their timezone is configured (so it greets correctly
        // instead of always saying "morning"). Stays neutral when unset.
        systemPrompt.push({
          text: buildDateContextBlock({ timezone: shopTimezone }),
          cache: false,
        });
        // Brand name defaults to "FixFlow"; a per-shop custom name (if any) still
        // overrides it (the rename UI is hidden, but the setting is preserved).
        const effectiveName = assistantName?.trim() || "FixFlow";
        systemPrompt.push({
          text: `Your name is "${effectiveName}" — use it when you refer to yourself.`,
          cache: false,
        });
        if (attachedImageUrl) {
          // Per-turn, non-cached: tells the assistant an image rode in with this
          // message so it picks the right image tool instead of asking for a URL.
          systemPrompt.push({
            text: `The owner ATTACHED AN IMAGE to their current message (url: ${attachedImageUrl}). If they ask to analyze / critique / "what theme fits" / extract colors, call analyze_brand_assets (it defaults to this image). If they ask to edit / modify / "add X to this", call propose_image_edit with this url as source_image_url. If they ask to use it as an email banner, pass it as propose_campaign_draft's image_url. Don't ask them to re-share the image — you already have it.`,
            cache: false,
          });
        }
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
            systemPrompt,
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
              attachedImageUrl,
              lastImageUrl,
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
