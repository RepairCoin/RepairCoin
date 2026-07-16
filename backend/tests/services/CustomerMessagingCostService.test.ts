/**
 * Phase 3 (D5) — CustomerMessagingCostService: carrier-cost estimate + ledger recording for off-app
 * AI replies. Mocked repo, no DB.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CustomerMessagingCostService } from '../../src/domains/messaging/services/CustomerMessagingCostService';

function svc(overrides: any = {}) {
  const recorded: any[] = [];
  const repo = {
    record: overrides.record ?? (async (row: any) => { recorded.push(row); }),
  } as any;
  return { s: new CustomerMessagingCostService(repo), recorded };
}

describe('CustomerMessagingCostService', () => {
  const ENV = { ...process.env };
  beforeEach(() => { delete process.env.SMS_CARRIER_COST_CENTS; delete process.env.WHATSAPP_CARRIER_COST_CENTS; });
  afterEach(() => { process.env = { ...ENV }; });

  describe('estimateCarrierCents', () => {
    it('defaults SMS to 0.79¢ and WhatsApp to 0', () => {
      const { s } = svc();
      expect(s.estimateCarrierCents('sms')).toBe(0.79);
      expect(s.estimateCarrierCents('whatsapp')).toBe(0);
    });
    it('honors env overrides', () => {
      process.env.SMS_CARRIER_COST_CENTS = '1.2';
      process.env.WHATSAPP_CARRIER_COST_CENTS = '0.5';
      const { s } = svc();
      expect(s.estimateCarrierCents('sms')).toBe(1.2);
      expect(s.estimateCarrierCents('whatsapp')).toBe(0.5);
    });
    it('falls back to 0 on a non-numeric override', () => {
      process.env.SMS_CARRIER_COST_CENTS = 'abc';
      expect(svc().s.estimateCarrierCents('sms')).toBe(0);
    });
  });

  describe('recordReply', () => {
    it('records AI cost (usd→cents) + carrier cost when sent', async () => {
      const { s, recorded } = svc();
      await s.recordReply({ shopId: 'shop1', conversationId: 'c1', customerAddress: '0xabc', channel: 'sms', aiCostUsd: 0.0012, sent: true });
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({ shopId: 'shop1', channel: 'sms', carrierCostCents: 0.79 });
      expect(recorded[0].aiCostCents).toBeCloseTo(0.12, 6);
    });

    it('charges no carrier cost when the message did not send', async () => {
      const { s, recorded } = svc();
      await s.recordReply({ shopId: 'shop1', channel: 'sms', aiCostUsd: 0.002, sent: false });
      expect(recorded[0].carrierCostCents).toBe(0);
      expect(recorded[0].aiCostCents).toBeCloseTo(0.2, 6);
    });

    it('never throws when the repo write fails', async () => {
      const { s } = svc({ record: async () => { throw new Error('db down'); } });
      await expect(
        s.recordReply({ shopId: 'shop1', channel: 'whatsapp', aiCostUsd: 0.001, sent: true })
      ).resolves.toBeUndefined();
    });
  });
});
