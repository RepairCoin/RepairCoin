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
}

export interface MetaObjectIds {
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  metaAdId?: string | null;
  metaCreativeId?: string | null;
  metaLeadFormId?: string | null;
  metaStatus?: string | null;
  metaLastSyncedAt?: Date | null;
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
      `SELECT * FROM ad_campaigns WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async list(filter: ListCampaignsFilter): Promise<{ items: AdCampaign[]; total: number }> {
    const where: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    if (filter.shopId) { params.push(filter.shopId); where.push(`shop_id = $${params.length}`); }
    if (filter.status) { params.push(filter.status); where.push(`status = $${params.length}`); }
    const whereSql = where.join(' AND ');

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;
    const offset = this.getPaginationOffset(page, limit);

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM ad_campaigns WHERE ${whereSql}`,
      params
    );
    const dataRes = await this.pool.query(
      `SELECT * FROM ad_campaigns WHERE ${whereSql}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
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
    };
  }
}
