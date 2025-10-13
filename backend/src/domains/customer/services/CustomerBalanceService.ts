// domains/customer/services/CustomerBalanceService.ts
import { customerRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { TierLevel } from '../../../contracts/TierManager';

export interface CustomerBalanceInfo {
  address: string;
  databaseBalance: number;
  pendingMintBalance: number;
  totalBalance: number;
  lifetimeEarnings: number;
  totalRedemptions: number;
  lastBlockchainSync: string | null;
  balanceSynced: boolean;
  tier: TierLevel;
  canMintToWallet: boolean;
}

export interface MintRequest {
  customerAddress: string;
  amount: number;
  requestedAt: string;
}

/**
 * Customer Balance Service
 * 
 * Manages the hybrid database/blockchain balance system for customers.
 * Handles real-time balance tracking, mint-to-wallet queuing, and balance synchronization.
 */
export class CustomerBalanceService {

  /**
   * Get comprehensive balance information for a customer
   */
  async getCustomerBalanceInfo(address: string): Promise<CustomerBalanceInfo | null> {
    try {
      const customer = await customerRepository.getCustomer(address);
      if (!customer) {
        return null;
      }

      const balanceInfo = await customerRepository.getCustomerBalance(address);
      if (!balanceInfo) {
        return null;
      }

      return {
        address: customer.address,
        databaseBalance: balanceInfo.databaseBalance,
        pendingMintBalance: balanceInfo.pendingMintBalance,
        totalBalance: balanceInfo.totalBalance,
        lifetimeEarnings: balanceInfo.lifetimeEarnings,
        totalRedemptions: balanceInfo.totalRedemptions,
        lastBlockchainSync: balanceInfo.lastBlockchainSync,
        balanceSynced: balanceInfo.balanceSynced,
        tier: customer.tier,
        canMintToWallet: balanceInfo.databaseBalance > 0
      };
    } catch (error) {
      logger.error('Error getting customer balance info:', error);
      throw new Error('Failed to get customer balance information');
    }
  }

  /**
   * Update customer balance after earning RCN tokens
   */
  async recordEarning(
    address: string,
    amount: number,
    newTier: TierLevel,
    metadata?: {
      shopId?: string;
      engagementType?: string;
      description?: string;
    }
  ): Promise<void> {
    try {
      // Update customer balance using the enhanced method
      await customerRepository.updateBalanceAfterEarning(address, amount, newTier);
      
      logger.info('Customer earning recorded', {
        address,
        amount,
        newTier,
        metadata
      });
    } catch (error) {
      logger.error('Error recording customer earning:', error);
      throw new Error('Failed to record customer earning');
    }
  }

  /**
   * Update customer balance after redemption
   */
  async recordRedemption(
    address: string,
    amount: number,
    shopId: string
  ): Promise<void> {
    try {
      // Verify customer has sufficient balance
      const balanceInfo = await customerRepository.getCustomerBalance(address);
      if (!balanceInfo || balanceInfo.databaseBalance < amount) {
        throw new Error('Insufficient balance for redemption');
      }

      // Update customer balance
      await customerRepository.updateBalanceAfterRedemption(address, amount);
      
      logger.info('Customer redemption recorded', {
        address,
        amount,
        shopId,
        remainingBalance: balanceInfo.databaseBalance - amount
      });
    } catch (error) {
      logger.error('Error recording customer redemption:', error);
      throw new Error('Failed to record customer redemption');
    }
  }

  /**
   * Queue customer balance for minting to wallet (database → blockchain)
   */
  async queueForMinting(address: string, amount: number): Promise<MintRequest> {
    try {
      // Verify customer has sufficient database balance
      const balanceInfo = await customerRepository.getCustomerBalance(address);
      if (!balanceInfo || balanceInfo.databaseBalance < amount) {
        throw new Error('Insufficient database balance for minting');
      }

      // Move balance from database to pending mint queue
      await customerRepository.queueForMinting(address, amount);

      const mintRequest: MintRequest = {
        customerAddress: address,
        amount,
        requestedAt: new Date().toISOString()
      };

      logger.info('Customer balance queued for minting', {
        address,
        amount,
        mintRequest
      });

      return mintRequest;
    } catch (error) {
      logger.error('Error queueing balance for minting:', error);
      throw new Error('Failed to queue balance for minting');
    }
  }

  /**
   * Complete blockchain mint and update customer records
   */
  async completeMint(
    address: string,
    amount: number,
    blockchainTxHash: string
  ): Promise<void> {
    try {
      // Complete the mint and update customer records
      await customerRepository.completeMint(address, amount, blockchainTxHash);

      logger.info('Customer mint completed successfully', {
        address,
        amount,
        blockchainTxHash
      });
    } catch (error) {
      logger.error('Error completing customer mint:', error);
      throw new Error('Failed to complete customer mint');
    }
  }

  /**
   * Get customers with pending mint requests for batch processing
   */
  async getPendingMints(limit: number = 100): Promise<MintRequest[]> {
    try {
      const customers = await customerRepository.getCustomersWithPendingMints(limit);
      
      return customers.map(customer => ({
        customerAddress: customer.address,
        amount: customer.pendingAmount,
        requestedAt: new Date().toISOString() // Would be stored in a separate pending_mints table in production
      }));
    } catch (error) {
      logger.error('Error getting pending mints:', error);
      throw new Error('Failed to get pending mints');
    }
  }

  /**
   * Sync customer balance with transaction history (maintenance operation)
   */
  async syncCustomerBalance(address: string): Promise<CustomerBalanceInfo> {
    try {
      // Perform balance synchronization
      await customerRepository.syncCustomerBalance(address);

      // Return updated balance information
      const balanceInfo = await this.getCustomerBalanceInfo(address);
      if (!balanceInfo) {
        throw new Error('Customer not found after sync');
      }

      logger.info('Customer balance synchronized', {
        address,
        balanceInfo
      });

      return balanceInfo;
    } catch (error) {
      logger.error('Error syncing customer balance:', error);
      throw new Error('Failed to sync customer balance');
    }
  }

  /**
   * Validate mint request based on business rules
   */
  async validateMintRequest(address: string, amount: number): Promise<{
    valid: boolean;
    reason?: string;
    maxAllowed?: number;
  }> {
    try {
      if (amount <= 0) {
        return {
          valid: false,
          reason: 'Amount must be greater than zero'
        };
      }

      const balanceInfo = await customerRepository.getCustomerBalance(address);
      if (!balanceInfo) {
        return {
          valid: false,
          reason: 'Customer not found'
        };
      }

      if (balanceInfo.databaseBalance < amount) {
        return {
          valid: false,
          reason: 'Insufficient database balance',
          maxAllowed: balanceInfo.databaseBalance
        };
      }

      // Additional business rules can be added here
      // e.g., daily mint limits, minimum mint amounts, etc.

      return {
        valid: true
      };
    } catch (error) {
      logger.error('Error validating mint request:', error);
      return {
        valid: false,
        reason: 'Validation failed due to system error'
      };
    }
  }

  /**
   * Get balance statistics for analytics
   */
  async getBalanceStatistics(): Promise<{
    totalDatabaseBalance: number;
    totalPendingMints: number;
    totalCustomersWithBalance: number;
    averageBalance: number;
  }> {
    try {
      const statistics = await customerRepository.getBalanceStatistics();
      return statistics;
    } catch (error) {
      logger.error('Error getting balance statistics:', error);
      throw new Error('Failed to get balance statistics');
    }
  }
}

export const customerBalanceService = new CustomerBalanceService();