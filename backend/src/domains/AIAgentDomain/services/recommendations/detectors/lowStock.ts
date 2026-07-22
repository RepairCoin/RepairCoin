// backend/src/domains/AIAgentDomain/services/recommendations/detectors/lowStock.ts
//
// P1 — "N items running low".
//
// Calls the existing low_stock_items insights tool rather than re-implementing
// its query. ToolContext is just { shopId, pool }, so the tool is directly
// callable — which means this detector and the assistant's answer to "what's
// running low?" can never disagree. (The tool's own predicate already mirrors
// LowStockAlertService, so the email digest agrees too.)
//
// The primary action is NAVIGATE, not assistant: the inventory table already
// answers "which items", so spending a Claude turn to re-render a list the shop
// has a page for would be slower and worse. The assistant stays one tap away
// via assistantPrompt.

import { Pool } from 'pg';
import { lowStockItems } from '../../insights/tools/lowStockItems';
import { RecCandidate, RecommendationDetector } from '../types';

/** One item below threshold is routine restocking, not a dashboard alert. */
const MIN_ITEMS = 3;

const HIGH_AT = 15;
const MEDIUM_AT = 7;

/** The tool caps at 50; we only need a count plus a couple of names. */
const FETCH_LIMIT = 50;

export const lowStockDetector: RecommendationDetector = {
  key: 'low_stock',
  category: 'inventory',
  requiredFeature: 'inventoryManagement',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const result = await lowStockItems.execute(
      { limit: FETCH_LIMIT },
      { shopId, pool }
    );
    const data = result.data as {
      count: number;
      items: Array<{ name: string }>;
    };

    const count = data?.count ?? 0;
    if (count < MIN_ITEMS) return [];

    const severity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    // The tool sorts by deficit ratio, so the head of the list is the most
    // urgent — worth naming in the copy to make the card concrete.
    const topItem = data.items?.[0]?.name ?? null;

    return [
      {
        detectorKey: 'low_stock',
        category: 'inventory',
        severity,
        evidence: topItem
          ? { itemsBelowThreshold: count, mostUrgent: topItem }
          : { itemsBelowThreshold: count },
        action: { kind: 'navigate', tab: 'inventory' },
        assistantPrompt: `Which ${count} items are running low and what should I reorder?`,
        title: `${count} item${count === 1 ? '' : 's'} running low`,
        description: topItem
          ? `${topItem} and ${count - 1} other${count - 1 === 1 ? '' : 's'} are at or below their reorder threshold.`
          : `${count} items are at or below their reorder threshold.`,
      },
    ];
  },
};
