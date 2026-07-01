// backend/src/domains/ServiceDomain/services/PaymentService.ts
import { OrderRepository, ServiceOrder } from '../../../repositories/OrderRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { StripeService } from '../../../services/StripeService';
import { NotificationService } from '../../notification/services/NotificationService';
import { NotificationGateway, getNotificationGateway } from '../../notification/services/NotificationGateway';
import { EmailService } from '../../../services/EmailService';
import { RcnRedemptionService } from './RcnRedemptionService';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { TransactionRepository } from '../../../repositories/TransactionRepository';
import { customerRepository, shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { NoShowPolicyService } from '../../../services/NoShowPolicyService';
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
import { ModerationRepository } from '../../../repositories/ModerationRepository';
import { eventBus, createDomainEvent } from '../../../events/EventBus';

export interface CreatePaymentIntentRequest {
  serviceId: string;
  customerAddress: string;
  bookingDate?: Date | string;
  bookingTime?: string;
  rcnToRedeem?: number;
  notes?: string;
  // AI chat conversation the customer booked from (conv_*), when the
  // booking originated from an AI booking card. Threaded into the Stripe
  // PaymentIntent metadata so it lands on the order row at payment success.
  conversationId?: string;
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

/**
 * Convert a wall-clock slot (YYYY-MM-DD + HH:MM) interpreted in the given
 * IANA timezone into its UTC epoch milliseconds.
 *
 * Slot times are stored and displayed in the SHOP's timezone. Advance-notice
 * math must anchor to that, not the server's local timezone — otherwise a
 * server running in UTC (e.g. DigitalOcean) miscounts the lead time by the
 * shop's UTC offset and can wrongly accept or reject a slot near the cutoff.
 */
function zonedSlotToUtcMs(dateStr: string, timeStr: string, timeZone: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  // Naive: pretend the wall time is UTC, then correct by the tz offset.
  const naiveUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(naiveUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hh = get('hour');
  if (hh === 24) hh = 0; // some Intl impls emit 24 for midnight
  const tzWallAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hh,
    get('minute'),
    get('second')
  );
  const offsetMs = tzWallAsUtcMs - naiveUtcMs;
  return naiveUtcMs - offsetMs;
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
  private notificationGateway: NotificationGateway;
  private emailService: EmailService;
  private rcnRedemptionService: RcnRedemptionService;
  private appointmentRepository: AppointmentRepository;
  private transactionRepository: TransactionRepository;
  private noShowPolicyService: NoShowPolicyService;
  private googleCalendarService: GoogleCalendarService;

  constructor(stripeService: StripeService) {
    this.orderRepository = new OrderRepository();
    this.serviceRepository = new ServiceRepository();
    this.stripeService = stripeService;
    this.notificationService = new NotificationService();
    this.notificationGateway = getNotificationGateway();
    this.emailService = new EmailService();
    this.rcnRedemptionService = new RcnRedemptionService();
    this.appointmentRepository = new AppointmentRepository();
    this.transactionRepository = new TransactionRepository();
    this.noShowPolicyService = new NoShowPolicyService();
    this.googleCalendarService = new GoogleCalendarService();
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

      // Check if the shop is suspended
      const shop = await shopRepository.getShop(service.shopId);
      if (shop?.suspendedAt) {
        throw new Error('This shop is currently suspended and cannot accept new bookings.');
      }

      // Check if customer is blocked by this shop
      const moderationRepo = new ModerationRepository();
      const isBlocked = await moderationRepo.isCustomerBlocked(service.shopId, request.customerAddress);
      if (isBlocked) {
        throw new Error('You are unable to book services at this shop. Please contact the shop for more information.');
      }

      // Check no-show policy restrictions for the customer
      const noShowPolicyService = new (await import('../../../services/NoShowPolicyService')).NoShowPolicyService();
      const customerStatus = await noShowPolicyService.getCustomerStatus(request.customerAddress, service.shopId);

      // Check if customer is suspended from booking
      if (!customerStatus.canBook) {
        const suspensionEnd = customerStatus.bookingSuspendedUntil
          ? new Date(customerStatus.bookingSuspendedUntil).toLocaleDateString()
          : 'unknown';
        throw new Error(`Your booking privileges are temporarily suspended until ${suspensionEnd} due to repeated no-shows. Please contact support if you believe this is an error.`);
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

        // Validate minimum notice (minBookingHours).
        // The slot's wall time is in the SHOP timezone — anchor it there so
        // the lead time is correct regardless of the server's timezone.
        const slotUtcMs = zonedSlotToUtcMs(
          bookingDateStr,
          request.bookingTime,
          config.timezone || 'America/New_York'
        );
        const hoursUntilSlot = (slotUtcMs - Date.now()) / (1000 * 60 * 60);

        // Apply the greater of shop's min booking hours or customer's tier-based requirement
        const requiredAdvanceHours = Math.max(config.minBookingHours, customerStatus.minimumAdvanceHours);

        if (hoursUntilSlot < requiredAdvanceHours) {
          if (customerStatus.minimumAdvanceHours > 0) {
            throw new Error(`Due to your no-show history, bookings require at least ${requiredAdvanceHours} hours advance notice. Please select a later time.`);
          } else {
            throw new Error(`Bookings require at least ${requiredAdvanceHours} hours advance notice. Please select a later time.`);
          }
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
      let finalAmountUsd = parseFloat(String(service.priceUsd)) || 0;
      let customerRcnBalance = 0;

      // Get shop policy to determine deposit amount and RCN redemption cap
      const shopPolicy = await noShowPolicyService.getShopPolicy(service.shopId);

      // Handle RCN redemption if requested
      if (request.rcnToRedeem && request.rcnToRedeem > 0) {
        // Check RCN redemption cap for caution and deposit_required tiers
        if (customerStatus.tier === 'caution' || customerStatus.tier === 'deposit_required') {
          const maxRedemptionAmount = service.priceUsd * (shopPolicy.maxRcnRedemptionPercent / 100);
          const maxRedeemableRcn = maxRedemptionAmount / 0.10; // RCN value is $0.10

          if (request.rcnToRedeem > maxRedeemableRcn) {
            throw new Error(`Due to your no-show history, you can only redeem up to ${shopPolicy.maxRcnRedemptionPercent}% of the service cost (${Math.floor(maxRedeemableRcn)} RCN). Please adjust your redemption amount.`);
          }
        }

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

      // Check deposit requirement based on customer status
      let depositAmount = 0;
      let requiresDeposit = false;

      if (customerStatus.requiresDeposit || customerStatus.tier === 'deposit_required') {
        requiresDeposit = true;
        depositAmount = parseFloat(String(shopPolicy.depositAmount)) || 0;
        finalAmountUsd = parseFloat(String(finalAmountUsd)) + depositAmount;

        logger.info('Deposit required for customer', {
          customerAddress: request.customerAddress,
          tier: customerStatus.tier,
          depositAmount,
          noShowCount: customerStatus.noShowCount
        });
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
          conversationId: request.conversationId || '',
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

      // Check if the shop is suspended
      const shopCheckout = await shopRepository.getShop(service.shopId);
      if (shopCheckout?.suspendedAt) {
        throw new Error('This shop is currently suspended and cannot accept new bookings.');
      }

      // Check if customer is blocked by this shop
      const moderationRepoCheckout = new ModerationRepository();
      const isBlockedCheckout = await moderationRepoCheckout.isCustomerBlocked(service.shopId, request.customerAddress);
      if (isBlockedCheckout) {
        throw new Error('You are unable to book services at this shop. Please contact the shop for more information.');
      }

      // Check no-show policy restrictions for the customer
      const customerStatus = await this.noShowPolicyService.getCustomerStatus(request.customerAddress, service.shopId);

      // Check if customer is suspended from booking
      if (!customerStatus.canBook) {
        const suspensionEnd = customerStatus.bookingSuspendedUntil
          ? new Date(customerStatus.bookingSuspendedUntil).toLocaleDateString()
          : 'unknown';
        throw new Error(`Your booking privileges are temporarily suspended until ${suspensionEnd} due to repeated no-shows. Please contact support if you believe this is an error.`);
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

        // Validate minimum notice — apply the greater of shop config or tier-based requirement
        // Parse booking date and time to create a proper DateTime
        const [bookingYear, bookingMonth, bookingDay] = bookingDateStr.split('-').map(Number);
        const [bookingHour, bookingMinute] = request.bookingTime.split(':').map(Number);
        const slotDateTime = new Date(bookingYear, bookingMonth - 1, bookingDay, bookingHour, bookingMinute, 0, 0);
        const now = new Date();
        const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        const requiredAdvanceHours = Math.max(config.minBookingHours, customerStatus.minimumAdvanceHours);
        if (hoursUntilSlot < requiredAdvanceHours) {
          if (customerStatus.minimumAdvanceHours > 0) {
            throw new Error(`Due to your no-show history, bookings require at least ${requiredAdvanceHours} hours advance notice. Please select a later time.`);
          } else {
            throw new Error(`Bookings require at least ${requiredAdvanceHours} hours advance notice. Please select a later time.`);
          }
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
      let finalAmountUsd = parseFloat(String(service.priceUsd)) || 0;
      let customerRcnBalance = 0;

      // Get shop policy for RCN cap and deposit
      const shopPolicy = await this.noShowPolicyService.getShopPolicy(service.shopId);

      // Handle RCN redemption if requested
      if (request.rcnToRedeem && request.rcnToRedeem > 0) {
        // Enforce RCN redemption cap for caution and deposit_required tiers
        if (customerStatus.tier === 'caution' || customerStatus.tier === 'deposit_required') {
          const maxRedemptionAmount = service.priceUsd * (shopPolicy.maxRcnRedemptionPercent / 100);
          const maxRedeemableRcn = maxRedemptionAmount / 0.10; // RCN value is $0.10

          if (request.rcnToRedeem > maxRedeemableRcn) {
            throw new Error(`Due to your no-show history, you can only redeem up to ${shopPolicy.maxRcnRedemptionPercent}% of the service cost (${Math.floor(maxRedeemableRcn)} RCN). Please adjust your redemption amount.`);
          }
        }

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

      // Check deposit requirement
      let depositAmount = 0;
      let requiresDeposit = false;
      if (customerStatus.requiresDeposit || customerStatus.tier === 'deposit_required') {
        requiresDeposit = true;
        depositAmount = parseFloat(String(shopPolicy.depositAmount)) || 0;
        finalAmountUsd = parseFloat(String(finalAmountUsd)) + depositAmount;

        logger.info('Deposit required for customer (checkout)', {
          customerAddress: request.customerAddress,
          tier: customerStatus.tier,
          depositAmount,
          noShowCount: customerStatus.noShowCount
        });
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
      const mobileScheme = process.env.MOBILE_DEEP_LINK_SCHEME || 'repaircoin';
      const successUrl = `${mobileScheme}://shared/payment-sucess?order_id=${orderId}`;
      const cancelUrl = `${mobileScheme}://shared/payment-cancel?order_id=${orderId}`;

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
        approvedAt: new Date(),
        // Soft link back to the AI chat this booking came from, if any.
        conversationId: metadata.conversationId || undefined
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

      // Send new-booking and payment-received emails to shop.
      // Both are preference-gated via sendEmailWithPreferenceCheck — will auto-
      // suppress if the shop has the respective toggle off.
      try {
        const svc = await this.serviceRepository.getServiceById(order.serviceId);
        const shp = await shopRepository.getShop(order.shopId);
        const cust = await customerRepository.getCustomer(order.customerAddress);

        if (shp?.email) {
          const { EmailService } = await import('../../../services/EmailService');
          const emailService = new EmailService();

          // Prefer customer.name; fall back to first_name + last_name; finally "Customer"
          const customerDisplayName =
            cust?.name ||
            [(cust as any)?.first_name, (cust as any)?.last_name].filter(Boolean).join(' ').trim() ||
            'Customer';

          await emailService.sendNewBookingNotification(shp.email, shp.shopId, {
            shopName: shp.name,
            customerName: customerDisplayName,
            serviceName: svc?.serviceName || 'Service',
            bookingDate: order.bookingDate ? new Date(order.bookingDate).toLocaleDateString() : 'TBD',
            bookingTime: order.bookingTime || '',
          });
          logger.info('New booking email sent to shop', { shopId: order.shopId, orderId: order.orderId });

          // Payment Received — only for orders with real payment (skip 100%-RCN redemption)
          if (order.totalAmount > 0) {
            await emailService.sendPaymentReceivedNotification(shp.email, shp.shopId, {
              shopName: shp.name,
              customerName: customerDisplayName,
              serviceName: svc?.serviceName || 'Service',
              amount: order.totalAmount,
              rcnRedeemed: order.rcnRedeemed || 0,
            });
            logger.info('Payment received email sent to shop', { shopId: order.shopId, orderId: order.orderId });
          }
        }
      } catch (emailError) {
        logger.error('Failed to send new-booking / payment-received emails to shop:', emailError);
        // Don't fail the payment if email fails
      }

      // Check if this is a first-time customer at this shop and send new customer email
      try {
        const svc = await this.serviceRepository.getServiceById(order.serviceId);
        const shp = await shopRepository.getShop(order.shopId);
        const cust = await customerRepository.getCustomer(order.customerAddress);
        if (shp?.email) {
          const { getSharedPool } = await import('../../../utils/database-pool');
          const countResult = await getSharedPool().query(
            'SELECT COUNT(*) FROM service_orders WHERE customer_address = $1 AND shop_id = $2',
            [order.customerAddress, order.shopId]
          );
          const orderCount = parseInt(countResult.rows[0].count);
          if (orderCount <= 1) {
            const { EmailService } = await import('../../../services/EmailService');
            const emailService = new EmailService();
            const newCustomerDisplayName =
              cust?.name ||
              [(cust as any)?.first_name, (cust as any)?.last_name].filter(Boolean).join(' ').trim() ||
              'New Customer';
            await emailService.sendNewCustomerNotification(shp.email, shp.shopId, {
              shopName: shp.name,
              customerName: newCustomerDisplayName,
              customerAddress: order.customerAddress,
              serviceName: svc?.serviceName || 'Service',
              bookingDate: order.bookingDate ? new Date(order.bookingDate).toLocaleDateString() : undefined,
            });
            logger.info('New customer email sent to shop', { shopId: order.shopId, customerAddress: order.customerAddress });
          }
        }
      } catch (newCustError) {
        logger.error('Failed to send new customer email:', newCustError);
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

      // Sync appointment to Google Calendar (if shop has calendar connected)
      try {
        if (order.bookingDate && order.bookingTime) {
          const service = await this.serviceRepository.getServiceById(order.serviceId);
          const customer = await customerRepository.getCustomer(order.customerAddress);

          if (service) {
            // Calculate end time (assuming 1 hour duration if not specified)
            const startTime = order.bookingTime;
            const endTime = this.calculateEndTime(startTime, 60);

            // Booking start/end are wall times in the SHOP's timezone — the
            // calendar event must be created with that same timezone or the
            // event lands at the wrong absolute instant for any non-ET shop.
            const shopConfig = await this.appointmentRepository.getTimeSlotConfig(
              order.shopId
            );
            const shopTimezone = shopConfig?.timezone || 'America/New_York';

            await this.googleCalendarService.createEvent({
              orderId: order.orderId,
              serviceName: service.serviceName,
              serviceDescription: service.description,
              customerName: customer?.name,
              customerEmail: customer?.email,
              customerPhone: customer?.phone,
              customerAddress: order.customerAddress,
              bookingDate: getDateString(order.bookingDate),
              startTime,
              endTime,
              totalAmount: order.totalAmount,
              shopTimezone,
            });
            logger.info('Calendar event created for booking', { orderId: order.orderId });
          }
        }
      } catch (calendarError) {
        logger.error('Failed to create calendar event:', calendarError);
        // Don't fail the payment if calendar sync fails
      }

      // Emit `service.order_paid` — the booking-completed beat. Subscribed by
      // AIAgentDomain's BookingConfirmationHandler, which posts a "your
      // appointment is confirmed" message into the chat when the order
      // carries a conversationId. Distinct from `service.order_completed`
      // (fired later when the shop marks the service rendered).
      //
      // handlePaymentSuccess is idempotent (early-return above when the order
      // is already paid/completed), so this fires once per order even though
      // both the confirm endpoint and the Stripe webhook call this method.
      try {
        await eventBus.publish(createDomainEvent(
          'service.order_paid',
          order.customerAddress,
          {
            orderId: order.orderId,
            customerAddress: order.customerAddress,
            shopId: order.shopId,
            serviceId: order.serviceId,
            conversationId: order.conversationId ?? null,
            bookingDate: order.bookingDate,
            bookingTime: order.bookingTime,
            totalAmount: order.totalAmount,
          },
          'ServiceDomain'
        ));
        logger.info('Service order paid event published', {
          orderId: order.orderId,
          conversationId: order.conversationId ?? null,
        });
      } catch (eventError) {
        logger.error('Failed to publish order_paid event (non-fatal):', eventError);
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

      if (order.bookingDate && order.bookingTime) {
        const dateStr = getDateString(order.bookingDate);
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = order.bookingTime.split(':').map(Number);
        const bookingDateTime = new Date(year, month - 1, day, hour, minute, 0, 0);
        const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 24) {
          throw new Error('Bookings must be cancelled at least 24 hours in advance');
        }
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

      const refundSummary = refundDetails.length > 0 ? refundDetails.join(', ') : undefined;

      // 5. Send confirmation to customer (in-app + WS + native push via gateway).
      // The gateway fans out to every channel the registry declares for
      // 'service_order_cancelled_by_customer' — the legacy createNotification
      // path used before only persisted a row (no push / no WS).
      try {
        if (service && shop) {
          await this.notificationGateway.dispatch('service_order_cancelled_by_customer', order.customerAddress, {
            message:
              `Your booking for ${service.serviceName} at ${shop.name} has been cancelled` +
              (refundSummary ? `. Refund: ${refundSummary}` : ''),
            metadata: {
              orderId,
              serviceName: service.serviceName,
              shopName: shop.name,
              cancellationReason,
              refundSummary,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notifError) {
        logger.error('Failed to send customer cancellation notification:', notifError);
      }

      // 6. Notify the shop (in-app + WS + native push via gateway) so it can free
      // the slot and see who cancelled. Previously persisted only (no push/WS).
      try {
        if (service && shop && shop.walletAddress) {
          const cancelCustomer = await customerRepository.getCustomer(order.customerAddress);
          const customerDisplayName =
            cancelCustomer?.name ||
            [(cancelCustomer as any)?.first_name, (cancelCustomer as any)?.last_name].filter(Boolean).join(' ').trim() ||
            'A customer';
          await this.notificationGateway.dispatch('service_booking_cancelled', shop.walletAddress, {
            message: `${customerDisplayName} cancelled their ${service.serviceName} booking (Order ${orderId}).`,
            metadata: {
              orderId,
              serviceName: service.serviceName,
              customerName: customerDisplayName,
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

      // 8. Delete calendar event if exists
      try {
        await this.googleCalendarService.deleteEvent(orderId, order.shopId);
        logger.info('Calendar event deleted for cancelled booking', { orderId });
      } catch (calendarError) {
        logger.error('Failed to delete calendar event:', calendarError);
        // Don't fail cancellation if calendar deletion fails
      }

      // 9. Send Refund Processed email to shop if any refund actually occurred.
      // This gives the shop a financial audit trail consistent with what
      // processShopCancellationRefund already sends on shop-initiated cancels.
      try {
        const rcnRefunded = order.rcnRedeemed || 0;
        const stripeRefunded = (order.stripePaymentIntentId && order.status === 'paid')
          ? (order.finalAmountUsd || 0)
          : 0;

        if (rcnRefunded > 0 || stripeRefunded > 0) {
          const shopForRefund = await shopRepository.getShop(order.shopId);
          if (shopForRefund?.email) {
            const svcForRefund = await this.serviceRepository.getServiceById(order.serviceId);
            const custForRefund = await customerRepository.getCustomer(order.customerAddress);
            const customerDisplayName =
              custForRefund?.name ||
              [(custForRefund as any)?.first_name, (custForRefund as any)?.last_name].filter(Boolean).join(' ').trim() ||
              'Customer';
            await this.emailService.sendRefundProcessedNotification(
              shopForRefund.email,
              shopForRefund.shopId,
              {
                shopName: shopForRefund.name,
                customerName: customerDisplayName,
                serviceName: svcForRefund?.serviceName || 'Service',
                orderId,
                rcnRefunded,
                stripeRefunded,
                cancellationReason,
              }
            );
            logger.info('Refund notification email sent to shop (customer-initiated cancel)', {
              shopId: order.shopId,
              orderId,
              rcnRefunded,
              stripeRefunded
            });
          }
        }
      } catch (refundEmailError) {
        logger.error('Failed to send refund email to shop (customer-initiated cancel):', refundEmailError);
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

          // One dispatch fans out to all channels the registry configures for
          // 'service_order_cancelled': persist (transactional → always
          // delivered even if the customer muted order updates) + WS in-app
          // broadcast + native push (web + mobile). The canonical type drives
          // the correct icon/title on both clients; the "by shop" distinction
          // lives in metadata.reason. refundSummary feeds the push body.
          await this.notificationGateway.dispatch('service_order_cancelled', order.customerAddress, {
            message: `Your booking for ${service.serviceName} at ${shop.name} has been cancelled by the shop${refundMessage}`,
            metadata: {
              orderId,
              serviceName: service.serviceName,
              shopName: shop.name,
              reason: cancellationReason.replace('shop:', ''),
              notes: cancellationNotes,
              rcnRefunded,
              stripeRefunded,
              refundSummary: refundDetails.length > 0 ? refundDetails.join(', ') : undefined,
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

      // 6. Send refund notification email to shop
      try {
        const svcForRefund = await this.serviceRepository.getServiceById(order.serviceId);
        const shopForRefund = await shopRepository.getShop(order.shopId);
        const custForRefund = await customerRepository.getCustomer(order.customerAddress);
        if (shopForRefund?.email) {
          const customerDisplayName =
            custForRefund?.name ||
            [(custForRefund as any)?.first_name, (custForRefund as any)?.last_name].filter(Boolean).join(' ').trim() ||
            'Customer';
          await this.emailService.sendRefundProcessedNotification(shopForRefund.email, shopForRefund.shopId, {
            shopName: shopForRefund.name,
            customerName: customerDisplayName,
            serviceName: svcForRefund?.serviceName || 'Service',
            orderId,
            rcnRefunded,
            stripeRefunded,
            cancellationReason: cancellationReason?.replace('shop:', '').replace(/_/g, ' '),
          });
          logger.info('Refund notification email sent to shop', { shopId: order.shopId, orderId });
        }
      } catch (refundEmailError) {
        logger.error('Failed to send refund email to shop:', refundEmailError);
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

  /**
   * Calculate end time by adding duration in minutes to start time
   * @param startTime - Time in HH:MM format
   * @param durationMinutes - Duration to add
   * @returns End time in HH:MM format
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    startDate.setMinutes(startDate.getMinutes() + durationMinutes);

    const endHours = String(startDate.getHours()).padStart(2, '0');
    const endMinutes = String(startDate.getMinutes()).padStart(2, '0');
    return `${endHours}:${endMinutes}`;
  }
}
