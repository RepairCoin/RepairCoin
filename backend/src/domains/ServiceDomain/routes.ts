// backend/src/domains/ServiceDomain/routes.ts
import { Router } from 'express';
import { ServiceController } from './controllers/ServiceController';
import { OrderController } from './controllers/OrderController';
import { FavoriteController } from './controllers/FavoriteController';
import { ReviewController } from './controllers/ReviewController';
import { AnalyticsController } from './controllers/AnalyticsController';
import { AppointmentController } from './controllers/AppointmentController';
import { DiscoveryController } from './controllers/DiscoveryController';
import { ServiceGroupController } from './controllers/ServiceGroupController';
import NoShowPolicyController from './controllers/NoShowPolicyController';
import { PaymentService } from './services/PaymentService';
import { authMiddleware, optionalAuthMiddleware, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/subscriptionGuard';
import { StripeService } from '../../services/StripeService';
import { paymentLimiter, orderLimiter } from '../../middleware/rateLimiter';

const router = Router();

export function initializeRoutes(stripe: StripeService): Router {
  // Initialize controllers
  const paymentService = new PaymentService(stripe);
  const serviceController = new ServiceController();
  const orderController = new OrderController(paymentService);
  const favoriteController = new FavoriteController();
  const reviewController = new ReviewController();
  const analyticsController = new AnalyticsController();
  const appointmentController = new AppointmentController();
  const discoveryController = new DiscoveryController();
  const serviceGroupController = new ServiceGroupController();

  // ==================== SERVICE MANAGEMENT ROUTES ====================

  /**
   * @swagger
   * /api/services:
   *   post:
   *     summary: Create a new service (Shop only)
   *     description: Create a service offering for the shop's marketplace listing
   *     tags: [Services]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - serviceName
   *               - priceUsd
   *             properties:
   *               serviceName:
   *                 type: string
   *                 example: "Oil Change"
   *               description:
   *                 type: string
   *                 example: "Full synthetic oil change with filter replacement"
   *               priceUsd:
   *                 type: number
   *                 example: 49.99
   *               durationMinutes:
   *                 type: integer
   *                 example: 30
   *               category:
   *                 type: string
   *                 example: "oil_change"
   *               imageUrl:
   *                 type: string
   *                 example: "https://example.com/oil-change.jpg"
   *     responses:
   *       201:
   *         description: Service created successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Authentication required
   */
  router.post(
    '/',
    authMiddleware,
    requireRole(['shop']),
    requireActiveSubscription(),
    serviceController.createService
  );

  /**
   * @swagger
   * /api/services:
   *   get:
   *     summary: Get all services (Marketplace)
   *     description: Get all active services with optional filters (Public access)
   *     tags: [Services]
   *     parameters:
   *       - in: query
   *         name: shopId
   *         schema:
   *           type: string
   *         description: Filter by shop ID
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search in service name and description
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *         description: Minimum price filter
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *         description: Maximum price filter
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of services
   */
  router.get(
    '/',
    optionalAuthMiddleware, // Authenticate if token present for isFavorited field
    serviceController.getAllServices
  );

  /**
   * @swagger
   * /api/services/shop/{shopId}:
   *   get:
   *     summary: Get all services for a shop
   *     description: Get all services offered by a specific shop (Public, but shop owners see inactive services too)
   *     tags: [Services]
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of shop services
   */
  router.get(
    '/shop/:shopId',
    optionalAuthMiddleware, // Authenticate if token present, but don't require it
    serviceController.getShopServices
  );

  // ==================== FAVORITES ROUTES (before /:id) ====================

  /**
   * @swagger
   * /api/services/favorites:
   *   post:
   *     summary: Add service to favorites (Customer only)
   *     description: Bookmark a service for later
   *     tags: [Favorites]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - serviceId
   *             properties:
   *               serviceId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Service favorited
   */
  router.post(
    '/favorites',
    authMiddleware,
    requireRole(['customer']),
    favoriteController.addFavorite
  );

  /**
   * @swagger
   * /api/services/favorites:
   *   get:
   *     summary: Get customer's favorites (Customer only)
   *     description: Get all favorited services
   *     tags: [Favorites]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of favorited services
   */
  router.get(
    '/favorites',
    authMiddleware,
    requireRole(['customer']),
    (req, res) => favoriteController.getCustomerFavorites(req, res)
  );

  /**
   * @swagger
   * /api/services/favorites/check/{serviceId}:
   *   get:
   *     summary: Check if service is favorited (Customer only)
   *     description: Check favorite status of a service
   *     tags: [Favorites]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Favorite status
   */
  router.get(
    '/favorites/check/:serviceId',
    authMiddleware,
    requireRole(['customer']),
    favoriteController.checkFavorite
  );

  /**
   * @swagger
   * /api/services/favorites/{serviceId}:
   *   delete:
   *     summary: Remove service from favorites (Customer only)
   *     description: Unbookmark a service
   *     tags: [Favorites]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Service removed from favorites
   */
  router.delete(
    '/favorites/:serviceId',
    authMiddleware,
    requireRole(['customer']),
    favoriteController.removeFavorite
  );

  /**
   * @swagger
   * /api/services/{serviceId}/favorites/count:
   *   get:
   *     summary: Get favorite count for a service (Public)
   *     description: Get number of times a service has been favorited
   *     tags: [Favorites]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Favorite count
   */
  router.get(
    '/:serviceId/favorites/count',
    favoriteController.getServiceFavoriteCount
  );

  /**
   * @swagger
   * /api/services/{id}:
   *   get:
   *     summary: Get service by ID
   *     description: Get detailed service information with shop details (Public access)
   *     tags: [Services]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Service details
   *       404:
   *         description: Service not found
   */
  router.get(
    '/:id',
    optionalAuthMiddleware, // Authenticate if token present for isFavorited field
    serviceController.getServiceById
  );

  /**
   * @swagger
   * /api/services/{id}:
   *   put:
   *     summary: Update a service (Shop owner only)
   *     description: Update service details
   *     tags: [Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               serviceName:
   *                 type: string
   *               description:
   *                 type: string
   *               priceUsd:
   *                 type: number
   *               durationMinutes:
   *                 type: integer
   *               category:
   *                 type: string
   *               imageUrl:
   *                 type: string
   *               active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Service updated
   *       403:
   *         description: Unauthorized
   */
  router.put(
    '/:id',
    authMiddleware,
    requireRole(['shop']),
    requireActiveSubscription(),
    serviceController.updateService
  );

  /**
   * @swagger
   * /api/services/{id}:
   *   delete:
   *     summary: Delete a service (Shop owner only)
   *     description: Soft delete (deactivate) a service
   *     tags: [Services]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Service deleted
   *       403:
   *         description: Unauthorized
   */
  router.delete(
    '/:id',
    authMiddleware,
    requireRole(['shop']),
    requireActiveSubscription(),
    serviceController.deleteService
  );

  // ==================== ORDER MANAGEMENT ROUTES ====================

  /**
   * @swagger
   * /api/services/orders/create-payment-intent:
   *   post:
   *     summary: Create payment intent for service booking (Customer only)
   *     description: Creates a Stripe payment intent and order record
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - serviceId
   *             properties:
   *               serviceId:
   *                 type: string
   *               bookingDate:
   *                 type: string
   *                 format: date-time
   *               notes:
   *                 type: string
   *     responses:
   *       201:
   *         description: Payment intent created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     orderId:
   *                       type: string
   *                     clientSecret:
   *                       type: string
   *                     amount:
   *                       type: number
   *                     currency:
   *                       type: string
   */
  router.post(
    '/orders/create-payment-intent',
    paymentLimiter,
    authMiddleware,
    requireRole(['customer']),
    orderController.createPaymentIntent
  );

  /**
   * @swagger
   * /api/services/orders/stripe-checkout:
   *   post:
   *     summary: Create Stripe Checkout session for service booking (Customer only)
   *     description: Creates a Stripe Checkout session for web-based payment. Opens browser for payment to avoid Apple IAP fees.
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - serviceId
   *             properties:
   *               serviceId:
   *                 type: string
   *               bookingDate:
   *                 type: string
   *                 format: date-time
   *               bookingTime:
   *                 type: string
   *               rcnToRedeem:
   *                 type: number
   *               notes:
   *                 type: string
   *     responses:
   *       201:
   *         description: Checkout session created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     orderId:
   *                       type: string
   *                     checkoutUrl:
   *                       type: string
   *                     sessionId:
   *                       type: string
   *                     amount:
   *                       type: number
   *                     currency:
   *                       type: string
   */
  router.post(
    '/orders/stripe-checkout',
    orderLimiter,
    authMiddleware,
    requireRole(['customer']),
    orderController.createStripeCheckout
  );

  /**
   * @swagger
   * /api/services/orders/confirm:
   *   post:
   *     summary: Confirm payment (optional - webhooks handle most cases)
   *     description: Manually confirm a successful payment
   *     tags: [Service Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - paymentIntentId
   *             properties:
   *               paymentIntentId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Payment confirmed
   */
  router.post(
    '/orders/confirm',
    orderController.confirmPayment
  );

  /**
   * @swagger
   * /api/services/orders/customer:
   *   get:
   *     summary: Get customer's orders (Customer only)
   *     description: Get all orders for authenticated customer
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, paid, completed, cancelled, refunded]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of customer orders
   */
  router.get(
    '/orders/customer',
    authMiddleware,
    requireRole(['customer']),
    orderController.getCustomerOrders
  );

  /**
   * @swagger
   * /api/services/orders/shop:
   *   get:
   *     summary: Get shop's orders (Shop only)
   *     description: Get all orders for authenticated shop
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of shop orders
   */
  router.get(
    '/orders/shop',
    authMiddleware,
    requireRole(['shop']),
    orderController.getShopOrders
  );

  /**
   * @swagger
   * /api/services/orders/{id}:
   *   get:
   *     summary: Get order by ID
   *     description: Get order details (Customer or Shop)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order details
   *       403:
   *         description: Unauthorized
   *       404:
   *         description: Order not found
   */
  router.get(
    '/orders/:id',
    authMiddleware,
    orderController.getOrderById
  );

  /**
   * @swagger
   * /api/services/orders/{id}/status:
   *   put:
   *     summary: Update order status (Shop only)
   *     description: Update order status (e.g., mark as completed)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - status
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [pending, paid, completed, cancelled, refunded]
   *     responses:
   *       200:
   *         description: Status updated
   *       403:
   *         description: Unauthorized
   */
  router.put(
    '/orders/:id/status',
    authMiddleware,
    requireRole(['shop']),
    orderController.updateOrderStatus
  );

  /**
   * @swagger
   * /api/services/orders/{id}/cancel:
   *   post:
   *     summary: Cancel order (Customer only, before payment)
   *     description: Cancel a pending order
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order cancelled
   *       400:
   *         description: Cannot cancel paid order
   *       403:
   *         description: Unauthorized
   */
  router.post(
    '/orders/:id/cancel',
    authMiddleware,
    requireRole(['customer']),
    orderController.cancelOrder
  );

  /**
   * @swagger
   * /api/services/orders/{id}/shop-cancel:
   *   post:
   *     summary: Cancel order (Shop only)
   *     description: Cancel a paid/scheduled order. Cannot cancel completed orders.
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - cancellationReason
   *             properties:
   *               cancellationReason:
   *                 type: string
   *                 description: Reason for cancellation
   *               cancellationNotes:
   *                 type: string
   *                 description: Optional additional notes
   *     responses:
   *       200:
   *         description: Order cancelled successfully
   *       400:
   *         description: Cannot cancel completed/already cancelled order
   *       403:
   *         description: Unauthorized - order doesn't belong to shop
   *       404:
   *         description: Order not found
   */
  router.post(
    '/orders/:id/shop-cancel',
    authMiddleware,
    requireRole(['shop']),
    orderController.cancelOrderByShop
  );

  /**
   * @swagger
   * /api/services/orders/{id}/mark-no-show:
   *   post:
   *     summary: Mark order as no-show (Shop only)
   *     description: Mark a paid order as no-show when customer doesn't arrive
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Order ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               notes:
   *                 type: string
   *                 description: Optional notes about the no-show
   *     responses:
   *       200:
   *         description: Order marked as no-show successfully
   *       400:
   *         description: Invalid request or order status
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Order doesn't belong to this shop
   *       404:
   *         description: Order not found
   */
  router.post(
    '/orders/:id/mark-no-show',
    authMiddleware,
    requireRole(['shop']),
    orderController.markNoShow
  );

  /**
   * @swagger
   * /api/services/orders/{id}/approve:
   *   post:
   *     summary: Approve a booking (Shop only)
   *     description: Approve a paid booking to confirm the appointment
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Order ID
   *     responses:
   *       200:
   *         description: Booking approved successfully
   *       400:
   *         description: Invalid request or order status
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Order doesn't belong to this shop
   *       404:
   *         description: Order not found
   */
  router.post(
    '/orders/:id/approve',
    authMiddleware,
    requireRole(['shop']),
    orderController.approveBooking
  );

  /**
   * @swagger
   * /api/services/orders/{id}/reschedule:
   *   post:
   *     summary: Reschedule a booking (Shop only)
   *     description: Reschedule a paid booking to a new date/time
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - newBookingDate
   *               - newBookingTime
   *             properties:
   *               newBookingDate:
   *                 type: string
   *                 format: date
   *               newBookingTime:
   *                 type: string
   *                 example: "10:00"
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Booking rescheduled successfully
   *       400:
   *         description: Invalid request or order status
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Order doesn't belong to this shop
   *       404:
   *         description: Order not found
   */
  router.post(
    '/orders/:id/reschedule',
    authMiddleware,
    requireRole(['shop']),
    orderController.rescheduleBooking
  );

  /**
   * @swagger
   * /api/services/orders/pending-approval:
   *   get:
   *     summary: Get pending approval bookings (Shop only)
   *     description: Get all bookings waiting for shop approval
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of pending approval bookings
   */
  router.get(
    '/orders/pending-approval',
    authMiddleware,
    requireRole(['shop']),
    orderController.getPendingApprovalBookings
  );

  // ==================== REVIEWS ROUTES ====================

  /**
   * @swagger
   * /api/services/reviews:
   *   post:
   *     summary: Create a review (Customer only, after order completion)
   *     description: Submit a review for a completed service order
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - orderId
   *               - rating
   *             properties:
   *               orderId:
   *                 type: string
   *               rating:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 5
   *               comment:
   *                 type: string
   *               images:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Review created
   */
  router.post(
    '/reviews',
    authMiddleware,
    requireRole(['customer']),
    reviewController.createReview
  );

  /**
   * @swagger
   * /api/services/{serviceId}/reviews:
   *   get:
   *     summary: Get service reviews (Public)
   *     description: Get all reviews for a service
   *     tags: [Reviews]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: rating
   *         schema:
   *           type: integer
   *         description: Filter by rating (1-5)
   *     responses:
   *       200:
   *         description: List of reviews
   */
  router.get(
    '/:serviceId/reviews',
    reviewController.getServiceReviews
  );

  /**
   * @swagger
   * /api/services/reviews/customer:
   *   get:
   *     summary: Get customer's reviews (Customer only)
   *     description: Get all reviews written by customer
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of customer reviews
   */
  router.get(
    '/reviews/customer',
    authMiddleware,
    requireRole(['customer']),
    reviewController.getCustomerReviews
  );

  /**
   * @swagger
   * /api/services/reviews/shop:
   *   get:
   *     summary: Get shop's reviews (Shop only)
   *     description: Get all reviews for shop's services
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: rating
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of reviews
   */
  router.get(
    '/reviews/shop',
    authMiddleware,
    requireRole(['shop']),
    reviewController.getShopReviews
  );

  /**
   * @swagger
   * /api/services/reviews/{reviewId}:
   *   put:
   *     summary: Update a review (Review author only)
   *     description: Update customer's own review
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reviewId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               rating:
   *                 type: integer
   *               comment:
   *                 type: string
   *               images:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Review updated
   */
  router.put(
    '/reviews/:reviewId',
    authMiddleware,
    requireRole(['customer']),
    reviewController.updateReview
  );

  /**
   * @swagger
   * /api/services/reviews/{reviewId}/respond:
   *   post:
   *     summary: Add shop response to review (Shop only)
   *     description: Shop responds to a customer review
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reviewId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - response
   *             properties:
   *               response:
   *                 type: string
   *     responses:
   *       200:
   *         description: Response added
   */
  router.post(
    '/reviews/:reviewId/respond',
    authMiddleware,
    requireRole(['shop']),
    reviewController.addShopResponse
  );

  /**
   * @swagger
   * /api/services/reviews/{reviewId}/helpful:
   *   post:
   *     summary: Toggle helpful vote for a review (Authenticated)
   *     description: Toggle helpful vote - one vote per account. Returns new vote state and count.
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reviewId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Vote toggled successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     voted:
   *                       type: boolean
   *                     helpfulCount:
   *                       type: integer
   */
  router.post(
    '/reviews/:reviewId/helpful',
    authMiddleware,
    reviewController.markHelpful
  );

  /**
   * @swagger
   * /api/services/reviews/check-votes:
   *   post:
   *     summary: Check if user has voted on reviews (Authenticated)
   *     description: Returns which reviews the current user has voted as helpful
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reviewIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: User votes retrieved
   */
  router.post(
    '/reviews/check-votes',
    authMiddleware,
    reviewController.checkUserVotes
  );

  /**
   * @swagger
   * /api/services/reviews/{reviewId}:
   *   delete:
   *     summary: Delete a review (Review author only)
   *     description: Delete customer's own review
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reviewId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Review deleted
   */
  router.delete(
    '/reviews/:reviewId',
    authMiddleware,
    requireRole(['customer']),
    reviewController.deleteReview
  );

  /**
   * @swagger
   * /api/services/reviews/can-review/{orderId}:
   *   get:
   *     summary: Check if customer can review order (Customer only)
   *     description: Verify review eligibility for an order
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Review eligibility status
   */
  router.get(
    '/reviews/can-review/:orderId',
    authMiddleware,
    requireRole(['customer']),
    reviewController.canReview
  );

  // ==================== ANALYTICS ROUTES ====================

  /**
   * @swagger
   * /api/services/analytics/shop:
   *   get:
   *     summary: Get comprehensive analytics for shop's services (Shop only)
   *     description: Retrieve detailed analytics including overview metrics, top services, order trends, and category breakdown
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: topServicesLimit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of top services to return
   *       - in: query
   *         name: trendDays
   *         schema:
   *           type: integer
   *           default: 30
   *         description: Number of days for trend analysis
   *     responses:
   *       200:
   *         description: Shop analytics summary
   */
  router.get(
    '/analytics/shop',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getShopAnalytics
  );

  /**
   * @swagger
   * /api/services/analytics/shop/overview:
   *   get:
   *     summary: Get shop service overview metrics (Shop only)
   *     description: Retrieve high-level metrics for shop's services
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Shop overview metrics
   */
  router.get(
    '/analytics/shop/overview',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getShopOverview
  );

  /**
   * @swagger
   * /api/services/analytics/shop/top-services:
   *   get:
   *     summary: Get top performing services (Shop only)
   *     description: Retrieve shop's best performing services by revenue
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: List of top services
   */
  router.get(
    '/analytics/shop/top-services',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getTopServices
  );

  /**
   * @swagger
   * /api/services/analytics/shop/trends:
   *   get:
   *     summary: Get order trends (Shop only)
   *     description: Retrieve daily order trends for specified period
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: Daily order trends
   */
  router.get(
    '/analytics/shop/trends',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getShopOrderTrends
  );

  /**
   * @swagger
   * /api/services/analytics/shop/categories:
   *   get:
   *     summary: Get category breakdown (Shop only)
   *     description: Retrieve performance metrics by service category
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Category performance data
   */
  router.get(
    '/analytics/shop/categories',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getShopCategoryBreakdown
  );

  /**
   * @swagger
   * /api/services/analytics/shop/group-performance:
   *   get:
   *     summary: Get group performance analytics for shop
   *     description: Retrieve analytics showing which affiliate groups are driving bookings and token issuance
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Group performance analytics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     summary:
   *                       type: object
   *                       properties:
   *                         totalServicesLinked:
   *                           type: number
   *                         totalGroupsActive:
   *                           type: number
   *                         totalGroupTokensIssued:
   *                           type: number
   *                         totalBookingsFromGroups:
   *                           type: number
   *                     groupBreakdown:
   *                       type: array
   *                       items:
   *                         type: object
   *                     servicesLinked:
   *                       type: array
   *                       items:
   *                         type: object
   */
  router.get(
    '/analytics/shop/group-performance',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getGroupPerformance
  );

  router.get(
    '/analytics/shop/bookings',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.getBookingAnalytics
  );

  /**
   * @swagger
   * /api/services/analytics/platform:
   *   get:
   *     summary: Get platform-wide service analytics (Admin only)
   *     description: Retrieve comprehensive platform metrics for service marketplace
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: topShopsLimit
   *         schema:
   *           type: integer
   *           default: 10
   *       - in: query
   *         name: trendDays
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: Platform analytics summary
   */
  router.get(
    '/analytics/platform',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getPlatformAnalytics
  );

  /**
   * @swagger
   * /api/services/analytics/platform/overview:
   *   get:
   *     summary: Get platform overview metrics (Admin only)
   *     description: Retrieve high-level platform metrics
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Platform overview metrics
   */
  router.get(
    '/analytics/platform/overview',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getPlatformOverview
  );

  /**
   * @swagger
   * /api/services/analytics/platform/top-shops:
   *   get:
   *     summary: Get top performing shops (Admin only)
   *     description: Retrieve shops with best marketplace performance
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: List of top shops
   */
  router.get(
    '/analytics/platform/top-shops',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getTopShops
  );

  /**
   * @swagger
   * /api/services/analytics/platform/trends:
   *   get:
   *     summary: Get platform order trends (Admin only)
   *     description: Retrieve daily platform-wide order trends
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: Daily platform trends
   */
  router.get(
    '/analytics/platform/trends',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getPlatformOrderTrends
  );

  /**
   * @swagger
   * /api/services/analytics/platform/categories:
   *   get:
   *     summary: Get platform category performance (Admin only)
   *     description: Retrieve platform-wide category metrics
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: Category performance data
   */
  router.get(
    '/analytics/platform/categories',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getPlatformCategoryPerformance
  );

  /**
   * @swagger
   * /api/services/analytics/platform/health:
   *   get:
   *     summary: Get marketplace health score (Admin only)
   *     description: Retrieve overall health score and metrics for service marketplace
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Marketplace health metrics
   */
  router.get(
    '/analytics/platform/health',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.getMarketplaceHealthScore
  );

  // ==================== ANALYTICS EXPORT ROUTES (CSV) ====================

  /**
   * @swagger
   * /api/services/analytics/shop/export:
   *   get:
   *     summary: Export shop analytics to CSV (Shop only)
   *     description: Download comprehensive shop analytics as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/shop/export',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.exportShopAnalytics
  );

  /**
   * @swagger
   * /api/services/analytics/categories/export:
   *   get:
   *     summary: Export category breakdown to CSV (Shop only)
   *     description: Download category performance data as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/categories/export',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.exportCategoryBreakdown
  );

  /**
   * @swagger
   * /api/services/analytics/trends/export:
   *   get:
   *     summary: Export order trends to CSV (Shop only)
   *     description: Download order trends data as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *         description: Number of days for trend data
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/trends/export',
    authMiddleware,
    requireRole(['shop']),
    analyticsController.exportOrderTrends
  );

  /**
   * @swagger
   * /api/services/analytics/platform/export:
   *   get:
   *     summary: Export platform analytics to CSV (Admin only)
   *     description: Download platform-wide analytics as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/platform/export',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.exportPlatformAnalytics
  );

  /**
   * @swagger
   * /api/services/analytics/platform/categories/export:
   *   get:
   *     summary: Export platform category performance to CSV (Admin only)
   *     description: Download platform category data as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of categories to export
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/platform/categories/export',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.exportPlatformCategories
  );

  /**
   * @swagger
   * /api/services/analytics/platform/trends/export:
   *   get:
   *     summary: Export platform order trends to CSV (Admin only)
   *     description: Download platform-wide order trends as CSV file
   *     tags: [Service Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *         description: Number of days for trend data
   *     responses:
   *       200:
   *         description: CSV file download
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   */
  router.get(
    '/analytics/platform/trends/export',
    authMiddleware,
    requireRole(['admin']),
    analyticsController.exportPlatformTrends
  );

  // ==================== APPOINTMENT SCHEDULING ROUTES ====================

  /**
   * @swagger
   * /api/services/appointments/available-slots:
   *   get:
   *     summary: Get available time slots for a service
   *     description: Returns available appointment slots for a specific service and date
   *     tags: [Appointments]
   *     parameters:
   *       - in: query
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: List of available time slots
   */
  router.get(
    '/appointments/available-slots',
    appointmentController.getAvailableTimeSlots
  );

  /**
   * @swagger
   * /api/services/appointments/shop-availability/:shopId:
   *   get:
   *     summary: Get shop operating hours
   *     description: Get shop availability by day of week
   *     tags: [Appointments]
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Shop availability
   */
  router.get(
    '/appointments/shop-availability/:shopId',
    appointmentController.getShopAvailability
  );

  /**
   * @swagger
   * /api/services/appointments/time-slot-config/{shopId}:
   *   get:
   *     summary: Get time slot configuration for a shop (Public)
   *     description: Get booking configuration including max advance days, slot duration, etc.
   *     tags: [Appointments]
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Time slot configuration
   */
  router.get(
    '/appointments/time-slot-config/:shopId',
    appointmentController.getPublicTimeSlotConfig
  );

  /**
   * @swagger
   * /api/services/appointments/shop-availability:
   *   put:
   *     summary: Update shop operating hours (Shop only)
   *     description: Update shop availability for a specific day
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - dayOfWeek
   *             properties:
   *               dayOfWeek:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 6
   *               isOpen:
   *                 type: boolean
   *               openTime:
   *                 type: string
   *               closeTime:
   *                 type: string
   *               breakStartTime:
   *                 type: string
   *               breakEndTime:
   *                 type: string
   *     responses:
   *       200:
   *         description: Availability updated
   */
  router.put(
    '/appointments/shop-availability',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.updateShopAvailability
  );

  /**
   * @swagger
   * /api/services/appointments/time-slot-config:
   *   get:
   *     summary: Get time slot configuration (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Time slot configuration
   */
  router.get(
    '/appointments/time-slot-config',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getTimeSlotConfig
  );

  /**
   * @swagger
   * /api/services/appointments/time-slot-config:
   *   put:
   *     summary: Update time slot configuration (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               slotDurationMinutes:
   *                 type: integer
   *               bufferTimeMinutes:
   *                 type: integer
   *               maxConcurrentBookings:
   *                 type: integer
   *               bookingAdvanceDays:
   *                 type: integer
   *               minBookingHours:
   *                 type: integer
   *               allowWeekendBooking:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Configuration updated
   */
  router.put(
    '/appointments/time-slot-config',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.updateTimeSlotConfig
  );

  /**
   * @swagger
   * /api/services/appointments/time-slot-config:
   *   delete:
   *     summary: Delete time slot configuration (Shop only)
   *     description: Remove time slot configuration to disable booking settings
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Configuration deleted
   */
  router.delete(
    '/appointments/time-slot-config',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.deleteTimeSlotConfig
  );

  /**
   * @swagger
   * /api/services/appointments/date-overrides:
   *   get:
   *     summary: Get date overrides (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of date overrides
   */
  router.get(
    '/appointments/date-overrides',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getDateOverrides
  );

  /**
   * @swagger
   * /api/services/appointments/date-overrides:
   *   post:
   *     summary: Create date override (Shop only)
   *     description: Override shop hours for a specific date (holidays, etc.)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - overrideDate
   *             properties:
   *               overrideDate:
   *                 type: string
   *                 format: date
   *               isClosed:
   *                 type: boolean
   *               customOpenTime:
   *                 type: string
   *               customCloseTime:
   *                 type: string
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Override created
   */
  router.post(
    '/appointments/date-overrides',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.createDateOverride
  );

  /**
   * @swagger
   * /api/services/appointments/date-overrides/:date:
   *   delete:
   *     summary: Delete date override (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Override deleted
   */
  router.delete(
    '/appointments/date-overrides/:date',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.deleteDateOverride
  );

  /**
   * @swagger
   * /api/services/appointments/calendar:
   *   get:
   *     summary: Get shop calendar (Shop only)
   *     description: Get all bookings in a date range for calendar view
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Calendar bookings
   */
  router.get(
    '/appointments/calendar',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getShopCalendar
  );

  /**
   * @swagger
   * /api/services/:serviceId/duration:
   *   get:
   *     summary: Get service duration (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Service duration configuration
   */
  router.get(
    '/:serviceId/duration',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getServiceDuration
  );

  /**
   * @swagger
   * /api/services/:serviceId/duration:
   *   put:
   *     summary: Update service duration (Shop only)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - durationMinutes
   *             properties:
   *               durationMinutes:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Duration updated
   */
  router.put(
    '/:serviceId/duration',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.updateServiceDuration
  );

  /**
   * @swagger
   * /api/services/appointments/my-appointments:
   *   get:
   *     summary: Get customer's appointments (Customer only)
   *     description: Get all appointments for authenticated customer
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDate
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: List of customer appointments
   */
  router.get(
    '/appointments/my-appointments',
    authMiddleware,
    requireRole(['customer']),
    appointmentController.getCustomerAppointments
  );

  /**
   * @swagger
   * /api/services/appointments/cancel/:orderId:
   *   post:
   *     summary: Cancel appointment (Customer only)
   *     description: Cancel an appointment (must be 24+ hours before booking time)
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Appointment cancelled
   *       400:
   *         description: Cannot cancel (too late or invalid status)
   */
  router.post(
    '/appointments/cancel/:orderId',
    authMiddleware,
    requireRole(['customer']),
    appointmentController.cancelCustomerAppointment
  );

  // ==================== RESCHEDULE REQUEST ROUTES ====================

  /**
   * @swagger
   * /api/services/appointments/reschedule-request:
   *   post:
   *     summary: Create reschedule request (Customer only)
   *     description: Request to change appointment date/time. Requires shop approval.
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - orderId
   *               - requestedDate
   *               - requestedTimeSlot
   *             properties:
   *               orderId:
   *                 type: string
   *               requestedDate:
   *                 type: string
   *                 format: date
   *               requestedTimeSlot:
   *                 type: string
   *                 example: "14:00"
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Reschedule request created
   *       400:
   *         description: Invalid request or validation failed
   */
  router.post(
    '/appointments/reschedule-request',
    authMiddleware,
    requireRole(['customer']),
    appointmentController.createRescheduleRequest
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-request/{requestId}:
   *   delete:
   *     summary: Cancel reschedule request (Customer only)
   *     description: Cancel a pending reschedule request before shop responds
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Request cancelled
   */
  router.delete(
    '/appointments/reschedule-request/:requestId',
    authMiddleware,
    requireRole(['customer']),
    appointmentController.cancelRescheduleRequest
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-request/order/{orderId}:
   *   get:
   *     summary: Get reschedule request for order (Customer only)
   *     description: Get pending reschedule request for a specific order
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Reschedule request status
   */
  router.get(
    '/appointments/reschedule-request/order/:orderId',
    authMiddleware,
    requireRole(['customer']),
    appointmentController.getRescheduleRequestForOrder
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-requests:
   *   get:
   *     summary: Get shop reschedule requests (Shop only)
   *     description: Get all reschedule requests for the shop
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, rejected, expired, cancelled, all]
   *     responses:
   *       200:
   *         description: List of reschedule requests
   */
  router.get(
    '/appointments/reschedule-requests',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getShopRescheduleRequests
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-requests/count:
   *   get:
   *     summary: Get pending reschedule request count (Shop only)
   *     description: Get count of pending reschedule requests for badge display
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Pending request count
   */
  router.get(
    '/appointments/reschedule-requests/count',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.getShopRescheduleRequestCount
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-request/{requestId}/approve:
   *   post:
   *     summary: Approve reschedule request (Shop only)
   *     description: Approve a customer's reschedule request and update the appointment
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Request approved, appointment updated
   *       400:
   *         description: Requested slot no longer available
   */
  router.post(
    '/appointments/reschedule-request/:requestId/approve',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.approveRescheduleRequest
  );

  /**
   * @swagger
   * /api/services/appointments/reschedule-request/{requestId}/reject:
   *   post:
   *     summary: Reject reschedule request (Shop only)
   *     description: Reject a customer's reschedule request
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: requestId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Request rejected
   */
  router.post(
    '/appointments/reschedule-request/:requestId/reject',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.rejectRescheduleRequest
  );

  // ==================== MANUAL BOOKING ROUTES ====================

  /**
   * @swagger
   * /api/services/shops/{shopId}/appointments/manual:
   *   post:
   *     summary: Create manual appointment booking (Shop only)
   *     description: Allow shop to manually book appointments for customers from calendar view
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - customerAddress
   *               - serviceId
   *               - bookingDate
   *               - bookingTimeSlot
   *               - paymentStatus
   *             properties:
   *               customerAddress:
   *                 type: string
   *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
   *               customerEmail:
   *                 type: string
   *                 example: "customer@example.com"
   *               customerName:
   *                 type: string
   *                 example: "John Doe"
   *               customerPhone:
   *                 type: string
   *                 example: "+1234567890"
   *               serviceId:
   *                 type: string
   *                 example: "abc-123-def"
   *               bookingDate:
   *                 type: string
   *                 format: date
   *                 example: "2026-02-20"
   *               bookingTimeSlot:
   *                 type: string
   *                 example: "14:00:00"
   *               bookingEndTime:
   *                 type: string
   *                 example: "15:00:00"
   *               paymentStatus:
   *                 type: string
   *                 enum: [paid, pending, unpaid]
   *                 example: "paid"
   *               notes:
   *                 type: string
   *                 example: "Walk-in customer"
   *               createNewCustomer:
   *                 type: boolean
   *                 example: false
   *     responses:
   *       201:
   *         description: Appointment booked successfully
   *       400:
   *         description: Invalid request or missing fields
   *       403:
   *         description: Not authorized for this shop
   *       404:
   *         description: Service or customer not found
   *       409:
   *         description: Time slot conflict
   */
  router.post(
    '/shops/:shopId/appointments/manual',
    authMiddleware,
    requireRole(['shop']),
    async (req, res) => {
      const { createManualBooking } = await import('./controllers/ManualBookingController');
      return createManualBooking(req, res);
    }
  );

  /**
   * @swagger
   * /api/services/shops/{shopId}/customers/search:
   *   get:
   *     summary: Search customers for booking (Shop only)
   *     description: Search customers by name, email, phone, or wallet address
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Search query
   *         example: "john"
   *     responses:
   *       200:
   *         description: Customer search results
   *       400:
   *         description: Missing search query
   *       403:
   *         description: Not authorized for this shop
   */
  router.get(
    '/shops/:shopId/customers/search',
    authMiddleware,
    requireRole(['shop']),
    async (req, res) => {
      const { searchCustomers } = await import('./controllers/ManualBookingController');
      return searchCustomers(req, res);
    }
  );

  /**
   * @swagger
   * /api/services/bookings/{orderId}/direct-reschedule:
   *   post:
   *     summary: Direct reschedule by shop (Shop only)
   *     description: Shop directly reschedules a customer's appointment without requiring approval
   *     tags: [Appointments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - newDate
   *               - newTimeSlot
   *             properties:
   *               newDate:
   *                 type: string
   *                 format: date
   *               newTimeSlot:
   *                 type: string
   *                 example: "14:00"
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Appointment rescheduled successfully
   *       400:
   *         description: Invalid request or order status
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Order doesn't belong to this shop
   */
  router.post(
    '/bookings/:orderId/direct-reschedule',
    authMiddleware,
    requireRole(['shop']),
    appointmentController.directRescheduleOrder
  );

  // ==================== SERVICE GROUP ROUTES ====================

  /**
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}:
   *   post:
   *     summary: Link service to affiliate group (Shop only)
   *     description: Link service to an affiliate group to earn group tokens
   *     tags: [Service Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tokenRewardPercentage:
   *                 type: number
   *                 default: 100
   *               bonusMultiplier:
   *                 type: number
   *                 default: 1.0
   *     responses:
   *       201:
   *         description: Service linked to group
   *       403:
   *         description: Shop not a member of group
   */
  router.post(
    '/:serviceId/groups/:groupId',
    authMiddleware,
    requireRole(['shop']),
    (req, res) => serviceGroupController.linkServiceToGroup(req, res)
  );

  /**
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}:
   *   delete:
   *     summary: Unlink service from group (Shop only)
   *     description: Remove service from affiliate group
   *     tags: [Service Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Service unlinked from group
   */
  router.delete(
    '/:serviceId/groups/:groupId',
    authMiddleware,
    requireRole(['shop']),
    (req, res) => serviceGroupController.unlinkServiceFromGroup(req, res)
  );

  /**
   * @swagger
   * /api/services/{serviceId}/groups:
   *   get:
   *     summary: Get service groups (Public)
   *     description: Get all groups this service is linked to
   *     tags: [Service Groups]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of service groups
   */
  router.get(
    '/:serviceId/groups',
    (req, res) => serviceGroupController.getServiceGroups(req, res)
  );

  /**
   * @swagger
   * /api/services/{serviceId}/groups/{groupId}/rewards:
   *   put:
   *     summary: Update group rewards (Shop only)
   *     description: Update reward settings for service-group link
   *     tags: [Service Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tokenRewardPercentage:
   *                 type: number
   *               bonusMultiplier:
   *                 type: number
   *     responses:
   *       200:
   *         description: Rewards updated
   */
  router.put(
    '/:serviceId/groups/:groupId/rewards',
    authMiddleware,
    requireRole(['shop']),
    (req, res) => serviceGroupController.updateGroupRewards(req, res)
  );

  /**
   * @swagger
   * /api/services/groups/{groupId}/services:
   *   get:
   *     summary: Get services by group (Public)
   *     description: Get all services in an affiliate group
   *     tags: [Service Groups]
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of services in group
   */
  router.get(
    '/groups/:groupId/services',
    optionalAuthMiddleware, // Authenticate if token present for isFavorited field
    (req, res) => serviceGroupController.getGroupServices(req, res)
  );

  // ==================== DISCOVERY & SEARCH ROUTES ====================

  /**
   * @swagger
   * /api/services/discovery/autocomplete:
   *   get:
   *     summary: Autocomplete search suggestions
   *     description: Get autocomplete suggestions for service and shop names (Public)
   *     tags: [Discovery]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 2
   *         description: Search query (minimum 2 characters)
   *     responses:
   *       200:
   *         description: Autocomplete suggestions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       serviceId:
   *                         type: string
   *                       serviceName:
   *                         type: string
   *                       category:
   *                         type: string
   *                       priceUsd:
   *                         type: number
   *                       imageUrl:
   *                         type: string
   *                       shopId:
   *                         type: string
   *                       shopName:
   *                         type: string
   *                       location:
   *                         type: string
   */
  router.get(
    '/discovery/autocomplete',
    discoveryController.autocompleteSearch
  );

  /**
   * @swagger
   * /api/services/discovery/recently-viewed:
   *   post:
   *     summary: Track recently viewed service (Customer only)
   *     description: Record that a customer viewed a service
   *     tags: [Discovery]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - serviceId
   *             properties:
   *               serviceId:
   *                 type: string
   *     responses:
   *       200:
   *         description: View tracked successfully
   */
  router.post(
    '/discovery/recently-viewed',
    authMiddleware,
    requireRole(['customer']),
    discoveryController.trackRecentlyViewed
  );

  /**
   * @swagger
   * /api/services/discovery/recently-viewed:
   *   get:
   *     summary: Get recently viewed services (Customer only)
   *     description: Get list of services the customer recently viewed
   *     tags: [Discovery]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 12
   *           maximum: 50
   *     responses:
   *       200:
   *         description: Recently viewed services
   */
  router.get(
    '/discovery/recently-viewed',
    authMiddleware,
    requireRole(['customer']),
    discoveryController.getRecentlyViewed
  );

  /**
   * @swagger
   * /api/services/discovery/similar/{serviceId}:
   *   get:
   *     summary: Get similar services
   *     description: Get services similar to the specified service (Public)
   *     tags: [Discovery]
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 6
   *           maximum: 20
   *     responses:
   *       200:
   *         description: Similar services
   */
  router.get(
    '/discovery/similar/:serviceId',
    optionalAuthMiddleware, // Authenticate if token present for isFavorited field
    discoveryController.getSimilarServices
  );

  /**
   * @swagger
   * /api/services/discovery/trending:
   *   get:
   *     summary: Get trending services
   *     description: Get services with most bookings in recent period (Public)
   *     tags: [Discovery]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 12
   *           maximum: 50
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 7
   *           maximum: 30
   *         description: Number of days to look back
   *     responses:
   *       200:
   *         description: Trending services
   */
  router.get(
    '/discovery/trending',
    optionalAuthMiddleware, // Authenticate if token present for isFavorited field
    discoveryController.getTrendingServices
  );

  // ==================== NO-SHOW POLICY ROUTES ====================

  /**
   * @swagger
   * /api/services/shops/{shopId}/no-show-policy:
   *   get:
   *     summary: Get shop's no-show policy configuration
   *     description: Retrieve the current no-show policy settings for a shop (Shop owner or Admin only)
   *     tags: [No-Show Policy]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *         description: Shop ID
   *     responses:
   *       200:
   *         description: Policy retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     shopId:
   *                       type: string
   *                     enabled:
   *                       type: boolean
   *                     gracePeriodMinutes:
   *                       type: integer
   *                     cautionThreshold:
   *                       type: integer
   *                     depositThreshold:
   *                       type: integer
   *                     suspensionThreshold:
   *                       type: integer
   *                     depositAmount:
   *                       type: number
   *       403:
   *         description: Unauthorized
   *       404:
   *         description: Shop not found
   */
  router.get(
    '/shops/:shopId/no-show-policy',
    authMiddleware,
    requireRole(['shop', 'admin']),
    NoShowPolicyController.getShopPolicy.bind(NoShowPolicyController)
  );

  /**
   * @swagger
   * /api/services/shops/{shopId}/no-show-policy:
   *   put:
   *     summary: Update shop's no-show policy configuration
   *     description: Update no-show policy settings for a shop (Shop owner or Admin only)
   *     tags: [No-Show Policy]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               enabled:
   *                 type: boolean
   *               gracePeriodMinutes:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 120
   *               cautionThreshold:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 10
   *               cautionAdvanceBookingHours:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 168
   *               depositThreshold:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 20
   *               depositAmount:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 500
   *               depositAdvanceBookingHours:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 168
   *               depositResetAfterSuccessful:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 20
   *               maxRcnRedemptionPercent:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 100
   *               suspensionThreshold:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 50
   *               suspensionDurationDays:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 365
   *               sendEmailTier1:
   *                 type: boolean
   *               sendEmailTier2:
   *                 type: boolean
   *               sendEmailTier3:
   *                 type: boolean
   *               sendEmailTier4:
   *                 type: boolean
   *               allowDisputes:
   *                 type: boolean
   *               disputeWindowDays:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 30
   *     responses:
   *       200:
   *         description: Policy updated successfully
   *       400:
   *         description: Invalid request
   *       403:
   *         description: Unauthorized
   *       404:
   *         description: Shop not found
   */
  router.put(
    '/shops/:shopId/no-show-policy',
    authMiddleware,
    requireRole(['shop', 'admin']),
    NoShowPolicyController.updateShopPolicy.bind(NoShowPolicyController)
  );

  // ==================== TESTING ENDPOINTS (DEVELOPMENT ONLY) ====================

  /**
   * @swagger
   * /api/services/test/auto-no-show-detection:
   *   post:
   *     summary: Manually trigger auto no-show detection (Development/Testing only)
   *     description: Runs the auto-detection service immediately for testing purposes
   *     tags: [Testing]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Detection completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 report:
   *                   type: object
   *                   properties:
   *                     timestamp:
   *                       type: string
   *                     ordersChecked:
   *                       type: number
   *                     ordersMarked:
   *                       type: number
   *                     customerNotificationsSent:
   *                       type: number
   *                     shopNotificationsSent:
   *                       type: number
   *                     emailsSent:
   *                       type: number
   *                     errors:
   *                       type: array
   *                     shopsProcessed:
   *                       type: array
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Admin access required
   */
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_TEST_ENDPOINTS === 'true') {
    router.post(
      '/test/auto-no-show-detection',
      authMiddleware,
      requireRole(['admin']),
      async (req, res) => {
        try {
          const { getAutoNoShowDetectionService } = await import('../../services/AutoNoShowDetectionService');
          const service = getAutoNoShowDetectionService();
          const report = await service.runDetection();

          res.json({
            success: true,
            message: 'Auto no-show detection triggered manually',
            report: report
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Detection failed'
          });
        }
      }
    );
  }

  return router;
}

export default router;
