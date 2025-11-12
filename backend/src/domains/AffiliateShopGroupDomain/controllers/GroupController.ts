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

      // Check membership status for all groups
      let membershipStatus = null;
      if (requestingShopId) {
        const membership = await this.service.getShopMembershipStatus(groupId, requestingShopId);
        membershipStatus = membership ? membership.status : null;
      }

      // All groups now work the same: hide sensitive info from non-members
      // If not authenticated or not an active member, return limited info
      if (!requestingShopId || !membershipStatus || membershipStatus !== 'active') {
        return res.json({
          success: true,
          data: {
            groupId: group.groupId,
            groupName: group.groupName,
            groupType: group.groupType,
            description: group.description,
            logoUrl: group.logoUrl,
            memberCount: group.memberCount,
            // Hide sensitive fields from non-members
            inviteCode: null,
            customTokenName: null,
            customTokenSymbol: null,
            membershipStatus: membershipStatus,
            _message: 'Join this group to see full details.'
          }
        });
      }

      // Active member - return full details with membership status
      res.json({
        success: true,
        data: {
          ...group,
          membershipStatus
        }
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
   * Privacy: Shows all groups but hides sensitive data for private groups when not a member
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

      const result = await this.service.getAllGroups(filters);

      // Add membership status and sanitize group data for non-members
      const sanitizedItems = await Promise.all(
        result.items.map(async (group) => {
          // Check membership status for all groups
          let membershipStatus = null;
          if (requestingShopId) {
            const membership = await this.service.getShopMembershipStatus(group.groupId, requestingShopId);
            membershipStatus = membership ? membership.status : null;
          }

          // All groups now work the same: hide sensitive info from non-members
          // If not authenticated or not an active member, hide sensitive fields
          if (!requestingShopId || !membershipStatus || membershipStatus !== 'active') {
            return {
              ...group,
              inviteCode: null,
              customTokenName: null,
              customTokenSymbol: null,
              membershipStatus
            };
          }

          // Active member - return full data with membership status
          return {
            ...group,
            membershipStatus
          };
        })
      );

      res.json({
        success: true,
        data: sanitizedItems,
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
