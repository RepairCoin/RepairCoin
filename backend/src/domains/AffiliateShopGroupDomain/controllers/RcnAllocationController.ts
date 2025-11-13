// backend/src/domains/AffiliateShopGroupDomain/controllers/RcnAllocationController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class RcnAllocationController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
  }

  /**
   * Allocate RCN from shop's main balance to a group
   */
  allocateRcn = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid allocation amount required' });
      }

      const result = await this.service.allocateRcnToGroup(shopId, groupId, amount);

      res.json({
        success: true,
        data: {
          allocation: result.allocation,
          shopRemainingBalance: result.shopRemainingBalance,
          message: `Successfully allocated ${amount} RCN to this group`
        }
      });
    } catch (error: unknown) {
      logger.error('Error in allocateRcn controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate RCN'
      });
    }
  };

  /**
   * Deallocate RCN from group back to shop's main balance
   */
  deallocateRcn = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid deallocation amount required' });
      }

      const result = await this.service.deallocateRcnFromGroup(shopId, groupId, amount);

      res.json({
        success: true,
        data: {
          allocation: result.allocation,
          shopNewBalance: result.shopNewBalance,
          message: `Successfully returned ${amount} RCN to your shop balance`
        }
      });
    } catch (error: unknown) {
      logger.error('Error in deallocateRcn controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deallocate RCN'
      });
    }
  };

  /**
   * Get shop's RCN allocation for a specific group
   */
  getGroupAllocation = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;

      const allocation = await this.service.getShopGroupRcnAllocation(shopId, groupId);

      res.json({
        success: true,
        data: allocation
      });
    } catch (error: unknown) {
      logger.error('Error in getGroupAllocation controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get allocation'
      });
    }
  };

  /**
   * Get all RCN allocations for authenticated shop
   */
  getAllAllocations = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const allocations = await this.service.getShopRcnAllocations(shopId);

      res.json({
        success: true,
        data: allocations
      });
    } catch (error: unknown) {
      logger.error('Error in getAllAllocations controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get allocations'
      });
    }
  };
}
