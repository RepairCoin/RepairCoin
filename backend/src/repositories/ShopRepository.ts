import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  reimbursementAddress?: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalReimbursements: number;
  joinDate: string;
  lastActivity: string;
  fixflowShopId?: string;
  location?: string | {
    city?: string;
    state?: string;
    zipCode?: string;
    lat?: number;
    lng?: number;
  };
  suspendedAt?: string;
  suspensionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  purchasedRcnBalance?: number;
  totalRcnPurchased?: number;
}

export interface ShopFilters {
  active?: boolean;
  verified?: boolean;
  crossShopEnabled?: boolean;
}

export class ShopRepository extends BaseRepository {
  async getShop(shopId: string): Promise<ShopData | null> {
    try {
      const query = 'SELECT * FROM shops WHERE shop_id = $1';
      const result = await this.pool.query(query, [shopId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        shopId: row.shop_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        walletAddress: row.wallet_address,
        reimbursementAddress: row.reimbursement_address,
        verified: row.verified,
        active: row.active,
        crossShopEnabled: row.cross_shop_enabled,
        totalTokensIssued: parseFloat(row.total_tokens_issued || 0),
        totalRedemptions: parseFloat(row.total_redemptions || 0),
        totalReimbursements: parseFloat(row.total_reimbursements || 0),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || 0),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0)
      };
    } catch (error) {
      logger.error('Error fetching shop:', error);
      throw new Error('Failed to fetch shop');
    }
  }

  async createShop(shop: ShopData & { location?: any }): Promise<{ id: string }> {
    try {
      const query = `
        INSERT INTO shops (
          shop_id, name, address, phone, email, wallet_address,
          reimbursement_address, verified, active, cross_shop_enabled,
          total_tokens_issued, total_redemptions, total_reimbursements,
          join_date, last_activity, fixflow_shop_id, 
          location_city, location_state, location_zip_code, location_lat, location_lng
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING shop_id
      `;
      
      const values = [
        shop.shopId,
        shop.name,
        shop.address,
        shop.phone,
        shop.email,
        shop.walletAddress?.toLowerCase(),
        shop.reimbursementAddress?.toLowerCase(),
        shop.verified || false,
        shop.active !== false,
        shop.crossShopEnabled || false,
        shop.totalTokensIssued || 0,
        shop.totalRedemptions || 0,
        shop.totalReimbursements || 0,
        shop.joinDate || new Date().toISOString(),
        shop.lastActivity || new Date().toISOString(),
        shop.fixflowShopId,
        typeof shop.location === 'object' ? shop.location?.city : null,
        typeof shop.location === 'object' ? shop.location?.state : null,
        typeof shop.location === 'object' ? shop.location?.zipCode : null,
        typeof shop.location === 'object' ? shop.location?.lat : null,
        typeof shop.location === 'object' ? shop.location?.lng : null
      ];
      
      const result = await this.pool.query(query, values);
      logger.info('Shop created successfully', { shopId: shop.shopId });
      return { id: result.rows[0].shop_id };
    } catch (error) {
      logger.error('Error creating shop:', error);
      throw new Error('Failed to create shop');
    }
  }

  async updateShop(shopId: string, updates: Partial<ShopData>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      const fieldMappings: { [key: string]: string } = {
        name: 'name',
        address: 'address',
        phone: 'phone',
        email: 'email',
        walletAddress: 'wallet_address',
        reimbursementAddress: 'reimbursement_address',
        verified: 'verified',
        active: 'active',
        crossShopEnabled: 'cross_shop_enabled',
        totalTokensIssued: 'total_tokens_issued',
        totalRedemptions: 'total_redemptions',
        totalReimbursements: 'total_reimbursements',
        lastActivity: 'last_activity',
        fixflowShopId: 'fixflow_shop_id',
        location: 'location',
        suspendedAt: 'suspended_at',
        suspensionReason: 'suspension_reason',
        verifiedAt: 'verified_at',
        verifiedBy: 'verified_by',
        purchasedRcnBalance: 'purchased_rcn_balance',
        totalRcnPurchased: 'total_rcn_purchased'
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && fieldMappings[key]) {
          paramCount++;
          fields.push(`${fieldMappings[key]} = $${paramCount}`);
          
          if (key === 'location' && typeof value === 'object') {
            values.push(JSON.stringify(value));
          } else if (key === 'walletAddress' || key === 'reimbursementAddress') {
            values.push(value ? (value as string).toLowerCase() : null);
          } else {
            values.push(value);
          }
        }
      }

      if (fields.length === 0) {
        return;
      }

      paramCount++;
      values.push(shopId);

      const query = `
        UPDATE shops 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE shop_id = $${paramCount}
      `;

      await this.pool.query(query, values);
      logger.info('Shop updated successfully', { shopId });
    } catch (error) {
      logger.error('Error updating shop:', error);
      throw new Error('Failed to update shop');
    }
  }

  async updateShopAfterTokenIssue(shopId: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE shops 
        SET 
          total_tokens_issued = total_tokens_issued + $1,
          last_activity = NOW(),
          updated_at = NOW()
        WHERE shop_id = $2
      `;
      
      await this.pool.query(query, [amount, shopId]);
      logger.info('Shop token issuance updated', { shopId, amount });
    } catch (error) {
      logger.error('Error updating shop token issuance:', error);
      throw new Error('Failed to update shop token issuance');
    }
  }

  async updateShopAfterRedemption(shopId: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE shops 
        SET 
          total_redemptions = total_redemptions + $1,
          last_activity = NOW(),
          updated_at = NOW()
        WHERE shop_id = $2
      `;
      
      await this.pool.query(query, [amount, shopId]);
      logger.info('Shop redemption updated', { shopId, amount });
    } catch (error) {
      logger.error('Error updating shop redemption:', error);
      throw new Error('Failed to update shop redemption');
    }
  }

  async getShopsPaginated(
    filters: ShopFilters & { page: number; limit: number }
  ): Promise<PaginatedResult<ShopData>> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      if (filters.active !== undefined) {
        paramCount++;
        whereClause += ` AND active = $${paramCount}`;
        params.push(filters.active);
      }

      if (filters.verified !== undefined) {
        paramCount++;
        whereClause += ` AND verified = $${paramCount}`;
        params.push(filters.verified);
      }

      if (filters.crossShopEnabled !== undefined) {
        paramCount++;
        whereClause += ` AND cross_shop_enabled = $${paramCount}`;
        params.push(filters.crossShopEnabled);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM shops ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const offset = this.getPaginationOffset(filters.page, filters.limit);
      paramCount++;
      params.push(filters.limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT * FROM shops 
        ${whereClause}
        ORDER BY join_date DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const shops = result.rows.map(row => ({
        shopId: row.shop_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        walletAddress: row.wallet_address,
        reimbursementAddress: row.reimbursement_address,
        verified: row.verified,
        active: row.active,
        crossShopEnabled: row.cross_shop_enabled,
        totalTokensIssued: parseFloat(row.total_tokens_issued || 0),
        totalRedemptions: parseFloat(row.total_redemptions || 0),
        totalReimbursements: parseFloat(row.total_reimbursements || 0),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || 0),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0)
      }));

      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: shops,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting paginated shops:', error);
      throw new Error('Failed to get shops');
    }
  }

  async getActiveShops(): Promise<ShopData[]> {
    try {
      const query = 'SELECT * FROM shops WHERE active = true AND verified = true';
      const result = await this.pool.query(query);
      
      return result.rows.map(row => ({
        shopId: row.shop_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        walletAddress: row.wallet_address,
        reimbursementAddress: row.reimbursement_address,
        verified: row.verified,
        active: row.active,
        crossShopEnabled: row.cross_shop_enabled,
        totalTokensIssued: parseFloat(row.total_tokens_issued || 0),
        totalRedemptions: parseFloat(row.total_redemptions || 0),
        totalReimbursements: parseFloat(row.total_reimbursements || 0),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || 0),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0)
      }));
    } catch (error) {
      logger.error('Error getting active shops:', error);
      throw new Error('Failed to get active shops');
    }
  }

  async getCrossShopEnabledShops(): Promise<ShopData[]> {
    try {
      const query = `
        SELECT * FROM shops 
        WHERE active = true 
        AND verified = true 
        AND cross_shop_enabled = true
      `;
      const result = await this.pool.query(query);
      
      return result.rows.map(row => ({
        shopId: row.shop_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        walletAddress: row.wallet_address,
        reimbursementAddress: row.reimbursement_address,
        verified: row.verified,
        active: row.active,
        crossShopEnabled: row.cross_shop_enabled,
        totalTokensIssued: parseFloat(row.total_tokens_issued || 0),
        totalRedemptions: parseFloat(row.total_redemptions || 0),
        totalReimbursements: parseFloat(row.total_reimbursements || 0),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || 0),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0)
      }));
    } catch (error) {
      logger.error('Error getting cross-shop enabled shops:', error);
      throw new Error('Failed to get cross-shop enabled shops');
    }
  }

  async getShopByWallet(walletAddress: string): Promise<ShopData | null> {
    try {
      const query = 'SELECT * FROM shops WHERE wallet_address = $1';
      const result = await this.pool.query(query, [walletAddress.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        shopId: row.shop_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        email: row.email,
        walletAddress: row.wallet_address,
        reimbursementAddress: row.reimbursement_address,
        verified: row.verified,
        active: row.active,
        crossShopEnabled: row.cross_shop_enabled,
        totalTokensIssued: parseFloat(row.total_tokens_issued || 0),
        totalRedemptions: parseFloat(row.total_redemptions || 0),
        totalReimbursements: parseFloat(row.total_reimbursements || 0),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || 0),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0)
      };
    } catch (error) {
      logger.error('Error fetching shop by wallet:', error);
      throw new Error('Failed to fetch shop by wallet');
    }
  }

  async getShopAnalytics(shopId: string): Promise<{
    totalCustomersServed: number;
    averageTransactionAmount: number;
    dailyStats: Array<{ date: string; tokensIssued: number; redemptions: number }>;
    topCustomers: Array<{ address: string; totalEarned: number }>;
  }> {
    try {
      // Get customer count
      const customerCountQuery = `
        SELECT COUNT(DISTINCT customer_address) as count
        FROM transactions
        WHERE shop_id = $1 AND type IN ('mint', 'redeem')
      `;
      const customerCountResult = await this.pool.query(customerCountQuery, [shopId]);
      const totalCustomersServed = parseInt(customerCountResult.rows[0].count);

      // Get average transaction
      const avgQuery = `
        SELECT AVG(amount) as avg_amount
        FROM transactions
        WHERE shop_id = $1 AND type = 'mint'
      `;
      const avgResult = await this.pool.query(avgQuery, [shopId]);
      const averageTransactionAmount = parseFloat(avgResult.rows[0].avg_amount || 0);

      // Get daily stats (last 30 days)
      const dailyStatsQuery = `
        SELECT 
          DATE(timestamp) as date,
          SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END) as tokens_issued,
          SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as redemptions
        FROM transactions
        WHERE shop_id = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `;
      const dailyStatsResult = await this.pool.query(dailyStatsQuery, [shopId]);
      const dailyStats = dailyStatsResult.rows.map(row => ({
        date: row.date,
        tokensIssued: parseFloat(row.tokens_issued),
        redemptions: parseFloat(row.redemptions)
      }));

      // Get top customers
      const topCustomersQuery = `
        SELECT 
          customer_address,
          SUM(amount) as total_earned
        FROM transactions
        WHERE shop_id = $1 AND type = 'mint'
        GROUP BY customer_address
        ORDER BY total_earned DESC
        LIMIT 5
      `;
      const topCustomersResult = await this.pool.query(topCustomersQuery, [shopId]);
      const topCustomers = topCustomersResult.rows.map(row => ({
        address: row.customer_address,
        totalEarned: parseFloat(row.total_earned)
      }));

      return {
        totalCustomersServed,
        averageTransactionAmount,
        dailyStats,
        topCustomers
      };
    } catch (error) {
      logger.error('Error getting shop analytics:', error);
      throw new Error('Failed to get shop analytics');
    }
  }

  async getShopTransactions(shopId: string, limit: number = 100): Promise<any[]> {
    try {
      const query = `
        SELECT 
          t.*,
          c.name as customer_name
        FROM transactions t
        LEFT JOIN customers c ON t.customer_address = c.address
        WHERE t.shop_id = $1
        ORDER BY t.timestamp DESC
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [shopId, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        customerAddress: row.customer_address,
        customerName: row.customer_name,
        amount: parseFloat(row.amount),
        reason: row.reason,
        transactionHash: row.transaction_hash,
        timestamp: row.timestamp,
        status: row.status,
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error('Error getting shop transactions:', error);
      throw new Error('Failed to get shop transactions');
    }
  }

  async getShopCustomers(
    shopId: string,
    options: { page: number; limit: number; search?: string }
  ): Promise<{
    customers: Array<{
      address: string;
      name?: string;
      tier: string;
      lifetime_earnings: number;
      last_transaction_date?: string;
      total_transactions: number;
    }>;
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const { page, limit, search } = options;
      const offset = this.getPaginationOffset(page, limit);

      // Build query to get customers who have earned from this shop
      let whereClause = 'WHERE t.shop_id = $1';
      let params: any[] = [shopId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        whereClause += ` AND (LOWER(c.wallet_address) LIKE LOWER($${paramCount}) OR LOWER(c.name) LIKE LOWER($${paramCount}))`;
        params.push(`%${search}%`);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT t.customer_address) as count
        FROM transactions t
        LEFT JOIN customers c ON c.wallet_address = t.customer_address
        ${whereClause} AND t.type = 'mint'
      `;
      const countResult = await this.pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated customer list with their details
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const query = `
        SELECT 
          t.customer_address as address,
          c.name,
          COALESCE(c.tier, 'BRONZE') as tier,
          SUM(t.amount) as lifetime_earnings,
          MAX(t.timestamp) as last_transaction_date,
          COUNT(t.id) as total_transactions
        FROM transactions t
        LEFT JOIN customers c ON c.wallet_address = t.customer_address
        ${whereClause} AND t.type = 'mint'
        GROUP BY t.customer_address, c.name, c.tier
        ORDER BY SUM(t.amount) DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await this.pool.query(query, params);
      
      const customers = result.rows.map(row => ({
        address: row.address,
        name: row.name,
        tier: row.tier,
        lifetime_earnings: parseFloat(row.lifetime_earnings || 0),
        last_transaction_date: row.last_transaction_date,
        total_transactions: parseInt(row.total_transactions || 0)
      }));

      const totalPages = Math.ceil(totalItems / limit);

      return {
        customers,
        totalItems,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      logger.error('Error getting shop customers:', error);
      throw new Error('Failed to get shop customers');
    }
  }
}