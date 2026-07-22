// backend/src/domains/AIAgentDomain/services/recommendations/detectors/reviewRequests.ts
//
// P5 — "N recent customers could leave a review".
//
// A PRIORITY ACTION, not a card: it's a do-this-now task with a clear button,
// and it replaces the hardcoded "Request Reviews — 12 recent customers
// eligible" tile.
//
// Eligible = a COMPLETED order inside the window that has no service_reviews
// row. Joined on order_id (reviews are per-order, not per-customer) so a repeat
// customer who reviewed once can still be asked about a later visit.
//
// The window matters: asking for a review of a repair from four months ago is
// worse than not asking. Recent completions only.

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector } from '../types';

/** Only ask about work that is still fresh in the customer's mind. */
const WINDOW_DAYS = 30;
/** Below this it isn't worth a dashboard tile. */
const MIN_ELIGIBLE = 3;
const HIGH_AT = 15;
const MEDIUM_AT = 7;

export const reviewRequestsDetector: RecommendationDetector = {
  key: 'review_requests',
  category: 'customers',
  requiredFeature: 'campaignBuilder',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const res = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM service_orders o
        WHERE o.shop_id = $1
          AND o.status = 'completed'
          AND o.created_at >= NOW() - make_interval(days => $2)
          AND NOT EXISTS (
            SELECT 1 FROM service_reviews r WHERE r.order_id::text = o.order_id::text
          )`,
      [shopId, WINDOW_DAYS]
    );

    const count = Number(res.rows[0]?.n ?? 0);
    if (count < MIN_ELIGIBLE) return [];

    const severity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    return [
      {
        detectorKey: 'review_requests',
        category: 'customers',
        severity,
        evidence: { eligibleCustomers: count, windowDays: WINDOW_DAYS },
        action: {
          kind: 'assistant',
          prompt: `Draft a message asking the ${count} customers I served in the last ${WINDOW_DAYS} days to leave a review`,
        },
        assistantPrompt: `Draft a message asking the ${count} customers I served in the last ${WINDOW_DAYS} days to leave a review`,
        title: 'Request reviews',
        description: `${count} recent customer${count === 1 ? '' : 's'} completed a job and haven't reviewed it yet.`,
        presentation: 'action',
        ctaLabel: 'Send Requests',
      },
    ];
  },
};
