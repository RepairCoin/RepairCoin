// backend/tests/services/AdsGoogleComposer.test.ts
//
// Google composer — the pure RSA validator + GoogleComposerService.updateDraft decision logic
// (only-changed-parts pushed, flag-off / not-connected guards, RSA-minima rejection). The live
// Google mutations are externally gated, so the googleAdsService singleton is monkeypatched and
// repos are faked. Mirrors AdsGooglePush style.

import { validateRsaContent } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { GoogleComposerService } from '../../src/domains/AdsDomain/services/GoogleComposerService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('validateRsaContent (pure)', () => {
  it('accepts + trims/dedupes/caps valid copy', () => {
    const r = validateRsaContent(['A', 'A', ' B ', 'C', 'D'], ['one', 'two']);
    expect(r).toEqual({ headlines: ['A', 'B', 'C', 'D'], descriptions: ['one', 'two'] });
  });
  it('rejects <3 headlines', () => {
    expect(validateRsaContent(['A', 'B'], ['one', 'two'])).toEqual({ error: expect.stringContaining('3 headlines') });
  });
  it('rejects <2 descriptions', () => {
    expect(validateRsaContent(['A', 'B', 'C'], ['one'])).toEqual({ error: expect.stringContaining('2 descriptions') });
  });
  it('drops over-length entries (which can push below the minimum)', () => {
    const longH = 'x'.repeat(31);
    expect(validateRsaContent(['A', 'B', longH], ['one', 'two'])).toEqual({ error: expect.stringContaining('3 headlines') });
  });
});

describe('GoogleComposerService.updateDraft', () => {
  const prevFlag = process.env.ADS_GOOGLE_PUSH_ENABLED;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origBudget = (googleAdsService as any).updateCampaignBudget;
  const origRsa = (googleAdsService as any).replaceResponsiveSearchAd;
  const origKw = (googleAdsService as any).reconcileKeywords;

  let calls: string[];
  let setObjs: any[];
  let updates: any[];

  const baseCampaign = {
    id: 'c1', shopId: 'shop1', status: 'draft', dailyBudgetCents: 3300,
    googleCampaignId: '111', googleAdGroupId: '222', googleBudgetId: '333', googleAdId: '222~999',
    googleAdContent: { headlines: ['H1', 'H2', 'H3'], descriptions: ['D1', 'D2'], keywords: ['phone repair'], finalUrl: 'https://x/l/c1' },
  };

  const makeService = (campaignOverride: any = {}, conn: any = undefined) => {
    calls = []; setObjs = []; updates = [];
    const connections: any = {
      getConnection: async () => conn !== undefined ? conn
        : { refreshTokenEnc: encryptToken('r'), customerId: '9849422982', managerId: '7460409500' },
    };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign, ...campaignOverride }),
      update: async (_id: string, u: any) => { updates.push(u); return null; },
      setGoogleObjects: async (_id: string, g: any) => { setObjs.push(g); return null; },
    };
    (googleAdsService as any).updateCampaignBudget = async () => { calls.push('budget'); };
    (googleAdsService as any).replaceResponsiveSearchAd = async () => { calls.push('rsa'); return { adResourceName: 'customers/9849422982/adGroupAds/222~1000' }; };
    (googleAdsService as any).reconcileKeywords = async (_c: string, _t: string, _id: string, _rn: string, desired: string[]) => { calls.push('keywords'); return { keywords: desired }; };
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
    (googleAdsService as any).updateCampaignBudget = origBudget;
    (googleAdsService as any).replaceResponsiveSearchAd = origRsa;
    (googleAdsService as any).reconcileKeywords = origKw;
  });

  it('throws when the flag is off', async () => {
    delete process.env.ADS_GOOGLE_PUSH_ENABLED;
    await expect(makeService().updateDraft('c1', { dailyBudgetCents: 5000 })).rejects.toThrow('push_disabled');
  });

  it('throws for a non-Google campaign', async () => {
    await expect(makeService({ googleCampaignId: null }).updateDraft('c1', {})).rejects.toThrow('not_a_google_draft');
  });

  it('throws when disconnected', async () => {
    await expect(makeService({}, null).updateDraft('c1', { dailyBudgetCents: 5000 })).rejects.toThrow('google_not_connected');
  });

  it('pushes ONLY the budget when only budget changed', async () => {
    const svc = makeService();
    await svc.updateDraft('c1', { dailyBudgetCents: 5000 });
    expect(calls).toEqual(['budget']);
    expect(updates).toEqual([{ dailyBudgetCents: 5000 }]);
  });

  it('recreates the RSA + stamps new ad id when copy changed', async () => {
    const svc = makeService();
    await svc.updateDraft('c1', { headlines: ['New1', 'New2', 'New3'], descriptions: ['NewD1', 'NewD2'] });
    expect(calls).toEqual(['rsa']);
    expect(setObjs.some((s) => s.googleAdId === '222~1000')).toBe(true);
    expect(setObjs.some((s) => s.googleAdContent?.headlines?.[0] === 'New1')).toBe(true);
  });

  it('rejects invalid RSA copy (too few headlines) without pushing', async () => {
    const svc = makeService();
    await expect(svc.updateDraft('c1', { headlines: ['only', 'two'], descriptions: ['D1', 'D2'] })).rejects.toThrow('invalid_rsa');
    expect(calls).toHaveLength(0);
  });

  it('reconciles keywords when they changed', async () => {
    const svc = makeService();
    await svc.updateDraft('c1', { keywords: ['phone repair', 'screen fix'] });
    expect(calls).toEqual(['keywords']);
    expect(setObjs.some((s) => s.googleAdContent?.keywords?.includes('screen fix'))).toBe(true);
  });
});
