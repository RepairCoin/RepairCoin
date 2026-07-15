// frontend/src/services/api/aiInsights.ts
//
// Shop-side Business-Data Insights assistant. Backed by POST /api/ai/insights.
// See backend:
//   backend/src/domains/AIAgentDomain/controllers/InsightsController.ts
//
// The assistant answers questions about the requesting shop's own data
// (revenue, top customers, top services, bookings breakdown, AI sales
// agent impact) via a small toolkit. Tools are hardcoded shop-scoped
// SQL on the backend — the assistant cannot see another shop's data.
// Questions outside the toolkit get the decline copy pointing back to
// the Help assistant.
//
// Multi-turn shape mirrors aiHelp: the caller holds the conversation in
// local state and passes the whole `messages` array (alternating
// user/assistant, starting with user, last message must be user — the
// new question).
//
// Difference from aiHelp: responses include a `toolCalls` array. Each
// entry has a `display` hint the panel renders as a data card directly
// under the assistant's prose bubble. Branch on `display.kind` to pick
// the renderer (number / table / list / sparkline).

import apiClient from "./client";

export type InsightsMessageRole = "user" | "assistant";

export interface InsightsMessage {
  role: InsightsMessageRole;
  content: string;
}

/**
 * Frontend rendering hint for a tool's result. Mirror of the backend's
 * `ToolDisplay` discriminated union. Branch on `kind` to pick the
 * renderer in InsightsToolCallCard (Phase 4.4).
 */
export type ToolDisplay =
  | {
      kind: "number";
      primary: string;
      label?: string;
      sub?: string;
    }
  | {
      kind: "table";
      columns: string[];
      rows: Array<Array<string | number>>;
    }
  | {
      kind: "list";
      items: Array<{ label: string; value: string | number }>;
    }
  | {
      kind: "sparkline";
      label: string;
      series: number[];
      primary?: string;
    }
  | {
      // Phase 6.3 — AI-suggested next questions. Rendered as a row of
      // tap-able chips below the assistant bubble; tapping submits the
      // chip text as a new user message. Emitted by the
      // `suggest_followups` meta-tool.
      kind: "follow_ups";
      items: string[];
    }
  | {
      // Phase 7.1 — current-vs-prior comparison rendering. Side-by-side
      // numbers + a sentiment-colored delta indicator. The tool decides
      // sentiment (positive=green/negative=red/neutral=gray) so the
      // renderer doesn't have to know whether "up" is good for the
      // metric (revenue up = good; no-shows up = bad).
      kind: "comparison";
      label: string;
      current: { value: string; sublabel?: string };
      prior: { value: string; sublabel?: string };
      delta: {
        value: string;
        direction: "up" | "down" | "flat";
        sentiment: "positive" | "negative" | "neutral";
        magnitude?: "small" | "medium" | "large";
      };
    };

/**
 * One tool the model invoked while answering. The panel renders one
 * data card per entry directly under the assistant bubble using the
 * `display` hint. `display` is absent when the tool errored (unknown
 * tool name or args validation failed) — render nothing in that case,
 * Claude's prose will mention the failure.
 *
 * `args` is the parsed input the model supplied to the tool (e.g.
 * `{ range: "7d" }`). Always enum/literal values — surfaced so the
 * panel can show an active-range chip (Phase 4.5) and follow-up
 * context cues.
 */
export interface InsightsToolCall {
  tool: string;
  args: Record<string, unknown>;
  display?: ToolDisplay;
}

export interface InsightsResponse {
  /** Claude's prose reply, ready to display under the assistant bubble. */
  reply: string;
  /** The Sonnet model id Claude reported (e.g. `claude-sonnet-4-6`). */
  model: string;
  /**
   * True when the system-prompt block got Anthropic prompt-cache hits.
   * Useful for cost diagnostics; not meaningful UI data.
   */
  cached: boolean;
  /** Wall-clock latency the backend observed (ms), summed across loop iterations. */
  latencyMs: number;
  /**
   * Tools the model called in order. May be empty when the model
   * answered without calling any tool (decline path or info already
   * in the conversation). Render one card per entry.
   */
  toolCalls: InsightsToolCall[];
  /**
   * WS3 soft-landing: true once the shop has spent its full monthly AI
   * allowance. The reply still came through (on a lighter model); the panel
   * shows a non-blocking upgrade/overage notice. `budgetUsd`/`spentUsd` power
   * the "$X of $Y used" line.
   */
  limitReached?: boolean;
  budgetUsd?: number;
  spentUsd?: number;
}

/**
 * Validation bounds the backend enforces. Exported so the panel UI can
 * pre-check before POSTing (better UX than waiting for a 400). Values
 * match the backend's `MAX_MESSAGES` / `MAX_CONTENT_CHARS` /
 * `MAX_SESSION_ID_CHARS` constants in InsightsController.
 *
 * `maxMessages: 30` is intentionally higher than Help's 20 — insights
 * conversations drill down into analytics (compare ranges, switch
 * metrics, ask about specific customers/services), so 15 user
 * exchanges gives natural-feeling headroom. Per-session cost is still
 * bounded by the backend's monthly per-shop spend cap.
 */
export const INSIGHTS_LIMITS = {
  maxMessages: 30,
  maxContentChars: 4000,
  maxSessionIdChars: 64,
} as const;

/**
 * Ask the Business-Data Insights assistant. Reuse the same `sessionId`
 * for every call within one insights-panel session — the backend
 * groups audit rows by it. `crypto.randomUUID()` is a fine source on
 * modern browsers.
 *
 * `messages` must:
 *   - alternate user → assistant → user → … (strict)
 *   - start with `user`
 *   - end with `user` (the new question)
 *   - total ≤ INSIGHTS_LIMITS.maxMessages, each content ≤ maxContentChars
 *
 * Errors the panel should be ready to render:
 *   - 401 → shop session expired; nudge re-login.
 *   - 400 → validation failure; the message will say what.
 *   - 429 → AI monthly budget exhausted for this shop.
 *   - 503 → AI service degraded; retry later.
 */
export const askInsights = async (
  sessionId: string,
  messages: InsightsMessage[]
): Promise<InsightsResponse> => {
  const response = await apiClient.post("/ai/insights", { sessionId, messages });
  return response.data.data || response.data;
};

// ---------- Phase 7.3 — saved queries ----------

/**
 * One pinned question. Backed by `ai_insights_pinned_queries`. Tapping
 * a pinned row in the panel re-submits `questionText` through the
 * normal chat pipeline + records the run via `recordPinnedRun`.
 */
export interface PinnedQuery {
  id: string;
  questionText: string;
  pinnedAt: string;
  lastRunAt: string | null;
  lastResponseExcerpt: string | null;
  displayOrder: number;
}

/** GET /api/ai/insights/pinned — all pins for this shop. */
export const listPinnedQueries = async (): Promise<PinnedQuery[]> => {
  // The axios response interceptor in `./client.ts` already returns
  // `response.data` directly, so `apiClient.get(...)` resolves to the
  // backend envelope `{ success, data: { pinned } }`. The first `.data`
  // unwraps to `{ pinned }`, then `.pinned` is the array. The previous
  // `response.data.data.pinned` was one level too deep and silently
  // returned `[]` for every call — Pinned tab + banner both went dark
  // across panel reopens despite real DB rows.
  const response = await apiClient.get("/ai/insights/pinned");
  return response.data?.pinned ?? [];
};

/**
 * POST /api/ai/insights/pinned — create (or return existing dedupe row).
 * 409 means the shop hit MAX_PINS_PER_SHOP (50); 400 = bad text.
 */
export const pinQuery = async (questionText: string): Promise<PinnedQuery> => {
  const response = await apiClient.post("/ai/insights/pinned", { questionText });
  return response.data?.data ?? response.data;
};

/** DELETE /api/ai/insights/pinned/:id — remove one pin. */
export const unpinQuery = async (id: string): Promise<void> => {
  await apiClient.delete(`/ai/insights/pinned/${encodeURIComponent(id)}`);
};

/**
 * PUT /api/ai/insights/pinned/:id/run — record a fresh tap-to-run.
 * Sets `last_run_at` + `last_response_excerpt` so the Pinned tab can
 * show a recency hint. Non-blocking; call after the reply renders.
 */
export const recordPinnedRun = async (
  id: string,
  excerpt: string
): Promise<void> => {
  await apiClient.put(`/ai/insights/pinned/${encodeURIComponent(id)}/run`, {
    excerpt,
  });
};

// ---------- Phase 7.2 — anomaly banner ----------

/** One of the 5 starter metrics watched by the nightly cron. */
export type AnomalyMetricKey =
  | "weekly_revenue"
  | "weekly_no_shows"
  | "weekly_cancellations"
  | "weekly_ai_conversations"
  | "weekly_bookings";

/**
 * One active anomaly. Backed by `ai_insights_anomalies`. Surfaced at
 * the top of the InsightsPanel as a banner row. `phrasing` is Claude's
 * one-sentence summary; when null (spend-cap exhausted or Claude
 * failure) the banner falls back to a template. `followUpQuestion` is
 * the chip target for "Tell me more" — submitting it routes through
 * the same pipeline as Phase 6.3 follow-up chips.
 */
export interface Anomaly {
  id: string;
  metricKey: AnomalyMetricKey;
  detectedAt: string;
  severity: "low" | "medium" | "high";
  currentValue: number;
  priorValue: number;
  deltaPct: number | null;
  phrasing: string | null;
  followUpQuestion: string | null;
}

/** GET /api/ai/insights/anomalies — active (un-dismissed, un-expired), max 3. */
export const listAnomalies = async (): Promise<Anomaly[]> => {
  // See note on listPinnedQueries — the axios interceptor pre-unwraps
  // `response.data`, so we read `.pinned`/`.anomalies` one level
  // shallower than a naive call site would.
  const response = await apiClient.get("/ai/insights/anomalies");
  return response.data?.anomalies ?? [];
};

/**
 * POST /api/ai/insights/anomalies/:id/dismiss — soft-dismiss. Idempotent
 * server-side: a row already dismissed returns 404 (existence-leak
 * prevention), so swallow that case at the call-site.
 */
export const dismissAnomaly = async (id: string): Promise<void> => {
  await apiClient.post(
    `/ai/insights/anomalies/${encodeURIComponent(id)}/dismiss`
  );
};
