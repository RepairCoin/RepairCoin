import { BaseRepository } from './BaseRepository';
import { PoolClient } from 'pg';

export type PosSaleStatus =
  | 'open'
  | 'completed'
  | 'voided'
  | 'refunded'
  | 'partially_refunded';

export type PosSaleItemKind = 'service' | 'product' | 'custom';
export type PosTenderMethod = 'card' | 'cash' | 'gift_card' | 'rcn' | 'other';
export type PosPaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded';

export interface PosSale {
  id: string;
  shopId: string;
  locationId: string | null;
  customerAddress: string | null;
  staffMemberId: string | null;
  saleNumber: number | null;
  status: PosSaleStatus;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  note: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosSaleItem {
  id: string;
  saleId: string;
  lineNumber: number;
  kind: PosSaleItemKind;
  serviceId: string | null;
  inventoryItemId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  unitCostCents: number | null; // null = cost unknown, which is not the same as free
}

export interface PosSalePayment {
  id: string;
  saleId: string;
  method: PosTenderMethod;
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  status: PosPaymentStatus;
  stripePaymentIntentId: string | null;
  stripeReaderId: string | null;
  applicationFeeCents: number;
  refundedCents: number;
  paymentId: string | null;
  failureReason: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface PosSaleWithDetails extends PosSale {
  items: PosSaleItem[];
  payments: PosSalePayment[];
  paidCents: number;
  balanceCents: number;
}

export interface PosSalesSummary {
  saleCount: number;
  netRevenueCents: number; // what was sold, after discounts, before tax
  taxCents: number;
  totalCents: number;
  costedRevenueCents: number;
  costCents: number;
  marginCents: number;
  marginBps: number | null;
  uncostedRevenueCents: number;
  tenders: Record<string, number>;
}

export interface CreatePosSaleInput {
  shopId: string;
  locationId?: string | null;
  customerAddress?: string | null;
  staffMemberId?: string | null;
  note?: string | null;
}

export interface AddPosSaleItemInput {
  kind: PosSaleItemKind;
  serviceId?: string | null;
  inventoryItemId?: string | null;
  name: string;
  quantity?: number;
  unitPriceCents: number;
  discountCents?: number;
  taxable?: boolean;
  taxRateBps?: number;
  taxCents?: number;
  unitCostCents?: number | null;
}

export interface AddPosSalePaymentInput {
  method: PosTenderMethod;
  amountCents: number;
  tenderedCents?: number | null;
  status?: PosPaymentStatus;
  stripePaymentIntentId?: string | null;
  stripeReaderId?: string | null;
  applicationFeeCents?: number;
}

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export class PosSaleRepository extends BaseRepository {
  private mapSale(row: any): PosSale {
    return {
      id: row.id,
      shopId: row.shop_id,
      locationId: row.location_id,
      customerAddress: row.customer_address,
      staffMemberId: row.staff_member_id,
      saleNumber: row.sale_number === null ? null : Number(row.sale_number),
      status: row.status,
      subtotalCents: n(row.subtotal_cents),
      discountCents: n(row.discount_cents),
      taxCents: n(row.tax_cents),
      totalCents: n(row.total_cents),
      currency: row.currency,
      note: row.note,
      completedAt: row.completed_at,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapItem(row: any): PosSaleItem {
    return {
      id: row.id,
      saleId: row.sale_id,
      lineNumber: n(row.line_number),
      kind: row.kind,
      serviceId: row.service_id,
      inventoryItemId: row.inventory_item_id,
      name: row.name,
      quantity: n(row.quantity),
      unitPriceCents: n(row.unit_price_cents),
      discountCents: n(row.discount_cents),
      taxable: row.taxable,
      taxRateBps: n(row.tax_rate_bps),
      taxCents: n(row.tax_cents),
      totalCents: n(row.total_cents),
      unitCostCents:
        row.unit_cost_cents === null || row.unit_cost_cents === undefined
          ? null
          : Number(row.unit_cost_cents),
    };
  }

  private mapPayment(row: any): PosSalePayment {
    return {
      id: row.id,
      saleId: row.sale_id,
      method: row.method,
      amountCents: n(row.amount_cents),
      tenderedCents: row.tendered_cents === null ? null : n(row.tendered_cents),
      changeCents: row.change_cents === null ? null : n(row.change_cents),
      status: row.status,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeReaderId: row.stripe_reader_id,
      applicationFeeCents: n(row.application_fee_cents),
      refundedCents: n(row.refunded_cents),
      paymentId: row.payment_id,
      failureReason: row.failure_reason,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
    };
  }

  async createSale(input: CreatePosSaleInput): Promise<PosSale> {
    const result = await this.pool.query(
      `INSERT INTO pos_sales (shop_id, location_id, customer_address, staff_member_id, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.shopId,
        input.locationId ?? null,
        input.customerAddress ?? null,
        input.staffMemberId ?? null,
        input.note ?? null,
      ]
    );
    return this.mapSale(result.rows[0]);
  }

  async getSale(saleId: string, shopId: string): Promise<PosSaleWithDetails | null> {
    const saleResult = await this.pool.query(
      `SELECT * FROM pos_sales WHERE id = $1 AND shop_id = $2`,
      [saleId, shopId]
    );
    if (!saleResult.rows[0]) return null;

    const [items, payments] = await Promise.all([
      this.pool.query(`SELECT * FROM pos_sale_items WHERE sale_id = $1 ORDER BY line_number ASC`, [
        saleId,
      ]),
      this.pool.query(`SELECT * FROM pos_sale_payments WHERE sale_id = $1 ORDER BY created_at ASC`, [
        saleId,
      ]),
    ]);

    return this.withDetails(
      this.mapSale(saleResult.rows[0]),
      items.rows.map((r) => this.mapItem(r)),
      payments.rows.map((r) => this.mapPayment(r))
    );
  }

  private withDetails(
    sale: PosSale,
    items: PosSaleItem[],
    payments: PosSalePayment[]
  ): PosSaleWithDetails {
    // Only settled tenders count toward the balance. A pending card leg must not make a sale
    // look paid — that is how a cart gets completed while the reader is still holding it.
    const paidCents = payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amountCents, 0);

    return { ...sale, items, payments, paidCents, balanceCents: sale.totalCents - paidCents };
  }

  async listSales(
    shopId: string,
    options: { status?: PosSaleStatus; limit?: number } = {}
  ): Promise<PosSale[]> {
    const params: unknown[] = [shopId];
    let where = 'shop_id = $1';
    if (options.status) {
      params.push(options.status);
      where += ` AND status = $${params.length}`;
    }
    params.push(Math.min(options.limit ?? 50, 200));

    const result = await this.pool.query(
      `SELECT * FROM pos_sales WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return result.rows.map((r) => this.mapSale(r));
  }

  async addItem(saleId: string, input: AddPosSaleItemInput): Promise<PosSaleItem> {
    return this.withTransaction(async (client: PoolClient) => {
      await this.assertOpen(client, saleId);

      const quantity = input.quantity ?? 1;
      const discount = input.discountCents ?? 0;
      const tax = input.taxCents ?? 0;
      const total = quantity * input.unitPriceCents - discount + tax;

      const lineNumber = await client.query(
        `SELECT COALESCE(MAX(line_number), 0) + 1 AS next FROM pos_sale_items WHERE sale_id = $1`,
        [saleId]
      );

      const result = await client.query(
        `INSERT INTO pos_sale_items (
           sale_id, line_number, kind, service_id, inventory_item_id, name,
           quantity, unit_price_cents, discount_cents, taxable, tax_rate_bps, tax_cents, total_cents,
           unit_cost_cents
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          saleId,
          lineNumber.rows[0].next,
          input.kind,
          input.serviceId ?? null,
          input.inventoryItemId ?? null,
          input.name,
          quantity,
          input.unitPriceCents,
          discount,
          input.taxable ?? true,
          input.taxRateBps ?? 0,
          tax,
          total,
          input.unitCostCents ?? null,
        ]
      );

      await this.recalculate(client, saleId);
      return this.mapItem(result.rows[0]);
    });
  }

  async removeItem(saleId: string, itemId: string): Promise<boolean> {
    return this.withTransaction(async (client: PoolClient) => {
      await this.assertOpen(client, saleId);
      const deleted = await client.query(
        `DELETE FROM pos_sale_items WHERE id = $1 AND sale_id = $2 RETURNING id`,
        [itemId, saleId]
      );
      if (!deleted.rows[0]) return false;
      await this.recalculate(client, saleId);
      return true;
    });
  }

  async addPayment(saleId: string, input: AddPosSalePaymentInput): Promise<PosSalePayment> {
    return this.withTransaction(async (client: PoolClient) => {
      await this.assertOpen(client, saleId);

      const change =
        input.tenderedCents !== null && input.tenderedCents !== undefined
          ? Math.max(input.tenderedCents - input.amountCents, 0)
          : null;

      const status = input.status ?? 'pending';
      const result = await client.query(
        `INSERT INTO pos_sale_payments (
           sale_id, method, amount_cents, tendered_cents, change_cents, status,
           stripe_payment_intent_id, stripe_reader_id, application_fee_cents, captured_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          saleId,
          input.method,
          input.amountCents,
          input.tenderedCents ?? null,
          change,
          status,
          input.stripePaymentIntentId ?? null,
          input.stripeReaderId ?? null,
          input.applicationFeeCents ?? 0,
          status === 'succeeded' ? new Date() : null,
        ]
      );
      return this.mapPayment(result.rows[0]);
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PosPaymentStatus,
    extra: { failureReason?: string | null; applicationFeeCents?: number } = {}
  ): Promise<PosSalePayment | null> {
    const result = await this.pool.query(
      `UPDATE pos_sale_payments
       SET status = $2,
           failure_reason = COALESCE($3, failure_reason),
           application_fee_cents = COALESCE($4, application_fee_cents),
           captured_at = CASE WHEN $2::varchar = 'succeeded' AND captured_at IS NULL THEN now() ELSE captured_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [paymentId, status, extra.failureReason ?? null, extra.applicationFeeCents ?? null]
    );
    return result.rows[0] ? this.mapPayment(result.rows[0]) : null;
  }

  /**
   * Totals are always recomputed from the lines — never accepted from a caller. A POS client
   * that miscalculates, or is tampered with, must not be able to decide what a sale is worth.
   * An order-level discount is pushed down onto the lines before this runs, so line tax stays
   * correct and `discount_cents` has a single source of truth.
   */
  private async recalculate(client: PoolClient, saleId: string): Promise<void> {
    await client.query(
      `UPDATE pos_sales s SET
         subtotal_cents = t.subtotal,
         discount_cents = t.discount,
         tax_cents      = t.tax,
         total_cents    = t.subtotal - t.discount + t.tax,
         updated_at     = now()
       FROM (
         SELECT
           COALESCE(SUM(quantity * unit_price_cents), 0)::int AS subtotal,
           COALESCE(SUM(discount_cents), 0)::int              AS discount,
           COALESCE(SUM(tax_cents), 0)::int                   AS tax
         FROM pos_sale_items WHERE sale_id = $1
       ) t
       WHERE s.id = $1`,
      [saleId]
    );
  }

  private async assertOpen(client: PoolClient, saleId: string): Promise<void> {
    const result = await client.query(`SELECT status FROM pos_sales WHERE id = $1 FOR UPDATE`, [
      saleId,
    ]);
    const status = result.rows[0]?.status;
    if (!status) throw Object.assign(new Error('Sale not found.'), { status: 404 });
    if (status !== 'open') {
      throw Object.assign(new Error(`This sale is ${status} and can no longer be changed.`), {
        status: 409,
      });
    }
  }

  /**
   * Completes a sale and assigns its receipt number.
   *
   * The advisory lock serialises completion per shop: sale_number is MAX + 1, and two registers
   * closing at once would otherwise read the same max and collide on the unique index. Locking
   * on the shop rather than retrying keeps the numbers gapless, which is the point of having them.
   */
  async completeSale(saleId: string, shopId: string): Promise<PosSaleWithDetails> {
    return this.withTransaction(async (client: PoolClient) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`pos_sale:${shopId}`]);
      await this.assertOpen(client, saleId);

      const sale = await client.query(`SELECT * FROM pos_sales WHERE id = $1 AND shop_id = $2`, [
        saleId,
        shopId,
      ]);
      if (!sale.rows[0]) throw Object.assign(new Error('Sale not found.'), { status: 404 });

      const items = await client.query(
        `SELECT * FROM pos_sale_items WHERE sale_id = $1 ORDER BY line_number ASC`,
        [saleId]
      );
      if (items.rows.length === 0) {
        throw Object.assign(new Error('Add at least one item before completing the sale.'), {
          status: 400,
        });
      }

      const payments = await client.query(`SELECT * FROM pos_sale_payments WHERE sale_id = $1`, [
        saleId,
      ]);
      const paid = payments.rows
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + n(p.amount_cents), 0);
      const total = n(sale.rows[0].total_cents);

      if (paid < total) {
        throw Object.assign(
          new Error(`Sale is short by ${total - paid} cents — take the remaining balance first.`),
          { status: 409 }
        );
      }

      const numbered = await client.query(
        `UPDATE pos_sales SET
           status = 'completed',
           completed_at = now(),
           updated_at = now(),
           sale_number = (
             SELECT COALESCE(MAX(sale_number), 0) + 1 FROM pos_sales WHERE shop_id = $2
           )
         WHERE id = $1
         RETURNING *`,
        [saleId, shopId]
      );

      return this.withDetails(
        this.mapSale(numbered.rows[0]),
        items.rows.map((r) => this.mapItem(r)),
        payments.rows.map((r) => this.mapPayment(r))
      );
    });
  }

  /**
   * Margin is reported over the lines whose cost is known, and `uncostedRevenueCents` carries the
   * rest. Folding unknown-cost lines in at zero cost would report them as pure profit, which is
   * the one answer guaranteed to be wrong — most shops leave `cost` unset on some of the catalogue.
   */
  async getSummary(
    shopId: string,
    options: { since: Date; locationId?: string | null } = { since: new Date(0) }
  ): Promise<PosSalesSummary> {
    const params: unknown[] = [shopId, options.since];
    let scope = 's.shop_id = $1 AND s.status = \'completed\' AND s.completed_at >= $2';
    if (options.locationId) {
      params.push(options.locationId);
      scope += ` AND s.location_id = $${params.length}`;
    }

    const [totals, lines, tenders] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*)::int AS sale_count,
                COALESCE(SUM(s.subtotal_cents - s.discount_cents), 0)::bigint AS net_cents,
                COALESCE(SUM(s.tax_cents), 0)::bigint   AS tax_cents,
                COALESCE(SUM(s.total_cents), 0)::bigint AS total_cents
         FROM pos_sales s WHERE ${scope}`,
        params
      ),
      this.pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN i.unit_cost_cents IS NOT NULL
                        THEN i.quantity * i.unit_price_cents - i.discount_cents END), 0)::bigint AS costed_revenue,
           COALESCE(SUM(CASE WHEN i.unit_cost_cents IS NOT NULL
                        THEN i.quantity * i.unit_cost_cents END), 0)::bigint AS cost_cents,
           COALESCE(SUM(CASE WHEN i.unit_cost_cents IS NULL
                        THEN i.quantity * i.unit_price_cents - i.discount_cents END), 0)::bigint AS uncosted_revenue
         FROM pos_sale_items i JOIN pos_sales s ON s.id = i.sale_id
         WHERE ${scope}`,
        params
      ),
      this.pool.query(
        `SELECT p.method, COALESCE(SUM(p.amount_cents), 0)::bigint AS amount_cents
         FROM pos_sale_payments p JOIN pos_sales s ON s.id = p.sale_id
         WHERE ${scope} AND p.status = 'succeeded'
         GROUP BY p.method`,
        params
      ),
    ]);

    const t = totals.rows[0];
    const l = lines.rows[0];
    const costedRevenueCents = n(l.costed_revenue);
    const costCents = n(l.cost_cents);
    const marginCents = costedRevenueCents - costCents;

    return {
      saleCount: n(t.sale_count),
      netRevenueCents: n(t.net_cents),
      taxCents: n(t.tax_cents),
      totalCents: n(t.total_cents),
      costedRevenueCents,
      costCents,
      marginCents,
      marginBps: costedRevenueCents > 0 ? Math.round((marginCents / costedRevenueCents) * 10000) : null,
      uncostedRevenueCents: n(l.uncosted_revenue),
      tenders: tenders.rows.reduce<Record<string, number>>(
        (acc, r) => ({ ...acc, [r.method]: n(r.amount_cents) }),
        {}
      ),
    };
  }

  async voidSale(saleId: string, shopId: string, reason?: string): Promise<PosSale | null> {
    const result = await this.pool.query(
      `UPDATE pos_sales
       SET status = 'voided', voided_at = now(), void_reason = $3, updated_at = now()
       WHERE id = $1 AND shop_id = $2 AND status = 'open'
       RETURNING *`,
      [saleId, shopId, reason ?? null]
    );
    return result.rows[0] ? this.mapSale(result.rows[0]) : null;
  }
}
