import { BaseRepository } from './BaseRepository';

export type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';
export type RefundStatus = 'pending' | 'succeeded' | 'failed';
/** Who issued it. `created_by` is a wallet address and can't distinguish the two (Slice A2). */
export type RefundActor = 'shop' | 'admin';

export interface Refund {
  id: string;
  paymentId: string;
  shopId: string;
  amountCents: number;
  currency: string;
  reason: RefundReason;
  note: string | null;
  status: RefundStatus;
  stripeRefundId: string | null;
  createdBy: string | null;
  createdByRole: RefundActor;
  createdAt: string;
  updatedAt: string;
}

/**
 * Refunds issued FROM FixFlow (Payments Center, Slice 1.3). Records who refunded and why —
 * context Stripe has no concept of.
 *
 * Deliberately NOT the source of truth for how much a payment has been refunded: that stays
 * on `payments.refunded_cents`, owned by the webhook reconciler, because a refund issued from
 * the Stripe dashboard would never produce a row here.
 */
export class RefundRepository extends BaseRepository {
  private mapRow(row: any): Refund {
    return {
      id: row.id,
      paymentId: row.payment_id,
      shopId: row.shop_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      reason: row.reason,
      note: row.note,
      status: row.status,
      stripeRefundId: row.stripe_refund_id,
      createdBy: row.created_by,
      createdByRole: (row.created_by_role ?? 'shop') as RefundActor,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Record the intent to refund BEFORE calling Stripe, so a refund that succeeds at Stripe but
   * fails on the way back still leaves a trace to reconcile against, rather than vanishing.
   */
  async createPending(input: {
    paymentId: string;
    shopId: string;
    amountCents: number;
    currency?: string;
    reason: RefundReason;
    note?: string | null;
    createdBy?: string | null;
    createdByRole?: RefundActor;
  }): Promise<Refund> {
    const result = await this.pool.query(
      `INSERT INTO refunds (payment_id, shop_id, amount_cents, currency, reason, note, status, created_by, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
       RETURNING *`,
      [
        input.paymentId,
        input.shopId,
        input.amountCents,
        input.currency ?? 'usd',
        input.reason,
        input.note ?? null,
        input.createdBy ?? null,
        input.createdByRole ?? 'shop',
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async markSucceeded(id: string, stripeRefundId: string): Promise<Refund | null> {
    const result = await this.pool.query(
      `UPDATE refunds SET status = 'succeeded', stripe_refund_id = $2, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, stripeRefundId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markFailed(id: string, note?: string): Promise<void> {
    await this.pool.query(
      `UPDATE refunds
          SET status = 'failed',
              note = COALESCE($2, note),
              updated_at = now()
        WHERE id = $1`,
      [id, note ?? null]
    );
  }

  /** Refund history for one payment — powers the detail drawer. */
  async listByPayment(paymentId: string): Promise<Refund[]> {
    const result = await this.pool.query(
      `SELECT * FROM refunds WHERE payment_id = $1 ORDER BY created_at DESC`,
      [paymentId]
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  /**
   * Match one Stripe refund back onto this side's row, driven by charge.refunded.
   *
   * Closes the window where the Stripe call succeeded but the response never reached the
   * controller: the row would sit `pending` forever, and pending amounts count against the
   * refundable balance, so that money would be locked out of future refunds.
   *
   * Refunds issued from the Stripe dashboard match nothing here and are deliberately left
   * alone — `payments.refunded_cents` already accounts for them.
   */
  async reconcileStripeRefund(input: {
    paymentId: string;
    stripeRefundId: string;
    amountCents: number;
    fixflowRefundId?: string | null;
  }): Promise<Refund | null> {
    // Already linked: settle it if it never heard back, otherwise there's nothing to do.
    const linked = await this.pool.query(
      `UPDATE refunds SET status = 'succeeded', updated_at = now()
        WHERE stripe_refund_id = $1 AND status <> 'succeeded' RETURNING *`,
      [input.stripeRefundId]
    );
    if (linked.rows[0]) return this.mapRow(linked.rows[0]);

    const known = await this.pool.query(`SELECT 1 FROM refunds WHERE stripe_refund_id = $1`, [
      input.stripeRefundId,
    ]);
    if (known.rowCount) return null;

    // Exact match via the id we sent as Stripe metadata. Safe even for a row already marked
    // failed — a timeout on the response can fail the request after Stripe created the refund.
    if (input.fixflowRefundId) {
      const claimed = await this.pool.query(
        `UPDATE refunds SET status = 'succeeded', stripe_refund_id = $2, updated_at = now()
          WHERE id = $1 AND payment_id = $3 AND stripe_refund_id IS NULL RETURNING *`,
        [input.fixflowRefundId, input.stripeRefundId, input.paymentId]
      );
      if (claimed.rows[0]) return this.mapRow(claimed.rows[0]);
    }

    // No metadata (a refund predating it): fall back to the oldest pending row of the same
    // amount. Restricted to `pending` on purpose — claiming a failed row on amount alone
    // could misattribute a dashboard refund to whoever's attempt happened to fail.
    const matched = await this.pool.query(
      `UPDATE refunds SET status = 'succeeded', stripe_refund_id = $2, updated_at = now()
        WHERE id = (
          SELECT id FROM refunds
           WHERE payment_id = $1 AND status = 'pending'
             AND stripe_refund_id IS NULL AND amount_cents = $3
           ORDER BY created_at LIMIT 1
        ) RETURNING *`,
      [input.paymentId, input.stripeRefundId, input.amountCents]
    );
    return matched.rows[0] ? this.mapRow(matched.rows[0]) : null;
  }

  /**
   * Total already requested against a payment, excluding failures. Used to stop a shop
   * refunding more than the charge — Stripe would reject it, but failing before the API call
   * gives a clearer error and avoids a stray pending row.
   */
  async sumRequestedCents(paymentId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS n
         FROM refunds WHERE payment_id = $1 AND status <> 'failed'`,
      [paymentId]
    );
    return result.rows[0].n as number;
  }
}
