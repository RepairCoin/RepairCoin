import { Router } from 'express';
import { MarketingController } from './controllers/MarketingController';
import { authMiddleware, requireRole } from '../../middleware/auth';

const router = Router();

export function initializeRoutes(): Router {
  const controller = new MarketingController();

  // ==================== CAMPAIGN ROUTES ====================

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/campaigns:
   *   get:
   *     summary: Get all campaigns for a shop
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
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
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [draft, scheduled, sent, cancelled]
   *     responses:
   *       200:
   *         description: List of campaigns
   */
  router.get(
    '/shops/:shopId/campaigns',
    authMiddleware,
    requireRole(['shop']),
    controller.getCampaigns
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/campaigns:
   *   post:
   *     summary: Create a new campaign
   *     tags: [Marketing]
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
   *               - name
   *               - campaignType
   *             properties:
   *               name:
   *                 type: string
   *               campaignType:
   *                 type: string
   *                 enum: [announce_service, offer_coupon, newsletter, custom]
   *               subject:
   *                 type: string
   *               designContent:
   *                 type: object
   *               deliveryMethod:
   *                 type: string
   *                 enum: [email, in_app, both]
   *     responses:
   *       201:
   *         description: Campaign created
   */
  router.post(
    '/shops/:shopId/campaigns',
    authMiddleware,
    requireRole(['shop']),
    controller.createCampaign
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/stats:
   *   get:
   *     summary: Get campaign statistics for a shop
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign statistics
   */
  router.get(
    '/shops/:shopId/stats',
    authMiddleware,
    requireRole(['shop']),
    controller.getStats
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/audience-count:
   *   get:
   *     summary: Get audience count for targeting
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: audienceType
   *         schema:
   *           type: string
   *           enum: [all_customers, top_spenders, frequent_visitors, active_customers, custom]
   *     responses:
   *       200:
   *         description: Audience count
   */
  router.get(
    '/shops/:shopId/audience-count',
    authMiddleware,
    requireRole(['shop']),
    controller.getAudienceCount
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/customers:
   *   get:
   *     summary: Get shop customers for campaign targeting
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
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
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search by name, email, or wallet address
   *     responses:
   *       200:
   *         description: Paginated list of shop customers
   */
  router.get(
    '/shops/:shopId/customers',
    authMiddleware,
    requireRole(['shop']),
    controller.getShopCustomers
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}:
   *   get:
   *     summary: Get a single campaign
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign details
   */
  router.get(
    '/campaigns/:campaignId',
    authMiddleware,
    requireRole(['shop']),
    controller.getCampaign
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}:
   *   put:
   *     summary: Update a campaign
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign updated
   */
  router.put(
    '/campaigns/:campaignId',
    authMiddleware,
    requireRole(['shop']),
    controller.updateCampaign
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}:
   *   delete:
   *     summary: Delete a campaign
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign deleted
   */
  router.delete(
    '/campaigns/:campaignId',
    authMiddleware,
    requireRole(['shop']),
    controller.deleteCampaign
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}/send:
   *   post:
   *     summary: Send a campaign immediately
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign sent
   */
  router.post(
    '/campaigns/:campaignId/send',
    authMiddleware,
    requireRole(['shop']),
    controller.sendCampaign
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}/schedule:
   *   post:
   *     summary: Schedule a campaign
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
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
   *               - scheduledAt
   *             properties:
   *               scheduledAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Campaign scheduled
   */
  router.post(
    '/campaigns/:campaignId/schedule',
    authMiddleware,
    requireRole(['shop']),
    controller.scheduleCampaign
  );

  /**
   * @swagger
   * /api/marketing/campaigns/{campaignId}/cancel:
   *   post:
   *     summary: Cancel a scheduled campaign
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Campaign cancelled
   */
  router.post(
    '/campaigns/:campaignId/cancel',
    authMiddleware,
    requireRole(['shop']),
    controller.cancelCampaign
  );

  // ==================== TEMPLATE ROUTES ====================

  /**
   * @swagger
   * /api/marketing/templates:
   *   get:
   *     summary: Get available templates
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [coupon, announcement, newsletter, event]
   *     responses:
   *       200:
   *         description: List of templates
   */
  router.get(
    '/templates',
    authMiddleware,
    requireRole(['shop']),
    controller.getTemplates
  );

  /**
   * @swagger
   * /api/marketing/templates/{templateId}:
   *   get:
   *     summary: Get a specific template
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: templateId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Template details
   */
  router.get(
    '/templates/:templateId',
    authMiddleware,
    requireRole(['shop']),
    controller.getTemplate
  );

  return router;
}
