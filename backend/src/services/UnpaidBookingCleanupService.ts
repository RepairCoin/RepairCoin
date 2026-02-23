/**
 * Unpaid Booking Cleanup Service
 *
 * Automatically cancels manual bookings that remain unpaid (status='pending', payment_status='pending')
 * for more than 24 hours. This prevents time slots from being blocked indefinitely
 * when customers don't complete payment via Send Link or QR Code.
 *
 * Created: February 18, 2026
 */

import { getSharedPool } from '../utils/database-pool';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { logger } from '../utils/logger';

const pool = getSharedPool();
const notificationService = new NotificationService();

// Run cleanup every hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Cancel bookings older than 24 hours
const EXPIRY_HOURS = 24;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Find and cancel expired unpaid bookings
 */
async function cleanupExpiredBookings(): Promise<void> {
  try {
    logger.info('Running unpaid booking cleanup...');

    // Find all unpaid manual bookings older than 24 hours
    // These are bookings created with 'qr_code' or 'send_link' payment status
    const expiredOrders = await pool.query(
      `SELECT
        so.order_id,
        so.shop_id,
        so.customer_address,
        so.booking_date,
        so.booking_time_slot,
        so.created_at,
        ss.service_name,
        s.name as shop_name,
        s.wallet_address as shop_wallet
      FROM service_orders so
      JOIN shop_services ss ON ss.service_id = so.service_id
      JOIN shops s ON s.shop_id = so.shop_id
      WHERE so.status = 'pending'
        AND so.payment_status = 'pending'
        AND so.booking_type = 'manual'
        AND so.created_at < NOW() - INTERVAL '${EXPIRY_HOURS} hours'`
    );

    if (expiredOrders.rows.length === 0) {
      logger.info('No expired unpaid bookings found');
      return;
    }

    logger.info(`Found ${expiredOrders.rows.length} expired unpaid bookings to cancel`);

    for (const order of expiredOrders.rows) {
      try {
        // Cancel the order
        await pool.query(
          `UPDATE service_orders
           SET status = 'cancelled',
               payment_status = 'cancelled',
               notes = COALESCE(notes, '') || ' | Auto-cancelled: Payment not received within 24 hours',
               updated_at = NOW()
           WHERE order_id = $1`,
          [order.order_id]
        );

        logger.info(`Auto-cancelled expired booking`, {
          orderId: order.order_id,
          shopId: order.shop_id,
          bookingDate: order.booking_date,
          createdAt: order.created_at
        });

        // Notify shop about the cancellation
        try {
          await notificationService.createNotification({
            senderAddress: 'system',
            receiverAddress: order.shop_wallet,
            notificationType: 'booking_auto_cancelled',
            message: `Booking auto-cancelled: ${order.service_name} on ${order.booking_date} - payment not received within 24 hours`,
            metadata: {
              orderId: order.order_id,
              serviceName: order.service_name,
              bookingDate: order.booking_date,
              bookingTime: order.booking_time_slot,
              reason: 'Payment not received within 24 hours'
            }
          });
        } catch (notifError) {
          logger.error('Failed to send auto-cancel notification', {
            orderId: order.order_id,
            error: notifError instanceof Error ? notifError.message : 'Unknown error'
          });
        }

      } catch (orderError) {
        logger.error('Failed to cancel expired booking', {
          orderId: order.order_id,
          error: orderError instanceof Error ? orderError.message : 'Unknown error'
        });
      }
    }

    logger.info(`Unpaid booking cleanup complete. Cancelled ${expiredOrders.rows.length} bookings`);

  } catch (error) {
    logger.error('Error in unpaid booking cleanup', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Start the cleanup scheduler
 */
export function startUnpaidBookingCleanup(): void {
  logger.info('Starting unpaid booking cleanup scheduler (runs every hour)');

  // Run immediately on startup
  cleanupExpiredBookings();

  // Then run every hour
  cleanupInterval = setInterval(cleanupExpiredBookings, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the cleanup scheduler (for graceful shutdown)
 */
export function stopUnpaidBookingCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Stopped unpaid booking cleanup scheduler');
  }
}

/**
 * Manually trigger cleanup (for testing or admin use)
 */
export async function runCleanupNow(): Promise<{ cancelled: number }> {
  await cleanupExpiredBookings();

  // Return count of recently cancelled
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM service_orders
     WHERE status = 'cancelled'
       AND notes LIKE '%Auto-cancelled%'
       AND updated_at > NOW() - INTERVAL '5 minutes'`
  );

  return { cancelled: parseInt(result.rows[0].count) };
}
