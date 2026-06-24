// backend/tests/services/AdsMetaConfigSync.test.ts
//
// Unit tests for two-way Meta config sync: the pure reconcile decision + status mapping + the
// flag-off no-op. The live round-trip (real Meta GET) is verified separately against staging.

import {
  reconcileFields,
  mapMetaStatus,
  extractRadiusMiles,
  isMetaObjectGone,
  MetaConfigSyncService,
} from '../../src/domains/AdsDomain/services/MetaConfigSyncService';
import { metaService } from '../../src/domains/AdsDomain/services/MetaService';
import { encryptToken } from '../../src/utils/tokenCrypto';

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

describe('extractRadiusMiles (Phase 3, pure)', () => {
  const mk = (radius: any, unit?: string) => ({ geo_locations: { custom_locations: [{ radius, distance_unit: unit }] } });

  it('reads a mile radius as-is (rounded)', () => {
    expect(extractRadiusMiles(mk(8, 'mile'))).toBe(8);
    expect(extractRadiusMiles(mk('12.4', 'mile'))).toBe(12);
  });
  it('converts kilometers to miles', () => {
    expect(extractRadiusMiles(mk(16.09, 'kilometer'))).toBe(10);
    expect(extractRadiusMiles(mk(16.09, 'km'))).toBe(10);
  });
  it('defaults to miles when the unit is absent', () => {
    expect(extractRadiusMiles(mk(5))).toBe(5);
  });
  it('returns null when there is no custom-location radius', () => {
    expect(extractRadiusMiles(null)).toBeNull();
    expect(extractRadiusMiles({})).toBeNull();
    expect(extractRadiusMiles({ geo_locations: { custom_locations: [] } })).toBeNull();
    expect(extractRadiusMiles(mk('', 'mile'))).toBeNull();
    expect(extractRadiusMiles(mk('abc', 'mile'))).toBeNull();
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

describe('MetaConfigSyncService — Phase 2 creative reflect + flag (D3)', () => {
  const prevFlag = process.env.ADS_META_CONFIG_SYNC;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (metaService as any).isConfigured;
  const origGetAdSet = (metaService as any).getAdSet;
  const origGetCampaign = (metaService as any).getCampaign;
  const origGetAd = (metaService as any).getAd;
  const origGetCreativeSpec = (metaService as any).getCreativeSpec;

  // A pushed, live campaign whose budget/status already match Meta → only creative can change.
  const baseCampaign = {
    id: 'c1', shopId: 'shop1',
    metaAdSetId: 'as1', metaCampaignId: 'mc1', metaAdId: 'ad1', metaCreativeId: 'cr_old',
    dailyBudgetCents: 5000, status: 'active', metaStatus: 'ACTIVE',
  };

  let updateCalled: boolean;
  let setMetaObjectsArgs: any[];
  let reflectArgs: any[];
  let flagCalls: string[];

  const makeService = () => {
    updateCalled = false; setMetaObjectsArgs = []; reflectArgs = []; flagCalls = [];
    const connections: any = { getConnection: async () => ({ userTokenEnc: encryptToken('faketoken') }) };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign }),
      update: async () => { updateCalled = true; },
      setMetaObjects: async (_id: string, m: any) => { setMetaObjectsArgs.push(m); },
    };
    const creatives: any = {
      reflectExternalCreative: async (_id: string, f: any) => { reflectArgs.push(f); return {}; },
      flagExternallyEdited: async (id: string) => { flagCalls.push(id); },
    };
    return new MetaConfigSyncService(connections, campaigns, creatives);
  };

  beforeEach(() => {
    process.env.ADS_META_CONFIG_SYNC = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    (metaService as any).isConfigured = () => true;
    // Budget + status already in sync, so only the creative path can produce a change.
    (metaService as any).getAdSet = async () => ({ dailyBudgetCents: 5000, optimizationGoal: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE' });
    (metaService as any).getCampaign = async () => ({ objective: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE', name: null });
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_META_CONFIG_SYNC; else process.env.ADS_META_CONFIG_SYNC = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    (metaService as any).isConfigured = origConfigured;
    (metaService as any).getAdSet = origGetAdSet;
    (metaService as any).getCampaign = origGetCampaign;
    (metaService as any).getAd = origGetAd;
    (metaService as any).getCreativeSpec = origGetCreativeSpec;
  });

  it('reflects a swapped creative, re-stamps metaCreativeId, and flags it', async () => {
    (metaService as any).getAd = async () => ({ status: 'ACTIVE', creativeId: 'cr_new' });
    (metaService as any).getCreativeSpec = async () => ({ picture: 'https://img/new.jpg', headline: 'New head', message: 'New body', link: 'https://x' });
    const r = await makeService().reconcile('c1');

    expect(r.status).toBe('synced');
    expect(r.changes.creativeExternallyEdited).toBe(true);
    expect(updateCalled).toBe(false); // budget/status unchanged
    expect(reflectArgs).toEqual([{ headline: 'New head', body: 'New body', imageUrl: 'https://img/new.jpg' }]);
    expect(flagCalls).toEqual([]);
    expect(setMetaObjectsArgs.some((m) => m.metaCreativeId === 'cr_new')).toBe(true);
  });

  it('flags (without content) when the diverged creative spec is unreadable', async () => {
    (metaService as any).getAd = async () => ({ status: 'ACTIVE', creativeId: 'cr_new' });
    (metaService as any).getCreativeSpec = async () => null;
    const r = await makeService().reconcile('c1');

    expect(r.changes.creativeExternallyEdited).toBe(true);
    expect(reflectArgs).toEqual([]);
    expect(flagCalls).toEqual(['c1']);
  });

  it('does nothing to the creative when the live creative id matches what we pushed', async () => {
    (metaService as any).getAd = async () => ({ status: 'ACTIVE', creativeId: 'cr_old' });
    (metaService as any).getCreativeSpec = async () => { throw new Error('must not read spec when unchanged'); };
    const r = await makeService().reconcile('c1');

    expect(r.status).toBe('in_sync');
    expect(r.changes.creativeExternallyEdited).toBeUndefined();
    expect(reflectArgs).toEqual([]);
    expect(flagCalls).toEqual([]);
  });
});

describe('MetaConfigSyncService — Phase 3 objective + targeting reflect (D4 read-only)', () => {
  const prevFlag = process.env.ADS_META_CONFIG_SYNC;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const orig = {
    isConfigured: (metaService as any).isConfigured,
    getAdSet: (metaService as any).getAdSet,
    getCampaign: (metaService as any).getCampaign,
    getAd: (metaService as any).getAd,
  };

  // Pushed/live; budget+status already match Meta; creative unchanged → only objective/radius move.
  const baseCampaign = {
    id: 'c1', shopId: 'shop1',
    metaAdSetId: 'as1', metaCampaignId: 'mc1', metaAdId: 'ad1', metaCreativeId: 'cr1',
    dailyBudgetCents: 5000, status: 'active', metaStatus: 'ACTIVE',
    objective: 'OUTCOME_TRAFFIC', targetRadiusMiles: 5,
  };
  const targeting = { geo_locations: { custom_locations: [{ radius: 16.09, distance_unit: 'kilometer' }] } };

  let updateArgs: any[];
  let setMetaObjectsArgs: any[];
  const makeService = () => {
    updateArgs = []; setMetaObjectsArgs = [];
    const connections: any = { getConnection: async () => ({ userTokenEnc: encryptToken('faketoken') }) };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign }),
      update: async (_id: string, u: any) => { updateArgs.push(u); },
      setMetaObjects: async (_id: string, m: any) => { setMetaObjectsArgs.push(m); },
    };
    const creatives: any = { reflectExternalCreative: async () => ({}), flagExternallyEdited: async () => {} };
    return new MetaConfigSyncService(connections, campaigns, creatives);
  };

  beforeEach(() => {
    process.env.ADS_META_CONFIG_SYNC = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    (metaService as any).isConfigured = () => true;
    (metaService as any).getAd = async () => ({ status: 'ACTIVE', creativeId: 'cr1' }); // unchanged
    (metaService as any).getAdSet = async () => ({ dailyBudgetCents: 5000, optimizationGoal: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE', targeting });
    (metaService as any).getCampaign = async () => ({ objective: 'OUTCOME_LEADS', status: 'ACTIVE', effectiveStatus: 'ACTIVE', name: null });
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_META_CONFIG_SYNC; else process.env.ADS_META_CONFIG_SYNC = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    Object.assign(metaService as any, orig);
  });

  it('reflects a changed objective + converted radius, and persists raw targeting fidelity', async () => {
    const r = await makeService().reconcile('c1');
    expect(r.status).toBe('synced');
    expect(r.changes.objective).toBe('OUTCOME_LEADS');
    expect(r.changes.targetRadiusMiles).toBe(10); // 16.09 km → 10 mi
    expect(updateArgs).toEqual([{ objective: 'OUTCOME_LEADS', targetRadiusMiles: 10 }]);
    // raw targeting stored verbatim on the final sync-stamp call
    expect(setMetaObjectsArgs.some((m) => m.metaTargetingRaw === targeting)).toBe(true);
  });

  it('does not reflect objective/radius when Meta matches the DB (only stamps fidelity)', async () => {
    (metaService as any).getCampaign = async () => ({ objective: 'OUTCOME_TRAFFIC', status: 'ACTIVE', effectiveStatus: 'ACTIVE', name: null });
    (metaService as any).getAdSet = async () => ({ dailyBudgetCents: 5000, optimizationGoal: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE',
      targeting: { geo_locations: { custom_locations: [{ radius: 5, distance_unit: 'mile' }] } } });
    const r = await makeService().reconcile('c1');
    expect(r.status).toBe('in_sync');
    expect(r.changes.objective).toBeUndefined();
    expect(r.changes.targetRadiusMiles).toBeUndefined();
    expect(updateArgs).toEqual([]);
  });
});

describe('isMetaObjectGone (Phase 4, pure)', () => {
  it('detects a deleted/missing Meta object from the Graph error', () => {
    expect(isMetaObjectGone('get_campaign_failed: Unsupported get request. ... does not exist (code 100/33)')).toBe(true);
    expect(isMetaObjectGone('get_adset_failed: (#100) Object with ID does not exist (code 100/33)')).toBe(true);
  });
  it('does NOT treat transient/permission errors as gone', () => {
    expect(isMetaObjectGone('get_campaign_failed: rate limit reached (code 17)')).toBe(false);
    expect(isMetaObjectGone('get_adset_failed: (#190) token expired')).toBe(false);
    expect(isMetaObjectGone(null)).toBe(false);
    expect(isMetaObjectGone('')).toBe(false);
  });
});

describe('MetaConfigSyncService — Phase 4 deletion / divergence (D5 halt, never recreate)', () => {
  const prevFlag = process.env.ADS_META_CONFIG_SYNC;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const orig = {
    isConfigured: (metaService as any).isConfigured,
    getAdSet: (metaService as any).getAdSet,
    getCampaign: (metaService as any).getCampaign,
    getAd: (metaService as any).getAd,
  };
  const baseCampaign = {
    id: 'c1', shopId: 'shop1',
    metaAdSetId: 'as1', metaCampaignId: 'mc1', metaAdId: 'ad1', metaCreativeId: 'cr1',
    dailyBudgetCents: 5000, status: 'active', metaStatus: 'ACTIVE',
  };

  let updateArgs: any[];
  let setMetaObjectsArgs: any[];
  const makeService = () => {
    updateArgs = []; setMetaObjectsArgs = [];
    const connections: any = { getConnection: async () => ({ userTokenEnc: encryptToken('faketoken') }) };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign }),
      update: async (_id: string, u: any) => { updateArgs.push(u); },
      setMetaObjects: async (_id: string, m: any) => { setMetaObjectsArgs.push(m); },
    };
    const creatives: any = { reflectExternalCreative: async () => ({}), flagExternallyEdited: async () => {} };
    return new MetaConfigSyncService(connections, campaigns, creatives);
  };

  beforeEach(() => {
    process.env.ADS_META_CONFIG_SYNC = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    (metaService as any).isConfigured = () => true;
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_META_CONFIG_SYNC; else process.env.ADS_META_CONFIG_SYNC = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    Object.assign(metaService as any, orig);
  });

  it('a deleted Meta object (404) → reflects archived + halts (diverged, never an error)', async () => {
    (metaService as any).getAdSet = async () => { throw new Error('get_adset_failed: Object does not exist (code 100/33)'); };
    (metaService as any).getCampaign = async () => ({ objective: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE', name: null });
    const r = await makeService().reconcile('c1');

    expect(r.status).toBe('diverged');
    expect(r.reason).toBe('meta_deleted');
    expect(r.changes.status).toBe('archived');
    expect(r.changes.metaStatus).toBe('DELETED');
    expect(updateArgs).toEqual([{ status: 'archived' }]);
    expect(setMetaObjectsArgs.some((m) => m.metaStatus === 'DELETED')).toBe(true);
  });

  it('an ARCHIVED effective_status → reflects archived + halts (diverged)', async () => {
    (metaService as any).getAdSet = async () => ({ dailyBudgetCents: 5000, optimizationGoal: null, status: 'ARCHIVED', effectiveStatus: 'ARCHIVED', targeting: null });
    (metaService as any).getCampaign = async () => ({ objective: null, status: 'ARCHIVED', effectiveStatus: 'ARCHIVED', name: null });
    const r = await makeService().reconcile('c1');

    expect(r.status).toBe('diverged');
    expect(r.reason).toBe('meta_archived');
    expect(r.changes.metaStatus).toBe('ARCHIVED');
    expect(updateArgs).toEqual([{ status: 'archived' }]);
  });

  it('re-throws a transient Meta error (→ error, not diverged) so we do not wrongly archive', async () => {
    (metaService as any).getAdSet = async () => { throw new Error('get_adset_failed: rate limit (code 17)'); };
    (metaService as any).getCampaign = async () => ({ objective: null, status: 'ACTIVE', effectiveStatus: 'ACTIVE', name: null });
    const r = await makeService().reconcile('c1');

    expect(r.status).toBe('error');
    expect(updateArgs).toEqual([]); // never archived on a transient failure
  });
});
