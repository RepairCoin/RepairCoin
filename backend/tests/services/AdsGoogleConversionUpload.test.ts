// backend/tests/services/AdsGoogleConversionUpload.test.ts
//
// Google conversion-optimization Phase 2 — GoogleConversionService.uploadLeadConversion decision
// logic + the pure datetime formatter. The live uploadClickConversions call is externally gated, so
// the googleAdsService singleton is monkeypatched and repos are faked. Mirrors AdsGooglePush style.

import { GoogleConversionService, fmtGoogleConversionDateTime } from '../../src/domains/AdsDomain/services/GoogleConversionService';
import { googleAdsService } from '../../src/domains/AdsDomain/services/GoogleAdsService';
import { encryptToken } from '../../src/utils/tokenCrypto';

describe('fmtGoogleConversionDateTime (pure)', () => {
  it('formats a Date as Google\'s "yyyy-MM-dd HH:mm:ss+00:00"', () => {
    expect(fmtGoogleConversionDateTime(new Date('2026-07-02T13:04:05.678Z'))).toBe('2026-07-02 13:04:05+00:00');
  });
});

describe('GoogleConversionService.uploadLeadConversion', () => {
  const prevFlag = process.env.ADS_GOOGLE_PUSH_ENABLED;
  const prevKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  const origConfigured = (googleAdsService as any).isConfigured;
  const origEnsure = (googleAdsService as any).ensureLeadConversionAction;
  const origUpload = (googleAdsService as any).uploadClickConversion;

  let uploads: any[];
  let ensureCalls: number;
  let marked: string[];
  let savedActions: any[];

  const makeService = (opts: {
    lead?: any; campaign?: any; conn?: any; existingAction?: string | null;
  }) => {
    uploads = []; ensureCalls = 0; marked = []; savedActions = [];
    const leads: any = {
      findById: async () => opts.lead === undefined
        ? { id: 'l1', gclid: 'Cj0xyz', conversionUploadedAt: null, campaignId: 'c1' }
        : opts.lead,
      markConversionUploaded: async (id: string) => { marked.push(id); },
    };
    const campaigns: any = {
      findById: async () => opts.campaign === undefined ? { id: 'c1', shopId: 'shop1', googleCampaignId: '111' } : opts.campaign,
    };
    const connections: any = {
      getConnection: async () => opts.conn === undefined
        ? { refreshTokenEnc: encryptToken('r'), customerId: '9849422982', managerId: '7460409500' }
        : opts.conn,
      getConversionAction: async () => opts.existingAction ?? null,
      saveConversionAction: async (_shop: string, res: string) => { savedActions.push(res); },
    };
    (googleAdsService as any).ensureLeadConversionAction = async () => { ensureCalls++; return 'customers/9849422982/conversionActions/555'; };
    (googleAdsService as any).uploadClickConversion = async (_cid: string, _t: string, input: any, login?: string) => {
      uploads.push({ gclid: input.gclid, action: input.conversionActionResourceName, when: input.conversionDateTime, login });
    };
    return new GoogleConversionService(connections, campaigns, leads);
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
    (googleAdsService as any).ensureLeadConversionAction = origEnsure;
    (googleAdsService as any).uploadClickConversion = origUpload;
  });

  it('no-op when the flag is off', async () => {
    delete process.env.ADS_GOOGLE_PUSH_ENABLED;
    expect(await makeService({}).uploadLeadConversion('l1')).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it('skips a lead with no gclid', async () => {
    const svc = makeService({ lead: { id: 'l1', gclid: null, conversionUploadedAt: null, campaignId: 'c1' } });
    expect(await svc.uploadLeadConversion('l1')).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it('skips a lead already uploaded (idempotent)', async () => {
    const svc = makeService({ lead: { id: 'l1', gclid: 'g', conversionUploadedAt: new Date(), campaignId: 'c1' } });
    expect(await svc.uploadLeadConversion('l1')).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it('skips a non-Google campaign', async () => {
    const svc = makeService({ campaign: { id: 'c1', shopId: 'shop1', googleCampaignId: null } });
    expect(await svc.uploadLeadConversion('l1')).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it('skips a disconnected shop', async () => {
    const svc = makeService({ conn: null });
    expect(await svc.uploadLeadConversion('l1')).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  it('creates + caches the conversion action on first use, uploads, and marks the lead', async () => {
    const svc = makeService({ existingAction: null });
    const ok = await svc.uploadLeadConversion('l1', new Date('2026-07-02T10:00:00Z'));
    expect(ok).toBe(true);
    expect(ensureCalls).toBe(1);
    expect(savedActions).toEqual(['customers/9849422982/conversionActions/555']);
    expect(uploads).toEqual([{ gclid: 'Cj0xyz', action: 'customers/9849422982/conversionActions/555', when: '2026-07-02 10:00:00+00:00', login: '7460409500' }]);
    expect(marked).toEqual(['l1']);
  });

  it('reuses the cached conversion action (no create) on subsequent uploads', async () => {
    const svc = makeService({ existingAction: 'customers/9849422982/conversionActions/999' });
    await svc.uploadLeadConversion('l1');
    expect(ensureCalls).toBe(0);
    expect(savedActions).toHaveLength(0);
    expect(uploads[0].action).toBe('customers/9849422982/conversionActions/999');
    expect(marked).toEqual(['l1']);
  });
});
