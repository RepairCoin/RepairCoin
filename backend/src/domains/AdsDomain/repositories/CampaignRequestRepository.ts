// backend/src/domains/AdsDomain/repositories/CampaignRequestRepository.ts
//
// Recurring campaign requests (lifecycle Phase 3). A shop submits a request (brief);
// the admin reviews and builds it into a real campaign. Capacity is checked against the
// tier limit (§9.5): committed = approved + building requests + live campaigns.

import { BaseRepository } from '../../../repositories/BaseRepository';
import { CampaignBrief, CampaignGoal } from './EnrollmentRepository';

export type CampaignRequestStatus = 'pending' | 'approved' | 'building' | 'live' | 'declined' | 'cancelled';

export interface AdCampaignRequest {
  id: string;
  shopId: string;
  promoteServiceIds: string[];
  monthlyBudgetCents: number | null;
  offer: string | null;
  targetRadiusMiles: number | null;
  goal: CampaignGoal | null;
  message: string | null;
  status: CampaignRequestStatus;
  campaignId: string | null;
  declineReason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export class CampaignRequestRepository extends BaseRepository {
  async create(shopId: string, brief: CampaignBrief, message: string | null): Promise<AdCampaignRequest> {
    const res = await this.pool.query(
      `INSERT INTO ad_campaign_requests
         (shop_id, promote_service_ids, monthly_budget_cents, offer, target_radius_miles, goal, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        shopId,
        brief.promoteServiceIds ?? [],
        brief.monthlyBudgetCents ?? null,
        brief.offer ?? null,
        brief.targetRadiusMiles ?? null,
        brief.goal ?? null,
        message,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<AdCampaignRequest | null> {
    const res = await this.pool.query(`SELECT * FROM ad_campaign_requests WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async listByShop(shopId: string, limit = 50): Promise<AdCampaignRequest[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_campaign_requests WHERE shop_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [shopId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** Admin queue — optionally filtered by status (default: open = pending/approved/building). */
  async list(status?: CampaignRequestStatus): Promise<AdCampaignRequest[]> {
    const res = status
      ? await this.pool.query(`SELECT * FROM ad_campaign_requests WHERE status = $1 ORDER BY created_at ASC`, [status])
      : await this.pool.query(
          `SELECT * FROM ad_campaign_requests WHERE status IN ('pending','approved','building') ORDER BY created_at ASC`
        );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** §9.5 — requests that occupy a capacity slot but aren't live yet (approved + building). */
  async countCommitted(shopId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT count(*)::int AS n FROM ad_campaign_requests WHERE shop_id = $1 AND status IN ('approved','building')`,
      [shopId]
    );
    return res.rows[0].n;
  }

  async setStatus(
    id: string, status: CampaignRequestStatus, opts: { campaignId?: string; declineReason?: string; decidedBy?: string } = {}
  ): Promise<AdCampaignRequest | null> {
    const res = await this.pool.query(
      `UPDATE ad_campaign_requests
         SET status = $1,
             campaign_id = COALESCE($2, campaign_id),
             decline_reason = $3,
             decided_by = COALESCE($4, decided_by),
             decided_at = CASE WHEN $1 IN ('approved','declined') THEN now() ELSE decided_at END,
             updated_at = now()
       WHERE id = $5 RETURNING *`,
      [status, opts.campaignId ?? null, status === 'declined' ? opts.declineReason ?? null : null, opts.decidedBy ?? null, id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** The request that was built into a given campaign (Phase 5 — go-live / draft edits). */
  async findByCampaignId(campaignId: string): Promise<AdCampaignRequest | null> {
    const res = await this.pool.query(`SELECT * FROM ad_campaign_requests WHERE campaign_id = $1 LIMIT 1`, [campaignId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Flip a built request building → live when its campaign goes live (Phase 5). */
  async setLiveByCampaign(campaignId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_campaign_requests SET status = 'live', updated_at = now()
        WHERE campaign_id = $1 AND status <> 'live'`,
      [campaignId]
    );
  }

  private mapRow(r: any): AdCampaignRequest {
    return {
      id: r.id,
      shopId: r.shop_id,
      promoteServiceIds: r.promote_service_ids ?? [],
      monthlyBudgetCents: r.monthly_budget_cents ?? null,
      offer: r.offer ?? null,
      targetRadiusMiles: r.target_radius_miles ?? null,
      goal: r.goal ?? null,
      message: r.message ?? null,
      status: r.status,
      campaignId: r.campaign_id ?? null,
      declineReason: r.decline_reason ?? null,
      decidedBy: r.decided_by ?? null,
      decidedAt: r.decided_at ?? null,
      createdAt: r.created_at,
    };
  }
}
