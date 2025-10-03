// backend/src/domains/token/routes/redemptionSession.ts
import { Router, Request, Response } from 'express';
import { redemptionSessionService } from '../services/RedemptionSessionService';
import { requireShopOrAdmin, authMiddleware } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, validateNumeric } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/tokens/redemption-session/create:
 *   post:
 *     summary: Create a redemption session (shop initiates, customer must approve)
 *     description: Shop creates a redemption request that requires customer approval
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - shopId
 *               - amount
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               shopId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Session created successfully
 *       400:
 *         description: Invalid request or pending session exists
 *       404:
 *         description: Customer or shop not found
 */
router.post('/create',
  authMiddleware,
  requireShopOrAdmin,
  validateRequired(['customerAddress', 'shopId', 'amount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 1, 1000),
  async (req: Request, res: Response) => {
    try {
      const { customerAddress, shopId, amount } = req.body;

      // Verify shop authorization
      if (req.user?.role === 'shop' && req.user.shopId !== shopId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized to create sessions for other shops'
        });
      }

      const session = await redemptionSessionService.createRedemptionSession({
        customerAddress,
        shopId,
        amount
      });

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          status: session.status,
          expiresAt: session.expiresAt,
          message: 'Redemption request sent to customer for approval'
        }
      });

    } catch (error) {
      logger.error('Create redemption session error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/generate-qr:
 *   post:
 *     summary: Generate QR code for customer-initiated redemption
 *     description: Customer generates a QR code that shop can scan
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopId
 *               - amount
 *             properties:
 *               shopId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Customer not found
 */
router.post('/generate-qr',
  authMiddleware,
  validateRequired(['shopId', 'amount']),
  validateNumeric('amount', 1, 1000),
  async (req: Request, res: Response) => {
    try {
      const { shopId, amount } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        return res.status(401).json({
          success: false,
          error: 'Customer address not found in session'
        });
      }

      const qrCode = await redemptionSessionService.generateRedemptionQR(
        customerAddress,
        shopId,
        amount
      );

      res.json({
        success: true,
        data: {
          qrCode,
          expiresIn: 300, // 5 minutes in seconds
          message: 'Show this QR code to the shop'
        }
      });

    } catch (error) {
      logger.error('Generate QR error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/approve:
 *   post:
 *     summary: Customer approves a redemption session
 *     description: Customer approves a shop-initiated redemption request
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - signature
 *             properties:
 *               sessionId:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session approved successfully
 *       400:
 *         description: Invalid session or already processed
 *       404:
 *         description: Session not found
 */
router.post('/approve',
  authMiddleware,
  validateRequired(['sessionId', 'signature']),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, signature, transactionHash } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        return res.status(401).json({
          success: false,
          error: 'Customer address not found in session'
        });
      }

      const session = await redemptionSessionService.approveSession({
        sessionId,
        customerAddress,
        signature,
        transactionHash // Pass burn transaction hash if provided
      });

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          status: session.status,
          message: transactionHash 
            ? 'Redemption approved with token burn. Shop can now process the transaction.'
            : 'Redemption approved. Shop can now process the transaction.'
        }
      });

    } catch (error) {
      logger.error('Approve session error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve session'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/reject:
 *   post:
 *     summary: Customer rejects a redemption session
 *     description: Customer rejects a shop-initiated redemption request
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session rejected successfully
 *       400:
 *         description: Invalid session
 *       404:
 *         description: Session not found
 */
router.post('/reject',
  authMiddleware,
  validateRequired(['sessionId']),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        return res.status(401).json({
          success: false,
          error: 'Customer address not found in session'
        });
      }

      await redemptionSessionService.rejectSession(sessionId, customerAddress);

      res.json({
        success: true,
        message: 'Redemption request rejected'
      });

    } catch (error) {
      logger.error('Reject session error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject session'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/my-sessions:
 *   get:
 *     summary: Get customer's redemption sessions
 *     description: Get all redemption sessions for the authenticated customer
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of redemption sessions
 *       401:
 *         description: Unauthorized
 */
router.get('/my-sessions',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        return res.status(401).json({
          success: false,
          error: 'Customer address not found in session'
        });
      }

      const sessions = await redemptionSessionService.getCustomerSessions(customerAddress);

      // Filter out customer-generated QR sessions from the approval list
      const filteredSessions = sessions.filter(s => {
        const metadata = s.metadata as any;
        return !(metadata?.qrGenerated === true || metadata?.customerInitiated === true);
      });

      res.json({
        success: true,
        data: {
          sessions: filteredSessions.map(s => ({
            sessionId: s.sessionId,
            shopId: s.shopId,
            amount: s.maxAmount,
            status: s.status,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            approvedAt: s.approvedAt,
            usedAt: s.usedAt
          })),
          pendingCount: filteredSessions.filter(s => s.status === 'pending').length
        }
      });

    } catch (error) {
      logger.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sessions'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/validate-qr:
 *   post:
 *     summary: Validate QR code (for shops)
 *     description: Shop validates a customer's QR code
 *     tags: [Redemption Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrCode
 *             properties:
 *               qrCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: QR code is valid
 *       400:
 *         description: Invalid or expired QR code
 */
router.post('/validate-qr',
  authMiddleware,
  requireShopOrAdmin,
  validateRequired(['qrCode']),
  async (req: Request, res: Response) => {
    try {
      const { qrCode } = req.body;

      const session = await redemptionSessionService.validateQRCode(qrCode);

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          customerAddress: session.customerAddress,
          amount: session.maxAmount,
          status: session.status,
          message: 'QR code is valid. Proceed with redemption.'
        }
      });

    } catch (error) {
      logger.error('Validate QR error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid QR code'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/redemption-session/status/{sessionId}:
 *   get:
 *     summary: Get session status
 *     description: Get the current status of a redemption session
 *     tags: [Redemption Sessions]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The redemption session ID
 *     responses:
 *       200:
 *         description: Session status retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/status/:sessionId',
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await redemptionSessionService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          status: session.status,
          customerAddress: session.customerAddress,
          shopId: session.shopId,
          amount: session.maxAmount,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          approvedAt: session.approvedAt,
          usedAt: session.usedAt
        }
      });

    } catch (error) {
      logger.error('Get session status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session status'
      });
    }
  }
);

export default router;