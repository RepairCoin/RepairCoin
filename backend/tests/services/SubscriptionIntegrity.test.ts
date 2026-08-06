import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

describe('live Stripe subscription lookup', () => {
  const list = jest.fn<(...a: any[]) => Promise<any>>();
  const getCustomer = jest.fn<(...a: any[]) => Promise<any>>();
  const getActive = jest.fn<(...a: any[]) => Promise<any>>();

  const load = async () => {
    jest.resetModules();
    [list, getCustomer, getActive].forEach((m) => m.mockReset());
    getCustomer.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    getActive.mockResolvedValue(null);

    jest.doMock('../../src/services/StripeService', () => ({
      getStripeService: () => ({ getStripe: () => ({ subscriptions: { list } }) }),
      StripeService: class {},
    }));

    const { SubscriptionService } = await import('../../src/services/SubscriptionService');
    const svc: any = new SubscriptionService();
    svc.getCustomerByShopId = getCustomer;
    svc.getActiveSubscription = getActive;
    return svc;
  };

  beforeEach(() => jest.clearAllMocks());

  it('counts every subscription Stripe still considers live', async () => {
    const svc = await load();
    list.mockResolvedValue({
      data: [
        { id: 'sub_a', status: 'active' },
        { id: 'sub_b', status: 'past_due' },
        { id: 'sub_c', status: 'trialing' },
      ],
    });

    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual(['sub_a', 'sub_b', 'sub_c']);
  });

  it('ignores subscriptions that ended, so a lapsed shop can subscribe again', async () => {
    const svc = await load();
    list.mockResolvedValue({
      data: [
        { id: 'sub_dead', status: 'canceled' },
        { id: 'sub_gone', status: 'incomplete_expired' },
        { id: 'sub_unpaid', status: 'unpaid' },
      ],
    });

    // `unpaid` is deliberately absent: Stripe has stopped collecting, and treating it as live
    // would lock a shop out of resubscribing after a failed card.
    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual([]);
  });

  it('does not mistake the Agency Program for the shop\'s own plan', async () => {
    const svc = await load();
    list.mockResolvedValue({
      data: [{ id: 'sub_agency', status: 'active', metadata: { type: 'agency_activation' } }],
    });

    // The Agency Program bills on the owner shop's same Stripe customer. Counting it would tell an
    // agency owner who has no plan that they already have one — a paying customer locked out of
    // buying. The subscription.created webhook skips it for the same reason.
    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual([]);
  });

  it('still sees the plan when an agency subscription sits beside it', async () => {
    const svc = await load();
    list.mockResolvedValue({
      data: [
        { id: 'sub_agency', status: 'active', metadata: { type: 'agency_activation' } },
        { id: 'sub_plan', status: 'active', metadata: { shopId: 'shop-1' } },
      ],
    });

    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual(['sub_plan']);
  });

  it('asks Stripe rather than the mirror — that gap is how duplicates got created', async () => {
    const svc = await load();
    list.mockResolvedValue({ data: [{ id: 'sub_live', status: 'active' }] });
    getActive.mockResolvedValue(null); // mirror says nothing yet: webhook has not landed

    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual(['sub_live']);
    expect(list).toHaveBeenCalled();
  });

  it('falls back to the mirror when Stripe is unreachable', async () => {
    const svc = await load();
    list.mockRejectedValue(new Error('stripe down'));
    getActive.mockResolvedValue({ stripeSubscriptionId: 'sub_mirrored' });

    // Blocking every new subscription during a Stripe outage is worse than the duplicate risk.
    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual(['sub_mirrored']);
  });

  it('reports nothing live for a shop that has never had a Stripe customer', async () => {
    const svc = await load();
    getCustomer.mockResolvedValue(null);

    expect(await svc.getLiveStripeSubscriptionIds('shop-1')).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });
});

describe('subscription integrity queries', () => {
  it('finds shops billing more than once', async () => {
    const { DUPLICATE_LIVE_SUBS_SQL } = await import('../../src/utils/subscriptionIntegrity');
    expect(DUPLICATE_LIVE_SUBS_SQL).toContain('HAVING count(*) > 1');
    expect(DUPLICATE_LIVE_SUBS_SQL).toContain("status IN ('active', 'trialing', 'past_due')");
    expect(DUPLICATE_LIVE_SUBS_SQL).toContain('current_period_end > NOW()');
  });

  it('does not accuse commitment plans of having no cover', async () => {
    const { ACTIVE_WITHOUT_COVER_SQL } = await import('../../src/utils/subscriptionIntegrity');
    // Commitment plans are billed outside Stripe; no Stripe row is their normal state.
    expect(ACTIVE_WITHOUT_COVER_SQL).toContain("IS DISTINCT FROM 'commitment_qualified'");
  });

  it('picks each shop\'s cover with the shared live-subscription rule', async () => {
    const { ACTIVE_WITHOUT_COVER_SQL } = await import('../../src/utils/subscriptionIntegrity');
    expect(ACTIVE_WITHOUT_COVER_SQL).toContain('current_period_end DESC NULLS LAST');
    expect(ACTIVE_WITHOUT_COVER_SQL).not.toMatch(/ORDER BY shop_id,\s*created_at DESC/);
  });
});
