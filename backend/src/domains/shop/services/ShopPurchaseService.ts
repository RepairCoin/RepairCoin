// backend/src/domains/shop/services/ShopPurchaseService.ts
import { shopRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { revenueDistributionService } from '../../../services/RevenueDistributionService';
import { RCGTokenReader } from '../../../contracts/RCGTokenReader';

interface ShopRcnPurchase {
  id: string;
  shopId: string;
  amount: number;
  pricePerRcn: number;
  totalCost: number;
  paymentMethod: string;
  paymentReference?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

interface CreateResult {
  id: string;
}

export interface PurchaseRequest {
  shopId: string;
  amount: number;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'usdc' | 'eth';
  paymentReference?: string;
}

export interface PurchaseResponse {
  purchaseId: string;
  totalCost: number;
  status: 'pending' | 'completed' | 'failed';
  message: string;
}

/**
 * Service for handling shop RCN purchases with tiered pricing:
 * - Standard tier: $0.10 per RCN (10,000-49,999 RCG)
 * - Premium tier: $0.08 per RCN (50,000-199,999 RCG)
 * - Elite tier: $0.06 per RCN (200,000+ RCG)
 * - Revenue split: 80% operations, 10% stakers, 10% DAO
 * - Automatic balance updates upon completion
 */
export class ShopPurchaseService {
  private static readonly MINIMUM_PURCHASE = 1; // 1 RCN minimum (reduced for testing)
  private static readonly MAXIMUM_PURCHASE = 10000; // 10,000 RCN maximum per transaction
  
  private rcgReader: RCGTokenReader;

  constructor() {
    this.rcgReader = new RCGTokenReader();
  }

  /**
   * Initiate a shop RCN purchase
   */
  async purchaseRcn(purchaseData: PurchaseRequest): Promise<PurchaseResponse> {
    try {
      // Validate purchase amount
      this.validatePurchaseAmount(purchaseData.amount);

      // Verify shop exists and is active
      const shop = await shopRepository.getShop(purchaseData.shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }
      if (!shop.active) {
        throw new Error('Shop is not active');
      }

      // Get shop's RCG balance to determine tier AND check if operational
      let shopTier = 'standard';
      let rcgBalance = 0;
      let hasCommitment = false;
      
      if (shop.walletAddress) {
        try {
          const balanceStr = await this.rcgReader.getBalance(shop.walletAddress);
          rcgBalance = parseFloat(balanceStr);
          shopTier = revenueDistributionService.determineTierFromRCGBalance(rcgBalance);
        } catch (error) {
          logger.warn(`Failed to get RCG balance for shop ${shop.shopId}, using standard tier`, error);
        }
      }

      // Check if shop has active commitment enrollment
      const commitment = await shopRepository.getActiveCommitmentByShopId(purchaseData.shopId);
      hasCommitment = !!commitment;

      // Validate shop is operational (has RCG or commitment)
      if (rcgBalance < 10000 && !hasCommitment) {
        throw new Error('Shop must hold at least 10,000 RCG tokens or be enrolled in the Commitment Program to purchase RCN');
      }

      // Calculate total cost based on tier
      const tierPricing = revenueDistributionService.getTierPricing(shopTier);
      const totalCost = purchaseData.amount * tierPricing.pricePerRCN;

      // Calculate revenue distribution
      const distribution = revenueDistributionService.calculateDistribution(purchaseData.amount, shopTier);

      // Create purchase record
      const purchaseResult = await shopRepository.createShopPurchase({
        shopId: purchaseData.shopId,
        amount: purchaseData.amount,
        pricePerRcn: tierPricing.pricePerRCN,
        totalCost,
        paymentMethod: purchaseData.paymentMethod,
        paymentReference: purchaseData.paymentReference,
        status: 'pending'
      });

      logger.info(`RCN purchase initiated for shop ${purchaseData.shopId}:`, {
        amount: purchaseData.amount,
        tier: shopTier,
        rcgBalance,
        unitPrice: tierPricing.pricePerRCN,
        totalCost,
        distribution
      });

      return {
        purchaseId: purchaseResult.id,
        totalCost,
        status: 'pending',
        message: `Purchase of ${purchaseData.amount} RCN initiated at ${shopTier} tier pricing ($${tierPricing.pricePerRCN}/RCN). Total cost: $${totalCost}. Please complete payment.`
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
      await shopRepository.completeShopPurchase(purchaseId, paymentReference);

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
      const result = await shopRepository.getShopPurchaseHistory(shopId, {
        page,
        limit,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });

      // Map snake_case database fields to camelCase for frontend
      const mappedPurchases = result.items.map((purchase: any) => ({
        id: purchase.id,
        shopId: purchase.shop_id,
        amount: parseFloat(purchase.amount),
        pricePerRcn: parseFloat(purchase.price_per_rcn),
        totalCost: parseFloat(purchase.total_cost),
        paymentMethod: purchase.payment_method,
        paymentReference: purchase.payment_reference,
        status: purchase.status,
        createdAt: purchase.created_at,
        completedAt: purchase.completed_at
      }));

      return {
        purchases: mappedPurchases,
        total: result.pagination.totalItems || 0,
        page: result.pagination.page || 1,
        totalPages: result.pagination.totalPages || 1
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
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Calculate recommended purchase based on historical usage
      // Note: Database returns snake_case fields, not camelCase
      const shopData = shop as any;
      const recommendedPurchase = this.calculateRecommendedPurchase(
        shopData.purchased_rcn_balance || 0,
        shopData.total_rcn_purchased || 0,
        shopData.total_tokens_issued || 0
      );

      return {
        currentBalance: shopData.purchased_rcn_balance || 0,
        totalPurchased: shopData.total_rcn_purchased || 0,
        totalDistributed: shopData.total_tokens_issued || 0,
        lastPurchaseDate: shopData.last_purchase_date,
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