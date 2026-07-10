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

export type LeadChannel = 'messenger' | 'whatsapp' | 'google' | 'meta_form' | 'webform';

export interface ChannelRow {
  channel: LeadChannel;
  leads: number;
  bookings: number;
  revenueCents: number;
}

export interface DailyMetricsInput {
  spendCents?: number;
  impressions?: number;
  clicks?: number;
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

  /** Per-channel split of the lead pipeline for one campaign (all-time, matching
   *  getTotals). Channel is derived from the lead's own identifiers — Messenger and
   *  webform leads both live under a Meta campaign, so `platform` can't tell them
   *  apart; the lead row can. Leads counted from ad_leads (non-duplicate); bookings +
   *  revenue from the ad-attributed, non-cancelled/refunded service orders. Spend is
   *  per-campaign (not per-channel) so it's left to the caller to allocate. */
  async getChannelBreakdown(campaignId: string): Promise<ChannelRow[]> {
    const res = await this.pool.query(
      `SELECT
          CASE
            WHEN l.messenger_id  IS NOT NULL THEN 'messenger'
            WHEN l.whatsapp_id   IS NOT NULL THEN 'whatsapp'
            WHEN l.gclid         IS NOT NULL THEN 'google'
            WHEN l.meta_lead_id  IS NOT NULL THEN 'meta_form'
            ELSE 'webform'
          END AS channel,
          count(DISTINCT l.id)::int AS leads,
          count(DISTINCT o.order_id) FILTER (
            WHERE o.order_id IS NOT NULL AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded')
          )::int AS bookings,
          ROUND(COALESCE(SUM(
            CASE WHEN COALESCE(o.status, '') NOT IN ('cancelled', 'refunded')
                 THEN o.final_amount_usd ELSE 0 END
          ), 0) * 100)::int AS revenue_cents
         FROM ad_leads l
         LEFT JOIN service_orders o ON o.ad_lead_id = l.id
        WHERE l.campaign_id = $1 AND l.is_duplicate = false
        GROUP BY 1`,
      [campaignId]
    );
    return res.rows.map((r) => ({
      channel: r.channel as ChannelRow['channel'],
      leads: r.leads,
      bookings: r.bookings,
      revenueCents: r.revenue_cents,
    }));
  }

  /** Admin daily-metric correction — spend/impressions/clicks ONLY (idempotent upsert).
   *  leads/bookings/revenue are owned by the pipeline roll-up and are deliberately NOT
   *  written here, so a manual spend fix can't clobber the derived conversion columns. */
  async upsertDaily(campaignId: string, date: string, m: DailyMetricsInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_performance_daily (campaign_id, date, spend_cents, impressions, clicks)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         spend_cents = EXCLUDED.spend_cents,
         impressions = EXCLUDED.impressions,
         clicks      = EXCLUDED.clicks,
         updated_at  = now()`,
      [campaignId, date, m.spendCents ?? 0, m.impressions ?? 0, m.clicks ?? 0]
    );
  }

  /** Stage-4 push Phase 3 — write Meta insights (spend/impressions/clicks) ONLY, leaving
   *  leads/bookings/revenue to the pipeline roll-up (orthogonal columns, no clobber). */
  async upsertMetaInsights(campaignId: string, date: string, m: { spendCents: number; impressions: number; clicks: number }): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_performance_daily (campaign_id, date, spend_cents, impressions, clicks)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         spend_cents = EXCLUDED.spend_cents,
         impressions = EXCLUDED.impressions,
         clicks      = EXCLUDED.clicks,
         updated_at  = now()`,
      [campaignId, date, m.spendCents ?? 0, m.impressions ?? 0, m.clicks ?? 0]
    );
  }

  /** Slice 4 — write Google insights (spend/impressions/clicks) ONLY, leaving leads/bookings/revenue
   *  to the pipeline roll-up (same orthogonal-column contract as upsertMetaInsights). */
  async upsertGoogleInsights(campaignId: string, date: string, m: { spendCents: number; impressions: number; clicks: number }): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_performance_daily (campaign_id, date, spend_cents, impressions, clicks)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (campaign_id, date) DO UPDATE SET
         spend_cents = EXCLUDED.spend_cents,
         impressions = EXCLUDED.impressions,
         clicks      = EXCLUDED.clicks,
         updated_at  = now()`,
      [campaignId, date, m.spendCents ?? 0, m.impressions ?? 0, m.clicks ?? 0]
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

  /** Stage 5 — per-industry breakdown (admin): totals + ROI/CPL/CPB per industry. */
  async getIndustryBreakdown(): Promise<Array<{
    industrySlug: string | null; industryName: string;
    totalSpendCents: number; totalRevenueCents: number; totalLeads: number; totalBookings: number;
    campaignCount: number; roi: number | null; cplCents: number | null; cpbCents: number | null;
  }>> {
    const res = await this.pool.query(
      `SELECT i.slug AS slug, COALESCE(i.name,'Uncategorized') AS name,
              COALESCE(SUM(p.spend_cents),0)::int      AS spend,
              COALESCE(SUM(p.revenue_cents),0)::int    AS revenue,
              COALESCE(SUM(p.leads_captured),0)::int   AS leads,
              COALESCE(SUM(p.bookings_created),0)::int AS bookings,
              COUNT(DISTINCT c.id)::int                AS campaigns
         FROM ad_campaigns c
         LEFT JOIN industries i ON i.id = c.industry_id
         LEFT JOIN ad_performance_daily p ON p.campaign_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY i.slug, i.name
        ORDER BY revenue DESC`
    );
    return res.rows.map((r) => ({
      industrySlug: r.slug,
      industryName: r.name,
      totalSpendCents: r.spend,
      totalRevenueCents: r.revenue,
      totalLeads: r.leads,
      totalBookings: r.bookings,
      campaignCount: r.campaigns,
      roi: r.spend > 0 ? (r.revenue - r.spend) / r.spend : null,
      cplCents: r.leads > 0 ? Math.round(r.spend / r.leads) : null,
      cpbCents: r.bookings > 0 ? Math.round(r.spend / r.bookings) : null,
    }));
  }

  /** Stage 5 — cohort attribution: for each campaign-day, the revenue from leads
   *  captured that day realized within the trailing 30 / 90 days. Lag-aware: an
   *  order can land weeks after the lead. Updates existing perf rows. */
  async rollUpCohortRevenue(lookbackDays = 120): Promise<void> {
    await this.pool.query(
      `UPDATE ad_performance_daily p
          SET revenue_30d_cents = sub.r30, revenue_90d_cents = sub.r90, updated_at = now()
         FROM (
           SELECT l.campaign_id, l.created_at::date AS d,
                  ROUND(SUM(CASE WHEN o.created_at <= l.created_at + INTERVAL '30 days' THEN o.final_amount_usd ELSE 0 END) * 100)::int AS r30,
                  ROUND(SUM(CASE WHEN o.created_at <= l.created_at + INTERVAL '90 days' THEN o.final_amount_usd ELSE 0 END) * 100)::int AS r90
             FROM ad_leads l
             JOIN service_orders o ON o.ad_lead_id = l.id
            WHERE l.created_at > now() - ($1 || ' days')::interval
              AND COALESCE(o.status,'') NOT IN ('cancelled','refunded')
            GROUP BY l.campaign_id, l.created_at::date
         ) sub
        WHERE p.campaign_id = sub.campaign_id AND p.date = sub.d`,
      [String(lookbackDays)]
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
