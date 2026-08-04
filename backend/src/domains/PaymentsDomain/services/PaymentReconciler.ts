import Stripe from 'stripe';
import { paymentRepository, refundRepository, shopRepository } from '../../../repositories';
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

    const applicationFeeCents =
      typeof charge.application_fee_amount === 'number' ? charge.application_fee_amount : 0;

    // Fees/net come from the balance transaction, which lives on the CONNECTED account for
    // direct charges — retrieve it in that account's context. Best-effort: a failure here
    // just leaves fee/net at 0 rather than dropping the row.
    //
    // IMPORTANT: on a direct charge, bt.fee is the TOTAL deducted — Stripe's processing fee
    // AND our application fee. Storing it raw in fee_cents would double-count the platform
    // commission (it is also stored in application_fee_cents) and break the ledger invariant
    // gross - fee - application_fee = net. So take the Stripe-only portion from fee_details,
    // which itemises each deduction by type.
    let feeCents = 0;
    let netCents = 0;
    const btId = this.idOf(charge.balance_transaction);
    if (btId) {
      try {
        const bt = await this.stripe.balanceTransactions.retrieve(
          btId,
          accountId ? { stripeAccount: accountId } : undefined
        );
        netCents = bt.net;

        const details = bt.fee_details ?? [];
        feeCents = details.length
          ? details
              .filter((d) => d.type !== 'application_fee')
              .reduce((sum, d) => sum + (d.amount || 0), 0)
          // No itemisation (shouldn't happen, but don't guess high): subtract the application
          // fee we already know about, never below zero.
          : Math.max(0, bt.fee - applicationFeeCents);

        // The invariant should hold exactly. If it ever doesn't, the fee model has changed
        // and the Transactions screen will be quietly wrong — say so loudly rather than
        // silently shipping numbers that don't add up.
        if (charge.amount - feeCents - applicationFeeCents !== netCents) {
          logger.warn('PaymentReconciler: fee breakdown does not reconcile', {
            chargeId: charge.id,
            gross: charge.amount,
            stripeFee: feeCents,
            applicationFee: applicationFeeCents,
            net: netCents,
            btFee: bt.fee,
          });
        }
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
      applicationFeeCents,
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

  private async reconcileChargeRefunded(charge: Stripe.Charge, accountId?: string): Promise<void> {
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

    await this.linkRefundEntities(charge, existing.id, accountId);

    if (payment) {
      await eventBus.publish(
        createDomainEvent(PaymentsEvents.PAYMENT_REFUNDED, payment.id, { refundedCents, status }, 'PaymentsDomain')
      );
    }
  }

  /**
   * Settle the `refunds` rows this side created (Slice 1.3). The ledger above is authoritative
   * for how much was refunded; this only closes the loop on the refund ENTITY, so a row whose
   * Stripe response was lost stops sitting `pending` and blocking the refundable balance.
   *
   * Best-effort by design — the ledger write must stand even if this listing fails.
   */
  private async linkRefundEntities(charge: Stripe.Charge, paymentId: string, accountId?: string): Promise<void> {
    try {
      const refunds = await this.stripe.refunds.list(
        { charge: charge.id, limit: 100 },
        accountId ? { stripeAccount: accountId } : undefined
      );

      for (const refund of refunds.data) {
        if (refund.status !== 'succeeded') continue;
        const row = await refundRepository.reconcileStripeRefund({
          paymentId,
          stripeRefundId: refund.id,
          amountCents: refund.amount,
          fixflowRefundId: refund.metadata?.fixflowRefundId ?? null,
        });
        if (row) {
          logger.info('PaymentReconciler: linked refund row to Stripe refund', {
            paymentId,
            refundId: row.id,
            stripeRefundId: refund.id,
          });
        }
      }
    } catch (error) {
      logger.warn('PaymentReconciler: could not link refund entities (ledger still updated)', {
        chargeId: charge.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async reconcilePaymentFailed(pi: Stripe.PaymentIntent, accountId?: string): Promise<void> {
    const shopId =
      pi.metadata?.shopId ?? (await this.shopIdFromAccount(accountId, pi.id));
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

  /**
   * Which shop a payment belongs to.
   *
   * The charge's own metadata wins: it is stamped per payment and names the shop the money was
   * taken for. The connected account is only a fallback for charges written before that was
   * stamped, and a coarse one — several shops under an owner may share a Stripe account, and the
   * account cannot say which of them a given payment was for.
   */
  private async resolveShopId(charge: Stripe.Charge, accountId?: string): Promise<string | null> {
    const fromMetadata = charge.metadata?.shopId;
    if (fromMetadata) return fromMetadata;
    return this.shopIdFromAccount(accountId, charge.id);
  }

  /**
   * Fallback attribution by connected account. Returns null when the account is shared, rather
   * than picking a row: filing one shop's money under a sibling is worse than leaving the
   * payment unattributed, because the ledger then reads as settled under the wrong shop.
   */
  private async shopIdFromAccount(
    accountId: string | undefined,
    reference: string
  ): Promise<string | null> {
    if (!accountId) return null;

    const shopIds = await shopRepository.getShopIdsByConnectAccountId(accountId);
    if (shopIds.length === 1) return shopIds[0];

    if (shopIds.length > 1) {
      logger.warn(
        'PaymentReconciler: several shops share this connected account and the payment carries no shopId — left unattributed',
        { accountId, shopIds, reference }
      );
    }
    return null;
  }

  /**
   * A counter sale reaching the ledger before its sale is completed would otherwise be filed as a
   * booking, which is what shipped in Phase 0 when POS did not exist. Invoices and links still
   * fall through to booking until those slices land.
   */
  private sourceFromMetadata(metadata?: Stripe.Metadata | null): PaymentSource {
    return metadata?.type === 'pos_sale' ? 'terminal' : 'booking';
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
