/**
 * Blockchain-backed Token Provider
 *
 * STATUS: dormant — only instantiated when ENABLE_BLOCKCHAIN_MINTING=true.
 *
 * The database remains the source of truth / mirror (see architecture diagram
 * in docs/BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md). This provider therefore
 * COMPOSES DatabaseTokenProvider for all balance bookkeeping and layers the
 * on-chain operations (mint/burn via TokenMinter) on top. Keeping balance
 * logic in one place avoids drift between the two providers.
 *
 * To re-enable blockchain: set ENABLE_BLOCKCHAIN_MINTING=true, restore the
 * Thirdweb credentials, and restart. No business-logic changes required.
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
import { DatabaseTokenProvider } from './DatabaseTokenProvider';
import { logger } from '../utils/logger';

// TokenMinter is lazy-imported so the dormant contract module is only loaded
// when this (blockchain-only) provider is actually used. This is what lets the
// contract code be archived without static importers in DB-only mode.
// See docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md.
async function loadMinter() {
  const { getTokenMinter } = await import('../contracts/_archive/TokenMinter');
  return getTokenMinter();
}

export class BlockchainTokenProvider implements ITokenProvider {
  readonly providerType = 'blockchain' as const;
  readonly isBlockchainEnabled = true;

  // DB bookkeeping is delegated here; we only add the on-chain side.
  private readonly db = new DatabaseTokenProvider();

  async creditTokens(params: CreditTokensParams): Promise<TokenOperationResult> {
    try {
      // Mint on-chain first; if it fails we don't touch the DB.
      const mint = await (await loadMinter()).adminMintTokens(
        params.customerAddress,
        params.amount,
        params.reason
      );

      if (!mint.success) {
        return {
          success: false,
          amount: 0,
          error: mint.error || mint.message || 'Blockchain mint failed',
        };
      }

      // Mirror to the database (balance, tier, transaction record).
      const dbResult = await this.db.creditTokens(params);
      return { ...dbResult, transactionHash: mint.transactionHash };
    } catch (error) {
      logger.error('BlockchainProvider: credit failed', {
        error: error instanceof Error ? error.message : error,
        params,
      });
      return {
        success: false,
        amount: 0,
        error: error instanceof Error ? error.message : 'Blockchain credit failed',
      };
    }
  }

  async debitTokens(params: DebitTokensParams): Promise<TokenOperationResult> {
    try {
      // On-chain burn only when a burn/dead address is configured; otherwise
      // we fall through to the database-only debit. This keeps re-enablement
      // incremental — wire the burn address when ready.
      const burnAddress = process.env.RCN_BURN_ADDRESS;
      let transactionHash: string | undefined;

      if (burnAddress) {
        const burn = await (await loadMinter()).burnTokensFromCustomer(
          params.customerAddress,
          params.amount,
          burnAddress,
          params.reason
        );
        if (!burn.success) {
          return {
            success: false,
            amount: 0,
            error: burn.error || burn.message || 'Blockchain burn failed',
          };
        }
        transactionHash = burn.transactionHash;
      }

      const dbResult = await this.db.debitTokens(params);
      return { ...dbResult, transactionHash };
    } catch (error) {
      logger.error('BlockchainProvider: debit failed', {
        error: error instanceof Error ? error.message : error,
        params,
      });
      return {
        success: false,
        amount: 0,
        error: error instanceof Error ? error.message : 'Blockchain debit failed',
      };
    }
  }

  async transferTokens(params: TransferTokensParams): Promise<TokenOperationResult> {
    // Customer-to-customer transfers remain out of scope until on-chain
    // transfer flows are re-designed; delegate to the DB provider (which
    // refuses) so behaviour is consistent across providers.
    return this.db.transferTokens(params);
  }

  async getBalance(customerAddress: string): Promise<TokenBalance> {
    try {
      const onChain = await (await loadMinter()).getCustomerBalance(customerAddress);
      if (onChain !== null) {
        return { balance: onChain, source: 'blockchain', lastUpdated: new Date() };
      }
    } catch (error) {
      logger.warn('BlockchainProvider: on-chain balance lookup failed, falling back to DB', {
        error: error instanceof Error ? error.message : error,
        customerAddress,
      });
    }
    // Fall back to the database mirror.
    return this.db.getBalance(customerAddress);
  }

  async validateOperation(
    params: ValidateOperationParams
  ): Promise<{ valid: boolean; reason?: string }> {
    return this.db.validateOperation(params);
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    const dbStatus = await this.db.getProviderStatus();
    let contractStats: unknown;
    let chainHealthy = false;
    try {
      contractStats = await (await loadMinter()).getContractStats();
      chainHealthy = true;
    } catch (error) {
      contractStats = {
        error: error instanceof Error ? error.message : 'Contract stats unavailable',
      };
    }

    return {
      healthy: dbStatus.healthy && chainHealthy,
      providerType: 'blockchain',
      details: {
        blockchainEnabled: true,
        databaseConnected: dbStatus.healthy,
        contractStats,
      },
    };
  }
}
