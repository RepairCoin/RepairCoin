// backend/src/domains/AIAgentDomain/services/orchestrator/tools/proposePurchaseOrder.ts
//
// Tool: propose_purchase_order
//
// "Order more iPhone 13 screens" / "restock my low items" / "reorder" → picks
// the best pending PO suggestion (reusing the existing POSuggestionService —
// no new reorder logic) and PROPOSES it as a tap-to-confirm card. It does NOT
// place the order; the owner's tap on the card hits
// POST /api/inventory/suggestions/:id/approve { autoCreatePO: true }, which
// creates the real purchase_orders row (G2: confirm-before-execute).

import {
  OrchestratorTool,
  OrchestratorToolContext,
  OrchestratorToolResult,
} from "../types";
import { getPOSuggestionService } from "../../../../../services/POSuggestionService";

const NAME = "propose_purchase_order";

export const proposePurchaseOrder: OrchestratorTool = {
  name: NAME,
  description:
    "Propose a purchase order to restock a low / running-out inventory item. " +
    "Use when the owner says 'order more', 'restock', 'reorder', 'we're low " +
    "on X', or asks to replenish inventory. Optionally pass item_hint to target " +
    "a specific item by name. This PROPOSES one order for the owner to review " +
    "and confirm — it does NOT place the order itself.",
  inputSchema: {
    type: "object",
    properties: {
      item_hint: {
        type: "string",
        description:
          "Optional item name (or part of it) to target, e.g. 'iPhone 13 " +
          "screen'. Omit to propose the highest-priority low-stock item.",
      },
    },
    additionalProperties: false,
  },

  async execute(
    args: unknown,
    ctx: OrchestratorToolContext
  ): Promise<OrchestratorToolResult> {
    const itemHint =
      args && typeof args === "object" && typeof (args as any).item_hint === "string"
        ? ((args as any).item_hint as string).trim().toLowerCase()
        : "";

    const svc = getPOSuggestionService();

    // Prefer existing pending suggestions; generate fresh ones if none exist.
    let suggestions = await svc.getSuggestions(ctx.shopId, { status: "pending" });
    if (suggestions.length === 0) {
      suggestions = await svc.generateSuggestions(ctx.shopId);
    }

    if (itemHint) {
      const matched = suggestions.filter((s) =>
        s.itemName.toLowerCase().includes(itemHint)
      );
      if (matched.length > 0) suggestions = matched;
    }

    if (suggestions.length === 0) {
      return {
        data: {
          found: false,
          message:
            "No low-stock items need reordering right now" +
            (itemHint ? ` matching "${itemHint}"` : "") +
            ".",
        },
      };
    }

    // Pick the best: prefer suggestions that HAVE a vendor (so the confirm
    // actually creates a PO), then by priority score.
    const pick = [...suggestions].sort((a, b) => {
      const av = a.vendorId ? 1 : 0;
      const bv = b.vendorId ? 1 : 0;
      if (av !== bv) return bv - av;
      return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
    })[0];

    const cmp =
      pick.vendorComparisons?.find(
        (c) => c.vendorId === (pick.recommendedVendorId ?? pick.vendorId)
      ) ?? pick.vendorComparisons?.[0];
    const estimatedTotalCost = cmp?.totalCost;

    return {
      data: {
        found: true,
        suggestionId: pick.id,
        itemName: pick.itemName,
        suggestedQuantity: pick.suggestedQuantity,
        currentStock: pick.currentStock,
        daysUntilStockout: pick.daysUntilStockout ?? null,
        urgency: pick.urgency,
        vendorName: pick.vendorName ?? null,
        hasVendor: !!pick.vendorId,
        estimatedTotalCost: estimatedTotalCost ?? null,
        reason: pick.reason,
      },
      display: {
        kind: "purchase_order_proposal",
        suggestionId: pick.id,
        itemName: pick.itemName,
        itemSku: pick.itemSku,
        quantity: pick.suggestedQuantity,
        vendorName: pick.vendorName,
        hasVendor: !!pick.vendorId,
        urgency: pick.urgency,
        currentStock: pick.currentStock,
        daysUntilStockout: pick.daysUntilStockout,
        estimatedTotalCost,
        reason: pick.reason,
      },
    };
  },
};
