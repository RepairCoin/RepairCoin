import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { revenueDistributionService } from '../../services/RevenueDistributionService';
import { shopRepository } from '../../repositories';
import { logger } from '../../utils/logger';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * Get current week's revenue distribution breakdown
 */
router.get('/current-week', async (req: Request, res: Response) => {
  try {
    // Get current week's purchases
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get purchases from database
    const purchases = await shopRepository.getPurchasesInDateRange(startOfWeek, endOfWeek);
    
    // Calculate revenue distribution
    const report = revenueDistributionService.generateRevenueReport(
      purchases.map(p => ({
        rcnAmount: p.amount,
        shopTier: p.shop_tier || 'standard',
        totalCost: p.total_cost,
        purchaseDate: p.created_at
      }))
    );

    res.json({
      success: true,
      data: {
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
        ...report
      }
    });

  } catch (error) {
    logger.error('Error getting current week revenue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get revenue distribution data'
    });
  }
});

/**
 * Get revenue distribution for a specific date range
 */
router.get('/range', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    const purchases = await shopRepository.getPurchasesInDateRange(start, end);
    
    const report = revenueDistributionService.generateRevenueReport(
      purchases.map(p => ({
        rcnAmount: p.amount,
        shopTier: p.shop_tier || 'standard',
        totalCost: p.total_cost,
        purchaseDate: p.created_at
      }))
    );

    res.json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        ...report
      }
    });

  } catch (error) {
    logger.error('Error getting revenue range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get revenue distribution data'
    });
  }
});

/**
 * Get projected staker revenue based on platform volume
 */
router.get('/projections', async (req: Request, res: Response) => {
  try {
    const { monthlyVolume = 100000, averageTier = 'standard' } = req.query;
    
    const projections = revenueDistributionService.calculateProjectedStakerRevenue(
      Number(monthlyVolume),
      averageTier as string
    );

    res.json({
      success: true,
      data: {
        assumptions: {
          monthlyRCNSales: Number(monthlyVolume),
          averageTier: averageTier as string,
          assumedStakedRCG: 30000000
        },
        projections
      }
    });

  } catch (error) {
    logger.error('Error getting revenue projections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate revenue projections'
    });
  }
});

/**
 * Get revenue by shop tier breakdown
 */
router.get('/by-tier', async (req: Request, res: Response) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const purchases = await shopRepository.getPurchasesInDateRange(last30Days, new Date());
    
    // Group by tier
    const tierBreakdown = {
      standard: { purchases: 0, rcnSold: 0, revenue: 0, avgDiscount: '0%' },
      premium: { purchases: 0, rcnSold: 0, revenue: 0, avgDiscount: '20%' },
      elite: { purchases: 0, rcnSold: 0, revenue: 0, avgDiscount: '40%' }
    };

    purchases.forEach(purchase => {
      const tier = purchase.shop_tier || 'standard';
      if (tierBreakdown[tier as keyof typeof tierBreakdown]) {
        tierBreakdown[tier as keyof typeof tierBreakdown].purchases++;
        tierBreakdown[tier as keyof typeof tierBreakdown].rcnSold += purchase.amount;
        tierBreakdown[tier as keyof typeof tierBreakdown].revenue += purchase.total_cost;
      }
    });

    // Calculate what revenue would have been at standard pricing
    const standardPriceRevenue = purchases.reduce((sum, p) => sum + (p.amount * 0.10), 0);
    const actualRevenue = purchases.reduce((sum, p) => sum + p.total_cost, 0);
    const overallDiscount = ((standardPriceRevenue - actualRevenue) / standardPriceRevenue * 100).toFixed(2);

    res.json({
      success: true,
      data: {
        period: 'last_30_days',
        tierBreakdown,
        summary: {
          totalPurchases: purchases.length,
          totalRCNSold: purchases.reduce((sum, p) => sum + p.amount, 0),
          totalRevenue: actualRevenue,
          revenueAtStandardPricing: standardPriceRevenue,
          overallDiscountGiven: `${overallDiscount}%`,
          revenueLostToDiscounts: standardPriceRevenue - actualRevenue
        }
      }
    });

  } catch (error) {
    logger.error('Error getting tier breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tier breakdown data'
    });
  }
});

export default router;