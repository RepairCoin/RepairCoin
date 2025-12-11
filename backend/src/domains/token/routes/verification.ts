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

/**
 * @swagger
 * /api/tokens/debug-home-shop/{customerAddress}/{shopId}:
 *   get:
 *     summary: Debug home shop detection
 *     description: Returns detailed info about home shop detection for debugging
 *     tags: [Token Verification]
 *     parameters:
 *       - in: path
 *         name: customerAddress
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Debug information
 */
router.get('/debug-home-shop/:customerAddress/:shopId',
  async (req: Request, res: Response) => {
    try {
      const { customerAddress, shopId } = req.params;

      // Import pool directly for debug queries
      const { getSharedPool } = await import('../../../utils/database-pool');
      const pool = getSharedPool();

      // Check customers table
      const customerQuery = await pool.query(
        'SELECT home_shop_id FROM customers WHERE address = $1',
        [customerAddress.toLowerCase()]
      );

      // Check customer_rcn_sources table
      let rcnSourcesResult = null;
      let rcnSourcesError = null;
      try {
        rcnSourcesResult = await pool.query(
          `SELECT source_shop_id, source_type, amount, earned_at
           FROM customer_rcn_sources
           WHERE customer_address = $1
           ORDER BY earned_at ASC`,
          [customerAddress.toLowerCase()]
        );
      } catch (e: any) {
        rcnSourcesError = e.message;
      }

      // Check transactions table
      const transactionsQuery = await pool.query(
        `SELECT shop_id, type, amount, created_at
         FROM transactions
         WHERE LOWER(customer_address) = LOWER($1)
         AND type = 'mint'
         AND status = 'confirmed'
         ORDER BY created_at ASC
         LIMIT 10`,
        [customerAddress]
      );

      // Get shop info
      const shopQuery = await pool.query(
        'SELECT shop_id, name FROM shops WHERE shop_id = $1',
        [shopId]
      );

      res.json({
        success: true,
        debug: {
          inputCustomerAddress: customerAddress,
          inputShopId: shopId,
          customerTable: {
            found: customerQuery.rows.length > 0,
            home_shop_id: customerQuery.rows[0]?.home_shop_id || null
          },
          rcnSourcesTable: {
            error: rcnSourcesError,
            rowCount: rcnSourcesResult?.rows.length || 0,
            rows: rcnSourcesResult?.rows || []
          },
          transactionsTable: {
            rowCount: transactionsQuery.rows.length,
            rows: transactionsQuery.rows
          },
          shopInfo: {
            found: shopQuery.rows.length > 0,
            shop_id: shopQuery.rows[0]?.shop_id || null,
            name: shopQuery.rows[0]?.name || null
          },
          comparison: {
            homeShopFromCustomers: customerQuery.rows[0]?.home_shop_id || null,
            firstMintShopId: transactionsQuery.rows[0]?.shop_id || null,
            requestedShopId: shopId,
            wouldMatch: (customerQuery.rows[0]?.home_shop_id || transactionsQuery.rows[0]?.shop_id) === shopId
          }
        }
      });
    } catch (error) {
      logger.error('Debug home shop error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Debug failed'
      });
    }
  }
);

export default router;