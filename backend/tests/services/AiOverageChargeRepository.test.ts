/**
 * AI Usage Overage (T3.2 Slice 2) — AiOverageChargeRepository accrual upsert + read. Mocks the pool
 * (overrides the BaseRepository shared pool) so no DB is touched.
 */
import { describe, it, expect } from '@jest/globals';
import { AiOverageChargeRepository } from '../../src/repositories/AiOverageChargeRepository';

function repoWithPool(queryImpl: any) {
  const repo = new AiOverageChargeRepository();
  (repo as any).pool = { query: queryImpl };
  return repo;
}

describe('AiOverageChargeRepository.accrue', () => {
  it('upserts overage-in-cents and the x3 multiplier into the current month', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await repoWithPool(query).accrue('peanut', 0.03); // $0.03 overage cost
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO ai_overage_charges');
    expect(String(sql)).toContain('ON CONFLICT (shop_id, period_month)');
    // cents = 0.03 * 100 = 3; default multiplier 3
    expect(params).toEqual(['peanut', 3, 3]);
  });

  it('no-ops for non-positive overage', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = repoWithPool(query);
    await repo.accrue('peanut', 0);
    await repo.accrue('peanut', -1);
    expect(query).not.toHaveBeenCalled();
  });

  it('reads the current-month accrual, mapping cents fields', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ overage_cost_cents: '4.5', amount_cents: '13.5', multiplier: '3.0', status: 'pending' }],
    });
    const got = await repoWithPool(query).getShopCurrentMonth('peanut');
    expect(got).toEqual({ overageCostCents: 4.5, amountCents: 13.5, multiplier: 3, status: 'pending' });
  });

  it('returns null when there is no accrual row yet', async () => {
    const got = await repoWithPool(jest.fn().mockResolvedValue({ rows: [] })).getShopCurrentMonth('peanut');
    expect(got).toBeNull();
  });
});
