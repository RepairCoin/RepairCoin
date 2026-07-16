/**
 * Phase 1 Slice 2A (AI Auto-Replies SMS) — SmsCustomerResolver unit tests (mocked repos, no DB).
 * Covers: known-customer reuse (no channel flip), unknown-phone guest minting (channel='sms'),
 * deterministic guest address, phone normalization, identity linking, and invalid-phone drop.
 */
import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';
import { SmsCustomerResolver } from '../../src/domains/messaging/services/SmsCustomerResolver';

function deps(overrides: any = {}) {
  const calls: any = { setChannel: [], link: [], mintedGuest: [] };
  const d = {
    calls,
    customerRepo: {
      findAddressByPhone: async (_p: string) => null,
      getOrCreateSmsGuest: async (addr: string, _phone: string) => { calls.mintedGuest.push(addr); return addr; },
      ...overrides.customerRepo,
    },
    messageRepo: {
      getOrCreateConversation: async (addr: string, _shop: string) => ({ conversationId: `conv-${addr}`, channel: 'app' }),
      setConversationChannel: async (c: string, ch: string) => { calls.setChannel.push({ c, ch }); },
      ...overrides.messageRepo,
    },
    identityRepo: {
      findConversationId: async (_ch: string, _ext: string) => null,
      link: async (c: string, ch: string, ext: string) => { calls.link.push({ c, ch, ext }); },
      ...overrides.identityRepo,
    },
  };
  return d;
}

function build(d: any) {
  return new SmsCustomerResolver({
    customerRepo: d.customerRepo,
    messageRepo: d.messageRepo,
    identityRepo: d.identityRepo,
  });
}

describe('SmsCustomerResolver', () => {
  it('guestAddressForPhone is deterministic (0x + 40 hex of sha256)', () => {
    const phone = '+15551112222';
    const expected = '0x' + crypto.createHash('sha256').update(phone).digest('hex').slice(0, 40);
    expect(SmsCustomerResolver.guestAddressForPhone(phone)).toBe(expected);
    expect(SmsCustomerResolver.guestAddressForPhone(phone)).toHaveLength(42);
    expect(SmsCustomerResolver.guestAddressForPhone(phone)).toBe(expected); // stable
  });

  it('reuses a KNOWN customer thread and does NOT flip its channel', async () => {
    const d = deps({ customerRepo: { findAddressByPhone: async () => '0xknown' } });
    const res = await build(d).resolve('(555) 111-2222', 'shop1');
    expect(res).toMatchObject({ customerAddress: '0xknown', isGuest: false, phone: '+15551112222' });
    expect(res!.conversationId).toBe('conv-0xknown');
    expect(d.calls.setChannel).toHaveLength(0); // known customer's channel untouched
    expect(d.calls.mintedGuest).toHaveLength(0);
    expect(d.calls.link).toEqual([{ c: 'conv-0xknown', ch: 'sms', ext: '+15551112222' }]);
  });

  it('mints a guest for an UNKNOWN phone and marks the conversation sms', async () => {
    const d = deps(); // findAddressByPhone → null
    const res = await build(d).resolve('+1 555 111 2222', 'shop1');
    const guestAddr = SmsCustomerResolver.guestAddressForPhone('+15551112222');
    expect(res).toMatchObject({ customerAddress: guestAddr, isGuest: true });
    expect(d.calls.mintedGuest).toEqual([guestAddr]);
    expect(d.calls.setChannel).toEqual([{ c: `conv-${guestAddr}`, ch: 'sms' }]);
    expect(d.calls.link).toEqual([{ c: `conv-${guestAddr}`, ch: 'sms', ext: '+15551112222' }]);
  });

  it('does not re-flip channel when the guest conversation is already sms', async () => {
    const d = deps({
      messageRepo: { getOrCreateConversation: async (addr: string) => ({ conversationId: `conv-${addr}`, channel: 'sms' }) },
    });
    await build(d).resolve('+15551112222', 'shop1');
    expect(d.calls.setChannel).toHaveLength(0);
  });

  it('returns null for an unparseable phone (nothing linked or minted)', async () => {
    const d = deps();
    const res = await build(d).resolve('not-a-phone', 'shop1');
    expect(res).toBeNull();
    expect(d.calls.mintedGuest).toHaveLength(0);
    expect(d.calls.link).toHaveLength(0);
  });

  it('threads the whatsapp channel through the identity link + conversation channel', async () => {
    const d = deps(); // unknown phone → guest
    const res = await build(d).resolve('+15551112222', 'shop1', 'whatsapp');
    const guestAddr = SmsCustomerResolver.guestAddressForPhone('+15551112222');
    expect(res!.isGuest).toBe(true);
    expect(d.calls.setChannel).toEqual([{ c: `conv-${guestAddr}`, ch: 'whatsapp' }]);
    expect(d.calls.link).toEqual([{ c: `conv-${guestAddr}`, ch: 'whatsapp', ext: '+15551112222' }]);
  });
});
