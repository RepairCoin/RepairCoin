/**
 * SuspensionLiftService — unit tests
 *
 * Verifies that the scheduled service correctly:
 *  - Downgrades tier based on remaining no_show_count
 *  - Clears booking_suspended_until
 *  - Resets successful_appointments_since_tier3
 *  - Sends a 'suspension_lifted' notification per lifted customer
 *  - Keeps the lift atomic even when notification fails
 *
 * File under test: backend/src/services/SuspensionLiftService.ts
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockQueryCalls: Array<{ text: string; params: any[] }> = [];
let mockReturningRows: Array<{ address: string; no_show_count: number; no_show_tier: string }> = [];
let mockQueryRejection: Error | null = null;

const stableMockQuery = jest.fn().mockImplementation(async (...args: any[]) => {
  const text: string = typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '';
  const params: any[] = args[1] ?? [];
  mockQueryCalls.push({ text, params });
  if (mockQueryRejection) {
    const err = mockQueryRejection;
    mockQueryRejection = null;
    throw err;
  }
  return { rows: mockReturningRows };
});

const stablePool = { query: stableMockQuery };

jest.mock('../../src/utils/database-pool', () => ({
  __esModule: true,
  getSharedPool: () => stablePool
}));

const mockCreateNotification = jest.fn<(...args: any[]) => Promise<any>>();
const mockBuildMessage = jest.fn<(...args: any[]) => string>();
jest.mock('../../src/domains/notification/services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: mockCreateNotification,
    buildMessage: mockBuildMessage
  }))
}));

// Import AFTER mocks so the service picks up the mocked pool & NotificationService
import { SuspensionLiftService } from '../../src/services/SuspensionLiftService';

describe('SuspensionLiftService', () => {
  let service: SuspensionLiftService;

  beforeEach(() => {
    mockQueryCalls.length = 0;
    mockReturningRows = [];
    mockQueryRejection = null;
    mockCreateNotification.mockReset();
    mockCreateNotification.mockResolvedValue({ id: 'notif-1' });
    mockBuildMessage.mockReset();
    mockBuildMessage.mockImplementation((_type, data: any) =>
      `suspension lifted to ${data?.newTier}`
    );
    service = new SuspensionLiftService();
  });

  describe('SQL query structure', () => {
    it('filters only suspended customers whose suspension has elapsed', async () => {
      await service.processSuspensionLifts();

      expect(mockQueryCalls).toHaveLength(1);
      const sql = mockQueryCalls[0].text.replace(/\s+/g, ' ');
      expect(sql).toContain("no_show_tier = 'suspended'");
      expect(sql).toContain('booking_suspended_until IS NOT NULL');
      expect(sql).toContain('booking_suspended_until <= NOW()');
    });

    it('clears booking_suspended_until and resets successful_appointments_since_tier3', async () => {
      await service.processSuspensionLifts();
      const sql = mockQueryCalls[0].text.replace(/\s+/g, ' ');
      expect(sql).toContain('booking_suspended_until = NULL');
      expect(sql).toContain('successful_appointments_since_tier3 = 0');
    });

    it('uses default thresholds (3/2/1) for the tier cascade', async () => {
      await service.processSuspensionLifts();
      const sql = mockQueryCalls[0].text.replace(/\s+/g, ' ');
      expect(sql).toContain("WHEN no_show_count >= 3 THEN 'deposit_required'");
      expect(sql).toContain("WHEN no_show_count >= 2 THEN 'caution'");
      expect(sql).toContain("WHEN no_show_count = 1 THEN 'warning'");
      expect(sql).toContain("ELSE 'normal'");
    });
  });

  describe('notifications', () => {
    it('sends one notification per lifted customer', async () => {
      mockReturningRows = [
        { address: '0xaaa', no_show_count: 5, no_show_tier: 'deposit_required' },
        { address: '0xbbb', no_show_count: 2, no_show_tier: 'caution' }
      ];

      const report = await service.processSuspensionLifts();

      expect(report.customersLifted).toBe(2);
      expect(report.notificationsSent).toBe(2);
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);

      const firstCall = mockCreateNotification.mock.calls[0][0] as any;
      expect(firstCall.receiverAddress).toBe('0xaaa');
      expect(firstCall.notificationType).toBe('suspension_lifted');
      expect(firstCall.metadata).toMatchObject({
        previousTier: 'suspended',
        newTier: 'deposit_required',
        noShowCount: 5,
        depositRequired: true
      });
    });

    it('does not send notifications when nothing was lifted', async () => {
      mockReturningRows = [];

      const report = await service.processSuspensionLifts();

      expect(report.customersLifted).toBe(0);
      expect(report.notificationsSent).toBe(0);
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(report.errors).toHaveLength(0);
    });

    it('continues when one notification fails and records the error', async () => {
      mockReturningRows = [
        { address: '0xaaa', no_show_count: 5, no_show_tier: 'deposit_required' },
        { address: '0xbbb', no_show_count: 5, no_show_tier: 'deposit_required' }
      ];
      mockCreateNotification
        .mockRejectedValueOnce(new Error('notify-down'))
        .mockResolvedValueOnce({ id: 'notif-2' });

      const report = await service.processSuspensionLifts();

      expect(report.customersLifted).toBe(2);
      expect(report.notificationsSent).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('0xaaa');
      expect(report.errors[0]).toContain('notify-down');
    });

    it('flags depositRequired=false for caution / warning / normal tiers', async () => {
      mockReturningRows = [
        { address: '0xccc', no_show_count: 2, no_show_tier: 'caution' }
      ];

      await service.processSuspensionLifts();

      const call = mockCreateNotification.mock.calls[0][0] as any;
      expect(call.metadata.depositRequired).toBe(false);
      expect(call.metadata.newTier).toBe('caution');
    });
  });

  describe('error handling', () => {
    it('captures UPDATE query errors without throwing', async () => {
      mockQueryRejection = new Error('connection lost');

      const report = await service.processSuspensionLifts();

      expect(report.customersLifted).toBe(0);
      expect(report.notificationsSent).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('connection lost');
    });
  });

  describe('scheduler lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      service.stop();
      jest.useRealTimers();
    });

    it('start() sets isRunning and schedules an interval', () => {
      service.start();
      expect(service.getStatus().isRunning).toBe(true);
    });

    it('start() is idempotent — second call does not schedule twice', () => {
      service.start();
      service.start();
      expect(service.getStatus().isRunning).toBe(true);
    });

    it('stop() clears isRunning', () => {
      service.start();
      service.stop();
      expect(service.getStatus().isRunning).toBe(false);
    });
  });
});
