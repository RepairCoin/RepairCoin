// backend/src/domains/AIAgentDomain/services/AiOverageStripeService.ts
//
// T3.2 Slice 3 — invoices a shop's accrued AI Usage Overage (Usage x3) via Stripe as a one-off
// invoice and attempts immediate collection. Mirrors AdBillingStripeService: this is the ONLY part
// that moves real money, so it's behind a master switch AI_OVERAGE_STRIPE_ENABLED. With the flag off,
// invoiceShopPending() returns a clear 501 and nothing is charged; the accrual ledger stays live.
// It's a DIRECT invoice to the shop's existing stripe_customer_id (from the $500 subscription) — NOT
// Stripe Connect. Flip the flag on once the Usage x3 terms are signed off + live Stripe keys are set.

import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { shopRepository } from '../../../repositories';
import { getStripeService } from '../../../services/StripeService';
import { AiOverageChargeRepository } from '../../../repositories/AiOverageChargeRepository';

export interface OverageInvoicePreview {
  shopId: string;
  chargeIds: string[];
  totalCents: number;
  lineCount: number;
}

export class AiOverageStripeService {
  constructor(private readonly charges = new AiOverageChargeRepository()) {}

  /** Master switch — real money movement is off until this is explicitly enabled. */
  isEnabled(): boolean {
    return process.env.AI_OVERAGE_STRIPE_ENABLED === 'true';
  }

  /** Preview what an invoice WOULD bundle — safe, read-only, always available. */
  async previewShop(shopId: string): Promise<OverageInvoicePreview> {
    const pending = await this.charges.pendingForShop(shopId);
    return {
      shopId,
      chargeIds: pending.map((c) => c.id),
      totalCents: pending.reduce((s, c) => s + c.amountCents, 0),
      lineCount: pending.length,
    };
  }

  /** shops.stripe_customer_id, falling back to the stripe_customers table (same as ads billing). */
  private async resolveCustomerId(shopId: string): Promise<string | null> {
    const shop = await shopRepository.getShop(shopId).catch(() => null);
    if (shop?.stripeCustomerId) return shop.stripeCustomerId;
    const res = await getSharedPool().query(
      `SELECT stripe_customer_id FROM stripe_customers WHERE shop_id = $1 LIMIT 1`,
      [shopId]
    );
    return res.rows[0]?.stripe_customer_id ?? null;
  }

  /** One invoice line per completed month (label carries the period). */
  private buildLines(
    pending: Array<{ periodMonth: string; amountCents: number }>
  ): Array<{ amountCents: number; description: string }> {
    return pending.map((c) => ({
      amountCents: c.amountCents,
      description: `AI Usage Overage (Usage x3) — ${c.periodMonth.slice(0, 7)}`, // YYYY-MM
    }));
  }

  /** Bundle a shop's pending (completed-month) overage into a Stripe invoice, collect, and mark them.
   *  GATED by AI_OVERAGE_STRIPE_ENABLED. Errors carry an HTTP status for the controller. */
  async invoiceShopPending(shopId: string): Promise<{ stripeInvoiceId: string; totalCents: number; status: string }> {
    // Preflight against a READ (no claim yet) so a 501/409 never strands rows in the claimed state.
    const preview = await this.charges.pendingForShop(shopId);
    if (preview.length === 0) {
      throw Object.assign(new Error('No pending overage to invoice.'), { status: 400 });
    }
    if (!this.isEnabled()) {
      throw Object.assign(
        new Error(
          'AI Usage Overage billing to Stripe is disabled. Set AI_OVERAGE_STRIPE_ENABLED=true ' +
          '(terms signed off + live Stripe keys) to collect.'
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

    // ATOMICALLY claim the rows (concurrency guard). A parallel run — admin double-click, or the monthly
    // cron overlapping a manual invoice — loses the claim and gets nothing here, so nothing is charged twice.
    const claimed = await this.charges.claimPendingForShop(shopId);
    if (claimed.length === 0) {
      return { stripeInvoiceId: '', totalCents: 0, status: 'skipped' };
    }

    const lines = this.buildLines(claimed);
    const totalCents = claimed.reduce((s, c) => s + c.amountCents, 0);
    const ids = claimed.map((c) => c.id);

    try {
      // NOTE (multi-currency): createImmediateInvoice bills USD — overage is a FixFlow platform fee, kept
      // in USD like the ads FixFlow fees (shop ad money uses meta_currency; platform fees do not).
      const invoice = await getStripeService().createImmediateInvoice(customerId, lines, {
        kind: 'ai_overage_billing',
        shop_id: shopId,
        charge_count: String(ids.length),
      });

      // Reconcile: paid → 'paid', otherwise 'invoiced' (open, awaiting retry / the payment webhook).
      const newStatus = invoice.status === 'paid' ? 'paid' : 'invoiced';
      await this.charges.markStatus(ids, newStatus, invoice.id as string);

      logger.info('AI overage charges invoiced', {
        shopId, invoiceId: invoice.id, status: newStatus, totalCents, lines: lines.length,
      });
      return { stripeInvoiceId: invoice.id as string, totalCents, status: newStatus };
    } catch (err) {
      // Invoice creation itself failed — release the claim so the rows are immediately retryable.
      await this.charges.releaseClaim(ids).catch(() => undefined);
      throw err;
    }
  }

  /** Monthly run: invoice every shop with completed-month pending overage. Best-effort per shop —
   *  one shop's failure never blocks the rest. Returns a per-shop outcome list. */
  async invoiceAllDue(): Promise<Array<{ shopId: string; ok: boolean; error?: string }>> {
    if (!this.isEnabled()) {
      logger.info('AiOverageStripeService.invoiceAllDue skipped — AI_OVERAGE_STRIPE_ENABLED off');
      return [];
    }
    const shopIds = await this.charges.listShopsWithPending();
    const results: Array<{ shopId: string; ok: boolean; error?: string }> = [];
    for (const shopId of shopIds) {
      try {
        await this.invoiceShopPending(shopId);
        results.push({ shopId, ok: true });
      } catch (e: any) {
        logger.error('AiOverageStripeService.invoiceAllDue: shop failed', { shopId, error: e?.message });
        results.push({ shopId, ok: false, error: e?.message });
      }
    }
    return results;
  }
}

export const aiOverageStripeService = new AiOverageStripeService();
