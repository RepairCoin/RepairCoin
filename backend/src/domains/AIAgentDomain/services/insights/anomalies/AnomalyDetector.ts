// backend/src/domains/AIAgentDomain/services/insights/anomalies/AnomalyDetector.ts
//
// Phase 7.2 — pure-SQL nightly anomaly detection.
//
// For one shop, run every MetricDefinition's compute() to get
// {current, prior} week-over-week values. Classify the delta into a
// severity bucket. Skip the metric entirely when the prior baseline
// is below MIN_SIGNAL (avoids "$0 → $1 = +∞%" noise). Persist each
// flagged anomaly to ai_insights_anomalies.
//
// NO Claude calls in this layer — those happen in AnomalyPhraser
// after detection. Keeping the math and the phrasing separate means:
//   1. The deterministic flag list is auditable on its own.
//   2. Cost is bounded — Claude only sees confirmed anomalies.
//   3. Tuning thresholds doesn't burn AI budget.

import { Pool } from "pg";
import { logger } from "../../../../../utils/logger";
import { getSharedPool } from "../../../../../utils/database-pool";
import { METRIC_DEFINITIONS } from "./metrics";
import {
  AnomalySentiment,
  DetectedAnomaly,
  MetricDefinition,
  Severity,
} from "./types";

/**
 * Severity thresholds — conservative for Phase 7.2 dry-run. Tune after
 * 1 week of production-data flag rates.
 *
 * Both delta-pct AND absolute thresholds are checked — a metric must
 * clear the LOW band's delta-pct AND a metric-specific absolute floor
 * to be flagged at all. Stops 50% deltas on tiny absolute numbers
 * from filling the table.
 */
const SEVERITY_BANDS: Record<Severity, { minDeltaPct: number }> = {
  low: { minDeltaPct: 30 },
  medium: { minDeltaPct: 60 },
  high: { minDeltaPct: 150 },
};

/**
 * Auto-expiry window. Anomalies older than this won't render in the
 * banner. Hardcoded in the SQL too via expires_at default math.
 */
const EXPIRY_DAYS = 14;

export interface AnomalyDetectorDeps {
  pool?: Pool;
  /**
   * Override the production metric set for testing or experimentation.
   * Defaults to METRIC_DEFINITIONS (the 5 Phase 7.2 starter metrics).
   */
  metrics?: MetricDefinition[];
}

export class AnomalyDetector {
  private readonly pool: Pool;
  private readonly metrics: MetricDefinition[];

  constructor(deps: AnomalyDetectorDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.metrics = deps.metrics ?? METRIC_DEFINITIONS;
  }

  /**
   * Run detection for one shop. Returns the list of *newly flagged*
   * anomalies (post-INSERT). Empty array when nothing crossed the
   * thresholds.
   *
   * NEVER throws — per-metric failures are caught + logged. One
   * metric's SQL error shouldn't sink the rest of the run for the
   * same shop, and one shop shouldn't sink the nightly batch.
   */
  async runDetection(shopId: string): Promise<DetectedAnomaly[]> {
    const flagged: DetectedAnomaly[] = [];

    for (const metric of this.metrics) {
      try {
        const detected = await this.detectOne(shopId, metric);
        if (detected) flagged.push(detected);
      } catch (err) {
        logger.error(
          `AnomalyDetector: ${metric.key} compute failed for shop ${shopId}`,
          err
        );
      }
    }

    for (const a of flagged) {
      try {
        await this.persist(shopId, a);
      } catch (err) {
        logger.error(
          `AnomalyDetector: persist failed for ${a.metricKey} (shop ${shopId})`,
          err
        );
      }
    }

    return flagged;
  }

  /**
   * Run detection across every shop with AI enabled. Per-shop
   * failures are logged but don't sink the rest of the run.
   */
  async runForAllShops(): Promise<{
    shopsProcessed: number;
    anomaliesFlagged: number;
    shopErrors: number;
  }> {
    const shops = await this.pool.query<{ shop_id: string }>(
      `SELECT DISTINCT s.shop_id
       FROM shops s
       LEFT JOIN ai_shop_settings ai ON ai.shop_id = s.shop_id
       WHERE COALESCE(ai.ai_global_enabled, true) = true`
    );

    let totalFlagged = 0;
    let shopErrors = 0;
    for (const row of shops.rows) {
      try {
        const flagged = await this.runDetection(row.shop_id);
        totalFlagged += flagged.length;
      } catch (err) {
        shopErrors++;
        logger.error(
          `AnomalyDetector: shop ${row.shop_id} run failed`,
          err
        );
      }
    }

    logger.info("AnomalyDetector: nightly run complete", {
      shopsProcessed: shops.rows.length,
      anomaliesFlagged: totalFlagged,
      shopErrors,
    });

    return {
      shopsProcessed: shops.rows.length,
      anomaliesFlagged: totalFlagged,
      shopErrors,
    };
  }

  /**
   * Detect a single metric. Returns null when the metric doesn't
   * cross thresholds (most of the time, by design).
   */
  private async detectOne(
    shopId: string,
    metric: MetricDefinition
  ): Promise<DetectedAnomaly | null> {
    const { current, prior } = await metric.compute(this.pool, shopId);

    // Noise floor — skip if the prior week was tiny. Without this,
    // "$5 → $50" would flag every week for low-volume shops.
    if (prior < metric.minPriorSignal) return null;

    const deltaValue = current - prior;
    const deltaPct =
      prior === 0 ? null : ((current - prior) / prior) * 100;

    if (deltaPct === null) return null; // belt-and-suspenders.

    const absDeltaPct = Math.abs(deltaPct);
    if (absDeltaPct < SEVERITY_BANDS.low.minDeltaPct) return null;

    const severity: Severity =
      absDeltaPct >= SEVERITY_BANDS.high.minDeltaPct
        ? "high"
        : absDeltaPct >= SEVERITY_BANDS.medium.minDeltaPct
          ? "medium"
          : "low";

    // Sentiment: if "up" means good for this metric, positive delta
    // = positive sentiment. If "up" means bad, positive delta =
    // negative sentiment. Renderer / phraser stays metric-agnostic.
    const sentiment: AnomalySentiment =
      deltaValue === 0
        ? "neutral"
        : (deltaValue > 0) === metric.upIsGood
          ? "positive"
          : "negative";

    return {
      metricKey: metric.key,
      currentValue: current,
      priorValue: prior,
      deltaValue,
      deltaPct,
      severity,
      sentiment,
    };
  }

  /**
   * Insert a flagged anomaly. `expires_at = NOW() + EXPIRY_DAYS`.
   * Phrasing fields stay NULL until AnomalyPhraser populates them.
   * Sentiment isn't persisted as a column (it's derived in the
   * banner from the metric + delta sign) but logged in
   * `claude_phrasing` later.
   */
  private async persist(shopId: string, a: DetectedAnomaly): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_insights_anomalies (
         shop_id, metric_key,
         current_value, prior_value, delta_value, delta_pct,
         severity, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${EXPIRY_DAYS} days')`,
      [
        shopId,
        a.metricKey,
        a.currentValue,
        a.priorValue,
        a.deltaValue,
        a.deltaPct,
        a.severity,
      ]
    );
  }
}
