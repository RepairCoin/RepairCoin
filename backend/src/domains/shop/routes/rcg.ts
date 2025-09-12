// backend/src/domains/shop/routes/rcg.ts
import { Router, Request, Response } from 'express';
import { RCGTokenReader } from '../../../contracts/RCGTokenReader';
import { logger } from '../../../utils/logger';
import { shopRepository } from '../../../repositories';

const router = Router({ mergeParams: true });

/**
 * Get RCG balance and tier info for a shop
 * GET /api/shops/:shopId/rcg-info
 */
router.get('/:shopId/rcg-info', async (req: Request, res: Response) => {
  try {
    const { shopId } = req.params;

    // Get shop details
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    if (!shop.walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Shop has no wallet address configured'
      });
    }

    // Get RCG balance
    const rcgReader = new RCGTokenReader();
    const balanceString = await rcgReader.getBalance(shop.walletAddress);
    const balance = parseFloat(balanceString);
    
    // Determine tier based on balance
    let tier = 'none';
    let nextTierRequired = 10000; // Standard tier minimum
    let currentTierMin = 0;
    
    if (balance >= 200000) {
      tier = 'elite';
      currentTierMin = 200000;
      nextTierRequired = 0; // Already at highest tier - no next tier
    } else if (balance >= 50000) {
      tier = 'premium';
      currentTierMin = 50000;
      nextTierRequired = 200000; // Elite tier
    } else if (balance >= 10000) {
      tier = 'standard';
      currentTierMin = 10000;
      nextTierRequired = 50000; // Premium tier
    }

    // Calculate tier benefits
    const tierBenefits = {
      standard: {
        rcnPrice: 0.10,
        discount: '0%',
        minRequired: 10000
      },
      premium: {
        rcnPrice: 0.08,
        discount: '20%',
        minRequired: 50000
      },
      elite: {
        rcnPrice: 0.06,
        discount: '40%',
        minRequired: 200000
      }
    };

    return res.json({
      success: true,
      data: {
        balance,
        tier,
        currentTierInfo: tier !== 'none' ? tierBenefits[tier as keyof typeof tierBenefits] : null,
        nextTierInfo: nextTierRequired > 0 ? {
          tier: nextTierRequired === 10000 ? 'standard' : nextTierRequired === 50000 ? 'premium' : 'elite',
          required: nextTierRequired,
          tokensNeeded: Math.max(0, nextTierRequired - balance),
          benefits: tierBenefits[nextTierRequired === 10000 ? 'standard' : nextTierRequired === 50000 ? 'premium' : 'elite']
        } : null,
        contractAddress: process.env.RCG_CONTRACT_ADDRESS || '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D'
      }
    });

  } catch (error) {
    logger.error('Error fetching shop RCG info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch RCG information'
    });
  }
});

export default router;