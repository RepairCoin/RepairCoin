// backend/src/domains/ServiceDomain/services/PaymentService.ts
import { OrderRepository, CreateOrderParams, ServiceOrder } from '../../../repositories/OrderRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { StripeService } from '../../../services/StripeService';
import { NotificationService } from '../../notification/services/NotificationService';
import { RcnRedemptionService } from './RcnRedemptionService';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { customerRepository, shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

export interface CreatePaymentIntentRequest {
  serviceId: string;
  customerAddress: string;
  bookingDate?: Date | string;
  bookingTime?: string;
  rcnToRedeem?: number;
  notes?: string;
}

/**
 * Safely extract date string from Date or string, avoiding timezone issues.
 * When Date is created from a date string like "2024-12-24", using toISOString()
 * can cause the date to shift by a day depending on timezone.
 * This function uses local date components to avoid that issue.
 */
function getDateString(date: Date | string): string {
  if (typeof date === 'string') {
    // If already a string, extract just the date part (in case it has time component)
    return date.split('T')[0];
  }
  // If Date object, use local date components to avoid timezone issues
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Convert booking date to Date object for database storage.
 * Parses date strings as local date at midnight to avoid timezone issues.
 */
function toLocalDate(date: Date | string): Date {
  if (date instanceof Date) {
    return date;
  }
  // Parse YYYY-MM-DD string as local date (not UTC)
  const [year, month, day] = date.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Normalize time string to HH:MM format.
 * PostgreSQL TIME type returns "HH:MM:SS" but frontend sends "HH:MM".
 * This ensures consistent comparison between stored and requested times.
 */
function normalizeTimeSlot(time: string): string {
  // Extract just the HH:MM part (handles "10:00:00", "10:00", etc.)
  const parts = time.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

export interface CreatePaymentIntentResponse {
  orderId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  totalAmount?: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
  finalAmount?: number;
  customerRcnBalance?: number;
}

export interface CreateStripeCheckoutResponse {
  orderId: string;
  checkoutUrl: string;
  sessionId: string;
  amount: number;
  currency: string;
  totalAmount?: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
  finalAmount?: number;
  customerRcnBalance?: number;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
}

export class PaymentService {
  private orderRepository: OrderRepository;
  private serviceRepository: ServiceRepository;
  private stripeService: StripeService;
  private notificationService: NotificationService;
  private rcnRedemptionService: RcnRedemptionService;
  private appointmentRepository: AppointmentRepository;

  constructor(stripeService: StripeService) {
    this.orderRepository = new OrderRepository();
    this.serviceRepository = new ServiceRepository();
    this.stripeService = stripeService;
    this.notificationService = new NotificationService();
    this.rcnRedemptionService = new RcnRedemptionService();
    this.appointmentRepository = new AppointmentRepository();
  }

  /**
   * Create a payment intent for a service booking
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    try {
      // Get service details
      const service = await this.serviceRepository.getServiceById(request.serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      if (!service.active) {
        throw new Error('Service is not available for booking');
      }

      // Validate time slot availability if booking date and time provided
      let bookingEndTime: string | undefined;
      if (request.bookingDate && request.bookingTime) {
        const dateStr = getDateString(request.bookingDate);

        // Get service duration
        const serviceDuration = await this.appointmentRepository.getServiceDuration(request.serviceId);
        const durationMinutes = serviceDuration?.durationMinutes || service.durationMinutes || 60;

        // Calculate booking end time
        const [hours, minutes] = request.bookingTime.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        bookingEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

        // Get time slot configuration
        const config = await this.appointmentRepository.getTimeSlotConfig(service.shopId);
        if (!config) {
          throw new Error('Shop has not configured appointment scheduling');
        }

        // Get booked slots for this date
        const bookedSlots = await this.appointmentRepository.getBookedSlots(service.shopId, dateStr);
        const normalizedRequestTime = normalizeTimeSlot(request.bookingTime);
        const bookedCount = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizedRequestTime)?.count || 0;

        // Check if time slot is available
        if (bookedCount >= config.maxConcurrentBookings) {
          throw new Error(`Time slot ${request.bookingTime} is fully booked. Please select a different time.`);
        }

        // Validate minimum notice (minBookingHours)
        // Parse booking date and time to create a proper DateTime
        const [bookingYear, bookingMonth, bookingDay] = dateStr.split('-').map(Number);
        const [bookingHour, bookingMinute] = request.bookingTime.split(':').map(Number);
        const slotDateTime = new Date(bookingYear, bookingMonth - 1, bookingDay, bookingHour, bookingMinute, 0, 0);
        const now = new Date();
        const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSlot < config.minBookingHours) {
          throw new Error(`Bookings require at least ${config.minBookingHours} hours advance notice. Please select a later time.`);
        }

        logger.info('Time slot validated', {
          shopId: service.shopId,
          date: dateStr,
          timeSlot: request.bookingTime,
          normalizedTime: normalizedRequestTime,
          bookedSlots: bookedSlots.map(s => ({ time: s.timeSlot, normalized: normalizeTimeSlot(s.timeSlot), count: s.count })),
          bookedCount,
          maxBookings: config.maxConcurrentBookings
        });
      }

      let rcnRedeemed = 0;
      let rcnDiscountUsd = 0;
      let finalAmountUsd = service.priceUsd;
      let customerRcnBalance = 0;

      // Handle RCN redemption if requested
      if (request.rcnToRedeem && request.rcnToRedeem > 0) {
        const redemption = await this.rcnRedemptionService.calculateRedemption({
          customerAddress: request.customerAddress,
          servicePriceUsd: service.priceUsd,
          shopId: service.shopId,
          rcnToRedeem: request.rcnToRedeem
        });

        if (!redemption.isValid) {
          throw new Error(redemption.error || 'Invalid RCN redemption');
        }

        rcnRedeemed = redemption.rcnRedeemed;
        rcnDiscountUsd = redemption.rcnDiscountUsd;
        finalAmountUsd = redemption.finalAmountUsd;
        customerRcnBalance = redemption.remainingBalance;
      }

      // Generate order ID
      const orderId = `ord_${uuidv4()}`;

      // Create order in database with pending status
      const orderParams: CreateOrderParams = {
        orderId,
        serviceId: request.serviceId,
        customerAddress: request.customerAddress,
        shopId: service.shopId,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmountUsd,
        bookingDate: request.bookingDate ? toLocalDate(request.bookingDate) : undefined,
        bookingTimeSlot: request.bookingTime,
        bookingEndTime,
        notes: request.notes
      };

      const order = await this.orderRepository.createOrder(orderParams);

      // Create Stripe Payment Intent for final amount (after discount)
      // Stripe uses smallest currency unit (cents for USD)
      const amountInCents = Math.round(finalAmountUsd * 100);

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          orderId: order.orderId,
          serviceId: service.serviceId,
          shopId: service.shopId,
          customerAddress: request.customerAddress,
          totalAmount: service.priceUsd.toString(),
          rcnRedeemed: rcnRedeemed.toString(),
          rcnDiscountUsd: rcnDiscountUsd.toString(),
          type: 'service_booking'
        },
        description: `Service Booking: ${service.serviceName}${rcnRedeemed > 0 ? ` (${rcnRedeemed} RCN redeemed)` : ''}`
      });

      // Update order with payment intent ID
      await this.orderRepository.updatePaymentIntent(orderId, paymentIntent.id);

      logger.info('Payment intent created for service booking', {
        orderId,
        serviceId: service.serviceId,
        paymentIntentId: paymentIntent.id,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd
      });

      return {
        orderId: order.orderId,
        clientSecret: paymentIntent.client_secret!,
        amount: finalAmountUsd,
        currency: 'usd',
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd,
        customerRcnBalance
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe Checkout session for web-based payment
   * This avoids Apple's 30% IAP fee by redirecting to browser
   */
  async createStripeCheckout(request: CreatePaymentIntentRequest): Promise<CreateStripeCheckoutResponse> {
    try {
      // Get service details
      const service = await this.serviceRepository.getServiceById(request.serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      if (!service.active) {
        throw new Error('Service is not available for booking');
      }

      // Validate time slot availability if booking date and time provided
      let bookingEndTime: string | undefined;
      if (request.bookingDate && request.bookingTime) {
        const dateStr = getDateString(request.bookingDate);

        // Get service duration
        const serviceDuration = await this.appointmentRepository.getServiceDuration(request.serviceId);
        const durationMinutes = serviceDuration?.durationMinutes || service.durationMinutes || 60;

        // Calculate booking end time
        const [hours, minutes] = request.bookingTime.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        bookingEndTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

        // Get time slot configuration
        const config = await this.appointmentRepository.getTimeSlotConfig(service.shopId);
        if (!config) {
          throw new Error('Shop has not configured appointment scheduling');
        }

        // Get booked slots for this date
        const bookedSlots = await this.appointmentRepository.getBookedSlots(service.shopId, dateStr);
        const normalizedRequestTime = normalizeTimeSlot(request.bookingTime);
        const bookedCount = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizedRequestTime)?.count || 0;

        // Check if time slot is available
        if (bookedCount >= config.maxConcurrentBookings) {
          throw new Error(`Time slot ${request.bookingTime} is fully booked. Please select a different time.`);
        }

        // Validate minimum notice (minBookingHours)
        // Parse booking date and time to create a proper DateTime
        const [bookingYear, bookingMonth, bookingDay] = dateStr.split('-').map(Number);
        const [bookingHour, bookingMinute] = request.bookingTime.split(':').map(Number);
        const slotDateTime = new Date(bookingYear, bookingMonth - 1, bookingDay, bookingHour, bookingMinute, 0, 0);
        const now = new Date();
        const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSlot < config.minBookingHours) {
          throw new Error(`Bookings require at least ${config.minBookingHours} hours advance notice. Please select a later time.`);
        }

        logger.info('Time slot validated (checkout)', {
          shopId: service.shopId,
          date: dateStr,
          timeSlot: request.bookingTime,
          normalizedTime: normalizedRequestTime,
          bookedCount,
          maxBookings: config.maxConcurrentBookings
        });
      }

      let rcnRedeemed = 0;
      let rcnDiscountUsd = 0;
      let finalAmountUsd = service.priceUsd;
      let customerRcnBalance = 0;

      // Handle RCN redemption if requested
      if (request.rcnToRedeem && request.rcnToRedeem > 0) {
        const redemption = await this.rcnRedemptionService.calculateRedemption({
          customerAddress: request.customerAddress,
          servicePriceUsd: service.priceUsd,
          shopId: service.shopId,
          rcnToRedeem: request.rcnToRedeem
        });

        if (!redemption.isValid) {
          throw new Error(redemption.error || 'Invalid RCN redemption');
        }

        rcnRedeemed = redemption.rcnRedeemed;
        rcnDiscountUsd = redemption.rcnDiscountUsd;
        finalAmountUsd = redemption.finalAmountUsd;
        customerRcnBalance = redemption.remainingBalance;
      }

      // Generate order ID
      const orderId = `ord_${uuidv4()}`;

      // Create order in database with pending status
      const orderParams: CreateOrderParams = {
        orderId,
        serviceId: request.serviceId,
        customerAddress: request.customerAddress,
        shopId: service.shopId,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmountUsd,
        bookingDate: request.bookingDate ? toLocalDate(request.bookingDate) : undefined,
        bookingTimeSlot: request.bookingTime,
        bookingEndTime,
        notes: request.notes
      };

      const order = await this.orderRepository.createOrder(orderParams);

      // Get shop details for customer info
      const shop = await shopRepository.getShop(service.shopId);

      // Create Stripe Checkout session
      const stripe = this.stripeService.getStripe();
      const amountInCents = Math.round(finalAmountUsd * 100);

      // Set redirect URLs - use deep links for mobile (shared payment success screen)
      const successUrl = `khalid2025://shared/payment-sucess?order_id=${orderId}`;
      const cancelUrl = `khalid2025://shared/payment-cancel?order_id=${orderId}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: service.serviceName,
              description: `Booking at ${shop?.name || 'Shop'}${rcnRedeemed > 0 ? ` (${rcnRedeemed} RCN discount applied)` : ''}`
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId: order.orderId,
          serviceId: service.serviceId,
          shopId: service.shopId,
          customerAddress: request.customerAddress,
          totalAmount: service.priceUsd.toString(),
          rcnRedeemed: rcnRedeemed.toString(),
          rcnDiscountUsd: rcnDiscountUsd.toString(),
          type: 'service_booking'
        }
      });

      // Update order with checkout session ID
      await this.orderRepository.updatePaymentIntent(orderId, session.id);

      logger.info('Stripe checkout session created for service booking', {
        orderId,
        serviceId: service.serviceId,
        sessionId: session.id,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd
      });

      return {
        orderId: order.orderId,
        checkoutUrl: session.url!,
        sessionId: session.id,
        amount: finalAmountUsd,
        currency: 'usd',
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd,
        customerRcnBalance
      };
    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment (called by webhook or confirmation endpoint)
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<ServiceOrder> {
    try {
      // Find order by payment intent ID
      const order = await this.orderRepository.getOrderByPaymentIntent(paymentIntentId);
      if (!order) {
        throw new Error('Order not found for payment intent');
      }

      // Process RCN redemption if any
      if (order.rcnRedeemed && order.rcnRedeemed > 0) {
        const redeemed = await this.rcnRedemptionService.processRedemption(
          order.customerAddress,
          order.rcnRedeemed,
          order.orderId,
          order.shopId
        );

        if (!redeemed) {
          logger.error('Failed to process RCN redemption, but payment succeeded', {
            orderId: order.orderId,
            rcnRedeemed: order.rcnRedeemed
          });
          // Continue with order - payment already went through
          // This should be handled manually or with a retry mechanism
        } else {
          logger.info('RCN redemption processed successfully', {
            orderId: order.orderId,
            rcnRedeemed: order.rcnRedeemed,
            discountUsd: order.rcnDiscountUsd
          });
        }
      }

      // Update order status to paid
      const updatedOrder = await this.orderRepository.updateOrderStatus(order.orderId, 'paid');

      logger.info('Payment confirmed for service order', {
        orderId: order.orderId,
        paymentIntentId,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmountUsd,
        rcnDiscount: order.rcnDiscountUsd
      });

      // Send notification to shop about new booking
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const customer = await customerRepository.getCustomer(order.customerAddress);
        const shop = await shopRepository.getShop(order.shopId);

        if (service && shop && shop.walletAddress) {
          await this.notificationService.createServiceBookingReceivedNotification(
            order.customerAddress,
            shop.walletAddress,
            customer?.name || 'Customer',
            service.serviceName,
            order.totalAmount,
            order.orderId
          );
          logger.info('Booking notification sent to shop', { shopId: order.shopId, orderId: order.orderId });
        }
      } catch (notifError) {
        logger.error('Failed to send booking notification:', notifError);
        // Don't fail the payment if notification fails
      }

      // Send booking confirmation to customer (email + in-app notification)
      try {
        const { appointmentReminderService } = await import('../../../services/AppointmentReminderService');
        await appointmentReminderService.sendBookingConfirmation(order.orderId);
        logger.info('Booking confirmation sent to customer', { orderId: order.orderId });
      } catch (confirmError) {
        logger.error('Failed to send booking confirmation:', confirmError);
        // Don't fail the payment if confirmation fails
      }

      return updatedOrder;
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment (called by webhook)
   */
  async handlePaymentFailure(paymentIntentId: string, reason?: string): Promise<void> {
    try {
      // Find order by payment intent ID
      const order = await this.orderRepository.getOrderByPaymentIntent(paymentIntentId);
      if (!order) {
        logger.warn('Order not found for failed payment intent', { paymentIntentId });
        return;
      }

      // Update order status to cancelled
      await this.orderRepository.updateOrderStatus(order.orderId, 'cancelled');

      // Add failure reason to notes if provided
      if (reason) {
        const notes = order.notes
          ? `${order.notes}\n\nPayment failed: ${reason}`
          : `Payment failed: ${reason}`;
        await this.orderRepository.updateOrderNotes(order.orderId, notes);
      }

      logger.info('Payment failed for service order', {
        orderId: order.orderId,
        paymentIntentId,
        reason
      });

      // Send notification to customer about payment failure
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        if (service) {
          await this.notificationService.createServicePaymentFailedNotification(
            order.customerAddress,
            service.serviceName,
            reason || 'Payment processing failed',
            order.orderId
          );
          logger.info('Payment failure notification sent to customer', { customerAddress: order.customerAddress, orderId: order.orderId });
        }
      } catch (notifError) {
        logger.error('Failed to send payment failure notification:', notifError);
      }
    } catch (error) {
      logger.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Process Stripe webhook event
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      logger.info('Processing Stripe webhook for services', {
        type: event.type,
        eventId: event.id
      });

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Verify this is a service payment
          if (paymentIntent.metadata?.type === 'service_booking') {
            await this.handlePaymentSuccess(paymentIntent.id);
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Verify this is a service payment
          if (paymentIntent.metadata?.type === 'service_booking') {
            const failureMessage = paymentIntent.last_payment_error?.message;
            await this.handlePaymentFailure(paymentIntent.id, failureMessage);
          }
          break;
        }

        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Verify this is a service payment
          if (paymentIntent.metadata?.type === 'service_booking') {
            await this.handlePaymentFailure(paymentIntent.id, 'Payment cancelled');
          }
          break;
        }

        default:
          logger.debug('Unhandled webhook event type for services', { type: event.type });
      }
    } catch (error) {
      logger.error('Error processing webhook event:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<ServiceOrder | null> {
    try {
      return await this.orderRepository.getOrderById(orderId);
    } catch (error) {
      logger.error('Error getting order:', error);
      throw error;
    }
  }

  /**
   * Cancel an order (only if not paid)
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'paid' || order.status === 'completed') {
        throw new Error('Cannot cancel a paid or completed order');
      }

      await this.orderRepository.updateOrderStatus(orderId, 'cancelled');

      logger.info('Order cancelled', { orderId });
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }
}
