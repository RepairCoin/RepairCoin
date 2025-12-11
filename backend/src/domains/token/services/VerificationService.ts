// backend/src/domains/token/services/VerificationService.ts
import { customerRepository, shopRepository, transactionRepository } from '../../../repositories';
import { ReferralRepository } from '../../../repositories/ReferralRepository';
import { logger } from '../../../utils/logger';

export interface VerificationResult {
  canRedeem: boolean;
  availableBalance: number;
  maxRedeemable: number;
  isHomeShop: boolean;
  crossShopLimit: number;
  message: string;
}

export interface BalanceInfo {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  pendingMintBalance: number;
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
 * This service implements the core business logic for verifying RCN redemptions.
 * Customers can redeem ALL their RCN at any participating shop without restrictions.
 * 
 * Key Rules:
 * - 100% of customer's RCN balance can be redeemed at any participating shop
 * - Includes RCN earned from repairs AND received from other customers
 * - No cross-shop redemption limits
 */
export class VerificationService {
  private referralRepository: ReferralRepository;

  constructor() {
    this.referralRepository = new ReferralRepository();
  }
  /**
   * Verify if a customer can redeem RCN at a specific shop
   *
   * Redemption Rules:
   * - 100% of earned RCN can be redeemed at HOME SHOP (where customer earned most RCN)
   * - 20% of earned RCN can be redeemed at ANY OTHER SHOP (cross-shop redemption)
   * - Shop must have sufficient operational RCN balance to process redemption
   */
  async verifyRedemption(
    customerAddress: string,
    shopId: string,
    requestedAmount: number
  ): Promise<VerificationResult> {
    try {
      // Get customer data
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get shop data
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.active || !shop.verified) {
        return {
          canRedeem: false,
          availableBalance: 0,
          maxRedeemable: 0,
          isHomeShop: false,
          crossShopLimit: 0,
          message: 'Shop is not active or verified'
        };
      }

      // Calculate available balance: lifetime earnings minus total redemptions
      const availableBalance = await this.calculateAvailableBalance(customerAddress);

      // Determine if this is the customer's home shop (where they earn most RCN)
      const isHomeShop = await this.isCustomerHomeShop(customerAddress, shopId);

      // Calculate maximum redeemable amount based on shop type
      // - Home shop: 100% of available balance
      // - Cross-shop: 20% of available balance
      const CROSS_SHOP_REDEMPTION_PERCENTAGE = 0.20; // 20%
      let maxRedeemable: number;
      let crossShopLimit: number;

      if (isHomeShop) {
        // Home shop: customer can redeem full balance
        maxRedeemable = availableBalance;
        crossShopLimit = availableBalance; // No limit at home shop
      } else {
        // Cross-shop: customer can only redeem 20% of their balance
        crossShopLimit = Math.floor(availableBalance * CROSS_SHOP_REDEMPTION_PERCENTAGE * 100) / 100;
        maxRedeemable = crossShopLimit;
      }

      // Check if shop has enough operational RCN balance to process this redemption
      const shopBalance = shop.purchasedRcnBalance || 0;
      let shopBalanceSufficient = true;
      let shopBalanceMessage = '';

      if (shopBalance < requestedAmount) {
        shopBalanceSufficient = false;
        shopBalanceMessage = `Shop has insufficient RCN balance. Shop available: ${shopBalance} RCN`;
      }

      // Determine if redemption can proceed
      let canRedeem = false;
      let message: string;

      if (requestedAmount <= 0) {
        message = 'Invalid redemption amount';
      } else if (!shopBalanceSufficient) {
        message = shopBalanceMessage;
      } else if (requestedAmount > availableBalance) {
        message = `Insufficient balance. Your available: ${availableBalance} RCN`;
      } else if (requestedAmount > maxRedeemable) {
        if (isHomeShop) {
          message = `Insufficient balance. Available: ${availableBalance} RCN`;
        } else {
          message = `Cross-shop limit exceeded. You can redeem up to ${crossShopLimit} RCN (20%) at this shop. Redeem full balance at your home shop.`;
        }
      } else {
        canRedeem = true;
        message = `Redemption approved for ${requestedAmount} RCN`;
      }

      logger.info('Redemption verification completed', {
        customerAddress,
        shopId,
        requestedAmount,
        canRedeem,
        availableBalance,
        maxRedeemable,
        isHomeShop,
        crossShopLimit,
        shopBalance,
        shopBalanceSufficient
      });

      return {
        canRedeem,
        availableBalance,
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
   * Get customer's balance information
   * All RCN is redeemable regardless of source (earned, received from others, etc)
   */
  async getBalance(customerAddress: string): Promise<BalanceInfo> {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Use available balance calculation
      const currentBalance = await this.calculateAvailableBalance(customerAddress);
      let rcnBreakdown = { 
        earned: customer.lifetimeEarnings || 0, 
        marketBought: 0, 
        byShop: {}, 
        byType: {} 
      };
      
      // Try to get breakdown by type from ReferralRepository for additional details
      try {
        const detailedBreakdown = await this.referralRepository.getCustomerRcnBySource(customerAddress);
        // Use the breakdown for type information, but keep lifetime earnings as the total
        rcnBreakdown.byShop = detailedBreakdown.byShop || {};
        rcnBreakdown.byType = detailedBreakdown.byType || {};
      } catch (error) {
        logger.warn('Failed to get detailed RCN breakdown, using customer lifetime earnings only', error);
      }
      
      // Get redemptions to calculate current balance
      let totalRedeemed = 0;
      try {
        const transactions = await transactionRepository.getTransactionsByCustomer(customerAddress, 1000);
        for (const tx of transactions) {
          if (tx.type === 'redeem') {
            totalRedeemed += tx.amount;
          }
        }
      } catch (error) {
        logger.warn('Failed to get redemption history', error);
      }
      
      // Use the customer's lifetime earnings as available balance
      // All RCN is redeemable regardless of how it was obtained
      const availableBalance = currentBalance;
      const pendingMintBalance = customer.pendingMintBalance || 0;

      // Get earning breakdown by type with safe access
      const earningHistory = {
        fromRepairs: rcnBreakdown.byType?.['shop_repair'] || 0,
        fromReferrals: rcnBreakdown.byType?.['referral_bonus'] || 0,
        fromBonuses: rcnBreakdown.byType?.['promotion'] || 0,
        fromTierBonuses: rcnBreakdown.byType?.['tier_bonus'] || 0
      };

      return {
        availableBalance,
        lifetimeEarned: rcnBreakdown.earned || 0,
        totalRedeemed,
        pendingMintBalance,
        earningHistory
      };

    } catch (error) {
      logger.error('Error getting earned balance:', error);
      // Return safe default values instead of throwing
      return {
        availableBalance: 0,
        lifetimeEarned: 0,
        totalRedeemed: 0,
        pendingMintBalance: 0,
        earningHistory: {
          fromRepairs: 0,
          fromReferrals: 0,
          fromBonuses: 0,
          fromTierBonuses: 0
        }
      };
    }
  }

  /**
   * Get detailed breakdown of where customer earned their RCN
   */
  async getEarningSources(customerAddress: string): Promise<EarningSources> {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get all transactions for this customer
      const transactions = await transactionRepository.getTransactionsByCustomer(customerAddress, 1000);

      // Group by shop and calculate totals
      const shopEarnings = new Map<string, any>();

      for (const tx of transactions) {
        if (tx.type === 'mint' && tx.shopId && tx.shopId !== 'admin_system') {
          if (!shopEarnings.has(tx.shopId)) {
            const shop = await shopRepository.getShop(tx.shopId);
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
              availableBalance: 0,
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
   * Calculate customer's available balance
   * Returns lifetime earnings minus total redemptions minus pending mint balance
   */
  private async calculateAvailableBalance(customerAddress: string): Promise<number> {
    try {
      // Get customer's lifetime earnings and pending mint balance
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        return 0;
      }

      const lifetimeEarnings = customer.lifetimeEarnings || 0;
      const pendingMintBalance = customer.pendingMintBalance || 0;

      // Get total redemptions from transactions
      let totalRedeemed = 0;
      try {
        const transactions = await transactionRepository.getTransactionsByCustomer(customerAddress, 1000);
        for (const tx of transactions) {
          if (tx.type === 'redeem') {
            totalRedeemed += tx.amount;
          }
        }
      } catch (error) {
        logger.warn('Failed to get redemption history for balance calculation', error);
      }

      // Available balance = lifetime earnings - total redeemed - pending mint (queued for blockchain)
      return Math.max(0, lifetimeEarnings - totalRedeemed - pendingMintBalance);

    } catch (error) {
      logger.error('Error calculating available balance:', error);
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
      const transactions = await transactionRepository.getTransactionsByCustomer(customerAddress, 1000);
      
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
      const homeShop = await this.referralRepository.getHomeShop(customerAddress);

      // Case-insensitive comparison for shop IDs
      const isMatch = homeShop !== null && homeShop.toLowerCase() === shopId.toLowerCase();

      logger.info('Home shop comparison:', {
        customerAddress,
        requestedShopId: shopId,
        requestedShopIdLower: shopId.toLowerCase(),
        storedHomeShop: homeShop,
        storedHomeShopLower: homeShop?.toLowerCase() || null,
        isMatch,
        strictMatch: homeShop === shopId
      });

      return isMatch;

    } catch (error) {
      logger.error('Error determining home shop:', error);
      return false;
    }
  }
}

export const verificationService = new VerificationService();