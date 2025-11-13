// backend/src/repositories/AffiliateShopGroupRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface AffiliateShopGroup {
  groupId: string;
  groupName: string;
  description?: string;
  customTokenName: string;
  customTokenSymbol: string;
  tokenValueUsd?: number;
  createdByShopId: string;
  groupType: 'public' | 'private';
  logoUrl?: string;
  inviteCode: string;
  autoApproveRequests: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
}

export interface AffiliateShopGroupMember {
  id: number;
  groupId: string;
  shopId: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'rejected' | 'removed';
  joinedAt?: Date;
  requestMessage?: string;
  requestedAt: Date;
  approvedByShopId?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAffiliateGroupBalance {
  id: number;
  customerAddress: string;
  groupId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastTransactionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateGroupTokenTransaction {
  id: string;
  groupId: string;
  customerAddress: string;
  shopId: string;
  type: 'earn' | 'redeem';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

export interface AffiliateGroupSettings {
  groupId: string;
  dailyEarningLimit?: number;
  minimumRedemption?: number;
  maximumRedemption?: number;
  requireMinimumSpend: boolean;
  minimumSpendAmount?: number;
  settingsJson: Record<string, unknown>;
  updatedAt: Date;
}

export interface CreateGroupParams {
  groupId: string;
  groupName: string;
  description?: string;
  customTokenName: string;
  customTokenSymbol: string;
  tokenValueUsd?: number;
  createdByShopId: string;
  groupType: 'public' | 'private';
  logoUrl?: string;
  inviteCode: string;
  autoApproveRequests?: boolean;
}

export interface UpdateGroupParams {
  groupName?: string;
  description?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  tokenValueUsd?: number;
  groupType?: 'public' | 'private';
  logoUrl?: string;
  autoApproveRequests?: boolean;
  active?: boolean;
}

export interface ShopGroupRcnAllocation {
  shopId: string;
  groupId: string;
  allocatedRcn: number;
  usedRcn: number;
  availableRcn: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AffiliateShopGroupRepository extends BaseRepository {
  // ==================== SHOP GROUPS ====================

  async createGroup(params: CreateGroupParams): Promise<AffiliateShopGroup> {
    try {
      const query = `
        INSERT INTO affiliate_shop_groups (
          group_id, group_name, description, custom_token_name, custom_token_symbol,
          token_value_usd, created_by_shop_id, group_type, logo_url, invite_code,
          auto_approve_requests
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        params.groupId,
        params.groupName,
        params.description || null,
        params.customTokenName,
        params.customTokenSymbol,
        params.tokenValueUsd || null,
        params.createdByShopId,
        params.groupType,
        params.logoUrl || null,
        params.inviteCode,
        params.autoApproveRequests || false
      ];

      const result = await this.pool.query(query, values);
      logger.info('Shop group created', { groupId: params.groupId });
      return this.mapGroupRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating shop group:', error);
      throw error;
    }
  }

  async getGroupById(groupId: string): Promise<AffiliateShopGroup | null> {
    try {
      const query = `
        SELECT g.*,
          COUNT(DISTINCT CASE WHEN m.status = 'active' THEN m.shop_id END) as member_count
        FROM affiliate_shop_groups g
        LEFT JOIN affiliate_shop_group_members m ON g.group_id = m.group_id
        WHERE g.group_id = $1
        GROUP BY g.group_id, g.group_name, g.description, g.custom_token_name, g.custom_token_symbol,
                 g.token_value_usd, g.created_by_shop_id, g.group_type, g.logo_url, g.invite_code,
                 g.auto_approve_requests, g.active, g.created_at, g.updated_at
      `;
      const result = await this.pool.query(query, [groupId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapGroupRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching shop group:', error);
      throw error;
    }
  }

  async getGroupByInviteCode(inviteCode: string): Promise<AffiliateShopGroup | null> {
    try {
      const query = 'SELECT * FROM affiliate_shop_groups WHERE invite_code = $1';
      const result = await this.pool.query(query, [inviteCode]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapGroupRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching shop group by invite code:', error);
      throw error;
    }
  }

  async updateGroup(groupId: string, updates: UpdateGroupParams): Promise<AffiliateShopGroup> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCount = 0;

      const fieldMappings: Record<string, string> = {
        groupName: 'group_name',
        description: 'description',
        customTokenName: 'custom_token_name',
        customTokenSymbol: 'custom_token_symbol',
        tokenValueUsd: 'token_value_usd',
        groupType: 'group_type',
        logoUrl: 'logo_url',
        autoApproveRequests: 'auto_approve_requests',
        active: 'active'
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && fieldMappings[key]) {
          paramCount++;
          fields.push(`${fieldMappings[key]} = $${paramCount}`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        const current = await this.getGroupById(groupId);
        if (!current) throw new Error('Group not found');
        return current;
      }

      paramCount++;
      values.push(groupId);

      const query = `
        UPDATE affiliate_shop_groups
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE group_id = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Group not found');
      }

      logger.info('Shop group updated', { groupId });
      return this.mapGroupRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating shop group:', error);
      throw error;
    }
  }

  async getAllGroups(filters: {
    groupType?: 'public' | 'private';
    active?: boolean;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<AffiliateShopGroup>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: unknown[] = [];
      let paramCount = 0;

      if (filters.groupType) {
        paramCount++;
        whereClause += ` AND group_type = $${paramCount}`;
        params.push(filters.groupType);
      }

      if (filters.active !== undefined) {
        paramCount++;
        whereClause += ` AND active = $${paramCount}`;
        params.push(filters.active);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM affiliate_shop_groups ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT g.*,
          COUNT(DISTINCT CASE WHEN m.status = 'active' THEN m.shop_id END) as member_count
        FROM affiliate_shop_groups g
        LEFT JOIN affiliate_shop_group_members m ON g.group_id = m.group_id
        ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
        GROUP BY g.group_id, g.group_name, g.description, g.custom_token_name, g.custom_token_symbol,
                 g.token_value_usd, g.created_by_shop_id, g.group_type, g.logo_url, g.invite_code,
                 g.auto_approve_requests, g.active, g.created_at, g.updated_at
        ORDER BY g.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      const groups = result.rows.map(row => this.mapGroupRow(row));
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: groups,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting all groups:', error);
      throw error;
    }
  }

  // ==================== GROUP MEMBERS ====================

  async addMemberRequest(
    groupId: string,
    shopId: string,
    requestMessage?: string
  ): Promise<AffiliateShopGroupMember> {
    try {
      const query = `
        INSERT INTO affiliate_shop_group_members (
          group_id, shop_id, status, request_message
        ) VALUES ($1, $2, 'pending', $3)
        RETURNING *
      `;

      const result = await this.pool.query(query, [groupId, shopId, requestMessage || null]);
      logger.info('Member request created', { groupId, shopId });
      return this.mapMemberRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating member request:', error);
      throw error;
    }
  }

  async approveMemberRequest(
    groupId: string,
    shopId: string,
    approvedByShopId: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<AffiliateShopGroupMember> {
    try {
      const query = `
        UPDATE affiliate_shop_group_members
        SET status = 'active',
            role = $4,
            joined_at = NOW(),
            approved_by_shop_id = $3,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE group_id = $1 AND shop_id = $2 AND status = 'pending'
        RETURNING *
      `;

      const result = await this.pool.query(query, [groupId, shopId, approvedByShopId, role]);

      if (result.rows.length === 0) {
        throw new Error('Member request not found or already processed');
      }

      logger.info('Member request approved', { groupId, shopId });
      return this.mapMemberRow(result.rows[0]);
    } catch (error) {
      logger.error('Error approving member request:', error);
      throw error;
    }
  }

  async rejectMemberRequest(groupId: string, shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE affiliate_shop_group_members
        SET status = 'rejected', updated_at = NOW()
        WHERE group_id = $1 AND shop_id = $2 AND status = 'pending'
      `;

      await this.pool.query(query, [groupId, shopId]);
      logger.info('Member request rejected', { groupId, shopId });
    } catch (error) {
      logger.error('Error rejecting member request:', error);
      throw error;
    }
  }

  async removeMember(groupId: string, shopId: string): Promise<void> {
    try {
      const query = `
        UPDATE affiliate_shop_group_members
        SET status = 'removed', updated_at = NOW()
        WHERE group_id = $1 AND shop_id = $2 AND status = 'active'
      `;

      await this.pool.query(query, [groupId, shopId]);
      logger.info('Member removed from group', { groupId, shopId });
    } catch (error) {
      logger.error('Error removing member:', error);
      throw error;
    }
  }

  async getGroupMembers(
    groupId: string,
    status?: 'active' | 'pending' | 'rejected' | 'removed'
  ): Promise<AffiliateShopGroupMember[]> {
    try {
      let query = 'SELECT * FROM affiliate_shop_group_members WHERE group_id = $1';
      const params: unknown[] = [groupId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY joined_at DESC, requested_at DESC';

      const result = await this.pool.query(query, params);
      return result.rows.map(row => this.mapMemberRow(row));
    } catch (error) {
      logger.error('Error getting group members:', error);
      throw error;
    }
  }

  async isShopMemberOfGroup(groupId: string, shopId: string): Promise<boolean> {
    try {
      const query = `
        SELECT 1 FROM affiliate_shop_group_members
        WHERE group_id = $1 AND shop_id = $2 AND status = 'active'
      `;

      const result = await this.pool.query(query, [groupId, shopId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking shop membership:', error);
      throw error;
    }
  }

  async getShopGroups(shopId: string): Promise<AffiliateShopGroup[]> {
    try {
      const query = `
        SELECT g.*,
          COUNT(DISTINCT CASE WHEN m2.status = 'active' THEN m2.shop_id END) as member_count
        FROM affiliate_shop_groups g
        INNER JOIN affiliate_shop_group_members m ON g.group_id = m.group_id
        LEFT JOIN affiliate_shop_group_members m2 ON g.group_id = m2.group_id
        WHERE m.shop_id = $1 AND m.status = 'active' AND g.active = true
        GROUP BY g.group_id, g.group_name, g.description, g.custom_token_name, g.custom_token_symbol,
                 g.token_value_usd, g.created_by_shop_id, g.group_type, g.logo_url, g.invite_code,
                 g.auto_approve_requests, g.active, g.created_at, g.updated_at, m.joined_at
        ORDER BY m.joined_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapGroupRow(row));
    } catch (error) {
      logger.error('Error getting shop groups:', error);
      throw error;
    }
  }

  // ==================== CUSTOMER BALANCES ====================

  async getCustomerBalance(customerAddress: string, groupId: string): Promise<CustomerAffiliateGroupBalance | null> {
    try {
      const query = `
        SELECT * FROM customer_affiliate_group_balances
        WHERE customer_address = $1 AND group_id = $2
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase(), groupId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapBalanceRow(result.rows[0]);
    } catch (error) {
      logger.error('Error getting customer balance:', error);
      throw error;
    }
  }

  async getAllCustomerBalances(customerAddress: string): Promise<CustomerAffiliateGroupBalance[]> {
    try {
      const query = `
        SELECT * FROM customer_affiliate_group_balances
        WHERE customer_address = $1 AND balance > 0
        ORDER BY balance DESC
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rows.map(row => this.mapBalanceRow(row));
    } catch (error) {
      logger.error('Error getting customer balances:', error);
      throw error;
    }
  }

  async updateCustomerBalance(
    customerAddress: string,
    groupId: string,
    balanceChange: number,
    type: 'earn' | 'redeem'
  ): Promise<CustomerAffiliateGroupBalance> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get or create balance record
      const getQuery = `
        SELECT * FROM customer_affiliate_group_balances
        WHERE customer_address = $1 AND group_id = $2
        FOR UPDATE
      `;

      let result = await client.query(getQuery, [customerAddress.toLowerCase(), groupId]);

      if (result.rows.length === 0) {
        // Create new balance record
        const createQuery = `
          INSERT INTO customer_affiliate_group_balances (customer_address, group_id, balance, lifetime_earned, lifetime_redeemed)
          VALUES ($1, $2, 0, 0, 0)
          RETURNING *
        `;
        result = await client.query(createQuery, [customerAddress.toLowerCase(), groupId]);
      }

      const current = this.mapBalanceRow(result.rows[0]);

      // Update balance
      const newBalance = current.balance + (type === 'earn' ? balanceChange : -balanceChange);

      if (newBalance < 0) {
        throw new Error('Insufficient balance');
      }

      const updateQuery = `
        UPDATE customer_affiliate_group_balances
        SET balance = $1,
            lifetime_earned = lifetime_earned + $2,
            lifetime_redeemed = lifetime_redeemed + $3,
            last_transaction_at = NOW(),
            updated_at = NOW()
        WHERE customer_address = $4 AND group_id = $5
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        newBalance,
        type === 'earn' ? balanceChange : 0,
        type === 'redeem' ? balanceChange : 0,
        customerAddress.toLowerCase(),
        groupId
      ]);

      await client.query('COMMIT');
      logger.info('Customer balance updated', { customerAddress, groupId, balanceChange, type });
      return this.mapBalanceRow(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating customer balance:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== TRANSACTIONS ====================

  async recordTransaction(params: {
    id: string;
    groupId: string;
    customerAddress: string;
    shopId: string;
    type: 'earn' | 'redeem';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AffiliateGroupTokenTransaction> {
    try {
      const query = `
        INSERT INTO affiliate_group_token_transactions (
          id, group_id, customer_address, shop_id, type, amount,
          balance_before, balance_after, reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        params.id,
        params.groupId,
        params.customerAddress.toLowerCase(),
        params.shopId,
        params.type,
        params.amount,
        params.balanceBefore,
        params.balanceAfter,
        params.reason || null,
        JSON.stringify(params.metadata || {})
      ];

      const result = await this.pool.query(query, values);
      logger.info('Group transaction recorded', { id: params.id, groupId: params.groupId });
      return this.mapTransactionRow(result.rows[0]);
    } catch (error) {
      logger.error('Error recording group transaction:', error);
      throw error;
    }
  }

  async getGroupTransactions(
    groupId: string,
    filters: { page: number; limit: number; type?: 'earn' | 'redeem' }
  ): Promise<PaginatedResult<AffiliateGroupTokenTransaction>> {
    try {
      let whereClause = 'WHERE group_id = $1';
      const params: unknown[] = [groupId];
      let paramCount = 1;

      if (filters.type) {
        paramCount++;
        whereClause += ` AND type = $${paramCount}`;
        params.push(filters.type);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM affiliate_group_token_transactions ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT * FROM affiliate_group_token_transactions
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      const transactions = result.rows.map(row => this.mapTransactionRow(row));
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: transactions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting group transactions:', error);
      throw error;
    }
  }

  async getCustomerTransactions(
    customerAddress: string,
    groupId: string,
    filters: { page: number; limit: number }
  ): Promise<PaginatedResult<AffiliateGroupTokenTransaction>> {
    try {
      const whereClause = 'WHERE customer_address = $1 AND group_id = $2';
      const baseParams: unknown[] = [customerAddress.toLowerCase(), groupId];

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM affiliate_group_token_transactions ${whereClause}`;
      const countResult = await this.pool.query(countQuery, baseParams);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      const params = [...baseParams, filters.limit, offset];

      const query = `
        SELECT * FROM affiliate_group_token_transactions
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await this.pool.query(query, params);
      const transactions = result.rows.map(row => this.mapTransactionRow(row));
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: transactions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting customer transactions:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private mapGroupRow(row: any): AffiliateShopGroup & { memberCount?: number } {
    return {
      groupId: row.group_id,
      groupName: row.group_name,
      description: row.description,
      customTokenName: row.custom_token_name,
      customTokenSymbol: row.custom_token_symbol,
      tokenValueUsd: row.token_value_usd ? parseFloat(row.token_value_usd) : undefined,
      createdByShopId: row.created_by_shop_id,
      groupType: row.group_type,
      logoUrl: row.logo_url,
      inviteCode: row.invite_code,
      autoApproveRequests: row.auto_approve_requests,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: row.member_count ? parseInt(row.member_count) : undefined
    };
  }

  private mapMemberRow(row: any): AffiliateShopGroupMember {
    return {
      id: row.id,
      groupId: row.group_id,
      shopId: row.shop_id,
      role: row.role,
      status: row.status,
      joinedAt: row.joined_at,
      requestMessage: row.request_message,
      requestedAt: row.requested_at,
      approvedByShopId: row.approved_by_shop_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapBalanceRow(row: any): CustomerAffiliateGroupBalance {
    return {
      id: row.id,
      customerAddress: row.customer_address,
      groupId: row.group_id,
      balance: parseFloat(row.balance),
      lifetimeEarned: parseFloat(row.lifetime_earned),
      lifetimeRedeemed: parseFloat(row.lifetime_redeemed),
      lastTransactionAt: row.last_transaction_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapTransactionRow(row: any): AffiliateGroupTokenTransaction {
    return {
      id: row.id,
      groupId: row.group_id,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      type: row.type,
      amount: parseFloat(row.amount),
      balanceBefore: parseFloat(row.balance_before),
      balanceAfter: parseFloat(row.balance_after),
      reason: row.reason,
      metadata: row.metadata,
      timestamp: row.timestamp,
      createdAt: row.created_at
    };
  }

  // ==================== ANALYTICS ====================

  async getGroupAnalytics(groupId: string): Promise<{
    totalTokensIssued: number;
    totalTokensRedeemed: number;
    totalTokensCirculating: number;
    activeMembers: number;
    totalTransactions: number;
    uniqueCustomers: number;
    averageTransactionSize: number;
    tokensIssuedLast30Days: number;
    tokensRedeemedLast30Days: number;
  }> {
    try {
      const query = `
        WITH stats AS (
          SELECT
            COUNT(DISTINCT CASE WHEN sgm.status = 'active' THEN sgm.shop_id END) as active_members,
            COUNT(DISTINCT gtt.customer_address) as unique_customers,
            COUNT(gtt.id) as total_transactions,
            COALESCE(SUM(CASE WHEN gtt.type = 'earn' THEN gtt.amount ELSE 0 END), 0) as total_issued,
            COALESCE(SUM(CASE WHEN gtt.type = 'redeem' THEN gtt.amount ELSE 0 END), 0) as total_redeemed,
            COALESCE(AVG(gtt.amount), 0) as avg_transaction,
            COALESCE(SUM(CASE
              WHEN gtt.type = 'earn' AND gtt.created_at >= NOW() - INTERVAL '30 days'
              THEN gtt.amount ELSE 0
            END), 0) as issued_30d,
            COALESCE(SUM(CASE
              WHEN gtt.type = 'redeem' AND gtt.created_at >= NOW() - INTERVAL '30 days'
              THEN gtt.amount ELSE 0
            END), 0) as redeemed_30d
          FROM affiliate_shop_groups sg
          LEFT JOIN affiliate_shop_group_members sgm ON sg.group_id = sgm.group_id
          LEFT JOIN affiliate_group_token_transactions gtt ON sg.group_id = gtt.group_id
          WHERE sg.group_id = $1
        )
        SELECT * FROM stats
      `;

      const result = await this.pool.query(query, [groupId]);
      const row = result.rows[0];

      return {
        totalTokensIssued: parseFloat(row.total_issued) || 0,
        totalTokensRedeemed: parseFloat(row.total_redeemed) || 0,
        totalTokensCirculating: parseFloat(row.total_issued) - parseFloat(row.total_redeemed) || 0,
        activeMembers: parseInt(row.active_members) || 0,
        totalTransactions: parseInt(row.total_transactions) || 0,
        uniqueCustomers: parseInt(row.unique_customers) || 0,
        averageTransactionSize: parseFloat(row.avg_transaction) || 0,
        tokensIssuedLast30Days: parseFloat(row.issued_30d) || 0,
        tokensRedeemedLast30Days: parseFloat(row.redeemed_30d) || 0
      };
    } catch (error) {
      logger.error('Error fetching group analytics:', error);
      throw error;
    }
  }

  async getMemberActivityStats(groupId: string): Promise<Array<{
    shopId: string;
    shopName: string;
    tokensIssued: number;
    tokensRedeemed: number;
    netContribution: number;
    transactionCount: number;
    uniqueCustomers: number;
    lastActivity: Date | null;
    joinedAt: Date;
  }>> {
    try {
      const query = `
        SELECT
          sgm.shop_id,
          s.name as shop_name,
          sgm.joined_at,
          COALESCE(SUM(CASE WHEN gtt.type = 'earn' THEN gtt.amount ELSE 0 END), 0) as tokens_issued,
          COALESCE(SUM(CASE WHEN gtt.type = 'redeem' THEN gtt.amount ELSE 0 END), 0) as tokens_redeemed,
          COUNT(gtt.id) as transaction_count,
          COUNT(DISTINCT gtt.customer_address) as unique_customers,
          MAX(gtt.created_at) as last_activity
        FROM affiliate_shop_group_members sgm
        JOIN shops s ON sgm.shop_id = s.shop_id
        LEFT JOIN affiliate_group_token_transactions gtt ON sgm.shop_id = gtt.shop_id AND sgm.group_id = gtt.group_id
        WHERE sgm.group_id = $1 AND sgm.status = 'active'
        GROUP BY sgm.shop_id, s.name, sgm.joined_at
        ORDER BY tokens_issued DESC
      `;

      const result = await this.pool.query(query, [groupId]);

      return result.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        tokensIssued: parseFloat(row.tokens_issued) || 0,
        tokensRedeemed: parseFloat(row.tokens_redeemed) || 0,
        netContribution: (parseFloat(row.tokens_issued) || 0) - (parseFloat(row.tokens_redeemed) || 0),
        transactionCount: parseInt(row.transaction_count) || 0,
        uniqueCustomers: parseInt(row.unique_customers) || 0,
        lastActivity: row.last_activity ? new Date(row.last_activity) : null,
        joinedAt: new Date(row.joined_at)
      }));
    } catch (error) {
      logger.error('Error fetching member activity stats:', error);
      throw error;
    }
  }

  async getTransactionTrends(groupId: string, days: number = 30): Promise<Array<{
    date: string;
    tokensIssued: number;
    tokensRedeemed: number;
    transactionCount: number;
  }>> {
    try {
      const query = `
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(CASE WHEN type = 'earn' THEN amount ELSE 0 END), 0) as tokens_issued,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as tokens_redeemed,
          COUNT(*) as transaction_count
        FROM affiliate_group_token_transactions
        WHERE group_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const result = await this.pool.query(query, [groupId]);

      return result.rows.map(row => ({
        date: row.date,
        tokensIssued: parseFloat(row.tokens_issued) || 0,
        tokensRedeemed: parseFloat(row.tokens_redeemed) || 0,
        transactionCount: parseInt(row.transaction_count) || 0
      }));
    } catch (error) {
      logger.error('Error fetching transaction trends:', error);
      throw error;
    }
  }

  // ==================== RCN ALLOCATION ====================

  /**
   * Get shop's RCN allocation for a specific group
   */
  async getShopGroupRcnAllocation(shopId: string, groupId: string): Promise<ShopGroupRcnAllocation | null> {
    try {
      const query = `
        SELECT * FROM shop_group_rcn_allocations
        WHERE shop_id = $1 AND group_id = $2
      `;

      const result = await this.pool.query(query, [shopId, groupId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        shopId: row.shop_id,
        groupId: row.group_id,
        allocatedRcn: parseFloat(row.allocated_rcn),
        usedRcn: parseFloat(row.used_rcn),
        availableRcn: parseFloat(row.available_rcn),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Error getting shop group RCN allocation:', error);
      throw error;
    }
  }

  /**
   * Allocate RCN from shop's main balance to a group
   */
  async allocateRcnToGroup(shopId: string, groupId: string, amount: number): Promise<ShopGroupRcnAllocation> {
    try {
      const query = `
        INSERT INTO shop_group_rcn_allocations (shop_id, group_id, allocated_rcn, used_rcn)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (shop_id, group_id)
        DO UPDATE SET
          allocated_rcn = shop_group_rcn_allocations.allocated_rcn + EXCLUDED.allocated_rcn,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await this.pool.query(query, [shopId, groupId, amount]);
      const row = result.rows[0];

      return {
        shopId: row.shop_id,
        groupId: row.group_id,
        allocatedRcn: parseFloat(row.allocated_rcn),
        usedRcn: parseFloat(row.used_rcn),
        availableRcn: parseFloat(row.available_rcn),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Error allocating RCN to group:', error);
      throw error;
    }
  }

  /**
   * Deallocate RCN from a group back to shop's main balance
   */
  async deallocateRcnFromGroup(shopId: string, groupId: string, amount: number): Promise<ShopGroupRcnAllocation> {
    try {
      const query = `
        UPDATE shop_group_rcn_allocations
        SET
          allocated_rcn = allocated_rcn - $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1 AND group_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [shopId, groupId, amount]);

      if (result.rows.length === 0) {
        throw new Error('No allocation found for this shop and group');
      }

      const row = result.rows[0];
      return {
        shopId: row.shop_id,
        groupId: row.group_id,
        allocatedRcn: parseFloat(row.allocated_rcn),
        usedRcn: parseFloat(row.used_rcn),
        availableRcn: parseFloat(row.available_rcn),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Error deallocating RCN from group:', error);
      throw error;
    }
  }

  /**
   * Update used RCN when issuing/redeeming group tokens
   */
  async updateUsedRcn(shopId: string, groupId: string, delta: number): Promise<void> {
    try {
      const query = `
        UPDATE shop_group_rcn_allocations
        SET
          used_rcn = used_rcn + $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1 AND group_id = $2
      `;

      await this.pool.query(query, [shopId, groupId, delta]);
    } catch (error) {
      logger.error('Error updating used RCN:', error);
      throw error;
    }
  }

  /**
   * Get all RCN allocations for a shop
   */
  async getShopRcnAllocations(shopId: string): Promise<ShopGroupRcnAllocation[]> {
    try {
      const query = `
        SELECT * FROM shop_group_rcn_allocations
        WHERE shop_id = $1
        ORDER BY updated_at DESC
      `;

      const result = await this.pool.query(query, [shopId]);

      return result.rows.map(row => ({
        shopId: row.shop_id,
        groupId: row.group_id,
        allocatedRcn: parseFloat(row.allocated_rcn),
        usedRcn: parseFloat(row.used_rcn),
        availableRcn: parseFloat(row.available_rcn),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Error getting shop RCN allocations:', error);
      throw error;
    }
  }
}
