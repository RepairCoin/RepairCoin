// backend/src/domains/shop/services/TierBonusService.ts
import { customerRepository, shopRepository, transactionRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

interface TierBonus {
  id: string;
  customerAddress: string;
  shopId: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  bonusAmount: number;
  transactionId: string;
  createdAt: Date;
}

interface CustomerData {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  balance: number;
  active: boolean;
  joinDate: string;
  lastActivity: string;
}

export interface TierBonusCalculation {
  customerTier: 'BRONZE' | 'SILVER' | 'GOLD';
  baseRcnEarned: number;
  bonusAmount: number;
  totalRcnAwarded: number;
  bonusPercentage: number;
}

export interface RepairTransaction {
  customerAddress: string;
  shopId: string;
  repairAmount: number;
  baseRcnEarned: number;
  transactionId: string;
}

/**
 * Service for handling tier-based bonus system according to new requirements:
 * - Bronze: +10 RCN bonus per qualifying repair transaction
 * - Silver: +20 RCN bonus per qualifying repair transaction  
 * - Gold: +30 RCN bonus per qualifying repair transaction
 * - Applied to every repair transaction meeting minimum $50 threshold
 * - Bonus deducted from shop's purchased RCN balance
 */
export class TierBonusService {
  // Tier bonus amounts as per requirements
  private static readonly TIER_BONUSES = {
    BRONZE: 10,
    SILVER: 20,
    GOLD: 30
  };

  private static readonly MINIMUM_REPAIR_AMOUNT = 50; // $50 minimum for tier bonus

  /**
   * Calculate tier bonus for a repair transaction
   */
  async calculateTierBonus(
    customerAddress: string, 
    repairAmount: number
  ): Promise<TierBonusCalculation | null> {
    try {
      // Check if repair meets minimum threshold
      if (repairAmount < TierBonusService.MINIMUM_REPAIR_AMOUNT) {
        return null;
      }

      // Get customer tier
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const customerTier = customer.tier as 'BRONZE' | 'SILVER' | 'GOLD';
      const bonusAmount = TierBonusService.TIER_BONUSES[customerTier];

      // Calculate base RCN earned (this should come from the main earning calculation)
      const baseRcnEarned = this.calculateBaseRcnEarned(repairAmount);
      const totalRcnAwarded = baseRcnEarned + bonusAmount;
      const bonusPercentage = (bonusAmount / baseRcnEarned) * 100;

      return {
        customerTier,
        baseRcnEarned,
        bonusAmount,
        totalRcnAwarded,
        bonusPercentage
      };

    } catch (error) {
      logger.error('Error calculating tier bonus:', error);
      throw error;
    }
  }

  /**
   * Apply tier bonus to a repair transaction
   */
  async applyTierBonus(repairTransaction: RepairTransaction): Promise<TierBonusCalculation | null> {
    try {
      // Calculate tier bonus
      const bonusCalc = await this.calculateTierBonus(
        repairTransaction.customerAddress, 
        repairTransaction.repairAmount
      );

      if (!bonusCalc) {
        logger.info(`No tier bonus applicable for repair: ${repairTransaction.transactionId}`);
        return null;
      }

      // Verify shop has sufficient balance
      const shop = await shopRepository.getShop(repairTransaction.shopId);
      if (!shop || (shop.purchasedRcnBalance || 0) < bonusCalc.bonusAmount) {
        logger.warn(`Shop ${repairTransaction.shopId} has insufficient balance for tier bonus: ${bonusCalc.bonusAmount} RCN`);
        
        // Still record the tier bonus attempt for audit purposes
        await this.recordTierBonusAttempt(repairTransaction, bonusCalc, 'insufficient_shop_balance');
        return null;
      }

      // Create tier bonus record
      // TODO: Implement createTierBonus in repository
      // await tierBonusRepository.createTierBonus({
      //   customerAddress: repairTransaction.customerAddress,
      //   shopId: repairTransaction.shopId,
      //   baseTransactionId: repairTransaction.transactionId,
      //   customerTier: bonusCalc.customerTier,
      //   bonusAmount: bonusCalc.bonusAmount,
      //   baseRepairAmount: repairTransaction.repairAmount,
      //   baseRcnEarned: repairTransaction.baseRcnEarned
      // });

      // Deduct bonus from shop balance
      // TODO: Implement updateShopRcnBalance in repository
      // await shopRepository.updateShopRcnBalance(
      //   repairTransaction.shopId, 
      //   bonusCalc.bonusAmount, 
      //   'subtract'
      // );

      // Record token source for anti-arbitrage tracking
      // TODO: Implement recordTokenSource in repository
      // await tokenSourceRepository.recordTokenSource({
      //   customerAddress: repairTransaction.customerAddress,
      //   amount: bonusCalc.bonusAmount,
      //   source: 'tier_bonus',
      //   earningTransactionId: repairTransaction.transactionId,
      //   shopId: repairTransaction.shopId,
      //   isRedeemableAtShops: true
      // });

      logger.info(`Tier bonus applied: ${repairTransaction.customerAddress} - ${bonusCalc.customerTier} - ${bonusCalc.bonusAmount} RCN`);

      return bonusCalc;

    } catch (error) {
      logger.error('Error applying tier bonus:', error);
      throw error;
    }
  }

  /**
   * Get tier bonus history for a customer
   */
  async getCustomerTierBonusHistory(customerAddress: string): Promise<{
    totalBonusesReceived: number;
    totalBonusAmount: number;
    bonusesByTier: { [key: string]: { count: number; amount: number } };
    recentBonuses: TierBonus[];
  }> {
    try {
      // TODO: Implement getTierBonusesForCustomer in repository
      const bonuses: TierBonus[] = []; // await tierBonusRepository.getTierBonusesForCustomer(customerAddress);
      
      const totalBonusesReceived = bonuses.length;
      const totalBonusAmount = bonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0);
      
      const bonusesByTier = bonuses.reduce((acc, bonus) => {
        const tier = bonus.tier;
        if (!acc[tier]) {
          acc[tier] = { count: 0, amount: 0 };
        }
        acc[tier].count++;
        acc[tier].amount += bonus.bonusAmount;
        return acc;
      }, {} as { [key: string]: { count: number; amount: number } });

      return {
        totalBonusesReceived,
        totalBonusAmount,
        bonusesByTier,
        recentBonuses: bonuses.slice(0, 10) // Last 10 bonuses
      };

    } catch (error) {
      logger.error('Error getting customer tier bonus history:', error);
      throw error;
    }
  }

  /**
   * Get tier bonus statistics for a shop
   */
  async getShopTierBonusStats(shopId: string): Promise<{
    totalBonusesIssued: number;
    totalBonusAmount: number;
    bonusesByTier: { [key: string]: { count: number; amount: number } };
    averageBonusPerTransaction: number;
  }> {
    try {
      // TODO: Implement getTierBonusStatistics in repository
      const stats = { totalBonusesIssued: 0, totalBonusAmount: 0, bonusesByTier: {} }; // await tierBonusRepository.getTierBonusStatistics(shopId);
      
      const averageBonusPerTransaction = stats.totalBonusesIssued > 0 
        ? stats.totalBonusAmount / stats.totalBonusesIssued 
        : 0;

      return {
        ...stats,
        averageBonusPerTransaction
      };

    } catch (error) {
      logger.error('Error getting shop tier bonus stats:', error);
      throw error;
    }
  }

  /**
   * Calculate what tier bonus a customer would receive for a given repair amount
   */
  async previewTierBonus(customerAddress: string, repairAmount: number): Promise<{
    currentTier: 'BRONZE' | 'SILVER' | 'GOLD';
    bonusAmount: number;
    baseRcnEarned: number;
    totalRcnIfCompleted: number;
    nextTierRequirement?: number;
    nextTierBonus?: number;
  }> {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentTier = customer.tier as 'BRONZE' | 'SILVER' | 'GOLD';
      const bonusAmount = repairAmount >= TierBonusService.MINIMUM_REPAIR_AMOUNT 
        ? TierBonusService.TIER_BONUSES[currentTier] 
        : 0;
      
      const baseRcnEarned = this.calculateBaseRcnEarned(repairAmount);
      const totalRcnIfCompleted = baseRcnEarned + bonusAmount;

      // Calculate next tier requirements
      const nextTierInfo = this.getNextTierInfo(currentTier, customer.lifetimeEarnings + totalRcnIfCompleted);

      return {
        currentTier,
        bonusAmount,
        baseRcnEarned,
        totalRcnIfCompleted,
        nextTierRequirement: nextTierInfo.requirement,
        nextTierBonus: nextTierInfo.bonus
      };

    } catch (error) {
      logger.error('Error previewing tier bonus:', error);
      throw error;
    }
  }

  /**
   * Process tier upgrades for customers based on lifetime earnings
   */
  async processTierUpgrades(): Promise<{
    upgradedCustomers: Array<{ address: string; oldTier: string; newTier: string; lifetimeEarnings: number }>;
    totalUpgrades: number;
  }> {
    try {
      logger.info('Processing tier upgrades...');
      
      // This would be called by a scheduled job to upgrade customers
      // based on their lifetime earnings crossing tier thresholds
      
      const upgradedCustomers: Array<{ address: string; oldTier: string; newTier: string; lifetimeEarnings: number }> = [];
      
      // Implementation would query customers and check if they should be upgraded
      // Silver: 200-999 RCN lifetime
      // Gold: 1000+ RCN lifetime
      
      logger.info(`Tier upgrade processing completed. ${upgradedCustomers.length} customers upgraded.`);
      
      return {
        upgradedCustomers,
        totalUpgrades: upgradedCustomers.length
      };

    } catch (error) {
      logger.error('Error processing tier upgrades:', error);
      throw error;
    }
  }

  /**
   * Calculate base RCN earned for repair amount (before tier bonus)
   */
  private calculateBaseRcnEarned(repairAmount: number): number {
    // As per requirements:
    // Small repairs ($50-$99): 10 RCN
    // Large repairs ($100+): 25 RCN
    if (repairAmount >= 100) {
      return 25;
    } else if (repairAmount >= 50) {
      return 10;
    } else {
      return 0; // Below minimum threshold
    }
  }

  /**
   * Get next tier information for a customer
   */
  private getNextTierInfo(currentTier: string, projectedLifetimeEarnings: number): { requirement?: number; bonus?: number } {
    switch (currentTier) {
      case 'BRONZE':
        return projectedLifetimeEarnings < 200 
          ? { requirement: 200 - projectedLifetimeEarnings, bonus: TierBonusService.TIER_BONUSES.SILVER }
          : { requirement: undefined, bonus: undefined };
      case 'SILVER':
        return projectedLifetimeEarnings < 1000 
          ? { requirement: 1000 - projectedLifetimeEarnings, bonus: TierBonusService.TIER_BONUSES.GOLD }
          : { requirement: undefined, bonus: undefined };
      case 'GOLD':
      default:
        return { requirement: undefined, bonus: undefined };
    }
  }

  /**
   * Record tier bonus attempt for audit purposes
   */
  private async recordTierBonusAttempt(
    repairTransaction: RepairTransaction, 
    bonusCalc: TierBonusCalculation, 
    failureReason: string
  ): Promise<void> {
    try {
      // This would record failed bonus attempts for audit and shop notification purposes
      logger.warn(`Tier bonus attempt failed: ${repairTransaction.transactionId} - ${failureReason}`);
      
      // Could implement notification to shop about insufficient balance
      // Could implement automatic purchase trigger if shop has auto-purchase enabled
      
    } catch (error) {
      logger.error('Error recording tier bonus attempt:', error);
    }
  }
}

export const tierBonusService = new TierBonusService();