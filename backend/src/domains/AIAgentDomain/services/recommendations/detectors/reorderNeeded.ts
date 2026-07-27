// backend/src/domains/AIAgentDomain/services/recommendations/detectors/reorderNeeded.ts
//
// P5 — "N purchase suggestions waiting for review".
//
// ⚠️ Deliberately does NOT call the reorder_recommendation insights tool, even
// though that would be the obvious reuse. That tool calls
// POSuggestionService.generateSuggestions(), which **INSERTs into
// purchase_order_suggestions** — it is a write dressed as a read. Running it
// from a nightly detector across every shop would silently manufacture purchase
// suggestions as a side effect. (It did exactly that during P5 verification:
// 12 rows created across 5 shops before it was caught and cleaned up.)
//
// A detector must be read-only. So this reads the suggestions table directly
// and reports on what is ALREADY pending — which is also the more honest card:
// "you have suggestions waiting", not "I just made some for you".

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector } from '../types';

const MIN_ITEMS = 3;
const HIGH_AT = 12;
const MEDIUM_AT = 6;

export const reorderNeededDetector: RecommendationDetector = {
  key: 'reorder_needed',
  category: 'inventory',
  requiredFeature: 'inventoryManagement',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const res = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM purchase_order_suggestions
        WHERE shop_id = $1 AND status = 'pending'`,
      [shopId]
    );

    const count = Number(res.rows[0]?.n ?? 0);
    if (count < MIN_ITEMS) return [];

    const severity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    return [
      {
        detectorKey: 'reorder_needed',
        category: 'inventory',
        severity,
        evidence: { pendingSuggestions: count },
        action: { kind: 'navigate', tab: 'purchase-orders' },
        assistantPrompt: `What should I reorder, and how much of each?`,
        title: `${count} purchase suggestion${count === 1 ? '' : 's'} to review`,
        description: `${count} reorder suggestion${count === 1 ? ' is' : 's are'} waiting for your approval.`,
      },
    ];
  },
};
