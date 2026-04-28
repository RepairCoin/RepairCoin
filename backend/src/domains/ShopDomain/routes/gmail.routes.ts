// backend/src/domains/ShopDomain/routes/gmail.routes.ts
import express from 'express';
import { GmailController } from '../controllers/GmailController';
import { authMiddleware, requireRole } from '../../../middleware/auth';

const router = express.Router();
const gmailController = new GmailController();

/**
 * @swagger
 * /api/shops/gmail/connect:
 *   get:
 *     summary: Get Gmail OAuth authorization URL
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authorization URL generated
 */
router.get('/connect', authMiddleware, requireRole(['shop']), gmailController.connectGmail);

/**
 * @swagger
 * /api/shops/gmail/callback:
 *   get:
 *     summary: Handle Gmail OAuth callback (GET — Google redirect)
 *     tags: [Gmail]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to frontend callback page with success/error query
 *   post:
 *     summary: Handle Gmail OAuth callback (POST — programmatic)
 *     tags: [Gmail]
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
 *         description: Gmail connected successfully
 */
// GET handler for Google OAuth callback (Google redirects here after authorization — no JWT)
router.get('/callback', gmailController.handleGmailCallback);

// POST handler for manual callback (frontend programmatic exchange)
router.post('/callback', authMiddleware, requireRole(['shop']), gmailController.handleGmailCallback);

/**
 * @swagger
 * /api/shops/gmail/status:
 *   get:
 *     summary: Get Gmail connection status
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gmail connection status
 */
router.get('/status', authMiddleware, requireRole(['shop']), gmailController.getConnectionStatus);

/**
 * @swagger
 * /api/shops/gmail/disconnect:
 *   delete:
 *     summary: Disconnect Gmail integration
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gmail disconnected successfully
 */
router.delete('/disconnect', authMiddleware, requireRole(['shop']), gmailController.disconnectGmail);

/**
 * @swagger
 * /api/shops/gmail/send-test:
 *   post:
 *     summary: Send a test email
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test email sent successfully
 */
router.post('/send-test', authMiddleware, requireRole(['shop']), gmailController.sendTestEmail);

/**
 * @swagger
 * /api/shops/gmail/stats:
 *   get:
 *     summary: Get email statistics
 *     tags: [Gmail]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email statistics
 */
router.get('/stats', authMiddleware, requireRole(['shop']), gmailController.getEmailStats);

export default router;
