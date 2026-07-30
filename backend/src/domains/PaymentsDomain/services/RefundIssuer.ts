// backend/src/domains/PaymentsDomain/services/RefundIssuer.ts
//
// The one path that issues a refund, shared by the shop controller (Slice 1.3) and the admin
// controller (Slice A2). Extracted when A2 landed: the two callers differ only in who is
// allowed to reach them and what happens afterwards (audit wording, notifying the shop) — the
// money movement itself must not drift between them. A rule enforced on one path only is
// exactly how the platform ends up able to over-refund a charge the shop couldn't.
//
// Division of ownership is unchanged: this writes the refund ENTITY (who, why, how much).
// `payments.refunded_cents` and the payment status stay owned by the charge.refunded webhook,
// which is authoritative because a refund can also be issued from the Stripe dashboard.

import { refundRepository, shopRepository } from '../../../repositories';
import type { Payment } from '../../../repositories/PaymentRepository';
import type { Refund, RefundActor, RefundReason } from '../../../repositories/RefundRepository';
import { getStripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';

export const REFUND_REASONS: RefundReason[] = ['requested_by_customer', 'duplicate', 'fraudulent'];

export interface IssueRefundInput {
  payment: Payment;
  /** Omit to refund the whole remaining balance. */
  amountCents?: unknown;
  reason?: unknown;
  note?: unknown;
  actor: RefundActor;
  actorAddress: string | null;
}

/**
 * Discriminated on a STRING, not a boolean: this project compiles with `strict: false`, and
 * boolean-literal discriminants don't narrow in that mode — `result.error` would not typecheck.
 */
export type IssueRefundResult =
  | { outcome: 'issued'; refund: Refund; amountCents: number; reason: RefundReason }
  | { outcome: 'rejected'; status: number; error: string };

/**
 * Validate, record, and execute one refund. Returns a discriminated result rather than
 * throwing so both controllers keep their own HTTP shape while sharing every rule.
 *
 * `requireNote` is the single behavioural difference between the callers: a shop refunding its
 * own charge may leave the context blank, but the platform reaching into a merchant's balance
 * has to say why — the shop reads that note.
 */
export async function issueRefund(
  input: IssueRefundInput,
  opts: { requireNote?: boolean } = {}
): Promise<IssueRefundResult> {
  const { payment, actor, actorAddress } = input;

  if (!payment.stripePaymentIntentId) {
    return {
      outcome: 'rejected',
      status: 400,
      error: 'This payment has no Stripe PaymentIntent and cannot be refunded from FixFlow',
    };
  }
  if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
    return { outcome: 'rejected', status: 400, error: `Cannot refund a payment with status "${payment.status}"` };
  }

  if (input.reason !== undefined && !REFUND_REASONS.includes(input.reason as RefundReason)) {
    return {
      outcome: 'rejected',
      status: 400,
      error: `Invalid reason. Expected one of: ${REFUND_REASONS.join(', ')}`,
    };
  }
  const reason = (input.reason as RefundReason) ?? 'requested_by_customer';

  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 1000) : null;
  if (opts.requireNote && !note) {
    return { outcome: 'rejected', status: 400, error: 'A note explaining this refund is required' };
  }

  // Refundable = gross minus whatever Stripe already reports refunded, minus anything this side
  // has requested but not yet seen reconciled. Taking the max of the two avoids double-spending
  // the window between our Stripe call and the charge.refunded webhook.
  const requestedHere = await refundRepository.sumRequestedCents(payment.id);
  const alreadyRefunded = Math.max(payment.refundedCents, requestedHere);
  const refundable = payment.grossCents - alreadyRefunded;

  if (refundable <= 0) {
    return { outcome: 'rejected', status: 400, error: 'This payment is already fully refunded' };
  }

  const amount = input.amountCents === undefined ? refundable : Number(input.amountCents);
  if (!Number.isInteger(amount) || amount <= 0) {
    return { outcome: 'rejected', status: 400, error: 'amountCents must be a positive integer' };
  }
  if (amount > refundable) {
    return {
      outcome: 'rejected',
      status: 400,
      error: `Amount exceeds the refundable balance of ${refundable} cents`,
    };
  }

  // Direct charges live on the shop's connected account, so the refund must target it — and
  // refund_application_fee returns our commission proportionally (StripeService).
  const shop = await shopRepository.getShop(payment.shopId);
  const connectedAccountId = payment.stripeAccountId || shop?.stripeConnectAccountId;

  // Recorded BEFORE the Stripe call: if the call succeeds but the response never reaches us, a
  // pending row remains to reconcile against instead of an invisible refund.
  const refund = await refundRepository.createPending({
    paymentId: payment.id,
    shopId: payment.shopId,
    amountCents: amount,
    currency: payment.currency,
    reason,
    note,
    createdBy: actorAddress,
    createdByRole: actor,
  });

  try {
    // Always the amount-explicit call, even for a full refund: it keeps the idempotency key tied
    // to this refund row, so a retry can never issue a second one.
    const stripeRefund = await getStripeService().partialRefund(
      payment.stripePaymentIntentId,
      amount,
      reason,
      connectedAccountId,
      refund.id,
      { type: 'payments_center_refund', fixflowRefundId: refund.id, issuedBy: actor }
    );

    const updated = await refundRepository.markSucceeded(refund.id, stripeRefund.id);

    logger.info('Refund issued', {
      shopId: payment.shopId,
      paymentId: payment.id,
      refundId: refund.id,
      amountCents: amount,
      actor,
    });

    return { outcome: 'issued', refund: updated ?? refund, amountCents: amount, reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await refundRepository.markFailed(refund.id, message);
    logger.error('Refund failed at Stripe', {
      shopId: payment.shopId,
      paymentId: payment.id,
      refundId: refund.id,
      actor,
      error: message,
    });
    return { outcome: 'rejected', status: 502, error: `Refund failed: ${message}` };
  }
}
