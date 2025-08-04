import { Router, Request, Response } from 'express';
import { ReferralService } from '../services/ReferralService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const referralService = new ReferralService();

/**
 * @swagger
 * /api/referrals/generate:
 *   post:
 *     summary: Generate referral code for customer
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code generated
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
 *                     referralCode:
 *                       type: string
 *                     referralLink:
 *                       type: string
 */
router.post('/generate', authMiddleware, requireRole(['customer']), async (req: Request, res: Response) => {
  try {
    const customerAddress = req.user?.address;
    if (!customerAddress) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const referralCode = await referralService.generateReferralCode(customerAddress);
    const referralLink = `${process.env.FRONTEND_URL}/register?ref=${referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink
      }
    });
  } catch (error) {
    logger.error('Error generating referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate referral code'
    });
  }
});

/**
 * @swagger
 * /api/referrals/validate/{code}:
 *   get:
 *     summary: Validate referral code
 *     tags: [Referrals]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Referral code validation result
 */
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    const validation = await referralService.validateReferralCode(code);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error('Error validating referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate referral code'
    });
  }
});

/**
 * @swagger
 * /api/referrals/stats:
 *   get:
 *     summary: Get referral statistics
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral statistics
 */
router.get('/stats', authMiddleware, requireRole(['customer']), async (req: Request, res: Response) => {
  try {
    const customerAddress = req.user?.address;
    
    const stats = await referralService.getReferralStats(customerAddress);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting referral stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral statistics'
    });
  }
});

/**
 * @swagger
 * /api/referrals/leaderboard:
 *   get:
 *     summary: Get referral leaderboard
 *     tags: [Referrals]
 *     responses:
 *       200:
 *         description: Referral leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const stats = await referralService.getReferralStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting referral leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get referral leaderboard'
    });
  }
});

/**
 * @swagger
 * /api/referrals/rcn-breakdown:
 *   get:
 *     summary: Get customer RCN breakdown by source
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: RCN breakdown by source
 */
router.get('/rcn-breakdown', authMiddleware, requireRole(['customer']), async (req: Request, res: Response) => {
  try {
    const customerAddress = req.user?.address;
    if (!customerAddress) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const breakdown = await referralService.getCustomerRcnBreakdown(customerAddress);
    
    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    logger.error('Error getting RCN breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RCN breakdown'
    });
  }
});

/**
 * @swagger
 * /api/referrals/verify-redemption:
 *   post:
 *     summary: Verify if customer can redeem at shop
 *     tags: [Referrals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerAddress:
 *                 type: string
 *               shopId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Redemption verification result
 */
router.post('/verify-redemption', async (req: Request, res: Response) => {
  try {
    const { customerAddress, shopId, amount } = req.body;
    
    if (!customerAddress || !shopId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const verification = await referralService.verifyRedemption(
      customerAddress,
      shopId,
      amount
    );
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Error verifying redemption:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify redemption'
    });
  }
});

export default router;