// backend/src/domains/ServiceDomain/services/PaymentService.ts
import { OrderRepository, ServiceOrder } from '../../../repositories/OrderRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { StripeService } from '../../../services/StripeService';
import { NotificationService } from '../../notification/services/NotificationService';
import { EmailService } from '../../../services/EmailService';
import { RcnRedemptionService } from './RcnRedemptionService';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { TransactionRepository } from '../../../repositories/TransactionRepository';
import { customerRepository, shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { NoShowPolicyService } from '../../../services/NoShowPolicyService';

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
  private emailService: EmailService;
  private rcnRedemptionService: RcnRedemptionService;
  private appointmentRepository: AppointmentRepository;
  private transactionRepository: TransactionRepository;
  private noShowPolicyService: NoShowPolicyService;

  constructor(stripeService: StripeService) {
    this.orderRepository = new OrderRepository();
    this.serviceRepository = new ServiceRepository();
    this.stripeService = stripeService;
    this.notificationService = new NotificationService();
    this.emailService = new EmailService();
    this.rcnRedemptionService = new RcnRedemptionService();
    this.appointmentRepository = new AppointmentRepository();
    this.transactionRepository = new TransactionRepository();
    this.noShowPolicyService = new NoShowPolicyService();
  }

  /**
   * Create a payment intent for a service booking
   * NOTE: Order is NOT created in DB until payment succeeds (no pending status)
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
      let bookingDateStr: string | undefined;
      if (request.bookingDate && request.bookingTime) {
        bookingDateStr = getDateString(request.bookingDate);

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
        const bookedSlots = await this.appointmentRepository.getBookedSlots(service.shopId, bookingDateStr);
        const normalizedRequestTime = normalizeTimeSlot(request.bookingTime);
        const bookedCount = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizedRequestTime)?.count || 0;

        // Check if time slot is available
        if (bookedCount >= config.maxConcurrentBookings) {
          throw new Error(`Time slot ${request.bookingTime} is fully booked. Please select a different time.`);
        }

        // Validate minimum notice (minBookingHours)
        // Parse booking date and time to create a proper DateTime
        const [bookingYear, bookingMonth, bookingDay] = bookingDateStr.split('-').map(Number);
        const [bookingHour, bookingMinute] = request.bookingTime.split(':').map(Number);
        const slotDateTime = new Date(bookingYear, bookingMonth - 1, bookingDay, bookingHour, bookingMinute, 0, 0);
        const now = new Date();
        const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSlot < config.minBookingHours) {
          throw new Error(`Bookings require at least ${config.minBookingHours} hours advance notice. Please select a later time.`);
        }

        logger.info('Time slot validated', {
          shopId: service.shopId,
          date: bookingDateStr,
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

      // Check no-show status and deposit requirement
      let depositAmount = 0;
      let requiresDeposit = false;
      try {
        const noShowStatus = await this.noShowPolicyService.getCustomerStatus(
          request.customerAddress,
          service.shopId
        );

        // Block booking if suspended
        if (noShowStatus.tier === 'suspended' && !noShowStatus.canBook) {
          throw new Error(`Booking suspended until ${noShowStatus.bookingSuspendedUntil ? new Date(noShowStatus.bookingSuspendedUntil).toLocaleDateString() : 'unknown date'}`);
        }

        // Add deposit for tier 3 customers
        if (noShowStatus.tier === 'deposit_required' || noShowStatus.requiresDeposit) {
          requiresDeposit = true;
          depositAmount = 25.00; // Default deposit amount
          finalAmountUsd += depositAmount;

          logger.info('Deposit required for customer', {
            customerAddress: request.customerAddress,
            tier: noShowStatus.tier,
            depositAmount,
            noShowCount: noShowStatus.noShowCount
          });
        }
      } catch (error) {
        logger.warn('Failed to check no-show status, proceeding without deposit', {
          error: error instanceof Error ? error.message : String(error),
          customerAddress: request.customerAddress
        });
        // Non-blocking: If no-show check fails, proceed without deposit
      }

      // Generate order ID (will be used when order is created after payment)
      const orderId = `ord_${uuidv4()}`;

      // Create Stripe Payment Intent for final amount (after discount + deposit)
      // Stripe uses smallest currency unit (cents for USD)
      // NOTE: Order is NOT created in DB - all data stored in Stripe metadata
      const amountInCents = Math.round(finalAmountUsd * 100);

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          orderId,
          serviceId: service.serviceId,
          shopId: service.shopId,
          customerAddress: request.customerAddress,
          totalAmount: service.priceUsd.toString(),
          rcnRedeemed: rcnRedeemed.toString(),
          rcnDiscountUsd: rcnDiscountUsd.toString(),
          depositAmount: depositAmount.toString(),
          requiresDeposit: requiresDeposit.toString(),
          finalAmountUsd: finalAmountUsd.toString(),
          bookingDate: bookingDateStr || '',
          bookingTime: request.bookingTime || '',
          bookingEndTime: bookingEndTime || '',
          notes: request.notes || '',
          type: 'service_booking'
        },
        description: `Service Booking: ${service.serviceName}${rcnRedeemed > 0 ? ` (${rcnRedeemed} RCN redeemed)` : ''}${depositAmount > 0 ? ` + $${depositAmount} deposit` : ''}`
      });

      logger.info('Payment intent created for service booking (order will be created on payment success)', {
        orderId,
        serviceId: service.serviceId,
        paymentIntentId: paymentIntent.id,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd
      });

      return {
        orderId,
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
   * NOTE: Order is NOT created in DB until payment succeeds (no pending status)
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
      let bookingDateStr: string | undefined;
      if (request.bookingDate && request.bookingTime) {
        bookingDateStr = getDateString(request.bookingDate);

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
        const bookedSlots = await this.appointmentRepository.getBookedSlots(service.shopId, bookingDateStr);
        const normalizedRequestTime = normalizeTimeSlot(request.bookingTime);
        const bookedCount = bookedSlots.find(slot => normalizeTimeSlot(slot.timeSlot) === normalizedRequestTime)?.count || 0;

        // Check if time slot is available
        if (bookedCount >= config.maxConcurrentBookings) {
          throw new Error(`Time slot ${request.bookingTime} is fully booked. Please select a different time.`);
        }

        // Validate minimum notice (minBookingHours)
        // Parse booking date and time to create a proper DateTime
        const [bookingYear, bookingMonth, bookingDay] = bookingDateStr.split('-').map(Number);
        const [bookingHour, bookingMinute] = request.bookingTime.split(':').map(Number);
        const slotDateTime = new Date(bookingYear, bookingMonth - 1, bookingDay, bookingHour, bookingMinute, 0, 0);
        const now = new Date();
        const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSlot < config.minBookingHours) {
          throw new Error(`Bookings require at least ${config.minBookingHours} hours advance notice. Please select a later time.`);
        }

        logger.info('Time slot validated (checkout)', {
          shopId: service.shopId,
          date: bookingDateStr,
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

      // Generate order ID (will be used when order is created after payment)
      const orderId = `ord_${uuidv4()}`;

      // Get shop details for customer info
      const shop = await shopRepository.getShop(service.shopId);

      // Create Stripe Checkout session
      // NOTE: Order is NOT created in DB - all data stored in Stripe metadata
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
          orderId,
          serviceId: service.serviceId,
          shopId: service.shopId,
          customerAddress: request.customerAddress,
          totalAmount: service.priceUsd.toString(),
          rcnRedeemed: rcnRedeemed.toString(),
          rcnDiscountUsd: rcnDiscountUsd.toString(),
          finalAmountUsd: finalAmountUsd.toString(),
          bookingDate: bookingDateStr || '',
          bookingTime: request.bookingTime || '',
          bookingEndTime: bookingEndTime || '',
          notes: request.notes || '',
          type: 'service_booking'
        }
      });

      logger.info('Stripe checkout session created (order will be created on payment success)', {
        orderId,
        serviceId: service.serviceId,
        sessionId: session.id,
        totalAmount: service.priceUsd,
        rcnRedeemed,
        rcnDiscountUsd,
        finalAmount: finalAmountUsd
      });

      return {
        orderId,
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
   * Creates order in DB from Stripe metadata (no pending status - order only exists after payment)
   * Supports both payment intent IDs (pi_xxx) and checkout session IDs (cs_xxx)
   */
  async handlePaymentSuccess(paymentIntentOrSessionId: string): Promise<ServiceOrder> {
    try {
      const stripe = this.stripeService.getStripe();
      let metadata: Stripe.Metadata;
      let paymentIntentId = paymentIntentOrSessionId;

      // Check if order already exists (idempotency check)
      const existingOrder = await this.orderRepository.getOrderByPaymentIntent(paymentIntentOrSessionId);
      if (existingOrder) {
        // If order is already paid or completed, return it (avoid duplicate processing)
        if (existingOrder.status === 'paid' || existingOrder.status === 'completed') {
          logger.info('Order already processed', { orderId: existingOrder.orderId, status: existingOrder.status });
          return existingOrder;
        }
      }

      // Get metadata from Stripe to create the order
      if (paymentIntentOrSessionId.startsWith('cs_')) {
        // It's a checkout session ID
        const session = await stripe.checkout.sessions.retrieve(paymentIntentOrSessionId);
        if (session.payment_status !== 'paid') {
          throw new Error('Checkout session payment not completed');
        }
        metadata = session.metadata || {};
        // Extract the actual PaymentIntent ID from the session for refunds to work
        paymentIntentId = (session.payment_intent as string) || paymentIntentOrSessionId;
        logger.info('Extracted PaymentIntent ID from checkout session', {
          sessionId: paymentIntentOrSessionId,
          paymentIntentId
        });
      } else {
        // It's a payment intent ID
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentOrSessionId);
        if (paymentIntent.status !== 'succeeded') {
          throw new Error('Payment intent not succeeded');
        }
        metadata = paymentIntent.metadata || {};
      }

      // Validate required metadata
      if (!metadata.orderId || !metadata.serviceId || !metadata.shopId || !metadata.customerAddress) {
        throw new Error('Missing required order metadata from payment');
      }

      // Create order from Stripe metadata with 'paid' status
      const bookingDate = metadata.bookingDate ? toLocalDate(metadata.bookingDate) : undefined;
      const order = await this.orderRepository.createOrder({
        orderId: metadata.orderId,
        serviceId: metadata.serviceId,
        customerAddress: metadata.customerAddress,
        shopId: metadata.shopId,
        totalAmount: parseFloat(metadata.totalAmount) || 0,
        rcnRedeemed: parseFloat(metadata.rcnRedeemed) || 0,
        rcnDiscountUsd: parseFloat(metadata.rcnDiscountUsd) || 0,
        finalAmountUsd: parseFloat(metadata.finalAmountUsd) || parseFloat(metadata.totalAmount) || 0,
        bookingDate,
        bookingTimeSlot: metadata.bookingTime || undefined,
        bookingEndTime: metadata.bookingEndTime || undefined,
        notes: metadata.notes || undefined,
        stripePaymentIntentId: paymentIntentId,
        status: 'paid',
        // Auto-approve on payment success
        shopApproved: true,
        approvedAt: new Date()
      });

      logger.info('Order created from successful payment', {
        orderId: order.orderId,
        paymentIntentOrSessionId,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmountUsd,
        rcnDiscount: order.rcnDiscountUsd
      });

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

      return order;
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment (called by webhook)
   * NOTE: Since orders are only created on successful payment, there's no DB order to update.
   * We just log the failure and optionally notify the customer.
   */
  async handlePaymentFailure(paymentIntentId: string, reason?: string): Promise<void> {
    try {
      // Get payment intent from Stripe to access metadata
      const stripe = this.stripeService.getStripe();
      let metadata: Stripe.Metadata = {};
      let serviceName = 'Service';

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        metadata = paymentIntent.metadata || {};

        // Get service name for notification
        if (metadata.serviceId) {
          const service = await this.serviceRepository.getServiceById(metadata.serviceId);
          if (service) {
            serviceName = service.serviceName;
          }
        }
      } catch (stripeError) {
        logger.warn('Could not retrieve payment intent details', { paymentIntentId, error: stripeError });
      }

      logger.info('Payment failed for service booking', {
        paymentIntentId,
        orderId: metadata.orderId || 'unknown',
        customerAddress: metadata.customerAddress || 'unknown',
        reason
      });

      // Send notification to customer about payment failure if we have their address
      if (metadata.customerAddress) {
        try {
          await this.notificationService.createServicePaymentFailedNotification(
            metadata.customerAddress,
            serviceName,
            reason || 'Payment processing failed',
            metadata.orderId || paymentIntentId
          );
          logger.info('Payment failure notification sent to customer', {
            customerAddress: metadata.customerAddress,
            orderId: metadata.orderId
          });
        } catch (notifError) {
          logger.error('Failed to send payment failure notification:', notifError);
        }
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
   * Cancel an order with full refund processing
   */
  async cancelOrder(
    orderId: string,
    cancellationReason: string,
    cancellationNotes?: string
  ): Promise<void> {
    try {
      const order = await this.orderRepository.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'cancelled') {
        throw new Error('Order is already cancelled');
      }

      if (order.status === 'completed') {
        throw new Error('Cannot cancel a completed order');
      }

      let refundStatus = '';
      const refundDetails: string[] = [];

      // 1. Refund RCN if any was redeemed
      if (order.rcnRedeemed && order.rcnRedeemed > 0) {
        try {
          await customerRepository.refundRcnAfterCancellation(
            order.customerAddress,
            order.rcnRedeemed
          );

          // Record the refund transaction so balance calculation reflects the refund
          await this.transactionRepository.recordTransaction({
            type: 'service_redemption_refund',
            customerAddress: order.customerAddress,
            shopId: order.shopId,
            amount: order.rcnRedeemed,
            reason: `RCN refund for cancelled order ${orderId}`,
            timestamp: new Date().toISOString(),
            status: 'completed',
            metadata: {
              orderId,
              cancellationReason,
              originalRedemptionAmount: order.rcnRedeemed,
              source: 'customer_cancellation'
            }
          });

          refundDetails.push(`${order.rcnRedeemed} RCN refunded`);
          logger.info('RCN refunded for cancelled order', {
            orderId,
            customerAddress: order.customerAddress,
            rcnAmount: order.rcnRedeemed
          });
        } catch (rcnError) {
          logger.error('Failed to refund RCN:', rcnError);
          refundDetails.push('RCN refund failed - please contact support');
        }
      }

      // 2. Process Stripe refund if payment was made
      if (order.stripePaymentIntentId && (order.status === 'paid')) {
        try {
          let paymentIntentId = order.stripePaymentIntentId;

          // If stored ID is a checkout session (cs_), retrieve the actual PaymentIntent ID
          if (paymentIntentId.startsWith('cs_')) {
            const stripe = this.stripeService.getStripe();
            const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
            if (session.payment_intent) {
              paymentIntentId = session.payment_intent as string;
              logger.info('Retrieved PaymentIntent ID from checkout session for refund', {
                sessionId: order.stripePaymentIntentId,
                paymentIntentId
              });
            } else {
              throw new Error('No PaymentIntent found in checkout session');
            }
          }

          await this.stripeService.refundPayment(
            paymentIntentId,
            'requested_by_customer'
          );
          refundDetails.push(`$${order.finalAmountUsd?.toFixed(2) || '0.00'} refunded to card`);
          logger.info('Stripe payment refunded for cancelled order', {
            orderId,
            paymentIntentId,
            amount: order.finalAmountUsd
          });
        } catch (stripeError) {
          logger.error('Failed to process Stripe refund:', stripeError);
          refundDetails.push('Payment refund initiated - may take 5-10 business days');
        }
      }

      refundStatus = refundDetails.length > 0 ? refundDetails.join(', ') : 'No refunds required';

      // 3. Update order with cancellation details
      await this.orderRepository.updateCancellationData(
        orderId,
        cancellationReason,
        cancellationNotes
      );

      // 4. Get service and shop details for notifications
      const service = await this.serviceRepository.getServiceById(order.serviceId);
      const shop = await shopRepository.getShop(order.shopId);

      // 5. Send notification to customer
      try {
        if (service) {
          await this.notificationService.createServiceOrderCancelledNotification(
            order.customerAddress,
            service.serviceName,
            orderId,
            refundStatus
          );
        }
      } catch (notifError) {
        logger.error('Failed to send customer cancellation notification:', notifError);
      }

      // 6. Send notification to shop
      try {
        if (service && shop && shop.walletAddress) {
          await this.notificationService.createNotification({
            senderAddress: 'SYSTEM',
            receiverAddress: shop.walletAddress,
            notificationType: 'service_booking_cancelled',
            message: `Booking cancelled: ${service.serviceName} (Order ${orderId})`,
            metadata: {
              orderId,
              serviceName: service.serviceName,
              cancellationReason,
              cancellationNotes,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (shopNotifError) {
        logger.error('Failed to send shop cancellation notification:', shopNotifError);
      }

      // 7. Send email notification to customer
      try {
        const customer = await customerRepository.getCustomer(order.customerAddress);
        if (customer?.email && service && shop) {
          // Format booking date and time if available
          let bookingDateStr: string | undefined;
          let bookingTimeStr: string | undefined;
          if (order.bookingDate) {
            const bookingDateTime = new Date(order.bookingDate);
            bookingDateStr = bookingDateTime.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
          if (order.bookingTime) {
            // bookingTime is stored as HH:MM or HH:MM:SS string
            const [hours, minutes] = order.bookingTime.split(':').map(Number);
            const tempDate = new Date();
            tempDate.setHours(hours, minutes, 0, 0);
            bookingTimeStr = tempDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
          }

          const rcnRefunded = order.rcnRedeemed || 0;
          const stripeRefunded = order.finalAmountUsd || 0;

          await this.emailService.sendBookingCancelledByCustomer({
            customerEmail: customer.email,
            customerName: customer.name || customer.first_name || 'Customer',
            shopName: shop.name,
            serviceName: service.serviceName,
            bookingDate: bookingDateStr,
            bookingTime: bookingTimeStr,
            cancellationReason,
            rcnRefunded,
            stripeRefunded
          });
          logger.info('Booking cancellation confirmation email sent to customer', {
            orderId,
            customerEmail: customer.email
          });
        }
      } catch (emailError) {
        logger.error('Failed to send customer cancellation email:', emailError);
      }

      logger.info('Order cancelled successfully', {
        orderId,
        cancellationReason,
        refundStatus
      });
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  /**
   * Process refund when shop cancels an order
   * Always issues full refund since shop initiated the cancellation
   */
  async processShopCancellationRefund(
    orderId: string,
    cancellationReason: string,
    cancellationNotes?: string
  ): Promise<{
    rcnRefunded: number;
    stripeRefunded: number;
    refundStatus: string;
  }> {
    logger.info('=== SHOP CANCELLATION REFUND STARTED ===', { orderId, cancellationReason });

    try {
      const order = await this.orderRepository.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      logger.info('Order found for refund', {
        orderId,
        status: order.status,
        stripePaymentIntentId: order.stripePaymentIntentId,
        finalAmountUsd: order.finalAmountUsd,
        rcnRedeemed: order.rcnRedeemed
      });

      let rcnRefunded = 0;
      let stripeRefunded = 0;
      const refundDetails: string[] = [];

      // 1. Refund RCN if any was redeemed
      if (order.rcnRedeemed && order.rcnRedeemed > 0) {
        try {
          await customerRepository.refundRcnAfterCancellation(
            order.customerAddress,
            order.rcnRedeemed
          );

          // Record the refund transaction so balance calculation reflects the refund
          await this.transactionRepository.recordTransaction({
            type: 'service_redemption_refund',
            customerAddress: order.customerAddress,
            shopId: order.shopId,
            amount: order.rcnRedeemed,
            reason: `RCN refund for cancelled order ${orderId}`,
            timestamp: new Date().toISOString(),
            status: 'completed',
            metadata: {
              orderId,
              cancellationReason,
              originalRedemptionAmount: order.rcnRedeemed,
              source: 'shop_cancellation'
            }
          });

          rcnRefunded = order.rcnRedeemed;
          refundDetails.push(`${order.rcnRedeemed} RCN refunded`);
          logger.info('RCN refunded for shop-cancelled order', {
            orderId,
            customerAddress: order.customerAddress,
            rcnAmount: order.rcnRedeemed
          });
        } catch (rcnError) {
          logger.error('Failed to refund RCN for shop cancellation:', rcnError);
          refundDetails.push('RCN refund failed - manual processing required');
        }
      }

      // 2. Process Stripe refund if payment was made
      // Check for stripePaymentIntentId existence - payment was made regardless of current status
      // Status could be 'paid', or still 'paid' with shopApproved flag (shown as 'scheduled' in UI)
      logger.info('Checking Stripe refund condition', {
        hasStripeId: !!order.stripePaymentIntentId,
        stripeId: order.stripePaymentIntentId,
        orderStatus: order.status,
        conditionResult: !!(order.stripePaymentIntentId && order.status !== 'pending')
      });

      if (order.stripePaymentIntentId && order.status !== 'pending') {
        logger.info('=== PROCESSING STRIPE REFUND ===');
        try {
          let paymentIntentId = order.stripePaymentIntentId;

          // If stored ID is a checkout session (cs_), retrieve the actual PaymentIntent ID
          if (paymentIntentId.startsWith('cs_')) {
            const stripe = this.stripeService.getStripe();
            const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
            if (session.payment_intent) {
              paymentIntentId = session.payment_intent as string;
              logger.info('Retrieved PaymentIntent ID from checkout session for refund', {
                sessionId: order.stripePaymentIntentId,
                paymentIntentId
              });
            } else {
              throw new Error('No PaymentIntent found in checkout session');
            }
          }

          await this.stripeService.refundPayment(
            paymentIntentId,
            'requested_by_customer'  // Stripe only accepts: duplicate, fraudulent, requested_by_customer
          );
          stripeRefunded = order.finalAmountUsd || 0;
          refundDetails.push(`$${stripeRefunded.toFixed(2)} refunded to card`);
          logger.info('Stripe payment refunded for shop-cancelled order', {
            orderId,
            paymentIntentId,
            amount: stripeRefunded
          });
        } catch (stripeError) {
          logger.error('Failed to process Stripe refund for shop cancellation:', stripeError);
          refundDetails.push('Payment refund initiated - may take 5-10 business days');
        }
      }

      // 3. Update order with cancellation details
      await this.orderRepository.updateCancellationData(
        orderId,
        cancellationReason,
        cancellationNotes
      );

      // 4. Send notification to customer with refund info
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const shop = await shopRepository.getShop(order.shopId);

        if (service && shop) {
          const refundMessage = refundDetails.length > 0
            ? `. Refund: ${refundDetails.join(', ')}`
            : '';

          await this.notificationService.createNotification({
            senderAddress: 'SYSTEM',
            receiverAddress: order.customerAddress,
            notificationType: 'service_cancelled_by_shop',
            message: `Your booking for ${service.serviceName} at ${shop.name} has been cancelled by the shop${refundMessage}`,
            metadata: {
              orderId,
              serviceName: service.serviceName,
              shopName: shop.name,
              reason: cancellationReason.replace('shop:', ''),
              notes: cancellationNotes,
              rcnRefunded,
              stripeRefunded,
              timestamp: new Date().toISOString()
            }
          });

          // 5. Send email notification to customer
          const customer = await customerRepository.getCustomer(order.customerAddress);
          if (customer?.email) {
            // Format booking date and time if available
            let bookingDateStr: string | undefined;
            let bookingTimeStr: string | undefined;
            if (order.bookingDate) {
              const bookingDateTime = new Date(order.bookingDate);
              bookingDateStr = bookingDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            }
            if (order.bookingTime) {
              // bookingTime is stored as HH:MM or HH:MM:SS string
              const [hours, minutes] = order.bookingTime.split(':').map(Number);
              const tempDate = new Date();
              tempDate.setHours(hours, minutes, 0, 0);
              bookingTimeStr = tempDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            }

            await this.emailService.sendBookingCancelledByShop({
              customerEmail: customer.email,
              customerName: customer.name || customer.first_name || 'Customer',
              shopName: shop.name,
              serviceName: service.serviceName,
              bookingDate: bookingDateStr,
              bookingTime: bookingTimeStr,
              cancellationReason: cancellationReason.replace('shop:', '').replace(/_/g, ' '),
              rcnRefunded,
              stripeRefunded
            });
            logger.info('Booking cancellation email sent to customer', {
              orderId,
              customerEmail: customer.email
            });
          }
        }
      } catch (notifError) {
        logger.error('Failed to send shop cancellation notification:', notifError);
      }

      logger.info('Shop cancellation processed with refund', {
        orderId,
        rcnRefunded,
        stripeRefunded,
        refundStatus: refundDetails.join(', ')
      });

      return {
        rcnRefunded,
        stripeRefunded,
        refundStatus: refundDetails.length > 0 ? refundDetails.join(', ') : 'No refunds required'
      };
    } catch (error) {
      logger.error('Error processing shop cancellation refund:', error);
      throw error;
    }
  }
}
