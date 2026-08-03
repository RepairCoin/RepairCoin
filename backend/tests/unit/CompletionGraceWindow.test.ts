/**
 * Completion grace window — Phase 1 of replacing auto-expiry-with-refund.
 *
 * These pin the behaviour change that matters: the sweep no longer moves money, and
 * a shop is no longer blocked from completing a booking late. The old code refunded
 * any booking still 'paid' 24h after its appointment, which auto-refunded 152 real,
 * approved-and-paid bookings purely because nobody pressed "Complete".
 *
 * The refund path itself is deliberately still present (as refundOrder) — Phase 2
 * reaches it from an explicit customer report. What must never come back is a refund
 * fired by shop inactivity alone.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Keep construction cheap and offline — the service builds these in its constructor.
jest.mock('../../src/services/EmailService', () => ({ EmailService: class {} }));
jest.mock('../../src/domains/notification/services/NotificationService', () => ({
  NotificationService: class { createNotification = jest.fn(); },
}));
jest.mock('../../src/repositories/ServiceRepository', () => ({ ServiceRepository: class {} }));

const mockRecordTransaction = jest.fn();
jest.mock('../../src/repositories/TransactionRepository', () => ({
  TransactionRepository: class { recordTransaction = mockRecordTransaction; },
}));

const mockMarkAsExpired = jest.fn();
const mockMarkAwaitingConfirmation = jest.fn<(...a: any[]) => Promise<any>>();
jest.mock('../../src/repositories/OrderRepository', () => ({
  OrderRepository: class {
    markAsExpired = mockMarkAsExpired;
    markAwaitingConfirmation = mockMarkAwaitingConfirmation;
  },
}));

const mockDispatch = jest.fn<(...a: any[]) => Promise<any>>();
jest.mock('../../src/domains/notification/services/NotificationGateway', () => ({
  getNotificationGateway: () => ({ dispatch: mockDispatch }),
}));

const mockRefundPayment = jest.fn();
jest.mock('../../src/services/StripeService', () => ({
  getStripeService: () => ({ refundPayment: mockRefundPayment, getStripe: () => ({}) }),
}));

const mockRefundRcn = jest.fn();
jest.mock('../../src/repositories', () => ({
  customerRepository: { refundRcnAfterCancellation: mockRefundRcn },
  shopRepository: {},
}));

const mockPoolQuery = jest.fn<(...a: any[]) => Promise<any>>();
jest.mock('../../src/utils/database-pool', () => ({ getSharedPool: () => ({ query: mockPoolQuery }) }));

import { ExpiredOrderService } from '../../src/services/ExpiredOrderService';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A booking `daysAgo` in the past, at 09:00. */
const bookingDaysAgo = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY_MS);

const eligibleOrder = (over: Record<string, any> = {}) =>
  ({
    orderId: 'ord_test',
    customerAddress: '0xabc',
    shopId: 'zwiftech',
    shopName: 'Zwiftech',
    serviceId: 'svc_1',
    serviceName: 'test service',
    bookingDate: bookingDaysAgo(8),
    bookingTimeSlot: '09:00:00',
    totalAmount: 50,
    finalAmountUsd: 50,
    rcnRedeemed: 10,
    stripePaymentIntentId: 'pi_test',
    ...over,
  }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkAwaitingConfirmation.mockResolvedValue({ orderId: 'ord_test', status: 'awaiting_confirmation' });
  mockDispatch.mockResolvedValue(null);
  mockPoolQuery.mockResolvedValue({ rows: [] });
});

describe('grace window boundary', () => {
  const svc = () => new ExpiredOrderService();

  it('has NOT elapsed one day after the appointment (the old 24h cutoff)', () => {
    expect(svc().isPastGraceWindow(bookingDaysAgo(1), '09:00:00')).toBe(false);
  });

  it('has NOT elapsed at day 6 — still inside the 7-day window', () => {
    expect(svc().isPastGraceWindow(bookingDaysAgo(6), '09:00:00')).toBe(false);
  });

  it('HAS elapsed at day 8', () => {
    expect(svc().isPastGraceWindow(bookingDaysAgo(8), '09:00:00')).toBe(true);
  });
});

describe('a booking past its grace window', () => {
  it('moves no money and does not expire the order', async () => {
    const result = await new ExpiredOrderService().processExpiredOrder(eligibleOrder());

    // The whole point: shop inactivity alone must never refund a customer.
    expect(mockRefundRcn).not.toHaveBeenCalled();
    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(mockMarkAsExpired).not.toHaveBeenCalled();
    expect(mockRecordTransaction).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.rcnRefunded).toBe(0);
    expect(result.stripeRefunded).toBe(0);
  });

  it('parks it awaiting confirmation and asks the customer', async () => {
    await new ExpiredOrderService().processExpiredOrder(eligibleOrder());

    expect(mockMarkAwaitingConfirmation).toHaveBeenCalledWith('ord_test');

    const [type, receiver] = mockDispatch.mock.calls[0] as any[];
    expect(type).toBe('booking_awaiting_confirmation');
    expect(receiver).toBe('0xabc');
  });

  it('does nothing when the shop completed it between the sweep and the update', async () => {
    // markAwaitingConfirmation is guarded on status='paid'; a null return means the
    // race was lost, which is a no-op rather than an error.
    mockMarkAwaitingConfirmation.mockResolvedValue(null);

    const result = await new ExpiredOrderService().processExpiredOrder(eligibleOrder());

    expect(result.success).toBe(true);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it('still succeeds when the notification fails', async () => {
    mockDispatch.mockRejectedValue(new Error('push down'));

    const result = await new ExpiredOrderService().processExpiredOrder(eligibleOrder());

    // The status change already committed; a notification failure must not make the
    // caller think the sweep failed and retry it.
    expect(result.success).toBe(true);
    expect(mockMarkAwaitingConfirmation).toHaveBeenCalled();
  });

  it('leaves it completable — even long after the appointment', () => {
    const svc = new ExpiredOrderService();
    const longAgo = { bookingDate: bookingDaysAgo(45), bookingTime: '09:00:00' } as any;

    // Previously this returned canComplete:false and told the shop to contact support,
    // so a shop that noticed late could not fix its own booking.
    expect(svc.canCompleteOrder(longAgo).canComplete).toBe(true);
  });
});

describe('shop completion nudges', () => {
  const NUDGE_COLUMNS = [
    'completion_nudge_1_sent_at',
    'completion_nudge_2_sent_at',
    'completion_nudge_3_sent_at',
  ];

  /**
   * Regression: a booking already past +6d matches ALL THREE nudge stages at once —
   * true of anything in flight when this first deploys, or after sweep downtime.
   * Firing each stage independently sent the shop three notifications in one pass for
   * a single booking. Stages now run latest-first and stamp every earlier stage.
   */
  /**
   * Fake that honours the thing actually doing the work: each stage's SELECT filters on
   * `<column> IS NULL`, so once a column is stamped that stage stops matching. A mock
   * that ignores this can't tell the bug from the fix.
   *
   * Models one booking old enough to satisfy every stage's time threshold.
   */
  const stageAwareFake = () => {
    const stamped = new Set<string>();
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (/^\s*SELECT/i.test(sql)) {
        const column = NUDGE_COLUMNS.find((c) => sql.includes(`so.${c} IS NULL`));
        if (!column || stamped.has(column)) return { rows: [] };
        return {
          rows: [{ orderId: 'ord_old', shopId: 's1', shopWallet: '0xshop', serviceName: 'Full Groom', customerName: 'Qua Ting' }],
        };
      }
      NUDGE_COLUMNS.filter((c) => sql.includes(c)).forEach((c) => stamped.add(c));
      return { rows: [] };
    });
    return stamped;
  };

  it('sends ONE notification for a booking that matches every stage', async () => {
    stageAwareFake();

    const sent = await new ExpiredOrderService().sendCompletionNudges();

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(sent).toBe(1);
  });

  it('fires the most urgent stage and stamps the earlier ones', async () => {
    const stamped = stageAwareFake();

    await new ExpiredOrderService().sendCompletionNudges();

    // +144h runs first; its UPDATE stamps all three, which is what stops the earlier
    // stages re-notifying the same booking in the same pass.
    const updates = mockPoolQuery.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => /^\s*UPDATE/i.test(sql));

    expect(updates.length).toBe(1);
    for (const column of NUDGE_COLUMNS) {
      expect(updates[0]).toContain(column);
      expect(stamped.has(column)).toBe(true);
    }
  });

  it('does not stamp a stage whose notification failed', async () => {
    mockPoolQuery.mockImplementation(async (sql: string) =>
      /^\s*SELECT/i.test(sql) ? { rows: [{ orderId: 'ord_old', shopWallet: '0xshop', serviceName: 'X' }] } : { rows: [] }
    );
    mockDispatch.mockRejectedValue(new Error('push down'));

    const sent = await new ExpiredOrderService().sendCompletionNudges();

    expect(sent).toBe(0);
    const updates = mockPoolQuery.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => /^\s*UPDATE/i.test(sql));
    expect(updates.length).toBe(0); // retries next pass rather than silently skipping
  });

  it('skips a row with no shop wallet to notify', async () => {
    mockPoolQuery.mockImplementation(async (sql: string) =>
      /^\s*SELECT/i.test(sql) ? { rows: [{ orderId: 'ord_x', shopWallet: null, serviceName: 'X' }] } : { rows: [] }
    );

    const sent = await new ExpiredOrderService().sendCompletionNudges();

    expect(sent).toBe(0);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('report window on a completed booking', () => {
  const svc = () => new ExpiredOrderService();

  it('is open at day 13', () => {
    expect(svc().isWithinReportWindow(new Date(Date.now() - 13 * DAY_MS))).toBe(true);
  });

  it('is closed at day 15', () => {
    expect(svc().isWithinReportWindow(new Date(Date.now() - 15 * DAY_MS))).toBe(false);
  });

  it('honours a shop-specific window', () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * DAY_MS);
    expect(svc().isWithinReportWindow(twentyDaysAgo, 30)).toBe(true);
    expect(svc().isWithinReportWindow(twentyDaysAgo, 7)).toBe(false);
  });
});

describe('refundOrder (reachable only from an explicit customer report)', () => {
  it('still refunds RCN and Stripe when deliberately invoked', async () => {
    mockRefundRcn.mockResolvedValue(undefined as never);
    mockRefundPayment.mockResolvedValue(undefined as never);
    mockRecordTransaction.mockResolvedValue(undefined as never);

    const result = await new ExpiredOrderService().refundOrder(
      eligibleOrder(),
      'customer reported service did not happen'
    );

    expect(mockRefundRcn).toHaveBeenCalledWith('0xabc', 10);
    expect(mockRefundPayment).toHaveBeenCalled();
    expect(result.rcnRefunded).toBe(10);
    expect(result.stripeRefunded).toBe(50);
    expect(result.success).toBe(true);
  });

  it('does not set the order status itself — the caller owns that', async () => {
    mockRefundRcn.mockResolvedValue(undefined as never);
    mockRefundPayment.mockResolvedValue(undefined as never);
    mockRecordTransaction.mockResolvedValue(undefined as never);

    await new ExpiredOrderService().refundOrder(eligibleOrder(), 'reported');

    expect(mockMarkAsExpired).not.toHaveBeenCalled();
  });
});
