// backend/src/domains/customer/services/CrossShopVerificationService.ts
import { shopRepository, customerRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

interface CrossShopVerification {
  id: string;
  customerAddress: string;
  redemptionShopId: string;
  requestedAmount: number;
  approved: boolean;
  denialReason?: string;
  timestamp: Date;
}

export interface RedemptionRequest {
  customerAddress: string;
  redemptionShopId: string;
  requestedAmount: number;
  purpose?: string;
}

export interface RedemptionVerificationResult {
  approved: boolean;
  availableBalance: number;
  maxCrossShopAmount: number;
  requestedAmount: number;
  verificationId: string;
  message: string;
  denialReason?: string;
}

export interface CrossShopBalance {
  totalRedeemableBalance: number;
  crossShopLimit: number; // 20% of total
  availableForCrossShop: number;
  homeShopBalance: number; // 80% that can only be used at earning shops
}

/**
 * Service for cross-shop redemption verification according to new requirements:
 * - Universal 20% limit for all tiers (not tier-based)
 * - 20% applies to total lifetime earned RCN (not current wallet balance)
 * - Only earned RCN can be redeemed at shops (anti-arbitrage protection)
 * - Centralized verification API for real-time validation
 */
export class CrossShopVerificationService {
  private static readonly CROSS_SHOP_LIMIT_PERCENTAGE = 0.20; // 20% limit

  /**
   * Verify if a cross-shop redemption is allowed
   */
  async verifyRedemption(request: RedemptionRequest): Promise<RedemptionVerificationResult> {
    try {
      logger.info(`Cross-shop verification request: ${request.customerAddress} at ${request.redemptionShopId} for ${request.requestedAmount} RCN`);

      // Validate inputs
      this.validateRedemptionRequest(request);

      // Get customer's redeemable balance (only earned tokens)
      const customer = await customerRepository.getCustomer(request.customerAddress);
      const redeemableBalance = customer ? customer.lifetimeEarnings : 0;
      
      // Calculate 20% cross-shop limit
      const maxCrossShopAmount = redeemableBalance * CrossShopVerificationService.CROSS_SHOP_LIMIT_PERCENTAGE;

      // Check if customer has sufficient balance
      if (request.requestedAmount > redeemableBalance) {
        return await this.createVerificationRecord(request, {
          approved: false,
          availableBalance: redeemableBalance,
          maxCrossShopAmount,
          denialReason: `Insufficient redeemable balance. Available: ${redeemableBalance} RCN, Requested: ${request.requestedAmount} RCN`
        });
      }

      // Check if request exceeds 20% cross-shop limit
      if (request.requestedAmount > maxCrossShopAmount) {
        return await this.createVerificationRecord(request, {
          approved: false,
          availableBalance: redeemableBalance,
          maxCrossShopAmount,
          denialReason: `Cross-shop redemption exceeds 20% limit. Maximum allowed: ${maxCrossShopAmount.toFixed(2)} RCN, Requested: ${request.requestedAmount} RCN`
        });
      }

      // Verify the redemption shop exists and is active
      const redemptionShop = await shopRepository.getShop(request.redemptionShopId);
      if (!redemptionShop) {
        return await this.createVerificationRecord(request, {
          approved: false,
          availableBalance: redeemableBalance,
          maxCrossShopAmount,
          denialReason: `Redemption shop not found: ${request.redemptionShopId}`
        });
      }

      if (!redemptionShop.active) {
        return await this.createVerificationRecord(request, {
          approved: false,
          availableBalance: redeemableBalance,
          maxCrossShopAmount,
          denialReason: `Redemption shop is not active: ${request.redemptionShopId}`
        });
      }

      // Check if shop accepts cross-shop redemptions
      if (!redemptionShop.crossShopEnabled) {
        return await this.createVerificationRecord(request, {
          approved: false,
          availableBalance: redeemableBalance,
          maxCrossShopAmount,
          denialReason: `Shop does not accept cross-shop redemptions: ${redemptionShop.name}`
        });
      }

      // All checks passed - approve the redemption
      return await this.createVerificationRecord(request, {
        approved: true,
        availableBalance: redeemableBalance,
        maxCrossShopAmount,
        denialReason: undefined
      });

    } catch (error) {
      logger.error('Error verifying cross-shop redemption:', error);
      throw error;
    }
  }

  /**
   * Get customer's cross-shop balance breakdown
   */
  async getCrossShopBalance(customerAddress: string): Promise<CrossShopBalance> {
    try {
      const customer = await customerRepository.getCustomer(customerAddress);
      const redeemableBalance = customer ? customer.lifetimeEarnings : 0;
      const crossShopLimit = redeemableBalance * CrossShopVerificationService.CROSS_SHOP_LIMIT_PERCENTAGE;
      const homeShopBalance = redeemableBalance - crossShopLimit;

      return {
        totalRedeemableBalance: redeemableBalance,
        crossShopLimit: crossShopLimit,
        availableForCrossShop: crossShopLimit,
        homeShopBalance: homeShopBalance
      };

    } catch (error) {
      logger.error('Error getting cross-shop balance:', error);
      throw error;
    }
  }

  /**
   * Get verification history for a customer
   */
  async getCustomerVerificationHistory(customerAddress: string, limit: number = 50): Promise<CrossShopVerification[]> {
    try {
      // This would implement a query to get verification history
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error('Error getting verification history:', error);
      throw error;
    }
  }

  /**
   * Get verification statistics for a shop
   */
  async getShopVerificationStats(shopId: string): Promise<{
    totalVerificationRequests: number;
    approvedRequests: number;
    deniedRequests: number;
    approvalRate: number;
    totalCrossShopRedemptions: number;
    averageRedemptionAmount: number;
  }> {
    try {
      // This would implement comprehensive verification statistics
      // For now, return placeholder data
      return {
        totalVerificationRequests: 0,
        approvedRequests: 0,
        deniedRequests: 0,
        approvalRate: 0,
        totalCrossShopRedemptions: 0,
        averageRedemptionAmount: 0
      };

    } catch (error) {
      logger.error('Error getting shop verification stats:', error);
      throw error;
    }
  }

  /**
   * Process cross-shop redemption after verification approval
   */
  async processRedemption(verificationId: string, actualRedemptionAmount: number): Promise<{
    success: boolean;
    transactionId?: string;
    message: string;
  }> {
    try {
      // This would implement the actual redemption process after verification
      // Including token burning, shop accounting, etc.
      
      logger.info(`Processing cross-shop redemption: ${verificationId} for ${actualRedemptionAmount} RCN`);

      // Implementation would:
      // 1. Verify the verification record exists and is approved
      // 2. Check that actualRedemptionAmount matches or is less than approved amount
      // 3. Update token sources to mark tokens as redeemed
      // 4. Create redemption transaction record
      // 5. Update shop statistics

      return {
        success: true,
        transactionId: 'txn_' + Date.now(),
        message: 'Cross-shop redemption processed successfully'
      };

    } catch (error) {
      logger.error('Error processing redemption:', error);
      throw error;
    }
  }

  /**
   * Get network-wide cross-shop statistics
   */
  async getNetworkCrossShopStats(): Promise<{
    totalCrossShopRedemptions: number;
    totalCrossShopValue: number;
    participatingShops: number;
    averageRedemptionSize: number;
    networkUtilizationRate: number; // percentage of available cross-shop balance actually used
    topCrossShopShops: Array<{ shopId: string; shopName: string; totalRedemptions: number; totalValue: number }>;
  }> {
    try {
      // This would implement network-wide analytics
      return {
        totalCrossShopRedemptions: 0,
        totalCrossShopValue: 0,
        participatingShops: 0,
        averageRedemptionSize: 0,
        networkUtilizationRate: 0,
        topCrossShopShops: []
      };

    } catch (error) {
      logger.error('Error getting network cross-shop stats:', error);
      throw error;
    }
  }

  /**
   * Validate redemption request inputs
   */
  private validateRedemptionRequest(request: RedemptionRequest): void {
    if (!request.customerAddress || !/^0x[a-fA-F0-9]{40}$/.test(request.customerAddress)) {
      throw new Error('Invalid customer address format');
    }

    if (!request.redemptionShopId || request.redemptionShopId.trim().length === 0) {
      throw new Error('Redemption shop ID is required');
    }

    if (!request.requestedAmount || request.requestedAmount <= 0) {
      throw new Error('Requested amount must be greater than 0');
    }

    if (request.requestedAmount % 1 !== 0) {
      throw new Error('Requested amount must be a whole number');
    }

    if (request.requestedAmount > 1000) { // Reasonable maximum per transaction
      throw new Error('Requested amount exceeds maximum allowed per transaction (1000 RCN)');
    }
  }

  /**
   * Create verification record in database
   */
  private async createVerificationRecord(
    request: RedemptionRequest, 
    result: {
      approved: boolean;
      availableBalance: number;
      maxCrossShopAmount: number;
      denialReason?: string;
    }
  ): Promise<RedemptionVerificationResult> {
    try {
      // Create a verification record
      const verification: CrossShopVerification = {
        id: 'verify_' + Date.now(),
        customerAddress: request.customerAddress,
        redemptionShopId: request.redemptionShopId,
        requestedAmount: request.requestedAmount,
        approved: result.approved,
        denialReason: result.denialReason,
        timestamp: new Date()
      };
      
      // TODO: Store verification record in database when verification table is added

      const message = result.approved 
        ? `Cross-shop redemption approved for ${request.requestedAmount} RCN`
        : `Cross-shop redemption denied: ${result.denialReason}`;

      logger.info(`Cross-shop verification completed: ${verification.id} - ${message}`);

      return {
        approved: result.approved,
        availableBalance: result.availableBalance,
        maxCrossShopAmount: result.maxCrossShopAmount,
        requestedAmount: request.requestedAmount,
        verificationId: verification.id,
        message,
        denialReason: result.denialReason
      };

    } catch (error) {
      logger.error('Error creating verification record:', error);
      throw error;
    }
  }
}

export const crossShopVerificationService = new CrossShopVerificationService();