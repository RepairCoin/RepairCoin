// backend/src/domains/admin/routes/staleBookings.ts
//
// The backstop for the booking confirmation flow.
//
// A booking whose shop never completed it, and whose customer never answered, sits in
// 'awaiting_confirmation' indefinitely — by design, because nothing is ever
// auto-settled or auto-refunded. After 90 days it gets flagged (needs_admin_review_at)
// and appears here so a human decides while a Stripe refund is still viable.
//
// Admin auth (authMiddleware + requireAdmin) is applied globally in admin.ts.
import { Router, Request, Response } from 'express';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { customerRepository } from '../../../repositories';
import { getExpiredOrderService } from '../../../services/ExpiredOrderService';
import { getSharedPool } from '../../../utils/database-pool';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { logger } from '../../../utils/logger';

const router = Router();
const orderRepository = new OrderRepository();

interface AuthenticatedRequest extends Request {
  user?: { address: string; role: string };
  // Re-declared for the DO build's tsc, matching the pattern in moderation.ts.
  body: any;
  params: any;
  query: any;
}

/**
 * GET /api/admin/stale-bookings
 * Bookings flagged for admin review, oldest first — these have the customer's money
 * held against an unresolved booking, so age is the thing that matters.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const result = await getSharedPool().query(
      `SELECT so.order_id            AS "orderId",
              so.customer_address    AS "customerAddress",
              so.shop_id             AS "shopId",
              so.total_amount        AS "totalAmount",
              so.final_amount_usd    AS "finalAmountUsd",
              so.rcn_redeemed        AS "rcnRedeemed",
              so.booking_date        AS "bookingDate",
              so.booking_time_slot   AS "bookingTimeSlot",
              so.awaiting_confirmation_at AS "awaitingConfirmationAt",
              so.needs_admin_review_at    AS "needsAdminReviewAt",
              s.name                 AS "shopName",
              ss.service_name        AS "serviceName",
              c.name                 AS "customerName",
              c.email                AS "customerEmail",
              EXTRACT(DAY FROM NOW() - so.awaiting_confirmation_at)::int AS "daysUnresolved"
         FROM service_orders so
         JOIN shops s          ON s.shop_id = so.shop_id
         JOIN shop_services ss ON ss.service_id = so.service_id
         LEFT JOIN customers c ON LOWER(c.wallet_address) = LOWER(so.customer_address)
        WHERE so.needs_admin_review_at IS NOT NULL
          AND so.status = 'awaiting_confirmation'
        ORDER BY so.awaiting_confirmation_at ASC
        LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error listing stale bookings:', error);
    return res.status(500).json({ success: false, error: 'Failed to list stale bookings' });
  }
});

/**
 * POST /api/admin/stale-bookings/:orderId/resolve
 * Body: { action: 'complete' | 'refund', reason?: string }
 *
 * The manual decision the whole backstop exists to force. 'complete' settles it to the
 * shop and issues the customer's RCN exactly as a normal completion would; 'refund'
 * returns the money.
 */
router.post('/:orderId/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { action, reason } = req.body as { action?: string; reason?: string };

    if (action !== 'complete' && action !== 'refund') {
      return res.status(400).json({ success: false, error: "action must be 'complete' or 'refund'" });
    }

    const order = await orderRepository.getOrderWithDetails(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (order.status !== 'awaiting_confirmation') {
      return res.status(409).json({
        success: false,
        error: `This booking has already been resolved (status '${order.status}').`
      });
    }

    if (action === 'complete') {
      const updated = await orderRepository.completeOrder(orderId);

      // Same event as every other completion path — this is what mints RCN rewards.
      try {
        await eventBus.publish(createDomainEvent(
          'service.order_completed',
          updated.customerAddress,
          {
            orderId: updated.orderId,
            customerAddress: updated.customerAddress,
            shopId: updated.shopId,
            serviceId: updated.serviceId,
            totalAmount: updated.totalAmount,
            completedAt: updated.completedAt,
            completedBy: 'admin_review'
          },
          'AdminDomain'
        ));
      } catch (eventError) {
        logger.error('Error publishing order_completed event (admin review):', eventError);
      }

      logger.info('Admin resolved stale booking as completed', { orderId, admin: req.user?.address });
      return res.json({ success: true, data: updated });
    }

    // Refund: flip status first — the guard inside markCompletionReported is what makes
    // a concurrent double-resolve safe.
    const updated = await orderRepository.markCompletionReported(
      orderId,
      reason || 'Resolved by admin review after prolonged non-response'
    );
    if (!updated) {
      return res.status(409).json({ success: false, error: 'This booking has already been resolved.' });
    }

    // refundOrder gates the refund email on customerEmail, which getOrderWithDetails
    // doesn't carry — fetch it so the customer is actually told about their money.
    const customer = await customerRepository.getCustomer(order.customerAddress).catch(() => null);

    const refund = await getExpiredOrderService().refundOrder(
      {
        orderId: order.orderId,
        customerAddress: order.customerAddress,
        customerName: order.customerName || customer?.name,
        customerEmail: customer?.email,
        shopId: order.shopId,
        shopName: order.shopName || 'the shop',
        serviceId: order.serviceId,
        serviceName: order.serviceName || 'the booking',
        bookingDate: order.bookingDate as Date,
        // Combined date+time from getOrderWithDetails; the email wants just the time.
        bookingTimeSlot: (order.bookingTimeSlot || '').split('T')[1] || '',
        totalAmount: order.totalAmount,
        finalAmountUsd: order.finalAmountUsd ?? order.totalAmount,
        rcnRedeemed: order.rcnRedeemed ?? 0,
        stripePaymentIntentId: order.stripePaymentIntentId
      },
      reason || 'admin review after prolonged non-response'
    );

    logger.info('Admin resolved stale booking as refunded', {
      orderId,
      admin: req.user?.address,
      rcnRefunded: refund.rcnRefunded,
      stripeRefunded: refund.stripeRefunded
    });

    return res.json({
      success: true,
      data: { order: updated, rcnRefunded: refund.rcnRefunded, stripeRefunded: refund.stripeRefunded }
    });
  } catch (error) {
    logger.error('Error resolving stale booking:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve booking' });
  }
});

export default router;
