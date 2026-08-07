import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { calculateBaseReward, calculateTierBonus, calculateReward } from '../../src/utils/repairReward';

describe('repairReward', () => {
  it('steps at 30, 50 and 100 rather than scaling', () => {
    expect(calculateBaseReward(29.99)).toBe(0);
    expect(calculateBaseReward(30)).toBe(5);
    expect(calculateBaseReward(49.99)).toBe(5);
    expect(calculateBaseReward(50)).toBe(10);
    expect(calculateBaseReward(99.99)).toBe(10);
    expect(calculateBaseReward(100)).toBe(15);
    expect(calculateBaseReward(10000)).toBe(15);
  });

  it('treats a missing or unknown tier as no bonus', () => {
    expect(calculateTierBonus('BRONZE')).toBe(0);
    expect(calculateTierBonus('SILVER')).toBe(2);
    expect(calculateTierBonus('GOLD')).toBe(5);
    expect(calculateTierBonus(null)).toBe(0);
    expect(calculateTierBonus('platinum')).toBe(0);
  });

  it('is case-insensitive, since tiers arrive from more than one place', () => {
    expect(calculateTierBonus('gold')).toBe(5);
  });

  it('composes base plus tier', () => {
    expect(calculateReward(100, 'GOLD')).toEqual({ baseReward: 15, tierBonus: 5, total: 20 });
    expect(calculateReward(45, 'SILVER')).toEqual({ baseReward: 5, tierBonus: 2, total: 7 });
  });

  it('pays nothing on a non-finite amount rather than guessing', () => {
    expect(calculateBaseReward(NaN)).toBe(0);
    // Infinity is garbage input, not a very large sale — the top step would be the wrong answer.
    expect(calculateBaseReward(Infinity)).toBe(0);
  });
});

describe('POS loyalty listener', () => {
  const getCustomer = jest.fn<(...a: any[]) => Promise<any>>();
  const issueExact = jest.fn<(...a: any[]) => Promise<any>>();

  const load = async () => {
    jest.resetModules();
    getCustomer.mockReset();
    issueExact.mockReset();
    issueExact.mockResolvedValue({ ok: true });
    getCustomer.mockResolvedValue({ tier: 'BRONZE', isActive: true });

    jest.doMock('../../src/repositories', () => ({ customerRepository: { getCustomer } }));
    jest.doMock('../../src/services/RewardIssuanceService', () => ({
      rewardIssuanceService: { issueExact },
    }));
    jest.doMock('../../src/events/EventBus', () => ({ eventBus: { subscribe: jest.fn() } }));

    const mod = await import('../../src/domains/ShopDomain/services/PosLoyaltyListener');
    return mod.issueLoyaltyForSale;
  };

  const event = (over: Record<string, any> = {}) => ({
    data: {
      saleId: 'sale-1',
      shopId: 'shop-1',
      saleNumber: 7,
      customerAddress: '0xabc',
      netCents: 10000,
      ...over,
    },
  });

  beforeEach(() => jest.clearAllMocks());

  it('earns nothing for a walk-in, without touching the customer table', async () => {
    const run = await load();
    await run(event({ customerAddress: null }));

    expect(getCustomer).not.toHaveBeenCalled();
    expect(issueExact).not.toHaveBeenCalled();
  });

  it('earns on the net-of-tax basis, not the total paid', async () => {
    const run = await load();
    // $100.00 net. Had tax been included the amount would clear the same threshold, so the
    // check that matters is that netCents is what reaches the calculation.
    await run(event({ netCents: 10000 }));

    expect(issueExact).toHaveBeenCalledTimes(1);
    const arg = issueExact.mock.calls[0][0] as any;
    expect(arg.rcnAmount).toBe(15);
    expect(arg.source).toBe('pos_sale');
    expect(arg.reason).toBe('Counter sale #7');
  });

  it('does not let tax push a sale over a threshold', async () => {
    const run = await load();
    // $95 of goods at 8.25% is $102.84 paid — but only $95 earns, so it stays on the $50 step.
    await run(event({ netCents: 9500 }));

    expect((issueExact.mock.calls[0][0] as any).rcnAmount).toBe(10);
  });

  it('adds the tier bonus', async () => {
    const run = await load();
    getCustomer.mockResolvedValue({ tier: 'GOLD', isActive: true });
    await run(event({ netCents: 10000 }));

    expect((issueExact.mock.calls[0][0] as any).rcnAmount).toBe(20);
  });

  it('skips a sale too small to earn anything', async () => {
    const run = await load();
    await run(event({ netCents: 500 }));

    expect(issueExact).not.toHaveBeenCalled();
  });

  it('skips a customer who is no longer registered', async () => {
    const run = await load();
    getCustomer.mockResolvedValue(null);
    await run(event());

    expect(issueExact).not.toHaveBeenCalled();
  });

  it('swallows a shop running out of RCN — the customer has already left', async () => {
    const run = await load();
    issueExact.mockResolvedValue({ ok: false, errorCode: 'insufficient_balance' });

    await expect(run(event())).resolves.toBeUndefined();
  });

  it('swallows an unexpected failure rather than escaping into the event bus', async () => {
    const run = await load();
    getCustomer.mockRejectedValue(new Error('db down'));

    await expect(run(event())).resolves.toBeUndefined();
  });
});
