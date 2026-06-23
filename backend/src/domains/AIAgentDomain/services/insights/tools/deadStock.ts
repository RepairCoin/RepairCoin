// backend/src/domains/AIAgentDomain/services/insights/tools/deadStock.ts
//
// Tool: dead_stock
//
// Answers questions like:
//   - "What inventory isn't moving?"
//   - "Where's my money tied up in dead stock?"
//   - "Which items haven't sold in months?"
//
// Returns items that have stock on hand (stock_quantity > 0) but ZERO
// stock-removing movement (sale/damage/loss adjustments) over the lookback
// window. Surfaces the capital tied up in non-moving inventory
// (stock_quantity × unit cost), most expensive first.
//
// Excludes soft-deleted and discontinued items. Shop-scoped via ctx.shopId.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "dead_stock";
const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

interface DeadStockRow {
  itemId: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  unitCost: number;
  tiedUpValue: number;
}

interface ParsedArgs {
  days: number;
  limit: number;
}

export const deadStock: BusinessInsightsTool = {
  name: NAME,
  description:
    "List inventory that isn't moving — items with stock on hand but no " +
    "sales/usage over a lookback window (default 90 days). Shows the capital " +
    "tied up (stock × unit cost), most expensive first. Use this when the " +
    "user asks 'what's not selling', 'what's my dead stock', 'where's my " +
    "money tied up', or 'which items haven't moved'. For slow-but-still-" +
    "moving items use inventory_turnover (by='slowest') instead.",
  inputSchema: {
    type: "object",
    properties: {
      days: {
        type: "integer",
        minimum: 30,
        maximum: 365,
        description:
          "Lookback window in days for 'no movement' (30-365). Defaults to 90.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIMIT,
        description: "Max items to return (1-25). Defaults to 10.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { days, limit } = parseArgs(args);
    const rows = await fetchDeadStock(ctx.pool, ctx.shopId, days, limit);
    const totalTiedUp = rows.reduce((sum, r) => sum + r.tiedUpValue, 0);

    return {
      data: {
        windowDays: days,
        count: rows.length,
        empty: rows.length === 0,
        totalTiedUpValue: Number(totalTiedUp.toFixed(2)),
        items: rows.map((r) => ({
          name: r.name,
          sku: r.sku,
          stockQuantity: r.stockQuantity,
          unitCost: r.unitCost,
          tiedUpValue: r.tiedUpValue,
        })),
      },
      display: buildDisplay(rows),
    };
  },
};

function parseArgs(args: unknown): ParsedArgs {
  let days = DEFAULT_DAYS;
  let limit = DEFAULT_LIMIT;
  if (args !== null && typeof args === "object") {
    const a = args as Record<string, unknown>;
    if (typeof a.days === "number" && Number.isInteger(a.days)) {
      days = Math.max(30, Math.min(365, a.days));
    }
    if (typeof a.limit === "number" && Number.isInteger(a.limit)) {
      limit = Math.max(1, Math.min(MAX_LIMIT, a.limit));
    }
  }
  return { days, limit };
}

async function fetchDeadStock(
  pool: Pool,
  shopId: string,
  days: number,
  limit: number
): Promise<DeadStockRow[]> {
  // Items with stock on hand that have NO stock-removing adjustment in the
  // window. NOT EXISTS keeps it cheap and avoids fanning out the join.
  const res = await pool.query<{
    id: string;
    name: string;
    sku: string | null;
    stock_quantity: string;
    unit_cost: string;
    tied_up_value: string;
  }>(
    `SELECT
       i.id,
       i.name,
       i.sku,
       i.stock_quantity::text,
       COALESCE(i.cost, 0)::text AS unit_cost,
       (i.stock_quantity * COALESCE(i.cost, 0))::text AS tied_up_value
     FROM inventory_items i
     WHERE i.shop_id = $1
       AND i.deleted_at IS NULL
       AND i.status <> 'discontinued'
       AND i.stock_quantity > 0
       AND NOT EXISTS (
         SELECT 1 FROM inventory_adjustments a
         WHERE a.item_id = i.id
           AND a.adjustment_type IN ('sale', 'damage', 'loss')
           AND a.quantity_change < 0
           AND a.created_at >= NOW() - ($2::int || ' days')::interval
       )
     ORDER BY (i.stock_quantity * COALESCE(i.cost, 0)) DESC, i.name ASC
     LIMIT $3`,
    [shopId, days, limit]
  );

  return res.rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    sku: row.sku,
    stockQuantity: parseInt(row.stock_quantity, 10),
    unitCost: parseFloat(row.unit_cost),
    tiedUpValue: parseFloat(row.tied_up_value),
  }));
}

function buildDisplay(rows: DeadStockRow[]): ToolDisplay {
  if (rows.length === 0) {
    return {
      kind: "list",
      items: [{ label: "Dead-stock items", value: 0 }],
    };
  }
  return {
    kind: "table",
    columns: ["Item", "In stock", "Unit cost", "Tied-up value"],
    rows: rows.map((r) => [
      r.sku ? `${r.name} (${r.sku})` : r.name,
      r.stockQuantity,
      `$${r.unitCost.toFixed(2)}`,
      `$${r.tiedUpValue.toFixed(2)}`,
    ]),
  };
}
