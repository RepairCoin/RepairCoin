// Focused-service price anchor: when the conversation is about one service, generateReply injects that
// service's EXACT price so a small model can't cross-wire a neighbouring similar service's price onto it.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

jest.mock('../../src/domains/AIAgentDomain/services/AiMemoryService', () => ({
  getAiMemoryService: () => ({ recallBlock: async () => null }),
}));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

const MODEL = 'claude-haiku-4-5-20251001';
type Block = { text: string; cache: boolean };

// Two similar tech services — the classic cross-wire trap.
const SERVICES = [
  { serviceId: 'irobot', serviceName: 'I Robot', category: 'tech_it_services', priceUsd: 699.99, durationMinutes: 50, active: true },
  { serviceId: 'aqua', serviceName: 'AQua Tech', category: 'tech_it_services', priceUsd: 455, durationMinutes: 50, active: true },
];

function build(thread: any[]) {
  let replyBlocks: Block[] = [];
  const anthropic = {
    complete: async ({ systemPrompt }: any) => {
      const first = systemPrompt?.[0]?.text || '';
      if (first.includes('confirming') || first.includes('booking intent') || first.includes('contact details')) {
        return { text: JSON.stringify({ wantsAvailability: false, confirming: false }), costUsd: 0.0001, model: MODEL };
      }
      replyBlocks = systemPrompt;
      return { text: 'ok', costUsd: 0.0002, model: MODEL };
    },
  };
  const lead = { id: 'L1', campaignId: 'C1', creativeId: null, leadStatus: 'contacted', messengerId: 'PSID' };
  const svc = new LeadAutoAnswerService(
    anthropic as any,
    { canSpend: async () => ({ allowed: true }), recordSpend: async () => {} } as any,
    { getBrandKit: async () => ({}) } as any,
    { findById: async () => lead, updateStatus: async () => {}, clearEscalated: async () => {}, updateContact: async () => {} } as any,
    { findById: async () => ({ id: 'C1', shopId: 'shop1', name: 'Camp', aiAgentEnabled: true }) } as any,
    { record: async () => {} } as any,
    { listByLead: async () => thread, append: async (m: any) => ({ ...m, id: 'x', createdAt: new Date() }) } as any,
    { getServicesByShop: async () => ({ items: SERVICES, pagination: {} }) } as any,
    { findById: async () => null, listByCampaign: async () => [] } as any,
    { getAvailableTimeSlots: async () => [] } as any,
    { getTimeSlotConfig: async () => ({ timezone: 'America/New_York' }) } as any,
    { deliver: async () => 'sent' } as any,
    { createLeadBooking: async () => ({}) } as any
  );
  return { svc, text: () => replyBlocks.map((b) => b.text).join('\n') };
}

describe('LeadAutoAnswerService — focused-service price anchor', () => {
  it('pins the focused service exact price (I Robot → $699.99, not AQua Tech $455)', async () => {
    const h = build([
      { author: 'ai', body: 'Sure! The earliest I Robot session on Monday is at 09:00.' },
      { author: 'lead', body: 'how much is it?' },
    ]);
    await h.svc.generateReply('L1');
    const t = h.text();
    expect(t).toContain('focused on "I Robot"');
    expect(t).toContain('$699.99');
    expect(t).toContain("never quote another service's price");
  });

  it('does not anchor when the recent turn is ambiguous (two services referenced)', async () => {
    const h = build([{ author: 'lead', body: 'do you have I Robot or AQua Tech?' }]);
    await h.svc.generateReply('L1');
    expect(h.text()).not.toContain('focused on');
  });
});
