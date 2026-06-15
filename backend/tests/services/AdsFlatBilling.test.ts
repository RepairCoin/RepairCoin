// backend/tests/services/AdsFlatBilling.test.ts
//
// Flat-tier ad billing (Decision 2026-06-15: flat-only; shop pays ad-spend directly).
// Pure-logic + injected-fake tests (no DB):
//   - computeCampaignDayCharge: flat accrues nothing per campaign-day; A/B/C unchanged.
//   - accrueMonthlyFees: emits flat_tier_fee for flat shops, plan_a_dashboard for legacy A.
//   - FLAT_TIER_FEES map.

import { AdBillingService } from '../../src/domains/AdsDomain/services/AdBillingService';
import {
  AdBillingPlan, FLAT_TIER_FEES,
} from '../../src/domains/AdsDomain/repositories/BillingPlanRepository';
import { PerformanceRow } from '../../src/domains/AdsDomain/repositories/PerformanceRepository';
import { UpsertChargeInput } from '../../src/domains/AdsDomain/repositories/BillingChargeRepository';

const plan = (over: Partial<AdBillingPlan> = {}): AdBillingPlan => ({
  shopId: 'shop1',
  planType: 'flat',
  markupBps: 2000,
  dashboardFeeCents: 29900,
  perBookingFeeCents: 5000,
  revenueShareBps: 1000,
  planCModel: 'per_booking',
  flatFeeCents: FLAT_TIER_FEES.growth,
  flatTierName: 'growth',
  active: true,
  ...over,
});

const day = (over: Partial<PerformanceRow> = {}): PerformanceRow => ({
  date: '2026-06-01',
  spendCents: 0,
  impressions: 0,
  clicks: 0,
  leadsCaptured: 0,
  bookingsCreated: 0,
  revenueCents: 0,
  ...over,
});

/** AdBillingService with fake plans + charges repos (only these are used by accrueMonthlyFees). */
function serviceWith(plans: AdBillingPlan[]) {
  const upserts: UpsertChargeInput[] = [];
  const fakePlans = { listActiveShopPlans: async () => plans } as any;
  const fakeCharges = { upsert: async (i: UpsertChargeInput) => { upserts.push(i); } } as any;
  const svc = new AdBillingService({} as any, {} as any, fakePlans, fakeCharges);
  return { svc, upserts };
}

describe('AdBillingService.computeCampaignDayCharge', () => {
  it('flat plan accrues NOTHING per campaign-day (shop pays spend directly)', () => {
    const c = AdBillingService.computeCampaignDayCharge(plan({ planType: 'flat' }), day({ spendCents: 50000, revenueCents: 90000, bookingsCreated: 3 }));
    expect(c).toBeNull();
  });

  it('legacy Plan B still margins on spend (no regression)', () => {
    const c = AdBillingService.computeCampaignDayCharge(plan({ planType: 'b', markupBps: 2000 }), day({ spendCents: 10000 }));
    expect(c).toEqual({ chargeType: 'plan_b_margin', basisCents: 10000, amountCents: 2000 });
  });

  it('legacy Plan C per-booking still charges per booking (no regression)', () => {
    const c = AdBillingService.computeCampaignDayCharge(plan({ planType: 'c', planCModel: 'per_booking', perBookingFeeCents: 5000 }), day({ bookingsCreated: 2 }));
    expect(c).toEqual({ chargeType: 'plan_c_booking', basisCents: 2, amountCents: 10000 });
  });
});

describe('AdBillingService.accrueMonthlyFees', () => {
  it('emits one flat_tier_fee of flatFeeCents for a flat shop (campaign_id null)', async () => {
    const { svc, upserts } = serviceWith([plan({ planType: 'flat', flatFeeCents: 49900 })]);
    const n = await svc.accrueMonthlyFees('2026-06-01');
    expect(n).toBe(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toEqual({
      shopId: 'shop1', campaignId: null, periodDate: '2026-06-01',
      chargeType: 'flat_tier_fee', basisCents: 0, amountCents: 49900,
    });
  });

  it('is idempotent — same deterministic payload on re-run', async () => {
    const { svc, upserts } = serviceWith([plan({ planType: 'flat', flatFeeCents: 19900 })]);
    await svc.accrueMonthlyFees('2026-06-01');
    await svc.accrueMonthlyFees('2026-06-01');
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toEqual(upserts[1]); // ON CONFLICT upsert makes the repeat a no-op at the DB
  });

  it('still emits plan_a_dashboard for a legacy Plan A shop (no regression)', async () => {
    const { svc, upserts } = serviceWith([plan({ planType: 'a', dashboardFeeCents: 29900 })]);
    await svc.accrueMonthlyFees('2026-06-01');
    expect(upserts[0].chargeType).toBe('plan_a_dashboard');
    expect(upserts[0].amountCents).toBe(29900);
  });

  it('skips a flat shop with a zero fee and inactive shops', async () => {
    const { svc, upserts } = serviceWith([
      plan({ shopId: 'z', planType: 'flat', flatFeeCents: 0 }),
      plan({ shopId: 'i', planType: 'flat', flatFeeCents: 49900, active: false }),
    ]);
    const n = await svc.accrueMonthlyFees('2026-06-01');
    expect(n).toBe(0);
    expect(upserts).toHaveLength(0);
  });
});

describe('FLAT_TIER_FEES', () => {
  it('maps the agreed tier prices', () => {
    expect(FLAT_TIER_FEES.starter).toBe(19900);
    expect(FLAT_TIER_FEES.growth).toBe(49900);
    expect(FLAT_TIER_FEES.business).toBe(99900);
  });
});
