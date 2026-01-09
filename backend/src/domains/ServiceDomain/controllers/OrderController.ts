// backend/src/domains/ServiceDomain/controllers/OrderController.ts
import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { NotificationService } from '../../notification/services/NotificationService';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AffiliateShopGroupService } from '../../../services/AffiliateShopGroupService';
import { getExpoPushService } from '../../../services/ExpoPushService';

export class OrderController {
  private paymentService: PaymentService;
  private orderRepository: OrderRepository;
  private notificationService: NotificationService;
  private serviceRepository: ServiceRepository;
  private groupService: AffiliateShopGroupService;

  constructor(paymentService: PaymentService) {
    this.paymentService = paymentService;
    this.orderRepository = new OrderRepository();
    this.notificationService = new NotificationService();
    this.serviceRepository = new ServiceRepository();
    this.groupService = new AffiliateShopGroupService();
  }

  /**
   * Create payment intent for service booking (Customer)
   * POST /api/services/orders/create-payment-intent
   */
  createPaymentIntent = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { serviceId, bookingDate, bookingTime, rcnToRedeem, notes } = req.body;

      if (!serviceId) {
        return res.status(400).json({ success: false, error: 'Service ID is required' });
      }

      // Validate that appointment date and time are provided
      if (!bookingDate) {
        return res.status(400).json({ success: false, error: 'Booking date is required. Please select an appointment date.' });
      }

      if (!bookingTime) {
        return res.status(400).json({ success: false, error: 'Booking time is required. Please select an appointment time slot.' });
      }

      const result = await this.paymentService.createPaymentIntent({
        serviceId,
        customerAddress,
        bookingDate: new Date(bookingDate),
        bookingTime,
        rcnToRedeem: rcnToRedeem ? parseFloat(rcnToRedeem) : undefined,
        notes
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      logger.error('Error in createPaymentIntent controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent'
      });
    }
  };

  /**
   * Create Stripe Checkout session for web-based service booking (Customer)
   * POST /api/services/orders/stripe-checkout
   * This avoids Apple's 30% IAP fee by redirecting to browser
   */
  createStripeCheckout = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { serviceId, bookingDate, bookingTime, rcnToRedeem, notes } = req.body;

      if (!serviceId) {
        return res.status(400).json({ success: false, error: 'Service ID is required' });
      }

      const result = await this.paymentService.createStripeCheckout({
        serviceId,
        customerAddress,
        bookingDate: bookingDate ? new Date(bookingDate) : undefined,
        bookingTime,
        rcnToRedeem: rcnToRedeem ? parseFloat(rcnToRedeem) : undefined,
        notes
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      logger.error('Error in createStripeCheckout controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      });
    }
  };

  /**
   * Confirm payment (optional, webhooks handle most cases)
   * POST /api/services/orders/confirm
   */
  confirmPayment = async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ success: false, error: 'Payment Intent ID is required' });
      }

      const order = await this.paymentService.handlePaymentSuccess(paymentIntentId);

      res.json({
        success: true,
        data: order
      });
    } catch (error: unknown) {
      logger.error('Error in confirmPayment controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm payment'
      });
    }
  };

  /**
   * Get customer orders (Customer only)
   * GET /api/services/orders/customer
   */
  getCustomerOrders = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const filters = {
        status: req.query.status as 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded' | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await this.orderRepository.getOrdersByCustomer(customerAddress, filters, options);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getCustomerOrders controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer orders'
      });
    }
  };

  /**
   * Get shop orders (Shop only)
   * GET /api/services/orders/shop
   */
  getShopOrders = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const filters = {
        status: req.query.status as 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded' | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const options = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await this.orderRepository.getOrdersByShop(shopId, filters, options);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getShopOrders controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop orders'
      });
    }
  };

  /**
   * Get order by ID (Customer or Shop)
   * GET /api/services/orders/:id
   */
  getOrderById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customerAddress = req.user?.address;
      const shopId = req.user?.shopId;

      const order = await this.orderRepository.getOrderWithDetails(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Verify ownership (customer or shop)
      const isCustomer = customerAddress && order.customerAddress === customerAddress.toLowerCase();
      const isShop = shopId && order.shopId === shopId;

      if (!isCustomer && !isShop) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to view this order'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: unknown) {
      logger.error('Error in getOrderById controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get order'
      });
    }
  };

  /**
   * Update order status (Shop only)
   * PUT /api/services/orders/:id/status
   */
  updateOrderStatus = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' });
      }

      // Validate status
      const validStatuses = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      // Verify order belongs to shop
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to update this order' });
      }

      const updatedOrder = await this.orderRepository.updateOrderStatus(id, status);

      // Emit event when order is marked completed for RCN rewards
      if (status === 'completed' && updatedOrder) {
        try {
          await eventBus.publish(createDomainEvent(
            'service.order_completed',
            updatedOrder.customerAddress,
            {
              orderId: updatedOrder.orderId,
              customerAddress: updatedOrder.customerAddress,
              shopId: updatedOrder.shopId,
              serviceId: updatedOrder.serviceId,
              totalAmount: updatedOrder.totalAmount,
              completedAt: updatedOrder.completedAt
            },
            'ServiceDomain'
          ));
          logger.info('Service order completed event published', {
            orderId: updatedOrder.orderId,
            customerAddress: updatedOrder.customerAddress,
            amount: updatedOrder.totalAmount
          });

          // Issue group tokens for this service
          await this.issueGroupTokensForService(updatedOrder);

          // Send notification to customer about order completion
          // Wait a bit for RCN rewards to be minted (event bus processes async)
          setTimeout(async () => {
            try {
              const service = await this.serviceRepository.getServiceById(updatedOrder.serviceId);
              const shop = await shopRepository.getShop(updatedOrder.shopId);

              // Get the order details with RCN earned
              const orderWithDetails = await this.orderRepository.getOrderWithDetails(updatedOrder.orderId);
              const rcnEarned = orderWithDetails?.rcnEarned || 0;

              if (service && shop && shop.walletAddress) {
                await this.notificationService.createServiceOrderCompletedNotification(
                  shop.walletAddress,
                  updatedOrder.customerAddress,
                  shop.name,
                  service.serviceName,
                  rcnEarned,
                  updatedOrder.orderId
                );

                // Send push notification to customer
                await getExpoPushService().sendOrderCompleted(
                  updatedOrder.customerAddress,
                  shop.name,
                  service.serviceName,
                  rcnEarned,
                  updatedOrder.orderId
                );

                logger.info('Order completion notification sent to customer', {
                  customerAddress: updatedOrder.customerAddress,
                  orderId: updatedOrder.orderId,
                  rcnEarned
                });
              }
            } catch (notifError) {
              logger.error('Failed to send order completion notification:', notifError);
            }
          }, 2000); // Wait 2 seconds for RCN to be minted
        } catch (eventError) {
          logger.error('Failed to publish order completed event:', eventError);
          // Don't fail the request if event publishing fails
        }
      }

      res.json({
        success: true,
        data: updatedOrder
      });
    } catch (error: unknown) {
      logger.error('Error in updateOrderStatus controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status'
      });
    }
  };

  /**
   * Cancel order (Customer only - can cancel paid orders too)
   * POST /api/services/orders/:id/cancel
   * Body: { cancellationReason: string, cancellationNotes?: string }
   */
  cancelOrder = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { id } = req.params;
      const { cancellationReason, cancellationNotes } = req.body;

      // Validate cancellation reason
      if (!cancellationReason) {
        return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      }

      // Verify order belongs to customer
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.customerAddress !== customerAddress.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Unauthorized to cancel this order' });
      }

      await this.paymentService.cancelOrder(id, cancellationReason, cancellationNotes);

      res.json({
        success: true,
        message: 'Order cancelled successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in cancelOrder controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel order'
      });
    }
  };

  /**
   * Approve a booking (Shop only)
   * POST /api/services/orders/:id/approve
   */
  approveBooking = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      const shopAddress = req.user?.address;
      if (!shopId || !shopAddress) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;

      // Verify order belongs to shop
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to approve this booking' });
      }

      // Can only approve paid orders
      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Only paid orders can be approved'
        });
      }

      // Check if already approved
      if (order.shopApproved) {
        return res.status(400).json({
          success: false,
          error: 'Booking is already approved'
        });
      }

      const updatedOrder = await this.orderRepository.approveBooking(id, shopAddress);

      // Send notification to customer
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const shop = await shopRepository.getShop(shopId);

        if (service && shop) {
          await this.notificationService.createNotification({
            senderAddress: shopAddress,
            receiverAddress: order.customerAddress,
            notificationType: 'booking_approved',
            message: `Your booking for ${service.serviceName} at ${shop.name} has been approved!`,
            metadata: {
              orderId: id,
              serviceName: service.serviceName,
              shopName: shop.name,
              bookingDate: order.bookingDate,
              bookingTime: order.bookingTime,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notifError) {
        logger.error('Failed to send booking approval notification:', notifError);
      }

      res.json({
        success: true,
        data: updatedOrder,
        message: 'Booking approved successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in approveBooking controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve booking'
      });
    }
  };

  /**
   * Reschedule a booking (Shop only)
   * POST /api/services/orders/:id/reschedule
   * Body: { newBookingDate: string, newBookingTime: string, reason?: string }
   */
  rescheduleBooking = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      const shopAddress = req.user?.address;
      if (!shopId || !shopAddress) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { newBookingDate, newBookingTime, reason } = req.body;

      if (!newBookingDate || !newBookingTime) {
        return res.status(400).json({
          success: false,
          error: 'New booking date and time are required'
        });
      }

      // Verify order belongs to shop
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to reschedule this booking' });
      }

      // Can only reschedule paid or approved orders
      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Only paid orders can be rescheduled'
        });
      }

      const updatedOrder = await this.orderRepository.rescheduleBooking(
        id,
        new Date(newBookingDate),
        newBookingTime,
        'shop',
        reason
      );

      // Send notification to customer
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const shop = await shopRepository.getShop(shopId);

        if (service && shop) {
          await this.notificationService.createNotification({
            senderAddress: shopAddress,
            receiverAddress: order.customerAddress,
            notificationType: 'booking_rescheduled',
            message: `Your booking for ${service.serviceName} at ${shop.name} has been rescheduled to ${new Date(newBookingDate).toLocaleDateString()} at ${newBookingTime}`,
            metadata: {
              orderId: id,
              serviceName: service.serviceName,
              shopName: shop.name,
              oldBookingDate: order.bookingDate,
              oldBookingTime: order.bookingTime,
              newBookingDate,
              newBookingTime,
              reason,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notifError) {
        logger.error('Failed to send booking reschedule notification:', notifError);
      }

      res.json({
        success: true,
        data: updatedOrder,
        message: 'Booking rescheduled successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in rescheduleBooking controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule booking'
      });
    }
  };

  /**
   * Get pending approval bookings (Shop only)
   * GET /api/services/orders/pending-approval
   */
  getPendingApprovalBookings = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const bookings = await this.orderRepository.getPendingApprovalBookings(shopId);

      res.json({
        success: true,
        data: bookings
      });
    } catch (error: unknown) {
      logger.error('Error in getPendingApprovalBookings controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending approval bookings'
      });
    }
  };

  /**
   * Cancel order (Shop only - can cancel paid/approved/scheduled orders)
   * POST /api/services/orders/:id/shop-cancel
   * Body: { cancellationReason: string, cancellationNotes?: string }
   */
  cancelOrderByShop = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { cancellationReason, cancellationNotes } = req.body;

      // Validate cancellation reason
      if (!cancellationReason) {
        return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      }

      // Verify order belongs to shop
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to cancel this order' });
      }

      // Can only cancel orders that are not already completed/cancelled
      if (order.status === 'completed') {
        return res.status(400).json({ success: false, error: 'Cannot cancel a completed order' });
      }

      if (order.status === 'cancelled') {
        return res.status(400).json({ success: false, error: 'Order is already cancelled' });
      }

      // Update order with cancellation data (prefix reason with 'shop:' to distinguish)
      const updatedOrder = await this.orderRepository.updateCancellationData(
        id,
        `shop:${cancellationReason}`,
        cancellationNotes
      );

      // Send notification to customer
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const shop = await shopRepository.getShop(shopId);

        if (service && shop) {
          await this.notificationService.createNotification({
            senderAddress: 'SYSTEM',
            receiverAddress: order.customerAddress,
            notificationType: 'service_cancelled_by_shop',
            message: `Your booking for ${service.serviceName} at ${shop.name} has been cancelled`,
            metadata: {
              orderId: id,
              serviceName: service.serviceName,
              shopName: shop.name,
              reason: cancellationReason,
              notes: cancellationNotes,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notifError) {
        logger.error('Failed to send shop cancellation notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: updatedOrder
      });
    } catch (error: unknown) {
      logger.error('Error in cancelOrderByShop controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel booking'
      });
    }
  };

  /**
   * Mark order as no-show (Shop only)
   * POST /api/services/orders/:id/mark-no-show
   * Body: { notes?: string }
   */
  markNoShow = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { id } = req.params;
      const { notes } = req.body;

      // Verify order belongs to shop
      const order = await this.orderRepository.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to mark this order as no-show' });
      }

      // Can only mark paid orders as no-show
      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Only paid orders can be marked as no-show'
        });
      }

      // Mark as no-show
      await this.orderRepository.markAsNoShow(id, notes);

      // Send notification to customer
      try {
        const service = await this.serviceRepository.getServiceById(order.serviceId);
        const shop = await shopRepository.getShop(shopId);

        if (service && shop) {
          await this.notificationService.createNotification({
            senderAddress: 'SYSTEM',
            receiverAddress: order.customerAddress,
            notificationType: 'service_no_show',
            message: `You were marked as no-show for: ${service.serviceName} at ${shop.name}`,
            metadata: {
              orderId: id,
              serviceName: service.serviceName,
              shopName: shop.name,
              notes,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notifError) {
        logger.error('Failed to send no-show notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Order marked as no-show'
      });
    } catch (error: unknown) {
      logger.error('Error in markNoShow controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark order as no-show'
      });
    }
  };

  /**
   * Helper method to issue group tokens when a service is completed
   */
  private async issueGroupTokensForService(order: { orderId: string; serviceId: string; customerAddress: string; totalAmount: number; shopId: string }): Promise<void> {
    try {
      // Get all groups this service is linked to
      const serviceGroups = await this.serviceRepository.getServiceGroups(order.serviceId);

      if (serviceGroups.length === 0) {
        logger.debug('No group tokens to issue - service not linked to any groups', {
          orderId: order.orderId,
          serviceId: order.serviceId
        });
        return;
      }

      // Get service details for logging
      const service = await this.serviceRepository.getServiceById(order.serviceId);

      for (const groupLink of serviceGroups) {
        try {
          // Calculate group token amount
          const baseAmount = order.totalAmount * (groupLink.tokenRewardPercentage / 100);
          const finalAmount = baseAmount * groupLink.bonusMultiplier;

          // Issue group tokens
          await this.groupService.earnGroupTokens({
            customerAddress: order.customerAddress,
            groupId: groupLink.groupId,
            shopId: order.shopId,
            amount: finalAmount,
            reason: `Service completed: ${service?.serviceName || 'Service'}`,
            metadata: {
              orderId: order.orderId,
              serviceId: order.serviceId,
              rewardPercentage: groupLink.tokenRewardPercentage,
              bonusMultiplier: groupLink.bonusMultiplier,
              orderAmount: order.totalAmount
            }
          });

          logger.info('Group tokens issued for completed service', {
            groupId: groupLink.groupId,
            groupName: groupLink.groupName,
            customerAddress: order.customerAddress,
            amount: finalAmount,
            tokenSymbol: groupLink.customTokenSymbol,
            orderId: order.orderId,
            serviceId: order.serviceId
          });
        } catch (groupError) {
          logger.error('Error issuing group tokens for specific group', {
            error: groupError,
            groupId: groupLink.groupId,
            orderId: order.orderId,
            serviceId: order.serviceId
          });
          // Continue with other groups even if one fails
        }
      }
    } catch (error) {
      logger.error('Error issuing group tokens for service', {
        error,
        orderId: order.orderId,
        serviceId: order.serviceId
      });
      // Don't throw - log and continue (group tokens are bonus, not critical to order flow)
    }
  }
}
