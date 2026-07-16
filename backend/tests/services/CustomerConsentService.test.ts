/**
 * Phase 3 (D6) — CustomerConsentService: records opt-in on inbound (always) and enforces it before
 * sending only when ENFORCE_MESSAGING_CONSENT is on. Mocked repo, no DB.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerConsentService } from '../../src/domains/messaging/services/CustomerConsentService';

function svc(over: any = {}) {
  const grants: any[] = [];
  const repo = {
    grant: over.grant ?? (async (phone: string, channel: string, source: string) => { grants.push({ phone, channel, source }); }),
    hasConsent: over.hasConsent ?? (async () => false),
  } as any;
  return { s: new CustomerConsentService(repo), grants };
}

describe('CustomerConsentService', () => {
  const ORIG = process.env.ENFORCE_MESSAGING_CONSENT;
  afterEach(() => { process.env.ENFORCE_MESSAGING_CONSENT = ORIG; });

  describe('grantOnInbound', () => {
    it('records granted consent with source=inbound_message', async () => {
      const { s, grants } = svc();
      await s.grantOnInbound('+15551112222', 'sms');
      expect(grants).toEqual([{ phone: '+15551112222', channel: 'sms', source: 'inbound_message' }]);
    });
    it('never throws when the repo write fails', async () => {
      const { s } = svc({ grant: async () => { throw new Error('db down'); } });
      await expect(s.grantOnInbound('+1', 'whatsapp')).resolves.toBeUndefined();
    });
  });

  describe('isAllowedToSend', () => {
    it('returns true without touching the repo when enforcement is OFF', async () => {
      process.env.ENFORCE_MESSAGING_CONSENT = 'false';
      let touched = false;
      const { s } = svc({ hasConsent: async () => { touched = true; return false; } });
      expect(await s.isAllowedToSend('+1', 'sms')).toBe(true);
      expect(touched).toBe(false);
    });
    it('requires a granted row when enforcement is ON', async () => {
      process.env.ENFORCE_MESSAGING_CONSENT = 'true';
      expect(await svc({ hasConsent: async () => true }).s.isAllowedToSend('+1', 'sms')).toBe(true);
      expect(await svc({ hasConsent: async () => false }).s.isAllowedToSend('+1', 'sms')).toBe(false);
    });
    it('fails CLOSED (denies) on a lookup error while enforcing', async () => {
      process.env.ENFORCE_MESSAGING_CONSENT = 'true';
      const { s } = svc({ hasConsent: async () => { throw new Error('db down'); } });
      expect(await s.isAllowedToSend('+1', 'sms')).toBe(false);
    });
  });
});
