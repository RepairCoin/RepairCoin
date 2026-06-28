// backend/src/domains/AIAgentDomain/services/orchestrator/registry.ts
//
// Registry of orchestrator-OWN tools (cross-domain actions that don't belong
// to the insights or marketing panels). Merged into the unified orchestrator's
// tool list alongside getInsightsTools() + getMarketingTools(); kept separate
// so these action tools never leak into the standalone Insights/Marketing
// panels.

import { OrchestratorTool } from "./types";
import { proposePurchaseOrder } from "./tools/proposePurchaseOrder";
import { rememberThis } from "./tools/rememberThis";

// remember_this is always registered (so dispatch can resolve it), but the
// UnifiedAssistantController only OFFERS it to the model when ENABLE_AI_MEMORY
// is on — so it costs nothing when the feature is off.
const ORCHESTRATOR_TOOLS: readonly OrchestratorTool[] = [
  proposePurchaseOrder,
  rememberThis,
];

const BY_NAME = new Map<string, OrchestratorTool>(
  ORCHESTRATOR_TOOLS.map((t) => [t.name, t])
);

export function getOrchestratorOwnTools(): OrchestratorTool[] {
  return [...ORCHESTRATOR_TOOLS];
}

export function getOrchestratorOwnToolByName(
  name: string
): OrchestratorTool | undefined {
  return BY_NAME.get(name);
}
