// Phase 4 trigger: on explicit confirmation + contact, generateReply creates the booking and hands the
// pay link into the reply; missing contact → asks for it (no booking); not-confirming / already-booked /
// flag-off → no booking. Booking service + Anthropic are faked (no real writes, no AI).
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

jest.mock('../../src/domains/AIAgentDomain/services/AiMemoryService', () => ({
  getAiMemoryService: () => ({ recallBlock: async () => null }),
}));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

const MODEL = 'claude-haiku-4-5-20251001';
type Block = { text: string; cache: boolean };
const OFFER = { author: 'ai', body: 'Newly Baker is open Friday July 10 at 09:00, 10:00, 11:00.' };

function build(opts: { thread: any[]; bookingExtraction?: any; bookingResult?: any; bookingThrows?: any }) {
  let replyBlocks: Block[] = [];
  let bookingCalledWith: any = null;
  const anthropic = {
    complete: async ({ systemPrompt }: any) => {
      const first = systemPrompt?.[0]?.text || '';
      if (first.includes('confirming')) return { text: JSON.stringify(opts.bookingExtraction ?? { confirming: false }), costUsd: 0.0001, model: MODEL };
      if (first.includes('booking intent')) return { text: JSON.stringify({ wantsAvailability: false }), costUsd: 0.0001, model: MODEL };
      if (first.includes('contact details')) return { text: JSON.stringify({ name: 'Deo', email: 'deo@example.com', phone: null }), costUsd: 0.0001, model: MODEL };
      replyBlocks = systemPrompt;
      return { text: 'ok', costUsd: 0.0002, model: MODEL };
    },
  };
  const services = { getServicesByShop: async () => ({ items: [{ serviceId: 'srv-1', serviceName: 'Newly Baker', category: 'food_beverage', priceUsd: 99, active: true }], pagination: {} }) };
  const booking = {
    createLeadBooking: async (args: any) => {
      bookingCalledWith = args;
      if (opts.bookingThrows) throw opts.bookingThrows;
      return opts.bookingResult ?? { orderId: 'o1', serviceName: 'Newly Baker', price: 99, bookingDate: '2026-07-10', bookingTimeSlot: '09:00', paymentUrl: 'https://checkout.stripe.com/pay/cs_1', emailSent: true };
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
    { listByLead: async () => opts.thread, append: async (m: any) => ({ ...m, id: 'x', createdAt: new Date() }) } as any,
    services as any,
    { findById: async () => null, listByCampaign: async () => [] } as any,
    { getAvailableTimeSlots: async () => [] } as any,
    { getTimeSlotConfig: async () => ({ timezone: 'America/New_York' }) } as any,
    { deliver: async () => 'sent' } as any,
    booking as any
  );
  return { svc, text: () => replyBlocks.map((b) => b.text).join('\n'), booked: () => bookingCalledWith };
}

describe('LeadAutoAnswerService — Phase 4 booking trigger', () => {
  beforeEach(() => { process.env.ADS_AI_BOOKING_ENABLED = 'true'; });
  afterEach(() => { delete process.env.ADS_AI_BOOKING_ENABLED; });

  it('books and hands over the pay link when the customer confirms + gave contact', async () => {
    const h = build({
      thread: [OFFER, { author: 'lead', body: 'Yes book 9am, I am Deo deo@example.com' }],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: 'Deo', email: 'deo@example.com' },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toMatchObject({ serviceId: 'srv-1', bookingDate: '2026-07-10', bookingTimeSlot: '09:00', customerEmail: 'deo@example.com' });
    expect(h.text()).toContain('BOOKING CREATED');
    expect(h.text()).toContain('https://checkout.stripe.com/pay/cs_1');
  });

  it('asks for contact (does NOT book) when confirming but no email yet', async () => {
    const h = build({
      thread: [OFFER, { author: 'lead', body: 'book 9am please' }],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: null, email: null },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toBeNull();
    expect(h.text()).toContain('ask for their full name, email, and phone');
  });

  it('does not book when the customer is not confirming', async () => {
    const h = build({
      thread: [OFFER, { author: 'lead', body: 'how much is it?' }],
      bookingExtraction: { confirming: false },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toBeNull();
    expect(h.text()).not.toContain('BOOKING CREATED');
  });

  it('does not re-book once a pay link is already in the thread', async () => {
    const h = build({
      thread: [OFFER, { author: 'ai', body: 'Here is your link: https://checkout.stripe.com/pay/cs_old' }, { author: 'lead', body: 'yes book 9am deo@example.com' }],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: 'Deo', email: 'deo@example.com' },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toBeNull();
  });

  it('still books when a prior message only says the words "payment link" (no real Stripe link)', async () => {
    const h = build({
      thread: [
        OFFER,
        { author: 'ai', body: 'To lock it in I need your name and email so I can send the confirmation and payment link.' },
        { author: 'lead', body: 'yes book 9am, Deo deo@example.com' },
      ],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: 'Deo', email: 'deo@example.com' },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toMatchObject({ serviceId: 'srv-1' });
  });

  it('offers alternatives when the slot was just taken (409)', async () => {
    const h = build({
      thread: [OFFER, { author: 'lead', body: 'yes book 9am deo@example.com' }],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: 'Deo', email: 'deo@example.com' },
      bookingThrows: Object.assign(new Error('taken'), { status: 409 }),
    });
    await h.svc.generateReply('L1');
    expect(h.text()).toContain('JUST taken');
  });

  it('does nothing when the flag is off', async () => {
    process.env.ADS_AI_BOOKING_ENABLED = 'false';
    const h = build({
      thread: [OFFER, { author: 'lead', body: 'yes book 9am deo@example.com' }],
      bookingExtraction: { confirming: true, service: 'Newly Baker', date: '2026-07-10', time: '09:00', name: 'Deo', email: 'deo@example.com' },
    });
    await h.svc.generateReply('L1');
    expect(h.booked()).toBeNull();
  });
});
