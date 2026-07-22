// backend/src/domains/AIAgentDomain/services/recommendations/detectors/slowPeriod.ts
//
// P1 — "Bookings are down — want a promo?".
//
// Uses the SAME comparison as AutoMessageSchedulerService.processLowBookings
// (the 'low_bookings' auto-message trigger): last 7 days vs the trailing 4-week
// weekly average, fires under 50%, with a >= 4 prior-bookings baseline so a
// brand-new shop with no history doesn't get told it's having a bad week.
//
// Kept identical on purpose — a shop should never see "bookings look fine" from
// one feature and "slow week" from another on the same data. If this threshold
// is tuned, tune both.
//
// Action is `assistant`: unlike low stock, there is no screen that answers
// "what should I do about a slow week" — that's judgement, which is exactly
// what the assistant is for.

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector } from '../types';

/** Fire when last-7-day bookings fall below this share of the weekly average. */
const SLOW_RATIO = 0.5;
/** Baseline guard: without enough prior history there is no "normal" to be
 *  below. Matches processLowBookings. */
const MIN_PRIOR_BOOKINGS = 4;

/** Deeper drops are more urgent. */
const HIGH_RATIO = 0.2;
const MEDIUM_RATIO = 0.35;

export const slowPeriodDetector: RecommendationDetector = {
  key: 'slow_period',
  category: 'revenue',
  requiredFeature: 'campaignBuilder',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const stats = await pool.query<{ last7: string; prior28: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last7,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '35 days'
                            AND created_at <  NOW() - INTERVAL '7 days')  AS prior28
       FROM service_orders
       WHERE shop_id = $1 AND status <> 'cancelled'`,
      [shopId]
    );

    const last7 = Number(stats.rows[0]?.last7) || 0;
    const prior28 = Number(stats.rows[0]?.prior28) || 0;
    const weeklyAvg = prior28 / 4;

    if (prior28 < MIN_PRIOR_BOOKINGS) return [];
    if (weeklyAvg <= 0) return [];
    if (last7 >= weeklyAvg * SLOW_RATIO) return [];

    const ratio = last7 / weeklyAvg;
    const severity =
      ratio <= HIGH_RATIO ? 'high' : ratio <= MEDIUM_RATIO ? 'medium' : 'low';
    const downPct = Math.round((1 - ratio) * 100);
    const avgLabel = weeklyAvg.toFixed(1).replace(/\.0$/, '');

    return [
      {
        detectorKey: 'slow_period',
        category: 'revenue',
        severity,
        evidence: {
          bookingsLast7Days: last7,
          weeklyAverage: Number(weeklyAvg.toFixed(1)),
          downPercent: downPct,
        },
        action: {
          kind: 'assistant',
          prompt: `Bookings are down ${downPct}% this week — draft a promotion to fill next week`,
        },
        assistantPrompt: `Bookings are down ${downPct}% this week — draft a promotion to fill next week`,
        title: `Bookings down ${downPct}% this week`,
        description:
          `${last7} booking${last7 === 1 ? '' : 's'} in the last 7 days vs ~${avgLabel}/week ` +
          `normally. Want a promo to fill the gap?`,
      },
    ];
  },
};
