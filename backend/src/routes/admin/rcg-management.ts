import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { shopRepository } from '../../repositories';
import { RCGTokenReader } from '../../contracts/RCGTokenReader';
import { logger } from '../../utils/logger';

const router = Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * Get RCG distribution overview
 * Shows how RCG tokens are allocated across the platform
 */
router.get('/distribution', async (req: Request, res: Response) => {
  try {
    const rcgReader = new RCGTokenReader();
    
    // Get total supply from contract stats
    const stats = await rcgReader.getContractStats();
    const totalSupply = stats.totalSupply;
    
    // Get treasury balance (admin wallet)
    const treasuryBalance = await rcgReader.getBalance(process.env.ADMIN_ADDRESSES?.split(',')[0] || '');
    
    // Get shops and their RCG holdings
    const shops = await shopRepository.getShopsPaginated({ page: 1, limit: 1000 });
    const shopHoldings = await Promise.all(
      shops.items.map(async (shop) => {
        if (!shop.walletAddress) return { shop: shop.shopId, balance: 0 };
        const balance = await rcgReader.getBalance(shop.walletAddress);
        return {
          shop: shop.shopId,
          balance: parseFloat(balance),
          tier: shop.rcg_tier || 'none'
        };
      })
    );
    
    // Calculate distribution
    const totalInShops = shopHoldings.reduce((sum, s) => sum + s.balance, 0);
    const circulating = parseFloat(totalSupply) - parseFloat(treasuryBalance);
    
    // Tier distribution
    const tierDistribution = {
      none: shopHoldings.filter(s => s.balance < 10000).length,
      standard: shopHoldings.filter(s => s.balance >= 10000 && s.balance < 50000).length,
      premium: shopHoldings.filter(s => s.balance >= 50000 && s.balance < 200000).length,
      elite: shopHoldings.filter(s => s.balance >= 200000).length
    };

    res.json({
      success: true,
      data: {
        totalSupply: parseFloat(totalSupply),
        treasuryBalance: parseFloat(treasuryBalance),
        circulatingSupply: circulating,
        distribution: {
          treasury: parseFloat(treasuryBalance),
          shops: totalInShops,
          other: circulating - totalInShops
        },
        tierDistribution,
        topHolders: shopHoldings
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 10)
      }
    });

  } catch (error) {
    logger.error('Error getting RCG distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RCG distribution data'
    });
  }
});

/**
 * Process OTC sale request
 * Admin approves and executes OTC sales to shops
 */
router.post('/otc-sale', async (req: Request, res: Response) => {
  try {
    const { shopId, package: packageType, paymentMethod, paymentReference } = req.body;
    
    const packages = {
      standard: { amount: 10000, price: 5000 },
      premium: { amount: 50000, price: 22500 },
      elite: { amount: 200000, price: 80000 }
    };
    
    if (!packages[packageType as keyof typeof packages]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package type'
      });
    }
    
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    const pkg = packages[packageType as keyof typeof packages];
    
    // Record the OTC sale
    const sale = {
      shopId,
      packageType,
      rcgAmount: pkg.amount,
      usdAmount: pkg.price,
      pricePerRcg: pkg.price / pkg.amount,
      paymentMethod,
      paymentReference,
      status: 'pending',
      createdAt: new Date()
    };
    
    // In production, this would:
    // 1. Verify payment has been received
    // 2. Transfer RCG tokens from treasury to shop wallet
    // 3. Update shop tier in database
    // 4. Send confirmation emails
    
    res.json({
      success: true,
      data: {
        sale,
        message: 'OTC sale recorded. Process token transfer manually.'
      }
    });

  } catch (error) {
    logger.error('Error processing OTC sale:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process OTC sale'
    });
  }
});

/**
 * Get pending OTC requests
 * Shows shops that have requested OTC purchases
 */
router.get('/otc-requests', async (req: Request, res: Response) => {
  try {
    // In production, this would fetch from a dedicated OTC requests table
    res.json({
      success: true,
      data: {
        requests: [],
        message: 'OTC request tracking not yet implemented'
      }
    });

  } catch (error) {
    logger.error('Error getting OTC requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OTC requests'
    });
  }
});

/**
 * Get commitment program enrollments
 * Shows shops enrolled in the $500/month program
 */
router.get('/commitment-enrollments', async (req: Request, res: Response) => {
  try {
    // In production, fetch from commitment_enrollments table
    const enrollments = [];
    
    res.json({
      success: true,
      data: {
        active: enrollments.filter((e: any) => e.status === 'active'),
        pending: enrollments.filter((e: any) => e.status === 'pending'),
        completed: enrollments.filter((e: any) => e.status === 'completed'),
        defaulted: enrollments.filter((e: any) => e.status === 'defaulted')
      }
    });

  } catch (error) {
    logger.error('Error getting commitment enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get commitment enrollments'
    });
  }
});

/**
 * Approve commitment program application
 */
router.post('/commitment-enrollments/:shopId/approve', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;
    const { billingMethod, startDate } = req.body;
    
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    // In production:
    // 1. Create commitment enrollment record
    // 2. Set up recurring billing
    // 3. Grant Standard tier access without RCG requirement
    // 4. Send welcome email
    
    res.json({
      success: true,
      data: {
        shopId,
        status: 'active',
        monthlyAmount: 500,
        termMonths: 6,
        totalCommitment: 3000,
        billingMethod,
        startDate,
        message: 'Commitment enrollment approved. Set up billing manually.'
      }
    });

  } catch (error) {
    logger.error('Error approving commitment enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve commitment enrollment'
    });
  }
});

export default router;