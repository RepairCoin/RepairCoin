import { BaseRepository, PaginatedResult } from './BaseRepository';

export type PaymentMethod = 'card' | 'cash' | 'ach' | 'deposit' | 'terminal' | 'link';
export type PaymentSource =
  | 'booking'
  | 'invoice'
  | 'terminal'
  | 'link'
  | 'rcn_purchase'
  | 'deposit';
export type PaymentStatus =
  | 'requires_payment'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Payment {
  id: string;
  shopId: string;
  customerAddress: string | null;
  orderId: string | null;
  invoiceId: string | null;
  method: PaymentMethod;
  source: PaymentSource;
  grossCents: number;
  feeCents: number;
  applicationFeeCents: number;
  netCents: number;
  refundedCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeAccountId: string | null;
  capturedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Fields the webhook reconciler upserts, keyed by the Stripe PaymentIntent id. */
export interface UpsertPaymentInput {
  shopId: string;
  stripePaymentIntentId: string;
  method: PaymentMethod;
  source: PaymentSource;
  grossCents: number;
  status: PaymentStatus;
  currency?: string;
  feeCents?: number;
  applicationFeeCents?: number;
  netCents?: number;
  customerAddress?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  stripeChargeId?: string | null;
  stripeAccountId?: string | null;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListPaymentsFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerAddress?: string;
}

/**
 * The unified FIAT payments ledger (Payments & Invoicing Center, Phase 0). One row per money
 * movement, reconciled from Stripe webhooks. Money is in INTEGER CENTS. This is the fiat
 * counterpart to `TransactionRepository`, which is the RCN token ledger — keep them separate.
 */
export class PaymentRepository extends BaseRepository {
  private mapRow(row: any): Payment {
    return {
      id: row.id,
      shopId: row.shop_id,
      customerAddress: row.customer_address,
      orderId: row.order_id,
      invoiceId: row.invoice_id,
      method: row.method,
      source: row.source,
      grossCents: Number(row.gross_cents),
      feeCents: Number(row.fee_cents),
      applicationFeeCents: Number(row.application_fee_cents),
      netCents: Number(row.net_cents),
      refundedCents: Number(row.refunded_cents),
      currency: row.currency,
      status: row.status,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeChargeId: row.stripe_charge_id,
      stripeAccountId: row.stripe_account_id,
      capturedAt: row.captured_at,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Reconcile primitive: create the payment row for a PaymentIntent, or update the mutable
   * fields if it already exists. Idempotent via the partial unique index on
   * stripe_payment_intent_id, so a re-delivered/duplicated webhook can't create a second row.
   * Does NOT touch refunded_cents (owned by markRefunded) or the immutable insert fields.
   */
  async upsertByPaymentIntent(input: UpsertPaymentInput): Promise<Payment> {
    const result = await this.pool.query(
      `INSERT INTO payments (
         shop_id, customer_address, order_id, invoice_id, method, source,
         gross_cents, fee_cents, application_fee_cents, net_cents,
         currency, status, stripe_payment_intent_id, stripe_charge_id, stripe_account_id,
         captured_at, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
       DO UPDATE SET
         status                = EXCLUDED.status,
         fee_cents             = EXCLUDED.fee_cents,
         application_fee_cents  = EXCLUDED.application_fee_cents,
         net_cents             = EXCLUDED.net_cents,
         stripe_charge_id      = COALESCE(EXCLUDED.stripe_charge_id, payments.stripe_charge_id),
         stripe_account_id     = COALESCE(EXCLUDED.stripe_account_id, payments.stripe_account_id),
         captured_at           = COALESCE(EXCLUDED.captured_at, payments.captured_at),
         metadata              = payments.metadata || EXCLUDED.metadata,
         updated_at            = now()
       RETURNING *`,
      [
        input.shopId,
        input.customerAddress ?? null,
        input.orderId ?? null,
        input.invoiceId ?? null,
        input.method,
        input.source,
        input.grossCents,
        input.feeCents ?? 0,
        input.applicationFeeCents ?? 0,
        input.netCents ?? 0,
        input.currency ?? 'usd',
        input.status,
        input.stripePaymentIntentId,
        input.stripeChargeId ?? null,
        input.stripeAccountId ?? null,
        input.capturedAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async getByPaymentIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Record a (partial or full) refund total against a payment and set its status. */
  async markRefunded(id: string, refundedCents: number, status: PaymentStatus): Promise<Payment | null> {
    const result = await this.pool.query(
      `UPDATE payments
          SET refunded_cents = $2, status = $3, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, refundedCents, status]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Paginated list for a shop (the Transactions screen; filters expand in Phase 1). */
  async listByShop(
    shopId: string,
    filters: ListPaymentsFilters = {},
    page = 1,
    limit = 25
  ): Promise<PaginatedResult<Payment>> {
    const where: string[] = ['shop_id = $1'];
    const params: unknown[] = [shopId];

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    if (filters.method) {
      params.push(filters.method);
      where.push(`method = $${params.length}`);
    }
    if (filters.customerAddress) {
      params.push(filters.customerAddress.toLowerCase());
      where.push(`customer_address = $${params.length}`);
    }

    const whereSql = where.join(' AND ');
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM payments WHERE ${whereSql}`,
      params
    );
    const totalItems = countResult.rows[0].n as number;

    const offset = this.getPaginationOffset(page, limit);
    const rowsResult = await this.pool.query(
      `SELECT * FROM payments WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    return {
      items: rowsResult.rows.map((r) => this.mapRow(r)),
      pagination: { page, limit, totalItems, totalPages, hasMore: page < totalPages },
    };
  }
}
