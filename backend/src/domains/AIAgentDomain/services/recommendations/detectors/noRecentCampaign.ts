// backend/src/domains/AIAgentDomain/services/recommendations/detectors/noRecentCampaign.ts
//
// "You haven't run a campaign in a while" — the first detector in the
// `marketing` category, which until now had none (so that chip could never
// light up).
//
// ⚠️ CALIBRATION — why the obvious version was rejected.
// "No campaign sent in 30 days" matches 63 of 65 active shops. A card that
// fires for everyone is an advertisement, not a recommendation, and shipping
// one teaches owners to ignore the whole feed — which costs more than an empty
// chip does.
//
// So this requires the shop to have SENT AT LEAST ONE campaign before. That
// turns it from "you should buy into marketing" into "you were doing this and
// stopped", which is a genuine, personal observation. On staging that is 8
// shops rather than 63.
//
// A shop that has never campaigned is a SALES opportunity, not a dashboard
// recommendation — deliberately out of scope here.

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector } from '../types';

/** How long since the last send before it counts as having gone quiet. */
const QUIET_DAYS = 30;
/** Don't nag a shop with nobody to send to.
 *
 *  Counts customers who are actually CONTACTABLE — a customer record with an
 *  email. An earlier version counted every distinct customer_address in
 *  service_orders and the card said "N customers you could reach", which
 *  overstated it: peanut had 8 order customers but only 7 with an email. The
 *  card must not claim reach it cannot deliver.
 *
 *  Sourced from service_orders rather than customers.home_shop_id — only
 *  imported customers carry home_shop_id, so that version matched 0 shops.
 *  See project_lapsed_audience_data_model. */
const MIN_AUDIENCE = 5;

const HIGH_AT_DAYS = 90;
const MEDIUM_AT_DAYS = 60;

export const noRecentCampaignDetector: RecommendationDetector = {
  key: 'no_recent_campaign',
  category: 'marketing',
  requiredFeature: 'campaignBuilder',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const res = await pool.query<{
      last_sent: Date | null;
      ever_sent: string;
      audience: string;
    }>(
      `SELECT
         (SELECT MAX(sent_at) FROM marketing_campaigns
           WHERE shop_id = $1 AND status = 'sent')                       AS last_sent,
         (SELECT COUNT(*)::text FROM marketing_campaigns
           WHERE shop_id = $1 AND status = 'sent')                       AS ever_sent,
         (SELECT COUNT(DISTINCT c.address)::text
            FROM service_orders o
            JOIN customers c ON LOWER(c.address) = LOWER(o.customer_address)
           WHERE o.shop_id = $1
             AND c.is_active
             AND c.email IS NOT NULL AND c.email <> '')                  AS audience`,
      [shopId]
    );

    const row = res.rows[0];
    const everSent = Number(row?.ever_sent ?? 0);
    const audience = Number(row?.audience ?? 0);

    // Never campaigned → not a recommendation (see the note above).
    if (everSent === 0) return [];
    if (audience < MIN_AUDIENCE) return [];
    if (!row?.last_sent) return [];

    const daysSince = Math.floor(
      (Date.now() - new Date(row.last_sent).getTime()) / 86_400_000
    );
    if (daysSince < QUIET_DAYS) return [];

    const severity =
      daysSince >= HIGH_AT_DAYS
        ? 'high'
        : daysSince >= MEDIUM_AT_DAYS
        ? 'medium'
        : 'low';

    return [
      {
        detectorKey: 'no_recent_campaign',
        category: 'marketing',
        severity,
        evidence: { daysSinceLastCampaign: daysSince, contactableCustomers: audience },
        action: {
          kind: 'assistant',
          prompt: `It's been ${daysSince} days since my last campaign — draft one for my ${audience} customers with an email`,
        },
        assistantPrompt: `It's been ${daysSince} days since my last campaign — draft one for my ${audience} customers with an email`,
        title: `No campaign in ${daysSince} days`,
        description: `${audience} of your customers have an email on file. Your last campaign went out ${daysSince} days ago.`,
      },
    ];
  },
};
