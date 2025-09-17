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
  rcg_tier?: string;
  rcg_balance?: number;
  tier_updated_at?: string;
  operational_status?: 'pending' | 'rcg_qualified' | 'subscription_qualified' | 'not_qualified';
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
        totalRcnPurchased: 'total_rcn_purchased',
        rcg_balance: 'rcg_balance',
        rcg_tier: 'rcg_tier',
        tier_updated_at: 'tier_updated_at',
        operational_status: 'operational_status'
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
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || 0),
        rcg_balance: parseFloat(row.rcg_balance || 0),
        rcg_tier: row.rcg_tier,
        tier_updated_at: row.tier_updated_at,
        operational_status: row.operational_status
      };
    } catch (error) {
      logger.error('Error fetching shop by wallet:', error);
      throw new Error('Failed to fetch shop by wallet');
    }
  }

  async createShopPurchase(purchaseData: {
    shopId: string;
    amount: number;
    pricePerRcn: number;
    totalCost: number;
    paymentMethod: string;
    paymentReference?: string;
    status: string;
  }): Promise<{ id: string }> {
    try {
      const query = `
        INSERT INTO shop_rcn_purchases (
          shop_id, amount, price_per_rcn, total_cost, 
          payment_method, payment_reference, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        purchaseData.shopId,
        purchaseData.amount,
        purchaseData.pricePerRcn,
        purchaseData.totalCost,
        purchaseData.paymentMethod,
        purchaseData.paymentReference || null,
        purchaseData.status
      ];
      
      const result = await this.pool.query(query, values);
      logger.info('Shop purchase created:', { 
        id: result.rows[0].id,
        shopId: purchaseData.shopId,
        amount: purchaseData.amount,
        totalCost: purchaseData.totalCost
      });
      return { id: result.rows[0].id };
    } catch (error) {
      logger.error('Error creating shop purchase:', error);
      logger.error('Purchase data:', purchaseData);
      throw error;
    }
  }

  async completeShopPurchase(purchaseId: string, paymentReference?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      logger.info('Attempting to complete shop purchase:', { purchaseId, paymentReference });

      // Get purchase details
      const purchaseQuery = 'SELECT * FROM shop_rcn_purchases WHERE id = $1 AND status = $2';
      const purchaseResult = await client.query(purchaseQuery, [purchaseId, 'pending']);
      
      if (purchaseResult.rows.length === 0) {
        // Check if purchase exists at all
        const checkQuery = 'SELECT id, status FROM shop_rcn_purchases WHERE id = $1';
        const checkResult = await client.query(checkQuery, [purchaseId]);
        
        if (checkResult.rows.length === 0) {
          throw new Error(`Purchase not found: ${purchaseId}`);
        } else {
          throw new Error(`Purchase already completed or in status: ${checkResult.rows[0].status}`);
        }
      }
      
      const purchase = purchaseResult.rows[0];
      logger.info('Found purchase to complete:', { 
        shopId: purchase.shop_id, 
        amount: purchase.amount,
        totalCost: purchase.total_cost 
      });

      // Update purchase status
      const updatePurchaseQuery = `
        UPDATE shop_rcn_purchases 
        SET status = 'completed', 
            payment_reference = COALESCE($2, payment_reference),
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await client.query(updatePurchaseQuery, [purchaseId, paymentReference]);

      // Update shop balance
      const updateShopQuery = `
        UPDATE shops 
        SET purchased_rcn_balance = purchased_rcn_balance + $1,
            total_rcn_purchased = total_rcn_purchased + $1,
            last_purchase_date = CURRENT_TIMESTAMP
        WHERE shop_id = $2
      `;
      await client.query(updateShopQuery, [purchase.amount, purchase.shop_id]);
      
      logger.info('Shop purchase completed successfully:', { 
        purchaseId,
        shopId: purchase.shop_id,
        amountAdded: purchase.amount
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error completing shop purchase:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateShopRcnBalance(shopId: string, amount: number): Promise<void> {
    try {
      const query = `
        UPDATE shops 
        SET purchased_rcn_balance = purchased_rcn_balance + $1,
            total_rcn_purchased = total_rcn_purchased + $1,
            last_purchase_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $2
      `;
      
      await this.pool.query(query, [amount, shopId]);
      
      logger.info('Shop RCN balance updated:', { 
        shopId,
        amountAdded: amount
      });
    } catch (error) {
      logger.error('Error updating shop RCN balance:', error);
      throw error;
    }
  }

  async getShopPurchaseHistory(shopId: string, filters: {
    page: number;
    limit: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<{
    items: any[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    try {
      const offset = (filters.page - 1) * filters.limit;
      const orderBy = filters.orderBy || 'created_at';
      const orderDirection = filters.orderDirection || 'desc';

      // Get total count
      const countQuery = 'SELECT COUNT(*) FROM shop_rcn_purchases WHERE shop_id = $1';
      const countResult = await this.pool.query(countQuery, [shopId]);
      const totalItems = parseInt(countResult.rows[0].count);

      // Get paginated results
      const query = `
        SELECT * FROM shop_rcn_purchases 
        WHERE shop_id = $1
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [shopId, filters.limit, offset]);
      const totalPages = Math.ceil(totalItems / filters.limit);

      return {
        items: result.rows,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages,
          hasMore: filters.page < totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting shop purchase history:', error);
      throw new Error('Failed to get purchase history');
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

  async getCustomerGrowthStats(shopId: string, period: string = '7d'): Promise<{
    totalCustomers: number;
    newCustomers: number;
    growthPercentage: number;
    regularCustomers: number;
    regularGrowthPercentage: number;
    activeCustomers: number;
    activeGrowthPercentage: number;
    averageEarningsPerCustomer: number;
    avgEarningsGrowthPercentage: number;
    periodLabel: string;
  }> {
    try {
      // Parse period to get days
      const periodDays = period === '30d' ? 30 : period === '90d' ? 90 : 7;
      const periodLabel = period === '30d' ? 'last 30 days' : period === '90d' ? 'last 90 days' : 'last 7 days';
      
      const now = new Date();
      const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Get current total customers
      const totalCustomersQuery = `
        SELECT COUNT(DISTINCT customer_address) as count
        FROM transactions
        WHERE shop_id = $1 AND type = 'mint'
      `;
      const totalResult = await this.pool.query(totalCustomersQuery, [shopId]);
      const totalCustomers = parseInt(totalResult.rows[0].count || 0);

      // Get new customers in current period
      const newCustomersQuery = `
        SELECT COUNT(DISTINCT customer_address) as count
        FROM transactions
        WHERE shop_id = $1 
          AND type = 'mint'
          AND customer_address IN (
            SELECT customer_address 
            FROM transactions 
            WHERE shop_id = $1 AND type = 'mint'
            GROUP BY customer_address
            HAVING MIN(created_at) >= $2
          )
      `;
      const newResult = await this.pool.query(newCustomersQuery, [shopId, periodStart]);
      const newCustomers = parseInt(newResult.rows[0].count || 0);

      // Get new customers in previous period for growth calculation
      const prevNewCustomersQuery = `
        SELECT COUNT(DISTINCT customer_address) as count
        FROM transactions
        WHERE shop_id = $1 
          AND type = 'mint'
          AND customer_address IN (
            SELECT customer_address 
            FROM transactions 
            WHERE shop_id = $1 AND type = 'mint'
            GROUP BY customer_address
            HAVING MIN(created_at) >= $2 AND MIN(created_at) < $3
          )
      `;
      const prevNewResult = await this.pool.query(prevNewCustomersQuery, [shopId, previousPeriodStart, periodStart]);
      const prevNewCustomers = parseInt(prevNewResult.rows[0].count || 0);

      // Calculate growth percentage
      const growthPercentage = prevNewCustomers > 0 
        ? Math.round(((newCustomers - prevNewCustomers) / prevNewCustomers) * 100)
        : newCustomers > 0 ? 100 : 0;

      // Get regular customers (5+ transactions)
      const regularCustomersQuery = `
        SELECT 
          COUNT(DISTINCT CASE WHEN transaction_count >= 5 THEN customer_address END) as regular_current,
          COUNT(DISTINCT customer_address) as total_current
        FROM (
          SELECT customer_address, COUNT(*) as transaction_count
          FROM transactions
          WHERE shop_id = $1 AND type = 'mint' AND created_at >= $2
          GROUP BY customer_address
        ) t
      `;
      const regularResult = await this.pool.query(regularCustomersQuery, [shopId, periodStart]);
      const regularCustomers = parseInt(regularResult.rows[0].regular_current || 0);

      // Get previous period regular customers for growth
      const prevRegularResult = await this.pool.query(regularCustomersQuery, [shopId, previousPeriodStart]);
      const prevRegularCustomers = parseInt(prevRegularResult.rows[0].regular_current || 0);
      
      const regularGrowthPercentage = prevRegularCustomers > 0 
        ? Math.round(((regularCustomers - prevRegularCustomers) / prevRegularCustomers) * 100)
        : regularCustomers > 0 ? 100 : 0;

      // Get active customers in current period (made transaction in last week)
      const activeCustomersQuery = `
        SELECT COUNT(DISTINCT customer_address) as count
        FROM transactions
        WHERE shop_id = $1 
          AND type = 'mint'
          AND created_at >= $2
      `;
      const activeResult = await this.pool.query(activeCustomersQuery, [shopId, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)]);
      const activeCustomers = parseInt(activeResult.rows[0].count || 0);

      // Get previous period active customers
      const prevActiveResult = await this.pool.query(activeCustomersQuery, [shopId, new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000)]);
      const prevActiveCustomers = parseInt(prevActiveResult.rows[0].count || 0);
      
      const activeGrowthPercentage = prevActiveCustomers > 0 
        ? Math.round(((activeCustomers - prevActiveCustomers) / prevActiveCustomers) * 100)
        : activeCustomers > 0 ? 100 : 0;

      // Get average earnings per customer
      const avgEarningsQuery = `
        SELECT 
          COALESCE(AVG(customer_earnings), 0) as avg_earnings
        FROM (
          SELECT customer_address, SUM(amount) as customer_earnings
          FROM transactions
          WHERE shop_id = $1 AND type = 'mint' AND created_at >= $2
          GROUP BY customer_address
        ) t
      `;
      const avgResult = await this.pool.query(avgEarningsQuery, [shopId, periodStart]);
      const averageEarningsPerCustomer = Math.round(parseFloat(avgResult.rows[0].avg_earnings || 0));

      // Get previous period average earnings
      const prevAvgResult = await this.pool.query(avgEarningsQuery, [shopId, previousPeriodStart]);
      const prevAvgEarnings = Math.round(parseFloat(prevAvgResult.rows[0].avg_earnings || 0));
      
      const avgEarningsGrowthPercentage = prevAvgEarnings > 0 
        ? Math.round(((averageEarningsPerCustomer - prevAvgEarnings) / prevAvgEarnings) * 100)
        : averageEarningsPerCustomer > 0 ? 100 : 0;

      return {
        totalCustomers,
        newCustomers,
        growthPercentage,
        regularCustomers,
        regularGrowthPercentage,
        activeCustomers,
        activeGrowthPercentage,
        averageEarningsPerCustomer,
        avgEarningsGrowthPercentage,
        periodLabel
      };
    } catch (error) {
      logger.error('Error getting customer growth stats:', error);
      throw new Error('Failed to get customer growth statistics');
    }
  }

  /**
   * Get shop RCN purchases within a date range for revenue reporting
   */
  async getPurchasesInDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const query = `
        SELECT 
          p.*,
          s.rcg_tier as shop_tier
        FROM shop_rcn_purchases p
        JOIN shops s ON p.shop_id = s.shop_id
        WHERE p.created_at >= $1 
          AND p.created_at <= $2
          AND p.status = 'completed'
        ORDER BY p.created_at DESC
      `;
      
      const result = await this.pool.query(query, [startDate, endDate]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting purchases in date range:', error);
      throw new Error('Failed to get purchases in date range');
    }
  }
}