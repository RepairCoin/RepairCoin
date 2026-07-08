// Phase 3 — read-only availability grounding. Asserts: a scheduling question triggers the extraction +
// real-slot lookup and injects an availability block (time-of-day filtered); no slots → "fully booked";
// ambiguous service → "ask which service"; a non-scheduling message and the flag-off case inject nothing.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

jest.mock('../../src/domains/AIAgentDomain/services/AiMemoryService', () => ({
  getAiMemoryService: () => ({ recallBlock: async () => null }),
}));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

const MODEL = 'claude-haiku-4-5-20251001';
type Block = { text: string; cache: boolean };
const slot = (time: string, available = true) => ({ time, available, bookedCount: 0, maxBookings: 2 });

function build(opts: { question: string; extraction?: any; slots?: any[]; services?: any[] }) {
  let replyBlocks: Block[] = [];
  let extractionCalled = false;
  const anthropic = {
    complete: async ({ systemPrompt }: any) => {
      const first = systemPrompt?.[0]?.text || '';
      if (first.includes('booking intent')) {
        extractionCalled = true;
        return { text: JSON.stringify(opts.extraction ?? { wantsAvailability: false }), costUsd: 0.0001, model: MODEL };
      }
      replyBlocks = systemPrompt;
      return { text: 'ok', costUsd: 0.0002, model: MODEL };
    },
  };
  const services = {
    getServicesByShop: async () => ({
      items: opts.services ?? [{ serviceId: 'svc-bake', serviceName: 'Newly Baker', category: 'food_beverage', priceUsd: 99, active: true }],
      pagination: {},
    }),
  };
  const appointments = { getAvailableTimeSlots: async () => opts.slots ?? [] };
  const appointmentRepo = { getTimeSlotConfig: async () => ({ timezone: 'America/New_York' }) };
  const creatives = { findById: async () => null, listByCampaign: async () => [] };
  const lead = { id: 'L1', campaignId: 'C1', creativeId: null, leadStatus: 'contacted', messengerId: 'PSID' };
  const leads = { findById: async () => lead, updateStatus: async () => {}, clearEscalated: async () => {} };
  const campaigns = { findById: async () => ({ id: 'C1', shopId: 'shop1', name: 'Camp', aiAgentEnabled: true }) };
  const messages = {
    listByLead: async () => [{ author: 'lead', body: opts.question }],
    append: async (m: any) => ({ ...m, id: 'stub', createdAt: new Date() }),
  };
  const svc = new LeadAutoAnswerService(
    anthropic as any,
    { canSpend: async () => ({ allowed: true }), recordSpend: async () => {} } as any,
    { getBrandKit: async () => ({}) } as any,
    leads as any, campaigns as any, { record: async () => {} } as any, messages as any,
    services as any, creatives as any, appointments as any, appointmentRepo as any,
    { deliver: async () => 'sent' } as any
  );
  return { svc, text: () => replyBlocks.map((b) => b.text).join('\n'), extractionCalled: () => extractionCalled };
}

describe('LeadAutoAnswerService — Phase 3 availability grounding', () => {
  beforeEach(() => { process.env.ADS_AI_AVAILABILITY_GROUNDING = 'true'; });
  afterEach(() => { delete process.env.ADS_AI_AVAILABILITY_GROUNDING; });

  it('injects real, time-of-day-filtered slots for a scheduling question', async () => {
    const { svc, text } = build({
      question: 'Is Friday morning available?',
      extraction: { wantsAvailability: true, service: 'Newly Baker', date: '2026-07-10', timeOfDay: 'morning' },
      slots: [slot('09:00'), slot('10:30'), slot('14:00'), slot('11:00', false)],
    });
    await svc.generateReply('L1');
    const t = text();
    expect(t).toContain('REAL AVAILABILITY');
    expect(t).toContain('Newly Baker');
    expect(t).toContain('09:00');
    expect(t).toContain('10:30');
    expect(t).not.toContain('14:00'); // afternoon filtered out
    expect(t).not.toContain('11:00'); // not available
  });

  it('says fully booked when there are no open slots', async () => {
    const { svc, text } = build({
      question: 'Do you have tomorrow?',
      extraction: { wantsAvailability: true, service: 'Newly Baker', date: '2026-07-10', timeOfDay: null },
      slots: [slot('09:00', false)],
    });
    await svc.generateReply('L1');
    expect(text()).toContain('NO open slots');
  });

  it('asks which service when the service is ambiguous', async () => {
    const { svc, text } = build({
      question: 'What times are available on Friday?',
      extraction: { wantsAvailability: true, service: null, date: '2026-07-10', timeOfDay: null },
      services: [
        { serviceId: 'a', serviceName: 'Newly Baker', category: 'food_beverage', priceUsd: 99, active: true },
        { serviceId: 'b', serviceName: 'AQua Tech', category: 'tech_it_services', priceUsd: 455, active: true },
      ],
    });
    await svc.generateReply('L1');
    expect(text()).toContain("hasn't made clear WHICH service");
  });

  it('injects nothing (and skips extraction) for a non-scheduling message', async () => {
    const h = build({ question: 'How much does it cost?' });
    await h.svc.generateReply('L1');
    expect(h.extractionCalled()).toBe(false);
    expect(h.text()).not.toContain('REAL AVAILABILITY');
  });

  it('injects nothing when the flag is off', async () => {
    process.env.ADS_AI_AVAILABILITY_GROUNDING = 'false';
    const h = build({
      question: 'Is Friday morning available?',
      extraction: { wantsAvailability: true, service: 'Newly Baker', date: '2026-07-10', timeOfDay: 'morning' },
      slots: [slot('09:00')],
    });
    await h.svc.generateReply('L1');
    expect(h.extractionCalled()).toBe(false);
    expect(h.text()).not.toContain('REAL AVAILABILITY');
  });
});
