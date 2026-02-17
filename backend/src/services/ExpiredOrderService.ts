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

const EXPIRY_WINDOW_HOURS = 24;

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
   * Check if an order is eligible for expiration (24h past appointment)
   */
  isOrderExpired(bookingDate: Date, bookingTimeSlot: string): boolean {
    // Combine booking date and time
    const [hours, minutes] = bookingTimeSlot.split(':').map(Number);
    const appointmentTime = new Date(bookingDate);
    appointmentTime.setHours(hours, minutes, 0, 0);

    // Calculate time since appointment
    const now = new Date();
    const hoursSinceAppointment = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceAppointment >= EXPIRY_WINDOW_HOURS;
  }

  /**
   * Get orders eligible for expiration (24+ hours past appointment, still 'paid' status)
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
            -- Check if appointment time + 24 hours has passed
            (so.booking_date + COALESCE(so.booking_time_slot, so.booking_time)::time +
             '${EXPIRY_WINDOW_HOURS} hours'::interval
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
   * Process a single expired order - mark as expired and process refunds
   */
  async processExpiredOrder(order: EligibleExpiredOrder): Promise<ExpiredOrderResult> {
    const result: ExpiredOrderResult = {
      orderId: order.orderId,
      success: false,
      rcnRefunded: 0,
      stripeRefunded: 0
    };

    try {
      logger.info(`Processing expired order ${order.orderId}`, {
        customerAddress: order.customerAddress,
        shopId: order.shopId,
        bookingDate: order.bookingDate,
        bookingTimeSlot: order.bookingTimeSlot
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
            reason: `RCN refund for expired order ${order.orderId}`,
            timestamp: new Date().toISOString(),
            status: 'completed',
            metadata: {
              orderId: order.orderId,
              source: 'order_expiration',
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

      // 3. Mark order as expired in database
      await this.orderRepository.markAsExpired(order.orderId, 'SYSTEM');

      // 4. Send notification to customer
      try {
        const refundText = this.buildRefundText(result.rcnRefunded, result.stripeRefunded);
        await this.notificationService.createNotification({
          senderAddress: 'SYSTEM',
          receiverAddress: order.customerAddress,
          notificationType: 'service_appointment_expired',
          message: `Your appointment for ${order.serviceName} at ${order.shopName} has expired. ${refundText}`,
          metadata: {
            orderId: order.orderId,
            serviceName: order.serviceName,
            shopName: order.shopName,
            rcnRefunded: result.rcnRefunded,
            stripeRefunded: result.stripeRefunded,
            bookingDate: order.bookingDate,
            bookingTimeSlot: order.bookingTimeSlot,
            timestamp: new Date().toISOString()
          }
        });
        logger.info('Expired notification sent to customer', { orderId: order.orderId, customerAddress: order.customerAddress });
      } catch (notifError) {
        logger.error('Failed to send expired notification:', notifError);
      }

      // 5. Send email to customer
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
          logger.info('Expired email sent to customer', { orderId: order.orderId, customerEmail: order.customerEmail });
        }
      } catch (emailError) {
        logger.error('Failed to send expired email:', emailError);
      }

      result.success = true;
      logger.info('Order marked as expired successfully', {
        orderId: order.orderId,
        rcnRefunded: result.rcnRefunded,
        stripeRefunded: result.stripeRefunded
      });

      return result;
    } catch (error) {
      logger.error(`Error processing expired order ${order.orderId}:`, error);
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
   * Validate that an order can be completed (within 24h window)
   * Returns false if order is past the 24h expiry window
   */
  canCompleteOrder(order: ServiceOrder): { canComplete: boolean; reason?: string } {
    if (!order.bookingDate || !order.bookingTime) {
      // No booking time set, allow completion
      return { canComplete: true };
    }

    // Combine booking date and time
    const [hours, minutes] = order.bookingTime.split(':').map(Number);
    const appointmentTime = new Date(order.bookingDate);
    appointmentTime.setHours(hours, minutes, 0, 0);

    // Calculate time since appointment
    const now = new Date();
    const hoursSinceAppointment = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceAppointment >= EXPIRY_WINDOW_HOURS) {
      return {
        canComplete: false,
        reason: `Order cannot be completed after ${EXPIRY_WINDOW_HOURS} hours past the scheduled appointment time. Please contact support.`
      };
    }

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
