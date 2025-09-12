import { logger } from '../utils/logger';

export interface TierPricing {
  tier: 'standard' | 'premium' | 'elite';
  pricePerRCN: number;
  discount: string;
  minRCGRequired: number;
}

export interface RevenueDistribution {
  totalRevenue: number;
  operationsShare: number; // 80%
  stakersShare: number;    // 10%
  daoTreasuryShare: number; // 10%
  tier: string;
  rcnAmount: number;
  unitPrice: number;
}

export class RevenueDistributionService {
  // Revenue distribution percentages
  private readonly OPERATIONS_PERCENTAGE = 0.80;  // 80%
  private readonly STAKERS_PERCENTAGE = 0.10;     // 10%
  private readonly DAO_TREASURY_PERCENTAGE = 0.10; // 10%

  // Tier pricing configuration
  private readonly tierPricing: Record<string, TierPricing> = {
    standard: {
      tier: 'standard',
      pricePerRCN: 0.10,
      discount: '0%',
      minRCGRequired: 10000
    },
    premium: {
      tier: 'premium',
      pricePerRCN: 0.08,
      discount: '20%',
      minRCGRequired: 50000
    },
    elite: {
      tier: 'elite',
      pricePerRCN: 0.06,
      discount: '40%',
      minRCGRequired: 200000
    }
  };

  /**
   * Calculate revenue distribution for a shop RCN purchase
   */
  calculateDistribution(rcnAmount: number, shopTier: string): RevenueDistribution {
    const tier = shopTier.toLowerCase();
    const pricing = this.tierPricing[tier] || this.tierPricing.standard;
    
    // Calculate total revenue based on tier pricing
    const totalRevenue = rcnAmount * pricing.pricePerRCN;
    
    // Calculate distribution
    const operationsShare = totalRevenue * this.OPERATIONS_PERCENTAGE;
    const stakersShare = totalRevenue * this.STAKERS_PERCENTAGE;
    const daoTreasuryShare = totalRevenue * this.DAO_TREASURY_PERCENTAGE;

    // Verify distribution adds up correctly (handle floating point precision)
    const distributionTotal = operationsShare + stakersShare + daoTreasuryShare;
    if (Math.abs(distributionTotal - totalRevenue) > 0.01) {
      logger.error('Revenue distribution calculation error', {
        totalRevenue,
        distributionTotal,
        difference: totalRevenue - distributionTotal
      });
    }

    return {
      totalRevenue,
      operationsShare: Math.round(operationsShare * 100) / 100, // Round to cents
      stakersShare: Math.round(stakersShare * 100) / 100,
      daoTreasuryShare: Math.round(daoTreasuryShare * 100) / 100,
      tier: pricing.tier,
      rcnAmount,
      unitPrice: pricing.pricePerRCN
    };
  }

  /**
   * Get tier pricing information
   */
  getTierPricing(tier: string): TierPricing {
    return this.tierPricing[tier.toLowerCase()] || this.tierPricing.standard;
  }

  /**
   * Determine shop tier based on RCG holdings
   */
  determineTierFromRCGBalance(rcgBalance: number): string {
    if (rcgBalance >= this.tierPricing.elite.minRCGRequired) {
      return 'elite';
    } else if (rcgBalance >= this.tierPricing.premium.minRCGRequired) {
      return 'premium';
    } else if (rcgBalance >= this.tierPricing.standard.minRCGRequired) {
      return 'standard';
    }
    return 'none'; // Not eligible for any tier
  }

  /**
   * Calculate projected annual revenue for RCG stakers based on platform volume
   */
  calculateProjectedStakerRevenue(monthlyRCNSales: number, averageTier: string = 'standard'): {
    monthlyStakerRevenue: number;
    annualStakerRevenue: number;
    averageAPR: number; // Based on total staked RCG
  } {
    const pricing = this.getTierPricing(averageTier);
    const monthlyRevenue = monthlyRCNSales * pricing.pricePerRCN;
    const monthlyStakerRevenue = monthlyRevenue * this.STAKERS_PERCENTAGE;
    const annualStakerRevenue = monthlyStakerRevenue * 12;

    // Calculate APR (assuming 30M RCG staked out of 100M total)
    const assumedStakedRCG = 30000000; // 30M RCG
    const rcgPrice = 1; // Assuming $1 per RCG for calculation
    const totalStakedValue = assumedStakedRCG * rcgPrice;
    const averageAPR = (annualStakerRevenue / totalStakedValue) * 100;

    return {
      monthlyStakerRevenue: Math.round(monthlyStakerRevenue * 100) / 100,
      annualStakerRevenue: Math.round(annualStakerRevenue * 100) / 100,
      averageAPR: Math.round(averageAPR * 100) / 100
    };
  }

  /**
   * Generate revenue report for a given period
   */
  generateRevenueReport(purchases: Array<{
    rcnAmount: number;
    shopTier: string;
    totalCost: number;
    purchaseDate: Date;
  }>): {
    totalRevenue: number;
    totalOperations: number;
    totalStakers: number;
    totalDAO: number;
    purchasesByTier: Record<string, { count: number; revenue: number }>;
    averageDiscount: number;
  } {
    let totalRevenue = 0;
    let totalOperations = 0;
    let totalStakers = 0;
    let totalDAO = 0;
    const purchasesByTier: Record<string, { count: number; revenue: number }> = {
      standard: { count: 0, revenue: 0 },
      premium: { count: 0, revenue: 0 },
      elite: { count: 0, revenue: 0 }
    };

    purchases.forEach(purchase => {
      const distribution = this.calculateDistribution(purchase.rcnAmount, purchase.shopTier);
      
      totalRevenue += distribution.totalRevenue;
      totalOperations += distribution.operationsShare;
      totalStakers += distribution.stakersShare;
      totalDAO += distribution.daoTreasuryShare;

      if (purchasesByTier[distribution.tier]) {
        purchasesByTier[distribution.tier].count++;
        purchasesByTier[distribution.tier].revenue += distribution.totalRevenue;
      }
    });

    // Calculate average discount
    const standardRevenue = purchases.reduce((sum, p) => {
      return sum + (p.rcnAmount * this.tierPricing.standard.pricePerRCN);
    }, 0);
    const averageDiscount = ((standardRevenue - totalRevenue) / standardRevenue) * 100;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOperations: Math.round(totalOperations * 100) / 100,
      totalStakers: Math.round(totalStakers * 100) / 100,
      totalDAO: Math.round(totalDAO * 100) / 100,
      purchasesByTier,
      averageDiscount: Math.round(averageDiscount * 100) / 100
    };
  }
}

export const revenueDistributionService = new RevenueDistributionService();