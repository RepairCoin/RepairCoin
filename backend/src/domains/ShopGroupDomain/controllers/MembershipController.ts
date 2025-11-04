// backend/src/domains/ShopGroupDomain/controllers/MembershipController.ts
import { Request, Response } from 'express';
import { ShopGroupService } from '../../../services/ShopGroupService';
import { logger } from '../../../utils/logger';

export class MembershipController {
  private service: ShopGroupService;

  constructor() {
    this.service = new ShopGroupService();
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
   */
  getGroupMembers = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const status = req.query.status as 'active' | 'pending' | 'rejected' | 'removed' | undefined;

      const members = await this.service.getGroupMembers(groupId, status);

      res.json({
        success: true,
        data: members
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
