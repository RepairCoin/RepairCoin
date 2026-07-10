// backend/tests/services/AdsGoogleContentRead.test.ts
//
// Google composer read/reflect leg — the pure GAQL→content mapper + GoogleComposerService.getDraftContent
// (backfill when empty / skip when present / no-op when disabled). Live reads are externally gated, so
// the googleAdsService singleton is monkeypatched and repos are faked. Mirrors AdsGooglePush style.

import { mapAdContentRows } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { GoogleComposerService } from '../../src/domains/AdsDomain/services/GoogleComposerService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('mapAdContentRows (pure)', () => {
  it('extracts RSA headlines/descriptions/finalUrl/adId + keywords', () => {
    const adRows = [{ adGroupAd: {
      resourceName: 'customers/1/adGroupAds/222~999',
      ad: { finalUrls: ['https://x/l/c1'], responsiveSearchAd: {
        headlines: [{ text: 'H1' }, { text: ' H2 ' }, { text: '' }],
        descriptions: [{ text: 'D1' }, { text: 'D2' }],
      } },
    } }];
    const kwRows = [{ adGroupCriterion: { keyword: { text: 'phone repair' } } }, { adGroupCriterion: { keyword: { text: 'phone repair' } } }, { adGroupCriterion: { keyword: { text: 'screen fix' } } }];
    expect(mapAdContentRows(adRows, kwRows)).toEqual({
      headlines: ['H1', 'H2'], descriptions: ['D1', 'D2'], keywords: ['phone repair', 'screen fix'],
      finalUrl: 'https://x/l/c1', adId: '222~999',
    });
  });
  it('tolerates empty / missing rows', () => {
    expect(mapAdContentRows([], [])).toEqual({ headlines: [], descriptions: [], keywords: [], finalUrl: null, adId: null });
    expect(mapAdContentRows([{ adGroupAd: {} }], [])).toEqual({ headlines: [], descriptions: [], keywords: [], finalUrl: null, adId: null });
  });
});

describe('GoogleComposerService.getDraftContent', () => {
  const prevFlag = process.env.ADS_GOOGLE_PUSH_ENABLED;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origFetch = (googleAdsService as any).fetchAdContent;

  let fetchCalls: number;
  let setObjs: any[];

  const base = { id: 'c1', shopId: 'shop1', dailyBudgetCents: 3300, googleCampaignId: '111', googleAdGroupId: '222', googleAdContent: null as any };

  const makeService = (campaignOverride: any = {}) => {
    fetchCalls = 0; setObjs = [];
    const connections: any = { getConnection: async () => ({ refreshTokenEnc: encryptToken('r'), customerId: '999', managerId: '888' }) };
    const campaigns: any = {
      findById: async () => ({ ...base, ...campaignOverride }),
      setGoogleObjects: async (_id: string, g: any) => { setObjs.push(g); return null; },
    };
    (googleAdsService as any).fetchAdContent = async () => { fetchCalls++; return { headlines: ['H1', 'H2', 'H3'], descriptions: ['D1', 'D2'], keywords: ['k1'], finalUrl: 'https://x/l/c1', adId: '222~1' }; };
    return new GoogleComposerService(connections, campaigns);
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
    (googleAdsService as any).fetchAdContent = origFetch;
  });

  it('backfills from Google when content is empty', async () => {
    const svc = makeService();
    await svc.getDraftContent('c1');
    expect(fetchCalls).toBe(1);
    expect(setObjs[0].googleAdContent.headlines).toEqual(['H1', 'H2', 'H3']);
    expect(setObjs[0].googleAdId).toBe('222~1');
  });

  it('skips the read when content is already present', async () => {
    const svc = makeService({ googleAdContent: { headlines: ['A', 'B', 'C'], descriptions: ['x', 'y'], keywords: ['k'] } });
    await svc.getDraftContent('c1');
    expect(fetchCalls).toBe(0);
    expect(setObjs).toHaveLength(0);
  });

  it('forceRefresh reads even when content is present', async () => {
    const svc = makeService({ googleAdContent: { headlines: ['A', 'B', 'C'], descriptions: ['x', 'y'], keywords: ['k'] } });
    await svc.getDraftContent('c1', true);
    expect(fetchCalls).toBe(1);
  });

  it('no-op (no read) when the flag is off', async () => {
    delete process.env.ADS_GOOGLE_PUSH_ENABLED;
    const svc = makeService();
    await svc.getDraftContent('c1');
    expect(fetchCalls).toBe(0);
  });
});
