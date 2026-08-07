import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

jest.mock('../../src/utils/database-pool', () => {
  const query = jest.fn();
  return { getSharedPool: () => ({ query, connect: jest.fn() }) };
});

import { getSharedPool } from '../../src/utils/database-pool';
import { PosSaleRepository } from '../../src/repositories/PosSaleRepository';

const mockQuery = (getSharedPool() as any).query as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;

/**
 * Paging and lookup over sales history. The list and its total are two queries, and the only way
 * "showing 25 of 900" can be a lie is if they stop agreeing on what is being counted — so that is
 * mostly what these assert.
 */
describe('PosSaleRepository.listSales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockImplementation(async (sql: any) =>
      String(sql).includes('COUNT(*)::int AS total')
        ? { rows: [{ total: 900 }] }
        : { rows: [{ id: 'sale-1', item_count: 3 }] }
    );
  });

  // The page query is the one that is not the count.
  const pageCall = () => mockQuery.mock.calls.find((c) => !String(c[0]).includes('AS total'))!;
  const countCall = () => mockQuery.mock.calls.find((c) => String(c[0]).includes('AS total'))!;
  // The LAST WHERE before any ORDER BY — the page query's item-count subquery has one of its own.
  const whereOf = (call: any[]) => {
    const parts = String(call[0]).split('ORDER BY')[0].split('WHERE');
    return parts[parts.length - 1].trim();
  };

  it('counts exactly what it lists, or the total means nothing', async () => {
    await new PosSaleRepository().listSales('shop-1', {
      status: 'completed',
      locationId: 'loc-1',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-08T00:00:00.000Z',
    });

    expect(whereOf(countCall())).toBe(whereOf(pageCall()));
    // Bound to the same values too — an identical WHERE over different parameters is the same bug.
    // The page carries LIMIT and OFFSET beyond the filters; the count has only the filters.
    expect(countCall()[1]).toEqual((pageCall()[1] as any[]).slice(0, -2));
  });

  it('reports the total behind the page, not the page size', async () => {
    const result = await new PosSaleRepository().listSales('shop-1');

    expect(result.total).toBe(900);
    expect(result.sales).toHaveLength(1);
  });

  it('looks a sale number up exactly, since it comes off a receipt', async () => {
    await new PosSaleRepository().listSales('shop-1', { saleNumber: 42 });

    expect(whereOf(pageCall())).toContain('s.sale_number =');
    expect(pageCall()[1]).toContain(42);
  });

  it('bounds a date range half-open, so a whole day is one clean range', async () => {
    await new PosSaleRepository().listSales('shop-1', {
      from: '2026-08-06T00:00:00.000Z',
      to: '2026-08-07T00:00:00.000Z',
    });

    const where = whereOf(pageCall());
    expect(where).toContain('s.created_at >=');
    expect(where).toContain('s.created_at <');
    expect(where).not.toContain('s.created_at <=');
  });

  it('caps the page size however large a limit is asked for', async () => {
    await new PosSaleRepository().listSales('shop-1', { limit: 5000 });

    // LIMIT and OFFSET are the last two parameters of the page query.
    expect(pageCall()[1].slice(-2)).toEqual([200, 0]);
  });

  it('refuses a negative offset rather than letting Postgres reject it', async () => {
    await new PosSaleRepository().listSales('shop-1', { offset: -10 });

    expect(pageCall()[1].slice(-1)).toEqual([0]);
  });

  it('does not filter on absent criteria', async () => {
    await new PosSaleRepository().listSales('shop-1');

    expect(whereOf(pageCall())).toBe('s.shop_id = $1');
  });
});

/**
 * Refunded totals are claimed in the statement, never read-then-written. Two refunds issued at the
 * same moment would otherwise both read the figure as it was before either of them, and the second
 * write would erase the first — the shop pays out twice and the record shows one.
 */
describe('refund totals are incremented, not set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 'x' }] });
  });

  const sqlOf = () => String(mockQuery.mock.calls[0][0]);

  it('adds to the tender rather than overwriting it', async () => {
    await new PosSaleRepository().applyTenderRefund('tender-1', 500);

    expect(sqlOf()).toContain('refunded_cents = LEAST(refunded_cents + $2, amount_cents)');
    // The bug shape this replaced: an absolute value computed by the caller beforehand.
    expect(sqlOf()).not.toMatch(/refunded_cents\s*=\s*LEAST\(\$2/);
  });

  it('closes the tender once the increment covers it', async () => {
    await new PosSaleRepository().applyTenderRefund('tender-1', 500);

    expect(sqlOf()).toContain("WHEN refunded_cents + $2 >= amount_cents THEN 'refunded'");
  });
});

/**
 * A void throws away a cart. Run against a sale that has taken money it produces two different
 * unrecoverable states — cash never reaches the ledger, a card leg reaches it and then belongs to a
 * sale marked voided — so the statement itself has to refuse.
 */
describe('PosSaleRepository.voidSale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 'sale-1', status: 'voided' }] });
  });

  const sqlOf = () => String(mockQuery.mock.calls[0][0]);

  it('refuses a sale carrying a settled tender', async () => {
    await new PosSaleRepository().voidSale('sale-1', 'shop-1');

    const guard = sqlOf().split('NOT EXISTS')[1];
    expect(guard).toContain('pos_sale_payments');
    expect(guard).toContain("'succeeded'");
  });

  it('refuses one still in flight, so no PaymentIntent is orphaned', async () => {
    await new PosSaleRepository().voidSale('sale-1', 'shop-1');

    const guard = sqlOf().split('NOT EXISTS')[1];
    expect(guard).toContain("'pending'");
    expect(guard).toContain("'processing'");
  });

  it('still only touches an open sale belonging to this shop', async () => {
    await new PosSaleRepository().voidSale('sale-1', 'shop-1');

    expect(sqlOf()).toContain("status = 'open'");
    expect(sqlOf()).toContain('shop_id = $2');
  });

  it('guards in the statement rather than a read-then-write', async () => {
    await new PosSaleRepository().voidSale('sale-1', 'shop-1');

    // One statement, so a tender settling mid-check cannot slip between a SELECT and an UPDATE.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(sqlOf()).toContain('UPDATE pos_sales');
  });
});
