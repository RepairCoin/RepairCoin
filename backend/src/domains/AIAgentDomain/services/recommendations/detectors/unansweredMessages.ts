// backend/src/domains/AIAgentDomain/services/recommendations/detectors/unansweredMessages.ts
//
// "N customers are waiting for a reply" — the UNIVERSAL operations signal.
//
// Why this exists alongside unanswered_leads: ad leads only exist for shops
// that pay for the Ads add-on. Only 2 of 65 active shops have any ad campaign,
// so unanswered_leads alone left `operations` a dead category for almost
// everyone — the same problem the marketing detector was built to fix.
// Every shop has customer messages.
//
// Kept as a SEPARATE card from unanswered_leads rather than merged: a paid
// lead and a customer conversation are different work, go to different screens,
// and a shop with both should see both.
//
// WHAT COUNTS AS UNANSWERED
// The newest message in the conversation is from the CUSTOMER, and it has been
// sitting for longer than QUIET_HOURS. Deliberately NOT `unread_count_shop > 0`,
// which only means the shop hasn't OPENED it — an owner who read a message and
// chose not to reply would be nagged forever.
//
// "Newest message is from the customer" also handles AI auto-replies for free:
// if the AI answered, that reply IS the newest message and the conversation
// drops out. No card telling the owner to do something already done.
//
// Age is compared inside SQL on purpose. messages.created_at is `timestamp
// without time zone` while other tables use timestamptz, so NOW() - created_at
// in Postgres (both GMT here) is right where a JS Date subtraction can be
// hours off.

import { Pool } from 'pg';
import { RecCandidate, RecommendationDetector, RecSeverity } from '../types';

/** How long a customer waits before it counts as unanswered. Short enough to
 *  be useful, long enough that a shop mid-conversation isn't nagged. */
const QUIET_HOURS = 4;
/** One waiting customer is worth surfacing — it is revenue on the line. */
const MIN_CONVERSATIONS = 1;
const HIGH_AT = 5;
const MEDIUM_AT = 3;

export const unansweredMessagesDetector: RecommendationDetector = {
  key: 'unanswered_messages',
  category: 'operations',
  // No requiredFeature: messaging is core to every plan, so the feed's own
  // aiInsights gate is the only one that applies. Don't invent a gate that
  // doesn't exist in featureTiers.

  async detect(pool: Pool, shopId: string): Promise<RecCandidate[]> {
    const res = await pool.query<{ n: string; oldest_hours: string | null }>(
      `SELECT COUNT(*)::text AS n,
              MAX(EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 3600)::int::text AS oldest_hours
         FROM conversations c
         CROSS JOIN LATERAL (
           SELECT sender_type, created_at
             FROM messages
            WHERE conversation_id = c.conversation_id
              AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT 1
         ) m
        WHERE c.shop_id = $1
          AND COALESCE(c.is_blocked, FALSE) = FALSE
          AND COALESCE(c.is_archived_shop, FALSE) = FALSE
          AND m.sender_type = 'customer'
          AND m.created_at < NOW() - make_interval(hours => $2)`,
      [shopId, QUIET_HOURS]
    );

    const count = Number(res.rows[0]?.n ?? 0);
    if (count < MIN_CONVERSATIONS) return [];

    const oldestHours = Number(res.rows[0]?.oldest_hours ?? 0);
    const severity: RecSeverity =
      count >= HIGH_AT ? 'high' : count >= MEDIUM_AT ? 'medium' : 'low';

    const waitLabel =
      oldestHours >= 48
        ? `${Math.floor(oldestHours / 24)} days`
        : `${oldestHours} hours`;

    const shared = {
      detectorKey: 'unanswered_messages',
      category: 'operations' as const,
      severity,
      evidence: { waitingConversations: count, oldestHours },
      assistantPrompt: `I have ${count} customer${count === 1 ? '' : 's'} waiting for a reply — help me respond`,
      description:
        count === 1
          ? `1 customer has been waiting ${waitLabel} for a reply.`
          : `${count} customers are waiting for a reply — the longest for ${waitLabel}.`,
    };

    // Both surfaces, same reasoning as unanswered_leads: the tile is the
    // do-this-now prompt, the card is what keeps `operations` populated in the
    // recommendations list. Requires migration 238's per-surface dedupe index.
    return [
      {
        ...shared,
        action: { kind: 'navigate', tab: 'messages' },
        title: `${count} customer${count === 1 ? '' : 's'} waiting for a reply`,
        presentation: 'card',
      },
      {
        ...shared,
        action: { kind: 'navigate', tab: 'messages' },
        title: 'Reply to customers',
        presentation: 'action',
        ctaLabel: 'Open Messages',
      },
    ];
  },
};
