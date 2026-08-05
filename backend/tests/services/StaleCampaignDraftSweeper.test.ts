// The sweeper deletes rows, so what matters is everything it must NOT delete.
//
// Its whole body is one DELETE, which means a unit test can only inspect the statement it issues — it
// cannot prove Postgres agrees. That is a real limit and these tests are written to be honest about it:
// each one pins a specific WHERE clause that, if dropped, destroys data nobody could get back (a
// hand-built draft, a campaign that already reached customers, a template a live workflow still fires).
// The DELETE itself was additionally run against staging as a SELECT before shipping.

let capturedSql = '';
let mockRows: any[] = [];
let queryShouldThrow: Error | null = null;

jest.mock('../../src/utils/database-pool', () => ({
  getSharedPool: () => ({
    query: jest.fn(async (sql: string) => {
      capturedSql = sql;
      if (queryShouldThrow) throw queryShouldThrow;
      return { rows: mockRows };
    }),
  }),
}));

import { StaleCampaignDraftSweeper, STALE_DRAFT_DAYS } from '../../src/services/StaleCampaignDraftSweeper';

// Whitespace in the SQL is formatting, not meaning — collapse it so the assertions survive re-indenting.
const sql = () => capturedSql.replace(/\s+/g, ' ');

describe('StaleCampaignDraftSweeper', () => {
  let sweeper: StaleCampaignDraftSweeper;

  beforeEach(() => {
    sweeper = new StaleCampaignDraftSweeper();
    capturedSql = '';
    mockRows = [];
    queryShouldThrow = null;
  });

  describe('what it refuses to touch', () => {
    it('only ever deletes AI-proposed drafts, never hand-built ones', async () => {
      await sweeper.sweep();
      // A manual draft is somebody's unfinished work. Measured ratio backs the distinction: manual is 8
      // drafts to 58 sends, ai_agent is 111 to 37.
      expect(sql()).toContain("created_by_source = 'ai_agent'");
    });

    it('never deletes a campaign that reached a customer', async () => {
      await sweeper.sweep();
      // Two independent conditions on purpose — status is the intent, sent_at is the fact. A campaign
      // that went out is a record of what customers received and has to survive.
      expect(sql()).toContain("status = 'draft'");
      expect(sql()).toContain('sent_at IS NULL');
    });

    it('never deletes a draft a live workflow still fires', async () => {
      await sweeper.sweep();
      // A run_campaign rule stores the campaignId in its payload. Delete the template and the shop keeps
      // a published workflow that quietly does nothing on every firing.
      const s = sql();
      expect(s).toContain('NOT EXISTS');
      expect(s).toContain('shop_auto_messages');
      expect(s).toContain("action_type = 'run_campaign'");
      expect(s).toContain("action_payload->>'campaignId'");
    });

    it('leaves recent drafts alone', async () => {
      await sweeper.sweep();
      // Generous by design: keeping one too long costs a row in a list, deleting one too early costs
      // work the shop has no way to recover and no warning about.
      expect(sql()).toContain(`INTERVAL '${STALE_DRAFT_DAYS} days'`);
      expect(STALE_DRAFT_DAYS).toBeGreaterThanOrEqual(60);
    });
  });

  describe('reporting', () => {
    it('reports how many it removed', async () => {
      mockRows = [
        { id: 'c1', shop_id: 'peanut' },
        { id: 'c2', shop_id: 'peanut' },
        { id: 'c3', shop_id: '1111' },
      ];
      await expect(sweeper.sweep()).resolves.toEqual({ deleted: 3, scanned: 3 });
    });

    it('reports zero when nothing qualified', async () => {
      await expect(sweeper.sweep()).resolves.toEqual({ deleted: 0, scanned: 0 });
    });
  });

  it('never throws — it runs inside the nightly pass', async () => {
    // It shares a run with anomaly detection and the recommendation feed. Housekeeping failing must not
    // cost a shop its dashboard.
    queryShouldThrow = new Error('connection terminated unexpectedly');
    await expect(sweeper.sweep()).resolves.toEqual({ deleted: 0, scanned: 0 });
  });
});
