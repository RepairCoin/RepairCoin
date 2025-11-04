// backend/src/domains/ShopGroupDomain/controllers/GroupController.ts
import { Request, Response } from 'express';
import { ShopGroupService, CreateGroupRequest } from '../../../services/ShopGroupService';
import { logger } from '../../../utils/logger';

export class GroupController {
  private service: ShopGroupService;

  constructor() {
    this.service = new ShopGroupService();
  }

  /**
   * Create a new shop group
   */
  createGroup = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const request: CreateGroupRequest = {
        ...req.body,
        createdByShopId: shopId
      };

      const group = await this.service.createGroup(request);

      res.status(201).json({
        success: true,
        data: group
      });
    } catch (error: unknown) {
      logger.error('Error in createGroup controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create group'
      });
    }
  };

  /**
   * Update group details
   */
  updateGroup = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const updates = req.body;

      const group = await this.service.updateGroup(groupId, shopId, updates);

      res.json({
        success: true,
        data: group
      });
    } catch (error: unknown) {
      logger.error('Error in updateGroup controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update group'
      });
    }
  };

  /**
   * Get group by ID
   */
  getGroup = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const group = await this.service.getGroup(groupId);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }

      res.json({
        success: true,
        data: group
      });
    } catch (error: unknown) {
      logger.error('Error in getGroup controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get group'
      });
    }
  };

  /**
   * Get all groups (with filters)
   */
  getAllGroups = async (req: Request, res: Response) => {
    try {
      const filters = {
        groupType: req.query.groupType as 'public' | 'private' | undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const result = await this.service.getAllGroups(filters);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error: unknown) {
      logger.error('Error in getAllGroups controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get groups'
      });
    }
  };

  /**
   * Get groups for authenticated shop
   */
  getMyGroups = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const groups = await this.service.getShopGroups(shopId);

      res.json({
        success: true,
        data: groups
      });
    } catch (error: unknown) {
      logger.error('Error in getMyGroups controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop groups'
      });
    }
  };
}
