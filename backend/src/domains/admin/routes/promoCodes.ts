import { Router, Request, Response } from 'express';
import { PromoCodeService } from '../../../services/PromoCodeService';
import { logger } from '../../../utils/logger';

const router = Router();
const promoCodeService = new PromoCodeService();

// Get all promo codes (admin view)
router.get(
  '/promo-codes',
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      if (limit < 1 || limit > 100) {
        return res.status(400).json({ 
          success: false, 
          error: 'Limit must be between 1 and 100' 
        });
      }

      const promoCodes = await promoCodeService.getAllPromoCodes(limit, offset);

      res.json({
        success: true,
        data: promoCodes
      });
    } catch (error: any) {
      logger.error('Error fetching all promo codes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch promo codes'
      });
    }
  }
);

// Get promo code analytics (admin view)
router.get(
  '/promo-codes/analytics',
  async (req: Request, res: Response) => {
    try {
      const analytics = await promoCodeService.getPromoCodeAnalytics();

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      logger.error('Error fetching promo code analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics'
      });
    }
  }
);

export default router;