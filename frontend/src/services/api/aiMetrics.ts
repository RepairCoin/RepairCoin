// frontend/src/services/api/aiMetrics.ts
//
// Shop-side AI Sales Agent Impact Metrics. Backed by GET /api/ai/metrics.
// See backend:
//   backend/src/domains/AIAgentDomain/controllers/MetricsController.ts
//   backend/src/domains/AIAgentDomain/services/MetricsAggregator.ts
//
// The backend always returns `belowThreshold` so the UI just checks that
// flag — no need to mirror MIN_SAMPLE_N here.

import apiClient from "./client";

/** Time-range pill values accepted by GET /api/ai/metrics?range=… */
export type AiMetricsRange = "7d" | "30d" | "90d" | "all";

export interface AiMetricsBusinessImpact {
  aiConversations: number;
  bookingsGenerated: number;
  /** USD. service_orders.total_amount is already in dollars. */
  revenueGenerated: number;
  customersRecovered: number;
  responseTimeSavedHours: number;
}

export interface AiMetricsPerformance {
  /** 0..1 — bookings / conversations. 0 when no conversations. */
  conversionRate: number;
  avgResponseTimeSeconds: number;
  /** Same underlying data as bookingsGenerated — surfaced under both cards. */
  bookingsCreated: number;
}

export interface AiMetricsResponse {
  range: AiMetricsRange;
  /** Distinct conversations where the AI replied at least once. */
  sampleN: number;
  /**
   * True when sampleN is below the threshold the backend uses
   * (MIN_SAMPLE_N — currently 5). UI should render the empty state when
   * true regardless of the numbers in `businessImpact` / `performance`.
   */
  belowThreshold: boolean;
  /** The shop's configured human-reply baseline, echoed for display. */
  baselineMinutes: number;
  businessImpact: AiMetricsBusinessImpact;
  performance: AiMetricsPerformance;
}

/**
 * Fetch the requesting shop's AI Impact Metrics for the given window.
 * Backend caches per (shopId, range) for ~60s — repeated calls within
 * that window are cheap.
 */
export const getAiMetrics = async (
  range: AiMetricsRange
): Promise<AiMetricsResponse> => {
  const response = await apiClient.get("/ai/metrics", { params: { range } });
  return response.data.data || response.data;
};
