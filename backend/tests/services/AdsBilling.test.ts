// Pure unit tests for Plan A/B/C charge math (Q4/Q7). No DB.

import { AdBillingService } from '../../src/domains/AdsDomain/services/AdBillingService';
import { AdBillingPlan, DEFAULT_PLAN } from '../../src/domains/AdsDomain/repositories/BillingPlanRepository';
import { PerformanceRow } from '../../src/domains/AdsDomain/repositories/PerformanceRepository';

const plan = (o: Partial<AdBillingPlan> = {}): AdBillingPlan => ({ shopId: 's1', ...DEFAULT_PLAN, ...o });
const day = (o: Partial<PerformanceRow> = {}): PerformanceRow => ({
  date: '2026-06-11', spendCents: 0, impressions: 0, clicks: 0,
  leadsCaptured: 0, bookingsCreated: 0, revenueCents: 0, ...o,
});

describe('AdBillingService.computeCampaignDayCharge', () => {
  it('Plan B: margin = spend × markup (20% default → $20 on $100)', () => {
    const c = AdBillingService.computeCampaignDayCharge(plan({ planType: 'b' }), day({ spendCents: 10000 }));
    expect(c).toEqual({ chargeType: 'plan_b_margin', basisCents: 10000, amountCents: 2000 });
  });

  it('Plan B: custom markup (35%)', () => {
    const c = AdBillingService.computeCampaignDayCharge(plan({ planType: 'b', markupBps: 3500 }), day({ spendCents: 10000 }));
    expect(c?.amountCents).toBe(3500);
  });

  it('Plan B: zero spend → no charge', () => {
    expect(AdBillingService.computeCampaignDayCharge(plan({ planType: 'b' }), day())).toBeNull();
  });

  it('Plan C per-booking: bookings × fee ($50 × 3)', () => {
    const c = AdBillingService.computeCampaignDayCharge(
      plan({ planType: 'c', planCModel: 'per_booking' }), day({ bookingsCreated: 3 })
    );
    expect(c).toEqual({ chargeType: 'plan_c_booking', basisCents: 3, amountCents: 15000 });
  });

  it('Plan C per-booking: zero bookings → no charge', () => {
    const c = AdBillingService.computeCampaignDayCharge(
      plan({ planType: 'c', planCModel: 'per_booking' }), day({ revenueCents: 9999 })
    );
    expect(c).toBeNull();
  });

  it('Plan C revenue-share: revenue × share (10% of $200)', () => {
    const c = AdBillingService.computeCampaignDayCharge(
      plan({ planType: 'c', planCModel: 'revenue_share' }), day({ revenueCents: 20000 })
    );
    expect(c).toEqual({ chargeType: 'plan_c_revenue_share', basisCents: 20000, amountCents: 2000 });
  });

  it('Plan A: no per-campaign accrual (handled monthly per shop)', () => {
    expect(AdBillingService.computeCampaignDayCharge(plan({ planType: 'a' }), day({ spendCents: 50000 }))).toBeNull();
  });
});
