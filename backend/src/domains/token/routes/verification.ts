// backend/src/domains/token/routes/verification.ts
import { Router, Request, Response } from 'express';
import { verificationService } from '../services/VerificationService';
import { requireShopOrAdmin } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, validateNumeric } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VerificationResult:
 *       type: object
 *       properties:
 *         canRedeem:
 *           type: boolean
 *           description: Whether the customer can redeem at the shop
 *         earnedBalance:
 *           type: number
 *           description: Amount of RCN earned (redeemable) by the customer
 *         totalBalance:
 *           type: number
 *           description: Total RCN balance (earned + market-bought)
 *         maxRedeemable:
 *           type: number
 *           description: Maximum amount redeemable at this shop
 *         isHomeShop:
 *           type: boolean
 *           description: Whether this is the customer's home shop
 *         crossShopLimit:
 *           type: number
 *           description: Cross-shop redemption limit (20% of earned balance)
 *         message:
 *           type: string
 *           description: Human-readable verification message
 */

/**
 * @swagger
 * /api/tokens/verify-redemption:
 *   post:
 *     summary: Verify if customer RCN can be redeemed at shop
 *     description: Centralized verification to prevent market-bought RCN from being redeemed
 *     tags: [Token Verification]
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
 *                 description: Customer wallet address
 *               shopId:
 *                 type: string
 *                 description: Shop identifier
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Amount of RCN to redeem
 *     responses:
 *       200:
 *         description: Verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VerificationResult'
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Customer or shop not found
 *       500:
 *         description: Internal server error
 */
router.post('/verify-redemption',
  requireShopOrAdmin,
  validateRequired(['customerAddress', 'shopId', 'amount']),
  validateEthereumAddress('customerAddress'),
  validateNumeric('amount', 0.01, 10000),
  async (req: Request, res: Response) => {
    try {
      const { customerAddress, shopId, amount } = req.body;

      const verification = await verificationService.verifyRedemption(
        customerAddress,
        shopId,
        amount
      );

      res.json({
        success: true,
        data: verification
      });

    } catch (error) {
      logger.error('Redemption verification error:', error);
      res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify redemption'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/balance/{address}:
 *   get:
 *     summary: Get customer's available RCN balance
 *     description: Returns customer's available balance for redemption
 *     tags: [Token Verification]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer wallet address
 *     responses:
 *       200:
 *         description: Earned balance information
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
 *                     availableBalance:
 *                       type: number
 *                       description: Available RCN balance for redemption
 *                     lifetimeEarned:
 *                       type: number
 *                       description: Total RCN earned from shops (before redemptions)
 *                     totalRedeemed:
 *                       type: number
 *                       description: Total RCN redeemed at shops
 *                     earningHistory:
 *                       type: object
 *                       properties:
 *                         fromRepairs:
 *                           type: number
 *                         fromReferrals:
 *                           type: number
 *                         fromBonuses:
 *                           type: number
 *                         fromTierBonuses:
 *                           type: number
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.get('/balance/:address',
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const balanceInfo = await verificationService.getBalance(address);

      res.json({
        success: true,
        data: balanceInfo
      });

    } catch (error) {
      logger.error('Error getting balance:', error);
      res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/earning-sources/{address}:
 *   get:
 *     summary: Get detailed breakdown of customer's RCN earning sources
 *     description: Shows where the customer earned their RCN tokens
 *     tags: [Token Verification]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer wallet address
 *     responses:
 *       200:
 *         description: Earning sources breakdown
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
 *                     earningSources:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           shopId:
 *                             type: string
 *                           shopName:
 *                             type: string
 *                           totalEarned:
 *                             type: number
 *                           fromRepairs:
 *                             type: number
 *                           fromReferrals:
 *                             type: number
 *                           fromBonuses:
 *                             type: number
 *                           lastEarning:
 *                             type: string
 *                             format: date-time
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalShops:
 *                           type: number
 *                         primaryShop:
 *                           type: string
 *                         totalEarned:
 *                           type: number
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.get('/earning-sources/:address',
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const sources = await verificationService.getEarningSources(address);

      res.json({
        success: true,
        data: sources
      });

    } catch (error) {
      logger.error('Error getting earning sources:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get earning sources'
      });
    }
  }
);

/**
 * @swagger
 * /api/tokens/verify-batch:
 *   post:
 *     summary: Batch verification for multiple redemptions
 *     description: Verify multiple redemption requests at once (admin only)
 *     tags: [Token Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verifications
 *             properties:
 *               verifications:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required:
 *                     - customerAddress
 *                     - shopId
 *                     - amount
 *                   properties:
 *                     customerAddress:
 *                       type: string
 *                     shopId:
 *                       type: string
 *                     amount:
 *                       type: number
 *     responses:
 *       200:
 *         description: Batch verification results
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/verify-batch',
  requireShopOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { verifications } = req.body;

      if (!Array.isArray(verifications) || verifications.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Verifications array is required'
        });
      }

      if (verifications.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 verifications per batch'
        });
      }

      const results = await verificationService.batchVerifyRedemptions(verifications);

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('Batch verification error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process batch verification'
      });
    }
  }
);

export default router;