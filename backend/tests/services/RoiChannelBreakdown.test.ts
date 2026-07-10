// Per-channel metrics: leads/bookings/revenue are exact from the lead pipeline;
// campaign spend (not reported per channel) is allocated by lead share so each
// channel gets an estimated ROI/CPL/CPB. Pure — no DB.
import { RoiCalculator } from '../../src/domains/AdsDomain/services/RoiCalculator';
import { ChannelRow } from '../../src/domains/AdsDomain/repositories/PerformanceRepository';

const rows: ChannelRow[] = [
  { channel: 'messenger', leads: 6, bookings: 3, revenueCents: 90000 }, // $900 from 3 bookings
  { channel: 'webform', leads: 4, bookings: 1, revenueCents: 10000 },   // $100 from 1 booking
];

describe('RoiCalculator.channelsFromRows', () => {
  it('allocates spend by lead share and derives per-channel ROI/CPL/CPB', () => {
    // $200 spend, 10 leads → $120 to messenger (6/10), $80 to webform (4/10).
    const out = RoiCalculator.channelsFromRows(rows, 20000);

    const msg = out.find((c) => c.channel === 'messenger')!;
    expect(msg.allocatedSpendCents).toBe(12000);
    expect(msg.roi).toBeCloseTo((90000 - 12000) / 12000);   // (rev - spend)/spend
    expect(msg.conversionRate).toBeCloseTo(3 / 6);            // exact, spend-independent
    expect(msg.avgOrderValueCents).toBe(30000);              // $900 / 3
    expect(msg.cplCents).toBe(2000);                         // $120 / 6
    expect(msg.cpbCents).toBe(4000);                         // $120 / 3

    const web = out.find((c) => c.channel === 'webform')!;
    expect(web.allocatedSpendCents).toBe(8000);
    expect(web.roi).toBeCloseTo((10000 - 8000) / 8000);
  });

  it('sorts channels by revenue desc (biggest earner first)', () => {
    const out = RoiCalculator.channelsFromRows(rows, 20000);
    expect(out.map((c) => c.channel)).toEqual(['messenger', 'webform']);
  });

  it('leaves spend-derived metrics null when there is no spend, keeping exact ones', () => {
    const out = RoiCalculator.channelsFromRows(rows, 0);
    const msg = out.find((c) => c.channel === 'messenger')!;
    expect(msg.allocatedSpendCents).toBe(0);
    expect(msg.roi).toBeNull();
    expect(msg.cplCents).toBeNull();
    expect(msg.cpbCents).toBeNull();
    expect(msg.conversionRate).toBeCloseTo(0.5);   // still exact
    expect(msg.avgOrderValueCents).toBe(30000);    // still exact
  });

  it('handles an empty pipeline without dividing by zero', () => {
    expect(RoiCalculator.channelsFromRows([], 5000)).toEqual([]);
  });
});
