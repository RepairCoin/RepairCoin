// backend/src/services/ExpiredOrderService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { NotificationService } from '../domains/notification/services/NotificationService';
import { OrderRepository, ServiceOrder } from '../repositories/OrderRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { getStripeService, StripeService } from './StripeService';
import { getSharedPool } from '../utils/database-pool';
import { shopRepository, customerRepository } from '../repositories';
import { getNotificationGateway } from '../domains/notification/services/NotificationGateway';

export interface ExpiredOrderResult {
  orderId: string;
  success: boolean;
  rcnRefunded: number;
  stripeRefunded: number;
  error?: string;
}

export interface EligibleExpiredOrder {
  orderId: string;
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  shopId: string;
  shopName: string;
  shopEmail?: string;
  serviceId: string;
  serviceName: string;
  bookingDate: Date;
  bookingTimeSlot: string;
  totalAmount: number;
  finalAmountUsd: number;
  rcnRedeemed: number;
  stripePaymentIntentId?: string;
}

/**
 * How long a shop has to press "Complete" after the appointment.
 *
 * Was 24 hours, and the sweep auto-refunded anything past it — which refunded 152
 * approved-and-paid bookings purely because nobody clicked a button. A missing
 * click is not evidence the service never happened. A week covers weekends,
 * holidays and an owner away from the dashboard.
 *
 * Nothing is refunded when this elapses; see processExpiredOrder.
 */
const DEFAULT_COMPLETION_GRACE_DAYS = 7;
const COMPLETION_GRACE_HOURS = DEFAULT_COMPLETION_GRACE_DAYS * 24;

/**
 * How long after a booking reaches 'completed' the customer may still report that it
 * never happened. Per-shop override: shop_no_show_policy.completion_report_window_days.
 */
const DEFAULT_REPORT_WINDOW_DAYS = 14;

export class ExpiredOrderService {
  private emailService: EmailService;
  private notificationService: NotificationService;
  private orderRepository: OrderRepository;
  private serviceRepository: ServiceRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.orderRepository = new OrderRepository();
    this.serviceRepository = new ServiceRepository();
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * Has the shop's grace window closed on this appointment without a completion?
   */
  isPastGraceWindow(bookingDate: Date, bookingTimeSlot: string): boolean {
    // Combine booking date and time
    const [hours, minutes] = bookingTimeSlot.split(':').map(Number);
    const appointmentTime = new Date(bookingDate);
    appointmentTime.setHours(hours, minutes, 0, 0);

    // Calculate time since appointment
    const now = new Date();
    const hoursSinceAppointment = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceAppointment >= COMPLETION_GRACE_HOURS;
  }

  /**
   * Can the customer still report that a completed booking never happened?
   * Measured from completion, not from the appointment.
   */
  isWithinReportWindow(
    completedAt: Date | string,
    reportWindowDays: number = DEFAULT_REPORT_WINDOW_DAYS
  ): boolean {
    const daysSince = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= reportWindowDays;
  }

  /**
   * The shop's configured report window, falling back to the platform default.
   * Read directly rather than via NoShowPolicyService so that service's typed
   * policy shape doesn't have to grow a field only this flow uses.
   */
  async getReportWindowDays(shopId: string): Promise<number> {
    try {
      const result = await getSharedPool().query(
        `SELECT COALESCE(completion_report_window_days, $2) AS days
           FROM shop_no_show_policy WHERE shop_id = $1`,
        [shopId, DEFAULT_REPORT_WINDOW_DAYS]
      );
      return result.rows[0]?.days ?? DEFAULT_REPORT_WINDOW_DAYS;
    } catch (error) {
      logger.error('Error reading completion report window, using default:', error);
      return DEFAULT_REPORT_WINDOW_DAYS;
    }
  }

  /**
   * Shop nudge stages during the grace window. Each has its own flag column so a
   * stage fires exactly once, mirroring the reminder_24h_sent_at pattern used for
   * pre-appointment reminders.
   *
   * Deliberately lives here rather than in AppointmentReminderService: that service's
   * configs are all "appointment is N hours in the FUTURE" and customer-facing, while
   * these are past-appointment and shop-facing. This class already owns exactly the
   * right query shape (paid + past appointment + joined shop/customer/service).
   */
  private static readonly NUDGE_STAGES = [
    { hoursAfter: 24, column: 'completion_nudge_1_sent_at' },
    { hoursAfter: 72, column: 'completion_nudge_2_sent_at' },
    { hoursAfter: 144, column: 'completion_nudge_3_sent_at' }, // +6 days
  ];

  /**
   * Nudge shops whose paid bookings are still unconfirmed, before the grace window
   * closes. The goal is that most bookings never reach the customer at all.
   */
  async sendCompletionNudges(): Promise<number> {
    let sent = 0;

    // Walk the stages LATEST-FIRST and, when one fires, stamp every earlier stage too.
    //
    // Otherwise a booking that is already past +6d — true of anything in flight when
    // this first deploys, or after any sweep downtime — matches all three stages at
    // once and the shop gets three notifications in the same pass for one booking.
    // Descending order means it gets only the most urgent one.
    const stages = [...ExpiredOrderService.NUDGE_STAGES].reverse();

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      // Every stage at or before this one, in original (ascending) terms.
      const columnsToStamp = ExpiredOrderService.NUDGE_STAGES
        .filter((s) => s.hoursAfter <= stage.hoursAfter)
        .map((s) => s.column);

      try {
        const result = await getSharedPool().query(
          `SELECT so.order_id       AS "orderId",
                  so.shop_id        AS "shopId",
                  s.wallet_address  AS "shopWallet",
                  s.name            AS "shopName",
                  ss.service_name   AS "serviceName",
                  c.name            AS "customerName"
             FROM service_orders so
             JOIN shops s          ON s.shop_id = so.shop_id
             JOIN shop_services ss ON ss.service_id = so.service_id
             LEFT JOIN customers c ON LOWER(c.wallet_address) = LOWER(so.customer_address)
            WHERE so.status = 'paid'
              AND so.completed_at IS NULL
              AND so.booking_date IS NOT NULL
              AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
              AND so.${stage.column} IS NULL
              AND (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time
                   + ($1 || ' hours')::interval) < NOW()`,
          [stage.hoursAfter]
        );

        for (const row of result.rows) {
          if (!row.shopWallet) continue;
          try {
            await getNotificationGateway().dispatch('booking_completion_nudge', row.shopWallet, {
              message: `${row.customerName || 'A customer'}'s "${row.serviceName}" booking is still open. Mark it complete so payment settles.`,
              metadata: {
                orderId: row.orderId,
                shopId: row.shopId,
                serviceName: row.serviceName,
                customerName: row.customerName,
              },
            });
            // Stamp only after a successful dispatch, so a transient failure retries
            // on the next pass instead of silently skipping the nudge forever.
            // Earlier stages are stamped too — they're moot once a later one has gone
            // out, and leaving them null would re-notify for the same booking.
            await getSharedPool().query(
              `UPDATE service_orders
                  SET ${columnsToStamp.map((c) => `${c} = COALESCE(${c}, NOW())`).join(', ')}
                WHERE order_id = $1`,
              [row.orderId]
            );
            sent++;
          } catch (err) {
            logger.error(`Failed completion nudge for order ${row.orderId}:`, err);
          }
        }
      } catch (error) {
        logger.error(`Error running completion nudge stage +${stage.hoursAfter}h:`, error);
      }
    }

    if (sent > 0) logger.info(`Sent ${sent} completion nudge(s) to shops`);
    return sent;
  }

  /**
   * Reminder stages for a booking sitting in 'awaiting_confirmation', measured from
   * when it landed there.
   */
  private static readonly CONFIRMATION_REMINDER_STAGES = [
    { daysAfter: 7, column: 'confirmation_reminder_1_sent_at' },
    { daysAfter: 21, column: 'confirmation_reminder_2_sent_at' },
    { daysAfter: 45, column: 'confirmation_reminder_3_sent_at' },
  ];

  /** Days in awaiting_confirmation before a booking is escalated to an admin. */
  private static readonly ADMIN_REVIEW_AFTER_DAYS = 90;

  /**
   * Chase the customer on bookings awaiting their answer, then escalate to an admin
   * once they've been ignored long enough.
   *
   * No money moves at any stage — the booking is never auto-settled and never
   * auto-refunded. Escalation just guarantees a human eventually decides, while a
   * Stripe refund is still viable.
   */
  async sendConfirmationRemindersAndEscalate(): Promise<{ reminded: number; escalated: number }> {
    let reminded = 0;
    let escalated = 0;

    for (const stage of ExpiredOrderService.CONFIRMATION_REMINDER_STAGES) {
      try {
        const result = await getSharedPool().query(
          `SELECT so.order_id        AS "orderId",
                  so.customer_address AS "customerAddress",
                  s.name             AS "shopName",
                  ss.service_name    AS "serviceName"
             FROM service_orders so
             JOIN shops s          ON s.shop_id = so.shop_id
             JOIN shop_services ss ON ss.service_id = so.service_id
            WHERE so.status = 'awaiting_confirmation'
              AND so.awaiting_confirmation_at IS NOT NULL
              AND so.${stage.column} IS NULL
              AND so.awaiting_confirmation_at < NOW() - ($1 || ' days')::interval`,
          [stage.daysAfter]
        );

        for (const row of result.rows) {
          try {
            await getNotificationGateway().dispatch('booking_confirmation_reminder', row.customerAddress, {
              message: `Did your ${row.serviceName} booking at ${row.shopName} go ahead? Let us know so we can close it off.`,
              metadata: {
                orderId: row.orderId,
                serviceName: row.serviceName,
                shopName: row.shopName,
              },
            });
            await getSharedPool().query(
              `UPDATE service_orders SET ${stage.column} = NOW() WHERE order_id = $1`,
              [row.orderId]
            );
            reminded++;
          } catch (err) {
            logger.error(`Failed confirmation reminder for order ${row.orderId}:`, err);
          }
        }
      } catch (error) {
        logger.error(`Error running confirmation reminder stage day ${stage.daysAfter}:`, error);
      }
    }

    // Escalate the ones nobody ever answered.
    try {
      const result = await getSharedPool().query(
        `UPDATE service_orders
            SET needs_admin_review_at = NOW()
          WHERE status = 'awaiting_confirmation'
            AND needs_admin_review_at IS NULL
            AND awaiting_confirmation_at IS NOT NULL
            AND awaiting_confirmation_at < NOW() - ($1 || ' days')::interval
        RETURNING order_id`,
        [ExpiredOrderService.ADMIN_REVIEW_AFTER_DAYS]
      );
      escalated = result.rows.length;
      if (escalated > 0) {
        logger.warn(`${escalated} booking(s) escalated for admin review — unresolved for ${ExpiredOrderService.ADMIN_REVIEW_AFTER_DAYS}+ days`);
      }
    } catch (error) {
      logger.error('Error escalating stale bookings for admin review:', error);
    }

    return { reminded, escalated };
  }

  /**
   * Orders whose grace window has closed with no completion — still 'paid', more
   * than the grace window past the appointment. These are surfaced, NOT refunded.
   */
  async getExpiredOrders(): Promise<EligibleExpiredOrder[]> {
    try {
      const query = `
        SELECT
          so.order_id as "orderId",
          so.customer_address as "customerAddress",
          c.email as "customerEmail",
          c.name as "customerName",
          so.shop_id as "shopId",
          s.name as "shopName",
          s.email as "shopEmail",
          so.service_id as "serviceId",
          ss.service_name as "serviceName",
          so.booking_date as "bookingDate",
          COALESCE(so.booking_time_slot, so.booking_time) as "bookingTimeSlot",
          so.total_amount as "totalAmount",
          so.final_amount_usd as "finalAmountUsd",
          so.rcn_redeemed as "rcnRedeemed",
          so.stripe_payment_intent_id as "stripePaymentIntentId"
        FROM service_orders so
        JOIN customers c ON LOWER(c.wallet_address) = LOWER(so.customer_address)
        JOIN shops s ON s.shop_id = so.shop_id
        JOIN shop_services ss ON ss.service_id = so.service_id
        WHERE so.status = 'paid'
          AND so.booking_date IS NOT NULL
          AND COALESCE(so.booking_time_slot, so.booking_time) IS NOT NULL
          AND so.completed_at IS NULL
          AND so.expired_at IS NULL
          AND (
            -- Appointment + the completion grace window has passed
            (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time +
             '${COMPLETION_GRACE_HOURS} hours'::interval
            ) < NOW()
          )
        ORDER BY so.booking_date, COALESCE(so.booking_time_slot, so.booking_time)
      `;

      const result = await getSharedPool().query(query);
      logger.info(`Found ${result.rows.length} orders eligible for expiration`);
      return result.rows as EligibleExpiredOrder[];
    } catch (error) {
      logger.error('Error getting expired orders:', error);
      throw error;
    }
  }

  /**
   * A booking whose grace window closed without the shop completing it.
   *
   * This USED to refund the customer and mark the order expired. It no longer moves
   * any money: an uncompleted booking is not evidence the service didn't happen, and
   * treating it that way auto-refunded 152 approved-and-paid bookings.
   *
   * Instead the order parks in 'awaiting_confirmation' — not refunded, not settled —
   * where the shop can still complete it, or the customer can confirm it happened or
   * report that it didn't. A customer report is now the ONLY thing that refunds.
   */
  async processExpiredOrder(order: EligibleExpiredOrder): Promise<ExpiredOrderResult> {
    const result: ExpiredOrderResult = {
      orderId: order.orderId,
      success: false,
      rcnRefunded: 0,
      stripeRefunded: 0
    };

    try {
      const updated = await this.orderRepository.markAwaitingConfirmation(order.orderId);

      // Null means the shop completed it (or it was otherwise resolved) between the
      // sweep's SELECT and this UPDATE. Nothing to do, and not an error.
      if (!updated) {
        result.success = true;
        return result;
      }

      // Ask the customer to confirm. Best-effort — a notification failure must not
      // leave the order half-processed.
      try {
        await getNotificationGateway().dispatch('booking_awaiting_confirmation', order.customerAddress, {
          message: `Did your ${order.serviceName} booking at ${order.shopName} go ahead? Let us know so we can close it off.`,
          metadata: {
            orderId: order.orderId,
            serviceName: order.serviceName,
            shopName: order.shopName,
            shopId: order.shopId,
            bookingDate: order.bookingDate,
            bookingTimeSlot: order.bookingTimeSlot
          }
        });
      } catch (notifError) {
        logger.error('Failed to send awaiting-confirmation notification:', notifError);
      }

      result.success = true;
      logger.info('Booking parked awaiting customer confirmation', {
        orderId: order.orderId,
        shopId: order.shopId
      });
      return result;
    } catch (error) {
      logger.error(`Error parking order ${order.orderId} awaiting confirmation:`, error);
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Refund a booking's RCN and Stripe payment.
   *
   * Extracted from the old auto-expiry path and deliberately kept intact — it handles
   * the checkout-session (`cs_`) → PaymentIntent lookup and records the
   * `service_redemption_refund` transaction. In Phase 2 this becomes reachable ONLY
   * from an explicit customer report that the service never happened.
   */
  async refundOrder(order: EligibleExpiredOrder, reason: string): Promise<ExpiredOrderResult> {
    const result: ExpiredOrderResult = {
      orderId: order.orderId,
      success: false,
      rcnRefunded: 0,
      stripeRefunded: 0
    };

    try {
      logger.info(`Refunding order ${order.orderId}`, {
        customerAddress: order.customerAddress,
        shopId: order.shopId,
        reason
      });

      // 1. Refund RCN if any was redeemed
      if (order.rcnRedeemed && order.rcnRedeemed > 0) {
        try {
          await customerRepository.refundRcnAfterCancellation(
            order.customerAddress,
            order.rcnRedeemed
          );

          // Record the refund transaction
          await this.transactionRepository.recordTransaction({
            type: 'service_redemption_refund',
            customerAddress: order.customerAddress,
            shopId: order.shopId,
            amount: order.rcnRedeemed,
            reason: `RCN refund for order ${order.orderId} (${reason})`,
            timestamp: new Date().toISOString(),
            status: 'completed',
            metadata: {
              orderId: order.orderId,
              source: 'order_refund',
              refundReason: reason,
              originalRedemptionAmount: order.rcnRedeemed
            }
          });

          result.rcnRefunded = order.rcnRedeemed;
          logger.info('RCN refunded for expired order', {
            orderId: order.orderId,
            customerAddress: order.customerAddress,
            rcnAmount: order.rcnRedeemed
          });
        } catch (rcnError) {
          logger.error('Failed to refund RCN for expired order:', rcnError);
          // Continue with other refunds
        }
      }

      // 2. Process Stripe refund if payment was made
      if (order.stripePaymentIntentId) {
        try {
          let paymentIntentId = order.stripePaymentIntentId;
          const stripeService = getStripeService();

          // If stored ID is a checkout session (cs_), retrieve the actual PaymentIntent ID
          if (paymentIntentId.startsWith('cs_')) {
            const stripe = stripeService.getStripe();
            const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
            if (session.payment_intent) {
              paymentIntentId = session.payment_intent as string;
              logger.info('Retrieved PaymentIntent ID from checkout session for expired order refund', {
                sessionId: order.stripePaymentIntentId,
                paymentIntentId
              });
            } else {
              throw new Error('No PaymentIntent found in checkout session');
            }
          }

          await stripeService.refundPayment(
            paymentIntentId,
            'requested_by_customer'  // Stripe only accepts: duplicate, fraudulent, requested_by_customer
          );
          result.stripeRefunded = order.finalAmountUsd || 0;
          logger.info('Stripe payment refunded for expired order', {
            orderId: order.orderId,
            paymentIntentId,
            amount: result.stripeRefunded
          });
        } catch (stripeError) {
          logger.error('Failed to process Stripe refund for expired order:', stripeError);
          // Continue - Stripe refund may have failed but we should still mark as expired
        }
      }

      // 3. Tell the customer the money is on its way back.
      //
      // The order's own status is set by the CALLER, not here — Phase 2's report
      // endpoint moves it to 'refunded' via markCompletionReported. This method is
      // only responsible for moving money, so it can't wrongly expire an order.
      try {
        const refundText = this.buildRefundText(result.rcnRefunded, result.stripeRefunded);
        await this.notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: order.customerAddress,
          notificationType: 'service_appointment_expired',
          message: `Your booking for ${order.serviceName} at ${order.shopName} has been refunded. ${refundText}`,
          metadata: {
            orderId: order.orderId,
            serviceName: order.serviceName,
            shopName: order.shopName,
            reason,
            rcnRefunded: result.rcnRefunded,
            stripeRefunded: result.stripeRefunded,
            bookingDate: order.bookingDate,
            bookingTimeSlot: order.bookingTimeSlot,
            timestamp: new Date().toISOString()
          }
        });
        logger.info('Refund notification sent to customer', { orderId: order.orderId, customerAddress: order.customerAddress });
      } catch (notifError) {
        logger.error('Failed to send refund notification:', notifError);
      }

      // 4. Send email to customer
      try {
        if (order.customerEmail) {
          await this.emailService.sendAppointmentExpiredNotification({
            customerEmail: order.customerEmail,
            customerName: order.customerName || 'Customer',
            shopName: order.shopName,
            serviceName: order.serviceName,
            bookingDate: order.bookingDate,
            bookingTime: order.bookingTimeSlot,
            rcnRefunded: result.rcnRefunded,
            stripeRefunded: result.stripeRefunded
          });
          logger.info('Refund email sent to customer', { orderId: order.orderId, customerEmail: order.customerEmail });
        }
      } catch (emailError) {
        logger.error('Failed to send refund email:', emailError);
      }

      result.success = true;
      logger.info('Order refunded successfully', {
        orderId: order.orderId,
        reason,
        rcnRefunded: result.rcnRefunded,
        stripeRefunded: result.stripeRefunded
      });

      return result;
    } catch (error) {
      logger.error(`Error refunding order ${order.orderId}:`, error);
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Build refund text for notifications
   */
  private buildRefundText(rcnRefunded: number, stripeRefunded: number): string {
    const parts: string[] = [];

    const rcnAmount = typeof rcnRefunded === 'string' ? parseFloat(rcnRefunded) : rcnRefunded;
    const stripeAmount = typeof stripeRefunded === 'string' ? parseFloat(stripeRefunded) : stripeRefunded;

    if (rcnAmount > 0) {
      parts.push(`${rcnAmount} RCN`);
    }
    if (stripeAmount > 0) {
      parts.push(`$${stripeAmount.toFixed(2)}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `Refund: ${parts.join(' and ')} has been processed.`;
  }

  /**
   * Whether a shop may still mark an order complete.
   *
   * This used to refuse after 24 hours and tell the shop to "contact support" — so a
   * shop that noticed late could not fix its own booking, which is a large part of why
   * so many bookings were never completed at all. There is no longer a time limit:
   * a late completion is exactly the outcome we want, not one to block.
   *
   * Kept as a method (rather than deleted) because OrderController calls it and Phase 2
   * will reintroduce genuine guards here — e.g. refusing to complete an order the
   * customer has already reported as never having happened.
   */
  canCompleteOrder(_order: ServiceOrder): { canComplete: boolean; reason?: string } {
    return { canComplete: true };
  }
}

// Export singleton instance
let expiredOrderServiceInstance: ExpiredOrderService | null = null;

export const getExpiredOrderService = (): ExpiredOrderService => {
  if (!expiredOrderServiceInstance) {
    expiredOrderServiceInstance = new ExpiredOrderService();
  }
  return expiredOrderServiceInstance;
};
