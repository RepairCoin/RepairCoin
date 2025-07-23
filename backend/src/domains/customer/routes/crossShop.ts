// backend/src/domains/customer/routes/crossShop.ts
import { Router, Request, Response } from 'express';
import { crossShopVerificationService, RedemptionRequest } from '../services/CrossShopVerificationService';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RedemptionRequest:
 *       type: object
 *       required:
 *         - customerAddress
 *         - redemptionShopId
 *         - requestedAmount
 *       properties:
 *         customerAddress:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *           description: Customer wallet address
 *         redemptionShopId:
 *           type: string
 *           description: Shop where customer wants to redeem tokens
 *         requestedAmount:
 *           type: number
 *           minimum: 1
 *           description: Amount of RCN to redeem
 *         purpose:
 *           type: string
 *           description: Optional purpose description
 *     RedemptionVerificationResult:
 *       type: object
 *       properties:
 *         approved:
 *           type: boolean
 *           description: Whether redemption is approved
 *         availableBalance:
 *           type: number
 *           description: Customer's total redeemable balance
 *         maxCrossShopAmount:
 *           type: number
 *           description: Maximum amount available for cross-shop redemption (20% of total)
 *         requestedAmount:
 *           type: number
 *           description: Amount requested for redemption
 *         verificationId:
 *           type: string
 *           description: Unique verification record ID
 *         message:
 *           type: string
 *           description: Human-readable result message
 *         denialReason:
 *           type: string
 *           description: Reason for denial (if applicable)
 */

/**
 * @swagger
 * /api/customers/cross-shop/verify:
 *   post:
 *     summary: Verify cross-shop redemption eligibility
 *     description: Centralized API to verify if a customer can redeem tokens at a non-earning shop
 *     tags: [Cross-Shop Redemption]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RedemptionRequest'
 *     responses:
 *       200:
 *         description: Verification completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RedemptionVerificationResult'
 *       400:
 *         description: Invalid verification request
 *       500:
 *         description: Internal server error
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const redemptionRequest: RedemptionRequest = {
      customerAddress: req.body.customerAddress,
      redemptionShopId: req.body.redemptionShopId,
      requestedAmount: req.body.requestedAmount,
      purpose: req.body.purpose
    };

    const result = await crossShopVerificationService.verifyRedemption(redemptionRequest);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error verifying cross-shop redemption:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify cross-shop redemption'
    });
  }
});

/**
 * @swagger
 * /api/customers/cross-shop/balance/{customerAddress}:
 *   get:
 *     summary: Get customer's cross-shop balance breakdown
 *     description: Shows how much of customer's balance can be used for cross-shop redemptions (20% limit)
 *     tags: [Cross-Shop Redemption]
 *     parameters:
 *       - in: path
 *         name: customerAddress
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer wallet address
 *     responses:
 *       200:
 *         description: Balance breakdown retrieved successfully
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
 *                     totalRedeemableBalance:
 *                       type: number
 *                       description: Total earned RCN available for redemption
 *                     crossShopLimit:
 *                       type: number
 *                       description: 20% of total available for cross-shop use
 *                     availableForCrossShop:
 *                       type: number
 *                       description: Current amount available for cross-shop redemption
 *                     homeShopBalance:
 *                       type: number
 *                       description: 80% that can only be used at earning shops
 *       400:
 *         description: Invalid customer address
 *       500:
 *         description: Internal server error
 */
router.get('/balance/:customerAddress', async (req: Request, res: Response) => {
  try {
    const { customerAddress } = req.params;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer address format'
      });
    }

    const balance = await crossShopVerificationService.getCrossShopBalance(customerAddress);

    res.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error('Error getting cross-shop balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve cross-shop balance'
    });
  }
});

/**
 * @swagger
 * /api/customers/cross-shop/process:
 *   post:
 *     summary: Process approved cross-shop redemption
 *     description: Execute the actual redemption after verification approval
 *     tags: [Cross-Shop Redemption]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationId
 *               - actualRedemptionAmount
 *             properties:
 *               verificationId:
 *                 type: string
 *                 description: ID from previous verification request
 *               actualRedemptionAmount:
 *                 type: number
 *                 minimum: 1
 *                 description: Actual amount to redeem (must be <= verified amount)
 *     responses:
 *       200:
 *         description: Redemption processed successfully
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
 *                     success:
 *                       type: boolean
 *                     transactionId:
 *                       type: string
 *                       description: Blockchain transaction ID
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid processing request
 *       500:
 *         description: Internal server error
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { verificationId, actualRedemptionAmount } = req.body;

    if (!verificationId || !actualRedemptionAmount) {
      return res.status(400).json({
        success: false,
        error: 'Verification ID and actual redemption amount are required'
      });
    }

    const result = await crossShopVerificationService.processRedemption(
      verificationId, 
      actualRedemptionAmount
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error processing cross-shop redemption:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process cross-shop redemption'
    });
  }
});

/**
 * @swagger
 * /api/customers/cross-shop/history/{customerAddress}:
 *   get:
 *     summary: Get customer's cross-shop verification history
 *     tags: [Cross-Shop Redemption]
 *     parameters:
 *       - in: path
 *         name: customerAddress
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Customer wallet address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Verification history retrieved successfully
 *       400:
 *         description: Invalid customer address
 *       500:
 *         description: Internal server error
 */
router.get('/history/:customerAddress', async (req: Request, res: Response) => {
  try {
    const { customerAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer address format'
      });
    }

    const history = await crossShopVerificationService.getCustomerVerificationHistory(customerAddress, limit);

    res.json({
      success: true,
      data: {
        verifications: history,
        count: history.length
      }
    });

  } catch (error) {
    logger.error('Error getting verification history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve verification history'
    });
  }
});

/**
 * @swagger
 * /api/customers/cross-shop/stats/network:
 *   get:
 *     summary: Get network-wide cross-shop statistics
 *     tags: [Cross-Shop Redemption]
 *     responses:
 *       200:
 *         description: Network statistics retrieved successfully
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
 *                     totalCrossShopRedemptions:
 *                       type: number
 *                     totalCrossShopValue:
 *                       type: number
 *                     participatingShops:
 *                       type: number
 *                     averageRedemptionSize:
 *                       type: number
 *                     networkUtilizationRate:
 *                       type: number
 *                       description: Percentage of available cross-shop balance actually used
 *                     topCrossShopShops:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           shopId:
 *                             type: string
 *                           shopName:
 *                             type: string
 *                           totalRedemptions:
 *                             type: number
 *                           totalValue:
 *                             type: number
 *       500:
 *         description: Internal server error
 */
router.get('/stats/network', async (req: Request, res: Response) => {
  try {
    const stats = await crossShopVerificationService.getNetworkCrossShopStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting network cross-shop stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve network statistics'
    });
  }
});

export default router;