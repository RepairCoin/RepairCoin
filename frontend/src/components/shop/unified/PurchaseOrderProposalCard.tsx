"use client";

import React, { useState } from "react";
import { Package, Loader2, Check, AlertTriangle } from "lucide-react";
import { inventoryApi } from "@/services/api/inventory";
import { OrchestratePurchaseOrderDisplay } from "@/services/api/aiOrchestrate";

/**
 * PurchaseOrderProposalCard
 *
 * Phase 4 confirm-before-execute card for a proposed restock. The orchestrator
 * PROPOSES (propose_purchase_order); this card is the owner's tap that actually
 * executes it — `inventoryApi.approveSuggestion(id, { autoCreatePO: true })`,
 * which approves the suggestion and (when a vendor is set) creates the real
 * purchase order. Mirrors MarketingToolCallCard's CampaignSendCard pattern:
 * idle → ordering → done / error.
 */
const URGENCY_STYLE: Record<string, string> = {
  critical: "bg-red-900/40 text-red-300 border-red-800/60",
  high: "bg-orange-900/40 text-orange-300 border-orange-800/60",
  medium: "bg-yellow-900/30 text-yellow-300 border-yellow-800/60",
  low: "bg-gray-800 text-gray-300 border-gray-700",
};

export const PurchaseOrderProposalCard: React.FC<{
  d: OrchestratePurchaseOrderDisplay;
}> = ({ d }) => {
  const [state, setState] = useState<"idle" | "ordering" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [createdPO, setCreatedPO] = useState(false);

  const onConfirm = async () => {
    setState("ordering");
    setError(null);
    try {
      const res = await inventoryApi.approveSuggestion(d.suggestionId, {
        autoCreatePO: true,
      });
      setCreatedPO(!!res?.purchaseOrderId);
      setState("done");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Couldn't create the purchase order. Please try again.";
      setError(msg);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-white">
            {createdPO
              ? `Purchase order created — ${d.quantity} × ${d.itemName}`
              : `Approved — ${d.quantity} × ${d.itemName} (add a vendor to generate the PO)`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#0f0f0f] border border-gray-800 px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-[#FFCC00] flex-shrink-0" />
          <p className="text-sm text-white font-semibold truncate">
            {d.itemName}
          </p>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
            URGENCY_STYLE[d.urgency] ?? URGENCY_STYLE.low
          }`}
        >
          {d.urgency}
        </span>
      </div>

      <div className="text-xs text-gray-300 space-y-0.5 mb-2">
        <p>
          Order <span className="font-semibold text-white">{d.quantity}</span>{" "}
          units
          {d.vendorName ? (
            <>
              {" "}
              from <span className="text-white">{d.vendorName}</span>
            </>
          ) : null}
          {typeof d.estimatedTotalCost === "number" ? (
            <> · ~${d.estimatedTotalCost.toFixed(2)}</>
          ) : null}
        </p>
        <p className="text-gray-400">
          In stock: {d.currentStock}
          {typeof d.daysUntilStockout === "number"
            ? ` · ~${d.daysUntilStockout}d to stockout`
            : ""}
        </p>
        {d.reason ? <p className="text-gray-500">{d.reason}</p> : null}
      </div>

      {!d.hasVendor && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded px-2 py-1 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            No vendor set for this item — approving records it, but a PO won&apos;t
            be created until you add a vendor.
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}

      <button
        type="button"
        onClick={onConfirm}
        disabled={state === "ordering"}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#FFD700] text-sm font-medium px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === "ordering" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <Package className="w-3.5 h-3.5" />
            {d.hasVendor ? "Create purchase order" : "Approve"}
          </>
        )}
      </button>
    </div>
  );
};
