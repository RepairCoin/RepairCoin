// backend/src/domains/PaymentsDomain/controllers/RefundController.ts
//
// Issuing refunds from FixFlow (Slice 1.3). Money leaving the shop's account, so every path
// is shop-scoped from the JWT and every attempt is recorded before Stripe is called.
//
// Division of ownership: this writes the refund ENTITY (who, why, how much). The webhook
// reconciler still owns `payments.refunded_cents` and the payment status via charge.refunded,
// because a refund issued from the Stripe dashboard never passes through here.

import { Request, Response } from 'express';
import { paymentRepository, refundRepository, adminRepository } from '../../../repositories';
import { issueRefund } from '../services/RefundIssuer';
import { logger } from '../../../utils/logger';

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

    const { amountCents, reason, note } = req.body ?? {};

    // Every rule lives in the issuer, shared with the admin path (Slice A2) so the two can't
    // diverge on what is refundable.
    const result = await issueRefund({
      payment,
      amountCents,
      reason,
      note,
      actor: 'shop',
      actorAddress: req.user?.address ?? null,
    });

    if (result.outcome === 'rejected') {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    // Audit trail — refunds are money out and need to be attributable.
    await adminRepository
      .logAdminActivity({
        adminAddress: req.user?.address ?? 'unknown',
        actionType: 'payment_refunded',
        actionDescription: `Refunded ${result.amountCents} cents on payment ${payment.id}`,
        entityType: 'payment',
        entityId: payment.id,
        metadata: {
          shopId,
          refundId: result.refund.id,
          stripeRefundId: result.refund.stripeRefundId,
          amountCents: result.amountCents,
        },
      })
      .catch((e) => logger.warn('Failed to log refund activity (non-fatal)', { error: e?.message }));

    // payments.refunded_cents / status are intentionally NOT written here — charge.refunded
    // reconciles them, and it is authoritative.
    return res.json({ success: true, data: result.refund });
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
