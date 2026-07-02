// backend/tests/services/AdsGoogleConfigSync.test.ts
//
// Unit tests for two-way Google config sync (Slice 5): the pure status map + reconcile decision +
// removed-detection, plus the GoogleConfigSyncService flow (flag-off no-op, skip pre-push/disconnected,
// budget/status pull, REMOVED→diverged). Live GAQL read is verified separately. Mirrors the
// AdsMetaConfigSync / AdsGooglePush test style.

import {
  mapGoogleStatus, isGoogleCampaignRemoved, reconcileGoogleFields,
} from '../../src/domains/AdsDomain/services/googleConfigSync';
import { GoogleConfigSyncService } from '../../src/domains/AdsDomain/services/GoogleConfigSyncService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('mapGoogleStatus', () => {
  it('maps the clear states, leaves the rest null', () => {
    expect(mapGoogleStatus('ENABLED')).toBe('active');
    expect(mapGoogleStatus('PAUSED')).toBe('paused');
    expect(mapGoogleStatus('REMOVED')).toBe('archived');
    expect(mapGoogleStatus('UNKNOWN')).toBeNull();
    expect(mapGoogleStatus(null)).toBeNull();
  });
});

describe('isGoogleCampaignRemoved', () => {
  it('is true only for REMOVED', () => {
    expect(isGoogleCampaignRemoved('REMOVED')).toBe(true);
    expect(isGoogleCampaignRemoved('ENABLED')).toBe(false);
    expect(isGoogleCampaignRemoved(null)).toBe(false);
  });
});

describe('reconcileGoogleFields (Google wins for live)', () => {
  const db = { dailyBudgetCents: 5000, status: 'active', googleStatus: 'ENABLED' };

  it('flags a budget change', () => {
    expect(reconcileGoogleFields(db, { dailyBudgetCents: 8000, campaignStatus: 'ENABLED' }))
      .toEqual({ dailyBudgetCents: 8000 });
  });
  it('flags a status change (paused in Google Ads)', () => {
    expect(reconcileGoogleFields(db, { dailyBudgetCents: 5000, campaignStatus: 'PAUSED' }))
      .toEqual({ status: 'paused', googleStatus: 'PAUSED' });
  });
  it('flags both when both differ', () => {
    expect(reconcileGoogleFields(db, { dailyBudgetCents: 9000, campaignStatus: 'PAUSED' }))
      .toEqual({ dailyBudgetCents: 9000, status: 'paused', googleStatus: 'PAUSED' });
  });
  it('no change when Google matches the DB', () => {
    expect(reconcileGoogleFields(db, { dailyBudgetCents: 5000, campaignStatus: 'ENABLED' })).toEqual({});
  });
  it('ignores a null Google budget (does not zero our value)', () => {
    expect(reconcileGoogleFields(db, { dailyBudgetCents: null, campaignStatus: 'ENABLED' })).toEqual({});
  });
});

describe('GoogleConfigSyncService.reconcile', () => {
  const prevFlag = process.env.ADS_GOOGLE_CONFIG_SYNC;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origFetch = (googleAdsService as any).fetchCampaignConfig;

  const baseCampaign = {
    id: 'c1', shopId: 'shop1', status: 'active',
    dailyBudgetCents: 5000, googleCampaignId: '111', googleAdGroupId: '222', googleStatus: 'ENABLED',
  };

  let updates: any[];
  let setObjs: any[];
  const makeService = (campaignOverride: any = {}, connOverride: any = undefined, cfg?: any, fetchThrows?: Error) => {
    updates = []; setObjs = [];
    const connections: any = {
      getConnection: async () =>
        connOverride !== undefined ? connOverride
          : { refreshTokenEnc: encryptToken('r'), customerId: '9849422982', managerId: '7460409500' },
    };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign, ...campaignOverride }),
      update: async (_id: string, u: any) => { updates.push(u); return null; },
      setGoogleObjects: async (_id: string, g: any) => { setObjs.push(g); return null; },
    };
    (googleAdsService as any).fetchCampaignConfig = async () => {
      if (fetchThrows) throw fetchThrows;
      return cfg ?? { campaignStatus: 'ENABLED', dailyBudgetCents: 5000 };
    };
    return new GoogleConfigSyncService(connections, campaigns);
  };

  beforeEach(() => {
    process.env.ADS_GOOGLE_CONFIG_SYNC = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    (googleAdsService as any).isConfigured = () => true;
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_GOOGLE_CONFIG_SYNC; else process.env.ADS_GOOGLE_CONFIG_SYNC = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    (googleAdsService as any).isConfigured = origConfigured;
    (googleAdsService as any).fetchCampaignConfig = origFetch;
  });

  it('is disabled (no repo/HTTP) when the flag is off', async () => {
    delete process.env.ADS_GOOGLE_CONFIG_SYNC;
    const svc = makeService();
    expect(await svc.reconcile('c1')).toEqual({ status: 'disabled', changes: {} });
  });

  it('skips a pre-push campaign (no googleCampaignId)', async () => {
    const svc = makeService({ googleCampaignId: null });
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('skipped');
    expect(r.reason).toBe('not_pushed');
  });

  it('skips a disconnected shop', async () => {
    const svc = makeService({}, null);
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('skipped');
    expect(r.reason).toBe('disconnected');
  });

  it('in_sync when Google matches the DB (still stamps the check)', async () => {
    const svc = makeService({}, undefined, { campaignStatus: 'ENABLED', dailyBudgetCents: 5000 });
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('in_sync');
    expect(updates).toHaveLength(0);
    expect(setObjs[0].googleSyncedConfigAt).toBeInstanceOf(Date);
  });

  it('pulls a budget + status change from Google (Google wins)', async () => {
    const svc = makeService({}, undefined, { campaignStatus: 'PAUSED', dailyBudgetCents: 8000 });
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('synced');
    expect(r.changes).toEqual({ dailyBudgetCents: 8000, status: 'paused', googleStatus: 'PAUSED' });
    expect(updates).toEqual([{ dailyBudgetCents: 8000, status: 'paused' }]);
    expect(setObjs[0]).toMatchObject({ googleStatus: 'PAUSED' });
  });

  it('marks REMOVED-on-Google as diverged/archived and halts', async () => {
    const svc = makeService({}, undefined, { campaignStatus: 'REMOVED', dailyBudgetCents: 5000 });
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('diverged');
    expect(r.reason).toBe('google_removed');
    expect(updates).toEqual([{ status: 'archived' }]);
    expect(setObjs[0]).toMatchObject({ googleStatus: 'REMOVED' });
  });

  it('returns error (no archive) on a transient Google read failure', async () => {
    const svc = makeService({}, undefined, undefined, new Error('DEADLINE_EXCEEDED'));
    const r = await svc.reconcile('c1');
    expect(r.status).toBe('error');
    expect(updates).toHaveLength(0);
  });
});
