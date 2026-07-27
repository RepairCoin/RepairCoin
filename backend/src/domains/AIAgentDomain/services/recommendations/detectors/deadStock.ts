// backend/src/domains/AIAgentDomain/services/recommendations/detectors/deadStock.ts
//
// P5 — "$X tied up in stock that isn't moving".
//
// Calls the existing dead_stock insights tool. Severity keys off the VALUE tied
// up rather than the item count: ten forgotten cables matter less than one
// expensive part sitting for months, and the money is what makes it worth a
// dashboard slot.

import { Pool } from 'pg';
import { deadStock } from '../../insights/tools/deadStock';
import { RecCandidate, RecommendationDetector } from '../types';

/** Below this there is nothing worth acting on — clearing $20 of stock is not
 *  a business decision. */
const MIN_TIED_UP_USD = 100;
const HIGH_AT_USD = 1000;
const MEDIUM_AT_USD = 400;

export const deadStockDetector: RecommendationDetector = {
  key: 'dead_stock',
  category: 'inventory',
  requiredFeature: 'inventoryManagement',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const result = await deadStock.execute({}, { shopId, pool });
    const data = result.data as {
      count: number;
      totalTiedUpValue: number;
      windowDays: number;
    };

    const tiedUp = Number(data?.totalTiedUpValue ?? 0);
    const count = data?.count ?? 0;
    if (count === 0 || tiedUp < MIN_TIED_UP_USD) return [];

    const severity =
      tiedUp >= HIGH_AT_USD
        ? 'high'
        : tiedUp >= MEDIUM_AT_USD
        ? 'medium'
        : 'low';

    const money = `$${Math.round(tiedUp).toLocaleString('en-US')}`;

    return [
      {
        detectorKey: 'dead_stock',
        category: 'inventory',
        severity,
        evidence: {
          tiedUpValue: Math.round(tiedUp),
          items: count,
          windowDays: data.windowDays,
        },
        action: { kind: 'navigate', tab: 'inventory' },
        assistantPrompt: `Which stock hasn't moved, and what should I do with it?`,
        title: `${money} tied up in dead stock`,
        description:
          count === 1
            ? `1 item hasn't sold in ${data.windowDays} days. Consider discounting or returning it.`
            : `${count} items haven't sold in ${data.windowDays} days. Consider discounting or returning them.`,
      },
    ];
  },
};
