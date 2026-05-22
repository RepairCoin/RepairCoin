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
