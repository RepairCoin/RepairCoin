// backend/src/domains/token/services/VerificationService.ts
import { databaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';

export interface VerificationResult {
  canRedeem: boolean;
  earnedBalance: number;
  totalBalance: number;
  maxRedeemable: number;
  isHomeShop: boolean;
  crossShopLimit: number;
  message: string;
}

export interface EarnedBalanceInfo {
  earnedBalance: number;
  totalBalance: number;
  marketBalance: number;
  earningHistory: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
}

export interface EarningSources {
  earningSources: Array<{
    shopId: string;
    shopName: string;
    totalEarned: number;
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    lastEarning: string;
  }>;
  summary: {
    totalShops: number;
    primaryShop: string;
    totalEarned: number;
  };
}

/**
 * Centralized Verification Service
 * 
 * This service implements the core business logic for preventing market-bought RCN
 * from being redeemed at shops. Only RCN earned through the RepairCoin ecosystem
 * (repairs, referrals, tier bonuses) can be redeemed for services.
 * 
 * Key Rules:
 * - 100% of earned RCN can be redeemed at the earning shop
 * - 20% of earned RCN can be redeemed at other participating shops
 * - Market-bought RCN cannot be redeemed at any shop
 */
export class VerificationService {
  /**
   * Verify if a customer can redeem RCN at a specific shop
   */
  async verifyRedemption(
    customerAddress: string,
    shopId: string,
    requestedAmount: number
  ): Promise<VerificationResult> {
    try {
      // Get customer data
      const customer = await databaseService.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get shop data
      const shop = await databaseService.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.active || !shop.verified) {
        return {
          canRedeem: false,
          earnedBalance: 0,
          totalBalance: 0,
          maxRedeemable: 0,
          isHomeShop: false,
          crossShopLimit: 0,
          message: 'Shop is not active or verified'
        };
      }

      // Get earned balance (only redeemable tokens)
      const earnedBalance = await this.calculateEarnedBalance(customerAddress);
      
      // Get total balance (includes market-bought tokens)
      const totalBalance = customer.lifetimeEarnings || 0;

      // Determine if this is the customer's home shop (where they earn most RCN)
      const isHomeShop = await this.isCustomerHomeShop(customerAddress, shopId);

      // Calculate maximum redeemable amount
      let maxRedeemable: number;
      let crossShopLimit = 0;

      if (isHomeShop) {
        // 100% of earned balance can be redeemed at home shop
        maxRedeemable = earnedBalance;
      } else {
        // Only 20% of earned balance can be redeemed at other shops
        crossShopLimit = Math.floor(earnedBalance * 0.2);
        maxRedeemable = crossShopLimit;
      }

      // Check if requested amount can be redeemed
      const canRedeem = requestedAmount <= maxRedeemable && requestedAmount > 0;

      let message: string;
      if (canRedeem) {
        message = `Redemption approved for ${requestedAmount} RCN`;
      } else if (requestedAmount > maxRedeemable) {
        if (isHomeShop) {
          message = `Insufficient earned balance. Maximum redeemable: ${maxRedeemable} RCN`;
        } else {
          message = `Cross-shop limit exceeded. Maximum redeemable at this shop: ${maxRedeemable} RCN (20% of earned balance)`;
        }
      } else if (requestedAmount <= 0) {
        message = 'Invalid redemption amount';
      } else {
        message = 'Redemption not allowed';
      }

      logger.info('Redemption verification completed', {
        customerAddress,
        shopId,
        requestedAmount,
        canRedeem,
        earnedBalance,
        maxRedeemable,
        isHomeShop
      });

      return {
        canRedeem,
        earnedBalance,
        totalBalance,
        maxRedeemable,
        isHomeShop,
        crossShopLimit,
        message
      };

    } catch (error) {
      logger.error('Error verifying redemption:', error);
      throw error;
    }
  }

  /**
   * Get customer's earned balance (excludes market-bought tokens)
   */
  async getEarnedBalance(customerAddress: string): Promise<EarnedBalanceInfo> {
    try {
      const customer = await databaseService.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Calculate earned balance from transaction history
      const earnedBalance = await this.calculateEarnedBalance(customerAddress);
      
      // Total balance includes everything
      const totalBalance = customer.lifetimeEarnings || 0;
      
      // Market balance is the difference
      const marketBalance = Math.max(0, totalBalance - earnedBalance);

      // Get earning breakdown
      const earningHistory = await this.getEarningBreakdown(customerAddress);

      return {
        earnedBalance,
        totalBalance,
        marketBalance,
        earningHistory
      };

    } catch (error) {
      logger.error('Error getting earned balance:', error);
      throw error;
    }
  }

  /**
   * Get detailed breakdown of where customer earned their RCN
   */
  async getEarningSources(customerAddress: string): Promise<EarningSources> {
    try {
      const customer = await databaseService.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get all transactions for this customer
      const transactions = await databaseService.getTransactionHistory(customerAddress, 1000);

      // Group by shop and calculate totals
      const shopEarnings = new Map<string, any>();

      for (const tx of transactions) {
        if (tx.type === 'mint' && tx.shopId && tx.shopId !== 'admin_system') {
          if (!shopEarnings.has(tx.shopId)) {
            const shop = await databaseService.getShop(tx.shopId);
            shopEarnings.set(tx.shopId, {
              shopId: tx.shopId,
              shopName: shop?.name || 'Unknown Shop',
              totalEarned: 0,
              fromRepairs: 0,
              fromReferrals: 0,
              fromBonuses: 0,
              lastEarning: tx.timestamp
            });
          }

          const earnings = shopEarnings.get(tx.shopId);
          earnings.totalEarned += tx.amount;
          
          // Categorize earnings based on metadata
          if (tx.metadata?.engagementType === 'repair') {
            earnings.fromRepairs += tx.amount;
          } else if (tx.metadata?.engagementType === 'referral') {
            earnings.fromReferrals += tx.amount;
          } else if (tx.metadata?.engagementType === 'tier_bonus') {
            earnings.fromBonuses += tx.amount;
          }

          // Update last earning date
          if (new Date(tx.timestamp) > new Date(earnings.lastEarning)) {
            earnings.lastEarning = tx.timestamp;
          }
        }
      }

      const earningSources = Array.from(shopEarnings.values());
      earningSources.sort((a, b) => b.totalEarned - a.totalEarned);

      // Calculate summary
      const totalEarned = earningSources.reduce((sum, source) => sum + source.totalEarned, 0);
      const primaryShop = earningSources.length > 0 ? earningSources[0].shopId : '';

      return {
        earningSources,
        summary: {
          totalShops: earningSources.length,
          primaryShop,
          totalEarned
        }
      };

    } catch (error) {
      logger.error('Error getting earning sources:', error);
      throw error;
    }
  }

  /**
   * Batch verify multiple redemption requests
   */
  async batchVerifyRedemptions(
    verifications: Array<{ customerAddress: string; shopId: string; amount: number }>
  ): Promise<Array<VerificationResult & { index: number }>> {
    try {
      const results = await Promise.all(
        verifications.map(async (verification, index) => {
          try {
            const result = await this.verifyRedemption(
              verification.customerAddress,
              verification.shopId,
              verification.amount
            );
            return { ...result, index };
          } catch (error) {
            return {
              canRedeem: false,
              earnedBalance: 0,
              totalBalance: 0,
              maxRedeemable: 0,
              isHomeShop: false,
              crossShopLimit: 0,
              message: error instanceof Error ? error.message : 'Verification failed',
              index
            };
          }
        })
      );

      return results;

    } catch (error) {
      logger.error('Error in batch verification:', error);
      throw error;
    }
  }

  /**
   * Calculate earned balance from transaction history
   * Excludes any tokens that might have been purchased on market
   */
  private async calculateEarnedBalance(customerAddress: string): Promise<number> {
    try {
      // Get all mint transactions for this customer
      const transactions = await databaseService.getTransactionHistory(customerAddress, 1000);
      
      let earnedBalance = 0;

      for (const tx of transactions) {
        // Only count mints from shops (not market purchases)
        if (tx.type === 'mint' && tx.shopId && tx.shopId !== 'market') {
          earnedBalance += tx.amount;
        }
        // Subtract redemptions
        else if (tx.type === 'redeem') {
          earnedBalance -= tx.amount;
        }
      }

      return Math.max(0, earnedBalance);

    } catch (error) {
      logger.error('Error calculating earned balance:', error);
      return 0;
    }
  }

  /**
   * Get breakdown of earnings by type
   */
  private async getEarningBreakdown(customerAddress: string): Promise<{
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  }> {
    try {
      const transactions = await databaseService.getTransactionHistory(customerAddress, 1000);
      
      const breakdown = {
        fromRepairs: 0,
        fromReferrals: 0,
        fromBonuses: 0,
        fromTierBonuses: 0
      };

      for (const tx of transactions) {
        if (tx.type === 'mint' && tx.shopId && tx.shopId !== 'market') {
          const engagementType = tx.metadata?.engagementType;
          
          if (engagementType === 'repair') {
            breakdown.fromRepairs += tx.amount;
          } else if (engagementType === 'referral') {
            breakdown.fromReferrals += tx.amount;
          } else if (engagementType === 'tier_bonus') {
            breakdown.fromTierBonuses += tx.amount;
          } else {
            breakdown.fromBonuses += tx.amount;
          }
        }
      }

      return breakdown;

    } catch (error) {
      logger.error('Error getting earning breakdown:', error);
      return {
        fromRepairs: 0,
        fromReferrals: 0,
        fromBonuses: 0,
        fromTierBonuses: 0
      };
    }
  }

  /**
   * Determine if a shop is the customer's "home shop"
   * (where they earned the most RCN)
   */
  private async isCustomerHomeShop(customerAddress: string, shopId: string): Promise<boolean> {
    try {
      const earningSources = await this.getEarningSources(customerAddress);
      return earningSources.summary.primaryShop === shopId;

    } catch (error) {
      logger.error('Error determining home shop:', error);
      return false;
    }
  }
}

export const verificationService = new VerificationService();