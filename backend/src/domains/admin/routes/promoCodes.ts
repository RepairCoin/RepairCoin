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

// Activate / deactivate a promo code (admin)
router.patch(
  '/promo-codes/:id/status',
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid promo code id' });
      }
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'isActive (boolean) is required' });
      }

      const updated = await promoCodeService.adminSetPromoActive(id, isActive);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      const notFound = error?.message === 'Promo code not found';
      logger.error('Error updating promo code status:', error);
      res.status(notFound ? 404 : 500).json({
        success: false,
        error: notFound ? error.message : 'Failed to update promo code status'
      });
    }
  }
);

// Delete a promo code (admin) — also removes its usage history (cascade)
router.delete(
  '/promo-codes/:id',
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid promo code id' });
      }

      await promoCodeService.adminDeletePromoCode(id);
      res.json({ success: true });
    } catch (error: any) {
      const notFound = error?.message === 'Promo code not found';
      logger.error('Error deleting promo code:', error);
      res.status(notFound ? 404 : 500).json({
        success: false,
        error: notFound ? error.message : 'Failed to delete promo code'
      });
    }
  }
);

export default router;