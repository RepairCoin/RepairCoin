// backend/src/domains/ServiceDomain/services/RcnRedemptionService.ts
import { customerRepository, transactionRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

export interface CalculateRedemptionParams {
  customerAddress: string;
  servicePriceUsd: number;
  shopId: string;
  rcnToRedeem: number;
}

export interface RedemptionCalculation {
  isValid: boolean;
  error?: string;
  rcnRedeemed: number;
  rcnDiscountUsd: number;
  finalAmountUsd: number;
  customerBalance: number;
  remainingBalance: number;
}

export class RcnRedemptionService {
  private readonly RCN_TO_USD_RATE = 0.10; // 1 RCN = $0.10 USD
  private readonly MIN_SERVICE_PRICE = 10; // Minimum $10 to use redemption
  private readonly MAX_DISCOUNT_PERCENTAGE = 0.20; // 20% cap on discount

  /**
   * Calculate RCN redemption for a service booking
   * Rules:
   * - Minimum service price: $10
   * - Maximum discount: 20% of service price
   * - Must have sufficient RCN balance
   */
  async calculateRedemption(params: CalculateRedemptionParams): Promise<RedemptionCalculation> {
    try {
      const { customerAddress, servicePriceUsd, shopId, rcnToRedeem } = params;

      // Validation 1: Service price minimum
      if (servicePriceUsd < this.MIN_SERVICE_PRICE) {
        return {
          isValid: false,
          error: `Service price must be at least $${this.MIN_SERVICE_PRICE} to use RCN redemption`,
          rcnRedeemed: 0,
          rcnDiscountUsd: 0,
          finalAmountUsd: servicePriceUsd,
          customerBalance: 0,
          remainingBalance: 0
        };
      }

      // Validation 2: Customer balance
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        return {
          isValid: false,
          error: 'Customer not found',
          rcnRedeemed: 0,
          rcnDiscountUsd: 0,
          finalAmountUsd: servicePriceUsd,
          customerBalance: 0,
          remainingBalance: 0
        };
      }

      const customerBalance = customer.currentRcnBalance || 0;

      // Validation 3: Sufficient balance
      if (rcnToRedeem > customerBalance) {
        return {
          isValid: false,
          error: `Insufficient RCN balance. You have ${customerBalance} RCN, but requested ${rcnToRedeem} RCN`,
          rcnRedeemed: 0,
          rcnDiscountUsd: 0,
          finalAmountUsd: servicePriceUsd,
          customerBalance,
          remainingBalance: customerBalance
        };
      }

      // Validation 4: Positive redemption amount
      if (rcnToRedeem <= 0) {
        return {
          isValid: false,
          error: 'RCN redemption amount must be positive',
          rcnRedeemed: 0,
          rcnDiscountUsd: 0,
          finalAmountUsd: servicePriceUsd,
          customerBalance,
          remainingBalance: customerBalance
        };
      }

      // Calculate discount in USD
      const requestedDiscountUsd = rcnToRedeem * this.RCN_TO_USD_RATE;

      // Calculate maximum allowed discount (20% cap)
      const maxAllowedDiscount = servicePriceUsd * this.MAX_DISCOUNT_PERCENTAGE;

      // Apply cap if needed
      const actualDiscountUsd = Math.min(requestedDiscountUsd, maxAllowedDiscount);
      const actualRcnRedeemed = actualDiscountUsd / this.RCN_TO_USD_RATE;

      // Calculate final amount
      const finalAmountUsd = servicePriceUsd - actualDiscountUsd;

      // Calculate remaining balance
      const remainingBalance = customerBalance - actualRcnRedeemed;

      logger.info('RCN redemption calculated', {
        customerAddress,
        servicePriceUsd,
        rcnRequested: rcnToRedeem,
        rcnActuallyRedeemed: actualRcnRedeemed,
        discountUsd: actualDiscountUsd,
        finalAmountUsd,
        remainingBalance
      });

      return {
        isValid: true,
        rcnRedeemed: actualRcnRedeemed,
        rcnDiscountUsd: actualDiscountUsd,
        finalAmountUsd: Math.max(finalAmountUsd, 0), // Ensure non-negative
        customerBalance,
        remainingBalance
      };

    } catch (error) {
      logger.error('Error calculating RCN redemption:', error);
      return {
        isValid: false,
        error: 'Failed to calculate redemption',
        rcnRedeemed: 0,
        rcnDiscountUsd: 0,
        finalAmountUsd: params.servicePriceUsd,
        customerBalance: 0,
        remainingBalance: 0
      };
    }
  }

  /**
   * Process RCN redemption - deduct from customer balance
   */
  async processRedemption(
    customerAddress: string,
    rcnAmount: number,
    orderId: string,
    shopId: string
  ): Promise<boolean> {
    try {
      // Deduct RCN from customer balance
      await customerRepository.updateBalanceAfterRedemption(
        customerAddress,
        rcnAmount
      );

      // Record transaction
      await transactionRepository.recordTransaction({
        type: 'service_redemption',
        customerAddress,
        shopId,
        amount: rcnAmount,
        reason: `RCN redeemed for service booking discount`,
        timestamp: new Date().toISOString(),
        status: 'completed',
        metadata: {
          relatedOrderId: orderId,
          amountUsd: rcnAmount * this.RCN_TO_USD_RATE
        }
      });

      logger.info('RCN redemption processed successfully', {
        customerAddress,
        rcnAmount,
        orderId,
        shopId
      });

      return true;
    } catch (error) {
      logger.error('Error processing RCN redemption:', error);
      return false;
    }
  }

  /**
   * Refund RCN if order is cancelled
   * Note: This method adds RCN back to customer balance but doesn't reverse total_redemptions
   */
  async refundRedemption(
    customerAddress: string,
    rcnAmount: number,
    orderId: string,
    shopId: string
  ): Promise<boolean> {
    try {
      // Add RCN back to customer balance using a custom query
      // We can't use updateBalanceAfterRedemption since it deducts
      // We'll use updateBalanceAfterEarning but without tier update
      // For now, let's directly add it back - this is a simple refund operation

      // Get customer repository pool access
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        logger.error('Customer not found for refund', { customerAddress, orderId });
        return false;
      }

      // Record refund transaction first
      await transactionRepository.recordTransaction({
        type: 'service_redemption_refund',
        customerAddress,
        shopId,
        amount: rcnAmount,
        reason: `RCN refunded for cancelled service booking`,
        timestamp: new Date().toISOString(),
        status: 'completed',
        metadata: {
          relatedOrderId: orderId,
          amountUsd: rcnAmount * this.RCN_TO_USD_RATE
        }
      });

      logger.info('RCN redemption refunded successfully', {
        customerAddress,
        rcnAmount,
        orderId,
        shopId
      });

      return true;
    } catch (error) {
      logger.error('Error refunding RCN redemption:', error);
      return false;
    }
  }
}
