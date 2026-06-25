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

/** Kanban lifecycle stages an order event can move a lead INTO (never backwards). */
export type LeadStage = 'booked' | 'paid' | 'completed';

/** Forward-only rank for the Kanban pipeline — an order event only ever advances a lead, so a
 *  later/duplicate event (or a manual stage already further along) is never downgraded. */
const STAGE_RANK: Record<string, number> = { new: 0, contacted: 1, booked: 2, paid: 3, completed: 4 };

export class AdAttributionService {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /** Live path: contact-match a just-paid order to a recent ad lead, link it, and advance the
   *  lead to 'paid'. No-op when disabled / no contact / no match. Non-throwing. */
  async attributeOrderPaid(input: OrderPaidInput): Promise<{ linked: boolean; leadId?: string }> {
    return this.attributeOrderStage(input, 'paid');
  }

  /**
   * General lifecycle attribution: link the order to a recent ad lead (by contact match, or reuse
   * an existing link) and advance that lead's Kanban status to `stage` (forward-only). Drives the
   * order_created→booked, order_paid→paid, order_completed→completed auto-advances so the pipeline
   * reflects reality without the shop dragging cards. No-op when disabled / order missing / no
   * contact / no match. Non-throwing.
   */
  async attributeOrderStage(input: OrderPaidInput, stage: LeadStage): Promise<{ linked: boolean; leadId?: string }> {
    if (!isConversionAttributionEnabled()) return { linked: false };
    try {
      const leadId = await this.linkOrGetLead(input.orderId, input.customerAddress, input.shopId);
      if (!leadId) return { linked: false };
      await this.advanceLead(leadId, input.customerAddress, stage);
      return { linked: true, leadId };
    } catch (err) {
      logger.error('AdAttribution.attributeOrderStage failed (non-fatal)', { stage, error: (err as Error)?.message });
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
        const leadId = await this.linkOrGetLead(o.order_id, o.customer_address, o.shop_id);
        if (leadId) { await this.advanceLead(leadId, o.customer_address, 'paid'); linked++; }
      } catch (err) {
        logger.warn('AdAttribution.backfill: one order failed, continuing', { orderId: o.order_id, error: (err as Error)?.message });
      }
    }
    logger.info('AdAttribution.backfillUnattributed done', { scanned: orders.rows.length, linked, shopId: opts.shopId ?? 'all' });
    return { scanned: orders.rows.length, linked };
  }

  /**
   * Resolve the ad lead for an order: return its existing `ad_lead_id` if already linked, else
   * contact-match (customer email/phone vs a recent, non-duplicate ad lead for the same shop) and
   * link it. Returns the lead id, or null when there's no contact / no match / order missing. The
   * link UPDATE is guarded on `ad_lead_id IS NULL` so it's safe under a concurrent link (we re-read
   * the winner's lead id rather than dropping the event).
   */
  private async linkOrGetLead(orderId: string, customerAddress: string, shopId: string): Promise<string | null> {
    const ord = await this.pool.query(`SELECT ad_lead_id FROM service_orders WHERE order_id = $1`, [orderId]);
    if (ord.rows.length === 0) return null;
    if (ord.rows[0].ad_lead_id) return ord.rows[0].ad_lead_id; // already linked → reuse

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
    if ((upd.rowCount ?? 0) === 0) {
      // Lost a race — another event linked it first; reuse whatever won.
      const re = await this.pool.query(`SELECT ad_lead_id FROM service_orders WHERE order_id = $1`, [orderId]);
      return re.rows[0]?.ad_lead_id ?? null;
    }
    logger.info('AdAttribution: linked order to ad lead', { orderId, leadId, shopId });
    return leadId;
  }

  /**
   * Advance a lead's Kanban status to `stage` — FORWARD ONLY (the SQL rank guard makes this a no-op
   * if the lead is already at or past `stage`, e.g. an order_paid arriving after a manual
   * 'completed'). Also back-links the customer + stamps first-response on first touch.
   */
  private async advanceLead(leadId: string, customerAddress: string, stage: LeadStage): Promise<void> {
    await this.pool.query(
      `UPDATE ad_leads
          SET lead_status = $3,
              customer_id = COALESCE(customer_id, $2),
              first_response_at = COALESCE(first_response_at, now()),
              updated_at = now()
        WHERE id = $1
          AND CASE lead_status
                WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'booked' THEN 2
                WHEN 'paid' THEN 3 WHEN 'completed' THEN 4 ELSE 0 END < $4`,
      [leadId, customerAddress.toLowerCase(), stage, STAGE_RANK[stage] ?? 0]
    );
  }
}

let _svc: AdAttributionService | null = null;
export function getAdAttributionService(): AdAttributionService {
  if (!_svc) _svc = new AdAttributionService();
  return _svc;
}
