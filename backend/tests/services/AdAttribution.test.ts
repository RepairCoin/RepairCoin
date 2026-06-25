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

describe('attributeOrderStage — lifecycle auto-advance (booked/paid/completed)', () => {
  const prev = process.env.ADS_CONVERSION_ATTRIBUTION;
  beforeEach(() => { process.env.ADS_CONVERSION_ATTRIBUTION = 'true'; });
  afterEach(() => {
    if (prev === undefined) delete process.env.ADS_CONVERSION_ATTRIBUTION;
    else process.env.ADS_CONVERSION_ATTRIBUTION = prev;
  });

  it('is a no-op (no DB) when the flag is off', async () => {
    delete process.env.ADS_CONVERSION_ATTRIBUTION;
    const failPool: any = { query: () => { throw new Error('DB must not be touched when disabled'); } };
    const r = await new AdAttributionService(failPool)
      .attributeOrderStage({ orderId: 'o1', customerAddress: '0xabc', shopId: 'peanut' }, 'completed');
    expect(r.linked).toBe(false);
  });

  it('reuses an already-linked order and advances the lead to the given stage', async () => {
    const queries: { sql: string; params: any[] }[] = [];
    const pool: any = { query: (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      if (/SELECT ad_lead_id FROM service_orders/.test(sql)) return Promise.resolve({ rows: [{ ad_lead_id: 'lead1' }], rowCount: 1 });
      return Promise.resolve({ rows: [], rowCount: 1 }); // the UPDATE ad_leads advance
    }};
    const r = await new AdAttributionService(pool)
      .attributeOrderStage({ orderId: 'o1', customerAddress: '0xABC', shopId: 'peanut' }, 'completed');
    expect(r).toEqual({ linked: true, leadId: 'lead1' });
    const upd = queries.find((q) => /UPDATE ad_leads/.test(q.sql));
    expect(upd).toBeTruthy();
    expect(upd!.params).toContain('completed');  // advanced to the requested stage
    expect(upd!.params).toContain('0xabc');       // customer back-link, lowercased
  });

  it('contact-matches and links an unlinked order, then advances to booked', async () => {
    const queries: { sql: string; params: any[] }[] = [];
    const pool: any = { query: (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      if (/SELECT ad_lead_id FROM service_orders/.test(sql)) return Promise.resolve({ rows: [{ ad_lead_id: null }], rowCount: 1 });
      if (/FROM customers/.test(sql)) return Promise.resolve({ rows: [{ email: 'a@b.com', phone: '+639170000005' }], rowCount: 1 });
      if (/FROM ad_leads l/.test(sql)) return Promise.resolve({ rows: [{ id: 'lead9' }], rowCount: 1 });
      return Promise.resolve({ rowCount: 1 }); // the two UPDATEs (service_orders link + ad_leads advance)
    }};
    const r = await new AdAttributionService(pool)
      .attributeOrderStage({ orderId: 'o2', customerAddress: '0xZ', shopId: 'peanut' }, 'booked');
    expect(r).toEqual({ linked: true, leadId: 'lead9' });
    expect(queries.some((q) => /UPDATE service_orders/.test(q.sql) && q.params.includes('lead9'))).toBe(true);
    expect(queries.some((q) => /UPDATE ad_leads/.test(q.sql) && q.params.includes('booked'))).toBe(true);
  });

  it('returns not-linked when there is no contact match', async () => {
    const pool: any = { query: (sql: string) => {
      if (/SELECT ad_lead_id FROM service_orders/.test(sql)) return Promise.resolve({ rows: [{ ad_lead_id: null }], rowCount: 1 });
      if (/FROM customers/.test(sql)) return Promise.resolve({ rows: [{ email: '', phone: '' }], rowCount: 1 });
      return Promise.resolve({ rows: [], rowCount: 0 });
    }};
    const r = await new AdAttributionService(pool)
      .attributeOrderStage({ orderId: 'o3', customerAddress: '0xq', shopId: 'peanut' }, 'paid');
    expect(r.linked).toBe(false);
  });
});
