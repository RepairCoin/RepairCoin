// backend/src/domains/AdsDomain/repositories/PerformanceRepository.ts
//
// ad_performance_daily reads + aggregate. ROI is NOT stored (Q5) — RoiCalculator
// computes it from these aggregates at read time. Stage 1 adds the manual-entry
// upsert + nightly roll-up; Stage 0 exposes read + aggregate.

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface PerformanceRow {
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  leadsCaptured: number;
  bookingsCreated: number;
  revenueCents: number;
}

export interface CampaignTotals {
  totalSpendCents: number;
  totalRevenueCents: number;
  totalLeads: number;
  totalBookings: number;
}

export class PerformanceRepository extends BaseRepository {
  async getDailyRows(campaignId: string, limitDays = 30): Promise<PerformanceRow[]> {
    const res = await this.pool.query(
      `SELECT date, spend_cents, impressions, clicks, leads_captured, bookings_created, revenue_cents
         FROM ad_performance_daily
        WHERE campaign_id = $1
        ORDER BY date DESC
        LIMIT $2`,
      [campaignId, limitDays]
    );
    return res.rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      spendCents: r.spend_cents,
      impressions: r.impressions,
      clicks: r.clicks,
      leadsCaptured: r.leads_captured,
      bookingsCreated: r.bookings_created,
      revenueCents: r.revenue_cents,
    }));
  }

  async getTotals(campaignId: string): Promise<CampaignTotals> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(spend_cents),0)::int       AS spend,
              COALESCE(SUM(revenue_cents),0)::int     AS revenue,
              COALESCE(SUM(leads_captured),0)::int    AS leads,
              COALESCE(SUM(bookings_created),0)::int  AS bookings
         FROM ad_performance_daily WHERE campaign_id = $1`,
      [campaignId]
    );
    const r = res.rows[0];
    return {
      totalSpendCents: r.spend,
      totalRevenueCents: r.revenue,
      totalLeads: r.leads,
      totalBookings: r.bookings,
    };
  }
}
