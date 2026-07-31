// BUG-013 — every RCN issuance was recorded as "Repair reward - $0 repair".
//
// `reason` only ever fed the ON-CHAIN note, and with ENABLE_BLOCKCHAIN_MINTING off that branch never
// runs, so the caller's reason was silently discarded and the DB row inherited repair wording. Three
// issuance paths — manual repair, campaign rewards, workflow automations — collapsed into one
// indistinguishable record, describing a repair that never happened.
//
// Found by an end-to-end run, not by tests: the unit tests asserted issueExact was CALLED with the
// right arguments, which it was. The reason was lost downstream, inside the atomic write.

import { ShopRepository } from '../../src/repositories/ShopRepository';

/** Fake pg client that records every query so we can inspect the transaction insert. */
function fakeClient() {
  const calls: Array<{ sql: string; params: any[] }> = [];
  return {
    calls,
    release: jest.fn(),
    query: jest.fn(async (sql: any, params?: any[]) => {
      const text = typeof sql === 'string' ? sql : sql?.text ?? '';
      calls.push({ sql: text, params: params ?? [] });
      if (text.includes('FROM shops')) {
        return { rows: [{ purchased_rcn_balance: '1000', total_tokens_issued: '0' }] };
      }
      if (text.includes('FROM customers')) {
        return { rows: [{ lifetime_earnings: '0', tier: 'BRONZE' }] };
      }
      if (text.includes('INSERT INTO transactions')) {
        return { rows: [{ id: 'tx-1' }] };
      }
      return { rows: [] };
    }),
  };
}

function repoWith(client: any) {
  const repo = new ShopRepository();
  (repo as any).pool = { connect: async () => client };
  return repo;
}

const base = {
  transactionHash: '0xabc',
  baseReward: 25,
  tierBonus: 0,
  promoBonus: 0,
  promoCode: null,
  newTier: 'BRONZE',
};

// Params are ($1 type, $2 customer, $3 shop, $4 amount, $5 reason, $6 hash, $7 status, $8 metadata) —
// `timestamp` is NOW() in the SQL, not a placeholder, so metadata is index 7 not 8.
const REASON_PARAM = 4;
const METADATA_PARAM = 7;

function transactionInsert(client: ReturnType<typeof fakeClient>) {
  const insert = client.calls.find((c) => c.sql.includes('INSERT INTO transactions'));
  expect(insert).toBeDefined();
  return insert!;
}

/** The reason recorded on the transactions row. */
function recordedReason(client: ReturnType<typeof fakeClient>): string {
  return transactionInsert(client).params[REASON_PARAM];
}

function recordedMetadata(client: ReturnType<typeof fakeClient>): any {
  return JSON.parse(transactionInsert(client).params[METADATA_PARAM]);
}

describe('BUG-013 — an issuance says what actually happened', () => {
  it('records the caller\'s reason instead of repair wording', async () => {
    const client = fakeClient();
    await repoWith(client).issueRewardAtomic('peanut', '0xabc', 25, {
      ...base,
      repairAmount: 0,
      source: 'automation',
      reason: 'Automation: Post-repair follow-up',
    });

    expect(recordedReason(client)).toBe('Automation: Post-repair follow-up');
    // The specific string that made this a bug.
    expect(recordedReason(client)).not.toContain('Repair reward');
  });

  it('keeps machine-readable provenance in metadata, not just prose', async () => {
    const client = fakeClient();
    await repoWith(client).issueRewardAtomic('peanut', '0xabc', 25, {
      ...base,
      repairAmount: 0,
      source: 'marketing_campaign',
      reason: 'Campaign reward',
    });
    expect(recordedMetadata(client).source).toBe('marketing_campaign');
  });

  // The manual repair route passes no reason and a REAL repairAmount — that one genuinely is a repair
  // reward and must keep its wording. The fix must not rewrite history for the path that was correct.
  it('still labels a genuine repair reward as a repair', async () => {
    const client = fakeClient();
    await repoWith(client).issueRewardAtomic('peanut', '0xabc', 25, {
      ...base,
      repairAmount: 120,
    });
    expect(recordedReason(client)).toBe('Repair reward - $120 repair');
  });

  it('ignores a blank reason rather than writing an empty description', async () => {
    const client = fakeClient();
    await repoWith(client).issueRewardAtomic('peanut', '0xabc', 25, {
      ...base,
      repairAmount: 0,
      reason: '   ',
    });
    expect(recordedReason(client)).toBe('Repair reward - $0 repair');
  });

  it('omits source from metadata when there isn\'t one', async () => {
    const client = fakeClient();
    await repoWith(client).issueRewardAtomic('peanut', '0xabc', 25, { ...base, repairAmount: 50 });
    expect(recordedMetadata(client)).not.toHaveProperty('source');
  });
});
