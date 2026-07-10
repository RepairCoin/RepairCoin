// backend/src/domains/AIAgentDomain/services/platform/executiveBriefing.ts
//
// Daily Executive Briefing (Platform Health Copilot, Phase 3).
// Gathers platform metrics via the existing platform tools, has Claude (Haiku)
// write a short "what needs attention" digest, and caches it for the day so it
// costs one AI call per day regardless of how many admins open it.
//
// On-demand + in-memory cached → no new DB table / migration required.

import { Pool } from "pg";
import { getSharedPool } from "../../../../utils/database-pool";
import { logger } from "../../../../utils/logger";
import { AnthropicClient } from "../AnthropicClient";
import { getPlatformToolByName } from "./platformTools";

const PLATFORM_SCOPE = "__platform__";

export interface ExecutiveBriefing {
  generatedAt: string; // ISO
  briefing: string; // markdown digest
  data: Record<string, unknown>; // raw metrics behind it
}

let cache: { dayKey: string; value: ExecutiveBriefing } | null = null;
let anthropic: AnthropicClient | null = null;
let anthropicTried = false;

function dayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getAnthropic(): AnthropicClient | null {
  if (anthropicTried) return anthropic;
  anthropicTried = true;
  try {
    anthropic = new AnthropicClient();
  } catch {
    anthropic = null;
  }
  return anthropic;
}

/** Run a platform tool by name and return its `data` (or {} on failure). */
async function runTool(
  name: string,
  args: Record<string, unknown>,
  pool: Pool
): Promise<Record<string, unknown>> {
  const tool = getPlatformToolByName(name);
  if (!tool) return {};
  try {
    const res = await tool.execute(args, { shopId: PLATFORM_SCOPE, pool });
    return res.data ?? {};
  } catch (err) {
    logger.warn(`Executive briefing: tool ${name} failed`, err);
    return {};
  }
}

/**
 * Get today's executive briefing (cached). Pass force=true to regenerate.
 */
export async function getExecutiveBriefing(
  force = false,
  pool: Pool = getSharedPool(),
  now: Date = new Date()
): Promise<ExecutiveBriefing> {
  const today = dayKeyUTC(now);
  if (!force && cache && cache.dayKey === today) {
    return cache.value;
  }

  // Gather metrics from the platform tools (reuse their verified queries).
  const [overview, tokenEcon, subs, churn, topShops, signups] = await Promise.all([
    runTool("platform_overview", {}, pool),
    runTool("token_economy", { range: "30d" }, pool),
    runTool("subscription_health", {}, pool),
    runTool("shop_churn_risk", { days: 30, limit: 5 }, pool),
    runTool("top_shops", { range: "30d", limit: 5 }, pool),
    runTool("new_signups", { range: "30d" }, pool),
  ]);

  const data = { overview, tokenEconomy: tokenEcon, subscriptionHealth: subs, churnRisk: churn, topShops, newSignups: signups };

  const briefing = await phraseBriefing(data, now);
  const value: ExecutiveBriefing = {
    generatedAt: now.toISOString(),
    briefing,
    data,
  };
  cache = { dayKey: today, value };
  return value;
}

async function phraseBriefing(
  data: Record<string, unknown>,
  now: Date
): Promise<string> {
  const ai = getAnthropic();
  if (!ai) return templatedBriefing(data, now);

  const systemPrompt =
    "You write a daily executive briefing for a RepairCoin platform admin. " +
    "Given JSON metrics, produce a SHORT markdown digest: a one-line headline, " +
    "then 3-5 bullets covering growth, token economy, subscription/churn health, " +
    "and anything that needs attention. Be concrete with numbers. No preamble, no " +
    "closing remarks. Max ~150 words.";
  try {
    const res = await ai.complete({
      systemPrompt: [{ text: systemPrompt, cache: false }],
      messages: [
        {
          role: "user",
          content: `Date: ${now.toISOString().slice(0, 10)}\nMetrics:\n${JSON.stringify(data)}`,
        },
      ],
      model: "claude-haiku-4-5-20251001",
      maxTokens: 400,
    });
    const text = (res.text || "").trim();
    return text.length > 0 ? text : templatedBriefing(data, now);
  } catch (err) {
    logger.warn("Executive briefing: AI phrasing failed (using templated)", err);
    return templatedBriefing(data, now);
  }
}

/** Deterministic fallback when AI is unavailable. */
function templatedBriefing(data: Record<string, unknown>, now: Date): string {
  const ov = (data.overview ?? {}) as Record<string, unknown>;
  const su = (data.newSignups ?? {}) as Record<string, unknown>;
  const te = (data.tokenEconomy ?? {}) as Record<string, unknown>;
  const churn = (data.churnRisk ?? {}) as Record<string, unknown>;
  const lines = [
    `**Platform briefing — ${now.toISOString().slice(0, 10)}**`,
    `- Shops: ${ov.activeShops ?? "?"} active of ${ov.totalShops ?? "?"} · Customers: ${ov.customers ?? "?"}`,
    `- New (30d): ${su.newShops ?? "?"} shops, ${su.newCustomers ?? "?"} customers`,
    `- RCN (30d): ${te.issued ?? "?"} issued vs ${te.redeemed ?? "?"} redeemed`,
    `- Churn risk: ${churn.count ?? 0} shops inactive 30d+`,
  ];
  return lines.join("\n");
}
