// backend/src/services/DatabaseService.ts - PostgreSQL Version
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { CustomerData, TierLevel } from '../../../contracts/TierManager';

// Re-export CustomerData for use in other modules
export { CustomerData, TierLevel };
import { PaginatedResult, PaginationParams, PaginationHelper } from '../utils/pagination';

export interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  reimbursementAddress: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalReimbursements: number;
  joinDate: string;
  lastActivity: string;
  fixflowShopId?: string;
  location?: {
    lat: number;
    lng: number;
    city: string;
    state: string;
    zipCode: string;
  };
  // New fields for shop purchasing model
  purchasedRcnBalance?: number;
  totalRcnPurchased?: number;
  lastPurchaseDate?: string;
  minimumBalanceAlert?: number;
  autoPurchaseEnabled?: boolean;
  autoPurchaseAmount?: number;
}

// New interfaces for enhanced functionality
export interface ShopRcnPurchase {
  id: string;
  shopId: string;
  amount: number;
  pricePerRcn: number;
  totalCost: number;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'usdc' | 'eth';
  paymentReference?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  completedAt?: string;
}

export interface TokenSource {
  id: string;
  customerAddress: string;
  amount: number;
  source: 'earned' | 'tier_bonus' | 'shop_distributed';
  earningTransactionId?: string;
  shopId?: string;
  earnedDate: string;
  isRedeemableAtShops: boolean;
}

export interface CrossShopVerification {
  id: string;
  customerAddress: string;
  redemptionShopId: string;
  earningShopId?: string;
  requestedAmount: number;
  availableCrossShopBalance: number;
  verificationResult: 'approved' | 'denied' | 'insufficient_balance';
  denialReason?: string;
  verifiedAt: string;
}

export interface TierBonus {
  id: string;
  customerAddress: string;
  shopId: string;
  baseTransactionId: string;
  customerTier: 'BRONZE' | 'SILVER' | 'GOLD';
  bonusAmount: number;
  baseRepairAmount: number;
  baseRcnEarned: number;
  appliedAt: string;
}

export interface TransactionRecord {
  id: string;
  type: 'mint' | 'redeem' | 'transfer' | 'tier_bonus' | 'shop_purchase';
  customerAddress: string;
  shopId: string;
  amount: number;
  reason: string;
  transactionHash: string;
  blockNumber?: number;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  metadata?: {
    repairAmount?: number;
    referralId?: string;
    engagementType?: string;
    redemptionLocation?: string;
    webhookId?: string;
    oldTier?: string;
    referrerTokens?: number;
    baseAmount?: number;
    shopName?: string;
    [key: string]: any; // Allow additional properties
  };
  // New fields for enhanced tracking
  tokenSource?: 'earned' | 'purchased' | 'tier_bonus';
  isCrossShop?: boolean;
  redemptionShopId?: string;
  tierBonusAmount?: number;
  baseAmount?: number;
}

export interface WebhookLog {
  id: string;
  source: 'fixflow' | 'admin' | 'customer';
  event: string;
  payload: any;
  processed: boolean;
  processingTime?: number;
  result?: {
    success: boolean;
    transactionHash?: string;
    error?: string;
  };
  timestamp: string;
  retryCount: number;
}

export interface CreateResult {
  id: string;
  success: boolean;
  message?: string;
}

export class DatabaseService {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'repaircoin',
      user: process.env.DB_USER || 'repaircoin',
      password: process.env.DB_PASSWORD || 'repaircoin123',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2000 to 10000ms
      keepAlive: true,
    });

    // Test connection on startup
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('✅ Database connection successful');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
    }
  }

  // Customer operations
  async getCustomer(address: string): Promise<CustomerData | null> {
    try {
      const query = 'SELECT * FROM customers WHERE address = $1';
      const result = await this.pool.query(query, [address.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0] as CustomerData;
    } catch (error) {
      logger.error('Error getting customer:', error);
      throw new Error('Failed to retrieve customer data');
    }
  }

  async createCustomer(customerData: CustomerData): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO customers (
          address, name, email, phone, wallet_address, is_active,
          lifetime_earnings, tier, daily_earnings, monthly_earnings,
          last_earned_date, referral_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING address
      `;
      
      const values = [
        customerData.address.toLowerCase(),
        customerData.name || '',
        customerData.email || '',
        customerData.phone || '',
        customerData.address.toLowerCase(),
        customerData.isActive || true,
        customerData.lifetimeEarnings || 0,
        customerData.tier || 'BRONZE',
        customerData.dailyEarnings || 0,
        customerData.monthlyEarnings || 0,
        customerData.lastEarnedDate || new Date().toISOString().split('T')[0],
        customerData.referralCount || 0
      ];
      
      const result = await this.pool.query(query, values);
      
      logger.info(`Customer created: ${customerData.address}`);
      return {
        id: result.rows[0].address,
        success: true,
        message: 'Customer created successfully'
      };
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  async updateCustomer(address: string, updates: Partial<CustomerData>): Promise<void> {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = ${index + 2}`)
        .join(', ');
      
      const query = `
        UPDATE customers 
        SET ${setClause}, updated_at = NOW()
        WHERE address = $1
      `;
      
      const values = [address.toLowerCase(), ...Object.values(updates)];
      await this.pool.query(query, values);
      
      logger.info(`Customer updated: ${address}`);
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw new Error('Failed to update customer');
    }
  }

  async updateCustomerAfterEarning(address: string, tokensEarned: number, newTier: TierLevel): Promise<void> {
    try {
      const customerRef = address.toLowerCase();
      
      await this.pool.query('BEGIN');
      
      try {
        // Get current customer data
        const customerResult = await this.pool.query(
          'SELECT * FROM customers WHERE address = $1', 
          [customerRef]
        );
        
        if (customerResult.rows.length === 0) {
          throw new Error('Customer not found');
        }
        
        const customer = customerResult.rows[0] as CustomerData;
        const today = new Date().toISOString().split('T')[0];
        const currentDate = new Date();
        const lastEarnedDate = new Date(customer.lastEarnedDate);
        
        // Calculate updated earnings
        const dailyEarnings = (customer.lastEarnedDate === today) 
          ? customer.dailyEarnings + tokensEarned 
          : tokensEarned;
        
        const monthlyEarnings = (currentDate.getMonth() === lastEarnedDate.getMonth() && 
                                currentDate.getFullYear() === lastEarnedDate.getFullYear())
          ? customer.monthlyEarnings + tokensEarned
          : tokensEarned;
        
        // Update customer
        await this.pool.query(`
          UPDATE customers 
          SET lifetime_earnings = lifetime_earnings + $2,
              tier = $3,
              daily_earnings = $4,
              monthly_earnings = $5,
              last_earned_date = $6,
              updated_at = NOW()
          WHERE address = $1
        `, [
          customerRef,
          tokensEarned,
          newTier,
          dailyEarnings,
          monthlyEarnings,
          today
        ]);
        
        await this.pool.query('COMMIT');
        logger.info(`Customer earnings updated: ${address} earned ${tokensEarned} RCN`);
      } catch (error) {
        await this.pool.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error updating customer earnings:', error);
      throw new Error('Failed to update customer earnings');
    }
  }

  async updateShop(shopId: string, updates: Partial<ShopData>): Promise<void> {
    try {
      // Map camelCase field names to snake_case column names
      const fieldMap: { [key: string]: string } = {
        'verified': 'verified',
        'active': 'active',
        'crossShopEnabled': 'cross_shop_enabled',
        'totalTokensIssued': 'total_tokens_issued',
        'totalRedemptions': 'total_redemptions',
        'totalReimbursements': 'total_reimbursements',
        'lastActivity': 'last_activity',
        'fixflowShopId': 'fixflow_shop_id',
        'walletAddress': 'wallet_address',
        'reimbursementAddress': 'reimbursement_address',
        'name': 'name',
        'address': 'address',
        'phone': 'phone',
        'email': 'email'
      };

      const setClauses: string[] = [];
      const values: any[] = [shopId];
      let paramCount = 1;

      for (const [fieldName, value] of Object.entries(updates)) {
        const columnName = fieldMap[fieldName] || fieldName;
        paramCount++;
        setClauses.push(`${columnName} = $${paramCount}`);
        values.push(value);
      }

      if (setClauses.length === 0) {
        logger.warn(`No valid fields to update for shop: ${shopId}`);
        return;
      }
      
      const query = `
        UPDATE shops 
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE shop_id = $1
      `;
      
      await this.pool.query(query, values);
      
      logger.info(`Shop updated: ${shopId}`);
    } catch (error) {
      logger.error('Error updating shop:', error);
      throw new Error('Failed to update shop');
    }
  }

  // Paginated customer retrieval
async getCustomersPaginated(params: PaginationParams & { 
  tier?: TierLevel; 
  active?: boolean; 
}): Promise<PaginatedResult<CustomerData>> {
  try {
    const validatedParams = PaginationHelper.validatePaginationParams(params);
    
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Apply filters
    if (params.tier) {
      whereClause += ` AND tier = $${paramIndex++}`;
      queryParams.push(params.tier);
    }
    
    if (params.active !== undefined) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      queryParams.push(params.active);
    }
    
    // Count total records
    const countQuery = `SELECT COUNT(*) FROM customers ${whereClause}`;
    const countResult = await this.pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated data
    const dataQuery = `
      SELECT * FROM customers 
      ${whereClause}
      ORDER BY ${validatedParams.orderBy} ${validatedParams.orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const offset = (validatedParams.page - 1) * validatedParams.limit;
    queryParams.push(validatedParams.limit, offset);
    
    const result = await this.pool.query(dataQuery, queryParams);
    const customers = result.rows as CustomerData[];
    
    // Use the correct PaginatedResult format
    return PaginationHelper.createOffsetPaginatedResult(
      customers,
      totalCount,
      validatedParams.limit,
      validatedParams.page
    );
  } catch (error) {
    logger.error('Error getting paginated customers:', error);
    throw new Error('Failed to retrieve paginated customers');
  }
}

  // Shop operations
  async getShop(shopId: string): Promise<ShopData | null> {
    try {
      const query = 'SELECT * FROM shops WHERE shop_id = $1';
      const result = await this.pool.query(query, [shopId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0] as ShopData;
    } catch (error) {
      logger.error('Error getting shop:', error);
      throw new Error('Failed to retrieve shop data');
    }
  }

  async getShopByWallet(walletAddress: string): Promise<ShopData | null> {
    try {
      const query = 'SELECT * FROM shops WHERE wallet_address = $1';
      const result = await this.pool.query(query, [walletAddress.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Map snake_case database fields to camelCase
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
        totalTokensIssued: parseFloat(row.total_tokens_issued || '0'),
        totalRedemptions: parseFloat(row.total_redemptions || '0'),
        totalReimbursements: parseFloat(row.total_reimbursements || '0'),
        joinDate: row.join_date,
        lastActivity: row.last_activity,
        fixflowShopId: row.fixflow_shop_id,
        location: row.location,
        purchasedRcnBalance: parseFloat(row.purchased_rcn_balance || '0'),
        totalRcnPurchased: parseFloat(row.total_rcn_purchased || '0'),
        lastPurchaseDate: row.last_purchase_date
      } as ShopData;
    } catch (error) {
      logger.error('Error getting shop by wallet:', error);
      throw new Error('Failed to retrieve shop data by wallet address');
    }
  }

  async createShop(shopData: ShopData): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO shops (
          shop_id, name, address, phone, email, wallet_address,
          reimbursement_address, verified, active, cross_shop_enabled,
          total_tokens_issued, total_redemptions, total_reimbursements,
          join_date, last_activity, fixflow_shop_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING shop_id
      `;
      
      const values = [
        shopData.shopId,
        shopData.name,
        shopData.address,
        shopData.phone,
        shopData.email,
        shopData.walletAddress,
        shopData.reimbursementAddress,
        shopData.verified || false,
        shopData.active || true,
        shopData.crossShopEnabled || false,
        shopData.totalTokensIssued || 0,
        shopData.totalRedemptions || 0,
        shopData.totalReimbursements || 0,
        shopData.joinDate || new Date().toISOString(),
        shopData.lastActivity || new Date().toISOString(),
        shopData.fixflowShopId
      ];
      
      const result = await this.pool.query(query, values);
      
      logger.info(`Shop created: ${shopData.shopId}`);
      return {
        id: result.rows[0].shop_id,
        success: true,
        message: 'Shop created successfully'
      };
    } catch (error) {
      logger.error('Error creating shop:', error);
      throw new Error('Failed to create shop');
    }
  }

  // Paginated shop retrieval
async getShopsPaginated(params: PaginationParams & { 
  active?: boolean; 
  verified?: boolean; 
}): Promise<PaginatedResult<ShopData>> {
  try {
    const validatedParams = PaginationHelper.validatePaginationParams(params);
    
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (params.active !== undefined) {
      whereClause += ` AND active = $${paramIndex++}`;
      queryParams.push(params.active);
    }
    
    if (params.verified !== undefined) {
      whereClause += ` AND verified = $${paramIndex++}`;
      queryParams.push(params.verified);
    }
    
    // Count total records
    const countQuery = `SELECT COUNT(*) FROM shops ${whereClause}`;
    const countResult = await this.pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated data
    const dataQuery = `
      SELECT * FROM shops 
      ${whereClause}
      ORDER BY ${validatedParams.orderBy} ${validatedParams.orderDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const offset = (validatedParams.page - 1) * validatedParams.limit;
    queryParams.push(validatedParams.limit, offset);
    
    const result = await this.pool.query(dataQuery, queryParams);
    const shops = result.rows as ShopData[];
    
    // Use the correct PaginatedResult format
    return PaginationHelper.createOffsetPaginatedResult(
      shops,
      totalCount,
      validatedParams.limit,
      validatedParams.page
    );
  } catch (error) {
    logger.error('Error getting paginated shops:', error);
    throw new Error('Failed to retrieve paginated shops');
  }
}

  // Transaction operations
  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    try {
      const query = `
        INSERT INTO transactions (
          id, type, customer_address, shop_id, amount, reason,
          transaction_hash, block_number, timestamp, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `;
      
      const values = [
        transaction.id,
        transaction.type,
        transaction.customerAddress.toLowerCase(),
        transaction.shopId,
        transaction.amount,
        transaction.reason,
        transaction.transactionHash,
        transaction.blockNumber,
        transaction.timestamp,
        transaction.status,
        JSON.stringify(transaction.metadata || {})
      ];
      
      await this.pool.query(query, values);
      logger.info(`Transaction recorded: ${transaction.id}`);
    } catch (error) {
      logger.error('Error recording transaction:', error);
      throw new Error('Failed to record transaction');
    }
  }

  // Webhook operations
  async logWebhook(webhookLog: WebhookLog): Promise<void> {
    try {
      const query = `
        INSERT INTO webhook_logs (
          id, source, event, payload, processed, processing_time,
          result, timestamp, retry_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `;
      
      const values = [
        webhookLog.id,
        webhookLog.source,
        webhookLog.event,
        JSON.stringify(webhookLog.payload),
        webhookLog.processed,
        webhookLog.processingTime,
        JSON.stringify(webhookLog.result || {}),
        webhookLog.timestamp,
        webhookLog.retryCount
      ];
      
      await this.pool.query(query, values);
      logger.info(`Webhook logged: ${webhookLog.id}`);
    } catch (error) {
      logger.error('Error logging webhook:', error);
      throw new Error('Failed to log webhook');
    }
  }

  async updateWebhookResult(
    webhookId: string, 
    result: { success: boolean; transactionHash?: string; error?: string; }, 
    processingTime: number
  ): Promise<void> {
    try {
      const query = `
        UPDATE webhook_logs 
        SET processed = true, result = $2, processing_time = $3, processed_at = NOW()
        WHERE id = $1
      `;
      
      await this.pool.query(query, [
        webhookId,
        JSON.stringify(result),
        processingTime
      ]);
      
      logger.info(`Webhook result updated: ${webhookId}`);
    } catch (error) {
      logger.error('Error updating webhook result:', error);
      throw new Error('Failed to update webhook result');
    }
  }

  async getFailedWebhooks(limit: number = 20): Promise<WebhookLog[]> {
    try {
      const query = `
        SELECT * FROM webhook_logs 
        WHERE processed = true 
          AND (result->>'success')::boolean = false
        ORDER BY timestamp DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      return result.rows.map(row => ({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
        result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
      })) as WebhookLog[];
    } catch (error) {
      logger.error('Error getting failed webhooks:', error);
      throw new Error('Failed to retrieve failed webhooks');
    }
  }

  async getWebhookLogsPaginated(params: PaginationParams & { 
    eventType?: string;
    source?: string;
    processed?: boolean;
    success?: boolean;
  }): Promise<PaginatedResult<WebhookLog>> {
    try {
      const validatedParams = PaginationHelper.validatePaginationParams({
        ...params,
        orderBy: 'timestamp'
      });
      
      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // Apply filters
      if (params.eventType) {
        whereClause += ` AND event = ${paramIndex++}`;
        queryParams.push(params.eventType);
      }
      
      if (params.source) {
        whereClause += ` AND source = ${paramIndex++}`;
        queryParams.push(params.source);
      }
      
      if (params.processed !== undefined) {
        whereClause += ` AND processed = ${paramIndex++}`;
        queryParams.push(params.processed);
      }
      
      if (params.success !== undefined) {
        whereClause += ` AND (result->>'success')::boolean = ${paramIndex++}`;
        queryParams.push(params.success);
      }
      
      const query = `
        SELECT * FROM webhook_logs 
        ${whereClause}
        ORDER BY ${validatedParams.orderBy} ${validatedParams.orderDirection}
        LIMIT ${paramIndex++} OFFSET ${paramIndex++}
      `;
      
      const offset = (validatedParams.page - 1) * validatedParams.limit;
      queryParams.push(validatedParams.limit + 1, offset);
      
      const result = await this.pool.query(query, queryParams);
      
      const hasMore = result.rows.length > validatedParams.limit;
      const webhookLogs = result.rows
        .slice(0, validatedParams.limit)
        .map(row => ({
          ...row,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
        })) as WebhookLog[];
      
      return PaginationHelper.createPaginatedResult(webhookLogs, validatedParams.limit);
    } catch (error) {
      logger.error('Error getting paginated webhook logs:', error);
      throw new Error('Failed to retrieve paginated webhook logs');
    }
  }

  // Health check
  async healthCheck(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      database: boolean;
      connection_pool: {
        total: number;
        idle: number;
        waiting: number;
      };
    };
  }> {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const result = await this.pool.query('SELECT NOW() as current_time, version() as pg_version');
      
      const responseTime = Date.now() - startTime;
      const isHealthy = responseTime < 1000; // Less than 1 second
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          database: true,
          connection_pool: {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount
          }
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          database: false,
          connection_pool: {
            total: 0,
            idle: 0,
            waiting: 0
          }
        }
      };
    }
  }

  async getTransactionHistory(address: string, limit: number = 50): Promise<TransactionRecord[]> {
  try {
    const query = `
      SELECT * FROM transactions 
      WHERE customer_address = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [address.toLowerCase(), limit]);
    
    return result.rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    })) as TransactionRecord[];
  } catch (error) {
    logger.error('Error getting transaction history:', error);
    throw new Error('Failed to retrieve transaction history');
  }
}

// Customer analytics method
async getCustomerAnalytics(address: string): Promise<any> {
  try {
    const query = `
      SELECT 
        SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as total_spent,
        COUNT(*) as transaction_count,
        (
          SELECT shop_id 
          FROM transactions 
          WHERE customer_address = $1 AND type = 'redeem'
          GROUP BY shop_id 
          ORDER BY COUNT(*) DESC 
          LIMIT 1
        ) as favorite_shop
      FROM transactions 
      WHERE customer_address = $1
    `;
    
    const result = await this.pool.query(query, [address.toLowerCase()]);
    const row = result.rows[0];
    
    // Get earning trend (last 30 days)
    const trendQuery = `
      SELECT 
        DATE(timestamp) as date,
        SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END) as amount
      FROM transactions 
      WHERE customer_address = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
        AND type = 'mint'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;
    
    const trendResult = await this.pool.query(trendQuery, [address.toLowerCase()]);
    
    return {
      totalEarned: parseInt(row.total_earned || '0'),
      totalSpent: parseInt(row.total_spent || '0'),
      transactionCount: parseInt(row.transaction_count || '0'),
      favoriteShop: row.favorite_shop,
      earningTrend: trendResult.rows.map(r => ({
        date: r.date,
        amount: parseInt(r.amount)
      }))
    };
  } catch (error) {
    logger.error('Error getting customer analytics:', error);
    throw new Error('Failed to retrieve customer analytics');
  }
}

// Get customers by tier method
async getCustomersByTier(tier: TierLevel): Promise<CustomerData[]> {
  try {
    const query = 'SELECT * FROM customers WHERE tier = $1 AND is_active = true ORDER BY lifetime_earnings DESC';
    const result = await this.pool.query(query, [tier]);
    
    return result.rows as CustomerData[];
  } catch (error) {
    logger.error('Error getting customers by tier:', error);
    throw new Error('Failed to retrieve customers by tier');
  }
}

async getActiveShops(): Promise<ShopData[]> {
  try {
    const query = 'SELECT * FROM shops WHERE active = true ORDER BY name ASC';
    const result = await this.pool.query(query);
    
    return result.rows as ShopData[];
  } catch (error) {
    logger.error('Error getting active shops:', error);
    throw new Error('Failed to retrieve active shops');
  }
}

// Get shop analytics
async getShopAnalytics(shopId: string): Promise<any> {
  try {
    const query = `
      SELECT 
        SUM(CASE WHEN type = 'mint' THEN amount ELSE 0 END) as total_tokens_issued,
        SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) as total_redemptions,
        COUNT(DISTINCT customer_address) as unique_customers,
        COUNT(*) as total_transactions
      FROM transactions 
      WHERE shop_id = $1
    `;
    
    const result = await this.pool.query(query, [shopId]);
    const row = result.rows[0];
    
    // Get transaction trend (last 30 days)
    const trendQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM transactions 
      WHERE shop_id = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;
    
    const trendResult = await this.pool.query(trendQuery, [shopId]);
    
    return {
      totalTokensIssued: parseInt(row.total_tokens_issued || '0'),
      totalRedemptions: parseInt(row.total_redemptions || '0'),
      uniqueCustomers: parseInt(row.unique_customers || '0'),
      totalTransactions: parseInt(row.total_transactions || '0'),
      activeCustomers: parseInt(row.unique_customers || '0'), // Simplified for now
      averageRepairValue: row.total_tokens_issued && row.total_transactions 
        ? Math.round(row.total_tokens_issued / row.total_transactions) 
        : 0,
      transactionTrend: trendResult.rows.map(r => ({
        date: r.date,
        transactionCount: parseInt(r.transaction_count),
        totalAmount: parseInt(r.total_amount)
      }))
    };
  } catch (error) {
    logger.error('Error getting shop analytics:', error);
    throw new Error('Failed to retrieve shop analytics');
  }
}

// Get shop transactions
async getShopTransactions(shopId: string, limit: number = 50): Promise<TransactionRecord[]> {
  try {
    const query = `
      SELECT * FROM transactions 
      WHERE shop_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [shopId, limit]);
    
    return result.rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    })) as TransactionRecord[];
  } catch (error) {
    logger.error('Error getting shop transactions:', error);
    throw new Error('Failed to retrieve shop transactions');
  }
}

  // Cleanup old webhook logs
  async cleanupOldWebhookLogs(daysOld: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM webhook_logs 
        WHERE timestamp < NOW() - INTERVAL '${daysOld} days'
      `;
      
      const result = await this.pool.query(query);
      const deletedCount = result.rowCount || 0;
      
      logger.info(`Cleaned up ${deletedCount} old webhook logs older than ${daysOld} days`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old webhook logs:', error);
      throw new Error('Failed to cleanup old webhook logs');
    }
  }

  // Get platform statistics
  async getPlatformStatistics(): Promise<{
    totalCustomers: number;
    totalShops: number;
    totalTransactions: number;
    totalTokensIssued: number;
    totalRedemptions: number;
    activeCustomersLast30Days: number;
    averageTransactionValue: number;
    topPerformingShops: Array<{ shopId: string; name: string; totalTransactions: number }>;
  }> {
    try {
      // Get total customers
      const customersResult = await this.pool.query('SELECT COUNT(*) FROM customers');
      const totalCustomers = parseInt(customersResult.rows[0].count);

      // Get total shops
      const shopsResult = await this.pool.query('SELECT COUNT(*) FROM shops WHERE active = true AND verified = true');
      const totalShops = parseInt(shopsResult.rows[0].count);

      // Get total transactions
      const transactionsResult = await this.pool.query('SELECT COUNT(*) FROM transactions');
      const totalTransactions = parseInt(transactionsResult.rows[0].count);

      // Get total tokens issued
      const tokensResult = await this.pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total_minted
        FROM transactions
        WHERE type IN ('mint', 'tier_bonus') AND status = 'confirmed'
      `);
      const totalTokensIssued = parseFloat(tokensResult.rows[0].total_minted);

      // Get total redemptions
      const redemptionsResult = await this.pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total_redeemed
        FROM transactions
        WHERE type = 'redeem' AND status = 'confirmed'
      `);
      const totalRedemptions = parseFloat(redemptionsResult.rows[0].total_redeemed);

      // Get active customers in last 30 days
      const activeCustomersResult = await this.pool.query(`
        SELECT COUNT(DISTINCT customer_address) 
        FROM transactions 
        WHERE timestamp > NOW() - INTERVAL '30 days'
      `);
      const activeCustomersLast30Days = parseInt(activeCustomersResult.rows[0].count);

      // Get average transaction value
      const avgResult = await this.pool.query(`
        SELECT AVG(amount) as avg_amount 
        FROM transactions 
        WHERE type IN ('mint', 'tier_bonus')
      `);
      const averageTransactionValue = parseFloat(avgResult.rows[0].avg_amount) || 0;

      // Get top performing shops
      const topShopsResult = await this.pool.query(`
        SELECT s.shop_id, s.name, COUNT(t.*) as total_transactions
        FROM shops s
        LEFT JOIN transactions t ON s.shop_id = t.shop_id
        WHERE s.active = true AND s.verified = true
        GROUP BY s.shop_id, s.name
        ORDER BY total_transactions DESC
        LIMIT 5
      `);
      const topPerformingShops = topShopsResult.rows.map(row => ({
        shopId: row.shop_id,
        name: row.name,
        totalTransactions: parseInt(row.total_transactions)
      }));

      return {
        totalCustomers,
        totalShops,
        totalTransactions,
        totalTokensIssued,
        totalRedemptions,
        activeCustomersLast30Days,
        averageTransactionValue,
        topPerformingShops
      };
    } catch (error) {
      logger.error('Error getting platform statistics:', error);
      throw new Error('Failed to retrieve platform statistics');
    }
  }

  // ========================================
  // NEW METHODS FOR ENHANCED REQUIREMENTS
  // ========================================

  // Shop RCN Purchasing Methods
  async createShopPurchase(purchaseData: Omit<ShopRcnPurchase, 'id' | 'createdAt'>): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO shop_rcn_purchases (
          shop_id, amount, price_per_rcn, total_cost, payment_method,
          payment_reference, status
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
        purchaseData.status || 'pending'
      ];
      
      const result = await this.pool.query(query, values);
      logger.info(`Shop purchase created: ${purchaseData.shopId} - ${purchaseData.amount} RCN`);
      
      return {
        id: result.rows[0].id,
        success: true,
        message: 'Shop purchase created successfully'
      };
    } catch (error) {
      logger.error('Error creating shop purchase:', error);
      throw new Error('Failed to create shop purchase');
    }
  }

  async completeShopPurchase(purchaseId: string, paymentReference?: string): Promise<void> {
    try {
      await this.pool.query('BEGIN');
      
      // Update purchase status
      const updateQuery = `
        UPDATE shop_rcn_purchases 
        SET status = 'completed', completed_at = NOW(), payment_reference = COALESCE($2, payment_reference)
        WHERE id = $1
        RETURNING shop_id, amount
      `;
      
      const result = await this.pool.query(updateQuery, [purchaseId, paymentReference]);
      if (result.rows.length === 0) {
        throw new Error('Purchase not found');
      }
      
      const { shop_id, amount } = result.rows[0];
      
      // Update shop RCN balance
      const shopUpdateQuery = `
        UPDATE shops 
        SET 
          purchased_rcn_balance = purchased_rcn_balance + $1,
          total_rcn_purchased = total_rcn_purchased + $1,
          last_purchase_date = NOW()
        WHERE shop_id = $2
      `;
      
      await this.pool.query(shopUpdateQuery, [amount, shop_id]);
      
      // Update admin treasury
      const treasuryUpdateQuery = `
        UPDATE admin_treasury 
        SET 
          available_supply = available_supply - $1,
          total_sold = total_sold + $1,
          total_revenue = total_revenue + $1,
          last_updated = NOW()
        WHERE id = 1
      `;
      await this.pool.query(treasuryUpdateQuery, [amount]);
      
      await this.pool.query('COMMIT');
      
      logger.info(`Shop purchase completed: ${shop_id} - ${amount} RCN`);
    } catch (error) {
      await this.pool.query('ROLLBACK');
      logger.error('Error completing shop purchase:', error);
      throw new Error('Failed to complete shop purchase');
    }
  }

  // Tier Bonus Methods
  async createTierBonus(bonusData: Omit<TierBonus, 'id' | 'appliedAt'>): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO tier_bonuses (
          customer_address, shop_id, base_transaction_id, customer_tier,
          bonus_amount, base_repair_amount, base_rcn_earned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        bonusData.customerAddress.toLowerCase(),
        bonusData.shopId,
        bonusData.baseTransactionId,
        bonusData.customerTier,
        bonusData.bonusAmount,
        bonusData.baseRepairAmount,
        bonusData.baseRcnEarned
      ];
      
      const result = await this.pool.query(query, values);
      logger.info(`Tier bonus created: ${bonusData.customerAddress} - ${bonusData.bonusAmount} RCN`);
      
      return {
        id: result.rows[0].id,
        success: true,
        message: 'Tier bonus created successfully'
      };
    } catch (error) {
      logger.error('Error creating tier bonus:', error);
      throw new Error('Failed to create tier bonus');
    }
  }

  async getTierBonusesForCustomer(customerAddress: string): Promise<TierBonus[]> {
    try {
      const query = `
        SELECT * FROM tier_bonuses 
        WHERE customer_address = $1 
        ORDER BY applied_at DESC
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting tier bonuses:', error);
      throw new Error('Failed to retrieve tier bonuses');
    }
  }

  // Token Source Tracking Methods
  async recordTokenSource(sourceData: Omit<TokenSource, 'id' | 'earnedDate'>): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO token_sources (
          customer_address, amount, source, earning_transaction_id,
          shop_id, is_redeemable_at_shops
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const values = [
        sourceData.customerAddress.toLowerCase(),
        sourceData.amount,
        sourceData.source,
        sourceData.earningTransactionId || null,
        sourceData.shopId || null,
        sourceData.isRedeemableAtShops
      ];
      
      const result = await this.pool.query(query, values);
      
      return {
        id: result.rows[0].id,
        success: true,
        message: 'Token source recorded successfully'
      };
    } catch (error) {
      logger.error('Error recording token source:', error);
      throw new Error('Failed to record token source');
    }
  }

  async getRedeemableBalance(customerAddress: string): Promise<number> {
    try {
      const query = `
        SELECT COALESCE(SUM(amount), 0) as redeemable_balance
        FROM token_sources 
        WHERE customer_address = $1 AND is_redeemable_at_shops = true
      `;
      
      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return parseFloat(result.rows[0].redeemable_balance) || 0;
    } catch (error) {
      logger.error('Error getting redeemable balance:', error);
      throw new Error('Failed to retrieve redeemable balance');
    }
  }

  // Cross-Shop Verification Methods
  async verifyCrossShopRedemption(customerAddress: string, redemptionShopId: string, requestedAmount: number): Promise<CrossShopVerification> {
    try {
      const redeemableBalance = await this.getRedeemableBalance(customerAddress);
      const maxCrossShopAmount = redeemableBalance * 0.20; // 20% limit as per requirements
      
      let verificationResult: 'approved' | 'denied' | 'insufficient_balance' = 'approved';
      let denialReason: string | undefined;
      
      if (requestedAmount > redeemableBalance) {
        verificationResult = 'insufficient_balance';
        denialReason = `Insufficient redeemable balance. Available: ${redeemableBalance}, Requested: ${requestedAmount}`;
      } else if (requestedAmount > maxCrossShopAmount) {
        verificationResult = 'denied';
        denialReason = `Cross-shop redemption exceeds 20% limit. Max allowed: ${maxCrossShopAmount}, Requested: ${requestedAmount}`;
      }
      
      const insertQuery = `
        INSERT INTO cross_shop_verifications (
          customer_address, redemption_shop_id, requested_amount,
          available_cross_shop_balance, verification_result, denial_reason
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        customerAddress.toLowerCase(),
        redemptionShopId,
        requestedAmount,
        maxCrossShopAmount,
        verificationResult,
        denialReason || null
      ];
      
      const result = await this.pool.query(insertQuery, values);
      
      logger.info(`Cross-shop verification: ${customerAddress} at ${redemptionShopId} - ${verificationResult}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error verifying cross-shop redemption:', error);
      throw new Error('Failed to verify cross-shop redemption');
    }
  }

  // Create basic transaction method (needed by createTransactionWithTierBonus)
  async createTransaction(transaction: TransactionRecord): Promise<CreateResult> {
    try {
      const query = `
        INSERT INTO transactions (
          id, type, customer_address, shop_id, amount, reason,
          transaction_hash, block_number, timestamp, status, metadata,
          token_source, is_cross_shop, redemption_shop_id, tier_bonus_amount, base_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `;
      
      const values = [
        transaction.id || `txn_${Date.now()}`,
        transaction.type,
        transaction.customerAddress.toLowerCase(),
        transaction.shopId,
        transaction.amount,
        transaction.reason,
        transaction.transactionHash,
        transaction.blockNumber,
        transaction.timestamp,
        transaction.status,
        JSON.stringify(transaction.metadata || {}),
        transaction.tokenSource,
        transaction.isCrossShop || false,
        transaction.redemptionShopId,
        transaction.tierBonusAmount,
        transaction.baseAmount
      ];
      
      const result = await this.pool.query(query, values);
      logger.info(`Transaction created: ${transaction.id}`);
      
      return {
        id: result.rows[0].id,
        success: true,
        message: 'Transaction created successfully'
      };
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }
  }

  // Enhanced Transaction Methods with New Features
  async createTransactionWithTierBonus(transactionData: Omit<TransactionRecord, 'id' | 'timestamp'>, tierBonusData?: Omit<TierBonus, 'id' | 'appliedAt'>): Promise<CreateResult> {
    try {
      await this.pool.query('BEGIN');
      
      // Create main transaction
      const transactionResult = await this.createTransaction({
        ...transactionData,
        id: `txn_${Date.now()}`,
        timestamp: new Date().toISOString()
      });
      
      // Create tier bonus if provided
      if (tierBonusData) {
        await this.createTierBonus({
          ...tierBonusData,
          baseTransactionId: transactionResult.id
        });
        
        // Record token source for tier bonus
        await this.recordTokenSource({
          customerAddress: transactionData.customerAddress,
          amount: tierBonusData.bonusAmount,
          source: 'tier_bonus',
          earningTransactionId: transactionResult.id,
          shopId: tierBonusData.shopId,
          isRedeemableAtShops: true
        });
        
        // Deduct bonus amount from shop's purchased balance
        await this.pool.query(`
          UPDATE shops 
          SET purchased_rcn_balance = purchased_rcn_balance - $1
          WHERE shop_id = $2 AND purchased_rcn_balance >= $1
        `, [tierBonusData.bonusAmount, tierBonusData.shopId]);
      }
      
      // Record token source for base transaction
      if (transactionData.type === 'mint' && transactionData.tokenSource === 'earned') {
        await this.recordTokenSource({
          customerAddress: transactionData.customerAddress,
          amount: transactionData.baseAmount || transactionData.amount,
          source: 'earned',
          earningTransactionId: transactionResult.id,
          shopId: transactionData.shopId,
          isRedeemableAtShops: true
        });
      }
      
      await this.pool.query('COMMIT');
      
      return transactionResult;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      logger.error('Error creating transaction with tier bonus:', error);
      throw new Error('Failed to create transaction with tier bonus');
    }
  }

  // Shop Management Methods
  async getShopPurchaseHistory(shopId: string, pagination?: PaginationParams): Promise<PaginatedResult<ShopRcnPurchase>> {
    try {
      const validatedParams = PaginationHelper.validatePaginationParams(pagination || {});
      const offset = (validatedParams.page - 1) * validatedParams.limit;
      
      const query = `
        SELECT * FROM shop_rcn_purchases 
        WHERE shop_id = $1 
        ORDER BY ${validatedParams.orderBy} ${validatedParams.orderDirection} 
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = 'SELECT COUNT(*) FROM shop_rcn_purchases WHERE shop_id = $1';
      
      const [dataResult, countResult] = await Promise.all([
        this.pool.query(query, [shopId, validatedParams.limit, offset]),
        this.pool.query(countQuery, [shopId])
      ]);
      
      const total = parseInt(countResult.rows[0].count);
      
      return PaginationHelper.createOffsetPaginatedResult(dataResult.rows, total, validatedParams.limit, validatedParams.page);
    } catch (error) {
      logger.error('Error getting shop purchase history:', error);
      throw new Error('Failed to retrieve shop purchase history');
    }
  }

  async updateShopRcnBalance(shopId: string, amount: number, operation: 'add' | 'subtract'): Promise<void> {
    try {
      const operator = operation === 'add' ? '+' : '-';
      const query = `
        UPDATE shops 
        SET purchased_rcn_balance = purchased_rcn_balance ${operator} $1,
            updated_at = NOW()
        WHERE shop_id = $2 AND purchased_rcn_balance ${operation === 'subtract' ? '>=' : '> -'} $1
        RETURNING purchased_rcn_balance
      `;
      
      const result = await this.pool.query(query, [amount, shopId]);
      
      if (result.rows.length === 0) {
        throw new Error(operation === 'subtract' ? 'Insufficient shop balance' : 'Shop not found');
      }
      
      logger.info(`Shop ${shopId} balance ${operation}ed ${amount} RCN. New balance: ${result.rows[0].purchased_rcn_balance}`);
    } catch (error) {
      logger.error('Error updating shop RCN balance:', error);
      throw new Error('Failed to update shop RCN balance');
    }
  }

  // Analytics Methods
  async getTierBonusStatistics(shopId?: string): Promise<{
    totalBonusesIssued: number;
    totalBonusAmount: number;
    bonusesByTier: { [key: string]: { count: number; amount: number } };
  }> {
    try {
      const whereClause = shopId ? 'WHERE shop_id = $1' : '';
      const params = shopId ? [shopId] : [];
      
      const query = `
        SELECT 
          customer_tier,
          COUNT(*) as count,
          SUM(bonus_amount) as amount
        FROM tier_bonuses 
        ${whereClause}
        GROUP BY customer_tier
      `;
      
      const totalQuery = `
        SELECT 
          COUNT(*) as total_bonuses,
          SUM(bonus_amount) as total_amount
        FROM tier_bonuses
        ${whereClause}
      `;
      
      const [bonusResult, totalResult] = await Promise.all([
        this.pool.query(query, params),
        this.pool.query(totalQuery, params)
      ]);
      
      const bonusesByTier = bonusResult.rows.reduce((acc, row) => {
        acc[row.customer_tier] = {
          count: parseInt(row.count),
          amount: parseFloat(row.amount)
        };
        return acc;
      }, {} as { [key: string]: { count: number; amount: number } });
      
      return {
        totalBonusesIssued: parseInt(totalResult.rows[0].total_bonuses) || 0,
        totalBonusAmount: parseFloat(totalResult.rows[0].total_amount) || 0,
        bonusesByTier
      };
    } catch (error) {
      logger.error('Error getting tier bonus statistics:', error);
      throw new Error('Failed to retrieve tier bonus statistics');
    }
  }

  // Treasury management methods
  async getTreasuryData(): Promise<{
    totalSupply: number;
    availableSupply: number;
    totalSold: number;
    totalRevenue: number;
    lastUpdated: Date;
  }> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM admin_treasury WHERE id = 1'
      );
      
      if (result.rows.length === 0) {
        throw new Error('Treasury data not found');
      }
      
      const row = result.rows[0];
      return {
        totalSupply: parseFloat(row.total_supply),
        availableSupply: parseFloat(row.available_supply),
        totalSold: parseFloat(row.total_sold),
        totalRevenue: parseFloat(row.total_revenue),
        lastUpdated: row.last_updated
      };
    } catch (error) {
      logger.error('Error getting treasury data:', error);
      throw new Error('Failed to retrieve treasury data');
    }
  }

  async getTopRCNBuyers(limit: number = 10): Promise<Array<{
    shopId: string;
    shopName: string;
    totalPurchased: number;
    totalSpent: number;
    currentBalance: number;
  }>> {
    try {
      const result = await this.pool.query(`
        SELECT 
          s.shop_id,
          s.name as shop_name,
          s.purchased_rcn_balance as current_balance,
          COALESCE(SUM(p.amount), 0) as total_purchased,
          COALESCE(SUM(p.total_cost), 0) as total_spent
        FROM shops s
        LEFT JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id AND p.status = 'completed'
        GROUP BY s.shop_id, s.name, s.purchased_rcn_balance
        HAVING COALESCE(SUM(p.amount), 0) > 0
        ORDER BY total_purchased DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        totalPurchased: parseFloat(row.total_purchased),
        totalSpent: parseFloat(row.total_spent),
        currentBalance: parseFloat(row.current_balance)
      }));
    } catch (error) {
      logger.error('Error getting top RCN buyers:', error);
      throw new Error('Failed to retrieve top RCN buyers');
    }
  }

  async getRecentRCNPurchases(limit: number = 20): Promise<Array<{
    shopId: string;
    shopName: string;
    amount: number;
    cost: number;
    paymentMethod: string;
    transactionHash: string | null;
    status: string;
    createdAt: Date;
  }>> {
    try {
      const result = await this.pool.query(`
        SELECT 
          p.shop_id,
          s.name as shop_name,
          p.amount,
          p.total_cost as cost,
          p.payment_method,
          p.payment_reference as transaction_hash,
          p.status,
          p.created_at
        FROM shop_rcn_purchases p
        JOIN shops s ON p.shop_id = s.shop_id
        ORDER BY p.created_at DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        amount: parseFloat(row.amount),
        cost: parseFloat(row.cost),
        paymentMethod: row.payment_method,
        transactionHash: row.transaction_hash,
        status: row.status,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Error getting recent RCN purchases:', error);
      throw new Error('Failed to retrieve recent RCN purchases');
    }
  }

  async updateTreasuryTotalSupply(totalSupply: number): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE admin_treasury
        SET 
          total_supply = $1,
          available_supply = $1 - total_sold,
          last_updated = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [totalSupply]);
      
      logger.info('Treasury total supply updated', { totalSupply });
    } catch (error) {
      logger.error('Error updating treasury total supply:', error);
      throw new Error('Failed to update treasury total supply');
    }
  }

  async recalculateTreasury(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Calculate total sold and revenue from shop purchases (shops buying RCN from admin)
      const purchaseStats = await client.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_sold,
          COALESCE(SUM(total_cost), 0) as total_revenue
        FROM shop_rcn_purchases
        WHERE status = 'completed'
      `);
      
      const totalSold = parseFloat(purchaseStats.rows[0].total_sold);
      const totalRevenue = parseFloat(purchaseStats.rows[0].total_revenue);
      
      // Get current total supply from treasury (will be updated separately from blockchain)
      const currentTreasury = await client.query('SELECT total_supply FROM admin_treasury WHERE id = 1');
      const totalSupply = currentTreasury.rows[0] ? parseFloat(currentTreasury.rows[0].total_supply) : 0;
      const availableSupply = Math.max(0, totalSupply - totalSold);
      
      // Update treasury
      await client.query(`
        UPDATE admin_treasury
        SET 
          total_sold = $1,
          total_revenue = $2,
          available_supply = $3,
          last_updated = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [totalSold, totalRevenue, availableSupply]);
      
      await client.query('COMMIT');
      logger.info('Treasury recalculated successfully', { totalSold, totalRevenue, availableSupply, totalSupply });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error recalculating treasury:', error);
      throw new Error('Failed to recalculate treasury');
    } finally {
      client.release();
    }
  }

  // Cleanup method
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();