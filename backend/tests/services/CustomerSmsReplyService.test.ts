/**
 * Phase 1 (AI Auto-Replies SMS) — CustomerSmsReplyService: relays an AI reply on a channel='sms'
 * conversation back out over SMS. Verifies gating (flag + Twilio master), opt-out suppression,
 * recipient/from resolution, and channel stamping. All deps mocked — no DB / no network.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerSmsReplyService } from '../../src/domains/messaging/services/CustomerSmsReplyService';

function deps(overrides: any = {}) {
  const sent: any[] = [];
  const stamped: any[] = [];
  const d = {
    sent,
    stamped,
    messageRepo: {
      getMessageById: async (_id: string) => ({ messageText: 'Your repair is ready!' }),
      setMessageChannel: async (id: string, ch: string) => { stamped.push({ id, ch }); },
      ...overrides.messageRepo,
    },
    identityRepo: {
      listForConversation: async (_c: string) => [{ channel: 'sms', externalId: '+15551112222' }],
      ...overrides.identityRepo,
    },
    optOutRepo: {
      isOptedOut: async (_p: string) => false,
      ...overrides.optOutRepo,
    },
    numberService: {
      resolveOutboundFrom: async (_s: string) => '+15550000000',
      ...overrides.numberService,
    },
    twilio: {
      enabled: () => true,
      sendSms: async (to: string, body: string, _cb: any, from: string) => {
        sent.push({ to, body, from });
        return { status: 'sent', sid: 'SM123' };
      },
      ...overrides.twilio,
    },
    consent: {
      isAllowedToSend: async () => true,
      grantOnInbound: async () => {},
      ...overrides.consent,
    },
  };
  return d;
}

function build(d: any) {
  return new CustomerSmsReplyService({
    messageRepo: d.messageRepo,
    identityRepo: d.identityRepo,
    optOutRepo: d.optOutRepo,
    numberService: d.numberService,
    twilio: d.twilio,
    consent: d.consent,
  });
}

describe('CustomerSmsReplyService.relay', () => {
  const ORIG = process.env.ENABLE_CUSTOMER_SMS;
  beforeEach(() => { process.env.ENABLE_CUSTOMER_SMS = 'true'; });
  afterEach(() => { process.env.ENABLE_CUSTOMER_SMS = ORIG; });

  it('sends the AI reply over SMS, from the resolved number, and stamps the message channel', async () => {
    const d = deps();
    const outcome = await build(d).relay('conv1', 'shop1', 'msg1');
    expect(outcome).toBe('sent');
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0]).toMatchObject({ to: '+15551112222', from: '+15550000000', body: 'Your repair is ready!' });
    expect(d.stamped).toEqual([{ id: 'msg1', ch: 'sms' }]);
  });

  it('is a no-op when ENABLE_CUSTOMER_SMS is off', async () => {
    process.env.ENABLE_CUSTOMER_SMS = 'false';
    const d = deps();
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('is a no-op when the Twilio master gate is off', async () => {
    const d = deps({ twilio: { enabled: () => false } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('disabled');
    expect(d.sent).toHaveLength(0);
  });

  it('suppresses the send when the recipient is on the global opt-out list', async () => {
    const d = deps({ optOutRepo: { isOptedOut: async () => true } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('opted_out');
    expect(d.sent).toHaveLength(0);
  });

  it('suppresses the send when consent enforcement denies the recipient', async () => {
    const d = deps({ consent: { isAllowedToSend: async () => false } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('no_consent');
    expect(d.sent).toHaveLength(0);
  });

  it('returns no_recipient when the conversation has no SMS identity', async () => {
    const d = deps({ identityRepo: { listForConversation: async () => [] } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('no_recipient');
    expect(d.sent).toHaveLength(0);
  });

  it('returns no_recipient when the message body is empty', async () => {
    const d = deps({ messageRepo: { getMessageById: async () => ({ messageText: '   ' }) } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('no_recipient');
  });

  it('returns no_from_number when no shop or shared number resolves', async () => {
    const d = deps({ numberService: { resolveOutboundFrom: async () => null } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('no_from_number');
    expect(d.sent).toHaveLength(0);
  });

  it('does not stamp the channel when Twilio reports failure', async () => {
    const d = deps({ twilio: { enabled: () => true, sendSms: async () => ({ status: 'failed', error: 'x' }) } });
    expect(await build(d).relay('conv1', 'shop1', 'msg1')).toBe('failed');
    expect(d.stamped).toHaveLength(0);
  });
});
