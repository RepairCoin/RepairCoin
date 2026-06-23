// backend/tests/services/AdsMetaConfigSync.test.ts
//
// Unit tests for two-way Meta config sync: the pure reconcile decision + status mapping + the
// flag-off no-op. The live round-trip (real Meta GET) is verified separately against staging.

import {
  reconcileFields,
  mapMetaStatus,
  MetaConfigSyncService,
} from '../../src/domains/AdsDomain/services/MetaConfigSyncService';

describe('mapMetaStatus', () => {
  it('maps the clear states, leaves the rest null', () => {
    expect(mapMetaStatus('ACTIVE')).toBe('active');
    expect(mapMetaStatus('PAUSED')).toBe('paused');
    expect(mapMetaStatus('ARCHIVED')).toBe('archived');
    expect(mapMetaStatus('DELETED')).toBe('archived');
    expect(mapMetaStatus('PENDING_REVIEW')).toBeNull();
    expect(mapMetaStatus(null)).toBeNull();
  });
});

describe('reconcileFields (Meta wins, D1)', () => {
  const db = { dailyBudgetCents: 5000, status: 'active', metaStatus: 'ACTIVE' };

  it('flags a budget change', () => {
    expect(reconcileFields(db, { dailyBudgetCents: 8000, campaignStatus: 'ACTIVE' }))
      .toEqual({ dailyBudgetCents: 8000 });
  });

  it('flags a status change (paused in Ads Manager)', () => {
    expect(reconcileFields(db, { dailyBudgetCents: 5000, campaignStatus: 'PAUSED' }))
      .toEqual({ status: 'paused', metaStatus: 'PAUSED' });
  });

  it('flags both when both differ', () => {
    expect(reconcileFields(db, { dailyBudgetCents: 9000, campaignStatus: 'PAUSED' }))
      .toEqual({ dailyBudgetCents: 9000, status: 'paused', metaStatus: 'PAUSED' });
  });

  it('no change when Meta matches the DB', () => {
    expect(reconcileFields(db, { dailyBudgetCents: 5000, campaignStatus: 'ACTIVE' })).toEqual({});
  });

  it('ignores a null Meta budget (does not zero our value)', () => {
    expect(reconcileFields(db, { dailyBudgetCents: null, campaignStatus: 'ACTIVE' })).toEqual({});
  });

  it('does not change status for an unmapped Meta state, but still records metaStatus', () => {
    expect(reconcileFields(db, { dailyBudgetCents: 5000, campaignStatus: 'WITH_ISSUES' }))
      .toEqual({ metaStatus: 'WITH_ISSUES' });
  });
});

describe('MetaConfigSyncService flag gating', () => {
  const prev = process.env.ADS_META_CONFIG_SYNC;
  afterEach(() => {
    if (prev === undefined) delete process.env.ADS_META_CONFIG_SYNC;
    else process.env.ADS_META_CONFIG_SYNC = prev;
  });

  it('reconcile is a no-op (no repo/HTTP) when the flag is off → status "disabled"', async () => {
    delete process.env.ADS_META_CONFIG_SYNC;
    const failRepo: any = { findById: () => { throw new Error('must not touch DB when disabled'); } };
    const svc = new MetaConfigSyncService(failRepo, failRepo);
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('disabled');
    expect(r.changes).toEqual({});
  });
});
