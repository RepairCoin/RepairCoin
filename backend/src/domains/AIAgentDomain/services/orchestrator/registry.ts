// backend/src/domains/AIAgentDomain/services/orchestrator/registry.ts
//
// Registry of orchestrator-OWN tools (cross-domain actions that don't belong
// to the insights or marketing panels). Merged into the unified orchestrator's
// tool list alongside getInsightsTools() + getMarketingTools(); kept separate
// so these action tools never leak into the standalone Insights/Marketing
// panels.

import { OrchestratorTool } from "./types";
import { proposePurchaseOrder } from "./tools/proposePurchaseOrder";

const ORCHESTRATOR_TOOLS: readonly OrchestratorTool[] = [proposePurchaseOrder];

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
