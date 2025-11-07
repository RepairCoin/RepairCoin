// backend/src/domains/AffiliateShopGroupDomain/controllers/GroupController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService, CreateGroupRequest } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class GroupController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
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
   * Privacy: For private groups, only members can see full details including invite code
   */
  getGroup = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const requestingShopId = req.user?.shopId; // May be undefined if not authenticated

      const group = await this.service.getGroup(groupId);

      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }

      // If group is private, check if requesting shop is a member
      if (group.groupType === 'private') {
        // If not authenticated or not a member, return limited info
        if (!requestingShopId) {
          return res.json({
            success: true,
            data: {
              groupId: group.groupId,
              groupName: group.groupName,
              groupType: group.groupType,
              description: group.description,
              logoUrl: group.logoUrl,
              // Hide sensitive fields
              inviteCode: null,
              customTokenName: null,
              customTokenSymbol: null,
              _message: 'This is a private group. Join to see full details.'
            }
          });
        }

        // Check if shop is a member
        const isMember = await this.service.isShopMember(groupId, requestingShopId);

        if (!isMember) {
          // Not a member - return limited info
          return res.json({
            success: true,
            data: {
              groupId: group.groupId,
              groupName: group.groupName,
              groupType: group.groupType,
              description: group.description,
              logoUrl: group.logoUrl,
              // Hide sensitive fields
              inviteCode: null,
              customTokenName: null,
              customTokenSymbol: null,
              _message: 'This is a private group. Join to see full details.'
            }
          });
        }
      }

      // Public group OR authenticated member of private group - return full details
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
   * Privacy: Only returns public groups. Private groups are not listed.
   */
  getAllGroups = async (req: Request, res: Response) => {
    try {
      const requestingShopId = req.user?.shopId; // May be undefined if not authenticated

      const filters = {
        groupType: req.query.groupType as 'public' | 'private' | undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      // Security: Only return public groups in general listing
      // Private groups should only be visible to members via /my-groups
      if (!filters.groupType) {
        filters.groupType = 'public';
      }

      const result = await this.service.getAllGroups(filters);

      // If private groups requested and not authenticated, return empty
      if (filters.groupType === 'private' && !requestingShopId) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: filters.limit, totalItems: 0, totalPages: 0 }
        });
      }

      // Filter out sensitive data from private groups for non-members
      if (requestingShopId) {
        const sanitizedItems = await Promise.all(
          result.items.map(async (group) => {
            if (group.groupType === 'private') {
              const isMember = await this.service.isShopMember(group.groupId, requestingShopId);
              if (!isMember) {
                // Hide sensitive fields for non-members
                return {
                  ...group,
                  inviteCode: null,
                  customTokenName: null,
                  customTokenSymbol: null,
                };
              }
            }
            return group;
          })
        );

        return res.json({
          success: true,
          data: sanitizedItems,
          pagination: result.pagination
        });
      }

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
