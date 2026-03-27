// backend/src/domains/ShopDomain/routes/calendar.routes.ts
import express from 'express';
import { CalendarController } from '../controllers/CalendarController';
import { authMiddleware, requireRole } from '../../../middleware/auth';

const router = express.Router();
const calendarController = new CalendarController();

/**
 * @swagger
 * /api/shops/calendar/connect/google:
 *   get:
 *     summary: Get Google OAuth authorization URL
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authorization URL generated
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
 *                     authUrl:
 *                       type: string
 *                     message:
 *                       type: string
 */
router.get('/connect/google', authMiddleware, requireRole(['shop']), calendarController.connectGoogle);

/**
 * @swagger
 * /api/shops/calendar/callback/google:
 *   post:
 *     summary: Handle Google OAuth callback
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               state:
 *                 type: string
 *     responses:
 *       200:
 *         description: Calendar connected successfully
 */
router.post(
  '/callback/google',
  authMiddleware,
  requireRole(['shop']),
  calendarController.handleGoogleCallback
);

/**
 * @swagger
 * /api/shops/calendar/status:
 *   get:
 *     summary: Get calendar connection status
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar connection status
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
 *                     connected:
 *                       type: boolean
 *                     provider:
 *                       type: string
 *                     email:
 *                       type: string
 *                     lastSync:
 *                       type: string
 *                       format: date-time
 *                     syncStatus:
 *                       type: string
 */
router.get('/status', authMiddleware, requireRole(['shop']), calendarController.getConnectionStatus);

/**
 * @swagger
 * /api/shops/calendar/disconnect/{provider}:
 *   delete:
 *     summary: Disconnect calendar integration
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google]
 *     responses:
 *       200:
 *         description: Calendar disconnected successfully
 */
router.delete(
  '/disconnect/:provider',
  authMiddleware,
  requireRole(['shop']),
  calendarController.disconnectCalendar
);

/**
 * @swagger
 * /api/shops/calendar/test-sync:
 *   post:
 *     summary: Manually trigger sync for pending orders (testing)
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 */
router.post('/test-sync', authMiddleware, requireRole(['shop']), calendarController.testSync);

/**
 * @swagger
 * /api/shops/calendar/refresh-token:
 *   post:
 *     summary: Manually refresh access token (testing)
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post('/refresh-token', authMiddleware, requireRole(['shop']), calendarController.refreshToken);

export default router;
