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

      // No tier-based redemption limits - removed per new requirements

      // Calculate maximum redeemable amount
      // Customers can redeem their full balance at any shop
      let maxRedeemable = availableBalance;
      let crossShopLimit = 0; // No limit

      // Check if requested amount can be redeemed
      const canRedeem = requestedAmount <= maxRedeemable && requestedAmount > 0;

      let message: string;
      if (canRedeem) {
        message = `Redemption approved for ${requestedAmount} RCN`;
      } else if (requestedAmount > maxRedeemable) {
        // Only balance limit applies now
        message = `Insufficient balance. Available: ${availableBalance} RCN`;
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
        availableBalance,
        maxRedeemable,
        isHomeShop
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
        earningHistory
      };

    } catch (error) {
      logger.error('Error getting earned balance:', error);
      // Return safe default values instead of throwing
      return {
        availableBalance: 0,
        lifetimeEarned: 0,
        totalRedeemed: 0,
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
   * Returns lifetime earnings minus total redemptions
   */
  private async calculateAvailableBalance(customerAddress: string): Promise<number> {
    try {
      // Get customer's lifetime earnings
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        return 0;
      }
      
      const lifetimeEarnings = customer.lifetimeEarnings || 0;
      
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
      
      // Available balance = lifetime earnings - total redeemed
      return Math.max(0, lifetimeEarnings - totalRedeemed);

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
      return homeShop === shopId;

    } catch (error) {
      logger.error('Error determining home shop:', error);
      return false;
    }
  }
}

export const verificationService = new VerificationService();