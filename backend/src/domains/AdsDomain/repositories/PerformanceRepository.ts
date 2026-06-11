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

export interface DailyMetricsInput {
  spendCents?: number;
  impressions?: number;
  clicks?: number;
  leadsCaptured?: number;
  bookingsCreated?: number;
  revenueCents?: number;
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

  /** Admin daily-metric entry — one row per campaign per day (idempotent upsert). */
  async upsertDaily(campaignId: string, date: string, m: DailyMetricsInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_performance_daily
         (campaign_id, date, spend_cents, impressions, clicks, leads_captured,
          bookings_created, revenue_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         spend_cents      = EXCLUDED.spend_cents,
         impressions      = EXCLUDED.impressions,
         clicks           = EXCLUDED.clicks,
         leads_captured   = EXCLUDED.leads_captured,
         bookings_created = EXCLUDED.bookings_created,
         revenue_cents    = EXCLUDED.revenue_cents,
         updated_at       = now()`,
      [
        campaignId, date,
        m.spendCents ?? 0, m.impressions ?? 0, m.clicks ?? 0,
        m.leadsCaptured ?? 0, m.bookingsCreated ?? 0, m.revenueCents ?? 0,
      ]
    );
  }

  /** Nightly roll-up (Stage 2): derive leads_captured (from ad_leads) and
   *  bookings_created + revenue_cents (from service_orders linked via ad_lead_id)
   *  per campaign+day. Manual-entry columns (spend/impressions/clicks) are left
   *  untouched. Reset-then-aggregate over the window so cancels/refunds auto-correct
   *  (Q5: ROI is computed-at-read, so the stored revenue must stay current). */
  async rollUpFromPipeline(lookbackDays = 90): Promise<void> {
    const days = String(lookbackDays);
    // 1. Zero the derived columns in the window (so removed orders drop out).
    await this.pool.query(
      `UPDATE ad_performance_daily
          SET leads_captured = 0, bookings_created = 0, revenue_cents = 0, updated_at = now()
        WHERE date > (now() - ($1 || ' days')::interval)::date`,
      [days]
    );
    // 2. leads_captured from the lead pipeline (non-duplicate), by created day.
    await this.pool.query(
      `INSERT INTO ad_performance_daily (campaign_id, date, leads_captured)
       SELECT campaign_id, created_at::date, count(*)::int
         FROM ad_leads
        WHERE is_duplicate = false AND created_at > now() - ($1 || ' days')::interval
        GROUP BY campaign_id, created_at::date
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         leads_captured = EXCLUDED.leads_captured, updated_at = now()`,
      [days]
    );
    // 3. bookings_created + revenue_cents from ad-attributed service orders.
    await this.pool.query(
      `INSERT INTO ad_performance_daily (campaign_id, date, bookings_created, revenue_cents)
       SELECT l.campaign_id, o.created_at::date,
              count(*)::int,
              ROUND(COALESCE(SUM(o.final_amount_usd), 0) * 100)::int
         FROM service_orders o
         JOIN ad_leads l ON l.id = o.ad_lead_id
        WHERE o.ad_lead_id IS NOT NULL
          AND o.created_at > now() - ($1 || ' days')::interval
          AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded')
        GROUP BY l.campaign_id, o.created_at::date
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         bookings_created = EXCLUDED.bookings_created,
         revenue_cents = EXCLUDED.revenue_cents,
         updated_at = now()`,
      [days]
    );
  }

  /** All-shops admin rollup: totals across every (non-deleted) campaign's perf. */
  async getAllShopsSummary(): Promise<CampaignTotals & { campaignCount: number }> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(p.spend_cents),0)::int      AS spend,
              COALESCE(SUM(p.revenue_cents),0)::int    AS revenue,
              COALESCE(SUM(p.leads_captured),0)::int   AS leads,
              COALESCE(SUM(p.bookings_created),0)::int AS bookings,
              COUNT(DISTINCT p.campaign_id)::int       AS campaigns
         FROM ad_performance_daily p
         JOIN ad_campaigns c ON c.id = p.campaign_id AND c.deleted_at IS NULL`
    );
    const r = res.rows[0];
    return {
      totalSpendCents: r.spend, totalRevenueCents: r.revenue,
      totalLeads: r.leads, totalBookings: r.bookings, campaignCount: r.campaigns,
    };
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
