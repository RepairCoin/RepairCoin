// backend/src/domains/AIAgentDomain/services/insights/tools/inventoryValueTrend.ts
//
// Tool: inventory_value_trend
//
// Answers questions like:
//   - "Is my inventory value going up or down?"
//   - "How much did I spend on stock this month?"
//   - "How is my inventory trending vs last month?"
//
// v1 approach: measure NET CHANGE in stock value over the window,
// not absolute-value-at-two-points-in-time. Reconstructing historical
// stock levels from adjustments is expensive and noisy; the net delta
// answers the underlying question (inventory growing or shrinking) with
// the data we have.
//
// SQL: SUM(quantity_change × items.cost) across all adjustments in the
// window. Positive = inventory grew (restocking). Negative = inventory
// shrank (sales > replenishment). Then run the same query against the
// PRIOR equivalent window and surface both numbers as a comparison.
//
// Sentiment is intentionally NEUTRAL in v1 because the direction is
// ambiguous — restocking is normal, selling-through is also normal.
// Magnitude reflects |delta vs prior| for visual prominence only.
//
// Shop-scoped via ctx.shopId.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "inventory_value_trend";

const RANGE_TO_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const RANGE_LABEL: Record<string, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
};

const PRIOR_LABEL: Record<string, string> = {
  "7d": "prior 7 days",
  "30d": "prior 30 days",
  "90d": "prior 90 days",
};

interface ParsedArgs {
  range: "7d" | "30d" | "90d";
}

interface WindowDelta {
  valueDelta: number;
  adjustmentCount: number;
}

export const inventoryValueTrend: BusinessInsightsTool = {
  name: NAME,
  description:
    "Measure the net change in this shop's inventory dollar-value over " +
    "a recent window (sum of quantity_change × unit_cost across all " +
    "inventory adjustments). Compares against the same length prior " +
    "window. Positive value = inventory grew (restocking exceeded " +
    "sales); negative = inventory shrank. Use this when the user asks " +
    "'is my inventory up or down', 'how much did I spend on stock', or " +
    "any inventory trend / cash-tied-up-in-stock question.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: ["7d", "30d", "90d"],
        description:
          "Window to measure. '7d' = last 7 days vs prior 7 days. " +
          "'30d' = last 30 vs prior 30. '90d' = last 90 vs prior 90.",
      },
    },
    required: ["range"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const days = RANGE_TO_DAYS[parsed.range];

    const [current, prior] = await Promise.all([
      fetchWindowDelta(ctx.pool, ctx.shopId, 0, days),
      fetchWindowDelta(ctx.pool, ctx.shopId, days, days * 2),
    ]);

    const empty = current.adjustmentCount === 0 && prior.adjustmentCount === 0;

    return {
      data: {
        range: parsed.range,
        current: {
          valueDelta: current.valueDelta,
          adjustmentCount: current.adjustmentCount,
        },
        prior: {
          valueDelta: prior.valueDelta,
          adjustmentCount: prior.adjustmentCount,
        },
        empty,
      },
      display: buildDisplay(parsed.range, current, prior, empty),
    };
  },
};

function parseArgs(args: unknown): ParsedArgs {
  if (args === null || typeof args !== "object") {
    throw new Error(`${NAME}: args must be an object`);
  }
  const a = args as Record<string, unknown>;
  const range = a.range as string;
  if (range !== "7d" && range !== "30d" && range !== "90d") {
    throw new Error(`${NAME}: range must be '7d', '30d', or '90d'`);
  }
  return { range };
}

/**
 * Measure net value change in a window `daysAgoFrom`..`daysAgoTo` days
 * back. Example: (0, 30) = last 30 days. (30, 60) = the 30 days before
 * that.
 *
 * The join to inventory_items ensures we use the item's CURRENT unit
 * cost — historical cost-at-adjustment-time isn't stored. Acceptable
 * for v1; flagged as a known limitation in the scope doc.
 */
async function fetchWindowDelta(
  pool: Pool,
  shopId: string,
  daysAgoFrom: number,
  daysAgoTo: number
): Promise<WindowDelta> {
  const res = await pool.query<{
    value_delta: string;
    adjustment_count: string;
  }>(
    `SELECT
       COALESCE(SUM(a.quantity_change * i.cost), 0)::text AS value_delta,
       COUNT(*)::text AS adjustment_count
     FROM inventory_adjustments a
     INNER JOIN inventory_items i ON a.item_id = i.id
     WHERE a.shop_id = $1
       AND i.deleted_at IS NULL
       AND a.created_at >= NOW() - ($3::int || ' days')::interval
       AND a.created_at < NOW() - ($2::int || ' days')::interval`,
    [shopId, daysAgoFrom, daysAgoTo]
  );

  const row = res.rows[0];
  return {
    valueDelta: parseFloat(row?.value_delta ?? "0"),
    adjustmentCount: parseInt(row?.adjustment_count ?? "0", 10),
  };
}

function fmtSignedUsd(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

function buildDisplay(
  range: ParsedArgs["range"],
  current: WindowDelta,
  prior: WindowDelta,
  empty: boolean
): ToolDisplay {
  if (empty) {
    return {
      kind: "list",
      items: [
        {
          label: "Inventory adjustments",
          value: `No movement in ${RANGE_LABEL[range]} or ${PRIOR_LABEL[range]}`,
        },
      ],
    };
  }

  // Delta vs prior window — positive means "even more growth than prior"
  // or "shrinkage slowed." Negative means "growth slowed" or "shrinkage
  // accelerated." Sentiment is NEUTRAL in v1 because the business
  // interpretation depends on context the AI doesn't have.
  const deltaVsPrior = current.valueDelta - prior.valueDelta;
  const direction: "up" | "down" | "flat" =
    deltaVsPrior > 0 ? "up" : deltaVsPrior < 0 ? "down" : "flat";
  const abs = Math.abs(deltaVsPrior);
  const magnitude: "small" | "medium" | "large" =
    abs >= 1000 ? "large" : abs >= 100 ? "medium" : "small";

  return {
    kind: "comparison",
    label: `Inventory value change (${RANGE_LABEL[range]} vs ${PRIOR_LABEL[range]})`,
    current: {
      value: fmtSignedUsd(current.valueDelta),
      sublabel: `${current.adjustmentCount} adjustment${current.adjustmentCount === 1 ? "" : "s"}`,
    },
    prior: {
      value: fmtSignedUsd(prior.valueDelta),
      sublabel: `${prior.adjustmentCount} adjustment${prior.adjustmentCount === 1 ? "" : "s"}`,
    },
    delta: {
      value: fmtSignedUsd(deltaVsPrior),
      direction,
      sentiment: "neutral",
      magnitude,
    },
  };
}
