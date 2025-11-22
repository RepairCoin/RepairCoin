// backend/src/domains/ServiceDomain/services/PaymentService.ts
import { OrderRepository, CreateOrderParams, ServiceOrder } from '../../../repositories/OrderRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { StripeService } from '../../../services/StripeService';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

export interface CreatePaymentIntentRequest {
  serviceId: string;
  customerAddress: string;
  bookingDate?: Date;
  notes?: string;
}

export interface CreatePaymentIntentResponse {
  orderId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
}

export class PaymentService {
  private orderRepository: OrderRepository;
  private serviceRepository: ServiceRepository;
  private stripeService: StripeService;

  constructor(stripeService: StripeService) {
    this.orderRepository = new OrderRepository();
    this.serviceRepository = new ServiceRepository();
    this.stripeService = stripeService;
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

      // Generate order ID
      const orderId = `ord_${uuidv4()}`;

      // Create order in database with pending status
      const orderParams: CreateOrderParams = {
        orderId,
        serviceId: request.serviceId,
        customerAddress: request.customerAddress,
        shopId: service.shopId,
        totalAmount: service.priceUsd,
        bookingDate: request.bookingDate,
        notes: request.notes
      };

      const order = await this.orderRepository.createOrder(orderParams);

      // Create Stripe Payment Intent
      // Stripe uses smallest currency unit (cents for USD)
      const amountInCents = Math.round(service.priceUsd * 100);

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          orderId: order.orderId,
          serviceId: service.serviceId,
          shopId: service.shopId,
          customerAddress: request.customerAddress,
          type: 'service_booking'
        },
        description: `Service Booking: ${service.serviceName}`
      });

      // Update order with payment intent ID
      await this.orderRepository.updatePaymentIntent(orderId, paymentIntent.id);

      logger.info('Payment intent created for service booking', {
        orderId,
        serviceId: service.serviceId,
        paymentIntentId: paymentIntent.id,
        amount: service.priceUsd
      });

      return {
        orderId: order.orderId,
        clientSecret: paymentIntent.client_secret!,
        amount: service.priceUsd,
        currency: 'usd'
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
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

      // Update order status to paid
      const updatedOrder = await this.orderRepository.updateOrderStatus(order.orderId, 'paid');

      logger.info('Payment confirmed for service order', {
        orderId: order.orderId,
        paymentIntentId,
        amount: order.totalAmount
      });

      // TODO: Emit event for potential RCN rewards integration
      // eventBus.emit('service:order_paid', { orderId, customerId, shopId, amount });

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
