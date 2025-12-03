// backend/src/domains/ServiceDomain/routes.ts
import { Router } from 'express';
import { ServiceController } from './controllers/ServiceController';
import { OrderController } from './controllers/OrderController';
import { FavoriteController } from './controllers/FavoriteController';
import { ReviewController } from './controllers/ReviewController';
import { AnalyticsController } from './controllers/AnalyticsController';
import { PaymentService } from './services/PaymentService';
import { authMiddleware, optionalAuthMiddleware, requireRole } from '../../middleware/auth';
import { StripeService } from '../../services/StripeService';

const router = Router();

export function initializeRoutes(stripe: StripeService): Router {
  // Initialize controllers
  const paymentService = new PaymentService(stripe);
  const serviceController = new ServiceController();
  const orderController = new OrderController(paymentService);
  const favoriteController = new FavoriteController();
  const reviewController = new ReviewController();
  const analyticsController = new AnalyticsController();

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
    authMiddleware,
    requireRole(['customer']),
    orderController.createPaymentIntent
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
   *     summary: Mark review as helpful (Public)
   *     description: Increment helpful count for a review
   *     tags: [Reviews]
   *     parameters:
   *       - in: path
   *         name: reviewId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Review marked as helpful
   */
  router.post(
    '/reviews/:reviewId/helpful',
    reviewController.markHelpful
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

  return router;
}

export default router;
