import { logger } from '../../utils/logger';

// TokenMinter is lazy-imported only when blockchain is enabled, so this module
// (and the dormant contract code) isn't loaded in database-only mode.
// See docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md.
async function getMinter() {
  const { getTokenMinter } = await import('./TokenMinter');
  return getTokenMinter();
}

export interface BlockchainMintRequest {
  shopAddress: string;
  amount: number;
  purchaseId: string;
  transactionType: 'shop_purchase' | 'admin_mint';
}

export interface BlockchainMintResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  blockchainEnabled: boolean;
}

/**
 * Service for handling blockchain operations
 * Currently logs operations for future blockchain integration
 * When MINTER_ROLE is granted, this will handle actual minting
 */
export class BlockchainService {
  private blockchainEnabled: boolean = false;

  constructor() {
    // Check if blockchain minting is enabled
    this.blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
  }

  /**
   * Process a mint request - either mint on blockchain or log for future processing
   */
  async processMintRequest(request: BlockchainMintRequest): Promise<BlockchainMintResult> {
    logger.info('Processing blockchain mint request:', {
      ...request,
      blockchainEnabled: this.blockchainEnabled
    });

    if (!this.blockchainEnabled) {
      // Log the mint request for future processing
      logger.info('Blockchain minting disabled - logging request for future processing', {
        shopAddress: request.shopAddress,
        amount: request.amount,
        purchaseId: request.purchaseId,
        transactionType: request.transactionType,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        blockchainEnabled: false,
        error: 'Blockchain minting currently disabled - tokens tracked in database only'
      };
    }

    try {
      // Attempt to mint tokens on blockchain using admin mint function
      const tokenMinter = await getMinter();
      const result = await tokenMinter.adminMintTokens(
        request.shopAddress,
        request.amount,
        `${request.transactionType}_${request.purchaseId}`
      );

      if (result.success) {
        logger.info('Blockchain mint successful:', {
          shopAddress: request.shopAddress,
          amount: request.amount,
          transactionHash: result.transactionHash,
          purchaseId: request.purchaseId
        });

        return {
          success: true,
          transactionHash: result.transactionHash,
          blockchainEnabled: true
        };
      } else {
        throw new Error(result.error || 'Mint failed');
      }

    } catch (error) {
      logger.error('Blockchain mint failed:', {
        error: error instanceof Error ? error.message : error,
        request
      });

      // Don't fail the purchase - just log the error
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Blockchain mint failed',
        blockchainEnabled: true
      };
    }
  }

  /**
   * Check blockchain balance for a wallet
   */
  async getBlockchainBalance(walletAddress: string): Promise<number> {
    if (!this.blockchainEnabled) {
      return 0;
    }
    try {
      const tokenMinter = await getMinter();
      const balance = await tokenMinter.getCustomerBalance(walletAddress);
      return balance || 0;
    } catch (error) {
      logger.error('Error fetching blockchain balance:', {
        walletAddress,
        error: error instanceof Error ? error.message : error
      });
      return 0;
    }
  }

  /**
   * Get blockchain readiness status
   */
  getBlockchainStatus(): {
    enabled: boolean;
    contractAddress: string;
    network: string;
  } {
    return {
      enabled: this.blockchainEnabled,
      contractAddress: process.env.RCN_CONTRACT_ADDRESS || '0xBFE793d78B6B83859b528F191bd6F2b8555D951C',
      network: 'Base Sepolia'
    };
  }
}

// Singleton instance
let blockchainServiceInstance: BlockchainService;

export function getBlockchainService(): BlockchainService {
  if (!blockchainServiceInstance) {
    blockchainServiceInstance = new BlockchainService();
  }
  return blockchainServiceInstance;
}