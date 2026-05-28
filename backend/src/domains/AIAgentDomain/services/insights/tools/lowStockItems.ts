// backend/src/domains/AIAgentDomain/services/insights/tools/lowStockItems.ts
//
// Tool: low_stock_items
//
// Answers questions like:
//   - "What's running low?"
//   - "What do I need to reorder?"
//   - "Show me items below threshold."
//
// Returns the items where stock_quantity <= low_stock_threshold. Sorts
// by deficit ratio (lowest stock relative to threshold first) so the
// "most urgent to reorder" appears at the top. Vendor name comes from
// the inventory_vendors join when available.
//
// Excludes:
//   - Soft-deleted items (deleted_at IS NULL)
//   - Discontinued items (status = 'discontinued') — not part of "what to reorder"
//
// Pattern mirrors LowStockAlertService's query so the email-digest path
// and this Insights tool give consistent results.
//
// Shop-scoped via ctx.shopId.

import { Pool } from "pg";
import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";

const NAME = "low_stock_items";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

interface LowStockRow {
  itemId: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  reservedQuantity: number;
  vendorName: string | null;
}

interface ParsedArgs {
  limit: number;
}

export const lowStockItems: BusinessInsightsTool = {
  name: NAME,
  description:
    "List the inventory items this shop has at or below their low-stock " +
    "threshold — the items the shop owner needs to reorder. Results are " +
    "sorted by deficit ratio (most urgent first). Use this when the user " +
    "asks 'what's running low', 'what do I need to reorder', 'show me " +
    "items below threshold', or any specific 'which items' inventory " +
    "question. For overall inventory state (counts + total value) use " +
    "inventory_summary instead.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIMIT,
        description:
          "Max items to return (1-50). Defaults to 10 if not specified.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = parseArgs(args);
    const rows = await fetchLowStock(ctx.pool, ctx.shopId, parsed.limit);

    return {
      data: {
        count: rows.length,
        items: rows.map((r) => ({
          itemId: r.itemId,
          name: r.name,
          sku: r.sku,
          stockQuantity: r.stockQuantity,
          lowStockThreshold: r.lowStockThreshold,
          reservedQuantity: r.reservedQuantity,
          vendorName: r.vendorName,
        })),
        empty: rows.length === 0,
      },
      display: buildDisplay(rows),
    };
  },
};

function parseArgs(args: unknown): ParsedArgs {
  if (args === null || typeof args !== "object") {
    return { limit: DEFAULT_LIMIT };
  }
  const a = args as Record<string, unknown>;
  let limit = DEFAULT_LIMIT;
  if (typeof a.limit === "number" && Number.isInteger(a.limit)) {
    limit = Math.max(1, Math.min(MAX_LIMIT, a.limit));
  }
  return { limit };
}

async function fetchLowStock(
  pool: Pool,
  shopId: string,
  limit: number
): Promise<LowStockRow[]> {
  // Sort by deficit ratio: stock_quantity / NULLIF(low_stock_threshold, 0)
  // — smaller ratio = MORE urgent. NULLIF guards against divide-by-zero
  // when a shop has set threshold to 0 (effectively "always show").
  const res = await pool.query<{
    id: string;
    name: string;
    sku: string | null;
    stock_quantity: string;
    low_stock_threshold: string;
    reserved_quantity: string;
    vendor_name: string | null;
  }>(
    `SELECT
       i.id,
       i.name,
       i.sku,
       i.stock_quantity::text,
       i.low_stock_threshold::text,
       i.reserved_quantity::text,
       v.name AS vendor_name
     FROM inventory_items i
     LEFT JOIN inventory_vendors v ON i.vendor_id = v.id
     WHERE i.shop_id = $1
       AND i.deleted_at IS NULL
       AND i.status <> 'discontinued'
       AND i.stock_quantity <= i.low_stock_threshold
     ORDER BY (i.stock_quantity::float / NULLIF(i.low_stock_threshold, 0)) ASC NULLS FIRST,
              i.name ASC
     LIMIT $2`,
    [shopId, limit]
  );

  return res.rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    sku: row.sku,
    stockQuantity: parseInt(row.stock_quantity, 10),
    lowStockThreshold: parseInt(row.low_stock_threshold, 10),
    reservedQuantity: parseInt(row.reserved_quantity, 10),
    vendorName: row.vendor_name,
  }));
}

function buildDisplay(rows: LowStockRow[]): ToolDisplay {
  if (rows.length === 0) {
    // Empty path — Claude phrases as "Nothing's running low right now."
    return {
      kind: "list",
      items: [{ label: "Items below threshold", value: 0 }],
    };
  }
  return {
    kind: "table",
    columns: ["Item", "In stock", "Threshold", "Vendor"],
    rows: rows.map((r) => [
      r.sku ? `${r.name} (${r.sku})` : r.name,
      r.stockQuantity,
      r.lowStockThreshold,
      r.vendorName ?? "—",
    ]),
  };
}
