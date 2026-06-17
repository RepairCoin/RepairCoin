/**
 * Contract Admin Service
 *
 * Single entry point for the inherently-blockchain RCN contract operations that
 * have no database equivalent: contract stats, pause/unpause, and pause status.
 *
 * These were previously scattered across services as direct `TokenMinter` calls
 * (static imports), which blocked archiving the blockchain code. This service
 * lazy-imports `TokenMinter` ONLY when ENABLE_BLOCKCHAIN_MINTING=true; in
 * database-only mode it returns safe stubs and never touches the chain (or the
 * TokenMinter module).
 *
 * See docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md (step 0b).
 */

import { logger } from '../utils/logger';

export interface ContractActionResult {
  success: boolean;
  message?: string;
  transactionHash?: string;
  error?: string;
}

const RCN_CONTRACT_ADDRESS =
  process.env.RCN_CONTRACT_ADDRESS ||
  process.env.REPAIRCOIN_CONTRACT_ADDRESS ||
  '';

function blockchainEnabled(): boolean {
  return process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';
}

/** Lazily load the dormant TokenMinter only when blockchain is enabled. */
async function loadMinter() {
  const { getTokenMinter } = await import('../contracts/_archive/TokenMinter');
  return getTokenMinter();
}

export class ContractAdminService {
  async getContractStats(): Promise<any> {
    if (!blockchainEnabled()) {
      // DB-only: no live contract to read. Return a harmless shape that the
      // existing consumers/UI already tolerate.
      return {
        contractAddress: RCN_CONTRACT_ADDRESS,
        isPaused: false,
        totalSupplyReadable: 0,
        blockchainEnabled: false,
      };
    }
    const minter = await loadMinter();
    return minter.getContractStats();
  }

  async isContractPaused(): Promise<boolean> {
    if (!blockchainEnabled()) {
      return false;
    }
    const minter = await loadMinter();
    return minter.isContractPaused();
  }

  async pauseContract(): Promise<ContractActionResult> {
    if (!blockchainEnabled()) {
      logger.info('ContractAdminService.pauseContract skipped — database-only mode');
      return { success: false, error: 'Blockchain is disabled (database-only mode)' };
    }
    const minter = await loadMinter();
    return minter.pauseContract();
  }

  async unpauseContract(): Promise<ContractActionResult> {
    if (!blockchainEnabled()) {
      logger.info('ContractAdminService.unpauseContract skipped — database-only mode');
      return { success: false, error: 'Blockchain is disabled (database-only mode)' };
    }
    const minter = await loadMinter();
    return minter.unpauseContract();
  }
}

let contractAdminService: ContractAdminService | null = null;

export function getContractAdminService(): ContractAdminService {
  if (!contractAdminService) {
    contractAdminService = new ContractAdminService();
  }
  return contractAdminService;
}
