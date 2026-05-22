// backend/src/domains/AIAgentDomain/services/insights/types.ts
//
// Shared types for the Business-Data Insights toolkit.
//
// Design (scope-doc Section 4): Claude reaches the data via pre-defined
// query functions ("tools"). Each tool has a typed input schema, a
// description Claude reads to decide whether to call it, and an
// execute() implementation the dispatcher invokes when Claude picks it.
//
// Shop-scoping invariant: ctx.shopId comes from the JWT (controller
// reads it from req.user), never from Claude's args. Every tool's SQL
// hardcodes WHERE shop_id = $1 with that value. Tools never accept a
// shopId argument from Claude.

import { Pool } from "pg";
import { ClaudeTool } from "../../types";

/**
 * Context every tool's execute() receives. The shopId is JWT-sourced
 * and treated as ground truth — tools must use it as their scope, not
 * any shopId-like value Claude might supply in `args`.
 */
export interface ToolContext {
  /** Authenticated shop. Sourced from the JWT by the controller. */
  shopId: string;
  /** Shared PG pool (allows test injection). */
  pool: Pool;
}

/**
 * Frontend rendering hint for the tool's result. The chat panel
 * branches on `kind` to render a number tile, a table, a list, or a
 * mini sparkline directly under the assistant's prose bubble.
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
      // tap-able chips below the assistant bubble. Each item submits
      // its text as a fresh user message when tapped. Emitted by the
      // `suggest_followups` meta-tool after the data-fetching tool(s)
      // have answered the original question.
      kind: "follow_ups";
      items: string[];
    }
  | {
      // Phase 7.1 — current-vs-prior comparison rendering. Side-by-side
      // numbers + delta indicator. Replaces the awkward 3-row `list`
      // shape that compare='prior' results currently use. Also serves
      // the Phase 7.2 anomaly banner ("no-shows this week vs last
      // week: 12 vs 3, +300%").
      //
      // `sentiment` lets the TOOL declare whether the change is good
      // or bad. Renderer maps sentiment → color (positive=green,
      // negative=red, neutral=gray) without needing to know what the
      // metric is. e.g. revenue up = positive; no-shows up = negative.
      //
      // `direction` is the mathematical sign; `magnitude` is intensity
      // for visual prominence. Keep these orthogonal to sentiment so
      // a "small positive uptick" can render differently from a
      // "large positive jump".
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
 * Result a tool's execute() must return.
 *
 * `data` is the structured payload Claude sees on the next turn
 * (Anthropic tool-use round-trip) — it must be JSON-serializable and
 * compact enough not to bloat the model's context.
 *
 * `display` is the (optional) hint the frontend uses to render a card.
 * Tools that have nothing visual to add can omit it; Claude can still
 * write prose using `data`.
 */
export interface ToolResult {
  data: Record<string, unknown>;
  display?: ToolDisplay;
}

/**
 * One backend query function Claude can invoke. Extends `ClaudeTool`
 * so the same object can be passed directly to
 * `AnthropicClient.complete({ tools })` — no conversion layer.
 *
 * The dispatcher calls `execute(args, ctx)` after Anthropic surfaces a
 * tool_use block matching this tool's `name`. Anthropic has already
 * validated `args` against `inputSchema`, but tools should still
 * defend against malformed input at the top of execute() — never
 * trust the model's payload as authoritative.
 */
export interface BusinessInsightsTool extends ClaudeTool {
  execute(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * Controller-facing result of one tool dispatch attempt. The dispatcher
 * wraps every tool call in a try/catch + a wall-clock timer so the
 * controller never has to worry about throws + can audit latency
 * uniformly.
 */
export interface ToolDispatchResult {
  ok: boolean;
  tool: string;
  args: Record<string, unknown>;
  /** Populated when ok === true. */
  result?: ToolResult;
  /** Populated when ok === false. */
  error?: string;
  latencyMs: number;
}

/**
 * Slim record stored in `ai_insights_messages.tool_calls` (JSONB). We
 * deliberately exclude `result.data` (could be large + duplicates what
 * Claude sees on the next turn). Keep enough metadata to audit which
 * tool was picked + how it rendered + whether it errored.
 */
export interface ToolInvocationRecord {
  tool: string;
  args: Record<string, unknown>;
  display?: ToolDisplay;
  latencyMs: number;
  error?: string;
}
