// backend/src/domains/AdsDomain/services/RoiCalculator.ts
//
// Computed-at-read ROI (Q5: never stored, so it auto-corrects on cancels/refunds).
// Q6 LOCKED — exclude: AI inference cost is NOT subtracted from the shop-facing
// ROI here; that's FixFlow COGS shown only in the admin "true margin" panel.

import { PerformanceRepository, CampaignTotals, ChannelRow, LeadChannel } from '../repositories/PerformanceRepository';

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

/** Admin-only true-margin view (Q6). The shop NEVER sees these AI-inclusive
 *  figures — they exist so FixFlow can see its real cost of delivery. */
export interface CampaignMargin {
  totalSpendCents: number;
  totalRevenueCents: number;
  /** FixFlow COGS for this campaign (fractional cents). */
  aiCostCents: number;
  /** Shop-facing ROI: (revenue - spend) / spend. Excludes AI cost (Q6). */
  shopRoi: number | null;
  /** Internal ROI WITH AI cost folded in: (revenue - spend - ai) / (spend + ai). */
  trueRoi: number | null;
  /** shopRoi - trueRoi: the ROI "dip" the AI cost represents. null if either side is null. */
  roiDip: number | null;
}

/** One channel's slice of a campaign. leads/bookings/revenue are exact (from the
 *  lead pipeline). Spend is NOT reported per channel by Meta/Google, so it's
 *  allocated proportionally to each channel's lead share — hence roi/cpl/cpb are
 *  estimates (spendModel = 'allocated_by_leads'), while conversionRate and
 *  avgOrderValueCents are exact. */
export interface ChannelRoi {
  channel: LeadChannel;
  leads: number;
  bookings: number;
  revenueCents: number;
  /** Campaign spend allocated to this channel by lead share (estimate). */
  allocatedSpendCents: number;
  /** (revenue - allocatedSpend) / allocatedSpend. null when no spend allocated. */
  roi: number | null;
  /** bookings / leads. null when no leads. */
  conversionRate: number | null;
  /** revenue / bookings (cents). null when no bookings. */
  avgOrderValueCents: number | null;
  /** allocatedSpend / leads (cents). null when no leads. */
  cplCents: number | null;
  /** allocatedSpend / bookings (cents). null when no bookings. */
  cpbCents: number | null;
}

export class RoiCalculator {
  constructor(private readonly perf: PerformanceRepository = new PerformanceRepository()) {}

  async computeForCampaign(campaignId: string): Promise<CampaignRoi> {
    const t = await this.perf.getTotals(campaignId);
    return RoiCalculator.fromTotals(t);
  }

  /** Per-channel breakdown for a campaign, spend allocated by lead share. */
  async computeChannelsForCampaign(campaignId: string, totalSpendCents: number): Promise<ChannelRoi[]> {
    const rows = await this.perf.getChannelBreakdown(campaignId);
    return RoiCalculator.channelsFromRows(rows, totalSpendCents);
  }

  /** Pure — allocate the campaign's spend across channels by lead share, then derive
   *  each channel's ROI/CPL/CPB. Sorted by revenue desc (biggest earner first). */
  static channelsFromRows(rows: ChannelRow[], totalSpendCents: number): ChannelRoi[] {
    const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
    return rows
      .map((r) => {
        const allocatedSpendCents = totalLeads > 0
          ? Math.round(totalSpendCents * (r.leads / totalLeads))
          : 0;
        return {
          channel: r.channel,
          leads: r.leads,
          bookings: r.bookings,
          revenueCents: r.revenueCents,
          allocatedSpendCents,
          roi: allocatedSpendCents > 0 ? (r.revenueCents - allocatedSpendCents) / allocatedSpendCents : null,
          conversionRate: r.leads > 0 ? r.bookings / r.leads : null,
          avgOrderValueCents: r.bookings > 0 ? Math.round(r.revenueCents / r.bookings) : null,
          cplCents: r.leads > 0 && allocatedSpendCents > 0 ? Math.round(allocatedSpendCents / r.leads) : null,
          cpbCents: r.bookings > 0 && allocatedSpendCents > 0 ? Math.round(allocatedSpendCents / r.bookings) : null,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents || b.leads - a.leads);
  }

  /** Pure — unit-testable without a DB. Folds AI COGS into the denominator. */
  static marginFromTotals(t: CampaignTotals, aiCostCents: number): CampaignMargin {
    const spend = t.totalSpendCents;
    const revenue = t.totalRevenueCents;
    const ai = Math.max(0, aiCostCents);
    const shopRoi = spend > 0 ? (revenue - spend) / spend : null;
    const denom = spend + ai;
    const trueRoi = denom > 0 ? (revenue - denom) / denom : null;
    return {
      totalSpendCents: spend,
      totalRevenueCents: revenue,
      aiCostCents: ai,
      shopRoi,
      trueRoi,
      roiDip: shopRoi != null && trueRoi != null ? shopRoi - trueRoi : null,
    };
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
