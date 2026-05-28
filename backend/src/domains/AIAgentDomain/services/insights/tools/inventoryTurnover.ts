// backend/src/domains/AIAgentDomain/services/insights/tools/inventoryTurnover.ts
//
// Tool: inventory_turnover
//
// Answers questions like:
//   - "What's selling fastest in the last 30 days?"
//   - "What inventory isn't moving?"
//   - "Which items will run out soon?"
//
// Computes per-item usage in a window from inventory_adjustments where
// adjustment_type IN ('sale', 'damage', 'loss') AND quantity_change < 0
// (the stock-removing rows). Sorts by units used (fastest or slowest).
//
// Each row also includes an estimated_days_remaining figure — a simple
// linear projection: current_stock / (units_used_in_window / window_days).
// Returns null when units_used_in_window = 0 (no movement → "—").
//
// Excludes:
//   - Soft-deleted items
//   - Discontinued items (not part of moving inventory)
//
// Shop-scoped via ctx.shopId.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "inventory_turnover";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

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

interface ParsedArgs {
  range: "7d" | "30d" | "90d";
  by: "fastest" | "slowest";
  limit: number;
}

interface TurnoverRow {
  itemId: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  unitsUsed: number;
  estimatedDaysRemaining: number | null;
}

export const inventoryTurnover: BusinessInsightsTool = {
  name: NAME,
  description:
    "Rank this shop's inventory items by how fast or slow they're " +
    "moving in a recent window. 'Usage' counts adjustments of type sale, " +
    "damage, or loss (anything that removes stock). Each item also " +
    "shows an estimated days-of-stock-remaining at current pace. Use " +
    "this when the user asks 'what's selling fastest', 'what's not " +
    "moving', 'which items will run out soon', or any per-item turnover " +
    "question. For overall inventory state use inventory_summary; for " +
    "items already below threshold use low_stock_items.",
  inputSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: ["7d", "30d", "90d"],
        description:
          "Window to measure usage over. '7d' = last 7 days, '30d' = " +
          "last 30 days, '90d' = last 90 days.",
      },
      by: {
        type: "string",
        enum: ["fastest", "slowest"],
        description:
          "Sort direction. 'fastest' = highest usage first (what's " +
          "selling well, may need restock). 'slowest' = lowest usage " +
          "first (dead stock, may need clearance).",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIMIT,
        description: "Max items to return (1-20). Defaults to 10.",
      },
    },
    required: ["range"],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const days = RANGE_TO_DAYS[parsed.range];
    const rows = await fetchTurnover(
      ctx.pool,
      ctx.shopId,
      days,
      parsed.by,
      parsed.limit
    );

    return {
      data: {
        range: parsed.range,
        by: parsed.by,
        windowDays: days,
        count: rows.length,
        items: rows.map((r) => ({
          itemId: r.itemId,
          name: r.name,
          sku: r.sku,
          stockQuantity: r.stockQuantity,
          unitsUsed: r.unitsUsed,
          estimatedDaysRemaining: r.estimatedDaysRemaining,
        })),
        empty: rows.length === 0,
      },
      display: buildDisplay(rows, parsed.range, parsed.by),
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
  const by = (a.by as string) ?? "fastest";
  if (by !== "fastest" && by !== "slowest") {
    throw new Error(`${NAME}: by must be 'fastest' or 'slowest'`);
  }
  let limit = DEFAULT_LIMIT;
  if (typeof a.limit === "number" && Number.isInteger(a.limit)) {
    limit = Math.max(1, Math.min(MAX_LIMIT, a.limit));
  }
  return { range, by, limit };
}

async function fetchTurnover(
  pool: Pool,
  shopId: string,
  windowDays: number,
  by: "fastest" | "slowest",
  limit: number
): Promise<TurnoverRow[]> {
  // CTE: per-item sum of ABS(quantity_change) for stock-removing
  // adjustments in the window. Then LEFT JOIN against inventory_items
  // so items with zero usage in the window still appear when the user
  // asks for "slowest" (those ARE the slowest).
  //
  // Estimated days remaining = stock_quantity / (units_used / window_days)
  // Returns NULL when units_used = 0 (Claude phrases as "—" / "no
  // recent movement").
  const sortClause =
    by === "fastest"
      ? "ORDER BY units_used_in_window DESC NULLS LAST, i.name ASC"
      : "ORDER BY units_used_in_window ASC NULLS FIRST, i.name ASC";

  const res = await pool.query<{
    id: string;
    name: string;
    sku: string | null;
    stock_quantity: string;
    units_used_in_window: string;
    estimated_days_remaining: string | null;
  }>(
    `WITH usage AS (
       SELECT
         a.item_id,
         SUM(ABS(a.quantity_change)) AS units_used
       FROM inventory_adjustments a
       WHERE a.shop_id = $1
         AND a.adjustment_type IN ('sale', 'damage', 'loss')
         AND a.quantity_change < 0
         AND a.created_at >= NOW() - ($2::int || ' days')::interval
       GROUP BY a.item_id
     )
     SELECT
       i.id,
       i.name,
       i.sku,
       i.stock_quantity::text,
       COALESCE(u.units_used, 0)::text AS units_used_in_window,
       CASE
         WHEN COALESCE(u.units_used, 0) = 0 THEN NULL
         ELSE ROUND(
           i.stock_quantity::numeric / (u.units_used::numeric / $2::numeric),
           1
         )
       END::text AS estimated_days_remaining
     FROM inventory_items i
     LEFT JOIN usage u ON i.id = u.item_id
     WHERE i.shop_id = $1
       AND i.deleted_at IS NULL
       AND i.status <> 'discontinued'
     ${sortClause}
     LIMIT $3`,
    [shopId, windowDays, limit]
  );

  return res.rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    sku: row.sku,
    stockQuantity: parseInt(row.stock_quantity, 10),
    unitsUsed: parseInt(row.units_used_in_window, 10),
    estimatedDaysRemaining:
      row.estimated_days_remaining === null
        ? null
        : parseFloat(row.estimated_days_remaining),
  }));
}

function buildDisplay(
  rows: TurnoverRow[],
  range: ParsedArgs["range"],
  by: ParsedArgs["by"]
): ToolDisplay {
  if (rows.length === 0) {
    return {
      kind: "list",
      items: [
        {
          label: `Items ${by === "fastest" ? "moving" : "tracked"} in ${RANGE_LABEL[range]}`,
          value: 0,
        },
      ],
    };
  }
  return {
    kind: "table",
    columns: [
      "Item",
      `Used (${RANGE_LABEL[range]})`,
      "In stock",
      "Days remaining",
    ],
    rows: rows.map((r) => [
      r.sku ? `${r.name} (${r.sku})` : r.name,
      r.unitsUsed,
      r.stockQuantity,
      r.estimatedDaysRemaining === null ? "—" : r.estimatedDaysRemaining,
    ]),
  };
}
