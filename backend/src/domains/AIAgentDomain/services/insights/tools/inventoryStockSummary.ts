// backend/src/domains/AIAgentDomain/services/insights/tools/inventoryStockSummary.ts
//
// Tool: inventory_summary
//
// Answers questions like:
//   - "How much inventory do I have?"
//   - "What's my stock value?"
//   - "How many items are running low?"
//   - "What's the state of my inventory?"
//
// Aggregate-only single SQL query against `inventory_items`:
//   - items_in_stock      — count of items with stock_quantity > 0 and status NOT IN ('out_of_stock','discontinued')
//   - items_low_stock     — count of items at or below low_stock_threshold (and still in stock)
//   - items_out_of_stock  — count of items with stock_quantity = 0 or status = 'out_of_stock'
//   - items_discontinued  — count of discontinued items (not counted as "in stock")
//   - total_inventory_value — SUM(stock_quantity * cost) for items not soft-deleted
//
// Soft-delete aware (`deleted_at IS NULL`).
// Shop-scoped via ctx.shopId (JWT-sourced, hardcoded in the SQL).
//
// No args — aggregate-only in v1 (no category filter, no by-vendor breakdown).

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "inventory_summary";

interface InventoryCounts {
  itemsInStock: number;
  itemsLowStock: number;
  itemsOutOfStock: number;
  itemsDiscontinued: number;
  totalInventoryValue: number;
}

export const inventoryStockSummary: BusinessInsightsTool = {
  name: NAME,
  description:
    "Look up this shop's overall inventory state — how many items are " +
    "in stock, how many are running low (at or below their low-stock " +
    "threshold), how many are out of stock, and the total value of " +
    "current inventory (sum of stock_quantity × unit cost). Use this " +
    "when the user asks anything like 'how much inventory do I have', " +
    "'what's my stock value', 'how many items are running low', or any " +
    "high-level inventory question that doesn't name specific items. " +
    "For 'what items are running low?' use low_stock_items instead.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute(_args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const counts = await fetchCounts(ctx.pool, ctx.shopId);

    // Empty-shop hint — Claude reads this and phrases an honest empty
    // state instead of presenting four zeros as if they were data.
    const empty =
      counts.itemsInStock === 0 &&
      counts.itemsLowStock === 0 &&
      counts.itemsOutOfStock === 0 &&
      counts.itemsDiscontinued === 0;

    return {
      data: {
        itemsInStock: counts.itemsInStock,
        itemsLowStock: counts.itemsLowStock,
        itemsOutOfStock: counts.itemsOutOfStock,
        itemsDiscontinued: counts.itemsDiscontinued,
        totalInventoryValue: counts.totalInventoryValue,
        empty,
      },
      display: buildDisplay(counts, empty),
    };
  },
};

async function fetchCounts(pool: Pool, shopId: string): Promise<InventoryCounts> {
  // Single aggregate query — filter clauses count per category in one
  // pass. Discontinued items are EXCLUDED from the total_inventory_value
  // because they're not part of usable stock.
  const res = await pool.query<{
    items_in_stock: string;
    items_low_stock: string;
    items_out_of_stock: string;
    items_discontinued: string;
    total_inventory_value: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE stock_quantity > 0
           AND status NOT IN ('out_of_stock', 'discontinued')
       )::text AS items_in_stock,
       COUNT(*) FILTER (
         WHERE stock_quantity > 0
           AND stock_quantity <= low_stock_threshold
           AND status NOT IN ('out_of_stock', 'discontinued')
       )::text AS items_low_stock,
       COUNT(*) FILTER (
         WHERE stock_quantity = 0
           OR status = 'out_of_stock'
       )::text AS items_out_of_stock,
       COUNT(*) FILTER (
         WHERE status = 'discontinued'
       )::text AS items_discontinued,
       COALESCE(SUM(
         CASE
           WHEN status = 'discontinued' THEN 0
           ELSE stock_quantity * cost
         END
       ), 0)::text AS total_inventory_value
     FROM inventory_items
     WHERE shop_id = $1
       AND deleted_at IS NULL`,
    [shopId]
  );

  const row = res.rows[0];
  return {
    itemsInStock: parseInt(row?.items_in_stock ?? "0", 10),
    itemsLowStock: parseInt(row?.items_low_stock ?? "0", 10),
    itemsOutOfStock: parseInt(row?.items_out_of_stock ?? "0", 10),
    itemsDiscontinued: parseInt(row?.items_discontinued ?? "0", 10),
    totalInventoryValue: parseFloat(row?.total_inventory_value ?? "0"),
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

function buildDisplay(counts: InventoryCounts, empty: boolean): ToolDisplay {
  // Empty case — show the empty state hint in the list. Claude's prose
  // will lead with "You don't have inventory items configured yet."
  if (empty) {
    return {
      kind: "list",
      items: [
        { label: "Inventory state", value: "No items configured" },
      ],
    };
  }
  return {
    kind: "list",
    items: [
      { label: "Items in stock", value: counts.itemsInStock },
      { label: "Items running low", value: counts.itemsLowStock },
      { label: "Items out of stock", value: counts.itemsOutOfStock },
      { label: "Total inventory value", value: fmtUsd(counts.totalInventoryValue) },
    ],
  };
}
