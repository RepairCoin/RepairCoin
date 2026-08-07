// The spend ceiling for the homepage assistant — the one guard with no equivalent anywhere else.
//
// Every other AI budget on the platform keys on shopId: canSpend(shopId), AI_TIER_ALLOWANCE, the
// overage cap. A marketing-site visitor has no shop, so none of it applies. This is what stands
// between the homepage and an unbounded bill.
//
// DAILY as well as monthly, and the daily cap is the one that matters. A monthly-only ceiling can be
// drained in an hour by a script, after which the homepage is dark for twenty-nine days — worse than
// the attack it was meant to stop. The daily cap bounds the blast radius of a bad afternoon.
//
// Spend is read from homepage_ai_messages.cost_usd rather than a counter, so it cannot drift from
// what was actually charged: the same rows that record the answer record its cost.

import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

/** Agreed 2026-08-07. Roughly 16,000 answers/month on Haiku with the corpus cached. */
export const MONTHLY_CAP_USD = Number(process.env.HOMEPAGE_AI_MONTHLY_CAP_USD ?? '25');
export const DAILY_CAP_USD = Number(process.env.HOMEPAGE_AI_DAILY_CAP_USD ?? '2');

export interface SpendVerdict {
  allowed: boolean;
  /** Which ceiling stopped it, for the log line and the alert. */
  reason?: 'daily' | 'monthly';
  spentToday: number;
  spentThisMonth: number;
}

export class HomepageAiSpendGuard {
  async check(): Promise<SpendVerdict> {
    try {
      const { rows } = await getSharedPool().query(
        `SELECT
           COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('day', NOW())), 0)::float   AS today,
           COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::float AS month
         FROM homepage_ai_messages
         WHERE cost_usd IS NOT NULL`
      );
      const spentToday = rows[0]?.today ?? 0;
      const spentThisMonth = rows[0]?.month ?? 0;

      if (spentToday >= DAILY_CAP_USD) {
        // Worth an alert either way: this is a launch going unexpectedly well, or an attack.
        logger.warn('Homepage AI daily spend cap reached — serving corpus/fallback only', {
          spentToday, cap: DAILY_CAP_USD,
        });
        return { allowed: false, reason: 'daily', spentToday, spentThisMonth };
      }
      if (spentThisMonth >= MONTHLY_CAP_USD) {
        logger.warn('Homepage AI monthly spend cap reached — serving corpus/fallback only', {
          spentThisMonth, cap: MONTHLY_CAP_USD,
        });
        return { allowed: false, reason: 'monthly', spentToday, spentThisMonth };
      }
      return { allowed: true, spentToday, spentThisMonth };
    } catch (err) {
      // Fail CLOSED. Everywhere else on this surface fails open, because the cost of being wrong is a
      // corpus answer instead of a better one. Here the cost of being wrong is an unbounded bill with
      // no shop to attribute it to, so an unreadable ledger means no model.
      logger.error('Homepage AI spend guard failed — denying the model', {
        error: (err as Error)?.message,
      });
      return { allowed: false, reason: 'daily', spentToday: 0, spentThisMonth: 0 };
    }
  }
}

let _instance: HomepageAiSpendGuard | null = null;
export function getHomepageAiSpendGuard(): HomepageAiSpendGuard {
  if (!_instance) _instance = new HomepageAiSpendGuard();
  return _instance;
}
