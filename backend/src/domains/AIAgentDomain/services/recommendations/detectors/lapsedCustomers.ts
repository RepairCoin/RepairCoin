// backend/src/domains/AIAgentDomain/services/recommendations/detectors/lapsedCustomers.ts
//
// P1 — "Re-engage N inactive customers".
//
// Reuses CustomerRepository.findLapsedBookers, NOT a fresh query. That method is
// the CORRECTED definition of lapsed: it sources from service_orders, because
// "lapsed" for a repair shop means "hasn't booked", not "has no RCN token
// activity". The transactions-based version targeted the wrong people (someone
// who booked today but had no token movement looked lapsed) — see
// project_lapsed_audience_data_model.
//
// Reusing it also guarantees the card's number matches what the campaign will
// actually target. A card claiming 87 that hands the campaign a different 87 is
// the same class of lie as the mock this replaces.

import { Pool } from 'pg';
import { customerRepository } from '../../../../../repositories';
import { RecCandidate, RecommendationDetector } from '../types';

/** Days without a booking before a customer counts as lapsed. */
const LAPSED_DAYS = 90;

/** Minimum-signal floor. A win-back campaign for 3 people is not worth a slot on
 *  the dashboard — surfacing it trains the owner to ignore the feed. Mirrors
 *  AnomalyDetector's MIN_SIGNAL reasoning. */
const MIN_LAPSED = 5;

/** Severity scales with how much of the base has drifted away. */
const HIGH_AT = 25;
const MEDIUM_AT = 10;

export const lapsedCustomersDetector: RecommendationDetector = {
  key: 'lapsed_customers',
  category: 'customers',
  // The action opens the campaign composer, so a shop without it would be told
  // to do something it cannot do.
  requiredFeature: 'campaignBuilder',

  async detect(_pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const lapsed = await customerRepository.findLapsedBookers(
      shopId,
      LAPSED_DAYS
    );
    const count = lapsed.length;
    if (count < MIN_LAPSED) return [];

    const severity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    return [
      {
        detectorKey: 'lapsed_customers',
        category: 'customers',
        severity,
        evidence: { inactiveCustomers: count, days: LAPSED_DAYS },
        action: { kind: 'campaign', audience: `lapsed_${LAPSED_DAYS}d` },
        assistantPrompt:
          `Draft a win-back campaign for the ${count} customers who haven't ` +
          `booked in ${LAPSED_DAYS} days`,
        title: `Re-engage ${count} inactive customer${count === 1 ? '' : 's'}`,
        description:
          `${count} customer${count === 1 ? " hasn't" : "s haven't"} booked in ` +
          `${LAPSED_DAYS} days. Send them a win-back offer.`,
      },
    ];
  },
};
