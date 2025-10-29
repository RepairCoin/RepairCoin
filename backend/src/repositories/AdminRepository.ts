import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export interface AdminActivity {
  id: number;
  adminAddress: string;
  actionType: string;
  actionDescription: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
}

export interface UnsuspendRequest {
  id: number;
  entityType: 'customer' | 'shop';
  entityId: string;
  requestReason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface Alert {
  id: number;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface Admin {
  id: number;
  walletAddress: string;
  name?: string;
  email?: string;
  role?: string;
  permissions: string[];
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastLogin?: string;
  metadata?: any;
}

export class AdminRepository extends BaseRepository {
  // Admin Activity Logging
  async logAdminActivity(activity: Omit<AdminActivity, 'id' | 'createdAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO admin_activity_logs (
          admin_address, action_type, action_description,
          entity_type, entity_id, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await this.pool.query(query, [
        activity.adminAddress.toLowerCase(),
        activity.actionType,
        activity.actionDescription,
        activity.entityType,
        activity.entityId,
        JSON.stringify(activity.metadata || {})
      ]);
      
      logger.info('Admin activity logged', {
        admin: activity.adminAddress,
        action: activity.actionType
      });
    } catch (error) {
      logger.error('Error logging admin activity:', error);
      // Don't throw - logging shouldn't break operations
    }
  }

  async getAdminActivityLogs(
    filters: {
      adminAddress?: string;
      actionType?: string;
      entityType?: string;
      startDate?: string;
      endDate?: string;
      page: number;
      limit: number;
    }
  ): Promise<PaginatedResult<AdminActivity>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.adminAddress) {
        paramCount++;
        whereClause += ` AND admin_address = $${paramCount}`;
        params.push(filters.adminAddress.toLowerCase());
      }

      if (filters.actionType) {
        paramCount++;
        whereClause += ` AND action_type = $${paramCount}`;
        params.push(filters.actionType);
      }

      if (filters.entityType) {
        paramCount++;
        whereClause += ` AND entity_type = $${paramCount}`;
        params.push(filters.entityType);
      }

      if (filters.startDate) {
        paramCount++;
        whereClause += ` AND created_at >= $${paramCount}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereClause += ` AND created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM admin_activity_logs ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT * FROM admin_activity_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const activities = result.rows.map(row => ({
        id: row.id,
        adminAddress: row.admin_address,
        actionType: row.action_type,
        actionDescription: row.action_description,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at
      }));

      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: activities,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting admin activity logs:', error);
      throw new Error('Failed to get admin activity logs');
    }
  }

  // Unsuspend Requests
  async createUnsuspendRequest(data: {
    entityType: 'customer' | 'shop';
    entityId: string;
    requestReason: string;
    status: 'pending' | 'approved' | 'rejected';
  }): Promise<UnsuspendRequest> {
    try {
      const result = await this.pool.query(`
        INSERT INTO unsuspend_requests (
          entity_type, entity_id, request_reason, status, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [data.entityType, data.entityId, data.requestReason, data.status]);
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error creating unsuspend request:', error);
      throw new Error('Failed to create unsuspend request');
    }
  }

  async getUnsuspendRequests(filters: {
    status?: string;
    entityType?: string;
  }): Promise<UnsuspendRequest[]> {
    try {
      let query = 'SELECT * FROM unsuspend_requests WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.entityType) {
        paramCount++;
        query += ` AND entity_type = $${paramCount}`;
        params.push(filters.entityType);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.pool.query(query, params);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting unsuspend requests:', error);
      throw new Error('Failed to get unsuspend requests');
    }
  }

  async getUnsuspendRequest(id: number): Promise<UnsuspendRequest | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM unsuspend_requests WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting unsuspend request:', error);
      throw new Error('Failed to get unsuspend request');
    }
  }

  async updateUnsuspendRequest(id: number, updates: {
    status?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
  }): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.status !== undefined) {
        paramCount++;
        fields.push(`status = $${paramCount}`);
        values.push(updates.status);
      }

      if (updates.reviewedAt !== undefined) {
        paramCount++;
        fields.push(`reviewed_at = $${paramCount}`);
        values.push(updates.reviewedAt);
      }

      if (updates.reviewedBy !== undefined) {
        paramCount++;
        fields.push(`reviewed_by = $${paramCount}`);
        values.push(updates.reviewedBy);
      }

      if (updates.reviewNotes !== undefined) {
        paramCount++;
        fields.push(`review_notes = $${paramCount}`);
        values.push(updates.reviewNotes);
      }

      if (fields.length === 0) {
        return;
      }

      paramCount++;
      values.push(id);

      const query = `
        UPDATE unsuspend_requests 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
      `;

      await this.pool.query(query, values);
    } catch (error) {
      logger.error('Error updating unsuspend request:', error);
      throw new Error('Failed to update unsuspend request');
    }
  }

  // Alert Management
  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'acknowledged' | 'acknowledgedBy' | 'acknowledgedAt'>): Promise<void> {
    try {
      const query = `
        INSERT INTO admin_alerts (
          alert_type, severity, title, message, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await this.pool.query(query, [
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        JSON.stringify(alert.metadata || {})
      ]);
      
      logger.info('Alert created', {
        type: alert.alertType,
        severity: alert.severity
      });
    } catch (error) {
      logger.error('Error creating alert:', error);
      // Don't throw - alerting shouldn't break operations
    }
  }


  async acknowledgeAlert(id: number, adminAddress: string): Promise<void> {
    try {
      const query = `
        UPDATE admin_alerts 
        SET is_read = true, 
            read_by = $1, 
            read_at = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(query, [adminAddress.toLowerCase(), id]);
      logger.info('Alert acknowledged', { id, admin: adminAddress });
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw new Error('Failed to acknowledge alert');
    }
  }

  // Platform Statistics
  async getPlatformStatistics(): Promise<{
    totalTokensIssued: number;
    totalRedemptions: number;
  }> {
    try {
      const query = `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as total_tokens_issued,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redemptions
        FROM transactions
        WHERE status = 'confirmed'
      `;

      const result = await this.pool.query(query);
      const row = result.rows[0];

      return {
        totalTokensIssued: parseFloat(row.total_tokens_issued),
        totalRedemptions: parseFloat(row.total_redemptions)
      };
    } catch (error) {
      logger.error('Error getting platform statistics:', error);
      throw new Error('Failed to get platform statistics');
    }
  }

  /**
   * Get comprehensive platform statistics from materialized view
   * This method queries the platform_statistics materialized view for better performance
   */
  async getPlatformStatisticsFromView(): Promise<{
    tokenStats: {
      totalRcnMinted: number;
      totalRcnRedeemed: number;
      totalRcnCirculating: number;
    };
    userStats: {
      totalActiveCustomers: number;
      customersBronze: number;
      customersSilver: number;
      customersGold: number;
    };
    shopStats: {
      totalActiveShops: number;
      shopsWithSubscription: number;
    };
    revenueStats: {
      totalRevenue: number;
      revenueLast30Days: number;
    };
    transactionStats: {
      totalTransactions: number;
      transactionsLast24h: number;
    };
    referralStats: {
      totalReferrals: number;
      totalReferralRewards: number;
    };
    lastUpdated: Date;
  }> {
    try {
      const query = `SELECT * FROM platform_statistics`;
      const result = await this.pool.query(query);

      if (result.rows.length === 0) {
        throw new Error('Platform statistics view is empty');
      }

      const row = result.rows[0];

      return {
        tokenStats: {
          totalRcnMinted: parseFloat(row.total_rcn_minted || 0),
          totalRcnRedeemed: parseFloat(row.total_rcn_redeemed || 0),
          totalRcnCirculating: parseFloat(row.total_rcn_circulating || 0)
        },
        userStats: {
          totalActiveCustomers: parseInt(row.total_active_customers || 0),
          customersBronze: parseInt(row.customers_bronze || 0),
          customersSilver: parseInt(row.customers_silver || 0),
          customersGold: parseInt(row.customers_gold || 0)
        },
        shopStats: {
          totalActiveShops: parseInt(row.total_active_shops || 0),
          shopsWithSubscription: parseInt(row.shops_with_subscription || 0)
        },
        revenueStats: {
          totalRevenue: parseFloat(row.total_revenue || 0),
          revenueLast30Days: parseFloat(row.revenue_last_30_days || 0)
        },
        transactionStats: {
          totalTransactions: parseInt(row.total_transactions || 0),
          transactionsLast24h: parseInt(row.transactions_last_24h || 0)
        },
        referralStats: {
          totalReferrals: parseInt(row.total_referrals || 0),
          totalReferralRewards: parseFloat(row.total_referral_rewards || 0)
        },
        lastUpdated: row.last_updated
      };
    } catch (error) {
      logger.error('Error getting platform statistics from view:', error);
      throw new Error('Failed to get platform statistics from view');
    }
  }

  /**
   * Refresh the platform statistics materialized view
   */
  async refreshPlatformStatistics(): Promise<void> {
    try {
      await this.pool.query('SELECT refresh_platform_statistics()');
      logger.info('Platform statistics view refreshed');
    } catch (error) {
      logger.error('Error refreshing platform statistics:', error);
      throw new Error('Failed to refresh platform statistics');
    }
  }

  // Token Circulation Metrics
  async getTokenCirculationMetrics(): Promise<{
    totalSupply: number;
    totalInCirculation: number;
    totalRedeemed: number;
    shopBalances: Array<{
      shopId: string;
      shopName: string;
      balance: number;
      tokensIssued: number;
      redemptionsProcessed: number;
    }>;
    customerBalances: {
      totalCustomerBalance: number;
      averageBalance: number;
      activeCustomers: number;
    };
    dailyActivity: Array<{
      date: string;
      minted: number;
      redeemed: number;
      netFlow: number;
    }>;
  }> {
    try {
      // Get shop balances and activity
      const shopQuery = `
        SELECT 
          s.shop_id,
          s.name as shop_name,
          COALESCE(s.total_tokens_issued, 0) as tokens_issued,
          COALESCE(s.total_redemptions, 0) as redemptions_processed,
          COALESCE(
            (SELECT SUM(amount) FROM transactions WHERE shop_id = s.shop_id AND type = 'mint' AND status = 'confirmed'),
            0
          ) - COALESCE(
            (SELECT SUM(amount) FROM transactions WHERE shop_id = s.shop_id AND type = 'redeem' AND status = 'confirmed'),
            0
          ) as balance
        FROM shops s
        WHERE s.active = true
        ORDER BY tokens_issued DESC
      `;

      // Get customer balance statistics
      const customerQuery = `
        SELECT 
          COUNT(*) as active_customers,
          COALESCE(SUM(c.lifetime_earnings), 0) as total_earnings,
          COALESCE(AVG(c.lifetime_earnings), 0) as average_balance
        FROM customers c
        WHERE c.is_active = true
      `;

      // Get daily activity for last 30 days
      const dailyQuery = `
        SELECT 
          DATE(timestamp) as date,
          COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as minted,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as redeemed
        FROM transactions
        WHERE status = 'confirmed' 
          AND timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `;

      // Get total supply metrics
      const supplyQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END), 0) as total_minted,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END), 0) as total_redeemed
        FROM transactions
        WHERE status = 'confirmed'
      `;

      const [shopResult, customerResult, dailyResult, supplyResult] = await Promise.all([
        this.pool.query(shopQuery),
        this.pool.query(customerQuery),
        this.pool.query(dailyQuery),
        this.pool.query(supplyQuery)
      ]);

      const shopBalances = shopResult.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        balance: parseFloat(row.balance),
        tokensIssued: parseFloat(row.tokens_issued),
        redemptionsProcessed: parseFloat(row.redemptions_processed)
      }));

      const customerStats = customerResult.rows[0];
      const customerBalances = {
        totalCustomerBalance: parseFloat(customerStats.total_earnings),
        averageBalance: parseFloat(customerStats.average_balance),
        activeCustomers: parseInt(customerStats.active_customers)
      };

      const dailyActivity = dailyResult.rows.map(row => ({
        date: row.date,
        minted: parseFloat(row.minted),
        redeemed: parseFloat(row.redeemed),
        netFlow: parseFloat(row.minted) - parseFloat(row.redeemed)
      }));

      const supplyStats = supplyResult.rows[0];
      const totalMinted = parseFloat(supplyStats.total_minted);
      const totalRedeemed = parseFloat(supplyStats.total_redeemed);

      return {
        totalSupply: totalMinted,
        totalInCirculation: totalMinted - totalRedeemed,
        totalRedeemed,
        shopBalances,
        customerBalances,
        dailyActivity
      };
    } catch (error) {
      logger.error('Error getting token circulation metrics:', error);
      throw new Error('Failed to get token circulation metrics');
    }
  }

  // Shop Performance Rankings
  async getShopPerformanceRankings(limit: number = 10): Promise<Array<{
    shopId: string;
    shopName: string;
    tokensIssued: number;
    redemptionsProcessed: number;
    activeCustomers: number;
    averageTransactionValue: number;
    customerRetention: number;
    performanceScore: number;
    lastActivity: string;
    tier: 'Standard' | 'Premium' | 'Elite';
  }>> {
    try {
      const query = `
        WITH shop_metrics AS (
          SELECT 
            s.shop_id,
            s.name as shop_name,
            s.total_tokens_issued,
            s.total_redemptions,
            s.last_activity,
            -- Count unique customers who earned tokens
            COUNT(DISTINCT CASE WHEN t.type = 'mint' THEN t.customer_address END) as active_customers,
            -- Average transaction value
            COALESCE(AVG(CASE WHEN t.type = 'mint' THEN t.amount END), 0) as avg_transaction_value,
            -- Customer retention (customers who both earned and redeemed)
            COUNT(DISTINCT CASE WHEN t.type = 'redeem' THEN t.customer_address END) as redeeming_customers,
            -- Recent activity score (last 30 days)
            COUNT(CASE WHEN t.timestamp >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_transactions
          FROM shops s
          LEFT JOIN transactions t ON s.shop_id = t.shop_id AND t.status = 'confirmed'
          WHERE s.active = true
          GROUP BY s.shop_id, s.name, s.total_tokens_issued, s.total_redemptions, s.last_activity
        ),
        shop_rankings AS (
          SELECT 
            *,
            -- Calculate retention rate
            CASE 
              WHEN active_customers > 0 THEN (redeeming_customers::float / active_customers::float) * 100
              ELSE 0
            END as retention_rate,
            -- Performance score calculation (weighted)
            (
              (total_tokens_issued * 0.3) +
              (active_customers * 0.25) +
              (avg_transaction_value * 0.2) +
              (recent_transactions * 0.15) +
              (CASE WHEN active_customers > 0 THEN (redeeming_customers::float / active_customers::float) * 100 ELSE 0 END * 0.1)
            ) as performance_score
          FROM shop_metrics
        )
        SELECT 
          shop_id,
          shop_name,
          total_tokens_issued as tokens_issued,
          total_redemptions as redemptions_processed,
          active_customers,
          avg_transaction_value as average_transaction_value,
          retention_rate as customer_retention,
          performance_score,
          last_activity,
          -- Determine tier based on tokens issued and activity
          CASE 
            WHEN total_tokens_issued >= 200000 AND active_customers >= 100 THEN 'Elite'
            WHEN total_tokens_issued >= 50000 AND active_customers >= 25 THEN 'Premium'
            ELSE 'Standard'
          END as tier
        FROM shop_rankings
        ORDER BY performance_score DESC
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        tokensIssued: parseFloat(row.tokens_issued),
        redemptionsProcessed: parseFloat(row.redemptions_processed),
        activeCustomers: parseInt(row.active_customers),
        averageTransactionValue: parseFloat(row.average_transaction_value),
        customerRetention: parseFloat(row.customer_retention),
        performanceScore: parseFloat(row.performance_score),
        lastActivity: row.last_activity,
        tier: row.tier
      }));
    } catch (error) {
      logger.error('Error getting shop performance rankings:', error);
      throw new Error('Failed to get shop performance rankings');
    }
  }

  // Enhanced Alert Management
  async getAlerts(filters: {
    unreadOnly?: boolean;
    severity?: string;
    alertType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: Alert[]; total: number }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.unreadOnly) {
        paramCount++;
        whereClause += ` AND is_read = $${paramCount}`;
        params.push(false);
      }

      if (filters.severity) {
        paramCount++;
        whereClause += ` AND severity = $${paramCount}`;
        params.push(filters.severity);
      }

      if (filters.alertType) {
        paramCount++;
        whereClause += ` AND alert_type = $${paramCount}`;
        params.push(filters.alertType);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM admin_alerts ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Get alerts with pagination
      let query = `SELECT * FROM admin_alerts ${whereClause} ORDER BY created_at DESC`;
      
      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await this.pool.query(query, params);
      
      const alerts = result.rows.map(row => ({
        id: row.id,
        alertType: row.alert_type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        metadata: row.metadata,
        acknowledged: row.is_read,
        acknowledgedBy: row.read_by,
        acknowledgedAt: row.read_at,
        createdAt: row.created_at
      }));

      return { alerts, total };
    } catch (error) {
      logger.error('Error getting alerts:', error);
      throw new Error('Failed to get alerts');
    }
  }

  async markAlertAsRead(alertId: number): Promise<void> {
    try {
      const query = `
        UPDATE admin_alerts 
        SET is_read = true, read_at = NOW()
        WHERE id = $1
      `;
      
      await this.pool.query(query, [alertId]);
      logger.info('Alert marked as read', { alertId });
    } catch (error) {
      logger.error('Error marking alert as read:', error);
      throw new Error('Failed to mark alert as read');
    }
  }

  async resolveAlert(alertId: number, adminAddress: string): Promise<void> {
    try {
      const query = `
        UPDATE admin_alerts 
        SET is_resolved = true, 
            resolved_at = NOW(),
            is_read = true,
            read_by = $1,
            read_at = NOW()
        WHERE id = $2
      `;
      
      await this.pool.query(query, [adminAddress.toLowerCase(), alertId]);
      logger.info('Alert resolved', { alertId, admin: adminAddress });
    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw new Error('Failed to resolve alert');
    }
  }

  // Monitoring Checks
  async checkOperationalHealth(): Promise<void> {
    try {
      // Check for failed minting transactions in last 24 hours
      const failedMintsQuery = `
        SELECT COUNT(*) as failed_count,
               COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_failures
        FROM transactions
        WHERE type = 'mint' 
          AND status = 'failed'
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `;
      
      const failedResult = await this.pool.query(failedMintsQuery);
      const failedCount = parseInt(failedResult.rows[0].failed_count);
      const recentFailures = parseInt(failedResult.rows[0].recent_failures);
      
      if (failedCount > 5) {
        await this.createAlert({
          alertType: 'minting_failures',
          severity: recentFailures > 2 ? 'critical' : 'high',
          title: 'Minting Transaction Failures',
          message: `${failedCount} minting transactions failed in last 24 hours (${recentFailures} in last hour)`,
          metadata: {
            failedCount,
            recentFailures,
            checkTime: new Date().toISOString()
          }
        });
      }

      // Check for database vs blockchain token accounting mismatch
      const accountingQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'mint' AND status = 'confirmed' THEN amount ELSE 0 END), 0) as total_minted,
          COALESCE(SUM(c.lifetime_earnings), 0) as total_customer_balance,
          COALESCE(SUM(s.total_tokens_issued), 0) as total_shop_issued
        FROM (SELECT 1) dummy
        CROSS JOIN (SELECT SUM(lifetime_earnings) FROM customers WHERE is_active = true) c
        CROSS JOIN (SELECT SUM(total_tokens_issued) FROM shops WHERE active = true) s
        CROSS JOIN (
          SELECT SUM(CASE WHEN type = 'mint' AND status = 'confirmed' THEN amount ELSE 0 END) 
          FROM transactions
        ) t
      `;
      
      const accountingResult = await this.pool.query(accountingQuery);
      const row = accountingResult.rows[0];
      const totalMinted = parseFloat(row.total_minted || 0);
      const totalCustomerBalance = parseFloat(row.total_customer_balance || 0);
      const totalShopIssued = parseFloat(row.total_shop_issued || 0);
      
      // Alert if database promises exceed minted tokens by significant margin
      const discrepancy = Math.abs(totalShopIssued - totalMinted);
      const discrepancyPercent = totalMinted > 0 ? (discrepancy / totalMinted) * 100 : 0;
      
      if (discrepancyPercent > 10 && discrepancy > 100) {
        await this.createAlert({
          alertType: 'token_accounting_mismatch',
          severity: 'high',
          title: 'Token Accounting Discrepancy',
          message: `Database token records don't match blockchain: ${discrepancy.toFixed(2)} RCN difference (${discrepancyPercent.toFixed(1)}%)`,
          metadata: {
            totalMinted,
            totalShopIssued,
            totalCustomerBalance,
            discrepancy,
            discrepancyPercent,
            checkTime: new Date().toISOString()
          }
        });
      }

      // Check for high withdrawal demand (pending mint requests)
      const pendingWithdrawalsQuery = `
        SELECT COUNT(*) as pending_count,
               SUM(amount) as pending_amount
        FROM transactions
        WHERE type = 'mint' 
          AND status = 'pending'
          AND timestamp >= NOW() - INTERVAL '2 hours'
      `;
      
      const pendingResult = await this.pool.query(pendingWithdrawalsQuery);
      const pendingCount = parseInt(pendingResult.rows[0].pending_count || 0);
      const pendingAmount = parseFloat(pendingResult.rows[0].pending_amount || 0);
      
      if (pendingCount > 10 || pendingAmount > 5000) {
        await this.createAlert({
          alertType: 'high_withdrawal_demand',
          severity: pendingCount > 25 ? 'high' : 'medium',
          title: 'High Withdrawal Demand',
          message: `${pendingCount} pending withdrawals (${pendingAmount.toFixed(2)} RCN) - potential bottleneck`,
          metadata: {
            pendingCount,
            pendingAmount,
            checkTime: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      logger.error('Error checking operational health:', error);
    }
  }

  async checkPendingApplications(): Promise<void> {
    try {
      // Check for shops pending approval for more than 7 days
      const query = `
        SELECT COUNT(*) as pending_count
        FROM shops
        WHERE verified = false 
          AND active = true 
          AND join_date < NOW() - INTERVAL '7 days'
      `;
      
      const result = await this.pool.query(query);
      const pendingCount = parseInt(result.rows[0].pending_count);
      
      if (pendingCount > 0) {
        await this.createAlert({
          alertType: 'pending_applications',
          severity: 'medium',
          title: 'Pending Shop Applications',
          message: `${pendingCount} shop applications have been pending for more than 7 days`,
          metadata: {
            pendingCount,
            checkTime: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('Error checking pending applications:', error);
    }
  }

  async checkUnusualActivity(): Promise<void> {
    try {
      // Check for unusual large transactions (>1000 RCN) in last 24 hours
      const largeTransactionQuery = `
        SELECT COUNT(*) as large_transaction_count,
               MAX(amount) as largest_amount
        FROM transactions
        WHERE amount > 1000 
          AND timestamp >= NOW() - INTERVAL '24 hours'
          AND status = 'confirmed'
      `;
      
      // Check for rapid consecutive transactions from same customer
      const rapidTransactionQuery = `
        SELECT customer_address, COUNT(*) as transaction_count
        FROM transactions
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
          AND status = 'confirmed'
        GROUP BY customer_address
        HAVING COUNT(*) > 10
      `;

      const [largeResult, rapidResult] = await Promise.all([
        this.pool.query(largeTransactionQuery),
        this.pool.query(rapidTransactionQuery)
      ]);

      const largeTransactionCount = parseInt(largeResult.rows[0].large_transaction_count);
      const largestAmount = parseFloat(largeResult.rows[0].largest_amount || 0);
      
      if (largeTransactionCount > 0) {
        await this.createAlert({
          alertType: 'unusual_large_transactions',
          severity: 'high',
          title: 'Unusual Large Transactions Detected',
          message: `${largeTransactionCount} large transactions (>1000 RCN) detected in last 24 hours. Largest: ${largestAmount.toFixed(2)} RCN`,
          metadata: {
            transactionCount: largeTransactionCount,
            largestAmount,
            checkTime: new Date().toISOString()
          }
        });
      }

      if (rapidResult.rows.length > 0) {
        const suspiciousCustomers = rapidResult.rows.map(row => ({
          address: row.customer_address,
          count: parseInt(row.transaction_count)
        }));

        await this.createAlert({
          alertType: 'rapid_transactions',
          severity: 'medium',
          title: 'Rapid Transaction Activity Detected',
          message: `${suspiciousCustomers.length} customers with >10 transactions in last hour`,
          metadata: {
            suspiciousCustomers,
            checkTime: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('Error checking unusual activity:', error);
    }
  }

  async checkSmartContractHealth(): Promise<void> {
    try {
      // This would typically check:
      // 1. Contract pause state
      // 2. Recent contract interactions
      // 3. Gas price monitoring
      // For now, we'll create a placeholder check
      
      // Check if contract interactions have failed recently
      const contractFailuresQuery = `
        SELECT COUNT(*) as failure_count
        FROM transactions
        WHERE status = 'failed'
          AND timestamp >= NOW() - INTERVAL '6 hours'
          AND transaction_hash IS NOT NULL
      `;
      
      const result = await this.pool.query(contractFailuresQuery);
      const failureCount = parseInt(result.rows[0].failure_count || 0);
      
      if (failureCount > 3) {
        await this.createAlert({
          alertType: 'contract_health_issues',
          severity: 'high',
          title: 'Smart Contract Health Issues',
          message: `${failureCount} blockchain transactions failed in last 6 hours - possible contract or network issues`,
          metadata: {
            failureCount,
            checkTime: new Date().toISOString()
          }
        });
      }

      // Check for stuck transactions (pending too long)
      const stuckTransactionsQuery = `
        SELECT COUNT(*) as stuck_count,
               MIN(timestamp) as oldest_pending
        FROM transactions
        WHERE status = 'pending'
          AND timestamp < NOW() - INTERVAL '30 minutes'
          AND transaction_hash IS NOT NULL
      `;
      
      const stuckResult = await this.pool.query(stuckTransactionsQuery);
      const stuckCount = parseInt(stuckResult.rows[0].stuck_count || 0);
      
      if (stuckCount > 0) {
        await this.createAlert({
          alertType: 'stuck_transactions',
          severity: stuckCount > 5 ? 'high' : 'medium',
          title: 'Stuck Blockchain Transactions',
          message: `${stuckCount} transactions pending for >30 minutes - possible network congestion`,
          metadata: {
            stuckCount,
            oldestPending: stuckResult.rows[0].oldest_pending,
            checkTime: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      logger.error('Error checking smart contract health:', error);
    }
  }

  // Admin Management Methods
  async createAdmin(adminData: {
    walletAddress: string;
    name?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    isSuperAdmin?: boolean;
    createdBy?: string;
  }): Promise<Admin> {
    try {
      // Format wallet address properly with checksummed format
      const formattedAddress = this.formatWalletAddress(adminData.walletAddress);
      
      // Determine role based on isSuperAdmin flag or provided role
      let role = adminData.role;
      if (adminData.isSuperAdmin) {
        role = 'super_admin';
      } else if (!role) {
        role = 'admin'; // Default role
      }
      
      const query = `
        INSERT INTO admins (
          wallet_address, name, email, role, permissions, 
          is_super_admin, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        formattedAddress,
        adminData.name,
        adminData.email,
        role,
        JSON.stringify(adminData.permissions || []),
        adminData.isSuperAdmin || false,
        adminData.createdBy === 'SYSTEM' ? 'SYSTEM' : (adminData.createdBy ? this.formatWalletAddress(adminData.createdBy) : null)
      ]);
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Admin with this wallet address already exists');
      }
      logger.error('Error creating admin:', error);
      throw new Error('Failed to create admin');
    }
  }

  async getAdmin(walletAddress: string): Promise<Admin | null> {
    try {
      const query = `
        SELECT * FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error getting admin:', error);
      throw new Error('Failed to get admin');
    }
  }

  async getAllAdmins(): Promise<Admin[]> {
    try {
      const query = `
        SELECT * FROM admins 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapAdminFromDb(row));
    } catch (error) {
      logger.error('Error getting all admins:', error);
      throw new Error('Failed to get admins');
    }
  }

  async updateAdmin(walletAddress: string, updates: {
    name?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    isActive?: boolean;
    isSuperAdmin?: boolean;
    lastLogin?: string;
    metadata?: any;
  }): Promise<Admin | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (updates.name !== undefined) {
        paramCount++;
        fields.push(`name = $${paramCount}`);
        values.push(updates.name);
      }

      if (updates.email !== undefined) {
        paramCount++;
        fields.push(`email = $${paramCount}`);
        values.push(updates.email);
      }

      if (updates.role !== undefined) {
        paramCount++;
        fields.push(`role = $${paramCount}`);
        values.push(updates.role);
        
        // Only update is_super_admin based on role if it wasn't explicitly set
        if (updates.isSuperAdmin === undefined) {
          if (updates.role === 'super_admin') {
            paramCount++;
            fields.push(`is_super_admin = $${paramCount}`);
            values.push(true);
          } else {
            paramCount++;
            fields.push(`is_super_admin = $${paramCount}`);
            values.push(false);
          }
        }
      }

      if (updates.permissions !== undefined) {
        paramCount++;
        fields.push(`permissions = $${paramCount}`);
        values.push(JSON.stringify(updates.permissions));
      }

      if (updates.isActive !== undefined) {
        paramCount++;
        fields.push(`is_active = $${paramCount}`);
        values.push(updates.isActive);
      }

      if (updates.isSuperAdmin !== undefined) {
        paramCount++;
        fields.push(`is_super_admin = $${paramCount}`);
        values.push(updates.isSuperAdmin);
      }

      if (updates.lastLogin !== undefined) {
        paramCount++;
        fields.push(`last_login = $${paramCount}`);
        values.push(updates.lastLogin);
      }

      if (updates.metadata !== undefined) {
        paramCount++;
        fields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (fields.length === 0) {
        return this.getAdmin(walletAddress);
      }

      paramCount++;
      values.push(walletAddress.trim());

      const query = `
        UPDATE admins 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE LOWER(wallet_address) = LOWER($${paramCount})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapAdminFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error updating admin:', error);
      throw new Error('Failed to update admin');
    }
  }

  async deleteAdmin(walletAddress: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1)
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting admin:', error);
      throw new Error('Failed to delete admin');
    }
  }

  async getAdminByWalletAddress(walletAddress: string): Promise<Admin | null> {
    try {
      const query = `
        SELECT 
          id,
          wallet_address as "walletAddress",
          name,
          email,
          role,
          permissions,
          is_active as "isActive",
          is_super_admin as "isSuperAdmin",
          created_at as "createdAt",
          last_login as "lastLogin",
          updated_at as "updatedAt"
        FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1) AND is_active = true
      `;
      
      const result = await this.pool.query(query, [walletAddress.trim()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      // Ensure role is set
      row.role = row.role || (row.isSuperAdmin ? 'super_admin' : 'admin');
      
      return row;
    } catch (error) {
      logger.error('Error getting admin by wallet address:', error);
      return null;
    }
  }

  async isAdmin(walletAddress: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM admins 
        WHERE LOWER(wallet_address) = LOWER($1) AND is_active = true
      `;
      
      const result = await this.pool.query(query, [walletAddress]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  async updateAdminLastLogin(walletAddress: string): Promise<void> {
    try {
      const query = `
        UPDATE admins 
        SET last_login = NOW()
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      
      await this.pool.query(query, [walletAddress.trim()]);
    } catch (error) {
      logger.error('Error updating admin last login:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  // Helper method to format wallet address to checksummed format
  private formatWalletAddress(address: string): string {
    // Remove any whitespace
    const cleaned = address.trim();
    
    // Ensure it starts with 0x
    if (!cleaned.startsWith('0x')) {
      throw new Error('Invalid wallet address format: must start with 0x');
    }
    
    // Convert to checksummed address format (preserves case properly)
    // For now, we'll just ensure it's in the right format
    // The proper checksumming would require keccak256 hashing
    const addressPart = cleaned.substring(2);
    if (addressPart.length !== 40) {
      throw new Error('Invalid wallet address format: must be 42 characters long (0x + 40 hex chars)');
    }
    
    // Validate it's all hex characters
    if (!/^[a-fA-F0-9]{40}$/.test(addressPart)) {
      throw new Error('Invalid wallet address format: must contain only hexadecimal characters');
    }
    
    // Return the properly formatted address
    return '0x' + addressPart;
  }

  // Helper method to map database row to Admin interface
  private mapAdminFromDb(row: any): Admin {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      name: row.name,
      email: row.email,
      role: row.role || (row.is_super_admin ? 'super_admin' : 'admin'),
      permissions: row.permissions || [],
      isActive: row.is_active,
      isSuperAdmin: row.is_super_admin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      lastLogin: row.last_login,
      metadata: row.metadata
    };
  }
}