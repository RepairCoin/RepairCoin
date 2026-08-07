import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

jest.mock('../../src/utils/database-pool', () => {
  const query = jest.fn();
  return { getSharedPool: () => ({ query, connect: jest.fn() }) };
});

import { getSharedPool } from '../../src/utils/database-pool';
import { PaymentRepository } from '../../src/repositories/PaymentRepository';

const mockQuery = (getSharedPool() as any).query as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;

/**
 * Cash refunds are the one case where this side owns `payments.refunded_cents` outright — no
 * `charge.refunded` is ever coming to correct it. That makes the write the only thing standing
 * between a double-tapped refund and a drawer that pays out twice against one recorded refund.
 */
describe('PaymentRepository.applyOffStripeRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 'pay-1', metadata: {} }] });
  });

  const sqlOf = () => String(mockQuery.mock.calls[0][0]);

  it('increments in the statement rather than setting a value read beforehand', async () => {
    await new PaymentRepository().applyOffStripeRefund('pay-1', 500);

    expect(sqlOf()).toContain('refunded_cents = refunded_cents + $2');
    expect(sqlOf()).not.toMatch(/refunded_cents\s*=\s*\$2/);
  });

  it('refuses to overdraw, in the same statement that increments', async () => {
    await new PaymentRepository().applyOffStripeRefund('pay-1', 500);

    // Both in one UPDATE, so Postgres holds the row lock across the check and the write. Split
    // across a SELECT and an UPDATE the guard would pass for both racers.
    expect(sqlOf()).toContain('refunded_cents + $2 <= gross_cents');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('closes the payment out once the increment covers the gross', async () => {
    await new PaymentRepository().applyOffStripeRefund('pay-1', 500);

    expect(sqlOf()).toContain("WHEN refunded_cents + $2 >= gross_cents THEN 'refunded'");
    expect(sqlOf()).toContain("ELSE 'partially_refunded'");
  });

  it('returns null when it matched nothing, so the loser can be told', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await new PaymentRepository().applyOffStripeRefund('pay-1', 500);

    expect(result).toBeNull();
  });

  it('leaves markRefunded an absolute set, which is right for the webhook', async () => {
    // Stripe is authoritative for anything carrying a charge, so the reconciler states the total
    // rather than adding to it. The two must not be collapsed into one method.
    await new PaymentRepository().markRefunded('pay-1', 500, 'refunded');

    expect(sqlOf()).toContain('refunded_cents = $2');
    expect(sqlOf()).not.toContain('refunded_cents + $2');
  });
});
