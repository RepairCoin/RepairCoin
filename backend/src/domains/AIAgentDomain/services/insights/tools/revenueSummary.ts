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
        enum: ["7d", "30d", "90d", "all"],
        description:
          "Lookback window. '7d' = last 7 days, '30d' = last 30 days, " +
          "'90d' = last 90 days, 'all' = since the shop's first order.",
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

    const currentFrom = windowStart(now, parsed.range);
    const current = await sumWindow(
      ctx.pool,
      ctx.shopId,
      currentFrom,
      null
    );

    if (parsed.compare !== "prior") {
      return singleResult(parsed.range, current);
    }

    // compare='prior' for 'all' has no defined prior window. Surface
    // the unsupported case in the data so Claude phrases it honestly
    // instead of inventing a comparison.
    if (parsed.range === "all") {
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

    const priorFrom = windowStart(now, parsed.range, /*priorMultiplier*/ 2);
    const priorTo = currentFrom; // exclusive upper bound = current window's lower bound
    const prior = await sumWindow(ctx.pool, ctx.shopId, priorFrom, priorTo);

    return compareResult(parsed.range, current, prior);
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

type RangeKey = "7d" | "30d" | "90d" | "all";

interface ParsedArgs {
  range: RangeKey;
  compare?: "prior";
}

interface WindowSum {
  totalUsd: number;
  orderCount: number;
}

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  all: "all time",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/**
 * Lower bound for a window. `priorMultiplier=2` gives the start of the
 * window-before-the-current-window (used for compare='prior'). Returns
 * null for 'all' (no lower bound).
 */
function windowStart(
  now: Date,
  range: RangeKey,
  priorMultiplier = 1
): Date | null {
  if (range === "all") return null;
  return new Date(now.getTime() - RANGE_DAYS[range] * priorMultiplier * MS_PER_DAY);
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
  const deltaLabel =
    deltaPct === null
      ? "n/a (no prior revenue)"
      : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;
  return {
    data: {
      range,
      current: { totalUsd: current.totalUsd, orderCount: current.orderCount },
      prior: { totalUsd: prior.totalUsd, orderCount: prior.orderCount },
      deltaPct,
    },
    display: {
      kind: "list",
      items: [
        { label: RANGE_LABEL[range], value: fmtUsd(current.totalUsd) },
        { label: `Prior ${RANGE_LABEL[range]}`, value: fmtUsd(prior.totalUsd) },
        { label: "Δ", value: deltaLabel },
      ],
    },
  };
}
