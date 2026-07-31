// backend/src/domains/PaymentsDomain/controllers/AdminRefundController.ts
//
// Platform-issued refunds (Slice A2). Mechanically this is the shop path with the scope removed
// — and that is exactly the trap. These are Connect DIRECT charges: the money sits in the shop's
// own Stripe account, so an admin refund debits the merchant (and refund_application_fee claws
// back our commission), overdrawing them if their balance is short.
//
// Three consequences, all enforced here rather than by convention:
//   - the note is mandatory; the shop reads it
//   - the refund is stamped `created_by_role = 'admin'` so the shop's own drawer can say the
//     platform did this, not one of its staff
//   - the shop is notified transactionally — a silent debit is how support tickets are made
//
// Scope this to disputes and fraud, not routine customer service: the shop can refund its own
// charges from its Payments tab, and should.

import { Request, Response } from 'express';
import { paymentRepository, adminRepository } from '../../../repositories';
import { getNotificationGateway } from '../../notification/services/NotificationGateway';
import { issueRefund } from '../services/RefundIssuer';
import { logger } from '../../../utils/logger';

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const refundTransactionAdmin = async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.getByIdAdmin(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const { amountCents, reason, note } = req.body ?? {};
    const adminAddress = req.user?.address ?? null;

    const result = await issueRefund(
      {
        payment,
        amountCents,
        reason,
        note,
        actor: 'admin',
        actorAddress: adminAddress,
      },
      { requireNote: true }
    );

    if (result.outcome === 'rejected') {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    await adminRepository
      .logAdminActivity({
        adminAddress: adminAddress ?? 'unknown',
        actionType: 'admin_payment_refunded',
        actionDescription:
          `Platform-issued refund of ${result.amountCents} cents on payment ${payment.id} ` +
          `(shop ${payment.shopId})`,
        entityType: 'payment',
        entityId: payment.id,
        metadata: {
          shopId: payment.shopId,
          refundId: result.refund.id,
          stripeRefundId: result.refund.stripeRefundId,
          amountCents: result.amountCents,
          reason: result.reason,
          note: result.refund.note,
        },
      })
      .catch((e) => logger.warn('Failed to log admin refund activity (non-fatal)', { error: e?.message }));

    // Addressed to the SHOP ID, not the wallet: a shop's login can be a social wallet that
    // differs from shops.wallet_address, and the bell resolves its inbox as
    // [req.user.address, req.user.shopId].
    await getNotificationGateway()
      .dispatch('payment_refunded_by_admin', payment.shopId, {
        message:
          `FixFlow issued a ${dollars(result.amountCents)} refund on a payment in your account. ` +
          `Reason: ${result.refund.note}`,
        metadata: {
          shopId: payment.shopId,
          paymentId: payment.id,
          refundId: result.refund.id,
          amountCents: result.amountCents,
          amountLabel: dollars(result.amountCents),
          reason: result.reason,
          note: result.refund.note,
        },
      })
      .catch((e) =>
        logger.error('Failed to notify shop of platform refund (non-fatal)', {
          shopId: payment.shopId,
          refundId: result.refund.id,
          error: (e as Error)?.message,
        })
      );

    return res.json({ success: true, data: result.refund });
  } catch (error) {
    logger.error('Error issuing platform refund:', error);
    return res.status(500).json({ success: false, error: 'Failed to issue refund' });
  }
};
