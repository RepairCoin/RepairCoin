// backend/src/domains/AIAgentDomain/services/insights/anomalies/types.ts
//
// Shared types for the Phase 7.2 anomaly-detection pipeline.

import { Pool } from "pg";

/**
 * Canonical metric identifiers stored in `ai_insights_anomalies.metric_key`.
 * Keep this union in sync with the SQL COMMENT on metric_key in
 * migration 125.
 */
export type MetricKey =
  | "weekly_revenue"
  | "weekly_no_shows"
  | "weekly_cancellations"
  | "weekly_ai_conversations"
  | "weekly_bookings";

export type Severity = "low" | "medium" | "high";

/**
 * Sentiment of a metric movement. Mirrors the comparison ToolDisplay
 * variant — same idea (renderer / phraser stays metric-agnostic;
 * detector decides whether the change is good or bad).
 */
export type AnomalySentiment = "positive" | "negative" | "neutral";

/**
 * One metric the detector watches. `compute(pool, shopId)` returns the
 * current-week + prior-week values; the detector itself handles delta
 * math + severity classification + sentiment mapping.
 */
export interface MetricDefinition {
  key: MetricKey;
  /** Human-readable label for prompts + phrasing fallbacks. */
  label: string;
  /**
   * Is "up" good for this metric?
   *   - revenue ↑ = good
   *   - no-shows ↑ = bad
   *   - cancellations ↑ = bad
   *   - AI conversations ↑ = good
   *   - bookings ↑ = good
   * Detector flips sentiment when the direction conflicts with this.
   */
  upIsGood: boolean;
  /**
   * Skip the flag when the prior-week value is below this threshold.
   * Prevents noise on tiny baselines ("revenue went from $5 to $20
   * — +300%!"). Per-metric so revenue ($50) differs from no-shows (1).
   */
  minPriorSignal: number;
  /** Pull the {current, prior} pair from the DB. */
  compute(pool: Pool, shopId: string): Promise<{ current: number; prior: number }>;
}

/** Detector output before persistence. */
export interface DetectedAnomaly {
  metricKey: MetricKey;
  currentValue: number;
  priorValue: number;
  deltaValue: number;
  deltaPct: number | null;
  severity: Severity;
  sentiment: AnomalySentiment;
}
