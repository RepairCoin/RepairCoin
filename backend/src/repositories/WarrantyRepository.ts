import { BaseRepository } from './BaseRepository';
import { daysRemaining } from '../utils/warranty';

export interface ActiveWarranty {
  /** Where the work was sold. The shop needs this to pull the original paperwork. */
  source: 'pos_sale' | 'booking';
  reference: string;
  serviceName: string;
  completedAt: string;
  expiresAt: string;
  daysRemaining: number;
  warrantyDays: number;
}

/**
 * What a shop is still on the hook for.
 *
 * Coverage is computed from the snapshotted term and the completion timestamp rather than read from
 * a stored expiry — see migration 266. Both halves of the union apply the same arithmetic, so a
 * repair sold at the counter and the same repair booked online expire on the same rule.
 */
export class WarrantyRepository extends BaseRepository {
  /**
   * Active warranties for one customer at one shop, soonest to expire first — the order a counter
   * conversation wants, since the claim in question is usually the one about to run out.
   *
   * Scoped to the shop deliberately. A warranty is a promise by the shop that did the work, and one
   * shop has no business reading another's liabilities from its own register.
   */
  async listActiveForCustomer(shopId: string, customerAddress: string): Promise<ActiveWarranty[]> {
    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT 'pos_sale' AS source,
                COALESCE(s.sale_number::text, s.id::text) AS reference,
                i.name AS service_name,
                s.completed_at,
                i.warranty_days,
                s.completed_at + (i.warranty_days * INTERVAL '1 day') AS expires_at
         FROM pos_sale_items i
         JOIN pos_sales s ON s.id = i.sale_id
         WHERE s.shop_id = $1
           AND LOWER(s.customer_address) = LOWER($2)
           AND s.status = 'completed'
           AND s.completed_at IS NOT NULL
           AND i.warranty_days > 0

         UNION ALL

         SELECT 'booking' AS source,
                o.order_id AS reference,
                COALESCE(sv.service_name, 'Service') AS service_name,
                o.completed_at,
                o.warranty_days,
                o.completed_at + (o.warranty_days * INTERVAL '1 day') AS expires_at
         FROM service_orders o
         LEFT JOIN shop_services sv ON sv.service_id = o.service_id
         WHERE o.shop_id = $1
           AND LOWER(o.customer_address) = LOWER($2)
           AND o.status = 'completed'
           AND o.completed_at IS NOT NULL
           AND o.warranty_days > 0
       ) w
       WHERE w.expires_at > NOW()
       ORDER BY w.expires_at ASC
       LIMIT 50`,
      [shopId, customerAddress]
    );

    return result.rows.map((row) => ({
      source: row.source,
      reference: row.reference,
      serviceName: row.service_name,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      daysRemaining: daysRemaining(row.expires_at),
      warrantyDays: Number(row.warranty_days),
    }));
  }
}
