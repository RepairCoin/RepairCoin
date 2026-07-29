// backend/src/domains/PaymentsDomain/controllers/RefundController.ts
//
// Issuing refunds from FixFlow (Slice 1.3). Money leaving the shop's account, so every path
// is shop-scoped from the JWT and every attempt is recorded before Stripe is called.
//
// Division of ownership: this writes the refund ENTITY (who, why, how much). The webhook
// reconciler still owns `payments.refunded_cents` and the payment status via charge.refunded,
// because a refund issued from the Stripe dashboard never passes through here.

import { Request, Response } from 'express';
import { paymentRepository, refundRepository, shopRepository, adminRepository } from '../../../repositories';
import type { RefundReason } from '../../../repositories/RefundRepository';
import { getStripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';

const REASONS: RefundReason[] = ['requested_by_customer', 'duplicate', 'fraudulent'];

export const refundTransaction = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const payment = await paymentRepository.getByIdForShop(shopId, req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'This payment has no Stripe PaymentIntent and cannot be refunded from FixFlow',
      });
    }
    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      return res.status(400).json({
        success: false,
        error: `Cannot refund a payment with status "${payment.status}"`,
      });
    }

    const { amountCents, reason, note } = req.body ?? {};

    if (reason !== undefined && !REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: `Invalid reason. Expected one of: ${REASONS.join(', ')}`,
      });
    }

    // Refundable = gross minus whatever Stripe already reports refunded, minus anything this
    // side has requested but not yet seen reconciled. Taking the max of the two avoids
    // double-spending the window between our Stripe call and the charge.refunded webhook.
    const requestedHere = await refundRepository.sumRequestedCents(payment.id);
    const alreadyRefunded = Math.max(payment.refundedCents, requestedHere);
    const refundable = payment.grossCents - alreadyRefunded;

    if (refundable <= 0) {
      return res.status(400).json({ success: false, error: 'This payment is already fully refunded' });
    }

    // No amount = refund what's left.
    const amount = amountCents === undefined ? refundable : Number(amountCents);
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountCents must be a positive integer' });
    }
    if (amount > refundable) {
      return res.status(400).json({
        success: false,
        error: `Amount exceeds the refundable balance of ${refundable} cents`,
      });
    }

    // Direct charges live on the shop's connected account, so the refund must target it —
    // and refund_application_fee returns our commission proportionally (StripeService).
    const shop = await shopRepository.getShop(shopId);
    const connectedAccountId = payment.stripeAccountId || shop?.stripeConnectAccountId;

    // Recorded BEFORE the Stripe call: if the call succeeds but the response never reaches us,
    // a pending row remains to reconcile against instead of an invisible refund.
    const refund = await refundRepository.createPending({
      paymentId: payment.id,
      shopId,
      amountCents: amount,
      currency: payment.currency,
      reason: (reason as RefundReason) ?? 'requested_by_customer',
      note: typeof note === 'string' && note ? note.slice(0, 1000) : null,
      createdBy: req.user?.address ?? null,
    });

    try {
      // Always the amount-explicit call, even for a full refund: it keeps the idempotency key
      // tied to this refund row, so a retry can never issue a second one.
      const stripeRefund = await getStripeService().partialRefund(
        payment.stripePaymentIntentId,
        amount,
        (reason as RefundReason) ?? 'requested_by_customer',
        connectedAccountId,
        refund.id,
        { type: 'payments_center_refund', fixflowRefundId: refund.id }
      );

      const updated = await refundRepository.markSucceeded(refund.id, stripeRefund.id);

      // Audit trail — refunds are money out and need to be attributable.
      await adminRepository
        .logAdminActivity({
          adminAddress: req.user?.address ?? 'unknown',
          actionType: 'payment_refunded',
          actionDescription: `Refunded ${amount} cents on payment ${payment.id}`,
          entityType: 'payment',
          entityId: payment.id,
          metadata: { shopId, refundId: refund.id, stripeRefundId: stripeRefund.id, amountCents: amount },
        })
        .catch((e) => logger.warn('Failed to log refund activity (non-fatal)', { error: e?.message }));

      logger.info('Refund issued', {
        shopId,
        paymentId: payment.id,
        refundId: refund.id,
        amountCents: amount,
      });

      // payments.refunded_cents / status are intentionally NOT written here — charge.refunded
      // reconciles them, and it is authoritative.
      return res.json({ success: true, data: updated ?? refund });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await refundRepository.markFailed(refund.id, message);
      logger.error('Refund failed at Stripe', { shopId, paymentId: payment.id, refundId: refund.id, error: message });
      return res.status(502).json({ success: false, error: `Refund failed: ${message}` });
    }
  } catch (error) {
    logger.error('Error issuing refund:', error);
    return res.status(500).json({ success: false, error: 'Failed to issue refund' });
  }
};

/** Refund history for one payment — the detail drawer lists these under the amounts. */
export const listRefunds = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const payment = await paymentRepository.getByIdForShop(shopId, req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const refunds = await refundRepository.listByPayment(payment.id);
    return res.json({ success: true, data: refunds });
  } catch (error) {
    logger.error('Error listing refunds:', error);
    return res.status(500).json({ success: false, error: 'Failed to list refunds' });
  }
};
