// backend/src/domains/AdsDomain/repositories/CampaignRepository.ts
//
// Ads campaigns CRUD. Admin-created in v1; shops read their own. Soft-delete via
// deleted_at. Mirrors the repo conventions (BaseRepository + explicit mapRow).

import { BaseRepository } from '../../../repositories/BaseRepository';
import { logger } from '../../../utils/logger';

export interface AdCampaign {
  id: string;
  shopId: string;
  industryId: number | null;
  name: string;
  platform: string;
  targetRadiusMiles: number | null;
  targetUnits: 'mi' | 'km';
  dailyBudgetCents: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  /** Admin-selected Meta objective (OUTCOME_TRAFFIC | OUTCOME_AWARENESS | OUTCOME_ENGAGEMENT).
   *  Null → push derives it from the request goal. */
  objective: string | null;
  /** Opt-in: push the creative with Meta Advantage+ standard enhancements (default false). */
  allowMetaEnhancements: boolean;
  /** Safeguard 5: set when a nightly check finds the campaign underperforming → nudge a free swap. */
  needsCreativeRefresh: boolean;
  creativeRefreshReason: string | null;
  /** Safeguard 4 — test-budget tier. */
  isTestBudget: boolean;
  fullDailyBudgetCents: number | null;
  testBudgetStartedAt: Date | null;
  testBudgetUpgradeReady: boolean;
  /** The shop's ad-account currency (ISO), joined from shops.meta_currency — for displaying
   *  ad money (budget/spend/etc.) in the right currency. Null until the account is connected. */
  currency: string | null;
  aiAgentEnabled: boolean;
  notes: string | null;
  startedAt: Date | null;
  pausedAt: Date | null;
  archivedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Stage-4 push — ids of the objects created on the shop's Meta ad account.
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaAdId: string | null;
  metaCreativeId: string | null;
  metaLeadFormId: string | null;
  metaStatus: string | null;
  metaLastSyncedAt: Date | null;
  metaSyncedConfigAt: Date | null;
  /** Two-way sync (Phase 3): the live ad set's targeting spec, verbatim — read-only fidelity for
   *  targeting we can't losslessly map to our typed columns. Never reverse-pushed (D4). */
  metaTargetingRaw: any | null;
  // Google push (Slice 3) — ids of the objects created on the shop's Google Ads account.
  googleCampaignId: string | null;
  googleAdGroupId: string | null;
  googleBudgetId: string | null;
  googleStatus: string | null;
  /** When Google insights (spend/impr/clicks) were last imported for this campaign (Slice 4). */
  googleLastSyncedAt: Date | null;
  /** When config was last reconciled FROM Google (Slice 5) — distinct from googleLastSyncedAt (insights). */
  googleSyncedConfigAt: Date | null;
  /** RSA copy + keywords stored locally so the dashboard can display/edit them (composer). */
  googleAdContent: GoogleAdContent | null;
  /** The RSA ad resource id — RSA ads are immutable, so a copy edit recreates the ad. */
  googleAdId: string | null;
  /** Per-campaign landing-page magnet overrides (Phase 2); null → auto-composed defaults. */
  landingConfig: LandingConfig | null;
}

/** Locally-stored Google Search ad content (mirrors what's on Google), for the composer. */
export interface GoogleAdContent {
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  finalUrl?: string | null;
}

export interface GoogleObjectIds {
  googleCampaignId?: string | null;
  googleAdGroupId?: string | null;
  googleBudgetId?: string | null;
  googleStatus?: string | null;
  googleLastSyncedAt?: Date | null;
  googleSyncedConfigAt?: Date | null;
  googleAdContent?: GoogleAdContent | null;
  googleAdId?: string | null;
}

/** Shop-controlled landing-page magnet overrides. All optional — anything unset falls back to the
 *  auto-composed default (offer headline, FixFlow CTA, rating shown, no urgency, no Call-now). */
export interface LandingConfig {
  headline?: string;
  subhead?: string;
  urgencyText?: string;
  benefitBullets?: string[];
  ctaLabel?: string;
  showRating?: boolean;
  callNowEnabled?: boolean;
}

export interface MetaObjectIds {
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  metaAdId?: string | null;
  metaCreativeId?: string | null;
  metaLeadFormId?: string | null;
  metaStatus?: string | null;
  metaLastSyncedAt?: Date | null;
  /** When config was last reconciled FROM Meta (two-way sync) — distinct from metaLastSyncedAt (insights). */
  metaSyncedConfigAt?: Date | null;
  /** Raw Meta targeting spec (Phase 3 fidelity); stored as JSONB. */
  metaTargetingRaw?: any | null;
}

export interface CreateCampaignInput {
  shopId: string;
  industryId?: number | null;
  name: string;
  platform?: string;
  targetRadiusMiles?: number | null;
  targetUnits?: 'mi' | 'km';
  dailyBudgetCents?: number;
  aiAgentEnabled?: boolean;
  notes?: string | null;
  createdBy?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  industryId?: number | null;
  targetRadiusMiles?: number | null;
  targetUnits?: 'mi' | 'km';
  dailyBudgetCents?: number;
  status?: AdCampaign['status'];
  objective?: string | null;
  allowMetaEnhancements?: boolean;
  isTestBudget?: boolean;
  fullDailyBudgetCents?: number | null;
  testBudgetStartedAt?: Date | null;
  testBudgetUpgradeReady?: boolean;
  aiAgentEnabled?: boolean;
  notes?: string | null;
}

export interface ListCampaignsFilter {
  shopId?: string;
  status?: AdCampaign['status'];
  page?: number;
  limit?: number;
}

export class CampaignRepository extends BaseRepository {
  async create(input: CreateCampaignInput): Promise<AdCampaign> {
    const res = await this.pool.query(
      `INSERT INTO ad_campaigns
         (shop_id, industry_id, name, platform, target_radius_miles, target_units,
          daily_budget_cents, ai_agent_enabled, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.shopId,
        input.industryId ?? null,
        input.name,
        input.platform ?? 'meta',
        input.targetRadiusMiles ?? null,
        input.targetUnits ?? 'mi',
        input.dailyBudgetCents ?? 0,
        input.aiAgentEnabled ?? false,
        input.notes ?? null,
        input.createdBy ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<AdCampaign | null> {
    const res = await this.pool.query(
      `SELECT c.*, sh.meta_currency AS currency
         FROM ad_campaigns c LEFT JOIN shops sh ON sh.shop_id = c.shop_id
        WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async list(filter: ListCampaignsFilter): Promise<{ items: AdCampaign[]; total: number }> {
    const where: string[] = ['c.deleted_at IS NULL'];
    const params: any[] = [];
    if (filter.shopId) { params.push(filter.shopId); where.push(`c.shop_id = $${params.length}`); }
    if (filter.status) { params.push(filter.status); where.push(`c.status = $${params.length}`); }
    const whereSql = where.join(' AND ');

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;
    const offset = this.getPaginationOffset(page, limit);

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM ad_campaigns c WHERE ${whereSql}`,
      params
    );
    const dataRes = await this.pool.query(
      `SELECT c.*, sh.meta_currency AS currency
         FROM ad_campaigns c LEFT JOIN shops sh ON sh.shop_id = c.shop_id
        WHERE ${whereSql}
        ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return { items: dataRes.rows.map((r) => this.mapRow(r)), total: countRes.rows[0].n };
  }

  async update(id: string, input: UpdateCampaignInput): Promise<AdCampaign | null> {
    const sets: string[] = [];
    const params: any[] = [];
    const col = (c: string, v: any) => { params.push(v); sets.push(`${c} = $${params.length}`); };
    if (input.name !== undefined) col('name', input.name);
    if (input.industryId !== undefined) col('industry_id', input.industryId);
    if (input.targetRadiusMiles !== undefined) col('target_radius_miles', input.targetRadiusMiles);
    if (input.targetUnits !== undefined) col('target_units', input.targetUnits);
    if (input.dailyBudgetCents !== undefined) col('daily_budget_cents', input.dailyBudgetCents);
    if (input.objective !== undefined) col('objective', input.objective);
    if (input.allowMetaEnhancements !== undefined) col('allow_meta_enhancements', input.allowMetaEnhancements);
    if (input.isTestBudget !== undefined) col('is_test_budget', input.isTestBudget);
    if (input.fullDailyBudgetCents !== undefined) col('full_daily_budget_cents', input.fullDailyBudgetCents);
    if (input.testBudgetStartedAt !== undefined) col('test_budget_started_at', input.testBudgetStartedAt);
    if (input.testBudgetUpgradeReady !== undefined) col('test_budget_upgrade_ready', input.testBudgetUpgradeReady);
    if (input.aiAgentEnabled !== undefined) col('ai_agent_enabled', input.aiAgentEnabled);
    if (input.notes !== undefined) col('notes', input.notes);
    // status transitions also stamp the matching timestamp
    if (input.status !== undefined) {
      col('status', input.status);
      if (input.status === 'active') sets.push(`started_at = COALESCE(started_at, now())`);
      if (input.status === 'paused') sets.push(`paused_at = now()`);
      if (input.status === 'archived') sets.push(`archived_at = now()`);
    }
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Phase 2 — persist the shop's landing-page magnet overrides (JSONB). Pass null to clear back
   *  to auto-composed defaults. */
  async setLandingConfig(id: string, config: LandingConfig | null): Promise<AdCampaign | null> {
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET landing_config = $2, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, config ? JSON.stringify(config) : null]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Safeguard 5 — set/clear the "swap the creative" nudge flag. */
  async setCreativeRefresh(id: string, needs: boolean, reason: string | null = null): Promise<void> {
    await this.pool.query(
      `UPDATE ad_campaigns SET needs_creative_refresh = $2, creative_refresh_reason = $3, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, needs, needs ? reason : null]
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** Active campaigns (id + shop_id) — the SafeguardEvaluator's nightly input. */
  async listActive(): Promise<Array<{ id: string; shopId: string }>> {
    const res = await this.pool.query(
      `SELECT id, shop_id FROM ad_campaigns WHERE status = 'active' AND deleted_at IS NULL`
    );
    return res.rows.map((r) => ({ id: r.id, shopId: r.shop_id }));
  }

  /** Count a shop's live (active) campaigns — the capacity unit (lifecycle §9.5). In
   *  Phase 3 this expands to also count in-flight requests (approved/building). */
  async countActiveByShop(shopId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT count(*)::int AS n FROM ad_campaigns WHERE shop_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [shopId]
    );
    return res.rows[0].n;
  }

  /** Persist Meta object ids / status after a push (Stage-4). Only sets provided fields. */
  async setMetaObjects(id: string, m: MetaObjectIds): Promise<AdCampaign | null> {
    const sets: string[] = [];
    const params: any[] = [];
    const col = (c: string, v: any) => { params.push(v); sets.push(`${c} = $${params.length}`); };
    if (m.metaCampaignId !== undefined) col('meta_campaign_id', m.metaCampaignId);
    if (m.metaAdSetId !== undefined) col('meta_adset_id', m.metaAdSetId);
    if (m.metaAdId !== undefined) col('meta_ad_id', m.metaAdId);
    if (m.metaCreativeId !== undefined) col('meta_creative_id', m.metaCreativeId);
    if (m.metaLeadFormId !== undefined) col('meta_lead_form_id', m.metaLeadFormId);
    if (m.metaStatus !== undefined) col('meta_status', m.metaStatus);
    if (m.metaLastSyncedAt !== undefined) col('meta_last_synced_at', m.metaLastSyncedAt);
    if (m.metaSyncedConfigAt !== undefined) col('meta_synced_config_at', m.metaSyncedConfigAt);
    // jsonb: stringify a JS object (node-pg would otherwise send "[object Object]"); null stays null.
    if (m.metaTargetingRaw !== undefined) col('meta_targeting_raw', m.metaTargetingRaw === null ? null : JSON.stringify(m.metaTargetingRaw));
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Persist Google object ids / status after a push (Slice 3). Only sets provided fields. */
  async setGoogleObjects(id: string, g: GoogleObjectIds): Promise<AdCampaign | null> {
    const sets: string[] = [];
    const params: any[] = [];
    const col = (c: string, v: any) => { params.push(v); sets.push(`${c} = $${params.length}`); };
    if (g.googleCampaignId !== undefined) col('google_campaign_id', g.googleCampaignId);
    if (g.googleAdGroupId !== undefined) col('google_ad_group_id', g.googleAdGroupId);
    if (g.googleBudgetId !== undefined) col('google_budget_id', g.googleBudgetId);
    if (g.googleStatus !== undefined) col('google_status', g.googleStatus);
    if (g.googleLastSyncedAt !== undefined) col('google_last_synced_at', g.googleLastSyncedAt);
    if (g.googleSyncedConfigAt !== undefined) col('google_synced_config_at', g.googleSyncedConfigAt);
    if (g.googleAdContent !== undefined) col('google_ad_content', g.googleAdContent ? JSON.stringify(g.googleAdContent) : null);
    if (g.googleAdId !== undefined) col('google_ad_id', g.googleAdId);
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Campaigns pushed to Meta (have a meta_campaign_id) — the nightly insights-sync set. */
  async listWithMetaCampaign(): Promise<Array<{ id: string; shopId: string; metaCampaignId: string }>> {
    const res = await this.pool.query(
      `SELECT id, shop_id, meta_campaign_id FROM ad_campaigns
        WHERE meta_campaign_id IS NOT NULL AND deleted_at IS NULL`
    );
    return res.rows.map((r) => ({ id: r.id, shopId: r.shop_id, metaCampaignId: r.meta_campaign_id }));
  }

  /** Campaigns pushed to Google (have a google_campaign_id) — the nightly insights-sync set. */
  async listWithGoogleCampaign(): Promise<Array<{ id: string; shopId: string; googleCampaignId: string }>> {
    const res = await this.pool.query(
      `SELECT id, shop_id, google_campaign_id FROM ad_campaigns
        WHERE google_campaign_id IS NOT NULL AND deleted_at IS NULL`
    );
    return res.rows.map((r) => ({ id: r.id, shopId: r.shop_id, googleCampaignId: r.google_campaign_id }));
  }

  /** Resolve our campaign from a Meta campaign id (webhook/insights attribution). */
  async findByMetaCampaignId(metaCampaignId: string): Promise<AdCampaign | null> {
    const res = await this.pool.query(
      `SELECT * FROM ad_campaigns WHERE meta_campaign_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [metaCampaignId]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Lightweight ownership check used by shop-scoped endpoints. */
  async getShopIdForCampaign(id: string): Promise<string | null> {
    try {
      const res = await this.pool.query(`SELECT shop_id FROM ad_campaigns WHERE id = $1`, [id]);
      return res.rows[0]?.shop_id ?? null;
    } catch (err) {
      logger.error('CampaignRepository.getShopIdForCampaign failed', err);
      return null;
    }
  }

  private mapRow(r: any): AdCampaign {
    return {
      id: r.id,
      shopId: r.shop_id,
      industryId: r.industry_id,
      name: r.name,
      platform: r.platform,
      targetRadiusMiles: r.target_radius_miles !== null ? Number(r.target_radius_miles) : null,
      targetUnits: r.target_units,
      dailyBudgetCents: r.daily_budget_cents,
      status: r.status,
      objective: r.objective ?? null,
      allowMetaEnhancements: r.allow_meta_enhancements === true,
      needsCreativeRefresh: r.needs_creative_refresh === true,
      creativeRefreshReason: r.creative_refresh_reason ?? null,
      isTestBudget: r.is_test_budget === true,
      fullDailyBudgetCents: r.full_daily_budget_cents != null ? Number(r.full_daily_budget_cents) : null,
      testBudgetStartedAt: r.test_budget_started_at ?? null,
      testBudgetUpgradeReady: r.test_budget_upgrade_ready === true,
      currency: r.currency ?? null,
      aiAgentEnabled: r.ai_agent_enabled,
      notes: r.notes,
      startedAt: r.started_at,
      pausedAt: r.paused_at,
      archivedAt: r.archived_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      metaCampaignId: r.meta_campaign_id ?? null,
      metaAdSetId: r.meta_adset_id ?? null,
      metaAdId: r.meta_ad_id ?? null,
      metaCreativeId: r.meta_creative_id ?? null,
      metaLeadFormId: r.meta_lead_form_id ?? null,
      metaStatus: r.meta_status ?? null,
      metaLastSyncedAt: r.meta_last_synced_at ?? null,
      metaSyncedConfigAt: r.meta_synced_config_at ?? null,
      metaTargetingRaw: r.meta_targeting_raw ?? null,
      googleCampaignId: r.google_campaign_id ?? null,
      googleAdGroupId: r.google_ad_group_id ?? null,
      googleBudgetId: r.google_budget_id ?? null,
      googleStatus: r.google_status ?? null,
      googleLastSyncedAt: r.google_last_synced_at ?? null,
      googleSyncedConfigAt: r.google_synced_config_at ?? null,
      googleAdContent: r.google_ad_content ?? null,
      googleAdId: r.google_ad_id ?? null,
      landingConfig: r.landing_config ?? null,
    };
  }
}
