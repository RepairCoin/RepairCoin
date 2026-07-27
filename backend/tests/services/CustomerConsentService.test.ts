/**
 * Phase 3 (D6) — CustomerConsentService: records opt-in on inbound (always) and enforces it before
 * sending only when ENFORCE_MESSAGING_CONSENT is on. Mocked repo, no DB.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerConsentService } from '../../src/domains/messaging/services/CustomerConsentService';

function svc(over: any = {}) {
  const grants: any[] = [];
  const revokes: any[] = [];
  const repo = {
    grant: over.grant ?? (async (phone: string, channel: string, source: string) => { grants.push({ phone, channel, source }); }),
    revoke: over.revoke ?? (async (phone: string, channel: string, source: string) => { revokes.push({ phone, channel, source }); }),
    hasConsent: over.hasConsent ?? (async () => false),
  } as any;
  return { s: new CustomerConsentService(repo), grants, revokes };
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

  // Explicit opt-in from the compliant settings toggle (Twilio toll-free). Unlike grantOnInbound,
  // the source names the surface and the write is NOT swallowed — the caller must know it failed.
  describe('grantExplicit / revoke / hasConsent', () => {
    it('grantExplicit records consent with the given source', async () => {
      const { s, grants } = svc();
      await s.grantExplicit('+15551112222', 'sms', 'notification_preferences');
      expect(grants).toEqual([{ phone: '+15551112222', channel: 'sms', source: 'notification_preferences' }]);
    });
    it('grantExplicit propagates repo failures (not best-effort)', async () => {
      const { s } = svc({ grant: async () => { throw new Error('db down'); } });
      await expect(s.grantExplicit('+1', 'sms', 'notification_preferences')).rejects.toThrow('db down');
    });
    it('revoke records a revocation with the given source', async () => {
      const { s, revokes } = svc();
      await s.revoke('+15551112222', 'sms', 'notification_preferences');
      expect(revokes).toEqual([{ phone: '+15551112222', channel: 'sms', source: 'notification_preferences' }]);
    });
    it('hasConsent delegates to the repo', async () => {
      expect(await svc({ hasConsent: async () => true }).s.hasConsent('+1', 'sms')).toBe(true);
      expect(await svc({ hasConsent: async () => false }).s.hasConsent('+1', 'sms')).toBe(false);
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
