// backend/tests/services/AdsGoogleInsights.test.ts
//
// Unit tests for Google insights import (Slice 4): the PURE GAQL→daily mapper (cost_micros→cents)
// and the GoogleInsightsService sync decision logic (flag-off no-op, per-shop connection caching,
// skip disconnected, partial upsert + last-synced stamp). The live GAQL read is verified separately
// against a real account. Mirrors the AdsMetaConfigSync / AdsGooglePush test style.

import { mapGoogleInsights } from '../../src/domains/AdsDomain/services/googleInsights';
import { GoogleInsightsService } from '../../src/domains/AdsDomain/services/GoogleInsightsService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('mapGoogleInsights (pure)', () => {
  it('maps cost_micros → cents and coerces string numerics', () => {
    const rows = [
      { segments: { date: '2026-07-01' }, metrics: { costMicros: '1230000', impressions: '45', clicks: '3' } },
      { segments: { date: '2026-07-02' }, metrics: { costMicros: 500000, impressions: 10, clicks: 1 } },
    ];
    expect(mapGoogleInsights(rows)).toEqual([
      { date: '2026-07-01', spendCents: 123, impressions: 45, clicks: 3 }, // 1_230_000 / 10_000 = 123
      { date: '2026-07-02', spendCents: 50, impressions: 10, clicks: 1 },  // 500_000 / 10_000 = 50
    ]);
  });

  it('tolerates missing metrics / rows without a date', () => {
    expect(mapGoogleInsights([{ segments: { date: '2026-07-03' } }])).toEqual([
      { date: '2026-07-03', spendCents: 0, impressions: 0, clicks: 0 },
    ]);
    expect(mapGoogleInsights([{ metrics: { costMicros: '999' } }])).toEqual([]); // no date → dropped
    expect(mapGoogleInsights(null as any)).toEqual([]);
    expect(mapGoogleInsights([])).toEqual([]);
  });
});

describe('GoogleInsightsService.syncAll', () => {
  const prevFlag = process.env.ADS_GOOGLE_PUSH_ENABLED;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origFetch = (googleAdsService as any).fetchCampaignInsights;

  let upserts: any[];
  let syncedStamps: string[];
  let fetchCalls: any[];

  const makeService = (opts: {
    campaigns: Array<{ id: string; shopId: string; googleCampaignId: string }>;
    connFor: (shopId: string) => any;
    rows?: any[];
  }) => {
    upserts = []; syncedStamps = []; fetchCalls = [];
    const connections: any = { getConnection: async (shopId: string) => opts.connFor(shopId) };
    const campaigns: any = {
      listWithGoogleCampaign: async () => opts.campaigns,
      setGoogleObjects: async (id: string, g: any) => { if (g.googleLastSyncedAt) syncedStamps.push(id); return null; },
    };
    const perf: any = { upsertGoogleInsights: async (id: string, date: string, m: any) => { upserts.push({ id, date, ...m }); } };
    (googleAdsService as any).fetchCampaignInsights = async (customerId: string, _t: string, campaignId: string, sinceDays: number, login?: string) => {
      fetchCalls.push({ customerId, campaignId, sinceDays, login });
      return opts.rows ?? [];
    };
    return new GoogleInsightsService(connections, campaigns, perf);
  };

  beforeEach(() => {
    process.env.ADS_GOOGLE_PUSH_ENABLED = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    (googleAdsService as any).isConfigured = () => true;
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_GOOGLE_PUSH_ENABLED; else process.env.ADS_GOOGLE_PUSH_ENABLED = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    (googleAdsService as any).isConfigured = origConfigured;
    (googleAdsService as any).fetchCampaignInsights = origFetch;
  });

  it('is a no-op (no repo/HTTP) when the flag is off', async () => {
    delete process.env.ADS_GOOGLE_PUSH_ENABLED;
    const svc = makeService({ campaigns: [], connFor: () => { throw new Error('must not touch when disabled'); } });
    expect(await svc.syncAll()).toBe(0);
    expect(fetchCalls).toHaveLength(0);
  });

  it('imports insights through the shop manager, upserts each day, and stamps last-synced', async () => {
    const conn = { refreshTokenEnc: encryptToken('r'), customerId: '9849422982', managerId: '7460409500' };
    const svc = makeService({
      campaigns: [{ id: 'c1', shopId: 'shop1', googleCampaignId: '111' }],
      connFor: () => conn,
      rows: [
        { segments: { date: '2026-07-01' }, metrics: { costMicros: '2000000', impressions: '80', clicks: '6' } },
        { segments: { date: '2026-07-02' }, metrics: { costMicros: '0', impressions: '5', clicks: '0' } },
      ],
    });
    expect(await svc.syncAll(14)).toBe(1);
    expect(fetchCalls).toEqual([{ customerId: '9849422982', campaignId: '111', sinceDays: 14, login: '7460409500' }]);
    expect(upserts).toEqual([
      { id: 'c1', date: '2026-07-01', spendCents: 200, impressions: 80, clicks: 6 },
      { id: 'c1', date: '2026-07-02', spendCents: 0, impressions: 5, clicks: 0 },
    ]);
    expect(syncedStamps).toEqual(['c1']);
  });

  it('skips a disconnected shop but still processes connected ones', async () => {
    const good = { refreshTokenEnc: encryptToken('r'), customerId: '999', managerId: undefined };
    const svc = makeService({
      campaigns: [
        { id: 'c1', shopId: 'shopDisc', googleCampaignId: '111' },
        { id: 'c2', shopId: 'shopOk', googleCampaignId: '222' },
      ],
      connFor: (shopId) => (shopId === 'shopOk' ? good : null),
      rows: [{ segments: { date: '2026-07-01' }, metrics: { costMicros: '10000', impressions: '1', clicks: '0' } }],
    });
    expect(await svc.syncAll()).toBe(1); // only shopOk
    expect(fetchCalls).toEqual([{ customerId: '999', campaignId: '222', sinceDays: 14, login: undefined }]);
    expect(syncedStamps).toEqual(['c2']);
  });

  it('caches the connection once per shop (two campaigns, one getConnection)', async () => {
    const conn = { refreshTokenEnc: encryptToken('r'), customerId: '999', managerId: '888' };
    let getConnCount = 0;
    const connections: any = { getConnection: async () => { getConnCount++; return conn; } };
    const campaigns: any = {
      listWithGoogleCampaign: async () => [
        { id: 'c1', shopId: 'shop1', googleCampaignId: '111' },
        { id: 'c2', shopId: 'shop1', googleCampaignId: '222' },
      ],
      setGoogleObjects: async () => null,
    };
    const perf: any = { upsertGoogleInsights: async () => {} };
    (googleAdsService as any).fetchCampaignInsights = async () => [];
    const svc = new GoogleInsightsService(connections, campaigns, perf);
    expect(await svc.syncAll()).toBe(2);
    expect(getConnCount).toBe(1); // same shop → one decrypt
  });
});
