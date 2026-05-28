// backend/src/domains/AIAgentDomain/services/insights/registry.ts
//
// Tool registry for the Business-Data Insights toolkit. Lists every
// BusinessInsightsTool the controller hands to Anthropic per request.
//
//   - getInsightsTools()            — full array, stable order, for
//                                     AnthropicClient.complete({ tools }).
//   - getInsightsToolByName(name)   — dispatch lookup after Anthropic
//                                     returns a tool_use block.
//
// Adding a new tool is a two-step: drop the implementation under
// ./tools, then add it to INSIGHTS_TOOLS below. Order is stable but
// not semantically meaningful to Claude — grouped for human reading.

import { BusinessInsightsTool } from "./types";
import { revenueSummary } from "./tools/revenueSummary";
import { topCustomers } from "./tools/topCustomers";
import { topServices } from "./tools/topServices";
import { bookingsBreakdown } from "./tools/bookingsBreakdown";
import { aiAssistantImpact } from "./tools/aiAssistantImpact";
// Phase 6.2 — breadth expansion.
import { customerTierDistribution } from "./tools/customerTierDistribution";
import { rcnBalanceSummary } from "./tools/rcnBalanceSummary";
import { cancellationBreakdown } from "./tools/cancellationBreakdown";
import { repeatCustomerAnalysis } from "./tools/repeatCustomerAnalysis";
import { timeOfDayPattern } from "./tools/timeOfDayPattern";
// Phase 6.3 — meta-tool for AI-suggested follow-up chips.
import { suggestFollowups } from "./tools/suggestFollowups";
// Phase 8.1 — inventory tools.
import { inventoryStockSummary } from "./tools/inventoryStockSummary";
import { lowStockItems } from "./tools/lowStockItems";
import { inventoryTurnover } from "./tools/inventoryTurnover";
import { inventoryValueTrend } from "./tools/inventoryValueTrend";

const INSIGHTS_TOOLS: readonly BusinessInsightsTool[] = Object.freeze([
  // v1 (Phase 2)
  revenueSummary,
  topCustomers,
  topServices,
  bookingsBreakdown,
  aiAssistantImpact,
  // Phase 6.2 — breadth expansion
  customerTierDistribution,
  rcnBalanceSummary,
  cancellationBreakdown,
  repeatCustomerAnalysis,
  timeOfDayPattern,
  // Phase 8.1 — inventory tools.
  inventoryStockSummary,
  lowStockItems,
  inventoryTurnover,
  inventoryValueTrend,
  // Phase 6.3 — meta-tools (no DB access; Claude orchestration).
  suggestFollowups,
]);

const INSIGHTS_TOOLS_BY_NAME: ReadonlyMap<string, BusinessInsightsTool> =
  new Map(INSIGHTS_TOOLS.map((t) => [t.name, t]));

/**
 * Full set of insights tools, ready to hand to
 * `AnthropicClient.complete({ tools })`. Returns a mutable copy so
 * callers can't accidentally mutate the registry.
 */
export function getInsightsTools(): BusinessInsightsTool[] {
  return [...INSIGHTS_TOOLS];
}

/**
 * Lookup by name. Returns undefined when no tool with that name is
 * registered — the dispatcher treats that as a "Claude hallucinated a
 * tool name" condition and surfaces a non-throwing ToolDispatchResult
 * with `ok: false`.
 */
export function getInsightsToolByName(
  name: string
): BusinessInsightsTool | undefined {
  return INSIGHTS_TOOLS_BY_NAME.get(name);
}
