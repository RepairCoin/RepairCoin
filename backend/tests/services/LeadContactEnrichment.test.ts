// Lead contact enrichment: when a customer volunteers name/email/phone in chat, generateReply extracts it
// and persists it onto the LEAD (leads.updateContact) — gated on a contact-looking message so it's free otherwise.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

jest.mock('../../src/domains/AIAgentDomain/services/AiMemoryService', () => ({
  getAiMemoryService: () => ({ recallBlock: async () => null }),
}));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

const MODEL = 'claude-haiku-4-5-20251001';

function build(question: string) {
  let enriched: any = undefined;
  const anthropic = {
    complete: async ({ systemPrompt }: any) => {
      const first = systemPrompt?.[0]?.text || '';
      if (first.includes('contact details')) return { text: JSON.stringify({ name: 'Deo', email: 'deo@example.com', phone: '555-123-4567' }), costUsd: 0.0001, model: MODEL };
      if (first.includes('booking intent')) return { text: JSON.stringify({ wantsAvailability: false }), costUsd: 0.0001, model: MODEL };
      if (first.includes('confirming')) return { text: JSON.stringify({ confirming: false }), costUsd: 0.0001, model: MODEL };
      return { text: 'ok', costUsd: 0.0002, model: MODEL };
    },
  };
  const lead = { id: 'L1', campaignId: 'C1', creativeId: null, leadStatus: 'contacted', messengerId: 'PSID' };
  const svc = new LeadAutoAnswerService(
    anthropic as any,
    { canSpend: async () => ({ allowed: true }), recordSpend: async () => {} } as any,
    { getBrandKit: async () => ({}) } as any,
    { findById: async () => lead, updateStatus: async () => {}, clearEscalated: async () => {}, updateContact: async (_id: string, c: any) => { enriched = c; } } as any,
    { findById: async () => ({ id: 'C1', shopId: 'shop1', name: 'Camp', aiAgentEnabled: true }) } as any,
    { record: async () => {} } as any,
    { listByLead: async () => [{ author: 'lead', body: question }], append: async (m: any) => ({ ...m, id: 'x', createdAt: new Date() }) } as any,
    { getServicesByShop: async () => ({ items: [{ serviceId: 's1', serviceName: 'Newly Baker', category: 'food_beverage', priceUsd: 99, active: true }], pagination: {} }) } as any,
    { findById: async () => null, listByCampaign: async () => [] } as any,
    { getAvailableTimeSlots: async () => [] } as any,
    { getTimeSlotConfig: async () => ({ timezone: 'America/New_York' }) } as any,
    { deliver: async () => 'sent' } as any,
    { createLeadBooking: async () => ({}) } as any
  );
  return { svc, enriched: () => enriched };
}

describe('LeadAutoAnswerService — lead contact enrichment', () => {
  it('persists name/email/phone onto the lead when the customer provides them', async () => {
    const h = build("Hi, I'm Deo — my email is deo@example.com and phone 555-123-4567");
    await h.svc.generateReply('L1');
    expect(h.enriched()).toEqual({ name: 'Deo', email: 'deo@example.com', phone: '555-123-4567' });
  });

  it('does not run enrichment when the message has no contact info', async () => {
    const h = build('How much is the baking class?');
    await h.svc.generateReply('L1');
    expect(h.enriched()).toBeUndefined();
  });
});
