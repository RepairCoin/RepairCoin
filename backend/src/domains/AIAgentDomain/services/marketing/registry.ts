// backend/src/domains/AIAgentDomain/services/marketing/registry.ts
//
// Tool registry for the AI Marketing Assistant. Mirrors
// services/insights/registry.ts shape.
//
// Adding a new tool is a two-step: drop the implementation under
// ./tools, then add it to MARKETING_TOOLS below.

import { MarketingTool } from "./types";
import { lookupAudienceCount } from "./tools/lookupAudienceCount";
import { proposeCampaignDraft } from "./tools/proposeCampaignDraft";
import { proposeCampaignSend } from "./tools/proposeCampaignSend";
import { suggestCampaignStrategies } from "./tools/suggestCampaignStrategies";

const MARKETING_TOOLS: readonly MarketingTool[] = Object.freeze([
  // Read-only — segment resolution + preview.
  lookupAudienceCount,
  // Mutating — creates draft campaign + emits proposal.
  proposeCampaignDraft,
  // Mutating — emits send-confirmation proposal for an existing draft.
  proposeCampaignSend,
  // Meta — strategy chips for empty-panel state.
  suggestCampaignStrategies,
]);

const MARKETING_TOOLS_BY_NAME: ReadonlyMap<string, MarketingTool> = new Map(
  MARKETING_TOOLS.map((t) => [t.name, t])
);

export function getMarketingTools(): MarketingTool[] {
  return [...MARKETING_TOOLS];
}

export function getMarketingToolByName(name: string): MarketingTool | undefined {
  return MARKETING_TOOLS_BY_NAME.get(name);
}
