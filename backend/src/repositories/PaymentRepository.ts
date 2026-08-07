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
  posSaleId: string | null;
  posSalePaymentId: string | null;
  locationId: string | null;
  /** Sales tax contained WITHIN grossCents, not added to it. Revenue is gross - tax - refunded. */
  taxCents: number;
  capturedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * One tender of a counter sale, written by the POS rather than inferred from Stripe. Cash never
 * produces a Stripe object, so a ledger derived only from webhooks cannot see it at all.
 *
 * Fiat tenders only. RCN and gift cards are settled here but are not money the shop received —
 * see the note on `PosSaleService.writeToLedger`.
 */
export interface RecordPosTenderInput {
  shopId: string;
  posSaleId: string;
  posSalePaymentId: string;
  method: PaymentMethod;
  grossCents: number;
  /** This tender's apportioned share of the sale's tax, already included in grossCents. */
  taxCents?: number;
  applicationFeeCents?: number;
  netCents?: number;
  currency?: string;
  customerAddress?: string | null;
  locationId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeAccountId?: string | null;
  capturedAt?: string | null;
}

/**
 * A booking settled outside Stripe — cash at the counter, bank transfer, an existing arrangement.
 * There is no Stripe object for the reconciler to derive a row from, so the ledger row has to be
 * written directly or the money is invisible to everything that reads `payments` (POS S9b).
 */
export interface RecordManualOrderPaymentInput {
  shopId: string;
  orderId: string;
  grossCents: number;
  method?: PaymentMethod;
  currency?: string;
  customerAddress?: string | null;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
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
  /** Inclusive lower bound on created_at (ISO date or timestamp). */
  startDate?: string;
  /** Inclusive upper bound on created_at (ISO date or timestamp). */
  endDate?: string;
  /**
   * Admin reads only. The shop-facing path scopes by the JWT's shopId, which is passed
   * separately and always wins — a shop can never widen its own scope through a filter.
   */
  shopId?: string;
}

/** Platform-wide roll-up over the same filter set. Admin oversight (Slice A1). */
export interface PaymentTotals {
  count: number;
  grossCents: number;
  feeCents: number;
  applicationFeeCents: number;
  netCents: number;
  refundedCents: number;
}

/**
 * A payment plus the context that makes it readable on the Transactions screen. The ledger
 * itself stores only money + Stripe ids; the service name and customer name are joined in
 * from the linked order. All context fields are null for payments whose `order_id` never
 * linked (see the Slice 1.1 note on pre-fix checkout charges).
 */
export interface PaymentWithContext extends Payment {
  serviceName: string | null;
  customerName: string | null;
  orderStatus: string | null;
  completedByMemberId: string | null;
  /** Only meaningful on admin reads; a shop already knows whose rows these are. */
  shopName: string | null;
  /**
   * A counter sale is multi-line by definition, so there is no single service to name it by —
   * the receipt number and a line count are what identify it on screen.
   */
  posSaleNumber: number | null;
  posItemCount: number | null;
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
      posSaleId: row.pos_sale_id ?? null,
      posSalePaymentId: row.pos_sale_payment_id ?? null,
      locationId: row.location_id ?? null,
      taxCents: Number(row.tax_cents ?? 0),
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
      // location_id is resolved from the order rather than passed in: the reconciler only ever
      // sees a charge, and every caller would otherwise have to look the booking up to tell the
      // ledger which branch took the money (S9c-1).
      `INSERT INTO payments (
         shop_id, customer_address, order_id, invoice_id, method, source,
         gross_cents, fee_cents, application_fee_cents, net_cents,
         currency, status, stripe_payment_intent_id, stripe_charge_id, stripe_account_id,
         captured_at, metadata, location_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               (SELECT location_id FROM service_orders WHERE order_id = $3))
       ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
       DO UPDATE SET
         status                = EXCLUDED.status,
         fee_cents             = EXCLUDED.fee_cents,
         application_fee_cents  = EXCLUDED.application_fee_cents,
         net_cents             = EXCLUDED.net_cents,
         stripe_charge_id      = COALESCE(EXCLUDED.stripe_charge_id, payments.stripe_charge_id),
         stripe_account_id     = COALESCE(EXCLUDED.stripe_account_id, payments.stripe_account_id),
         location_id           = COALESCE(payments.location_id, EXCLUDED.location_id),
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

  /**
   * Write one ledger row for one tender of a counter sale.
   *
   * The conflict target differs by tender because the two legs are protected by different unique
   * indexes, and a single statement can only name one. A card leg keys on the PaymentIntent so it
   * meets whatever the webhook wrote, in either order; a cash leg keys on the tender itself,
   * because it has no Stripe object and nothing else about it is unique.
   *
   * On a card leg the update deliberately leaves gross, fees, net and status alone: the webhook
   * derives those from the balance transaction and is authoritative. This only attaches the sale
   * and corrects the source, so completing a sale after the webhook has landed cannot zero out
   * fees the reconciler already resolved.
   */
  async recordPosTender(input: RecordPosTenderInput): Promise<Payment> {
    const columns = `
      shop_id, customer_address, method, source, gross_cents, fee_cents,
      application_fee_cents, net_cents, currency, status,
      stripe_payment_intent_id, stripe_account_id, pos_sale_id, pos_sale_payment_id, captured_at,
      location_id, tax_cents`;
    const values = [
      input.shopId,
      input.customerAddress ?? null,
      input.method,
      'terminal',
      input.grossCents,
      0,
      input.applicationFeeCents ?? 0,
      input.netCents ?? 0,
      input.currency ?? 'usd',
      'succeeded',
      input.stripePaymentIntentId ?? null,
      input.stripeAccountId ?? null,
      input.posSaleId,
      input.posSalePaymentId,
      input.capturedAt ?? new Date().toISOString(),
      input.locationId ?? null,
      input.taxCents ?? 0,
    ];

    // On a card leg the webhook may have written the row first, knowing nothing about the sale —
    // so location and tax are set here even on conflict. They are facts about the sale, not about
    // the charge, and the reconciler can never supply them.
    const conflict = input.stripePaymentIntentId
      ? `(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
         DO UPDATE SET
           pos_sale_id         = EXCLUDED.pos_sale_id,
           pos_sale_payment_id = EXCLUDED.pos_sale_payment_id,
           customer_address    = COALESCE(payments.customer_address, EXCLUDED.customer_address),
           location_id         = COALESCE(EXCLUDED.location_id, payments.location_id),
           tax_cents           = EXCLUDED.tax_cents,
           source              = EXCLUDED.source,
           updated_at          = now()`
      : `(pos_sale_payment_id) WHERE pos_sale_payment_id IS NOT NULL
         DO UPDATE SET updated_at = now()`;

    const result = await this.pool.query(
      `INSERT INTO payments (${columns})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT ${conflict}
       RETURNING *`,
      values
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Write the ledger row for a booking that was settled outside Stripe.
   *
   * Cash cannot carry a platform commission — there is no charge to attach an application fee to,
   * the same structural limit POS cash tender has — so the fee is 0 and the shop nets the gross.
   *
   * Keyed on `order_id` via uq_payments_manual_order (263). DO NOTHING rather than DO UPDATE: the
   * first row recorded when the shop said the money arrived is the truthful one, and a re-run of
   * the backfill must not overwrite it with a re-derived guess. Returns the existing row in that
   * case, so callers cannot tell a retry from a first write.
   */
  async recordManualOrderPayment(input: RecordManualOrderPaymentInput): Promise<Payment> {
    const values = [
      input.shopId,
      input.customerAddress ?? null,
      input.orderId,
      input.method ?? 'cash',
      'booking',
      input.grossCents,
      input.grossCents,
      input.currency ?? 'usd',
      input.capturedAt ?? new Date().toISOString(),
      JSON.stringify({ settledOutsideStripe: true, ...(input.metadata ?? {}) }),
    ];

    const result = await this.pool.query(
      `INSERT INTO payments (
         shop_id, customer_address, order_id, method, source,
         gross_cents, fee_cents, application_fee_cents, net_cents,
         currency, status, captured_at, metadata, location_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,'succeeded',$9,$10,
               (SELECT location_id FROM service_orders WHERE order_id = $3))
       ON CONFLICT (order_id) WHERE order_id IS NOT NULL AND stripe_payment_intent_id IS NULL
       DO NOTHING
       RETURNING *`,
      values
    );

    if (result.rows[0]) return this.mapRow(result.rows[0]);

    const existing = await this.pool.query(
      `SELECT * FROM payments
       WHERE order_id = $1 AND stripe_payment_intent_id IS NULL
       LIMIT 1`,
      [input.orderId]
    );
    return this.mapRow(existing.rows[0]);
  }

  async getByPaymentIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE stripe_payment_intent_id = $1`,
      [stripePaymentIntentId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * The ledger row written for one tender of a counter sale, which is what a POS refund has to
   * act on. Goes through `pos_sale_payment_id` rather than the tender's own `payment_id` column:
   * that column exists on `pos_sale_payments` but has never been written, while this one is set
   * by `recordPosTender` on both legs and is the cash leg's idempotency key.
   */
  async getByPosSalePayment(posSalePaymentId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE pos_sale_payment_id = $1`,
      [posSalePaymentId]
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

  private mapContextRow(row: any): PaymentWithContext {
    return {
      ...this.mapRow(row),
      serviceName: row.service_name ?? null,
      customerName: row.customer_name ?? null,
      orderStatus: row.order_status ?? null,
      completedByMemberId: row.completed_by_member_id ?? null,
      shopName: row.shop_name ?? null,
      posSaleNumber: row.pos_sale_number === null || row.pos_sale_number === undefined
        ? null
        : Number(row.pos_sale_number),
      posItemCount: row.pos_item_count === null || row.pos_item_count === undefined
        ? null
        : Number(row.pos_item_count),
    };
  }

  /** Shared FROM + joins so list, detail, and export all read identically. */
  private readonly contextFrom = `
    FROM payments p
    LEFT JOIN service_orders o ON o.order_id = p.order_id
    LEFT JOIN shop_services  s ON s.service_id = o.service_id
    LEFT JOIN customers      c ON c.address = p.customer_address
    LEFT JOIN shops          sh ON sh.shop_id = p.shop_id
    LEFT JOIN pos_sales      ps ON ps.id = p.pos_sale_id`;

  private readonly contextSelect = `
      p.*,
      s.service_name        AS service_name,
      c.name                AS customer_name,
      o.status              AS order_status,
      o.completed_by_member_id AS completed_by_member_id,
      sh.name               AS shop_name,
      ps.sale_number        AS pos_sale_number,
      (SELECT COUNT(*) FROM pos_sale_items psi WHERE psi.sale_id = ps.id) AS pos_item_count`;

  /**
   * Build the WHERE clause shared by list/count/export.
   *
   * `shopScope` is the authoritative scope: the shop-facing controllers pass the JWT's shopId
   * and it is applied unconditionally. Only admin reads pass null, and only then can
   * `filters.shopId` narrow the query — so a shop-scoped caller can never widen its own scope
   * by smuggling a shopId through the query string.
   */
  private buildFilters(shopScope: string | null, filters: ListPaymentsFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (shopScope) {
      params.push(shopScope);
      where.push(`p.shop_id = $${params.length}`);
    } else if (filters.shopId) {
      params.push(filters.shopId);
      where.push(`p.shop_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`p.status = $${params.length}`);
    }
    if (filters.method) {
      params.push(filters.method);
      where.push(`p.method = $${params.length}`);
    }
    if (filters.customerAddress) {
      params.push(filters.customerAddress.toLowerCase());
      where.push(`p.customer_address = $${params.length}`);
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      where.push(`p.created_at >= $${params.length}`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      where.push(`p.created_at <= $${params.length}`);
    }

    // An unfiltered admin read has no predicates at all; TRUE keeps the callers' `WHERE ${...}`
    // interpolation valid without special-casing it in four places.
    return { whereSql: where.length ? where.join(' AND ') : 'TRUE', params };
  }

  /** Paginated list for a shop — the Transactions screen. */
  async listByShop(
    shopId: string,
    filters: ListPaymentsFilters = {},
    page = 1,
    limit = 25
  ): Promise<PaginatedResult<PaymentWithContext>> {
    return this.list(shopId, filters, page, limit);
  }

  /**
   * Platform-wide paginated list — admin oversight (Slice A1). Same query as the shop path
   * with the scope predicate dropped; `filters.shopId` narrows it to one shop.
   */
  async listAll(
    filters: ListPaymentsFilters = {},
    page = 1,
    limit = 25
  ): Promise<PaginatedResult<PaymentWithContext>> {
    return this.list(null, filters, page, limit);
  }

  private async list(
    shopScope: string | null,
    filters: ListPaymentsFilters,
    page: number,
    limit: number
  ): Promise<PaginatedResult<PaymentWithContext>> {
    const { whereSql, params } = this.buildFilters(shopScope, filters);

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM payments p WHERE ${whereSql}`,
      params
    );
    const totalItems = countResult.rows[0].n as number;

    const offset = this.getPaginationOffset(page, limit);
    const rowsResult = await this.pool.query(
      `SELECT ${this.contextSelect} ${this.contextFrom}
        WHERE ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    return {
      items: rowsResult.rows.map((r) => this.mapContextRow(r)),
      pagination: { page, limit, totalItems, totalPages, hasMore: page < totalPages },
    };
  }

  /**
   * Every matching row, unpaginated, for CSV export. Capped so a shop with a huge history
   * can't exhaust memory or hold a connection open indefinitely.
   */
  async listAllForExport(
    shopId: string | null,
    filters: ListPaymentsFilters = {},
    cap = 10000
  ): Promise<PaymentWithContext[]> {
    const { whereSql, params } = this.buildFilters(shopId, filters);
    const result = await this.pool.query(
      `SELECT ${this.contextSelect} ${this.contextFrom}
        WHERE ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1}`,
      [...params, cap]
    );
    return result.rows.map((r) => this.mapContextRow(r));
  }

  /** Single payment with context, scoped to the shop so one shop can't read another's. */
  async getByIdForShop(shopId: string, id: string): Promise<PaymentWithContext | null> {
    const result = await this.pool.query(
      `SELECT ${this.contextSelect} ${this.contextFrom}
        WHERE p.id = $1 AND p.shop_id = $2`,
      [id, shopId]
    );
    return result.rows[0] ? this.mapContextRow(result.rows[0]) : null;
  }

  /** Unscoped single read — admin only, never reachable from a shop-authenticated route. */
  async getByIdAdmin(id: string): Promise<PaymentWithContext | null> {
    const result = await this.pool.query(
      `SELECT ${this.contextSelect} ${this.contextFrom} WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapContextRow(result.rows[0]) : null;
  }

  /**
   * Roll-up over the same filters as the list. `application_fee_cents` is the platform's own
   * revenue from payments, which nothing else surfaces.
   *
   * Note the totals are gross of refunds — `refundedCents` is reported alongside rather than
   * subtracted, because the ledger's `gross_cents` is what was charged and netting the two
   * would quietly produce a third number that reconciles against neither Stripe nor the rows
   * on screen.
   */
  async getTotals(filters: ListPaymentsFilters = {}): Promise<PaymentTotals> {
    const { whereSql, params } = this.buildFilters(null, filters);
    const result = await this.pool.query(
      `SELECT COUNT(*)::int                          AS count,
              COALESCE(SUM(p.gross_cents), 0)::bigint           AS gross_cents,
              COALESCE(SUM(p.fee_cents), 0)::bigint             AS fee_cents,
              COALESCE(SUM(p.application_fee_cents), 0)::bigint AS application_fee_cents,
              COALESCE(SUM(p.net_cents), 0)::bigint             AS net_cents,
              COALESCE(SUM(p.refunded_cents), 0)::bigint        AS refunded_cents
         FROM payments p
        WHERE ${whereSql}`,
      params
    );
    const row = result.rows[0];
    return {
      count: Number(row.count),
      grossCents: Number(row.gross_cents),
      feeCents: Number(row.fee_cents),
      applicationFeeCents: Number(row.application_fee_cents),
      netCents: Number(row.net_cents),
      refundedCents: Number(row.refunded_cents),
    };
  }
}
