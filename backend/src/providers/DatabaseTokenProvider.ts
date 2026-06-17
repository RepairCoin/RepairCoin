/**
 * Database-only Token Provider
 *
 * All token operations are plain PostgreSQL transactions — no blockchain.
 * This is the active provider while ENABLE_BLOCKCHAIN_MINTING is false.
 *
 * Balance semantics intentionally mirror the existing TokenService flows so
 * behaviour is unchanged when callers migrate to the provider abstraction:
 *   - credit  → updateCustomerAfterEarning (adds to lifetime + current balance, recomputes tier)
 *   - debit   → updateBalanceAfterRedemption (deducts current_rcn_balance, bumps total_redemptions)
 *
 * IMPORTANT: "available balance" is the platform's *calculated* value
 * (customerRepository.getCustomerBalance().databaseBalance =
 *  lifetime_earnings + net_transfers − redemptions − pending_mint − minted_to_wallet),
 * NOT the raw current_rcn_balance column. We read/validate against that
 * calculated value so the provider agrees with CustomerBalanceService and the
 * rest of the system.
 */

import {
  ITokenProvider,
  TokenBalance,
  TokenOperationResult,
  CreditTokensParams,
  DebitTokensParams,
  TransferTokensParams,
  ValidateOperationParams,
  ProviderStatus,
} from '../interfaces/ITokenProvider';
import { customerRepository, transactionRepository } from '../repositories';
import { TierManager } from '../contracts/TierManager';
import { logger } from '../utils/logger';

const genId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export class DatabaseTokenProvider implements ITokenProvider {
  readonly providerType = 'database' as const;
  readonly isBlockchainEnabled = false;

  private tierManager = new TierManager();

  /** Canonical available (redeemable) balance — the calculated databaseBalance. */
  private async getAvailableBalance(address: string): Promise<number> {
    const info = await customerRepository.getCustomerBalance(address);
    return info?.databaseBalance ?? 0;
  }

  async creditTokens(params: CreditTokensParams): Promise<TokenOperationResult> {
    try {
      if (params.amount <= 0) {
        return { success: false, amount: 0, error: 'Amount must be positive' };
      }

      const customer = await customerRepository.getCustomer(params.customerAddress);
      if (!customer) {
        return { success: false, amount: 0, error: 'Customer not found' };
      }

      const previousBalance = await this.getAvailableBalance(params.customerAddress);

      // Recompute tier from new lifetime earnings (same rule as TokenMinter).
      const newTier = this.tierManager.calculateTier(
        customer.lifetimeEarnings + params.amount
      );

      await customerRepository.updateCustomerAfterEarning(
        params.customerAddress,
        params.amount,
        newTier
      );

      const transactionId = genId('credit');
      await transactionRepository.recordTransaction({
        id: transactionId,
        type: 'mint',
        customerAddress: params.customerAddress.toLowerCase(),
        shopId: params.shopId,
        amount: params.amount,
        reason: params.reason,
        transactionHash: '',
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          ...params.metadata,
          oldTier: customer.tier,
          newTier,
          source: 'database',
        },
      });

      logger.info('DatabaseProvider: tokens credited', {
        customerAddress: params.customerAddress,
        amount: params.amount,
        newTier,
        transactionId,
      });

      return {
        success: true,
        amount: params.amount,
        transactionId,
        metadata: {
          previousBalance,
          newBalance: previousBalance + params.amount,
          newTier,
        },
      };
    } catch (error) {
      logger.error('DatabaseProvider: credit failed', {
        error: error instanceof Error ? error.message : error,
        params,
      });
      return {
        success: false,
        amount: 0,
        error: error instanceof Error ? error.message : 'Credit operation failed',
      };
    }
  }

  async debitTokens(params: DebitTokensParams): Promise<TokenOperationResult> {
    try {
      if (params.amount <= 0) {
        return { success: false, amount: 0, error: 'Amount must be positive' };
      }

      // getCustomerBalance returns null when the customer doesn't exist, so it
      // doubles as the existence check and the canonical available balance.
      const balanceInfo = await customerRepository.getCustomerBalance(params.customerAddress);
      if (!balanceInfo) {
        return { success: false, amount: 0, error: 'Customer not found' };
      }

      const available = balanceInfo.databaseBalance;
      if (available < params.amount) {
        return {
          success: false,
          amount: 0,
          error: `Insufficient balance. Available: ${available} RCN, Required: ${params.amount} RCN`,
        };
      }

      await customerRepository.updateBalanceAfterRedemption(
        params.customerAddress,
        params.amount
      );

      const transactionId = genId('debit');
      await transactionRepository.recordTransaction({
        id: transactionId,
        type: 'redeem',
        customerAddress: params.customerAddress.toLowerCase(),
        shopId: params.shopId,
        amount: params.amount,
        reason: params.reason,
        transactionHash: '',
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: { ...params.metadata, source: 'database' },
      });

      logger.info('DatabaseProvider: tokens debited', {
        customerAddress: params.customerAddress,
        amount: params.amount,
        transactionId,
      });

      return {
        success: true,
        amount: params.amount,
        transactionId,
        metadata: {
          previousBalance: available,
          newBalance: available - params.amount,
        },
      };
    } catch (error) {
      logger.error('DatabaseProvider: debit failed', {
        error: error instanceof Error ? error.message : error,
        params,
      });
      return {
        success: false,
        amount: 0,
        error: error instanceof Error ? error.message : 'Debit operation failed',
      };
    }
  }

  /**
   * Direct customer-to-customer transfers are deprecated in the database-only
   * model (see strategy doc: "Only earn/redeem"). There is no repository method
   * that increments a customer's spendable balance without also inflating
   * lifetime earnings / tier, so we intentionally refuse here rather than
   * corrupt tier data. The blockchain provider can override this if/when
   * on-chain transfers are re-enabled.
   */
  async transferTokens(params: TransferTokensParams): Promise<TokenOperationResult> {
    logger.warn('DatabaseProvider: transfer attempted but not supported in database-only mode', {
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      amount: params.amount,
    });
    return {
      success: false,
      amount: 0,
      error: 'Token transfers are not supported in database-only mode',
    };
  }

  async getBalance(customerAddress: string): Promise<TokenBalance> {
    try {
      const balance = await this.getAvailableBalance(customerAddress);
      return { balance, source: 'database', lastUpdated: new Date() };
    } catch (error) {
      logger.error('DatabaseProvider: getBalance failed', { error, customerAddress });
      return { balance: 0, source: 'database', lastUpdated: new Date() };
    }
  }

  async validateOperation(
    params: ValidateOperationParams
  ): Promise<{ valid: boolean; reason?: string }> {
    if (params.amount <= 0) {
      return { valid: false, reason: 'Amount must be positive' };
    }

    if (params.operation === 'transfer') {
      return { valid: false, reason: 'Transfers are not supported in database-only mode' };
    }

    if (params.operation === 'debit') {
      const balanceInfo = await customerRepository.getCustomerBalance(params.customerAddress);
      if (!balanceInfo) {
        return { valid: false, reason: 'Customer not found' };
      }
      if (balanceInfo.databaseBalance < params.amount) {
        return {
          valid: false,
          reason: `Insufficient balance: ${balanceInfo.databaseBalance} RCN available`,
        };
      }
    }

    return { valid: true };
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    try {
      const health = await customerRepository.healthCheck();
      const healthy = health.status === 'healthy';
      return {
        healthy,
        providerType: 'database',
        details: {
          blockchainEnabled: false,
          databaseConnected: healthy,
          ...(health.message ? { message: health.message } : {}),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        providerType: 'database',
        details: {
          error: error instanceof Error ? error.message : 'Health check failed',
        },
      };
    }
  }
}
