// backend/src/domains/ServiceDomain/controllers/NoShowPolicyController.ts
import { Request, Response } from 'express';
import { NoShowPolicyService, NoShowPolicy } from '../../../services/NoShowPolicyService';
import { logger } from '../../../utils/logger';

export class NoShowPolicyController {
  private noShowPolicyService: NoShowPolicyService;

  constructor() {
    this.noShowPolicyService = new NoShowPolicyService();
  }

  /**
   * GET /api/services/shops/:shopId/no-show-policy
   * Get shop's no-show policy configuration
   */
  async getShopPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      // Authorization: Only shop owner or admin can view policy
      const userAddress = req.user?.address?.toLowerCase();
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        // Verify shop ownership
        const { shopRepository } = await import('../../../repositories');
        const shop = await shopRepository.getShop(shopId);

        if (!shop) {
          res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
          return;
        }

        if (shop.walletAddress.toLowerCase() !== userAddress) {
          res.status(403).json({
            success: false,
            error: 'Unauthorized: You can only view your own shop policy'
          });
          return;
        }
      }

      const policy = await this.noShowPolicyService.getShopPolicy(shopId);

      logger.info('Shop policy retrieved', {
        shopId,
        requestedBy: userAddress
      });

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      logger.error('Error getting shop policy', {
        error: error instanceof Error ? error.message : String(error),
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop policy'
      });
    }
  }

  /**
   * PUT /api/services/shops/:shopId/no-show-policy
   * Update shop's no-show policy configuration
   */
  async updateShopPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const policyUpdates: Partial<NoShowPolicy> = req.body;

      // Authorization: Only shop owner or admin can update policy
      const userAddress = req.user?.address?.toLowerCase();
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        // Verify shop ownership
        const { shopRepository } = await import('../../../repositories');
        const shop = await shopRepository.getShop(shopId);

        if (!shop) {
          res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
          return;
        }

        if (shop.walletAddress.toLowerCase() !== userAddress) {
          res.status(403).json({
            success: false,
            error: 'Unauthorized: You can only update your own shop policy'
          });
          return;
        }
      }

      // Validate policy updates
      const validationError = this.validatePolicyUpdates(policyUpdates);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      // Don't allow updating shopId through this endpoint
      delete policyUpdates.shopId;

      const updatedPolicy = await this.noShowPolicyService.updateShopPolicy(shopId, policyUpdates);

      logger.info('Shop policy updated', {
        shopId,
        updatedBy: userAddress,
        changes: Object.keys(policyUpdates)
      });

      res.json({
        success: true,
        data: updatedPolicy,
        message: 'No-show policy updated successfully'
      });
    } catch (error) {
      logger.error('Error updating shop policy', {
        error: error instanceof Error ? error.message : String(error),
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update shop policy'
      });
    }
  }

  /**
   * POST /api/services/shops/:shopId/no-show-policy/initialize
   * Initialize default policy for a shop (only if not exists)
   */
  async initializeShopPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      // Authorization: Only shop owner or admin
      const userAddress = req.user?.address?.toLowerCase();
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        const { shopRepository } = await import('../../../repositories');
        const shop = await shopRepository.getShop(shopId);

        if (!shop) {
          res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
          return;
        }

        if (shop.walletAddress.toLowerCase() !== userAddress) {
          res.status(403).json({
            success: false,
            error: 'Unauthorized'
          });
          return;
        }
      }

      // Check if policy already exists
      const existingPolicy = await this.noShowPolicyService.getShopPolicy(shopId);

      // If policy exists, just return it
      if (existingPolicy) {
        res.json({
          success: true,
          data: existingPolicy,
          message: 'Policy already exists'
        });
        return;
      }

      // This shouldn't happen as getShopPolicy returns defaults,
      // but if we need explicit initialization in the future
      res.json({
        success: true,
        data: existingPolicy,
        message: 'Default policy initialized'
      });
    } catch (error) {
      logger.error('Error initializing shop policy', {
        error: error instanceof Error ? error.message : String(error),
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to initialize shop policy'
      });
    }
  }

  /**
   * Validate policy update values
   */
  private validatePolicyUpdates(policy: Partial<NoShowPolicy>): string | null {
    // Validate tier thresholds
    if (policy.cautionThreshold !== undefined) {
      if (policy.cautionThreshold < 1 || policy.cautionThreshold > 10) {
        return 'Caution threshold must be between 1 and 10';
      }
    }

    if (policy.depositThreshold !== undefined) {
      if (policy.depositThreshold < 1 || policy.depositThreshold > 20) {
        return 'Deposit threshold must be between 1 and 20';
      }
    }

    if (policy.suspensionThreshold !== undefined) {
      if (policy.suspensionThreshold < 1 || policy.suspensionThreshold > 50) {
        return 'Suspension threshold must be between 1 and 50';
      }
    }

    // Validate thresholds are in ascending order
    const caution = policy.cautionThreshold ?? 2;
    const deposit = policy.depositThreshold ?? 3;
    const suspension = policy.suspensionThreshold ?? 5;

    if (caution >= deposit) {
      return 'Deposit threshold must be greater than caution threshold';
    }
    if (deposit >= suspension) {
      return 'Suspension threshold must be greater than deposit threshold';
    }

    // Validate advance booking hours
    if (policy.cautionAdvanceBookingHours !== undefined) {
      if (policy.cautionAdvanceBookingHours < 0 || policy.cautionAdvanceBookingHours > 168) {
        return 'Caution advance booking hours must be between 0 and 168 (7 days)';
      }
    }

    if (policy.depositAdvanceBookingHours !== undefined) {
      if (policy.depositAdvanceBookingHours < 0 || policy.depositAdvanceBookingHours > 168) {
        return 'Deposit advance booking hours must be between 0 and 168 (7 days)';
      }
    }

    // Validate deposit amount
    if (policy.depositAmount !== undefined) {
      if (policy.depositAmount < 0 || policy.depositAmount > 500) {
        return 'Deposit amount must be between $0 and $500';
      }
    }

    // Validate deposit reset count
    if (policy.depositResetAfterSuccessful !== undefined) {
      if (policy.depositResetAfterSuccessful < 1 || policy.depositResetAfterSuccessful > 20) {
        return 'Deposit reset count must be between 1 and 20';
      }
    }

    // Validate RCN redemption percent
    if (policy.maxRcnRedemptionPercent !== undefined) {
      if (policy.maxRcnRedemptionPercent < 0 || policy.maxRcnRedemptionPercent > 100) {
        return 'Max RCN redemption percent must be between 0 and 100';
      }
    }

    // Validate suspension duration
    if (policy.suspensionDurationDays !== undefined) {
      if (policy.suspensionDurationDays < 1 || policy.suspensionDurationDays > 365) {
        return 'Suspension duration must be between 1 and 365 days';
      }
    }

    // Validate grace period
    if (policy.gracePeriodMinutes !== undefined) {
      if (policy.gracePeriodMinutes < 0 || policy.gracePeriodMinutes > 120) {
        return 'Grace period must be between 0 and 120 minutes';
      }
    }

    // Validate dispute window
    if (policy.disputeWindowDays !== undefined) {
      if (policy.disputeWindowDays < 1 || policy.disputeWindowDays > 30) {
        return 'Dispute window must be between 1 and 30 days';
      }
    }

    // Validate auto-detection delay
    if (policy.autoDetectionDelayHours !== undefined) {
      if (policy.autoDetectionDelayHours < 0 || policy.autoDetectionDelayHours > 24) {
        return 'Auto-detection delay must be between 0 and 24 hours';
      }
    }

    return null;
  }
}

export default new NoShowPolicyController();
