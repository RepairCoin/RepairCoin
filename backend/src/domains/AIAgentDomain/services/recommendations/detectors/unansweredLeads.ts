// backend/src/domains/AIAgentDomain/services/recommendations/detectors/unansweredLeads.ts
//
// P5 — "N leads are waiting for a reply".
//
// A PRIORITY ACTION — it replaces the hardcoded "Follow Up Leads — 8 inquiries
// waiting for response" tile, and unlike most detectors it is genuinely
// time-critical: speed-to-lead is the whole point of the ads loop.
//
// Waiting = lead_status 'new' AND first_response_at IS NULL. Both conditions,
// deliberately: status can be advanced manually without a reply having been
// sent, and a reply can exist on a lead nobody re-statused. A lead only counts
// as unanswered when neither says otherwise.
//
// Duplicates are excluded — chasing a known duplicate is wasted effort.

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector } from '../types';

/** Anything older than this is a dead lead, not a to-do. */
const WINDOW_DAYS = 14;
const MIN_LEADS = 1; // even one unanswered lead is worth surfacing — it's revenue
const HIGH_AT = 5;
const MEDIUM_AT = 3;

export const unansweredLeadsDetector: RecommendationDetector = {
  key: 'unanswered_leads',
  category: 'operations',
  requiredFeature: 'aiLeadFollowUp',

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    // ad_leads has NO shop_id — it hangs off the campaign. Join through
    // ad_campaigns, and exclude soft-deleted campaigns so leads from a removed
    // campaign don't keep nagging.
    const res = await pool.query<{ n: string; oldest_hours: string | null }>(
      `SELECT COUNT(*)::text AS n,
              MAX(EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600)::int::text AS oldest_hours
         FROM ad_leads l
         JOIN ad_campaigns c ON c.id = l.campaign_id AND c.deleted_at IS NULL
        WHERE c.shop_id = $1
          AND l.lead_status = 'new'
          AND l.first_response_at IS NULL
          AND l.is_duplicate = false
          AND l.created_at >= NOW() - make_interval(days => $2)`,
      [shopId, WINDOW_DAYS]
    );

    const count = Number(res.rows[0]?.n ?? 0);
    if (count < MIN_LEADS) return [];

    const oldestHours = Number(res.rows[0]?.oldest_hours ?? 0);
    const severity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    return [
      {
        detectorKey: 'unanswered_leads',
        category: 'operations',
        severity,
        evidence: { waitingLeads: count, oldestHours },
        action: { kind: 'navigate', tab: 'ads' },
        assistantPrompt: `I have ${count} leads waiting for a reply — help me respond to them`,
        title: 'Follow up leads',
        description:
          oldestHours >= 24
            ? `${count} inquir${count === 1 ? 'y has' : 'ies have'} had no reply — the oldest has been waiting ${Math.floor(oldestHours / 24)} day${Math.floor(oldestHours / 24) === 1 ? '' : 's'}.`
            : `${count} inquir${count === 1 ? 'y is' : 'ies are'} waiting for a response.`,
        presentation: 'action',
        ctaLabel: 'Contact Leads',
      },
    ];
  },
};
