// backend/src/domains/shop/routes/tierBonus.ts
import { Router, Request, Response } from 'express';
import { tierBonusService } from '../services/TierBonusService';
import { requireShopOrAdmin, requireShopOwnership } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TierBonusCalculation:
 *       type: object
 *       properties:
 *         customerTier:
 *           type: string
 *           enum: [BRONZE, SILVER, GOLD]
 *           description: Customer's current tier
 *         baseRcnEarned:
 *           type: number
 *           description: Base RCN earned from repair (before bonus)
 *         bonusAmount:
 *           type: number
 *           description: Tier bonus amount (10/20/30 RCN)
 *         totalRcnAwarded:
 *           type: number
 *           description: Total RCN awarded (base + bonus)
 *         bonusPercentage:
 *           type: number
 *           description: Bonus percentage of base earning
 */

/**
 * @swagger
 * /api/shops/tier-bonus/preview:
 *   post:
 *     summary: Preview tier bonus for a potential repair
 *     description: Calculate what tier bonus a customer would receive for a given repair amount
 *     tags: [Tier Bonus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - repairAmount
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Customer wallet address
 *               repairAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: Repair amount in USD
 *     responses:
 *       200:
 *         description: Tier bonus preview calculated successfully
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
 *                     currentTier:
 *                       type: string
 *                       enum: [BRONZE, SILVER, GOLD]
 *                     bonusAmount:
 *                       type: number
 *                     baseRcnEarned:
 *                       type: number
 *                     totalRcnIfCompleted:
 *                       type: number
 *                     nextTierRequirement:
 *                       type: number
 *                       description: RCN needed to reach next tier
 *                     nextTierBonus:
 *                       type: number
 *                       description: Bonus amount at next tier
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { customerAddress, repairAmount } = req.body;

    if (!customerAddress || !repairAmount) {
      return res.status(400).json({
        success: false,
        error: 'Customer address and repair amount are required'
      });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer address format'
      });
    }

    if (repairAmount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Repair amount must be positive'
      });
    }

    const preview = await tierBonusService.previewTierBonus(customerAddress, repairAmount);

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    logger.error('Error previewing tier bonus:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview tier bonus'
    });
  }
});

/**
 * @swagger
 * /api/shops/tier-bonus/stats/{shopId}:
 *   get:
 *     summary: Get tier bonus statistics for a shop
 *     tags: [Tier Bonus]
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shop identifier
 *     responses:
 *       200:
 *         description: Tier bonus statistics retrieved successfully
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
 *                     totalBonusesIssued:
 *                       type: number
 *                       description: Total number of tier bonuses issued
 *                     totalBonusAmount:
 *                       type: number
 *                       description: Total RCN amount given as tier bonuses
 *                     bonusesByTier:
 *                       type: object
 *                       description: Breakdown of bonuses by customer tier
 *                       properties:
 *                         BRONZE:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             amount:
 *                               type: number
 *                         SILVER:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             amount:
 *                               type: number
 *                         GOLD:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: number
 *                             amount:
 *                               type: number
 *                     averageBonusPerTransaction:
 *                       type: number
 *       403:
 *         description: Access denied - shop owner or admin required
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get('/stats/:shopId', 
  requireShopOrAdmin,
  requireShopOwnership,
  async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    const stats = await tierBonusService.getShopTierBonusStats(shopId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting shop tier bonus stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve tier bonus statistics'
    });
  }
});

/**
 * @swagger
 * /api/shops/tier-bonus/customer/{customerAddress}:
 *   get:
 *     summary: Get tier bonus history for a customer
 *     tags: [Tier Bonus]
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
 *         description: Customer tier bonus history retrieved successfully
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
 *                     totalBonusesReceived:
 *                       type: number
 *                     totalBonusAmount:
 *                       type: number
 *                     bonusesByTier:
 *                       type: object
 *                       description: Breakdown by tier when bonuses were received
 *                     recentBonuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: Recent tier bonus records
 *       400:
 *         description: Invalid customer address format
 *       500:
 *         description: Internal server error
 */
router.get('/customer/:customerAddress', async (req: Request, res: Response) => {
  try {
    const { customerAddress } = req.params;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer address format'
      });
    }

    const history = await tierBonusService.getCustomerTierBonusHistory(customerAddress);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Error getting customer tier bonus history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve tier bonus history'
    });
  }
});

/**
 * @swagger
 * /api/shops/tier-bonus/calculate:
 *   post:
 *     summary: Calculate tier bonus for a repair transaction
 *     description: Calculate but don't apply tier bonus for a repair amount
 *     tags: [Tier Bonus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerAddress
 *               - repairAmount
 *             properties:
 *               customerAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Customer wallet address
 *               repairAmount:
 *                 type: number
 *                 minimum: 50
 *                 description: Repair amount in USD (minimum $50 for bonus eligibility)
 *     responses:
 *       200:
 *         description: Tier bonus calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/TierBonusCalculation'
 *                     - type: 'null'
 *                       description: No bonus applicable (repair amount below $50)
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { customerAddress, repairAmount } = req.body;

    if (!customerAddress || repairAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Customer address and repair amount are required'
      });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(customerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer address format'
      });
    }

    if (repairAmount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Repair amount must be positive'
      });
    }

    const calculation = await tierBonusService.calculateTierBonus(customerAddress, repairAmount);

    res.json({
      success: true,
      data: calculation
    });

  } catch (error) {
    logger.error('Error calculating tier bonus:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate tier bonus'
    });
  }
});

export default router;