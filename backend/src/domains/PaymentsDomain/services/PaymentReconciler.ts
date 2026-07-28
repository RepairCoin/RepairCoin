import Stripe from 'stripe';
import { paymentRepository, shopRepository } from '../../../repositories';
import type { PaymentSource, PaymentStatus } from '../../../repositories/PaymentRepository';
import { getStripeService } from '../../../services/StripeService';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { logger } from '../../../utils/logger';
import { PaymentsEvents } from '../events';

/**
 * Reconciles Stripe charge/refund events into the fiat `payments` ledger — the source of
 * truth for the Payments & Invoicing Center. Request-time writes are provisional; this makes
 * the ledger match Stripe. Idempotent via PaymentRepository.upsertByPaymentIntent, so a
 * re-delivered event never creates a duplicate row.
 */
export class PaymentReconciler {
  private get stripe(): Stripe {
    return getStripeService().getStripe();
  }

  /** Entry point wired into the Stripe webhook switch (Slice 0.4). */
  async handleEvent(event: Stripe.Event): Promise<void> {
    // For Connect direct charges, event.account is the connected (shop) account the charge
    // lives on; for platform-account events it's undefined.
    const accountId = event.account ?? undefined;
    switch (event.type) {
      case 'charge.succeeded':
      case 'charge.updated':
        await this.reconcileChargeSucceeded(event.data.object as Stripe.Charge, accountId);
        break;
      case 'charge.refunded':
        await this.reconcileChargeRefunded(event.data.object as Stripe.Charge, accountId);
        break;
      case 'payment_intent.payment_failed':
        await this.reconcilePaymentFailed(event.data.object as Stripe.PaymentIntent, accountId);
        break;
      default:
        break;
    }
  }

  private async reconcileChargeSucceeded(charge: Stripe.Charge, accountId?: string): Promise<void> {
    const paymentIntentId = this.idOf(charge.payment_intent);
    if (!paymentIntentId) return; // ledger is keyed by PaymentIntent; ignore PI-less charges

    const shopId = await this.resolveShopId(charge, accountId);
    if (!shopId) {
      logger.warn('PaymentReconciler: could not resolve shop for charge', { chargeId: charge.id, accountId });
      return;
    }

    // Fees/net come from the balance transaction, which lives on the CONNECTED account for
    // direct charges — retrieve it in that account's context. Best-effort: a failure here
    // just leaves fee/net at 0 rather than dropping the row.
    let feeCents = 0;
    let netCents = 0;
    const btId = this.idOf(charge.balance_transaction);
    if (btId) {
      try {
        const bt = await this.stripe.balanceTransactions.retrieve(
          btId,
          accountId ? { stripeAccount: accountId } : undefined
        );
        feeCents = bt.fee;
        netCents = bt.net;
      } catch (error) {
        logger.warn('PaymentReconciler: balance transaction fetch failed', {
          chargeId: charge.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const payment = await paymentRepository.upsertByPaymentIntent({
      shopId,
      stripePaymentIntentId: paymentIntentId,
      method: 'card',
      source: this.sourceFromMetadata(charge.metadata),
      grossCents: charge.amount,
      feeCents,
      applicationFeeCents: typeof charge.application_fee_amount === 'number' ? charge.application_fee_amount : 0,
      netCents,
      currency: charge.currency,
      status: 'succeeded',
      customerAddress: this.lower(charge.metadata?.customerAddress),
      orderId: charge.metadata?.orderId ?? null,
      stripeChargeId: charge.id,
      stripeAccountId: accountId ?? null,
      capturedAt: new Date(charge.created * 1000).toISOString(),
      metadata: { chargeStatus: charge.status },
    });

    await eventBus.publish(
      createDomainEvent(PaymentsEvents.PAYMENT_RECORDED, payment.id, { shopId, paymentIntentId }, 'PaymentsDomain')
    );
  }

  private async reconcileChargeRefunded(charge: Stripe.Charge, _accountId?: string): Promise<void> {
    const paymentIntentId = this.idOf(charge.payment_intent);
    if (!paymentIntentId) return;

    const existing = await paymentRepository.getByPaymentIntent(paymentIntentId);
    if (!existing) {
      logger.warn('PaymentReconciler: refund for unknown payment', { chargeId: charge.id, paymentIntentId });
      return;
    }

    const refundedCents = charge.amount_refunded ?? 0;
    const status: PaymentStatus = refundedCents >= charge.amount ? 'refunded' : 'partially_refunded';
    const payment = await paymentRepository.markRefunded(existing.id, refundedCents, status);

    if (payment) {
      await eventBus.publish(
        createDomainEvent(PaymentsEvents.PAYMENT_REFUNDED, payment.id, { refundedCents, status }, 'PaymentsDomain')
      );
    }
  }

  private async reconcilePaymentFailed(pi: Stripe.PaymentIntent, accountId?: string): Promise<void> {
    const shopId =
      (accountId ? (await shopRepository.getShopByConnectAccountId(accountId))?.shopId : null) ??
      pi.metadata?.shopId ??
      null;
    if (!shopId) return;

    await paymentRepository.upsertByPaymentIntent({
      shopId,
      stripePaymentIntentId: pi.id,
      method: 'card',
      source: this.sourceFromMetadata(pi.metadata),
      grossCents: pi.amount,
      currency: pi.currency,
      status: 'failed',
      customerAddress: this.lower(pi.metadata?.customerAddress),
      orderId: pi.metadata?.orderId ?? null,
      stripeAccountId: accountId ?? null,
      metadata: { lastPaymentError: pi.last_payment_error?.message ?? null },
    });
  }

  private async resolveShopId(charge: Stripe.Charge, accountId?: string): Promise<string | null> {
    if (accountId) {
      const shop = await shopRepository.getShopByConnectAccountId(accountId);
      if (shop) return shop.shopId;
    }
    return charge.metadata?.shopId ?? null;
  }

  // Phase 0 only reconciles the existing booking direct charges; later slices set source
  // explicitly for invoices/terminal/links.
  private sourceFromMetadata(metadata?: Stripe.Metadata | null): PaymentSource {
    return metadata?.type === 'service_booking' ? 'booking' : 'booking';
  }

  private idOf(v: string | { id: string } | null | undefined): string | null {
    if (!v) return null;
    return typeof v === 'string' ? v : v.id;
  }

  private lower(v: string | null | undefined): string | null {
    return v ? v.toLowerCase() : null;
  }
}

let reconciler: PaymentReconciler | null = null;
export function getPaymentReconciler(): PaymentReconciler {
  if (!reconciler) reconciler = new PaymentReconciler();
  return reconciler;
}
