/**
 * Phase 2 Slice B — CustomerWhatsAppInboundService + WhatsAppNumberService: route an inbound WhatsApp
 * customer message into a conversation. Verifies flag gate, phone_number_id→shop, wa_id normalization
 * (prefixed '+'), and the sendMessage payload (channel='whatsapp'). All deps mocked — no DB.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerWhatsAppInboundService } from '../../src/domains/messaging/services/CustomerWhatsAppInboundService';
import { WhatsAppNumberService } from '../../src/services/WhatsAppNumberService';

function deps(over: any = {}) {
  const sent: any[] = [];
  const resolved: any[] = [];
  const d = {
    sent,
    resolved,
    numberService: {
      findShopIdByPhoneNumberId: async (_pnid: string) => ('shopId' in over ? over.shopId : 'shop1'),
    },
    resolver: {
      resolve: async (from: string, shop: string, channel: string) => {
        resolved.push({ from, shop, channel });
        return over.resolution === null
          ? null
          : over.resolution ?? { customerAddress: '0xabc', conversationId: 'conv1', isGuest: true, phone: from };
      },
    },
    messageService: {
      sendMessage: async (req: any) => { sent.push(req); return { messageId: 'm1' }; },
    },
    consent: { grantOnInbound: async () => {}, isAllowedToSend: async () => true },
  };
  return d;
}

function build(d: any) {
  return new CustomerWhatsAppInboundService({
    messageService: d.messageService as any,
    resolver: d.resolver as any,
    numberService: d.numberService as any,
    consent: d.consent as any,
  });
}

describe('CustomerWhatsAppInboundService.handleInbound', () => {
  const ORIG = process.env.ENABLE_CUSTOMER_WHATSAPP;
  beforeEach(() => { process.env.ENABLE_CUSTOMER_WHATSAPP = 'true'; });
  afterEach(() => { process.env.ENABLE_CUSTOMER_WHATSAPP = ORIG; });

  it('routes an inbound WhatsApp message (channel=whatsapp, wa_id prefixed with +)', async () => {
    const d = deps();
    const outcome = await build(d).handleInbound('PNID_1', '15551112222', 'Do you fix screens?');
    expect(outcome).toBe('routed');
    expect(d.resolved[0]).toEqual({ from: '+15551112222', shop: 'shop1', channel: 'whatsapp' });
    expect(d.sent[0]).toMatchObject({
      conversationId: 'conv1',
      senderIdentifier: '0xabc',
      senderType: 'customer',
      messageText: 'Do you fix screens?',
      channel: 'whatsapp',
    });
  });

  it('is a no-op when ENABLE_CUSTOMER_WHATSAPP is off', async () => {
    process.env.ENABLE_CUSTOMER_WHATSAPP = 'false';
    const d = deps();
    expect(await build(d).handleInbound('PNID_1', '15551112222', 'hi')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('returns no_shop when the phone_number_id maps to no shop', async () => {
    const d = deps({ shopId: null });
    expect(await build(d).handleInbound('PNID_X', '15551112222', 'hi')).toBe('no_shop');
    expect(d.sent).toHaveLength(0);
  });

  it('returns unresolved for an empty body', async () => {
    const d = deps();
    expect(await build(d).handleInbound('PNID_1', '15551112222', '  ')).toBe('unresolved');
    expect(d.sent).toHaveLength(0);
  });

  it('returns unresolved when the sender cannot be resolved', async () => {
    const d = deps({ resolution: null });
    expect(await build(d).handleInbound('PNID_1', 'garbage', 'hi')).toBe('unresolved');
    expect(d.sent).toHaveLength(0);
  });
});

describe('WhatsAppNumberService.findShopIdByPhoneNumberId', () => {
  const ORIG_PNID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ORIG_SHOP = process.env.WHATSAPP_DEFAULT_SHOP_ID;
  afterEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = ORIG_PNID;
    process.env.WHATSAPP_DEFAULT_SHOP_ID = ORIG_SHOP;
  });

  it('maps the platform number id to the configured default shop', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'PNID_1';
    process.env.WHATSAPP_DEFAULT_SHOP_ID = 'shopA';
    expect(await new WhatsAppNumberService().findShopIdByPhoneNumberId('PNID_1')).toBe('shopA');
  });

  it('returns null for an unknown number id', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'PNID_1';
    process.env.WHATSAPP_DEFAULT_SHOP_ID = 'shopA';
    expect(await new WhatsAppNumberService().findShopIdByPhoneNumberId('PNID_OTHER')).toBeNull();
  });

  it('returns null when no default shop is configured', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'PNID_1';
    process.env.WHATSAPP_DEFAULT_SHOP_ID = '';
    expect(await new WhatsAppNumberService().findShopIdByPhoneNumberId('PNID_1')).toBeNull();
  });
});
