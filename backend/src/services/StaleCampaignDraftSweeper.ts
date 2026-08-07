// backend/src/services/StaleCampaignDraftSweeper.ts
//
// Deletes AI-proposed campaign drafts nobody took.
//
// The assistant persists a draft on every proposal, deliberately — the campaign id has to outlive the
// chat session so the shop can switch to the Marketing tab and edit it. Nothing ever removed the ones
// they scrolled past. Measured 2026-08-05: 111 ai_agent drafts against 37 ai_agent sends, so roughly
// three quarters are never used, and 103 were over a month old and referenced by nothing.
//
// Manual drafts are NEVER touched. The ratio there is the opposite — 8 drafts to 58 sends — because a
// hand-built draft is somebody's unfinished work, while an ignored AI proposal is a suggestion nobody
// took. Deleting the first would destroy effort; deleting the second returns the list to being useful.

import { logger } from '../utils/logger';
import { getSharedPool } from '../utils/database-pool';

/**
 * How long an untouched AI draft is kept.
 *
 * Deliberately generous. The cost of keeping one too long is a row in a list; the cost of deleting one
 * a shop meant to use is work they cannot get back, and they have no way of knowing it was at risk.
 */
export const STALE_DRAFT_DAYS = 60;

export interface SweepResult {
  deleted: number;
  /** Set when nothing was deleted because nothing qualified — distinct from a failure. */
  scanned: number;
}

export class StaleCampaignDraftSweeper {
  /**
   * Four conditions, and every one of them is load-bearing:
   *
   *   created_by_source = 'ai_agent'  — never a draft a person built by hand
   *   status = 'draft' AND sent_at IS NULL — never anything that reached a customer
   *   older than STALE_DRAFT_DAYS    — not something drafted this week and still being considered
   *   not referenced by a workflow   — a run_campaign rule stores a campaignId, and deleting its
   *                                    template leaves a published workflow that logs and does nothing
   */
  async sweep(): Promise<SweepResult> {
    const pool = getSharedPool();
    try {
      const { rows } = await pool.query(
        `DELETE FROM marketing_campaigns mc
          WHERE mc.created_by_source = 'ai_agent'
            AND mc.status = 'draft'
            AND mc.sent_at IS NULL
            AND mc.created_at < NOW() - INTERVAL '${STALE_DRAFT_DAYS} days'
            AND NOT EXISTS (
              SELECT 1 FROM shop_auto_messages am
               WHERE am.action_type = 'run_campaign'
                 AND am.action_payload->>'campaignId' = mc.id::text
            )
          RETURNING mc.id, mc.shop_id`
      );

      if (rows.length) {
        logger.info('StaleCampaignDraftSweeper removed unused AI drafts', {
          deleted: rows.length,
          shops: [...new Set(rows.map((r: { shop_id: string }) => r.shop_id))].length,
          olderThanDays: STALE_DRAFT_DAYS,
        });
      }
      return { deleted: rows.length, scanned: rows.length };
    } catch (err) {
      // Housekeeping must never take down the nightly pass it runs inside.
      logger.error('StaleCampaignDraftSweeper failed', { error: (err as Error)?.message });
      return { deleted: 0, scanned: 0 };
    }
  }
}

export const staleCampaignDraftSweeper = new StaleCampaignDraftSweeper();
