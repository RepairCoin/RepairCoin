// backend/src/domains/AdsDomain/services/AdAttributionService.ts
//
// Conversion attribution (P0). Links a paid order back to the ad lead it came from by CONTACT
// MATCH (the customer's phone/email vs a recent ad lead for the same shop), sets
// `service_orders.ad_lead_id`, advances the lead's Kanban status to 'paid', and links the
// customer. The performance roll-up reads `ad_lead_id` (excluding cancelled/refunded), so once
// links exist bookings/revenue/ROI/True-Margin populate.
//
//  - attributeOrderPaid(): live path, called on the `service.order_paid` event.
//  - backfillUnattributed(): Phase 4 one-time/batch pass over historical unlinked paid orders.
//
// Gated by ADS_CONVERSION_ATTRIBUTION (default OFF). Non-throwing — never affects checkout.
// See ads-conversion-attribution-scope.md.

import { Pool } from 'pg';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

export function isConversionAttributionEnabled(): boolean {
  return process.env.ADS_CONVERSION_ATTRIBUTION === 'true';
}

function windowDays(): number {
  const n = parseInt(process.env.ADS_ATTRIBUTION_WINDOW_DAYS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/** Last 10 digits of a phone, for tolerant matching across formats (+63..., 0..., spaces).
 *  Returns '' when fewer than 10 digits (don't match on a too-short fragment). */
export function phoneTail(phone: string | null | undefined): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

export interface OrderPaidInput {
  orderId: string;
  customerAddress: string;
  shopId: string;
}

export class AdAttributionService {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /** Live path: contact-match a just-paid order to a recent ad lead and link it. No-op when
   *  disabled / order missing / already attributed / no contact / no match. Non-throwing. */
  async attributeOrderPaid(input: OrderPaidInput): Promise<{ linked: boolean; leadId?: string }> {
    if (!isConversionAttributionEnabled()) return { linked: false };
    try {
      const ord = await this.pool.query(`SELECT ad_lead_id FROM service_orders WHERE order_id = $1`, [input.orderId]);
      if (ord.rows.length === 0 || ord.rows[0].ad_lead_id) return { linked: false };
      const leadId = await this.tryLinkByContact(input.orderId, input.customerAddress, input.shopId);
      return leadId ? { linked: true, leadId } : { linked: false };
    } catch (err) {
      logger.error('AdAttribution.attributeOrderPaid failed (non-fatal)', err);
      return { linked: false };
    }
  }

  /**
   * Phase 4 backfill: one-time/batch contact-match over historical PAID orders that have no
   * `ad_lead_id` yet, for shops that run ads. Best-effort, idempotent (only links unlinked
   * orders). Returns how many were scanned vs linked.
   */
  async backfillUnattributed(opts: { shopId?: string; sinceDays?: number; limit?: number } = {}): Promise<{ scanned: number; linked: number }> {
    if (!isConversionAttributionEnabled()) return { scanned: 0, linked: 0 };
    const sinceDays = opts.sinceDays && opts.sinceDays > 0 ? opts.sinceDays : 180;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 1000;
    const params: any[] = [String(sinceDays), limit];
    let shopFilter = '';
    if (opts.shopId) { params.push(opts.shopId); shopFilter = `AND o.shop_id = $${params.length}`; }

    const orders = await this.pool.query(
      `SELECT o.order_id, o.customer_address, o.shop_id
         FROM service_orders o
        WHERE o.ad_lead_id IS NULL
          AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded')
          AND o.created_at > now() - ($1 || ' days')::interval
          ${shopFilter}
          AND EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.shop_id = o.shop_id AND c.deleted_at IS NULL)
        ORDER BY o.created_at DESC
        LIMIT $2`,
      params
    );

    let linked = 0;
    for (const o of orders.rows) {
      try {
        const leadId = await this.tryLinkByContact(o.order_id, o.customer_address, o.shop_id);
        if (leadId) linked++;
      } catch (err) {
        logger.warn('AdAttribution.backfill: one order failed, continuing', { orderId: o.order_id, error: (err as Error)?.message });
      }
    }
    logger.info('AdAttribution.backfillUnattributed done', { scanned: orders.rows.length, linked, shopId: opts.shopId ?? 'all' });
    return { scanned: orders.rows.length, linked };
  }

  /**
   * Core contact-match + link, shared by the live + backfill paths. Returns the linked lead id,
   * or null when there's no contact / no match. The order UPDATE is guarded on `ad_lead_id IS
   * NULL` so it's safe to call on an order that may have been linked concurrently.
   */
  private async tryLinkByContact(orderId: string, customerAddress: string, shopId: string): Promise<string | null> {
    const cust = await this.pool.query(
      `SELECT email, phone FROM customers WHERE address = $1`,
      [customerAddress.toLowerCase()]
    );
    const email = (cust.rows[0]?.email || '').trim().toLowerCase();
    const tail = phoneTail(cust.rows[0]?.phone);
    if (!email && !tail) return null;

    const lead = await this.pool.query(
      `SELECT l.id
         FROM ad_leads l
         JOIN ad_campaigns c ON c.id = l.campaign_id
        WHERE c.shop_id = $1
          AND l.is_duplicate = false
          AND l.created_at > now() - ($2 || ' days')::interval
          AND (
            ($3 <> '' AND lower(l.email) = $3)
            OR ($4 <> '' AND right(regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g'), 10) = $4)
          )
        ORDER BY l.created_at DESC
        LIMIT 1`,
      [shopId, String(windowDays()), email, tail]
    );
    const leadId: string | undefined = lead.rows[0]?.id;
    if (!leadId) return null;

    const upd = await this.pool.query(
      `UPDATE service_orders
          SET ad_lead_id = $1, ad_attribution_method = 'contact_match', ad_attributed_at = now()
        WHERE order_id = $2 AND ad_lead_id IS NULL`,
      [leadId, orderId]
    );
    if ((upd.rowCount ?? 0) === 0) return null; // lost a race — already linked

    await this.pool.query(
      `UPDATE ad_leads
          SET lead_status = 'paid',
              customer_id = COALESCE(customer_id, $2),
              first_response_at = COALESCE(first_response_at, now()),
              updated_at = now()
        WHERE id = $1 AND lead_status <> 'completed'`,
      [leadId, customerAddress.toLowerCase()]
    );
    logger.info('AdAttribution: linked order to ad lead', { orderId, leadId, shopId });
    return leadId;
  }
}

let _svc: AdAttributionService | null = null;
export function getAdAttributionService(): AdAttributionService {
  if (!_svc) _svc = new AdAttributionService();
  return _svc;
}
