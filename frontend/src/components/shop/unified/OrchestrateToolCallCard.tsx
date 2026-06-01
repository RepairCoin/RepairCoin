"use client";

import React from "react";
import { InsightsToolCallCard } from "../insights/InsightsToolCallCard";
import { MarketingToolCallCard } from "../marketing-ai/MarketingToolCallCard";
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
]);

export const OrchestrateToolCallCard: React.FC<{
  toolCall: OrchestrateToolCall;
  onChipClick?: (prompt: string) => void;
}> = ({ toolCall, onChipClick }) => {
  if (!toolCall.display) return null;

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
    />
  );
};
