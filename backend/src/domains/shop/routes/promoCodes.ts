import { Router, Request, Response } from 'express';
import { PromoCodeService } from '../../../services/PromoCodeService';
import { authMiddleware } from '../../../middleware/auth';

const router = Router();
const promoCodeService = new PromoCodeService();

// Helper function to validate Ethereum address
const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Get all promo codes for a shop
router.get(
  '/:shopId/promo-codes',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const { active } = req.query;
      
      // Verify shop ownership or admin
      if (req.user?.role === 'shop' && req.user.shopId !== shopId) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only view promo codes for your own shop' 
        });
      }

      const onlyActive = active === 'true';
      const promoCodes = await promoCodeService.getShopPromoCodes(shopId, onlyActive);

      res.json({
        success: true,
        data: promoCodes
      });
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch promo codes' 
      });
    }
  }
);

// Create a new promo code
router.post(
  '/:shopId/promo-codes',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      
      // Basic validation
      if (!req.body.code || req.body.code.trim().length < 3 || req.body.code.trim().length > 20) {
        return res.status(400).json({ 
          success: false, 
          error: 'Code must be between 3 and 20 characters' 
        });
      }
      
      if (!req.body.name || !req.body.name.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Name is required' 
        });
      }
      
      if (!['fixed', 'percentage'].includes(req.body.bonus_type)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Bonus type must be fixed or percentage' 
        });
      }
      
      if (!req.body.bonus_value || req.body.bonus_value <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Bonus value must be greater than 0' 
        });
      }
      
      // Verify shop ownership
      if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only create promo codes for your own shop' 
        });
      }

      const promoCode = await promoCodeService.createPromoCode(shopId, req.body);

      res.status(201).json({
        success: true,
        data: promoCode
      });
    } catch (error) {
      console.error('Error creating promo code:', error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create promo code' 
      });
    }
  }
);

// Update a promo code
router.put(
  '/:shopId/promo-codes/:promoCodeId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { shopId, promoCodeId } = req.params;
      
      // Verify shop ownership
      if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only update promo codes for your own shop' 
        });
      }

      const promoCode = await promoCodeService.updatePromoCode(
        shopId, 
        parseInt(promoCodeId), 
        req.body
      );

      res.json({
        success: true,
        data: promoCode
      });
    } catch (error) {
      console.error('Error updating promo code:', error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update promo code' 
      });
    }
  }
);

// Deactivate a promo code
router.delete(
  '/:shopId/promo-codes/:promoCodeId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { shopId, promoCodeId } = req.params;
      
      // Verify shop ownership
      if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only deactivate promo codes for your own shop' 
        });
      }

      await promoCodeService.deactivatePromoCode(shopId, parseInt(promoCodeId));

      res.json({
        success: true,
        message: 'Promo code deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating promo code:', error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to deactivate promo code' 
      });
    }
  }
);

// Get promo code statistics
router.get(
  '/:shopId/promo-codes/:promoCodeId/stats',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { shopId, promoCodeId } = req.params;
      
      // Verify shop ownership or admin
      if (req.user?.role === 'shop' && req.user.shopId !== shopId) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only view statistics for your own promo codes' 
        });
      }

      const stats = await promoCodeService.getPromoCodeStats(shopId, parseInt(promoCodeId));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching promo code stats:', error);
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch statistics' 
      });
    }
  }
);

// Validate a promo code (public endpoint for customers)
router.post(
  '/promo-codes/validate',
  async (req: Request, res: Response) => {
    try {
      const { code, shop_id, customer_address } = req.body;
      
      // Basic validation
      if (!code || !code.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Promo code is required' 
        });
      }
      
      if (!shop_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Shop ID is required' 
        });
      }
      
      if (!customer_address || !isValidEthereumAddress(customer_address)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid customer address is required' 
        });
      }
      
      const validation = await promoCodeService.validatePromoCode(
        code,
        shop_id,
        customer_address
      );

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('Error validating promo code:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to validate promo code' 
      });
    }
  }
);

// Get customer's promo code usage history
router.get(
  '/customers/:address/promo-history',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      if (!isValidEthereumAddress(address)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid address is required' 
        });
      }
      
      // Verify customer ownership or admin
      if (req.user?.role === 'customer' && req.user.address?.toLowerCase() !== address.toLowerCase()) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only view your own promo code history' 
        });
      }

      const history = await promoCodeService.getCustomerPromoHistory(address);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error fetching promo history:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch promo code history' 
      });
    }
  }
);

// Admin endpoints
router.get(
  '/admin/promo-codes',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Admin only
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

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
    } catch (error) {
      console.error('Error fetching all promo codes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch promo codes' 
      });
    }
  }
);

router.get(
  '/admin/promo-codes/analytics',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Admin only
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const analytics = await promoCodeService.getPromoCodeAnalytics();

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching promo code analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch analytics' 
      });
    }
  }
);

export default router;