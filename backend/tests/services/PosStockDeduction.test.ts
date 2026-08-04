import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

// One shared client mock for the transaction adjustStock opens, routed by SQL.
jest.mock('../../src/utils/database-pool', () => {
  const clientQuery = jest.fn();
  const client = { query: clientQuery, release: jest.fn() };
  return {
    getSharedPool: () => ({ query: jest.fn(), connect: async () => client }),
    __client: client,
  };
});

import { getSharedPool } from '../../src/utils/database-pool';
import { InventoryRepository } from '../../src/repositories/InventoryRepository';

const client = (jest.requireMock('../../src/utils/database-pool') as any).__client;
const clientQuery = client.query as jest.MockedFunction<(...args: any[]) => Promise<any>>;

const LOCATION = '11111111-1111-1111-1111-111111111111';

/**
 * Routes each statement adjustStock issues, so a test only has to say what stock exists.
 * Returns the arguments the interesting writes were called with.
 */
function stubDb({ branchStock, itemStock }: { branchStock: number; itemStock: number }) {
  const calls: Record<string, any[]> = {};

  clientQuery.mockImplementation(async (sql: any, params?: any) => {
    const text = String(sql);

    if (/^\s*(BEGIN|COMMIT|ROLLBACK)/.test(text)) return { rows: [] };

    if (text.includes('FROM inventory_items') && text.includes('FOR UPDATE')) {
      return { rows: [{ stock_quantity: itemStock }] };
    }
    if (text.includes('INSERT INTO inventory_item_stock')) return { rows: [] };
    if (text.includes('FROM inventory_item_stock') && text.includes('FOR UPDATE')) {
      return { rows: [{ stock_quantity: branchStock }] };
    }
    if (text.includes('UPDATE inventory_item_stock')) {
      calls.branchWrite = params;
      return { rows: [] };
    }
    if (text.includes('UPDATE inventory_items')) {
      calls.totalWrite = params;
      return { rows: [] };
    }
    if (text.includes('INSERT INTO inventory_adjustments')) {
      calls.adjustment = params;
      return { rows: [{ id: 'adj-1', quantity_change: params[4] }] };
    }
    return { rows: [] };
  });

  return calls;
}

const sell = (quantity: number, clampToZero = true) =>
  new InventoryRepository().adjustStock({
    itemId: 'item-1',
    shopId: 'shop-1',
    locationId: LOCATION,
    adjustmentType: 'sale',
    quantityChange: -quantity,
    referenceType: 'pos_sale',
    referenceId: 'sale-1',
    clampToZero,
  });

describe('POS stock deduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSharedPool as any)();
  });

  it('moves the branch row and the shop total by the same amount', async () => {
    const calls = stubDb({ branchStock: 10, itemStock: 25 });

    await sell(3);

    // Branch is written as an absolute figure, the shop total as a delta.
    expect(calls.branchWrite[0]).toBe(7);
    expect(calls.totalWrite[0]).toBe(-3);
  });

  it('deducts only what the branch has when the count is short', async () => {
    const calls = stubDb({ branchStock: 2, itemStock: 25 });

    await sell(5);

    expect(calls.branchWrite[0]).toBe(0);
    // -2, not -5: clamping the branch without clamping the total is how the shop-wide
    // figure drifts below the sum of its branches.
    expect(calls.totalWrite[0]).toBe(-2);
  });

  it('records the quantity actually moved, so before + change = after', async () => {
    const calls = stubDb({ branchStock: 2, itemStock: 25 });

    await sell(5);

    const [, , , , quantityChange, quantityBefore, quantityAfter] = calls.adjustment;
    expect(quantityChange).toBe(-2);
    expect(quantityBefore).toBe(2);
    expect(quantityAfter).toBe(0);
    expect(quantityBefore + quantityChange).toBe(quantityAfter);
  });

  it('still refuses to overdraw a manual adjustment', async () => {
    stubDb({ branchStock: 2, itemStock: 25 });

    await expect(sell(5, false)).rejects.toThrow('Insufficient stock quantity');
  });
});
