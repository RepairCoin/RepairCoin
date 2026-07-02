// backend/tests/services/AdsGooglePush.test.ts
//
// Unit tests for the Google go-live + status-mirror decision logic (GooglePushService). The live
// enable on Google (real spend, needs a funded account + conversion action) can't run on a TEST
// account, so the precondition gates + the status mapping are verified here deterministically:
// the imported googleAdsService singleton is monkeypatched, repos are faked. Mirrors the
// AdsMetaConfigSync test style.

import { GooglePushService } from '../../src/domains/AdsDomain/services/GooglePushService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('GooglePushService', () => {
  const prevFlag = process.env.ADS_GOOGLE_PUSH_ENABLED;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origSetStatus = (googleAdsService as any).setCampaignServingStatus;
  const origPre = (googleAdsService as any).getGoLivePreconditions;

  // A built Google draft: PAUSED on the shop's account, not yet live (no startedAt on the campaign).
  const baseCampaign = {
    id: 'c1', shopId: 'shop1', status: 'draft',
    googleCampaignId: '111', googleAdGroupId: '222', googleBudgetId: '333', googleStatus: 'PAUSED',
  };

  let servingCalls: any[];
  let setGoogleObjectsArgs: any[];
  let preconditions: { hasConversionAction: boolean; hasFunding: boolean };

  const makeService = (campaignOverride: any = {}, connOverride: any = undefined) => {
    servingCalls = []; setGoogleObjectsArgs = [];
    const connections: any = {
      getConnection: async () =>
        connOverride !== undefined
          ? connOverride
          : { refreshTokenEnc: encryptToken('fake-refresh'), customerId: '9849422982', managerId: '7460409500', connected: true },
    };
    const campaigns: any = {
      findById: async () => ({ ...baseCampaign, ...campaignOverride }),
      setGoogleObjects: async (_id: string, g: any) => { setGoogleObjectsArgs.push(g); return null; },
    };
    return new GooglePushService(connections, campaigns);
  };

  beforeEach(() => {
    process.env.ADS_GOOGLE_PUSH_ENABLED = 'true';
    process.env.META_TOKEN_ENCRYPTION_KEY = 'test-key-for-token-roundtrip';
    preconditions = { hasConversionAction: true, hasFunding: true };
    (googleAdsService as any).isConfigured = () => true;
    (googleAdsService as any).setCampaignServingStatus = async (customerId: string, _t: string, input: any, status: string, login?: string) => {
      servingCalls.push({ customerId, campaignId: input.campaignId, adGroupId: input.adGroupId, status, login });
      return { ads: 1 };
    };
    (googleAdsService as any).getGoLivePreconditions = async () => preconditions;
  });
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.ADS_GOOGLE_PUSH_ENABLED; else process.env.ADS_GOOGLE_PUSH_ENABLED = prevFlag;
    if (prevKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY; else process.env.META_TOKEN_ENCRYPTION_KEY = prevKey;
    (googleAdsService as any).isConfigured = origConfigured;
    (googleAdsService as any).setCampaignServingStatus = origSetStatus;
    (googleAdsService as any).getGoLivePreconditions = origPre;
  });

  describe('pushStatus (status mirror)', () => {
    it('returns false without touching Google when the flag is off', async () => {
      delete process.env.ADS_GOOGLE_PUSH_ENABLED;
      const svc = makeService();
      expect(await svc.pushStatus('c1', 'PAUSED')).toBe(false);
      expect(servingCalls).toHaveLength(0);
    });

    it('returns false for a campaign not on Google (no googleCampaignId)', async () => {
      const svc = makeService({ googleCampaignId: null });
      expect(await svc.pushStatus('c1', 'ENABLED')).toBe(false);
      expect(servingCalls).toHaveLength(0);
    });

    it('returns false when the shop is disconnected', async () => {
      const svc = makeService({}, null);
      expect(await svc.pushStatus('c1', 'PAUSED')).toBe(false);
      expect(servingCalls).toHaveLength(0);
    });

    it('pushes the status to the campaign + ad group + ad through the shop manager, and mirrors to the DB', async () => {
      const svc = makeService();
      const ok = await svc.pushStatus('c1', 'PAUSED');
      expect(ok).toBe(true);
      expect(servingCalls).toEqual([
        { customerId: '9849422982', campaignId: '111', adGroupId: '222', status: 'PAUSED', login: '7460409500' },
      ]);
      expect(setGoogleObjectsArgs).toEqual([{ googleStatus: 'PAUSED' }]);
    });
  });

  describe('goLive', () => {
    it('throws when the flag is off', async () => {
      delete process.env.ADS_GOOGLE_PUSH_ENABLED;
      const svc = makeService();
      await expect(svc.goLive('c1')).rejects.toThrow('push_disabled');
    });

    it('throws not_a_google_draft for a non-Google campaign', async () => {
      const svc = makeService({ googleCampaignId: null });
      await expect(svc.goLive('c1')).rejects.toThrow('not_a_google_draft');
    });

    it('refuses a campaign archived/removed on Google', async () => {
      const svc = makeService({ status: 'archived' });
      await expect(svc.goLive('c1')).rejects.toThrow('campaign_archived_on_google');
      expect(servingCalls).toHaveLength(0);
    });

    it('blocks go-live when the account has no conversion action', async () => {
      preconditions = { hasConversionAction: false, hasFunding: true };
      const svc = makeService();
      await expect(svc.goLive('c1')).rejects.toThrow('no_conversion_action');
      expect(servingCalls).toHaveLength(0);
    });

    it('blocks go-live when the account has no funding source', async () => {
      preconditions = { hasConversionAction: true, hasFunding: false };
      const svc = makeService();
      await expect(svc.goLive('c1')).rejects.toThrow('no_funding_source');
      expect(servingCalls).toHaveLength(0);
    });

    it('enables the campaign + mirrors ENABLED when both preconditions pass', async () => {
      const svc = makeService();
      await svc.goLive('c1');
      expect(servingCalls).toEqual([
        { customerId: '9849422982', campaignId: '111', adGroupId: '222', status: 'ENABLED', login: '7460409500' },
      ]);
      expect(setGoogleObjectsArgs).toEqual([{ googleStatus: 'ENABLED' }]);
    });
  });
});
