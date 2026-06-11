// backend/tests/services/AdsSafeguardRoi.test.ts
//
// Ads System Stage 1 — pure decision-logic tests (no DB). Covers the ROI math
// (computed-at-read) and the safeguard auto-pause thresholds from the plan §6.

import { RoiCalculator } from '../../src/domains/AdsDomain/services/RoiCalculator';
import { SafeguardEvaluator } from '../../src/domains/AdsDomain/services/SafeguardEvaluator';
import { CampaignTotals } from '../../src/domains/AdsDomain/repositories/PerformanceRepository';

const totals = (o: Partial<CampaignTotals> = {}): CampaignTotals => ({
  totalSpendCents: 0, totalRevenueCents: 0, totalLeads: 0, totalBookings: 0, ...o,
});

describe('RoiCalculator.fromTotals', () => {
  it('computes roi / roas / cpl / cpb from spend + revenue', () => {
    const r = RoiCalculator.fromTotals(totals({
      totalSpendCents: 10000, totalRevenueCents: 30000, totalLeads: 20, totalBookings: 5,
    }));
    expect(r.roi).toBeCloseTo(2);        // (30000-10000)/10000
    expect(r.roas).toBeCloseTo(3);       // 30000/10000
    expect(r.cplCents).toBe(500);        // 10000/20
    expect(r.cpbCents).toBe(2000);       // 10000/5
  });

  it('returns null ratios when spend is 0 (no divide-by-zero)', () => {
    const r = RoiCalculator.fromTotals(totals({ totalRevenueCents: 5000 }));
    expect(r.roi).toBeNull();
    expect(r.roas).toBeNull();
    expect(r.cplCents).toBeNull();
    expect(r.cpbCents).toBeNull();
  });

  it('roi is negative when spend exceeds revenue', () => {
    const r = RoiCalculator.fromTotals(totals({ totalSpendCents: 10000, totalRevenueCents: 4000 }));
    expect(r.roi).toBeCloseTo(-0.6);
  });
});

describe('SafeguardEvaluator.decide', () => {
  const T = { softCents: 40000, hardCents: 80000 }; // $400 / $800 defaults

  it('does NOT pause at $399 with 0 leads', () => {
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 39900 }), T)).toBe('none');
  });

  it('soft-alerts at $401 with 0 leads', () => {
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 40100 }), T)).toBe('soft_alert');
  });

  it('hard-pauses at $801 with 0 bookings', () => {
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 80100 }), T)).toBe('hard_pause');
  });

  it('one lead saves a campaign from the soft alert', () => {
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 40100, totalLeads: 1 }), T)).toBe('none');
  });

  it('one booking saves a campaign from the hard pause (but soft may still fire if no leads)', () => {
    // $801, 0 leads, 1 booking → hard avoided; soft still applies (0 leads).
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 80100, totalBookings: 1 }), T)).toBe('soft_alert');
    // …with a lead too → fully clear.
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 80100, totalBookings: 1, totalLeads: 3 }), T)).toBe('none');
  });

  it('hard pause takes precedence over soft alert', () => {
    // $801, 0 leads, 0 bookings → both conditions true → hard wins.
    expect(SafeguardEvaluator.decide(totals({ totalSpendCents: 80100 }), T)).toBe('hard_pause');
  });
});
