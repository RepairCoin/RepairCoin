// backend/src/domains/AdsDomain/services/AdAttributionService.ts
//
// Conversion attribution (P0). On `service.order_paid`, link the paid order back to the ad
// lead it came from by CONTACT MATCH (the customer's phone/email vs a recent ad lead for the
// same shop), set `service_orders.ad_lead_id`, advance the lead's Kanban status to 'paid', and
// stamp the attribution. The performance roll-up already reads `ad_lead_id` (and excludes
// cancelled/refunded), so once links exist bookings/revenue/ROI/True-Margin populate.
//
// Gated by ADS_CONVERSION_ATTRIBUTION (default OFF). Non-throwing — attribution must never
// affect the booking/payment flow. See ads-conversion-attribution-scope.md.

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

  /** Contact-match a just-paid order to a recent ad lead and link it. No-op when disabled /
   *  already attributed / no contact / no match. Non-throwing. */
  async attributeOrderPaid(input: OrderPaidInput): Promise<{ linked: boolean; leadId?: string }> {
    if (!isConversionAttributionEnabled()) return { linked: false };
    const { orderId, customerAddress, shopId } = input;
    try {
      // Idempotent — skip if the order is gone or already attributed.
      const ord = await this.pool.query(`SELECT ad_lead_id FROM service_orders WHERE order_id = $1`, [orderId]);
      if (ord.rows.length === 0 || ord.rows[0].ad_lead_id) return { linked: false };

      // The customer's contact details to match on.
      const cust = await this.pool.query(
        `SELECT email, phone FROM customers WHERE address = $1`,
        [customerAddress.toLowerCase()]
      );
      const email = (cust.rows[0]?.email || '').trim().toLowerCase();
      const tail = phoneTail(cust.rows[0]?.phone);
      if (!email && !tail) return { linked: false };

      // Newest non-duplicate lead for THIS shop matching email or phone-tail, within the window.
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
      if (!leadId) return { linked: false };

      // Link the order (guard the race: only if still unlinked).
      await this.pool.query(
        `UPDATE service_orders
            SET ad_lead_id = $1, ad_attribution_method = 'contact_match', ad_attributed_at = now()
          WHERE order_id = $2 AND ad_lead_id IS NULL`,
        [leadId, orderId]
      );
      // Keep the Kanban in sync with the money: a paid order advances the lead to 'paid' and
      // links the customer. Don't downgrade a 'completed' lead.
      await this.pool.query(
        `UPDATE ad_leads
            SET lead_status = 'paid',
                customer_id = COALESCE(customer_id, $2),
                first_response_at = COALESCE(first_response_at, now()),
                updated_at = now()
          WHERE id = $1 AND lead_status <> 'completed'`,
        [leadId, customerAddress.toLowerCase()]
      );
      logger.info('AdAttribution: linked paid order to ad lead', { orderId, leadId, shopId });
      return { linked: true, leadId };
    } catch (err) {
      logger.error('AdAttribution.attributeOrderPaid failed (non-fatal)', err);
      return { linked: false };
    }
  }
}

let _svc: AdAttributionService | null = null;
export function getAdAttributionService(): AdAttributionService {
  if (!_svc) _svc = new AdAttributionService();
  return _svc;
}
