/**
 * Phase 1 (AI Auto-Replies SMS) — SmsNumberService: the single seam where the D2 "per-shop
 * number" decision plugs in. Verifies outbound FROM resolution (own number → shared fallback →
 * none) and To→shop inbound routing with E.164 normalization.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SmsNumberService } from '../../src/services/SmsNumberService';

function fakeRepo(overrides: Partial<Record<string, any>> = {}) {
  return {
    getActiveForShop: async (_shopId: string) => null,
    findShopIdByNumber: async (_num: string) => null,
    assign: async () => ({}),
    ...overrides,
  } as any;
}

describe('SmsNumberService', () => {
  const ORIGINAL = process.env.TWILIO_SMS_FROM;

  beforeEach(() => {
    process.env.TWILIO_SMS_FROM = '+15550000000';
  });
  afterEach(() => {
    process.env.TWILIO_SMS_FROM = ORIGINAL;
  });

  describe('resolveOutboundFrom', () => {
    it('prefers the shop\'s own active number', async () => {
      const svc = new SmsNumberService(
        fakeRepo({ getActiveForShop: async () => ({ smsNumber: '+15551112222' }) })
      );
      expect(await svc.resolveOutboundFrom('shop1')).toBe('+15551112222');
    });

    it('falls back to the shared TWILIO_SMS_FROM when the shop has no number', async () => {
      const svc = new SmsNumberService(fakeRepo());
      expect(await svc.resolveOutboundFrom('shop1')).toBe('+15550000000');
    });

    it('returns null when there is neither a shop number nor a shared number', async () => {
      process.env.TWILIO_SMS_FROM = '';
      const svc = new SmsNumberService(fakeRepo());
      expect(await svc.resolveOutboundFrom('shop1')).toBeNull();
    });

    it('falls back to the shared number if the lookup throws', async () => {
      const svc = new SmsNumberService(
        fakeRepo({ getActiveForShop: async () => { throw new Error('db down'); } })
      );
      expect(await svc.resolveOutboundFrom('shop1')).toBe('+15550000000');
    });
  });

  describe('findShopIdByInboundNumber', () => {
    it('normalizes to E.164 before lookup and returns the shop', async () => {
      let queried = '';
      const svc = new SmsNumberService(
        fakeRepo({
          findShopIdByNumber: async (num: string) => { queried = num; return 'shopA'; },
        })
      );
      const shopId = await svc.findShopIdByInboundNumber('(555) 111-2222');
      expect(queried).toBe('+15551112222'); // normalized
      expect(shopId).toBe('shopA');
    });

    it('returns null for an unparseable number without querying', async () => {
      let called = false;
      const svc = new SmsNumberService(
        fakeRepo({ findShopIdByNumber: async () => { called = true; return 'x'; } })
      );
      expect(await svc.findShopIdByInboundNumber('not-a-phone')).toBeNull();
      expect(called).toBe(false);
    });

    it('returns null when no shop owns the number', async () => {
      const svc = new SmsNumberService(fakeRepo({ findShopIdByNumber: async () => null }));
      expect(await svc.findShopIdByInboundNumber('+15559998888')).toBeNull();
    });
  });
});
