/**
 * Shared constants for the AI Agent domain.
 *
 * Keep cross-feature numeric thresholds here so backend + frontend share
 * one source of truth. Frontend mirrors are kept in
 * `frontend/src/services/api/aiMetrics.ts` (or similar) when added.
 */

/**
 * Minimum number of AI conversations in the selected window before the
 * Impact Metrics endpoint surfaces real numbers. Below this, the endpoint
 * returns `belowThreshold: true` and the UI renders the "still collecting
 * data" empty state instead of noisy single-digit percentages.
 *
 * Per scope-doc Section 5 decision I:
 * docs/tasks/strategy/ai-sales-agent/ai-sales-agent-impact-metrics.md.
 */
export const MIN_SAMPLE_N = 5;
