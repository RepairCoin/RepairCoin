// backend/tests/services/AdsLeadGclid.test.ts
//
// Google conversion-optimization Phase 1 — the gclid captured on the landing page must be persisted
// on the lead, so a later phase can upload an offline conversion to Google. Verifies
// LeadAttributionService.attribute() threads gclid into LeadRepository.create (and defaults to null
// when absent). Fake repo, no DB.

import { LeadAttributionService } from '../../src/domains/AdsDomain/services/LeadAttributionService';

describe('LeadAttributionService — gclid capture (Phase 1)', () => {
  const makeService = () => {
    const created: any[] = [];
    const leads: any = {
      findByMetaLeadId: async () => null,
      findRecentByPhone: async () => null,
      create: async (input: any) => { created.push(input); return { id: 'lead1' }; },
    };
    return { svc: new LeadAttributionService(leads), created };
  };

  it('persists the gclid on the created lead', async () => {
    const { svc, created } = makeService();
    const r = await svc.attribute({ campaignId: 'c1', phone: '5551234567', gclid: 'Cj0abc123', method: 'utm' });
    expect(r.deduped).toBe(false);
    expect(created).toHaveLength(1);
    expect(created[0].gclid).toBe('Cj0abc123');
  });

  it('defaults gclid to null when the lead has none', async () => {
    const { svc, created } = makeService();
    await svc.attribute({ campaignId: 'c1', email: 'a@b.com', method: 'utm' });
    expect(created[0].gclid).toBeNull();
  });
});
