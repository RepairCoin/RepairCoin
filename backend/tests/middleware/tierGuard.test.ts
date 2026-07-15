// WS2 Slice 2 — route-level tier gating. requireTier(feature) resolves the shop's
// tier and either calls next() (at/above tier) or 403s with an upsell payload.
import { requireTier } from '../../src/middleware/tierGuard';

// Mock tier resolution so the guard is deterministic (no DB).
jest.mock('../../src/utils/shopTier', () => ({
  getShopTier: jest.fn(),
}));
import { getShopTier } from '../../src/utils/shopTier';

const mockGetShopTier = getShopTier as jest.MockedFunction<typeof getShopTier>;

function makeCtx(shopId: string | undefined) {
  const req: any = { params: {}, body: {}, user: { shopId } };
  const res: any = {
    statusCode: 0,
    payload: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.payload = body; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('requireTier middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next() when the shop tier includes the feature', async () => {
    mockGetShopTier.mockResolvedValue('business');
    const { req, res, next } = makeCtx('shop-1');
    await requireTier('aiMemory')(req, res, next); // aiMemory = business
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('calls next() for a Growth feature on Business (cumulative)', async () => {
    mockGetShopTier.mockResolvedValue('business');
    const { req, res, next } = makeCtx('shop-1');
    await requireTier('voiceAiAssistant')(req, res, next); // growth feature
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('403s with an upsell payload when below the required tier', async () => {
    mockGetShopTier.mockResolvedValue('starter');
    const { req, res, next } = makeCtx('shop-1');
    await requireTier('aiInsights')(req, res, next); // aiInsights = growth
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('FEATURE_NOT_IN_TIER');
    expect(res.payload.details).toMatchObject({
      feature: 'aiInsights',
      currentTier: 'starter',
      requiredTier: 'growth',
    });
  });

  it('403s a Business feature on Starter and on Growth', async () => {
    mockGetShopTier.mockResolvedValue('growth');
    const { req, res, next } = makeCtx('shop-1');
    await requireTier('aiMemory')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload.details.requiredTier).toBe('business');
  });

  it('400s when no shop can be resolved from the request', async () => {
    const { req, res, next } = makeCtx(undefined);
    await requireTier('aiMemory')(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('MISSING_SHOP_ID');
    expect(mockGetShopTier).not.toHaveBeenCalled();
  });
});
