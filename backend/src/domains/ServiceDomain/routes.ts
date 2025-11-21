// backend/src/domains/ServiceDomain/routes.ts
import { Router } from 'express';
import { ServiceController } from './controllers/ServiceController';
import { OrderController } from './controllers/OrderController';
import { PaymentService } from './services/PaymentService';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { StripeService } from '../../services/StripeService';

const router = Router();

export function initializeRoutes(stripe: StripeService): Router {
  // Initialize controllers
  const paymentService = new PaymentService(stripe);
  const serviceController = new ServiceController();
  const orderController = new OrderController(paymentService);

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
   * /api/services/shop/{shopId}:
   *   get:
   *     summary: Get all services for a shop
   *     description: Get all services offered by a specific shop
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
    serviceController.getShopServices
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

  return router;
}

export default router;
