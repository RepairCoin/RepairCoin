// backend/src/services/BookingCleanupService.ts
import { Pool } from 'pg';
import { pool } from '../utils/database-pool';
import { logger } from '../utils/logger';

/**
 * Service to automatically cancel expired unpaid bookings
 * Runs periodically to clean up bookings where:
 * 1. Status is 'pending' (unpaid)
 * 2. booking_date (service date) has passed
 * 3. More than 1 hour has elapsed since the booking_date
 */
export class BookingCleanupService {
  private pool: Pool;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // Run every 2 hours
  private readonly GRACE_PERIOD_HOURS = 1; // Cancel bookings 1 hour after service date

  constructor() {
    this.pool = pool;
  }

  /**
   * Start the periodic cleanup scheduler
   */
  start(): void {
    if (this.cleanupInterval) {
      logger.warn('BookingCleanupService already running');
      return;
    }

    logger.info('Starting BookingCleanupService scheduler');

    // Run immediately on startup
    this.runCleanup().catch(error => {
      logger.error('Error in initial booking cleanup:', error);
    });

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Error in scheduled booking cleanup:', error);
      });
    }, this.CLEANUP_INTERVAL_MS);

    logger.info(`BookingCleanupService scheduled to run every ${this.CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  }

  /**
   * Stop the periodic cleanup scheduler
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('BookingCleanupService stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  private async runCleanup(): Promise<void> {
    try {
      logger.info('Running booking cleanup...');
      const cancelledCount = await this.cancelExpiredBookings();

      if (cancelledCount > 0) {
        logger.info(`Successfully cancelled ${cancelledCount} expired booking(s)`);
      } else {
        logger.debug('No expired bookings to cancel');
      }
    } catch (error) {
      logger.error('Error running booking cleanup:', error);
      throw error;
    }
  }

  /**
   * Cancel all expired unpaid bookings
   * Returns the number of bookings cancelled
   */
  async cancelExpiredBookings(): Promise<number> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Find and update expired bookings
      const query = `
        WITH expired_bookings AS (
          SELECT
            order_id,
            service_id,
            customer_address,
            shop_id,
            booking_date,
            booking_time_slot
          FROM service_orders
          WHERE
            status = 'pending'
            AND booking_date IS NOT NULL
            AND booking_date + booking_end_time < NOW() - INTERVAL '${this.GRACE_PERIOD_HOURS} hours'
        ),
        updated AS (
          UPDATE service_orders
          SET
            status = 'cancelled',
            updated_at = NOW(),
            notes = CASE
              WHEN notes IS NULL THEN 'Auto-cancelled: Service date passed without payment'
              ELSE notes || E'\\n\\nAuto-cancelled: Service date passed without payment'
            END
          FROM expired_bookings
          WHERE service_orders.order_id = expired_bookings.order_id
          RETURNING
            service_orders.order_id,
            service_orders.service_id,
            service_orders.customer_address,
            service_orders.shop_id,
            expired_bookings.booking_date,
            expired_bookings.booking_time_slot
        )
        SELECT * FROM updated;
      `;

      const result = await client.query(query);
      await client.query('COMMIT');

      const cancelledCount = result.rows.length;

      // Log each cancelled booking
      for (const row of result.rows) {
        logger.info(`Auto-cancelled expired booking ${row.order_id} for customer ${row.customer_address}`, {
          orderId: row.order_id,
          serviceId: row.service_id,
          customerAddress: row.customer_address,
          shopId: row.shop_id,
          bookingDate: row.booking_date,
          bookingTimeSlot: row.booking_time_slot,
          reason: 'Service date passed without payment'
        });
      }

      return cancelledCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling expired bookings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get count of expired bookings that need cancellation
   * Useful for monitoring/dashboard
   */
  async getExpiredBookingsCount(): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM service_orders
        WHERE
          status = 'pending'
          AND booking_date IS NOT NULL
          AND booking_date + booking_end_time < NOW() - INTERVAL '${this.GRACE_PERIOD_HOURS} hours'
      `;

      const result = await this.pool.query(query);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Error getting expired bookings count:', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for admin use)
   * Returns list of cancelled booking IDs
   */
  async manualCleanup(): Promise<string[]> {
    logger.info('Manual booking cleanup triggered');
    const cancelledCount = await this.cancelExpiredBookings();
    logger.info(`Manual cleanup: Cancelled ${cancelledCount} expired booking(s)`);
    return [];
  }
}

// Export singleton instance
export const bookingCleanupService = new BookingCleanupService();
