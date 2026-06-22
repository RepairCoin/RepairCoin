// backend/src/domains/AdsDomain/repositories/EnrollmentRepository.ts
//
// Shop "Request ads" opt-in (ad_enrollment_requests). One row per shop; the shop
// upserts a pending request, the admin decides. Mirrors the groups join-request flow.

import { BaseRepository } from '../../../repositories/BaseRepository';
import { FlatTierName } from './BillingPlanRepository';

export type EnrollmentStatus = 'pending' | 'approved' | 'declined';
// 'more_bookings' + 'leads' are the v1 picker options. 'awareness'/'promote_service' are kept
// for legacy rows (dropped from the pickers) — see ads-v1-gaps-and-next-steps.md.
export type CampaignGoal = 'more_bookings' | 'leads' | 'awareness' | 'promote_service';

/** Optional campaign brief — what the shop wants advertised, so the admin builds the
 *  right campaign instead of guessing. All fields optional. */
export interface CampaignBrief {
  promoteServiceIds?: string[];
  monthlyBudgetCents?: number | null;
  offer?: string | null;
  targetRadiusMiles?: number | null;
  goal?: CampaignGoal | null;
}

export interface AdEnrollment {
  shopId: string;
  // Shops now request a flat TIER (starter/growth/business). Legacy rows may hold
  // a/b/c — tolerated by the DB CHECK; treated as Growth on approval.
  requestedPlan: FlatTierName;
  status: EnrollmentStatus;
  message: string | null;
  // Campaign brief (optional).
  promoteServiceIds: string[];
  monthlyBudgetCents: number | null;
  offer: string | null;
  targetRadiusMiles: number | null;
  goal: CampaignGoal | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  declineReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EnrollmentRepository extends BaseRepository {
  async getByShop(shopId: string): Promise<AdEnrollment | null> {
    const res = await this.pool.query(`SELECT * FROM ad_enrollment_requests WHERE shop_id = $1`, [shopId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Shop creates or updates its request (+ optional campaign brief). Re-requesting
   *  resets a declined request to pending; an already-approved shop is returned
   *  unchanged (no downgrade). */
  async request(
    shopId: string, requestedPlan: FlatTierName, message: string | null, brief: CampaignBrief = {}
  ): Promise<AdEnrollment> {
    const res = await this.pool.query(
      `INSERT INTO ad_enrollment_requests
         (shop_id, requested_plan, status, message,
          promote_service_ids, monthly_budget_cents, offer, target_radius_miles, goal)
       VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8)
       ON CONFLICT (shop_id) DO UPDATE SET
         requested_plan       = EXCLUDED.requested_plan,
         message              = EXCLUDED.message,
         promote_service_ids  = EXCLUDED.promote_service_ids,
         monthly_budget_cents = EXCLUDED.monthly_budget_cents,
         offer                = EXCLUDED.offer,
         target_radius_miles  = EXCLUDED.target_radius_miles,
         goal                 = EXCLUDED.goal,
         status               = CASE WHEN ad_enrollment_requests.status = 'approved'
                                     THEN 'approved' ELSE 'pending' END,
         decline_reason = NULL,
         updated_at     = now()
       RETURNING *`,
      [
        shopId, requestedPlan, message,
        brief.promoteServiceIds ?? [],
        brief.monthlyBudgetCents ?? null,
        brief.offer ?? null,
        brief.targetRadiusMiles ?? null,
        brief.goal ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async list(status?: EnrollmentStatus): Promise<AdEnrollment[]> {
    const res = status
      ? await this.pool.query(`SELECT * FROM ad_enrollment_requests WHERE status = $1 ORDER BY created_at ASC`, [status])
      : await this.pool.query(`SELECT * FROM ad_enrollment_requests ORDER BY created_at DESC`);
    return res.rows.map((r) => this.mapRow(r));
  }

  async decide(
    shopId: string, status: 'approved' | 'declined', decidedBy: string, declineReason?: string | null
  ): Promise<AdEnrollment | null> {
    const res = await this.pool.query(
      `UPDATE ad_enrollment_requests
         SET status = $1, decided_by = $2, decided_at = now(),
             decline_reason = $3, updated_at = now()
       WHERE shop_id = $4 RETURNING *`,
      [status, decidedBy, status === 'declined' ? declineReason ?? null : null, shopId]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  private mapRow(r: any): AdEnrollment {
    return {
      shopId: r.shop_id,
      requestedPlan: r.requested_plan,
      status: r.status,
      message: r.message,
      promoteServiceIds: r.promote_service_ids ?? [],
      monthlyBudgetCents: r.monthly_budget_cents ?? null,
      offer: r.offer ?? null,
      targetRadiusMiles: r.target_radius_miles ?? null,
      goal: r.goal ?? null,
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      declineReason: r.decline_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
