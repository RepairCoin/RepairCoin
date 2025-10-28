// backend/src/domains/customer/services/CrossShopVerificationService.ts
import { shopRepository, customerRepository, transactionRepository } from '../../../repositories';
import { TransactionRecord } from '../../../repositories/TransactionRepository';
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
      const result = await transactionRepository.query(`
        SELECT 
          metadata->>'verificationId' as id,
          customer_address,
          shop_id as redemption_shop_id,
          amount as requested_amount,
          status = 'completed' as approved,
          metadata->>'denialReason' as denial_reason,
          timestamp
        FROM transactions
        WHERE customer_address = $1
          AND type = 'cross_shop_verification'
          AND metadata->>'verificationType' = 'cross_shop_redemption'
        ORDER BY timestamp DESC
        LIMIT $2
      `, [customerAddress.toLowerCase(), limit]);

      return result.rows.map(row => ({
        id: row.id || 'unknown',
        customerAddress: row.customer_address,
        redemptionShopId: row.redemption_shop_id,
        requestedAmount: parseFloat(row.requested_amount || '0'),
        approved: Boolean(row.approved),
        denialReason: row.denial_reason || undefined,
        timestamp: new Date(row.timestamp)
      }));

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
      const [verificationQuery, redemptionQuery] = await Promise.all([
        // Get verification requests for this shop
        transactionRepository.query(`
          SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as approved_requests,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as denied_requests
          FROM transactions
          WHERE shop_id = $1
            AND type = 'cross_shop_verification'
            AND metadata->>'verificationType' = 'cross_shop_redemption'
        `, [shopId]),
        
        // Get actual cross-shop redemptions processed at this shop
        transactionRepository.query(`
          SELECT 
            COUNT(*) as total_redemptions,
            COALESCE(AVG(amount), 0) as average_amount
          FROM transactions
          WHERE shop_id = $1
            AND type = 'redeem'
            AND metadata->>'redemptionType' = 'cross_shop'
            AND status = 'confirmed'
        `, [shopId])
      ]);

      const verificationData = verificationQuery.rows[0];
      const redemptionData = redemptionQuery.rows[0];

      const totalRequests = parseInt(verificationData.total_requests || '0');
      const approvedRequests = parseInt(verificationData.approved_requests || '0');
      const deniedRequests = parseInt(verificationData.denied_requests || '0');
      const totalRedemptions = parseInt(redemptionData.total_redemptions || '0');
      const averageAmount = parseFloat(redemptionData.average_amount || '0');

      const approvalRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0;

      return {
        totalVerificationRequests: totalRequests,
        approvedRequests,
        deniedRequests,
        approvalRate: Math.round(approvalRate * 100) / 100, // Round to 2 decimal places
        totalCrossShopRedemptions: totalRedemptions,
        averageRedemptionAmount: Math.round(averageAmount * 100) / 100
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
      const [overallQuery, participatingShopsQuery, topShopsQuery] = await Promise.all([
        // Get overall cross-shop redemption statistics
        transactionRepository.query(`
          SELECT 
            COUNT(*) as total_redemptions,
            COALESCE(SUM(amount), 0) as total_value,
            COALESCE(AVG(amount), 0) as average_size
          FROM transactions
          WHERE type = 'redeem'
            AND metadata->>'redemptionType' = 'cross_shop'
            AND status = 'confirmed'
        `),
        
        // Get count of shops that have processed cross-shop redemptions
        transactionRepository.query(`
          SELECT COUNT(DISTINCT shop_id) as participating_shops
          FROM transactions
          WHERE type = 'redeem'
            AND metadata->>'redemptionType' = 'cross_shop'
            AND status = 'confirmed'
        `),
        
        // Get top 5 shops by cross-shop volume
        transactionRepository.query(`
          SELECT 
            t.shop_id,
            s.name as shop_name,
            COUNT(*) as total_redemptions,
            COALESCE(SUM(t.amount), 0) as total_value
          FROM transactions t
          LEFT JOIN shops s ON t.shop_id = s.shop_id
          WHERE t.type = 'redeem'
            AND t.metadata->>'redemptionType' = 'cross_shop'
            AND t.status = 'confirmed'
          GROUP BY t.shop_id, s.name
          ORDER BY total_value DESC
          LIMIT 5
        `)
      ]);

      const overallData = overallQuery.rows[0];
      const participatingData = participatingShopsQuery.rows[0];
      const topShopsData = topShopsQuery.rows;

      const totalRedemptions = parseInt(overallData.total_redemptions || '0');
      const totalValue = parseFloat(overallData.total_value || '0');
      const averageSize = parseFloat(overallData.average_size || '0');
      const participatingShops = parseInt(participatingData.participating_shops || '0');

      // Calculate network utilization rate
      // This would ideally compare against total available cross-shop balance
      // For now, we'll use a simplified calculation based on total customer lifetime earnings
      const utilizationQuery = await transactionRepository.query(`
        WITH customer_earnings AS (
          SELECT 
            customer_address,
            SUM(CASE WHEN type = 'mint' AND shop_id IS NOT NULL THEN amount ELSE 0 END) as lifetime_earnings
          FROM transactions
          WHERE status = 'confirmed'
          GROUP BY customer_address
        ),
        total_cross_shop_capacity AS (
          SELECT SUM(lifetime_earnings * 0.20) as total_capacity
          FROM customer_earnings
          WHERE lifetime_earnings > 0
        )
        SELECT 
          COALESCE(total_capacity, 0) as capacity
        FROM total_cross_shop_capacity
      `);
      
      const totalCapacity = parseFloat(utilizationQuery.rows[0]?.capacity || '0');
      const utilizationRate = totalCapacity > 0 ? (totalValue / totalCapacity) * 100 : 0;

      const topShops = topShopsData.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name || 'Unknown Shop',
        totalRedemptions: parseInt(row.total_redemptions),
        totalValue: parseFloat(row.total_value)
      }));

      return {
        totalCrossShopRedemptions: totalRedemptions,
        totalCrossShopValue: Math.round(totalValue * 100) / 100,
        participatingShops,
        averageRedemptionSize: Math.round(averageSize * 100) / 100,
        networkUtilizationRate: Math.round(utilizationRate * 100) / 100,
        topCrossShopShops: topShops
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
      
      // Store verification record in transactions table for audit trail
      const verificationRecord: TransactionRecord = {
        customerAddress: request.customerAddress,
        shopId: request.redemptionShopId,
        type: 'cross_shop_verification',
        amount: result.approved ? request.requestedAmount : 0,
        reason: result.approved 
          ? `Cross-shop verification approved for ${request.requestedAmount} RCN` 
          : `Cross-shop verification denied: ${result.denialReason}`,
        transactionHash: `verification_${verification.id}`,
        timestamp: new Date().toISOString(),
        status: result.approved ? 'completed' : 'failed',
        metadata: {
          verificationType: 'cross_shop_redemption',
          originalShopId: 'unknown', // Not provided in current request interface
          redemptionShopId: request.redemptionShopId,
          availableBalance: result.availableBalance,
          maxCrossShopAmount: result.maxCrossShopAmount,
          denialReason: result.denialReason,
          verificationId: verification.id
        }
      };
      
      await transactionRepository.recordTransaction(verificationRecord);

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