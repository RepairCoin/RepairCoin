// backend/tests/services/AdAttribution.test.ts
//
// Unit tests for conversion attribution helpers + flag gating. DB behavior is covered by a
// live test (the SQL contact-match needs real rows); here we cover the pure phone-normalize
// and that the service is a hard no-op when the flag is off (no DB touched).

import {
  AdAttributionService,
  phoneTail,
  isConversionAttributionEnabled,
} from '../../src/domains/AdsDomain/services/AdAttributionService';

describe('phoneTail', () => {
  it('returns the last 10 digits regardless of format', () => {
    expect(phoneTail('+63 917 000 0005')).toBe('9170000005'); // 12 digits → last 10
    expect(phoneTail('0917-000-0005')).toBe('9170000005');    // 11 digits → last 10
    expect(phoneTail('(212) 555-0142')).toBe('2125550142');   // exactly 10
  });
  it('returns empty when fewer than 10 digits', () => {
    expect(phoneTail('555-0142')).toBe('');
    expect(phoneTail('')).toBe('');
    expect(phoneTail(null)).toBe('');
    expect(phoneTail(undefined)).toBe('');
  });
});

describe('AdAttributionService flag gating', () => {
  const prev = process.env.ADS_CONVERSION_ATTRIBUTION;
  afterEach(() => {
    if (prev === undefined) delete process.env.ADS_CONVERSION_ATTRIBUTION;
    else process.env.ADS_CONVERSION_ATTRIBUTION = prev;
  });

  it('isConversionAttributionEnabled reflects the env flag', () => {
    process.env.ADS_CONVERSION_ATTRIBUTION = 'true';
    expect(isConversionAttributionEnabled()).toBe(true);
    process.env.ADS_CONVERSION_ATTRIBUTION = 'false';
    expect(isConversionAttributionEnabled()).toBe(false);
  });

  it('attributeOrderPaid is a no-op (no DB) when the flag is off', async () => {
    delete process.env.ADS_CONVERSION_ATTRIBUTION;
    const failPool: any = { query: () => { throw new Error('DB must not be touched when disabled'); } };
    const svc = new AdAttributionService(failPool);
    const r = await svc.attributeOrderPaid({ orderId: 'o1', customerAddress: '0xabc', shopId: 'peanut' });
    expect(r.linked).toBe(false);
  });

  it('backfillUnattributed is a no-op (no DB) when the flag is off', async () => {
    delete process.env.ADS_CONVERSION_ATTRIBUTION;
    const failPool: any = { query: () => { throw new Error('DB must not be touched when disabled'); } };
    const svc = new AdAttributionService(failPool);
    const r = await svc.backfillUnattributed({ shopId: 'peanut' });
    expect(r).toEqual({ scanned: 0, linked: 0 });
  });
});
