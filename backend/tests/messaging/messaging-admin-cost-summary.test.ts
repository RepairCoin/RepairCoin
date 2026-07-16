/**
 * Cost/consent admin dashboard — MessagingAdminController.getMessagingCostSummary: the ?days window
 * parsing and response envelope. Repos mocked, no DB.
 */
import { describe, it, expect } from '@jest/globals';
import { MessagingAdminController } from '../../src/domains/messaging/controllers/MessagingAdminController';

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

function makeCtrl(over: any = {}) {
  const calls: any = { since: undefined };
  const costRepo = {
    getAllShopsSummary: over.getAllShopsSummary ?? (async (since?: Date) => {
      calls.since = since;
      return {
        shops: [
          { shopId: 's1', shopName: 'Alpha', aiCostCents: 12, carrierCostCents: 1.58, totalCents: 13.58, replyCount: 2 },
        ],
        grandTotal: { aiCostCents: 12, carrierCostCents: 1.58, totalCents: 13.58, replyCount: 2 },
      };
    }),
  } as any;
  const consentRepo = {
    getSummary: over.getSummary ?? (async () => [{ channel: 'sms', status: 'granted', count: 5 }]),
  } as any;
  return { ctrl: new MessagingAdminController({ costRepo, consentRepo }), calls };
}

describe('MessagingAdminController.getMessagingCostSummary', () => {
  it('returns the cost + consent summary with periodDays=null for all-time (no days)', async () => {
    const { ctrl, calls } = makeCtrl();
    const res = makeRes();
    await ctrl.getMessagingCostSummary({ query: {} } as any, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.periodDays).toBeNull();
    expect(calls.since).toBeUndefined(); // all-time → no since filter
    expect(res.body.data.shops).toHaveLength(1);
    expect(res.body.data.grandTotal.totalCents).toBeCloseTo(13.58, 4);
    expect(res.body.data.consent).toEqual([{ channel: 'sms', status: 'granted', count: 5 }]);
  });

  it('scopes to a time window when ?days is a positive integer', async () => {
    const { ctrl, calls } = makeCtrl();
    const res = makeRes();
    const before = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await ctrl.getMessagingCostSummary({ query: { days: '7' } } as any, res);
    expect(res.body.data.periodDays).toBe(7);
    expect(calls.since).toBeInstanceOf(Date);
    // since ≈ now - 7d (within a few seconds of when we computed `before`)
    expect(Math.abs((calls.since as Date).getTime() - before)).toBeLessThan(5000);
  });

  it('treats a non-numeric ?days as all-time', async () => {
    const { ctrl, calls } = makeCtrl();
    const res = makeRes();
    await ctrl.getMessagingCostSummary({ query: { days: 'abc' } } as any, res);
    expect(res.body.data.periodDays).toBeNull();
    expect(calls.since).toBeUndefined();
  });

  it('returns 500 on a repo error', async () => {
    const { ctrl } = makeCtrl({ getAllShopsSummary: async () => { throw new Error('db down'); } });
    const res = makeRes();
    await ctrl.getMessagingCostSummary({ query: {} } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
