// backend/src/domains/admin/services/operations/ContractOperationsService.ts
import { adminRepository } from '../../../../repositories';
import { TokenMinter } from '../../../../contracts/TokenMinter';
import { logger } from '../../../../utils/logger';

/**
 * ContractOperationsService
 * Handles smart contract control operations (pause, unpause, emergency stop)
 * Extracted from AdminService for better security and maintainability
 */
export class ContractOperationsService {
  private tokenMinter: TokenMinter | null = null;

  private getTokenMinterInstance(): TokenMinter {
    if (!this.tokenMinter) {
      this.tokenMinter = new TokenMinter();
    }
    return this.tokenMinter;
  }

  async pauseContract(adminAddress?: string) {
    try {
      logger.info('Contract pause requested', { adminAddress });

      // Check if already paused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (isPaused) {
        return {
          success: false,
          message: 'Contract is already paused'
        };
      }

      // Pause the contract
      const result = await this.getTokenMinterInstance().pauseContract();

      if (!result.success) {
        throw new Error(result.error || 'Failed to pause contract');
      }

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_pause',
        actionDescription: 'Paused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'pause',
          transactionHash: result.transactionHash
        }
      });

      logger.info('Contract paused successfully', {
        adminAddress,
        transactionHash: result.transactionHash
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        message: 'Contract paused successfully - All token operations are now disabled'
      };
    } catch (error) {
      logger.error('Contract pause error:', error);
      throw new Error(`Failed to pause contract: ${error.message}`);
    }
  }

  async unpauseContract(adminAddress?: string) {
    try {
      logger.info('Contract unpause requested', { adminAddress });

      // Check if already unpaused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (!isPaused) {
        return {
          success: false,
          message: 'Contract is already unpaused'
        };
      }

      // Unpause the contract
      const result = await this.getTokenMinterInstance().unpauseContract();

      if (!result.success) {
        throw new Error(result.error || 'Failed to unpause contract');
      }

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'contract_unpause',
        actionDescription: 'Unpaused RepairCoin contract',
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'unpause',
          transactionHash: result.transactionHash
        }
      });

      logger.info('Contract unpaused successfully', {
        adminAddress,
        transactionHash: result.transactionHash
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        message: 'Contract unpaused successfully - Token operations are now enabled'
      };
    } catch (error) {
      logger.error('Contract unpause error:', error);
      throw new Error(`Failed to unpause contract: ${error.message}`);
    }
  }

  async getContractStatus() {
    try {
      const tokenMinter = this.getTokenMinterInstance();

      // Get contract pause status
      const isPaused = await tokenMinter.isContractPaused();

      // Get contract statistics
      const contractStats = await tokenMinter.getContractStats();

      return {
        success: true,
        status: {
          isPaused,
          contractAddress: contractStats?.contractAddress || 'Unknown',
          totalSupply: contractStats?.totalSupplyReadable || 0,
          lastChecked: new Date().toISOString()
        },
        message: `Contract is ${isPaused ? 'PAUSED' : 'ACTIVE'}`
      };
    } catch (error) {
      logger.error('Error getting contract status:', error);
      return {
        success: false,
        error: error.message,
        status: {
          isPaused: null,
          contractAddress: 'Error',
          totalSupply: 0,
          lastChecked: new Date().toISOString()
        }
      };
    }
  }

  async emergencyStop(adminAddress?: string, reason?: string) {
    try {
      logger.warn('EMERGENCY STOP requested', {
        adminAddress,
        reason: reason || 'Emergency stop activated by admin'
      });

      // Check if already paused
      const isPaused = await this.getTokenMinterInstance().isContractPaused();
      if (isPaused) {
        return {
          success: false,
          message: 'Contract is already in emergency stop (paused) state'
        };
      }

      // Pause the contract
      const result = await this.getTokenMinterInstance().pauseContract();

      if (!result.success) {
        throw new Error(result.error || 'Emergency stop failed');
      }

      // Log emergency activity with high priority
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'emergency_stop',
        actionDescription: `EMERGENCY STOP: ${reason || 'Contract paused immediately'}`,
        entityType: 'contract',
        entityId: 'repaircoin',
        metadata: {
          action: 'emergency_stop',
          reason: reason || 'Emergency stop activated',
          transactionHash: result.transactionHash,
          timestamp: new Date().toISOString()
        }
      });

      logger.error('EMERGENCY STOP ACTIVATED', {
        adminAddress,
        reason,
        transactionHash: result.transactionHash
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        message: '🚨 EMERGENCY STOP ACTIVATED - All token operations are immediately disabled'
      };
    } catch (error) {
      logger.error('Emergency stop error:', error);
      throw new Error(`Emergency stop failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const contractOperationsService = new ContractOperationsService();
