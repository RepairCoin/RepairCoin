/**
 * Phase 1 Slice 2C (AI Auto-Replies SMS) — CustomerSmsInboundService: routes an inbound customer
 * SMS (that isn't an ad lead) into a conversation message. Verifies the flag gate, To→shop routing,
 * customer resolution, and the sendMessage payload (channel='sms'). All deps mocked — no DB.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerSmsInboundService } from '../../src/domains/messaging/services/CustomerSmsInboundService';

function deps(over: any = {}) {
  const sent: any[] = [];
  const d = {
    sent,
    numberService: {
      findShopIdByInboundNumber: async (_to: string) => ('shopId' in over ? over.shopId : 'shop1'),
      ...over.numberService,
    },
    resolver: {
      resolve: async (_from: string, _shop: string) =>
        over.resolution === null
          ? null
          : over.resolution ?? { customerAddress: '0xabc', conversationId: 'conv1', isGuest: true, phone: '+15551112222' },
      ...over.resolver,
    },
    messageService: {
      sendMessage: async (req: any) => { sent.push(req); return { messageId: 'm1' }; },
      ...over.messageService,
    },
    consent: { grantOnInbound: async () => {}, isAllowedToSend: async () => true },
  };
  return d;
}

function build(d: any) {
  return new CustomerSmsInboundService({
    messageService: d.messageService,
    resolver: d.resolver,
    numberService: d.numberService,
    consent: d.consent,
  });
}

describe('CustomerSmsInboundService.handleInbound', () => {
  const ORIG = process.env.ENABLE_CUSTOMER_SMS;
  beforeEach(() => { process.env.ENABLE_CUSTOMER_SMS = 'true'; });
  afterEach(() => { process.env.ENABLE_CUSTOMER_SMS = ORIG; });

  it('routes an inbound SMS into a conversation message (channel=sms, customer sender)', async () => {
    const d = deps();
    const outcome = await build(d).handleInbound('+15550000000', '+15551112222', 'Do you fix screens?');
    expect(outcome).toBe('routed');
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0]).toMatchObject({
      conversationId: 'conv1',
      senderIdentifier: '0xabc',
      senderType: 'customer',
      messageText: 'Do you fix screens?',
      channel: 'sms',
    });
  });

  it('is a no-op when ENABLE_CUSTOMER_SMS is off', async () => {
    process.env.ENABLE_CUSTOMER_SMS = 'false';
    const d = deps();
    expect(await build(d).handleInbound('+15550000000', '+15551112222', 'hi')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('returns no_shop when the To number is not claimed by any shop (D2 not provisioned)', async () => {
    const d = deps({ shopId: null });
    expect(await build(d).handleInbound('+15550000000', '+15551112222', 'hi')).toBe('no_shop');
    expect(d.sent).toHaveLength(0);
  });

  it('returns unresolved when the customer/conversation cannot be resolved', async () => {
    const d = deps({ resolution: null });
    expect(await build(d).handleInbound('+15550000000', '+15551112222', 'hi')).toBe('unresolved');
    expect(d.sent).toHaveLength(0);
  });

  it('returns unresolved for an empty body without touching downstream services', async () => {
    const d = deps();
    expect(await build(d).handleInbound('+15550000000', '+15551112222', '   ')).toBe('unresolved');
    expect(d.sent).toHaveLength(0);
  });

  it('returns error (never throws) when sendMessage fails', async () => {
    const d = deps({ messageService: { sendMessage: async () => { throw new Error('boom'); } } });
    expect(await build(d).handleInbound('+15550000000', '+15551112222', 'hi')).toBe('error');
  });
});
