// backend/src/domains/AffiliateShopGroupDomain/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class AnalyticsController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
  }

  /**
   * Get group analytics overview
   * Access control:
   * - Pending members: No access (403)
   * - Rejected/removed members: No access (403)
   * - Active members/admins: Full access
   * - Non-members: No access (403)
   */
  getGroupAnalytics = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const requestingShopId = req.user?.shopId;

      // Check membership status
      if (requestingShopId) {
        const membership = await this.service.getShopMembershipStatus(groupId, requestingShopId);

        if (!membership) {
          return res.status(403).json({
            success: false,
            error: 'You must be a member to view analytics'
          });
        }

        if (membership.status === 'pending') {
          return res.status(403).json({
            success: false,
            error: 'Your membership request is pending approval'
          });
        }

        if (membership.status === 'rejected' || membership.status === 'removed') {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to view this group\'s analytics'
          });
        }
      } else {
        // Not authenticated
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const analytics = await this.service.getGroupAnalytics(groupId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: unknown) {
      logger.error('Error in getGroupAnalytics controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics'
      });
    }
  };

  /**
   * Get member activity statistics
   * Access control:
   * - Pending members: No access (403)
   * - Rejected/removed members: No access (403)
   * - Active members/admins: Full access
   * - Non-members: No access (403)
   */
  getMemberActivityStats = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const requestingShopId = req.user?.shopId;

      // Check membership status
      if (requestingShopId) {
        const membership = await this.service.getShopMembershipStatus(groupId, requestingShopId);

        if (!membership) {
          return res.status(403).json({
            success: false,
            error: 'You must be a member to view analytics'
          });
        }

        if (membership.status === 'pending') {
          return res.status(403).json({
            success: false,
            error: 'Your membership request is pending approval'
          });
        }

        if (membership.status === 'rejected' || membership.status === 'removed') {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to view this group\'s analytics'
          });
        }
      } else {
        // Not authenticated
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const stats = await this.service.getMemberActivityStats(groupId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: unknown) {
      logger.error('Error in getMemberActivityStats controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch member activity stats'
      });
    }
  };

  /**
   * Get transaction trends
   * Access control:
   * - Pending members: No access (403)
   * - Rejected/removed members: No access (403)
   * - Active members/admins: Full access
   * - Non-members: No access (403)
   */
  getTransactionTrends = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const requestingShopId = req.user?.shopId;
      const days = parseInt(req.query.days as string) || 30;

      // Check membership status
      if (requestingShopId) {
        const membership = await this.service.getShopMembershipStatus(groupId, requestingShopId);

        if (!membership) {
          return res.status(403).json({
            success: false,
            error: 'You must be a member to view analytics'
          });
        }

        if (membership.status === 'pending') {
          return res.status(403).json({
            success: false,
            error: 'Your membership request is pending approval'
          });
        }

        if (membership.status === 'rejected' || membership.status === 'removed') {
          return res.status(403).json({
            success: false,
            error: 'You do not have access to view this group\'s analytics'
          });
        }
      } else {
        // Not authenticated
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const trends = await this.service.getTransactionTrends(groupId, days);

      res.json({
        success: true,
        data: trends
      });
    } catch (error: unknown) {
      logger.error('Error in getTransactionTrends controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transaction trends'
      });
    }
  };
}
