import { Router } from 'express';
import { MarketingController } from './controllers/MarketingController';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { requireShopPermission } from '../../middleware/permissions';

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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
    controller.sendCampaign
  );

  // Retry a campaign's failed RCN rewards (Campaign Rewards — Phase 1).
  router.post(
    '/campaigns/:campaignId/retry-rewards',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.retryRewards
  );

  // Pre-flight affordability check for a campaign's on-send RCN reward.
  router.get(
    '/campaigns/:campaignId/reward-precheck',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.rewardPrecheck
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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
    controller.cancelCampaign
  );

  // ==================== CONTACT IMPORT ROUTES ====================

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts:
   *   get:
   *     summary: Get imported contacts for a shop
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
   *           default: 50
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, unsubscribed, bounced, invalid]
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of contacts
   */
  router.get(
    '/shops/:shopId/contacts',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.getContacts
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts:
   *   post:
   *     summary: Add a new contact
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
   *               - fullName
   *             properties:
   *               fullName:
   *                 type: string
   *               email:
   *                 type: string
   *               phone:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               notes:
   *                 type: string
   *     responses:
   *       201:
   *         description: Contact created
   */
  router.post(
    '/shops/:shopId/contacts',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.createContact
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts/import:
   *   post:
   *     summary: Bulk import contacts from CSV
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
   *               - contacts
   *             properties:
   *               contacts:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - fullName
   *                   properties:
   *                     fullName:
   *                       type: string
   *                     email:
   *                       type: string
   *                     phone:
   *                       type: string
   *                     tags:
   *                       type: array
   *                       items:
   *                         type: string
   *     responses:
   *       200:
   *         description: Contacts imported
   */
  router.post(
    '/shops/:shopId/contacts/import',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.importContacts
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts/stats:
   *   get:
   *     summary: Get contact statistics
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
   *         description: Contact statistics
   */
  router.get(
    '/shops/:shopId/contacts/stats',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.getContactStats
  );

  /**
   * @swagger
   * /api/marketing/contacts/{contactId}:
   *   put:
   *     summary: Update a contact
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: contactId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Contact updated
   */
  router.put(
    '/contacts/:contactId',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.updateContact
  );

  /**
   * @swagger
   * /api/marketing/contacts/{contactId}:
   *   delete:
   *     summary: Delete a contact
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: contactId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Contact deleted
   */
  router.delete(
    '/contacts/:contactId',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.deleteContact
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts/send-email:
   *   post:
   *     summary: Send email campaign to imported contacts
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
   *               - subject
   *               - htmlContent
   *             properties:
   *               subject:
   *                 type: string
   *               htmlContent:
   *                 type: string
   *               contactIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Optional array of contact IDs to send to (sends to all active if not provided)
   *     responses:
   *       200:
   *         description: Email campaign sent
   */
  router.post(
    '/shops/:shopId/contacts/send-email',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.sendContactEmailCampaign
  );

  /**
   * @swagger
   * /api/marketing/shops/{shopId}/contacts/test-email:
   *   post:
   *     summary: Send test email
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
   *               - subject
   *               - htmlContent
   *               - testEmail
   *             properties:
   *               subject:
   *                 type: string
   *               htmlContent:
   *                 type: string
   *               testEmail:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Test email sent
   */
  router.post(
    '/shops/:shopId/contacts/test-email',
    authMiddleware,
    requireRole(['shop']),
    requireShopPermission('marketing:manage'),
    controller.sendTestEmail
  );

  // Public — opened from the unsubscribe link in a sent email, so no auth.
  router.get('/unsubscribe/:token', controller.unsubscribe);

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
    requireShopPermission('marketing:manage'),
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
    requireShopPermission('marketing:manage'),
    controller.getTemplate
  );

  return router;
}
