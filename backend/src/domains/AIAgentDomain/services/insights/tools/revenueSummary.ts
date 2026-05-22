// backend/src/domains/AIAgentDomain/services/insights/tools/revenueSummary.ts
//
// Tool: revenue_summary
//
// Answers questions like:
//   - "How much did I earn last week?"
//   - "What was my revenue this month?"
//   - "Compare this month's revenue to last month."
//
// Sums service_orders.total_amount where status IN ('paid', 'completed')
// for the requested rolling window, scoped to ctx.shopId. With
// compare='prior', also computes the previous equivalent window + delta
// so Claude can phrase a comparison.
//
// Window column: created_at (when revenue came in). Rolling 7/30/90-day
// from now() — not calendar-aligned. 'all' has no lower bound.
//
// Statuses excluded by design (per scope doc): 'cancelled', 'expired',
// 'no_show'. Those are tracked separately by bookings_breakdown.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";
import {
  RangeKey,
  RANGE_ENUM,
  RANGE_LABEL,
  windowBoundsFor,
  priorWindowBoundsFor,
} from "../ranges";

const NAME = "revenue_summary";

export const revenueSummary: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up this shop's revenue (sum of paid + completed order totals) " +
    "for a recent window. Use this when the user asks how much they " +
    "earned, made, or grossed in a period, or how their revenue " +
    "compares to the prior equivalent window. Set compare='prior' only " +
    "when the user explicitly asks for a comparison.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: [...RANGE_ENUM],
        description:
          "Time window. Rolling: '7d'/'30d'/'90d' (last N days from now), " +
          "'all' (since shop's first order). Calendar: 'this_week'/'this_month'/" +
          "'this_quarter' (current period to date), 'last_week'/'last_month' " +
          "(prior closed period). Pick whichever phrasing the user used: " +
          "'this month' → 'this_month'; 'last 30 days' → '30d'.",
      },
      compare: {
        type: "string",
        enum: ["prior"],
        description:
          "Optional. When 'prior', also returns the same metric for the " +
          "previous equivalent window plus a delta. Only include when " +
          "the user explicitly asks for a comparison.",
      },
    },
    required: ["range"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const now = new Date();

    const currentBounds = windowBoundsFor(parsed.range, now);
    const current = await sumWindow(
      ctx.pool,
      ctx.shopId,
      currentBounds.from,
      currentBounds.to
    );

    if (parsed.compare !== "prior") {
      return singleResult(parsed.range, current);
    }

    // compare='prior' for 'all' has no defined prior window. Surface
    // the unsupported case in the data so Claude phrases it honestly
    // instead of inventing a comparison.
    const priorBounds = priorWindowBoundsFor(parsed.range, now);
    if (priorBounds === null) {
      return {
        data: {
          range: parsed.range,
          totalUsd: current.totalUsd,
          orderCount: current.orderCount,
          comparisonUnsupported: true,
          comparisonReason:
            "Comparison is not supported for the 'all' range — there is no prior window.",
        },
        display: singleDisplay(parsed.range, current),
      };
    }

    const prior = await sumWindow(
      ctx.pool,
      ctx.shopId,
      priorBounds.from,
      priorBounds.to
    );

    return compareResult(parsed.range, current, prior);
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

interface ParsedArgs {
  range: RangeKey;
  compare?: "prior";
}

interface WindowSum {
  totalUsd: number;
  orderCount: number;
}

function parseArgs(args: unknown): ParsedArgs {
  if (!args || typeof args !== "object") {
    throw new Error(`${NAME}: args must be an object`);
  }
  const a = args as Record<string, unknown>;
  const range = a.range as RangeKey;
  if (!(range in RANGE_LABEL)) {
    throw new Error(`${NAME}: invalid range '${String(a.range)}'`);
  }
  if (a.compare !== undefined && a.compare !== "prior") {
    throw new Error(`${NAME}: invalid compare '${String(a.compare)}'`);
  }
  return { range, compare: a.compare as "prior" | undefined };
}

async function sumWindow(
  pool: Pool,
  shopId: string,
  fromInclusive: Date | null,
  toExclusive: Date | null
): Promise<WindowSum> {
  // Shop-scoping is hardcoded in this SQL — never sourced from Claude
  // args. Status filter excludes cancelled/expired/no_show by design.
  const conds: string[] = [`shop_id = $1`, `status IN ('paid', 'completed')`];
  const params: unknown[] = [shopId];
  if (fromInclusive) {
    params.push(fromInclusive);
    conds.push(`created_at >= $${params.length}`);
  }
  if (toExclusive) {
    params.push(toExclusive);
    conds.push(`created_at < $${params.length}`);
  }
  const res = await pool.query<{ total: string; n: string }>(
    `SELECT
       COALESCE(SUM(total_amount), 0)::text AS total,
       COUNT(*)::text AS n
     FROM service_orders WHERE ${conds.join(" AND ")}`,
    params
  );
  return {
    totalUsd: Number(res.rows[0]?.total ?? "0"),
    orderCount: Number(res.rows[0]?.n ?? "0"),
  };
}

function fmtUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function singleDisplay(range: RangeKey, w: WindowSum): ToolDisplay {
  return {
    kind: "number",
    primary: fmtUsd(w.totalUsd),
    label: `Revenue (${RANGE_LABEL[range]})`,
    sub: `${w.orderCount} paid + completed order${w.orderCount === 1 ? "" : "s"}`,
  };
}

function singleResult(range: RangeKey, w: WindowSum): ToolResult {
  return {
    data: {
      range,
      totalUsd: w.totalUsd,
      orderCount: w.orderCount,
    },
    display: singleDisplay(range, w),
  };
}

function compareResult(
  range: RangeKey,
  current: WindowSum,
  prior: WindowSum
): ToolResult {
  // null delta when prior == 0 (avoid divide-by-zero / Infinity). Claude
  // sees `deltaPct: null` and can phrase it as "no prior revenue".
  const deltaPct =
    prior.totalUsd === 0
      ? null
      : ((current.totalUsd - prior.totalUsd) / prior.totalUsd) * 100;
  const deltaUsd = current.totalUsd - prior.totalUsd;

  // Direction is mathematical (sign of deltaUsd). Sentiment is
  // contextual — for revenue, up is good news regardless of whether
  // we can compute a clean percentage. Magnitude tracks |deltaPct|
  // for visual prominence; defaults to "small" when deltaPct is null
  // since we have no percentage to size against.
  const direction: "up" | "down" | "flat" =
    deltaUsd > 0 ? "up" : deltaUsd < 0 ? "down" : "flat";
  const sentiment: "positive" | "negative" | "neutral" =
    deltaUsd > 0 ? "positive" : deltaUsd < 0 ? "negative" : "neutral";
  const magnitude: "small" | "medium" | "large" =
    deltaPct === null
      ? "small"
      : Math.abs(deltaPct) >= 25
        ? "large"
        : Math.abs(deltaPct) >= 5
          ? "medium"
          : "small";

  const deltaValueText =
    deltaPct === null
      ? "n/a (no prior revenue)"
      : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;

  return {
    data: {
      range,
      current: { totalUsd: current.totalUsd, orderCount: current.orderCount },
      prior: { totalUsd: prior.totalUsd, orderCount: prior.orderCount },
      deltaPct,
      deltaUsd,
    },
    display: {
      kind: "comparison",
      label: `Revenue (${RANGE_LABEL[range]} vs prior)`,
      current: {
        value: fmtUsd(current.totalUsd),
        sublabel: `${current.orderCount} order${current.orderCount === 1 ? "" : "s"}`,
      },
      prior: {
        value: fmtUsd(prior.totalUsd),
        sublabel: `${prior.orderCount} order${prior.orderCount === 1 ? "" : "s"}`,
      },
      delta: {
        value: deltaValueText,
        direction,
        sentiment,
        magnitude,
      },
    },
  };
}
