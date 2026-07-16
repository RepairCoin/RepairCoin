/**
 * Phase 2 (AI Auto-Replies WhatsApp) — CustomerWhatsAppReplyService: relays an AI reply on a
 * channel='whatsapp' conversation back over WhatsApp. Verifies gating, recipient resolution, send,
 * and channel stamping. All deps mocked — no network.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerWhatsAppReplyService } from '../../src/domains/messaging/services/CustomerWhatsAppReplyService';

function deps(overrides: any = {}) {
  const sent: any[] = [];
  const stamped: any[] = [];
  const d = {
    sent,
    stamped,
    messageRepo: {
      getMessageById: async () => ({ messageText: 'Yes, we offer baking classes for $99.' }),
      setMessageChannel: async (id: string, ch: string) => { stamped.push({ id, ch }); },
      ...overrides.messageRepo,
    },
    identityRepo: {
      listForConversation: async () => [{ channel: 'whatsapp', externalId: '+15551112222' }],
      ...overrides.identityRepo,
    },
    whatsapp: {
      isEnabled: () => true,
      sendText: async (to: string, body: string) => { sent.push({ to, body }); return { status: 'sent' }; },
      ...overrides.whatsapp,
    },
  };
  return d;
}

function build(d: any) {
  return new CustomerWhatsAppReplyService({
    messageRepo: d.messageRepo,
    identityRepo: d.identityRepo,
    whatsapp: d.whatsapp,
  });
}

describe('CustomerWhatsAppReplyService.relay', () => {
  const ORIG = process.env.ENABLE_CUSTOMER_WHATSAPP;
  beforeEach(() => { process.env.ENABLE_CUSTOMER_WHATSAPP = 'true'; });
  afterEach(() => { process.env.ENABLE_CUSTOMER_WHATSAPP = ORIG; });

  it('sends the AI reply over WhatsApp and stamps the message channel', async () => {
    const d = deps();
    const outcome = await build(d).relay('conv1', 'shop1', 'msg1');
    expect(outcome).toBe('sent');
    expect(d.sent).toEqual([{ to: '+15551112222', body: 'Yes, we offer baking classes for $99.' }]);
    expect(d.stamped).toEqual([{ id: 'msg1', ch: 'whatsapp' }]);
  });

  it('is a no-op when ENABLE_CUSTOMER_WHATSAPP is off', async () => {
    process.env.ENABLE_CUSTOMER_WHATSAPP = 'false';
    const d = deps();
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('is a no-op when WhatsApp is not configured', async () => {
    const d = deps({ whatsapp: { isEnabled: () => false } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('returns no_recipient when the conversation has no WhatsApp identity', async () => {
    const d = deps({ identityRepo: { listForConversation: async () => [{ channel: 'sms', externalId: '+1999' }] } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('no_recipient');
    expect(d.sent).toHaveLength(0);
  });

  it('does not stamp the channel when WhatsApp send fails', async () => {
    const d = deps({ whatsapp: { isEnabled: () => true, sendText: async () => ({ status: 'failed' }) } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('failed');
    expect(d.stamped).toHaveLength(0);
  });
});
