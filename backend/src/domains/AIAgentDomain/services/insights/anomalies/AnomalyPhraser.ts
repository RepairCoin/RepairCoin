// backend/src/domains/AIAgentDomain/services/insights/anomalies/AnomalyPhraser.ts
//
// Phase 7.2.7-7.2.11 — one-shot Sonnet call per flagged anomaly that
// produces (a) a natural-language one-sentence summary and (b) a
// "Tell me more" follow-up question the shop owner can tap to
// investigate.
//
// Pattern B from scope §4 — Claude doesn't decide WHAT'S anomalous
// (that's the detector's job); Claude only phrases what the detector
// already flagged. Bounds cost: one short call per flagged anomaly,
// not per metric scan.
//
// Fail-safe: if spend cap is exhausted OR the Claude call errors, we
// fall back to a deterministic template phrase ("No-shows this week:
// 12 vs 3 last week, +300%") and leave `claude_phrasing` /
// `follow_up_question` NULL in the DB. The banner UI distinguishes
// templated vs Claude-phrased entries.

import { Pool } from "pg";
import { logger } from "../../../../../utils/logger";
import { getSharedPool } from "../../../../../utils/database-pool";
import { smartModel } from "../../../../../config/aiModels";
import { AnthropicClient } from "../../AnthropicClient";
import { SpendCapEnforcer } from "../../SpendCapEnforcer";
import { insightsAuditLogger, InsightsAuditLogger } from "../../InsightsAuditLogger";
import { getMetricByKey } from "./metrics";
import { MetricKey, Severity } from "./types";

/**
 * Input shape — what the scheduler hands to the phraser after the
 * detector has flagged a row. Matches the column set in the SELECT
 * the scheduler runs against `ai_insights_anomalies WHERE
 * claude_phrasing IS NULL`.
 */
export interface UnphrasedAnomaly {
  id: string;
  shopId: string;
  metricKey: MetricKey;
  currentValue: number;
  priorValue: number;
  deltaPct: number | null;
  severity: Severity;
}

/**
 * Claude's structured output. We ask for JSON so parsing is
 * deterministic — no scraping prose for headline + question.
 */
interface PhrasingResult {
  phrasing: string;
  followUp: string;
}

export interface AnomalyPhraserDeps {
  pool?: Pool;
  anthropic?: AnthropicClient;
  spendCap?: SpendCapEnforcer;
  auditLogger?: InsightsAuditLogger;
}

export class AnomalyPhraser {
  private readonly pool: Pool;
  private readonly anthropic: AnthropicClient | null;
  private readonly spendCap: SpendCapEnforcer;
  private readonly auditLogger: InsightsAuditLogger;
  private resolvedAnthropic: AnthropicClient | null = null;

  constructor(deps: AnomalyPhraserDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.anthropic = deps.anthropic ?? null;
    this.spendCap = deps.spendCap ?? new SpendCapEnforcer();
    this.auditLogger = deps.auditLogger ?? insightsAuditLogger;
  }

  /**
   * Phrase one anomaly. Updates the row in-place with `claude_phrasing`
   * + `follow_up_question`. Returns true on success, false when the
   * row stayed NULL (spend cap or Claude failure).
   *
   * Never throws — phrasing failures are logged + swallowed. The row
   * still surfaces in the banner with the template fallback phrase.
   */
  async phraseAnomaly(a: UnphrasedAnomaly): Promise<boolean> {
    const metric = getMetricByKey(a.metricKey);
    if (!metric) {
      logger.warn(`AnomalyPhraser: unknown metric_key '${a.metricKey}'`);
      return false;
    }

    // Spend-cap gate — shared monthly budget. Skip phrasing entirely
    // if exhausted; the banner falls back to template.
    const spendCheck = await this.spendCap.canSpend(a.shopId);
    if (!spendCheck.allowed) {
      logger.info(
        `AnomalyPhraser: skipping phrasing — spend cap exhausted for ${a.shopId}`
      );
      return false;
    }

    const anthropic = this.lazyAnthropic();
    if (!anthropic) return false;

    const systemPrompt = `You phrase business-data anomalies for a shop owner. Output strict JSON: {"phrasing": "...", "followUp": "..."}. Phrasing is ONE short natural-language sentence the owner can scan in 2 seconds. followUp is ONE short question (≤80 chars) the owner might tap to investigate the anomaly, phrased the way they'd type it.`;

    const userMessage = buildUserPrompt(metric.label, metric.upIsGood, a);

    try {
      const response = await anthropic.complete({
        systemPrompt: [{ text: systemPrompt, cache: true }],
        messages: [{ role: "user", content: userMessage }],
        model: smartModel(),
        maxTokens: 300,
      });

      const parsed = parsePhrasingResult(response.text);
      if (!parsed) {
        logger.warn(
          `AnomalyPhraser: failed to parse JSON for anomaly ${a.id}`,
          { text: response.text.slice(0, 200) }
        );
        return false;
      }

      await this.persistPhrasing(a.id, parsed);

      // Audit-log the call so cost analysis can isolate anomaly spend
      // via `request_payload.source = 'anomaly_phrasing'`.
      await this.auditLogger.log({
        shopId: a.shopId,
        sessionId: `anomaly-${a.id}`,
        requestPayload: {
          source: "anomaly_phrasing",
          anomalyId: a.id,
          metricKey: a.metricKey,
          messages: [{ role: "user", content: userMessage }],
        },
        responsePayload: response,
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cachedInputTokens: response.usage.cacheReadInputTokens,
        costUsd: response.costUsd,
        toolCalls: [],
        latencyMs: response.latencyMs,
        errorMessage: null,
      });

      // Record spend AFTER successful audit — same ordering as the
      // main insights controller.
      await this.spendCap.recordSpend(a.shopId, response.costUsd);

      return true;
    } catch (err) {
      logger.error(`AnomalyPhraser: Claude call failed for anomaly ${a.id}`, err);
      // Audit the failure too so we can count it.
      await this.auditLogger.log({
        shopId: a.shopId,
        sessionId: `anomaly-${a.id}`,
        requestPayload: {
          source: "anomaly_phrasing",
          anomalyId: a.id,
          metricKey: a.metricKey,
        },
        responsePayload: null,
        model: smartModel(),
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        costUsd: 0,
        toolCalls: [],
        latencyMs: null,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Walk every anomaly row missing phrasing and phrase it. Used by
   * the nightly scheduler after AnomalyDetector finishes inserting.
   * Per-row failures don't sink the rest.
   */
  async phraseAllPending(): Promise<{ phrased: number; skipped: number }> {
    const rows = await this.pool.query<UnphrasedAnomaly>(
      `SELECT id, shop_id AS "shopId", metric_key AS "metricKey",
              current_value::float AS "currentValue",
              prior_value::float AS "priorValue",
              delta_pct::float AS "deltaPct",
              severity
       FROM ai_insights_anomalies
       WHERE claude_phrasing IS NULL
         AND dismissed_at IS NULL
         AND expires_at > NOW()`
    );

    let phrased = 0;
    let skipped = 0;
    for (const r of rows.rows) {
      const ok = await this.phraseAnomaly(r);
      if (ok) phrased++;
      else skipped++;
    }
    return { phrased, skipped };
  }

  private async persistPhrasing(
    anomalyId: string,
    p: PhrasingResult
  ): Promise<void> {
    await this.pool.query(
      `UPDATE ai_insights_anomalies
       SET claude_phrasing = $1, follow_up_question = $2
       WHERE id = $3`,
      [p.phrasing.trim(), p.followUp.trim(), anomalyId]
    );
  }

  /** AnthropicClient throws on missing API key — defer construction. */
  private lazyAnthropic(): AnthropicClient | null {
    if (this.anthropic) return this.anthropic;
    if (this.resolvedAnthropic) return this.resolvedAnthropic;
    try {
      this.resolvedAnthropic = new AnthropicClient();
      return this.resolvedAnthropic;
    } catch (err) {
      logger.error("AnomalyPhraser: cannot construct AnthropicClient", err);
      return null;
    }
  }
}

// ---------- prompt + parsing helpers ----------

function buildUserPrompt(
  metricLabel: string,
  upIsGood: boolean,
  a: UnphrasedAnomaly
): string {
  const direction = a.currentValue > a.priorValue ? "up" : "down";
  const sentiment =
    (a.currentValue > a.priorValue) === upIsGood ? "good news" : "bad news";
  const deltaPctText =
    a.deltaPct === null
      ? "no prior baseline"
      : `${a.deltaPct >= 0 ? "+" : ""}${a.deltaPct.toFixed(1)}%`;
  return `Anomaly:
- metric: ${metricLabel}
- this week: ${a.currentValue}
- last week: ${a.priorValue}
- delta: ${deltaPctText}, ${direction} (${sentiment} for the shop owner)
- severity: ${a.severity}

Write ONE short sentence the shop owner can scan in 2 seconds. Then suggest ONE short follow-up question (≤80 chars) the owner might tap to investigate. Output strict JSON: {"phrasing": "...", "followUp": "..."}`;
}

/**
 * Strict JSON parse with a fallback for Claude wrapping the JSON in
 * markdown fences. Returns null on failure — caller handles.
 */
function parsePhrasingResult(text: string): PhrasingResult | null {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.phrasing === "string" &&
      typeof parsed.followUp === "string" &&
      parsed.phrasing.length > 0 &&
      parsed.followUp.length > 0
    ) {
      return { phrasing: parsed.phrasing, followUp: parsed.followUp };
    }
    return null;
  } catch {
    return null;
  }
}
