// backend/src/domains/AdsDomain/repositories/EnrollmentRepository.ts
//
// Shop "Request ads" opt-in (ad_enrollment_requests). One row per shop; the shop
// upserts a pending request, the admin decides. Mirrors the groups join-request flow.

import { BaseRepository } from '../../../repositories/BaseRepository';
import { AdPlanType } from './BillingPlanRepository';

export type EnrollmentStatus = 'pending' | 'approved' | 'declined';

export interface AdEnrollment {
  shopId: string;
  requestedPlan: AdPlanType;
  status: EnrollmentStatus;
  message: string | null;
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

  /** Shop creates or updates its request. Re-requesting resets a declined request to
   *  pending; an already-approved shop is returned unchanged (no downgrade). */
  async request(shopId: string, requestedPlan: AdPlanType, message: string | null): Promise<AdEnrollment> {
    const res = await this.pool.query(
      `INSERT INTO ad_enrollment_requests (shop_id, requested_plan, status, message)
       VALUES ($1,$2,'pending',$3)
       ON CONFLICT (shop_id) DO UPDATE SET
         requested_plan = EXCLUDED.requested_plan,
         message        = EXCLUDED.message,
         status         = CASE WHEN ad_enrollment_requests.status = 'approved'
                               THEN 'approved' ELSE 'pending' END,
         decline_reason = NULL,
         updated_at     = now()
       RETURNING *`,
      [shopId, requestedPlan, message]
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
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      declineReason: r.decline_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
