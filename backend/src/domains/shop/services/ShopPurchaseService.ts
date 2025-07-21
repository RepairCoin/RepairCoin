// backend/src/domains/shop/services/ShopPurchaseService.ts
import { databaseService, ShopRcnPurchase, CreateResult } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';

export interface PurchaseRequest {
  shopId: string;
  amount: number;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'usdc';
  paymentReference?: string;
}

export interface PurchaseResponse {
  purchaseId: string;
  totalCost: number;
  status: 'pending' | 'completed' | 'failed';
  message: string;
}

/**
 * Service for handling shop RCN purchases according to new requirements:
 * - Shops buy RCN at $1.00 per token
 * - Minimum purchase: 100 RCN ($100)
 * - Multiple payment methods supported
 * - Automatic balance updates upon completion
 */
export class ShopPurchaseService {
  private static readonly PRICE_PER_RCN = 1.0; // $1.00 per RCN as per requirements
  private static readonly MINIMUM_PURCHASE = 100; // 100 RCN minimum
  private static readonly MAXIMUM_PURCHASE = 10000; // 10,000 RCN maximum per transaction

  /**
   * Initiate a shop RCN purchase
   */
  async purchaseRcn(purchaseData: PurchaseRequest): Promise<PurchaseResponse> {
    try {
      // Validate purchase amount
      this.validatePurchaseAmount(purchaseData.amount);

      // Verify shop exists and is active
      const shop = await databaseService.getShop(purchaseData.shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }
      if (!shop.active) {
        throw new Error('Shop is not active');
      }

      // Calculate total cost
      const totalCost = purchaseData.amount * ShopPurchaseService.PRICE_PER_RCN;

      // Create purchase record
      const purchaseResult = await databaseService.createShopPurchase({
        shopId: purchaseData.shopId,
        amount: purchaseData.amount,
        pricePerRcn: ShopPurchaseService.PRICE_PER_RCN,
        totalCost,
        paymentMethod: purchaseData.paymentMethod,
        paymentReference: purchaseData.paymentReference,
        status: 'pending'
      });

      logger.info(`RCN purchase initiated for shop ${purchaseData.shopId}: ${purchaseData.amount} RCN at $${totalCost}`);

      return {
        purchaseId: purchaseResult.id,
        totalCost,
        status: 'pending',
        message: `Purchase of ${purchaseData.amount} RCN initiated. Total cost: $${totalCost}. Please complete payment.`
      };

    } catch (error) {
      logger.error('Error initiating RCN purchase:', error);
      throw error;
    }
  }

  /**
   * Complete a shop RCN purchase after payment confirmation
   */
  async completePurchase(purchaseId: string, paymentReference?: string): Promise<PurchaseResponse> {
    try {
      // Complete the purchase and update shop balance
      await databaseService.completeShopPurchase(purchaseId, paymentReference);

      logger.info(`RCN purchase completed: ${purchaseId}`);

      return {
        purchaseId,
        totalCost: 0, // Would need to fetch from purchase record if needed
        status: 'completed',
        message: 'RCN purchase completed successfully. Tokens have been added to your shop balance.'
      };

    } catch (error) {
      logger.error('Error completing RCN purchase:', error);
      throw error;
    }
  }

  /**
   * Get purchase history for a shop
   */
  async getPurchaseHistory(shopId: string, page: number = 1, limit: number = 20): Promise<{
    purchases: ShopRcnPurchase[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const result = await databaseService.getShopPurchaseHistory(shopId, {
        page,
        limit,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });

      return {
        purchases: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      };

    } catch (error) {
      logger.error('Error getting purchase history:', error);
      throw error;
    }
  }

  /**
   * Get shop's RCN balance and purchase statistics
   */
  async getShopBalance(shopId: string): Promise<{
    currentBalance: number;
    totalPurchased: number;
    totalDistributed: number;
    lastPurchaseDate?: string;
    recommendedPurchase?: number;
  }> {
    try {
      const shop = await databaseService.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Calculate recommended purchase based on historical usage
      const recommendedPurchase = this.calculateRecommendedPurchase(
        shop.purchasedRcnBalance || 0,
        shop.totalRcnPurchased || 0,
        shop.totalTokensIssued || 0
      );

      return {
        currentBalance: shop.purchasedRcnBalance || 0,
        totalPurchased: shop.totalRcnPurchased || 0,
        totalDistributed: shop.totalTokensIssued || 0,
        lastPurchaseDate: shop.lastPurchaseDate,
        recommendedPurchase
      };

    } catch (error) {
      logger.error('Error getting shop balance:', error);
      throw error;
    }
  }

  /**
   * Process automatic RCN purchase for shops with auto-purchase enabled
   */
  async processAutomaticPurchases(): Promise<void> {
    try {
      // This would be called by a scheduled job
      // Get shops with auto-purchase enabled and low balance
      logger.info('Processing automatic RCN purchases...');
      
      // Implementation would query for shops with auto_purchase_enabled = true
      // and purchased_rcn_balance < minimum_balance_alert
      // Then initiate purchases using their preferred payment method
      
      logger.info('Automatic purchase processing completed');
      
    } catch (error) {
      logger.error('Error processing automatic purchases:', error);
      throw error;
    }
  }

  /**
   * Validate purchase amount meets requirements
   */
  private validatePurchaseAmount(amount: number): void {
    if (amount < ShopPurchaseService.MINIMUM_PURCHASE) {
      throw new Error(`Minimum purchase amount is ${ShopPurchaseService.MINIMUM_PURCHASE} RCN`);
    }
    
    if (amount > ShopPurchaseService.MAXIMUM_PURCHASE) {
      throw new Error(`Maximum purchase amount is ${ShopPurchaseService.MAXIMUM_PURCHASE} RCN per transaction`);
    }
    
    if (amount % 1 !== 0) {
      throw new Error('Purchase amount must be a whole number');
    }
  }

  /**
   * Calculate recommended purchase amount based on historical usage
   */
  private calculateRecommendedPurchase(
    currentBalance: number, 
    totalPurchased: number, 
    totalDistributed: number
  ): number {
    // Simple algorithm: recommend 2 weeks worth based on historical distribution
    const averageMonthlyDistribution = totalDistributed / Math.max(1, totalPurchased > 0 ? 1 : 0);
    const twoWeeksDistribution = averageMonthlyDistribution / 2;
    
    // Recommend at least 100 RCN but not more than 500 RCN
    const recommended = Math.max(
      ShopPurchaseService.MINIMUM_PURCHASE,
      Math.min(500, Math.ceil(twoWeeksDistribution / 50) * 50) // Round to nearest 50
    );
    
    return recommended;
  }

  /**
   * Get purchase analytics for admin dashboard
   */
  async getPurchaseAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalRevenue: number;
    totalRcnSold: number;
    averagePurchaseSize: number;
    purchasesByPaymentMethod: { [key: string]: number };
    topPurchasingShops: Array<{ shopId: string; totalPurchased: number; totalSpent: number }>;
  }> {
    try {
      // This would implement comprehensive analytics
      // For now, return placeholder data
      return {
        totalRevenue: 0,
        totalRcnSold: 0,
        averagePurchaseSize: 0,
        purchasesByPaymentMethod: {},
        topPurchasingShops: []
      };

    } catch (error) {
      logger.error('Error getting purchase analytics:', error);
      throw error;
    }
  }
}

export const shopPurchaseService = new ShopPurchaseService();