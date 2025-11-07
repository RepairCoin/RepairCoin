// backend/src/domains/AffiliateShopGroupDomain/controllers/MembershipController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class MembershipController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
  }

  /**
   * Request to join a group
   */
  requestToJoin = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId } = req.params;
      const { requestMessage } = req.body;

      const memberRequest = await this.service.requestToJoinGroup(groupId, shopId, requestMessage);

      res.status(201).json({
        success: true,
        data: memberRequest
      });
    } catch (error: unknown) {
      logger.error('Error in requestToJoin controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request membership'
      });
    }
  };

  /**
   * Join group by invite code
   */
  joinByInviteCode = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { inviteCode, requestMessage } = req.body;

      const memberRequest = await this.service.joinGroupByInviteCode(inviteCode, shopId, requestMessage);

      res.status(201).json({
        success: true,
        data: memberRequest
      });
    } catch (error: unknown) {
      logger.error('Error in joinByInviteCode controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to join group'
      });
    }
  };

  /**
   * Approve member request (admin only)
   */
  approveMember = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId, shopIdToApprove } = req.params;

      const member = await this.service.approveMemberRequest(groupId, shopIdToApprove, shopId);

      res.json({
        success: true,
        data: member
      });
    } catch (error: unknown) {
      logger.error('Error in approveMember controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve member'
      });
    }
  };

  /**
   * Reject member request (admin only)
   */
  rejectMember = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId, shopIdToReject } = req.params;

      await this.service.rejectMemberRequest(groupId, shopIdToReject, shopId);

      res.json({
        success: true,
        message: 'Member request rejected'
      });
    } catch (error: unknown) {
      logger.error('Error in rejectMember controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject member'
      });
    }
  };

  /**
   * Remove member from group (admin only)
   */
  removeMember = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { groupId, shopIdToRemove } = req.params;

      await this.service.removeMember(groupId, shopIdToRemove, shopId);

      res.json({
        success: true,
        message: 'Member removed from group'
      });
    } catch (error: unknown) {
      logger.error('Error in removeMember controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove member'
      });
    }
  };

  /**
   * Get group members
   * Security:
   * - Pending members can only see their own request status
   * - Active members can see all active members and pending requests
   * - Admins can see all members and requests
   */
  getGroupMembers = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const requestingShopId = req.user?.shopId;
      const status = req.query.status as 'active' | 'pending' | 'rejected' | 'removed' | undefined;

      // Check if requesting shop is a member of this group
      if (requestingShopId) {
        const requestingMembership = await this.service.getShopMembershipStatus(groupId, requestingShopId);

        if (requestingMembership) {
          // If requester is only pending, they can only see their own status
          if (requestingMembership.status === 'pending') {
            return res.json({
              success: true,
              data: [requestingMembership], // Only their own request
              _message: 'Your membership request is pending approval'
            });
          }

          // If requester is rejected or removed, they can't see members
          if (requestingMembership.status === 'rejected' || requestingMembership.status === 'removed') {
            return res.status(403).json({
              success: false,
              error: 'You do not have access to view this group\'s members'
            });
          }

          // Active member or admin - can see all members
          const members = await this.service.getGroupMembers(groupId, status);
          return res.json({
            success: true,
            data: members
          });
        }
      }

      // Not authenticated or not a member - can only see active member count, not details
      const activeMembers = await this.service.getGroupMembers(groupId, 'active');
      return res.json({
        success: true,
        data: {
          memberCount: activeMembers.length,
          _message: 'Join this group to see member details'
        }
      });

    } catch (error: unknown) {
      logger.error('Error in getGroupMembers controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get group members'
      });
    }
  };
}
