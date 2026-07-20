// frontend/src/services/api/aiOrchestrate.ts
//
// Shop-side Unified "Talk To My Business" Assistant (v2). Backed by
// POST /api/ai/orchestrate. See backend:
//   backend/src/domains/AIAgentDomain/controllers/UnifiedAssistantController.ts
//
// ONE conversation that both ANSWERS questions about the shop's business
// (insights tools) and TAKES marketing actions (drafts a campaign), without
// the owner picking a panel. Draft-only — it never sends; sends/POs/refunds
// are confirm-before-execute (Phase 4).
//
// Multi-turn shape mirrors aiInsights / aiMarketing: the caller holds the
// conversation in local state and passes the whole `messages` array
// (alternating user/assistant, starting with user, last message must be user).
//
// Because the orchestrator spans BOTH registries, a tool's `display` hint may
// be an insights ToolDisplay OR a marketing MarketingToolDisplay — the panel's
// OrchestrateToolCallCard branches on `display.kind` to the right renderer.

import apiClient from "./client";
import { ToolDisplay } from "./aiInsights";
import { MarketingToolDisplay } from "./aiMarketing";

export type OrchestrateMessageRole = "user" | "assistant";

export interface OrchestrateMessage {
  role: OrchestrateMessageRole;
  content: string;
}

/**
 * Orchestrator-own ACTION proposal: a purchase order awaiting the owner's tap.
 * Rendered by PurchaseOrderProposalCard; confirm hits
 * POST /api/inventory/suggestions/:id/approve { autoCreatePO: true }.
 */
export type OrchestratePurchaseOrderDisplay = {
  kind: "purchase_order_proposal";
  suggestionId: string;
  itemName: string;
  itemSku?: string;
  quantity: number;
  vendorName?: string;
  hasVendor: boolean;
  urgency: "low" | "medium" | "high" | "critical";
  currentStock: number;
  daysUntilStockout?: number;
  estimatedTotalCost?: number;
  reason: string;
};

/** Union across all three tool groups — reuses the existing card renderers
 *  plus the new PO proposal card. */
export type OrchestrateToolDisplay =
  | ToolDisplay
  | MarketingToolDisplay
  | OrchestratePurchaseOrderDisplay;

/**
 * One tool the orchestrator invoked this turn (across domains). `display` is
 * absent when the tool errored — render nothing; Claude's prose mentions it.
 */
export interface OrchestrateToolCall {
  tool: string;
  args: Record<string, unknown>;
  display?: OrchestrateToolDisplay;
}

export interface OrchestrateResponse {
  reply: string;
  model: string;
  cached: boolean;
  latencyMs: number;
  toolCalls: OrchestrateToolCall[];
  // WS3 soft-landing — true once the shop's monthly AI allowance is spent (reply
  // still came through on a lighter model). Powers the AiLimitNotice banner.
  limitReached?: boolean;
  overageCapReached?: boolean;
  budgetUsd?: number;
  spentUsd?: number;
}

/**
 * Validation bounds the backend enforces (the orchestrator reuses
 * InsightsController.parseInsightsRequest — hence 4000 chars / 30 messages).
 */
export const ORCHESTRATE_LIMITS = {
  maxMessages: 30,
  maxContentChars: 4000,
  maxSessionIdChars: 64,
} as const;

/**
 * Ask the Unified Assistant. Reuse one `sessionId` per panel session — the
 * backend groups audit rows (ai_orchestrate_messages) by it.
 *
 * Errors the panel should render:
 *   - 401 → session expired; nudge re-login.
 *   - 400 → validation failure (message says what).
 *   - 429 → monthly AI budget exhausted.
 *   - 503 → AI service degraded; retry later.
 */
export const askOrchestrate = async (
  sessionId: string,
  messages: OrchestrateMessage[],
  /** Phase 9 — URL of an image the owner attached to this turn (paperclip).
   *  The backend only honors a shop-owned URL; omit when there's no attachment. */
  attachedImageUrl?: string,
  /** URL of the image currently displayed in the panel (last proposal). Lets
   *  "edit this" target what the owner sees — and keep its size. */
  lastImageUrl?: string
): Promise<OrchestrateResponse> => {
  const response = await apiClient.post(
    "/ai/orchestrate",
    {
      sessionId,
      messages,
      ...(attachedImageUrl ? { attachedImageUrl } : {}),
      ...(lastImageUrl ? { lastImageUrl } : {}),
    },
    // The orchestrator can call image tools — gpt-image-1 landscape gen has been
    // observed up to ~81s, plus storage + LLM round-trips. Match the backend's
    // 240s ceiling for this route, or a worst-case regenerate times out.
    { timeout: 240000 }
  );
  // Axios interceptor pre-unwraps response.data — read response.data.X, not
  // response.data.data.X. The `|| response.data` covers interceptor bypass.
  return response.data.data || response.data;
};
