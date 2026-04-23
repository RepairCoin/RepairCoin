/**
 * NoShowPolicyService — tier cascade reset tests
 *
 * Verifies the earn-back flow:
 *   recordSuccessfulAppointment() increments the counter for any penalized
 *   tier (deposit_required, caution, warning), and checkTierReset() drops
 *   one tier when the counter crosses the threshold, cascading through
 *   deposit_required -> caution -> warning -> normal.
 *
 * File under test: backend/src/services/NoShowPolicyService.ts
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockQueryCalls: Array<{ text: string; params: any[] }> = [];
let nextUpdateRowCount = 0;
let nextReturningRows: Array<{ address: string; new_tier: string; previous_tier: string }> = [];
let mockQueryShouldReject: Error | null = null;

const stableMockQuery = jest.fn().mockImplementation(async (...args: any[]) => {
  const text: string = typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '';
  const params: any[] = args[1] ?? [];
  mockQueryCalls.push({ text, params });

  if (mockQueryShouldReject) {
    const err = mockQueryShouldReject;
    mockQueryShouldReject = null;
    throw err;
  }

  if (/UPDATE\s+customers/i.test(text) && /RETURNING/i.test(text)) {
    return { rows: nextReturningRows, rowCount: nextReturningRows.length };
  }
  if (/UPDATE\s+customers/i.test(text)) {
    return { rows: [], rowCount: nextUpdateRowCount };
  }
  return { rows: [], rowCount: 0 };
});

const stablePool = { query: stableMockQuery };

jest.mock('../../src/utils/database-pool', () => ({
  __esModule: true,
  getSharedPool: () => stablePool
}));

const mockCreateNotification = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../src/domains/notification/services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: mockCreateNotification
  }))
}));

// Import AFTER mocks so the service picks up the mocked pool & NotificationService
import { NoShowPolicyService } from '../../src/services/NoShowPolicyService';

describe('NoShowPolicyService — tier cascade reset', () => {
  let service: NoShowPolicyService;

  beforeEach(() => {
    mockQueryCalls.length = 0;
    nextUpdateRowCount = 0;
    nextReturningRows = [];
    mockQueryShouldReject = null;
    mockCreateNotification.mockReset();
    mockCreateNotification.mockResolvedValue({ id: 'notif-1' });
    service = new NoShowPolicyService();
  });

  describe('recordSuccessfulAppointment — counter increment SQL', () => {
    it('increments the counter for deposit_required, caution, or warning tiers', async () => {
      nextUpdateRowCount = 0; // prevent cascade from running in this test
      await service.recordSuccessfulAppointment('0xABC');

      const incrementCall = mockQueryCalls[0];
      const sql = incrementCall.text.replace(/\s+/g, ' ');
      expect(sql).toContain("no_show_tier IN ('deposit_required', 'caution', 'warning')");
      expect(sql).toContain('successful_appointments_since_tier3 = successful_appointments_since_tier3 + 1');
      expect(incrementCall.params[0]).toBe('0xabc');
    });

    it('does not run the cascade UPDATE when no row was incremented (normal/suspended)', async () => {
      nextUpdateRowCount = 0;
      await service.recordSuccessfulAppointment('0xABC');

      // Only the increment ran — no second UPDATE (the cascade one with RETURNING)
      const cascadeCalls = mockQueryCalls.filter(c => /RETURNING/i.test(c.text));
      expect(cascadeCalls).toHaveLength(0);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('runs the cascade UPDATE when the increment affected a row', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = []; // counter not yet at threshold
      await service.recordSuccessfulAppointment('0xABC');

      const cascadeCalls = mockQueryCalls.filter(c => /RETURNING/i.test(c.text));
      expect(cascadeCalls).toHaveLength(1);
    });
  });

  describe('checkTierReset — cascade SQL shape', () => {
    it('uses the shop policy threshold with a fallback of 3', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [];
      await service.recordSuccessfulAppointment('0xABC');

      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      expect(cascade).toBeDefined();
      const sql = cascade!.text.replace(/\s+/g, ' ');
      expect(sql).toContain('SELECT deposit_reset_after_successful FROM shop_no_show_policy LIMIT 1');
      expect(sql).toMatch(/COALESCE\(\s*\(SELECT deposit_reset_after_successful FROM shop_no_show_policy LIMIT 1\),\s*3\s*\)/);
    });

    it('filters to penalized tiers only (never touches normal or suspended)', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [];
      await service.recordSuccessfulAppointment('0xABC');

      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      const sql = cascade!.text.replace(/\s+/g, ' ');
      expect(sql).toContain("c.no_show_tier IN ('deposit_required', 'caution', 'warning')");
      expect(sql).not.toMatch(/c\.no_show_tier\s*=\s*'suspended'/);
    });

    it('maps each tier down exactly one step', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [];
      await service.recordSuccessfulAppointment('0xABC');

      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      const sql = cascade!.text.replace(/\s+/g, ' ');
      expect(sql).toContain("WHEN c.no_show_tier = 'deposit_required' THEN 'caution'");
      expect(sql).toContain("WHEN c.no_show_tier = 'caution' THEN 'warning'");
      expect(sql).toContain("WHEN c.no_show_tier = 'warning' THEN 'normal'");
    });

    it('clears deposit_required and resets the counter on a successful drop', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [];
      await service.recordSuccessfulAppointment('0xABC');

      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      const sql = cascade!.text.replace(/\s+/g, ' ');
      expect(sql).toContain('deposit_required = FALSE');
      expect(sql).toContain('successful_appointments_since_tier3 = 0');
    });

    it('wipes no_show_count and last_no_show_at only on the final warning -> normal step', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [];
      await service.recordSuccessfulAppointment('0xABC');

      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      const sql = cascade!.text.replace(/\s+/g, ' ');
      expect(sql).toContain("no_show_count = CASE WHEN c.no_show_tier = 'warning' THEN 0");
      expect(sql).toContain("last_no_show_at = CASE WHEN c.no_show_tier = 'warning' THEN NULL");
    });
  });

  describe('notifications on tier drop', () => {
    it('sends a tier_restored notification when the customer drops a tier', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [
        { address: '0xabc', new_tier: 'caution', previous_tier: 'deposit_required' }
      ];

      await service.recordSuccessfulAppointment('0xABC');

      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const call = mockCreateNotification.mock.calls[0][0] as any;
      expect(call.receiverAddress).toBe('0xabc');
      expect(call.notificationType).toBe('tier_restored');
      expect(call.metadata).toMatchObject({
        previousTier: 'deposit_required',
        newTier: 'caution',
        reason: 'successful_appointments'
      });
    });

    it('uses a "history cleared" message and flags fullReset when newTier is normal', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [
        { address: '0xabc', new_tier: 'normal', previous_tier: 'warning' }
      ];

      await service.recordSuccessfulAppointment('0xABC');

      const call = mockCreateNotification.mock.calls[0][0] as any;
      expect(call.message).toMatch(/history has been cleared|back to good standing/i);
      expect(call.metadata.fullReset).toBe(true);
    });

    it('does not flag fullReset for intermediate cascade steps', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [
        { address: '0xabc', new_tier: 'warning', previous_tier: 'caution' }
      ];

      await service.recordSuccessfulAppointment('0xABC');

      const call = mockCreateNotification.mock.calls[0][0] as any;
      expect(call.metadata.fullReset).toBe(false);
    });

    it('does not send a notification when no tier dropped', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = []; // counter incremented but threshold not crossed

      await service.recordSuccessfulAppointment('0xABC');

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('swallows notification failures without rolling back the DB update', async () => {
      nextUpdateRowCount = 1;
      nextReturningRows = [
        { address: '0xabc', new_tier: 'warning', previous_tier: 'caution' }
      ];
      mockCreateNotification.mockRejectedValueOnce(new Error('notify-down'));

      await expect(service.recordSuccessfulAppointment('0xABC')).resolves.toBeUndefined();

      // The cascade UPDATE still ran; the error was caught internally.
      const cascade = mockQueryCalls.find(c => /RETURNING/i.test(c.text));
      expect(cascade).toBeDefined();
    });
  });
});
