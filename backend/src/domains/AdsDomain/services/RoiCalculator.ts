// backend/src/domains/AdsDomain/services/RoiCalculator.ts
//
// Computed-at-read ROI (Q5: never stored, so it auto-corrects on cancels/refunds).
// Q6 LOCKED — exclude: AI inference cost is NOT subtracted from the shop-facing
// ROI here; that's FixFlow COGS shown only in the admin "true margin" panel.

import { PerformanceRepository, CampaignTotals } from '../repositories/PerformanceRepository';

export interface CampaignRoi {
  totalSpendCents: number;
  totalRevenueCents: number;
  totalLeads: number;
  totalBookings: number;
  /** Net ROI as a ratio: (revenue - spend) / spend. null when spend is 0. */
  roi: number | null;
  /** Return on ad spend: revenue / spend. null when spend is 0. */
  roas: number | null;
  /** Cost per lead (cents). null when leads is 0. */
  cplCents: number | null;
  /** Cost per booking (cents). null when bookings is 0. */
  cpbCents: number | null;
}

export class RoiCalculator {
  constructor(private readonly perf: PerformanceRepository = new PerformanceRepository()) {}

  async computeForCampaign(campaignId: string): Promise<CampaignRoi> {
    const t = await this.perf.getTotals(campaignId);
    return RoiCalculator.fromTotals(t);
  }

  /** Pure — unit-testable without a DB. */
  static fromTotals(t: CampaignTotals): CampaignRoi {
    const { totalSpendCents: spend, totalRevenueCents: revenue, totalLeads: leads, totalBookings: bookings } = t;
    return {
      totalSpendCents: spend,
      totalRevenueCents: revenue,
      totalLeads: leads,
      totalBookings: bookings,
      roi: spend > 0 ? (revenue - spend) / spend : null,
      roas: spend > 0 ? revenue / spend : null,
      cplCents: leads > 0 ? Math.round(spend / leads) : null,
      cpbCents: bookings > 0 ? Math.round(spend / bookings) : null,
    };
  }
}
