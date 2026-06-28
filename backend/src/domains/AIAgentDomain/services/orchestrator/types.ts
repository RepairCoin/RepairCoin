// backend/src/domains/AIAgentDomain/services/orchestrator/types.ts
//
// Orchestrator-OWN tools — cross-domain ACTIONS that don't belong to any single
// panel's registry (so they must NOT live in the insights or marketing
// registries, or they'd leak into those standalone panels). The unified
// orchestrator merges these alongside the insights + marketing tools.
//
// Phase 4: propose_purchase_order (confirm-before-execute inventory action).

import { Pool } from "pg";
import { ClaudeTool } from "../../types";

export interface OrchestratorToolContext {
  shopId: string;
  pool: Pool;
}

/**
 * Frontend rendering hint for an orchestrator-own tool. These are ACTION
 * proposals — the card renders a tap-to-confirm control; the owner's tap
 * executes the action (G2: confirm-before-execute).
 */
export type OrchestratorToolDisplay =
  | {
      // A proposed purchase order for a low-stock item. The card confirms via
      // POST /api/inventory/suggestions/:id/approve { autoCreatePO: true }.
      kind: "purchase_order_proposal";
      suggestionId: string;
      itemName: string;
      itemSku?: string;
      quantity: number;
      vendorName?: string;
      /** False when the suggestion has no vendor — approving won't create a PO
       *  until a vendor is set; the card surfaces this. */
      hasVendor: boolean;
      urgency: "low" | "medium" | "high" | "critical";
      currentStock: number;
      daysUntilStockout?: number;
      estimatedTotalCost?: number;
      reason: string;
    }
  | {
      // AI Memory (Phase 1): confirmation that a standing owner instruction was
      // saved. Informational — no tap-to-confirm action; the assistant also
      // confirms in prose. The settings UI (Phase 2) manages saved memories.
      kind: "memory_saved";
      content: string;
      memoryKind: "preference" | "instruction" | "decision" | "correction";
    };

export interface OrchestratorToolResult {
  data: Record<string, unknown>;
  display?: OrchestratorToolDisplay;
}

export interface OrchestratorTool extends ClaudeTool {
  execute(
    args: unknown,
    ctx: OrchestratorToolContext
  ): Promise<OrchestratorToolResult>;
}
