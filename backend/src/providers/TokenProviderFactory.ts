/**
 * Token Provider Factory
 *
 * Single switch that decides which ITokenProvider implementation the app uses,
 * based on the ENABLE_BLOCKCHAIN_MINTING environment flag. Services should call
 * TokenProviderFactory.getProvider() rather than instantiating providers or
 * TokenMinter directly — that's what makes blockchain reversible without
 * refactoring (see docs/BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md).
 */

import { ITokenProvider, TokenProviderType } from '../interfaces/ITokenProvider';
import { DatabaseTokenProvider } from './DatabaseTokenProvider';
import { BlockchainTokenProvider } from './BlockchainTokenProvider';
import { logger } from '../utils/logger';

export class TokenProviderFactory {
  private static instance: ITokenProvider | null = null;

  private static isBlockchainEnabled(): boolean {
    return process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
  }

  /**
   * Returns the active provider (memoized). Reads ENABLE_BLOCKCHAIN_MINTING on
   * first call; use reset() after changing the flag at runtime (e.g. in tests
   * or the admin settings toggle).
   */
  static getProvider(): ITokenProvider {
    if (!this.instance) {
      if (this.isBlockchainEnabled()) {
        logger.info('TokenProviderFactory: using BlockchainTokenProvider');
        this.instance = new BlockchainTokenProvider();
      } else {
        logger.info('TokenProviderFactory: using DatabaseTokenProvider');
        this.instance = new DatabaseTokenProvider();
      }
    }
    return this.instance;
  }

  /** Clear the memoized provider (call after toggling the feature flag). */
  static reset(): void {
    this.instance = null;
  }

  /** Which provider would be selected right now, without instantiating it. */
  static getActiveProviderType(): TokenProviderType {
    return this.isBlockchainEnabled() ? 'blockchain' : 'database';
  }
}
