// backend/src/domains/AdsDomain/repositories/PlanChangeRepository.ts
//
// Tier-change history + the scheduled-downgrade mechanism (lifecycle Phase 4).

import { BaseRepository } from '../../../repositories/BaseRepository';

export type PlanChangeKind = 'upgrade' | 'downgrade' | 'cancel';
export type PlanChangeStatus = 'applied' | 'scheduled' | 'cancelled';

export interface PlanChange {
  id: string;
  shopId: string;
  fromTier: string | null;
  toTier: string | null;
  kind: PlanChangeKind;
  status: PlanChangeStatus;
  effectiveAt: Date;
  proratedAmountCents: number;
  requestedBy: string | null;
  createdAt: Date;
}

export interface RecordChangeInput {
  shopId: string;
  fromTier: string | null;
  toTier: string | null;
  kind: PlanChangeKind;
  status: PlanChangeStatus;
  effectiveAt?: Date;            // defaults to now()
  proratedAmountCents?: number;
  requestedBy?: string | null;
}

export class PlanChangeRepository extends BaseRepository {
  async record(i: RecordChangeInput): Promise<PlanChange> {
    const res = await this.pool.query(
      `INSERT INTO ad_plan_changes
         (shop_id, from_tier, to_tier, kind, status, effective_at, prorated_amount_cents, requested_by)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6, now()), $7, $8) RETURNING *`,
      [i.shopId, i.fromTier, i.toTier, i.kind, i.status, i.effectiveAt ?? null, i.proratedAmountCents ?? 0, i.requestedBy ?? null]
    );
    return this.mapRow(res.rows[0]);
  }

  async listByShop(shopId: string, limit = 50): Promise<PlanChange[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_plan_changes WHERE shop_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [shopId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** Scheduled downgrades whose effective date has arrived (for the nightly job). */
  async listDueScheduled(asOf: Date): Promise<PlanChange[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_plan_changes WHERE status = 'scheduled' AND effective_at <= $1 ORDER BY effective_at ASC`,
      [asOf]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** §9.7 — a new tier change supersedes any pending scheduled change for the shop. */
  async cancelScheduledForShop(shopId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_plan_changes SET status = 'cancelled' WHERE shop_id = $1 AND status = 'scheduled'`,
      [shopId]
    );
  }

  async markApplied(id: string): Promise<void> {
    await this.pool.query(`UPDATE ad_plan_changes SET status = 'applied' WHERE id = $1`, [id]);
  }

  private mapRow(r: any): PlanChange {
    return {
      id: r.id,
      shopId: r.shop_id,
      fromTier: r.from_tier ?? null,
      toTier: r.to_tier ?? null,
      kind: r.kind,
      status: r.status,
      effectiveAt: r.effective_at,
      proratedAmountCents: r.prorated_amount_cents ?? 0,
      requestedBy: r.requested_by ?? null,
      createdAt: r.created_at,
    };
  }
}
