// backend/src/domains/AIAgentDomain/services/insights/tools/aiAssistantImpact.ts
//
// Tool: ai_assistant_impact
//
// Answers questions like:
//   - "How is my AI sales assistant doing?"
//   - "How many bookings did the AI drive last month?"
//   - "What's the AI assistant's revenue impact this quarter?"
//
// Wraps MetricsAggregator.aggregate() — same data the Impact Metrics
// section of the shop dashboard shows. Same shop-scoping, same
// per-shop human-reply baseline, same MIN_SAMPLE_N threshold flag.
// Wrapping (not re-implementing) keeps these two surfaces strictly
// consistent — if the dashboard and the AI ever disagree on a number,
// it's an aggregator bug, not a tool bug.
//
// Per the SettingsController / MetricsController pattern in this
// codebase, the small baseline-fetch helper is duplicated inline
// rather than imported — the controllers deliberately keep these
// helpers module-local to preserve boundaries.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";
import { MetricsAggregator } from "../../MetricsAggregator";
import {
  RangeKey,
  RANGE_ENUM,
  RANGE_LABEL,
  windowBoundsFor,
} from "../ranges";

const NAME = "ai_assistant_impact";

export const aiAssistantImpact: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up how the shop's AI sales assistant is performing in a time " +
    "window. Use this when the user asks about their AI assistant, AI " +
    "sales agent, AI conversations, AI-driven bookings, AI-driven " +
    "revenue, or how the assistant is doing in general.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: [...RANGE_ENUM],
        description:
          "Time window. Rolling ('7d'/'30d'/'90d'/'all') or calendar " +
          "('this_week'/'this_month'/'last_week'/'last_month'/" +
          "'this_quarter').",
      },
    },
    required: ["range"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const bounds = windowBoundsFor(parsed.range);
    const baselineMinutes = await fetchBaselineMinutes(ctx.pool, ctx.shopId);

    const aggregator = new MetricsAggregator({ pool: ctx.pool });
    const metrics = await aggregator.aggregate({
      shopId: ctx.shopId,
      windowStart: bounds.from,
      windowEnd: bounds.to,
      baselineMinutes,
    });

    const display = buildDisplay(parsed, metrics);
    return {
      data: {
        range: parsed.range,
        rangeLabel: RANGE_LABEL[parsed.range],
        baselineMinutes,
        sampleN: metrics.sampleN,
        // Surface the threshold flag explicitly so Claude can phrase
        // honestly ("you only had 2 AI conversations — that's not
        // enough data to draw conclusions yet").
        belowThreshold: metrics.belowThreshold,
        belowThresholdReason: metrics.belowThreshold
          ? `Only ${metrics.sampleN} AI conversation${metrics.sampleN === 1 ? "" : "s"} in this window — not enough data for confident conclusions.`
          : null,
        businessImpact: metrics.businessImpact,
        performance: metrics.performance,
      },
      display,
    };
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

interface ParsedArgs {
  range: RangeKey;
}

// Mirrors MetricsController's DEFAULT_HUMAN_REPLY_BASELINE_MINUTES.
// Per the existing codebase convention, this constant is duplicated
// across the controllers that consume it rather than centralized —
// preserves module boundaries.
const DEFAULT_HUMAN_REPLY_BASELINE_MINUTES = 240;

function parseArgs(args: unknown): ParsedArgs {
  if (!args || typeof args !== "object") {
    throw new Error(`${NAME}: args must be an object`);
  }
  const a = args as Record<string, unknown>;
  const range = a.range as RangeKey;
  if (!(range in RANGE_LABEL)) {
    throw new Error(`${NAME}: invalid range '${String(a.range)}'`);
  }
  return { range };
}

async function fetchBaselineMinutes(pool: Pool, shopId: string): Promise<number> {
  const r = await pool.query<{ human_reply_baseline_minutes: number | null }>(
    `SELECT human_reply_baseline_minutes
     FROM ai_shop_settings WHERE shop_id = $1`,
    [shopId]
  );
  if (r.rows.length === 0) return DEFAULT_HUMAN_REPLY_BASELINE_MINUTES;
  return r.rows[0].human_reply_baseline_minutes ?? DEFAULT_HUMAN_REPLY_BASELINE_MINUTES;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtHours(h: number): string {
  if (h === 0) return "0 hrs";
  if (h < 1) return `${(h * 60).toFixed(0)} min`;
  if (h < 10) return `${h.toFixed(1)} hrs`;
  return `${Math.round(h)} hrs`;
}

function fmtSeconds(s: number): string {
  if (s === 0) return "n/a";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  return `${(s / 3600).toFixed(1)} hrs`;
}

function fmtRate(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function buildDisplay(
  parsed: ParsedArgs,
  m: {
    sampleN: number;
    belowThreshold: boolean;
    businessImpact: {
      aiConversations: number;
      bookingsGenerated: number;
      revenueGenerated: number;
      customersRecovered: number;
      responseTimeSavedHours: number;
    };
    performance: {
      conversionRate: number;
      avgResponseTimeSeconds: number;
    };
  }
): ToolDisplay {
  const items: Array<{ label: string; value: string | number }> = [
    { label: `Window`, value: RANGE_LABEL[parsed.range] },
    { label: "AI conversations", value: m.businessImpact.aiConversations },
    { label: "Bookings generated", value: m.businessImpact.bookingsGenerated },
    { label: "Revenue generated", value: fmtUsd(m.businessImpact.revenueGenerated) },
    { label: "Conversion rate", value: fmtRate(m.performance.conversionRate) },
    { label: "Customers recovered", value: m.businessImpact.customersRecovered },
    { label: "Time saved", value: fmtHours(m.businessImpact.responseTimeSavedHours) },
    { label: "Avg AI response time", value: fmtSeconds(m.performance.avgResponseTimeSeconds) },
  ];
  if (m.belowThreshold) {
    items.push({
      label: "⚠ Low sample",
      value: `Only ${m.sampleN} AI conversation${m.sampleN === 1 ? "" : "s"} — interpret with caution`,
    });
  }
  return { kind: "list", items };
}
