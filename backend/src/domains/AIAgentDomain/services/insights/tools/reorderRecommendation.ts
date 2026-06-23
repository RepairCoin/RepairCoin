// backend/src/domains/AIAgentDomain/services/insights/tools/reorderRecommendation.ts
//
// Tool: reorder_recommendation
//
// Answers questions like:
//   - "What should I reorder, and how much?"
//   - "What are my smart purchase order suggestions?"
//   - "What's most urgent to restock?"
//
// Wraps the existing POSuggestionService (the engine behind the "Smart
// Purchase Order Suggestions" card), so the assistant gives the exact same
// usage-analytics-based recommendations: suggested quantity, days until
// stockout, average daily usage, and urgency — per item, most urgent first.
//
// Differs from low_stock_items (which only lists what's below threshold):
// this recommends HOW MUCH to order based on real usage velocity.
//
// Shop-scoped via ctx.shopId.

import {
  BusinessInsightsTool,
  ToolContext,
  ToolDisplay,
  ToolResult,
} from "../types";
import { getPOSuggestionService } from "../../../../../services/POSuggestionService";

const NAME = "reorder_recommendation";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

interface ParsedArgs {
  limit: number;
}

export const reorderRecommendation: BusinessInsightsTool = {
  name: NAME,
  description:
    "Recommend what inventory to reorder and how much, based on real usage " +
    "analytics. Returns per-item suggested order quantity, average daily " +
    "usage, days until stockout, and urgency (most urgent first). Use this " +
    "when the user asks 'what should I reorder', 'how much should I order', " +
    "'what are my purchase order suggestions', or 'what's most urgent to " +
    "restock'. For a plain list of items below threshold (no quantities) use " +
    "low_stock_items instead.",
  inputSchema: {
    type: "object",
    properties: {
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
    const { limit } = parseArgs(args);

    const suggestions = await getPOSuggestionService().generateSuggestions(
      ctx.shopId
    );

    // Most urgent first: critical > high > medium > low, then soonest stockout.
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...suggestions].sort((a, b) => {
      const u = (rank[a.urgency] ?? 9) - (rank[b.urgency] ?? 9);
      if (u !== 0) return u;
      return (a.daysUntilStockout ?? 9999) - (b.daysUntilStockout ?? 9999);
    });
    const items = sorted.slice(0, limit).map((s) => ({
      name: s.itemName,
      sku: s.itemSku ?? null,
      currentStock: s.currentStock,
      suggestedQuantity: s.suggestedQuantity,
      avgDailyUsage: s.avgDailyUsage,
      daysUntilStockout: s.daysUntilStockout ?? null,
      urgency: s.urgency,
      vendorName: s.vendorName ?? null,
    }));

    return {
      data: {
        count: items.length,
        totalSuggestions: suggestions.length,
        empty: items.length === 0,
        items,
      },
      display: buildDisplay(items),
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

function buildDisplay(
  rows: Array<{
    name: string;
    sku: string | null;
    currentStock: number;
    suggestedQuantity: number;
    daysUntilStockout: number | null;
    urgency: string;
  }>
): ToolDisplay {
  if (rows.length === 0) {
    return {
      kind: "list",
      items: [{ label: "Items to reorder", value: 0 }],
    };
  }
  return {
    kind: "table",
    columns: ["Item", "In stock", "Order", "Days left", "Urgency"],
    rows: rows.map((r) => [
      r.sku ? `${r.name} (${r.sku})` : r.name,
      r.currentStock,
      r.suggestedQuantity,
      r.daysUntilStockout ?? "—",
      r.urgency,
    ]),
  };
}
