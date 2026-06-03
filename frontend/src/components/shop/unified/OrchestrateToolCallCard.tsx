"use client";

import React from "react";
import { InsightsToolCallCard } from "../insights/InsightsToolCallCard";
import { MarketingToolCallCard } from "../marketing-ai/MarketingToolCallCard";
import { PurchaseOrderProposalCard } from "./PurchaseOrderProposalCard";
import { OrchestrateToolCall } from "@/services/api/aiOrchestrate";
import { InsightsToolCall } from "@/services/api/aiInsights";
import { MarketingToolCall } from "@/services/api/aiMarketing";

/**
 * OrchestrateToolCallCard
 *
 * The orchestrator spans both the insights and marketing tool registries, so a
 * single turn can produce either kind of display card. Rather than rebuild any
 * renderer, this delegates to the EXISTING card components based on the
 * display.kind discriminant (the two kind-sets are disjoint):
 *
 *   marketing → audience_summary | campaign_draft | campaign_send | strategy_chips
 *   insights  → number | table | list | sparkline | comparison | follow_ups
 *
 * `onChipClick` is the panel's submit pipeline — both marketing strategy chips
 * and insights follow-up chips resubmit as a fresh user message.
 *
 * Renders nothing when `display` is absent (tool errored) — matches the
 * underlying cards' contract; Claude's prose surfaces the failure.
 */
const MARKETING_KINDS = new Set([
  "audience_summary",
  "campaign_draft",
  "campaign_send",
  "strategy_chips",
  // AI Image Generation (deo/ai-image-generation branch): propose_campaign_image
  // / propose_image_edit emit this kind — route it to MarketingToolCallCard.
  // Lives here so the unified assistant renders the image card once that branch
  // merges (it brings the display variant + the CampaignImageProposalCard
  // renderer in aiMarketing.ts / MarketingToolCallCard).
  "campaign_image_proposal",
]);

export const OrchestrateToolCallCard: React.FC<{
  toolCall: OrchestrateToolCall;
  onChipClick?: (prompt: string) => void;
  /** Pin support — only insights read cards expose the Pin button, so this is
   *  automatically gated to pinnable turns (marketing/PO cards have no pin). */
  onPin?: (questionText: string) => Promise<void>;
  originatingQuestion?: string;
}> = ({ toolCall, onChipClick, onPin, originatingQuestion }) => {
  if (!toolCall.display) return null;

  // Orchestrator-own action card (Phase 4).
  if (toolCall.display.kind === "purchase_order_proposal") {
    return <PurchaseOrderProposalCard d={toolCall.display} />;
  }

  // Cast is safe: the kind check below discriminates which union the display
  // belongs to; the underlying card re-narrows on the same kind.
  if (MARKETING_KINDS.has(toolCall.display.kind)) {
    return (
      <MarketingToolCallCard
        toolCall={toolCall as unknown as MarketingToolCall}
        onChipClick={onChipClick}
      />
    );
  }
  return (
    <InsightsToolCallCard
      toolCall={toolCall as unknown as InsightsToolCall}
      onFollowupClick={onChipClick}
      onPin={onPin}
      originatingQuestion={originatingQuestion}
    />
  );
};
