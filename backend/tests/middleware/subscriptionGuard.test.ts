// Free-tier behaviour of requireActiveSubscription. The `allowFree` option lets
// an unsubscribed shop through storefront routes while the default still blocks
// it, and hard blocks (suspended, paused) reject regardless of the option.

jest.mock('../../src/repositories', () => ({
  shopRepository: { getShop: jest.fn() },
}));
jest.mock('../../src/utils/shopStatus', () => ({ getShopStatus: jest.fn() }));
jest.mock('../../src/utils/agencyEntitlement', () => ({ isEntitledByAgency: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../../src/utils/database-pool', () => ({
  getSharedPool: () => ({ query: mockQuery }),
}));

import { requireActiveSubscription } from '../../src/middleware/subscriptionGuard';
import { shopRepository } from '../../src/repositories';
import { getShopStatus } from '../../src/utils/shopStatus';
import { isEntitledByAgency } from '../../src/utils/agencyEntitlement';

const mockGetShop = shopRepository.getShop as jest.Mock;
const mockGetShopStatus = getShopStatus as jest.Mock;
const mockIsEntitledByAgency = isEntitledByAgency as jest.Mock;

function makeCtx(shopId = 'shop-1') {
  const req: any = { params: {}, body: {}, user: { shopId }, path: '/x', method: 'POST' };
  const res: any = {
    statusCode: 0,
    payload: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.payload = body; return this; },
  };
  return { req, res, next: jest.fn() };
}

/** A free-tier shop: verified, active, no subscription (operational_status not_qualified). */
const freeShop = () => ({
  shopId: 'shop-1',
  operational_status: 'not_qualified',
  subscriptionActive: false,
  rcg_balance: 0,
  agencyId: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetShopStatus.mockReturnValue('active'); // not suspended/rejected
  mockIsEntitledByAgency.mockResolvedValue(false);
  mockQuery.mockResolvedValue({ rows: [] }); // no stripe_subscriptions row
});

describe('requireActiveSubscription — allowFree', () => {
  it('lets a free-tier shop through when allowFree is set', async () => {
    mockGetShop.mockResolvedValue(freeShop());
    const { req, res, next } = makeCtx();
    await requireActiveSubscription({ allowFree: true })(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('blocks a free-tier shop by default (no allowFree)', async () => {
    mockGetShop.mockResolvedValue(freeShop());
    const { req, res, next } = makeCtx();
    await requireActiveSubscription()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('still blocks a suspended shop even with allowFree', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), suspendedAt: '2026-01-01' });
    mockGetShopStatus.mockReturnValue('suspended');
    const { req, res, next } = makeCtx();
    await requireActiveSubscription({ allowFree: true })(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SHOP_SUSPENDED');
  });

  it('still blocks an admin-paused shop even with allowFree', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), operational_status: 'paused' });
    const { req, res, next } = makeCtx();
    await requireActiveSubscription({ allowFree: true })(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SUBSCRIPTION_INACTIVE');
    expect(res.payload.details.status).toBe('paused');
  });

  it('still blocks a pending (unverified) shop even with allowFree', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), operational_status: 'pending' });
    const { req, res, next } = makeCtx();
    await requireActiveSubscription({ allowFree: true })(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows an expired subscription through when allowFree (self-heal path)', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), operational_status: 'subscription_qualified' });
    // A stripe row whose period ended in the past = expired.
    mockQuery.mockResolvedValue({
      rows: [{ current_period_end: '2020-01-01', status: 'canceled', cancel_at_period_end: true }],
    });
    const { req, res, next } = makeCtx();
    await requireActiveSubscription({ allowFree: true })(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks an expired subscription by default', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), operational_status: 'subscription_qualified' });
    mockQuery.mockResolvedValue({
      rows: [{ current_period_end: '2020-01-01', status: 'canceled', cancel_at_period_end: true }],
    });
    const { req, res, next } = makeCtx();
    await requireActiveSubscription()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('lets an actively subscribed shop through regardless of allowFree', async () => {
    mockGetShop.mockResolvedValue({ ...freeShop(), operational_status: 'subscription_qualified' });
    const { req, res, next } = makeCtx();
    await requireActiveSubscription()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
