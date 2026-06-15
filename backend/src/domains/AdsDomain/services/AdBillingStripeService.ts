// backend/src/domains/AdsDomain/services/AdBillingStripeService.ts
//
// Q4/Q7 — pushes accrued ad-management charges to Stripe as a one-off invoice and
// attempts immediate collection. This is the ONLY part of billing that moves real
// money, so it's behind a master switch: ADS_BILLING_STRIPE_ENABLED. With the flag
// off, invoiceShopPending() returns a clear 501 and nothing is charged; the accrual
// ledger (AdBillingService) stays fully live regardless. Flip the flag on once a
// real Stripe key + saved shop payment methods are in place.

import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { shopRepository } from '../../../repositories';
import { getStripeService } from '../../../services/StripeService';
import { BillingChargeRepository, BillingCharge, ChargeType } from '../repositories/BillingChargeRepository';

export interface InvoicePreview {
  shopId: string;
  chargeIds: string[];
  totalCents: number;
  lineCount: number;
}

const CHARGE_LABEL: Record<ChargeType, string> = {
  flat_tier_fee: 'AI Ads Management — monthly plan fee',
  plan_a_dashboard: 'Ad management — dashboard fee (Plan A)',
  plan_b_margin: 'Ad management — managed ad spend margin (Plan B)',
  plan_c_booking: 'Ad management — per-booking fee (Plan C)',
  plan_c_revenue_share: 'Ad management — revenue share (Plan C)',
};

export class AdBillingStripeService {
  constructor(private readonly charges = new BillingChargeRepository()) {}

  /** Master switch — real money movement is off until this is explicitly enabled. */
  isEnabled(): boolean {
    return process.env.ADS_BILLING_STRIPE_ENABLED === 'true';
  }

  /** Preview what an invoice WOULD bundle — safe, read-only, always available. */
  async previewShop(shopId: string): Promise<InvoicePreview> {
    const pending = await this.charges.pendingForShop(shopId);
    return {
      shopId,
      chargeIds: pending.map((c) => c.id),
      totalCents: pending.reduce((s, c) => s + c.amountCents, 0),
      lineCount: pending.length,
    };
  }

  /** shops.stripe_customer_id, falling back to the stripe_customers table. */
  private async resolveCustomerId(shopId: string): Promise<string | null> {
    const shop = await shopRepository.getShop(shopId).catch(() => null);
    if (shop?.stripeCustomerId) return shop.stripeCustomerId;
    const res = await getSharedPool().query(
      `SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1 LIMIT 1`,
      [shopId]
    );
    return res.rows[0]?.stripe_customer_id ?? null;
  }

  /** One invoice line per charge type (pending charges summed). */
  private buildLines(pending: BillingCharge[]): Array<{ amountCents: number; description: string }> {
    const byType = new Map<ChargeType, number>();
    for (const c of pending) byType.set(c.chargeType, (byType.get(c.chargeType) ?? 0) + c.amountCents);
    return [...byType.entries()].map(([type, amountCents]) => ({ amountCents, description: CHARGE_LABEL[type] }));
  }

  /** Bundle a shop's pending charges into a Stripe invoice, collect, and mark them.
   *  GATED by ADS_BILLING_STRIPE_ENABLED. */
  async invoiceShopPending(shopId: string): Promise<{ stripeInvoiceId: string; totalCents: number; status: string }> {
    const pending = await this.charges.pendingForShop(shopId);
    if (pending.length === 0) {
      throw Object.assign(new Error('No pending charges to invoice.'), { status: 400 });
    }
    if (!this.isEnabled()) {
      throw Object.assign(
        new Error(
          'Ad-management billing to Stripe is disabled. Set ADS_BILLING_STRIPE_ENABLED=true ' +
          '(and ensure the shop has a saved payment method) to collect.'
        ),
        { status: 501 }
      );
    }

    const customerId = await this.resolveCustomerId(shopId);
    if (!customerId) {
      throw Object.assign(
        new Error('Shop has no Stripe customer on file — add a payment method before invoicing.'),
        { status: 409 }
      );
    }

    const lines = this.buildLines(pending);
    const totalCents = pending.reduce((s, c) => s + c.amountCents, 0);
    const ids = pending.map((c) => c.id);

    const invoice = await getStripeService().createImmediateInvoice(customerId, lines, {
      kind: 'ad_management_billing',
      shop_id: shopId,
      charge_count: String(ids.length),
    });

    // Reconcile: paid → 'paid', otherwise 'invoiced' (open, awaiting retry/webhook).
    const newStatus = invoice.status === 'paid' ? 'paid' : 'invoiced';
    await this.charges.markStatus(ids, newStatus, invoice.id as string);

    logger.info('Ad-management charges invoiced', {
      shopId, invoiceId: invoice.id, status: newStatus, totalCents, lines: lines.length,
    });
    return { stripeInvoiceId: invoice.id as string, totalCents, status: newStatus };
  }
}

export const adBillingStripeService = new AdBillingStripeService();
