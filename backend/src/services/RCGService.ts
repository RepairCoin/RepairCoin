import { getRCGTokenReader } from '../contracts/RCGTokenReader';
import { ShopRepository } from '../repositories/ShopRepository';
import { BaseRepository } from '../repositories/BaseRepository';
import { logger } from '../utils/logger';

export interface ShopTierInfo {
  shopId: number;
  walletAddress: string;
  rcgBalance: string;
  tier: 'none' | 'standard' | 'premium' | 'elite';
  rcnPrice: number;
  tierBenefits: string[];
}

export interface TierDistribution {
  standard: number;
  premium: number;
  elite: number;
  none: number;
  total: number;
}

export interface RCGMetrics {
  totalSupply: string;
  circulatingSupply: string;
  allocations: {
    team: string;
    investors: string;
    publicSale: string;
    daoTreasury: string;
    stakingRewards: string;
  };
  shopTierDistribution: TierDistribution;
  topHolders: Array<{
    address: string;
    balance: string;
    isShop: boolean;
    shopName?: string;
  }>;
  revenueImpact: {
    standardRevenue: number;
    premiumRevenue: number;
    eliteRevenue: number;
    totalRevenue: number;
    discountsGiven: number;
  };
}

export class RCGService extends BaseRepository {
  private rcgReader = getRCGTokenReader();
  private shopRepo = new ShopRepository();

  getRCGTokenReader() {
    return this.rcgReader;
  }

  async getShopTierInfo(shopId: number): Promise<ShopTierInfo | null> {
    try {
      const shop = await this.shopRepo.getShop(shopId.toString());
      if (!shop || !shop.walletAddress) {
        return null;
      }

      const rcgBalance = await this.rcgReader.getBalance(shop.walletAddress);
      const tier = await this.rcgReader.getShopTier(shop.walletAddress);
      const rcnPrice = this.rcgReader.getRCNPriceForTier(tier);

      const tierBenefits = this.getTierBenefits(tier);

      return {
        shopId: shopId,
        walletAddress: shop.walletAddress,
        rcgBalance,
        tier,
        rcnPrice,
        tierBenefits
      };
    } catch (error) {
      logger.error('Failed to get shop tier info:', error);
      return null;
    }
  }

  private getTierBenefits(tier: 'none' | 'standard' | 'premium' | 'elite'): string[] {
    switch (tier) {
      case 'standard':
        return [
          'Basic shop dashboard and analytics',
          'Standard customer support',
          'Cross-shop redemption participation',
          'Basic marketing tools'
        ];
      case 'premium':
        return [
          '20% discount on RCN purchases',
          'Advanced analytics and reporting',
          'Priority customer support',
          'Premium shop listing in customer app',
          'Custom branding options',
          'Early access to new features'
        ];
      case 'elite':
        return [
          '40% discount on RCN purchases',
          'VIP shop status in network',
          'Dedicated account manager',
          'Custom marketing campaigns',
          'Revenue optimization consulting',
          'Beta testing participation',
          'Enhanced cross-shop visibility'
        ];
      default:
        return ['Minimum 10,000 RCG required to become a partner shop'];
    }
  }

  async getShopTierDistribution(): Promise<TierDistribution> {
    try {
      const shopsResult = await this.shopRepo.getShopsPaginated({ 
        verified: true, 
        active: true,
        page: 1, 
        limit: 1000 
      });
      
      const shops = shopsResult.items;
      const distribution: TierDistribution = {
        standard: 0,
        premium: 0,
        elite: 0,
        none: 0,
        total: shops.length
      };

      for (const shop of shops) {
        if (shop.walletAddress) {
          const tier = await this.rcgReader.getShopTier(shop.walletAddress);
          distribution[tier]++;
        }
      }

      return distribution;
    } catch (error) {
      logger.error('Failed to get shop tier distribution:', error);
      return {
        standard: 0,
        premium: 0,
        elite: 0,
        none: 0,
        total: 0
      };
    }
  }

  async updateShopTier(shopId: number): Promise<void> {
    const tierInfo = await this.getShopTierInfo(shopId);
    if (!tierInfo) return;

    try {
      await this.pool.query(
        `UPDATE shops 
         SET rcg_tier = $1, 
             rcg_balance = $2,
             tier_updated_at = NOW()
         WHERE id = $3`,
        [tierInfo.tier, tierInfo.rcgBalance, shopId]
      );
    } catch (error) {
      logger.error('Failed to update shop tier:', error);
    }
  }

  async calculateRevenueByTier(): Promise<{
    standardRevenue: number;
    premiumRevenue: number;
    eliteRevenue: number;
    totalRevenue: number;
    discountsGiven: number;
  }> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN s.rcg_tier = 'standard' THEN p.total_cost ELSE 0 END), 0) as standard_revenue,
          COALESCE(SUM(CASE WHEN s.rcg_tier = 'premium' THEN p.total_cost ELSE 0 END), 0) as premium_revenue,
          COALESCE(SUM(CASE WHEN s.rcg_tier = 'elite' THEN p.total_cost ELSE 0 END), 0) as elite_revenue,
          COALESCE(SUM(p.total_cost), 0) as total_revenue,
          COALESCE(SUM(
            CASE 
              WHEN s.rcg_tier = 'premium' THEN p.rcn_amount * 0.02  -- 20% discount = $0.02 per RCN saved
              WHEN s.rcg_tier = 'elite' THEN p.rcn_amount * 0.04    -- 40% discount = $0.04 per RCN saved
              ELSE 0 
            END
          ), 0) as discounts_given
        FROM shop_rcn_purchases p
        LEFT JOIN shops s ON p.shop_id = s.id
        WHERE p.created_at >= NOW() - INTERVAL '30 days'
      `);

      const { rows } = result;
      return {
        standardRevenue: parseFloat(rows[0]?.standard_revenue || 0),
        premiumRevenue: parseFloat(rows[0]?.premium_revenue || 0),
        eliteRevenue: parseFloat(rows[0]?.elite_revenue || 0),
        totalRevenue: parseFloat(rows[0]?.total_revenue || 0),
        discountsGiven: parseFloat(rows[0]?.discounts_given || 0)
      };
    } catch (error) {
      logger.error('Failed to calculate revenue by tier:', error);
      return {
        standardRevenue: 0,
        premiumRevenue: 0,
        eliteRevenue: 0,
        totalRevenue: 0,
        discountsGiven: 0
      };
    }
  }

  async getRCGMetrics(): Promise<RCGMetrics> {
    try {
      const [stats, tierDistribution, revenueByTier] = await Promise.all([
        this.rcgReader.getContractStats(),
        this.getShopTierDistribution(),
        this.calculateRevenueByTier()
      ]);

      // Get top holders with shop info
      const topHolders = await this.getTopHoldersWithShopInfo();

      return {
        totalSupply: stats.totalSupply,
        circulatingSupply: stats.circulatingSupply,
        allocations: {
          team: stats.teamAllocation,
          investors: stats.investorAllocation,
          publicSale: stats.publicSaleAllocation,
          daoTreasury: stats.daoTreasuryAllocation,
          stakingRewards: stats.stakingRewardsAllocation
        },
        shopTierDistribution: tierDistribution,
        topHolders,
        revenueImpact: revenueByTier
      };
    } catch (error) {
      logger.error('Failed to get RCG metrics:', error);
      throw error;
    }
  }

  private async getTopHoldersWithShopInfo(): Promise<Array<{
    address: string;
    balance: string;
    isShop: boolean;
    shopName?: string;
  }>> {
    // This would be implemented with indexing in production
    // For now, get shops with tiers
    try {
      const shopsResult = await this.shopRepo.getShopsPaginated({ 
        verified: true, 
        active: true,
        page: 1, 
        limit: 100 
      });
      
      const shops = shopsResult.items;
      const holders: Array<{
        address: string;
        balance: string;
        isShop: boolean;
        shopName?: string;
      }> = [];

      for (const shop of shops.slice(0, 10)) {
        if (shop.walletAddress) {
          const balance = await this.rcgReader.getBalance(shop.walletAddress);
          if (parseFloat(balance) > 0) {
            holders.push({
              address: shop.walletAddress,
              balance,
              isShop: true,
              shopName: shop.name
            });
          }
        }
      }

      // Sort by balance
      holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      return holders.slice(0, 10);
    } catch (error) {
      logger.error('Failed to get top holders:', error);
      return [];
    }
  }
}

// Singleton instance
let rcgService: RCGService | null = null;

export function getRCGService(): RCGService {
  if (!rcgService) {
    rcgService = new RCGService();
  }
  return rcgService;
}