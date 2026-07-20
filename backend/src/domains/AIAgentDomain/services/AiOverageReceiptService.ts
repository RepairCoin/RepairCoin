// backend/src/domains/AIAgentDomain/services/AiOverageReceiptService.ts
//
// T3.2 prod-readiness (#3 must-have): emails a branded receipt when an AI Usage Overage invoice is paid.
// The biggest lever against "surprise bill" disputes — the shop gets a clear receipt + a link to the
// official Stripe invoice/PDF the moment the card is charged.
//
// Sent from exactly ONE of two places per payment, so a shop is never double-emailed:
//   - immediate collection → AiOverageStripeService.invoiceShopPending (status resolves to 'paid')
//   - delayed collection    → the invoice.payment_succeeded webhook, only when it flips a row to paid
// Best-effort: a send failure never affects billing (the charge already succeeded).

import { logger } from '../../../utils/logger';
import { resendEmailService } from '../../../services/ResendEmailService';
import { shopRepository } from '../../../repositories';

/** A Stripe invoice-ish shape — works for both the object returned by createImmediateInvoice and the one
 *  in the invoice.payment_succeeded webhook event. */
interface StripeInvoiceLike {
  id?: string;
  number?: string;
  customer_email?: string | null;
  amount_paid?: number;
  total?: number;
  currency?: string;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  metadata?: Record<string, any> | null;
}

export class AiOverageReceiptService {
  /** Send the receipt for a paid overage invoice. Resolves the recipient from the invoice's
   *  customer_email, falling back to the shop's email. No-op (logged) if neither is available. */
  async sendReceipt(invoice: StripeInvoiceLike, shopId?: string): Promise<void> {
    try {
      let to = invoice?.customer_email || undefined;
      if (!to && shopId) {
        const shop = await shopRepository.getShop(shopId).catch(() => null);
        to = (shop as any)?.email || (shop as any)?.contactEmail || undefined;
      }
      if (!to) {
        logger.warn('AI overage receipt: no recipient email', { shopId, invoiceId: invoice?.id });
        return;
      }

      const cents = invoice?.amount_paid ?? invoice?.total ?? 0;
      const amount = (cents / 100).toFixed(2);
      const currency = (invoice?.currency || 'usd').toUpperCase();
      const number = invoice?.number || invoice?.id || '';
      const hosted = invoice?.hosted_invoice_url || undefined;
      const pdf = invoice?.invoice_pdf || undefined;

      const res = await resendEmailService.sendEmail({
        to,
        subject: `Your AI Usage Overage receipt — ${currency} $${amount}`,
        html: this.buildHtml({ amount, currency, number, hosted, pdf }),
      });
      if (!res.success) {
        logger.warn('AI overage receipt send failed', { to, invoiceId: invoice?.id, error: res.error });
      } else {
        logger.info('AI overage receipt sent', { to, invoiceId: invoice?.id, messageId: res.messageId });
      }
    } catch (err) {
      logger.error('AI overage receipt error', { shopId, invoiceId: invoice?.id, error: (err as Error)?.message });
    }
  }

  private buildHtml(v: { amount: string; currency: string; number: string; hosted?: string; pdf?: string }): string {
    const button = (label: string, url?: string) =>
      url
        ? `<a href="${url}" style="display:inline-block;padding:10px 18px;margin:6px 8px 0 0;border-radius:8px;background:#FFCC00;color:#111;font-weight:600;text-decoration:none;font-size:14px;">${label}</a>`
        : '';
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;font-size:16px;line-height:1.5;">
  <div style="padding:20px 0;border-bottom:2px solid #FFCC00;">
    <span style="font-size:20px;font-weight:700;">RepairCoin</span>
    <span style="color:#888;"> · Receipt</span>
  </div>
  <h1 style="font-size:20px;margin:24px 0 8px;">AI Usage Overage</h1>
  <p style="margin:0 0 16px;color:#444;">
    Thanks — we’ve charged your card on file for this period’s AI usage beyond your monthly allowance,
    billed at 3× your actual AI cost (Usage&nbsp;×3).
  </p>
  <div style="background:#faf7ea;border:1px solid #f0e6b8;border-radius:10px;padding:16px 18px;margin:0 0 16px;">
    <div style="font-size:14px;color:#666;">Amount charged</div>
    <div style="font-size:26px;font-weight:700;color:#111;">${v.currency} $${v.amount}</div>
    ${v.number ? `<div style="font-size:13px;color:#888;margin-top:6px;">Invoice ${v.number}</div>` : ''}
  </div>
  <div>${button('View invoice', v.hosted)}${button('Download PDF', v.pdf)}</div>
  <p style="margin:20px 0 0;font-size:14px;color:#666;">
    You can set a monthly overage cap, or turn overage off entirely, anytime in
    <strong>Plans &amp; Billing</strong>. When overage is off, your AI keeps working on your included allowance.
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#aaa;">
    Questions about this charge? Reply to this email and our team will help.
  </p>
</div>`.trim();
  }
}

export const aiOverageReceiptService = new AiOverageReceiptService();
