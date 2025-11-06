// backend/src/services/AffiliateShopGroupService.ts
import { AffiliateShopGroupRepository, AffiliateShopGroup, CreateGroupParams, UpdateGroupParams, CustomerAffiliateGroupBalance, AffiliateGroupTokenTransaction } from '../repositories/AffiliateShopGroupRepository';
import { shopRepository } from '../repositories';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface CreateGroupRequest {
  groupName: string;
  description?: string;
  customTokenName: string;
  customTokenSymbol: string;
  tokenValueUsd?: number;
  createdByShopId: string;
  groupType: 'public' | 'private';
  logoUrl?: string;
  autoApproveRequests?: boolean;
}

export interface EarnGroupTokensRequest {
  customerAddress: string;
  groupId: string;
  shopId: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RedeemGroupTokensRequest {
  customerAddress: string;
  groupId: string;
  shopId: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export class AffiliateShopGroupService {
  private repository: AffiliateShopGroupRepository;

  constructor() {
    this.repository = new AffiliateShopGroupRepository();
  }

  /**
   * Create a new affiliate shop group
   */
  async createGroup(request: CreateGroupRequest): Promise<AffiliateShopGroup> {
    try {
      // Validate shop exists and is active
      const shop = await shopRepository.getShop(request.createdByShopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.active || !shop.verified) {
        throw new Error('Shop must be active and verified to create a group');
      }

      // Generate unique group ID and invite code
      const groupId = `grp_${uuidv4()}`;
      const inviteCode = this.generateInviteCode();

      const params: CreateGroupParams = {
        groupId,
        groupName: request.groupName,
        description: request.description,
        customTokenName: request.customTokenName,
        customTokenSymbol: request.customTokenSymbol.toUpperCase(),
        tokenValueUsd: request.tokenValueUsd,
        createdByShopId: request.createdByShopId,
        groupType: request.groupType,
        logoUrl: request.logoUrl,
        inviteCode,
        autoApproveRequests: request.autoApproveRequests
      };

      const group = await this.repository.createGroup(params);

      // Automatically add creator as admin member
      await this.repository.addMemberRequest(groupId, request.createdByShopId);
      await this.repository.approveMemberRequest(groupId, request.createdByShopId, request.createdByShopId, 'admin');

      logger.info('Affiliate affiliate shop group created successfully', { groupId, createdBy: request.createdByShopId });
      return group;
    } catch (error) {
      logger.error('Error in createGroup:', error);
      throw error;
    }
  }

  /**
   * Update an existing group
   */
  async updateGroup(
    groupId: string,
    shopId: string,
    updates: UpdateGroupParams
  ): Promise<AffiliateShopGroup> {
    try {
      // Verify shop is admin of group
      await this.verifyShopIsAdmin(groupId, shopId);

      return await this.repository.updateGroup(groupId, updates);
    } catch (error) {
      logger.error('Error in updateGroup:', error);
      throw error;
    }
  }

  /**
   * Get group by ID
   */
  async getGroup(groupId: string): Promise<AffiliateShopGroup | null> {
    return await this.repository.getGroupById(groupId);
  }

  /**
   * Get all public groups or groups filtered by criteria
   */
  async getAllGroups(filters: {
    groupType?: 'public' | 'private';
    active?: boolean;
    page: number;
    limit: number;
  }) {
    return await this.repository.getAllGroups(filters);
  }

  /**
   * Request to join a group
   */
  async requestToJoinGroup(
    groupId: string,
    shopId: string,
    requestMessage?: string
  ) {
    try {
      // Validate shop exists
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      if (!shop.active || !shop.verified) {
        throw new Error('Shop must be active and verified to join a group');
      }

      // Validate group exists
      const group = await this.repository.getGroupById(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      if (!group.active) {
        throw new Error('Group is not active');
      }

      // Check if already a member
      const isMember = await this.repository.isShopMemberOfGroup(groupId, shopId);
      if (isMember) {
        throw new Error('Shop is already a member of this group');
      }

      // Create member request
      const memberRequest = await this.repository.addMemberRequest(groupId, shopId, requestMessage);

      // Auto-approve if enabled
      if (group.autoApproveRequests) {
        await this.repository.approveMemberRequest(groupId, shopId, group.createdByShopId);
        logger.info('Member request auto-approved', { groupId, shopId });
      }

      return memberRequest;
    } catch (error) {
      logger.error('Error in requestToJoinGroup:', error);
      throw error;
    }
  }

  /**
   * Join group by invite code
   */
  async joinGroupByInviteCode(
    inviteCode: string,
    shopId: string,
    requestMessage?: string
  ) {
    try {
      const group = await this.repository.getGroupByInviteCode(inviteCode);
      if (!group) {
        throw new Error('Invalid invite code');
      }

      return await this.requestToJoinGroup(group.groupId, shopId, requestMessage);
    } catch (error) {
      logger.error('Error in joinGroupByInviteCode:', error);
      throw error;
    }
  }

  /**
   * Approve a member request
   */
  async approveMemberRequest(
    groupId: string,
    shopIdToApprove: string,
    adminShopId: string
  ) {
    try {
      // Verify admin permissions
      await this.verifyShopIsAdmin(groupId, adminShopId);

      return await this.repository.approveMemberRequest(groupId, shopIdToApprove, adminShopId);
    } catch (error) {
      logger.error('Error in approveMemberRequest:', error);
      throw error;
    }
  }

  /**
   * Reject a member request
   */
  async rejectMemberRequest(
    groupId: string,
    shopIdToReject: string,
    adminShopId: string
  ) {
    try {
      // Verify admin permissions
      await this.verifyShopIsAdmin(groupId, adminShopId);

      await this.repository.rejectMemberRequest(groupId, shopIdToReject);
    } catch (error) {
      logger.error('Error in rejectMemberRequest:', error);
      throw error;
    }
  }

  /**
   * Remove a member from group
   */
  async removeMember(
    groupId: string,
    shopIdToRemove: string,
    adminShopId: string
  ) {
    try {
      // Verify admin permissions
      await this.verifyShopIsAdmin(groupId, adminShopId);

      // Cannot remove group creator
      const group = await this.repository.getGroupById(groupId);
      if (group?.createdByShopId === shopIdToRemove) {
        throw new Error('Cannot remove group creator');
      }

      await this.repository.removeMember(groupId, shopIdToRemove);
    } catch (error) {
      logger.error('Error in removeMember:', error);
      throw error;
    }
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string, status?: 'active' | 'pending' | 'rejected' | 'removed') {
    return await this.repository.getGroupMembers(groupId, status);
  }

  /**
   * Get groups a shop is member of
   */
  async getShopGroups(shopId: string): Promise<AffiliateShopGroup[]> {
    return await this.repository.getShopGroups(shopId);
  }

  /**
   * Issue group tokens to customer (earning)
   */
  async earnGroupTokens(request: EarnGroupTokensRequest): Promise<{
    transaction: AffiliateGroupTokenTransaction;
    newBalance: CustomerAffiliateGroupBalance;
  }> {
    try {
      // Verify shop is member of group
      const isMember = await this.repository.isShopMemberOfGroup(request.groupId, request.shopId);
      if (!isMember) {
        throw new Error('Shop is not a member of this group');
      }

      // Get current balance
      const currentBalance = await this.repository.getCustomerBalance(request.customerAddress, request.groupId);
      const balanceBefore = currentBalance?.balance || 0;

      // Update balance
      const newBalance = await this.repository.updateCustomerBalance(
        request.customerAddress,
        request.groupId,
        request.amount,
        'earn'
      );

      // Record transaction
      const transaction = await this.repository.recordTransaction({
        id: `gtx_${uuidv4()}`,
        groupId: request.groupId,
        customerAddress: request.customerAddress,
        shopId: request.shopId,
        type: 'earn',
        amount: request.amount,
        balanceBefore,
        balanceAfter: newBalance.balance,
        reason: request.reason,
        metadata: request.metadata
      });

      logger.info('Group tokens earned', {
        groupId: request.groupId,
        customerAddress: request.customerAddress,
        amount: request.amount
      });

      return { transaction, newBalance };
    } catch (error) {
      logger.error('Error in earnGroupTokens:', error);
      throw error;
    }
  }

  /**
   * Redeem group tokens at member shop
   */
  async redeemGroupTokens(request: RedeemGroupTokensRequest): Promise<{
    transaction: AffiliateGroupTokenTransaction;
    newBalance: CustomerAffiliateGroupBalance;
  }> {
    try {
      // Verify shop is member of group
      const isMember = await this.repository.isShopMemberOfGroup(request.groupId, request.shopId);
      if (!isMember) {
        throw new Error('Shop is not a member of this group');
      }

      // Get current balance
      const currentBalance = await this.repository.getCustomerBalance(request.customerAddress, request.groupId);
      if (!currentBalance) {
        throw new Error('Customer has no balance in this group');
      }

      if (currentBalance.balance < request.amount) {
        throw new Error('Insufficient group token balance');
      }

      const balanceBefore = currentBalance.balance;

      // Update balance
      const newBalance = await this.repository.updateCustomerBalance(
        request.customerAddress,
        request.groupId,
        request.amount,
        'redeem'
      );

      // Record transaction
      const transaction = await this.repository.recordTransaction({
        id: `gtx_${uuidv4()}`,
        groupId: request.groupId,
        customerAddress: request.customerAddress,
        shopId: request.shopId,
        type: 'redeem',
        amount: request.amount,
        balanceBefore,
        balanceAfter: newBalance.balance,
        reason: request.reason,
        metadata: request.metadata
      });

      logger.info('Group tokens redeemed', {
        groupId: request.groupId,
        customerAddress: request.customerAddress,
        amount: request.amount
      });

      return { transaction, newBalance };
    } catch (error) {
      logger.error('Error in redeemGroupTokens:', error);
      throw error;
    }
  }

  /**
   * Get customer's balance in a specific group
   */
  async getCustomerBalance(customerAddress: string, groupId: string): Promise<CustomerAffiliateGroupBalance | null> {
    return await this.repository.getCustomerBalance(customerAddress, groupId);
  }

  /**
   * Get all customer's group balances
   */
  async getAllCustomerBalances(customerAddress: string): Promise<CustomerAffiliateGroupBalance[]> {
    return await this.repository.getAllCustomerBalances(customerAddress);
  }

  /**
   * Get group transaction history
   */
  async getGroupTransactions(
    groupId: string,
    filters: { page: number; limit: number; type?: 'earn' | 'redeem' }
  ) {
    return await this.repository.getGroupTransactions(groupId, filters);
  }

  /**
   * Get customer's transaction history in a group
   */
  async getCustomerTransactions(
    customerAddress: string,
    groupId: string,
    filters: { page: number; limit: number }
  ) {
    return await this.repository.getCustomerTransactions(customerAddress, groupId, filters);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get analytics for a group
   */
  async getGroupAnalytics(groupId: string) {
    try {
      return await this.repository.getGroupAnalytics(groupId);
    } catch (error) {
      logger.error('Error in getGroupAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get member activity statistics
   */
  async getMemberActivityStats(groupId: string) {
    try {
      return await this.repository.getMemberActivityStats(groupId);
    } catch (error) {
      logger.error('Error in getMemberActivityStats:', error);
      throw error;
    }
  }

  /**
   * Get transaction trends
   */
  async getTransactionTrends(groupId: string, days: number = 30) {
    try {
      return await this.repository.getTransactionTrends(groupId, days);
    } catch (error) {
      logger.error('Error in getTransactionTrends:', error);
      throw error;
    }
  }

  private async verifyShopIsAdmin(groupId: string, shopId: string): Promise<void> {
    const members = await this.repository.getGroupMembers(groupId, 'active');
    const member = members.find(m => m.shopId === shopId && m.role === 'admin');

    if (!member) {
      throw new Error('Shop is not an admin of this group');
    }
  }

  private generateInviteCode(): string {
    // Generate a random 8-character invite code
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}
